"""
server.py  –  Flask API server for the Font AI webapp
======================================================
Serves the static webapp, exposes REST endpoints for training control,
and runs inference (generate / interpolate / style-grid) using the
trained FontVAE model.

Run
---
    python server.py
    # → http://localhost:5000
"""

import base64
import io
import json
import os
import subprocess
import sys
import time
from functools import wraps
from pathlib import Path
from typing import Optional

from flask import Flask, jsonify, request, send_from_directory, Response

# Shared SDF renderer and unicode map
from scripts.sdf import render_sdf, get_font_unicode_map

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent
WEBAPP_DIR   = PROJECT_ROOT / "webapp"
MODELS_DIR   = PROJECT_ROOT / "models"
STATUS_FILE  = MODELS_DIR / "training_status.json"
MODEL_FILE   = MODELS_DIR / "font_vae3.pt"
TRAIN_SCRIPT    = PROJECT_ROOT / "scripts" / "train_vae.py"
DOWNLOAD_SCRIPT = PROJECT_ROOT / "scripts" / "download_fonts.py"
DOWNLOADED_FONTS_DIR = PROJECT_ROOT / "fonts" / "downloaded"
DATASET_DIR  = PROJECT_ROOT / "training_data"

# ---------------------------------------------------------------------------
# Unicode / font helpers  (shared module provides render_sdf, get_font_unicode_map)
# ---------------------------------------------------------------------------

# Alias for backward compatibility within this file
_get_font_unicode_map = get_font_unicode_map


def _update_manifest(font_key: str, meta: dict) -> None:
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = DATASET_DIR / "manifest.json"
    try:
        with open(manifest_path) as fh:
            manifest = json.load(fh)
    except Exception:
        manifest = {}
    manifest[font_key] = meta
    tmp = manifest_path.with_suffix(".tmp")
    with open(tmp, "w") as fh:
        json.dump(manifest, fh, indent=2)
    tmp.replace(manifest_path)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=None)

# ---------------------------------------------------------------------------
# CORS helper
# ---------------------------------------------------------------------------

def _cors(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.after_request
def after_request(response: Response) -> Response:
    return _cors(response)


@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path: str) -> Response:
    return _cors(Response(status=204))


# ---------------------------------------------------------------------------
# Model cache
# ---------------------------------------------------------------------------

_model_cache: Optional[object] = None   # FontVAE instance
_model_latent_dim: int = 64


def _reset_model_cache() -> None:
    global _model_cache
    _model_cache = None


def _infer_version(ckpt: dict) -> tuple:
    """Derive a human-readable version string from checkpoint metadata."""
    chars   = ckpt.get("characters") or ""
    latent  = ckpt.get("latent_dim", 64)
    epochs  = ckpt.get("epochs_trained") or ckpt.get("epochs") or "?"
    n_fonts = ckpt.get("font_count") or "?"

    if chars == "K" and latent <= 32:
        return "01.1", f"K-Style · {latent}dim · {epochs}ep · {n_fonts} fonts"
    elif chars == "K":
        return "01.1", f"K-Style · {latent}dim · {epochs}ep"
    elif chars and len(chars) > 10:
        return "01.2", f"Alphabet · {latent}dim · {epochs}ep · {n_fonts} fonts"
    elif chars and len(chars) > 1:
        return "01.1", f"{len(chars)}-char · {latent}dim · {epochs}ep"
    else:
        return "01.0", f"Quick · {latent}dim · {epochs}ep"


def _load_model():
    """Lazy-load the FontVAE model from disk. Returns (model, device) or raises."""
    global _model_cache, _model_latent_dim

    if _model_cache is not None:
        import torch
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        return _model_cache, device

    if not MODEL_FILE.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_FILE}")

    import importlib.util
    spec = importlib.util.spec_from_file_location("train_vae", TRAIN_SCRIPT)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    FontVAE = mod.FontVAE

    import torch
    device     = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(MODEL_FILE, map_location=device)

    latent_dim        = checkpoint.get("latent_dim", 64)
    _model_latent_dim = latent_dim

    model = FontVAE(latent_dim=latent_dim).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    _model_cache = model
    return model, device


def _render_glyph_tsdf(font_path: str, char: str, image_size: int = 64, band: int = 8):
    """Render a character as Truncated SDF — delegates to shared sdf.py."""
    return render_sdf(font_path, char, image_size=image_size, band=float(band))


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _read_status() -> dict:
    try:
        with open(STATUS_FILE) as fh:
            return json.load(fh)
    except Exception:
        return {"status": "idle"}


def _write_status(data: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATUS_FILE.with_suffix(".tmp")
    with open(tmp, "w") as fh:
        json.dump(data, fh, indent=2)
    tmp.replace(STATUS_FILE)


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _tensor_to_b64png(tensor) -> str:
    """Convert a (1, H, W) or (H, W) float SDF tensor [0,1] to a data-URI PNG.
    SDF polarity: high value = inside glyph (white). We invert so glyph is
    black ink on white paper, matching how type is actually read."""
    import torch
    from PIL import Image as PILImage

    arr = tensor.detach().cpu()
    if arr.dim() == 3:
        arr = arr.squeeze(0)                   # (H, W)
    # Invert: glyph was HIGH (white) → make it LOW (black) on white bg
    arr_np = (255 - arr.numpy() * 255).clip(0, 255).astype("uint8")
    img    = PILImage.fromarray(arr_np, mode="L")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


# ---------------------------------------------------------------------------
# Training subprocess management
# ---------------------------------------------------------------------------

_train_proc: Optional[subprocess.Popen] = None


def _is_training() -> bool:
    global _train_proc
    if _train_proc is None:
        return False
    return _train_proc.poll() is None   # None → still running


# ---------------------------------------------------------------------------
# Static file routes
# ---------------------------------------------------------------------------

@app.route("/")
def serve_index() -> Response:
    index = WEBAPP_DIR / "index.html"
    if index.exists():
        return send_from_directory(str(WEBAPP_DIR), "index.html")
    return jsonify({"message": "Font AI API server running. Webapp not found."}), 200


@app.route("/<path:filename>")
def serve_static(filename: str) -> Response:
    return send_from_directory(str(WEBAPP_DIR), filename)


# ---------------------------------------------------------------------------
# API – model info
# ---------------------------------------------------------------------------

@app.route("/api/model-info", methods=["GET"])
def api_model_info() -> Response:
    status   = _read_status()
    model_ok = MODEL_FILE.exists()

    info: dict = {
        "model_exists":    model_ok,
        "model_path":      str(MODEL_FILE) if model_ok else None,
        "model_size_mb":   round(MODEL_FILE.stat().st_size / 1_048_576, 2) if model_ok else None,
        "training_status": status.get("status", "idle"),
        "latent_dim":      None,
        "epochs_trained":  None,
        "model_version":   None,
        "version_detail":  None,
    }

    if model_ok:
        try:
            import torch
            ckpt = torch.load(MODEL_FILE, map_location="cpu")
            info["latent_dim"]     = ckpt.get("latent_dim")
            info["epochs_trained"] = ckpt.get("epochs_trained") or ckpt.get("epochs")
            info["characters"]     = ckpt.get("characters")
            info["font_count"]     = ckpt.get("font_count")
            info["beta"]           = ckpt.get("beta")
            ver, detail = _infer_version(ckpt)
            info["model_version"]  = ver
            info["version_detail"] = detail
        except Exception as exc:
            info["load_error"] = str(exc)

    return jsonify(info)


@app.route("/api/model-reload", methods=["POST"])
def api_model_reload() -> Response:
    """Force-clear the model cache so next request reloads from disk."""
    _reset_model_cache()
    return jsonify({"message": "Model cache cleared. Will reload on next request."})


# ---------------------------------------------------------------------------
# API – model registry & selection
# ---------------------------------------------------------------------------

@app.route("/api/models/list", methods=["GET"])
def api_models_list() -> Response:
    """List all available models from the registry."""
    registry_path = MODELS_DIR / "model_registry.json"
    
    if not registry_path.exists():
        return jsonify({
            "models": [],
            "latest": None,
            "message": "No models registered yet"
        })
    
    try:
        with open(registry_path) as f:
            registry = json.load(f)
        
        # Filter to active models only
        active_models = []
        for version, info in registry.get("models", {}).items():
            if info.get("status") == "active":
                active_models.append({
                    "version": version,
                    "created_at": info.get("created_at"),
                    "fonts": info.get("fonts", []),
                    "status": "active"
                })
        
        # Sort by version (newest first)
        active_models.sort(key=lambda x: x["version"], reverse=True)
        
        return jsonify({
            "models": active_models,
            "latest": registry.get("latest"),
            "total": len(active_models)
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/models/<version>/info", methods=["GET"])
def api_model_version_info(version: str) -> Response:
    """Get detailed info about a specific model version."""
    registry_path = MODELS_DIR / "model_registry.json"
    
    if not registry_path.exists():
        return jsonify({"error": "Registry not found"}), 404
    
    try:
        with open(registry_path) as f:
            registry = json.load(f)
        
        if version not in registry.get("models", {}):
            return jsonify({"error": f"Model v{version} not found"}), 404
        
        info = registry["models"][version]
        
        # Try to load checkpoint metadata
        model_path = MODELS_DIR / info.get("model_path", "")
        if model_path.exists():
            try:
                import torch
                ckpt = torch.load(model_path, map_location="cpu")
                info["checkpoint_metadata"] = {
                    "latent_dim": ckpt.get("latent_dim"),
                    "epochs_trained": ckpt.get("epochs_trained"),
                    "architecture": ckpt.get("architecture", "FontVAE")
                }
            except Exception:
                pass
        
        return jsonify(info)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/models/<version>/set", methods=["POST"])
def api_model_set(version: str) -> Response:
    """Activate a specific model version for inference."""
    registry_path = MODELS_DIR / "model_registry.json"
    
    if not registry_path.exists():
        return jsonify({"error": "Registry not found"}), 404
    
    try:
        with open(registry_path) as f:
            registry = json.load(f)
        
        if version not in registry.get("models", {}):
            return jsonify({"error": f"Model v{version} not found"}), 404
        
        model_info = registry["models"][version]
        model_path = PROJECT_ROOT / model_info.get("model_path", "")
        
        if not model_path.exists():
            return jsonify({"error": f"Model file not found: {model_path}"}), 404
        
        # Copy to default location
        import shutil
        default_path = MODELS_DIR / "font_vae_unified.pt"
        shutil.copy2(model_path, default_path)
        
        # Reset cache so next request loads new model
        _reset_model_cache()
        
        return jsonify({
            "message": f"Activated model v{version}",
            "version": version,
            "path": str(default_path),
            "fonts": model_info.get("fonts", [])
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/pipeline/status", methods=["GET"])
def api_pipeline_status() -> Response:
    """Get overall pipeline status: fonts, models, readiness."""
    try:
        # Count fonts
        fonts = {}
        training_data_dir = DATASET_DIR
        if training_data_dir.exists():
            for font_dir in training_data_dir.iterdir():
                if font_dir.is_dir() and not font_dir.name.startswith('.'):
                    meta_file = font_dir / "meta.json"
                    if meta_file.exists():
                        fonts[font_dir.name] = True
        
        # Load model registry
        registry_path = MODELS_DIR / "model_registry.json"
        latest_model = None
        if registry_path.exists():
            with open(registry_path) as f:
                registry = json.load(f)
                latest_model = registry.get("latest")
        
        return jsonify({
            "fonts_collected": len(fonts),
            "font_names": list(fonts.keys()),
            "models_available": len([m for m in registry.get("models", {}).values() 
                                    if m.get("status") == "active"]) if registry_path.exists() else 0,
            "latest_model": latest_model,
            "manifest_exists": (DATASET_DIR / "training_manifest.json").exists(),
            "ready_for_training": len(fonts) > 0 and (DATASET_DIR / "training_manifest.json").exists()
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/encode-font", methods=["POST"])
def api_encode_font() -> Response:
    """Encode a glyph from an uploaded font into the latent space.

    Body (JSON):
        font_data  : base64-encoded TTF/OTF bytes
        char       : character to encode (default 'K')

    Returns:
        latent_vector : float[]  — mu from the encoder (use as slider seed)
        source_image  : data URI — the uploaded font's glyph (ink-on-paper)
        decoded_image : data URI — the model's reconstruction of that glyph
    """
    import tempfile, torch

    try:
        model, device = _load_model()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Model load error: {exc}"}), 500

    body      = request.get_json(silent=True) or {}
    font_b64  = body.get("font_data")
    char      = body.get("char", "K")

    if not font_b64:
        return jsonify({"error": "font_data (base64 TTF) is required"}), 400

    # Decode and write to a temp file
    try:
        font_bytes = base64.b64decode(font_b64)
    except Exception:
        return jsonify({"error": "font_data is not valid base64"}), 400

    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        tmp.write(font_bytes)
        tmp_path = tmp.name

    try:
        sdf = _render_glyph_tsdf(tmp_path, char)
    finally:
        os.unlink(tmp_path)

    if sdf is None:
        return jsonify({"error": f"Could not render '{char}' from this font. Try a different character."}), 400

    import numpy as np
    from PIL import Image as PILImage

    # Source glyph as ink-on-paper PNG (inverted so it's readable)
    src_inv = (255 - sdf * 255).clip(0, 255).astype("uint8")
    src_img = PILImage.fromarray(src_inv, "L")
    buf = io.BytesIO()
    src_img.save(buf, "PNG")
    source_image = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    # Encode through the VAE encoder → mu
    tensor = torch.from_numpy(sdf).unsqueeze(0).unsqueeze(0).to(device)  # (1,1,H,W)
    with torch.no_grad():
        mu, logvar = model.encode(tensor)
        decoded    = model.decode(mu)   # decode mu (no noise) for clean reconstruction

    latent_vector  = mu[0].cpu().tolist()
    decoded_image  = _tensor_to_b64png(decoded[0])

    return jsonify({
        "latent_vector":  latent_vector,
        "source_image":   source_image,
        "decoded_image":  decoded_image,
        "char":           char,
    })


# ---------------------------------------------------------------------------
# API – training status
# ---------------------------------------------------------------------------

@app.route("/api/train/status", methods=["GET"])
def api_train_status() -> Response:
    return jsonify(_read_status())


# ---------------------------------------------------------------------------
# API – start training
# ---------------------------------------------------------------------------

@app.route("/api/train/start", methods=["POST"])
def api_train_start() -> Response:
    global _train_proc

    if _is_training():
        return jsonify({"error": "Training is already running."}), 409

    body       = request.get_json(silent=True) or {}
    quick      = bool(body.get("quick", False))
    epochs     = int(body.get("epochs", 50))
    batch_size = int(body.get("batch_size", 16))
    latent_dim = int(body.get("latent_dim", 64))
    beta       = float(body.get("beta", 1.0))

    # For full training: download diverse fonts first, then train.
    # For quick mode: skip download, use whatever fonts are available.
    if quick:
        train_cmd = [
            sys.executable, str(TRAIN_SCRIPT),
            "--epochs",     str(epochs),
            "--batch-size", str(batch_size),
            "--latent-dim", str(latent_dim),
            "--beta",       str(beta),
            "--quick",
        ]
        pipeline_script = None
    else:
        # Shell pipeline: download_fonts.py && train_vae.py
        # Written as a small wrapper so progress is tracked correctly
        pipeline_script = PROJECT_ROOT / "models" / "_run_pipeline.sh"
        pipeline_script.parent.mkdir(exist_ok=True)
        pipeline_script.write_text(
            f"#!/bin/bash\nset -e\n"
            f"{sys.executable} {DOWNLOAD_SCRIPT} --dest fonts/downloaded\n"
            f"{sys.executable} {TRAIN_SCRIPT} "
            f"--epochs {epochs} --batch-size {batch_size} "
            f"--latent-dim {latent_dim} --beta {beta} "
            f"--fonts-dir fonts/downloaded\n"
        )
        pipeline_script.chmod(0o755)
        train_cmd = ["bash", str(pipeline_script)]

    # Reset model cache
    _reset_model_cache()

    # Clear any previous stop flag
    current = _read_status()
    current.pop("stop_requested", None)
    current["status"] = "starting"
    current["message"] = "Downloading fonts…" if not quick else "Starting…"
    _write_status(current)

    try:
        _train_proc = subprocess.Popen(
            train_cmd,
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({
        "message": "Download + training pipeline started." if not quick else "Training started.",
        "pid":     _train_proc.pid,
        "quick":   quick,
        "epochs":  epochs,
    })


# ---------------------------------------------------------------------------
# API – stop training
# ---------------------------------------------------------------------------

@app.route("/api/train/stop", methods=["POST"])
def api_train_stop() -> Response:
    current = _read_status()
    current["stop_requested"] = True
    _write_status(current)
    return jsonify({"message": "Stop requested. Training will halt at the end of the current epoch."})


# ---------------------------------------------------------------------------
# API – generate
# ---------------------------------------------------------------------------

@app.route("/api/generate", methods=["POST"])
def api_generate() -> Response:
    try:
        import torch

        model, device = _load_model()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Model load error: {exc}"}), 500

    body = request.get_json(silent=True) or {}
    z_in = body.get("latent_vector")

    import torch

    with torch.no_grad():
        if z_in is None:
            z = torch.randn(1, _model_latent_dim, device=device)
        else:
            try:
                z = torch.tensor(z_in, dtype=torch.float32, device=device).unsqueeze(0)
            except Exception as exc:
                return jsonify({"error": f"Invalid latent_vector: {exc}"}), 400

        x_hat = model.decode(z)                # (1, 1, H, W)
        image = _tensor_to_b64png(x_hat[0])

    return jsonify({
        "image":         image,
        "latent_vector": z.squeeze(0).tolist(),
    })


# ---------------------------------------------------------------------------
# API – generate alphabet (with character-specific glyphs from reference font)
# ---------------------------------------------------------------------------

@app.route("/api/generate-alphabet", methods=["POST"])
def api_generate_alphabet() -> Response:
    """Generate an alphabet by encoding each character from a reference font,
    then applying the style modification (latent vector) to each character.
    
    Body (JSON):
        reference_font : base64 TTF/OTF (optional — if provided, encodes each char)
        latent_vector  : float[] (optional — style modification to apply)
        chars          : string (default 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    
    Returns:
        alphabet : { char: image_data_uri, ... }
    """
    try:
        import torch
        model, device = _load_model()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Model load error: {exc}"}), 500

    body = request.get_json(silent=True) or {}
    chars = body.get("chars", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    z_mod = body.get("latent_vector")
    ref_font_b64 = body.get("reference_font")

    if not chars:
        return jsonify({"error": "chars is required"}), 400

    import torch
    import tempfile

    # Parse modifier vector
    if z_mod is None:
        z_mod = [0.0] * _model_latent_dim
    else:
        try:
            z_mod = list(z_mod)[:_model_latent_dim]
            # Pad with zeros if shorter
            z_mod += [0.0] * (_model_latent_dim - len(z_mod))
        except Exception:
            return jsonify({"error": "Invalid latent_vector"}), 400

    alphabet_images = {}

    with torch.no_grad():
        for char in chars:
            # If reference font provided, encode this character's glyph
            if ref_font_b64:
                try:
                    font_bytes = base64.b64decode(ref_font_b64)
                except Exception:
                    return jsonify({"error": "Invalid reference_font base64"}), 400

                with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
                    tmp.write(font_bytes)
                    tmp_path = tmp.name

                try:
                    sdf = _render_glyph_tsdf(tmp_path, char)
                finally:
                    os.unlink(tmp_path)

                if sdf is None:
                    # Fallback: use random latent for unrenderable characters
                    z = torch.randn(1, _model_latent_dim, device=device)
                else:
                    # Encode the character's glyph
                    tensor = torch.from_numpy(sdf).unsqueeze(0).unsqueeze(0).to(device)
                    mu, _ = model.encode(tensor)
                    z = mu.clone()

                    # Apply modifier
                    z_mod_tensor = torch.tensor([z_mod], dtype=torch.float32, device=device)
                    z = z + z_mod_tensor * 0.5  # Scale modifier for subtlety
            else:
                # No reference font: use pure latent vector
                z = torch.tensor([z_mod], dtype=torch.float32, device=device)

            # Decode to image
            x_hat = model.decode(z)
            alphabet_images[char] = _tensor_to_b64png(x_hat[0])

    return jsonify({"alphabet": alphabet_images})


# ---------------------------------------------------------------------------
# API – interpolate
# ---------------------------------------------------------------------------

@app.route("/api/interpolate", methods=["POST"])
def api_interpolate() -> Response:
    try:
        import torch

        model, device = _load_model()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Model load error: {exc}"}), 500

    body  = request.get_json(silent=True) or {}
    z_a   = body.get("z_a")
    z_b   = body.get("z_b")
    steps = int(body.get("steps", 5))

    import torch

    if z_a is None or z_b is None:
        return jsonify({"error": "'z_a' and 'z_b' are required."}), 400

    try:
        za = torch.tensor(z_a, dtype=torch.float32, device=device).unsqueeze(0)
        zb = torch.tensor(z_b, dtype=torch.float32, device=device).unsqueeze(0)
    except Exception as exc:
        return jsonify({"error": f"Invalid latent vectors: {exc}"}), 400

    alphas = [i / max(steps - 1, 1) for i in range(steps)]
    images = []

    with torch.no_grad():
        for alpha in alphas:
            z     = (1 - alpha) * za + alpha * zb
            x_hat = model.decode(z)
            images.append(_tensor_to_b64png(x_hat[0]))

    return jsonify({"images": images, "alphas": alphas})


# ---------------------------------------------------------------------------
# API – style grid
# ---------------------------------------------------------------------------

@app.route("/api/style-grid", methods=["POST"])
def api_style_grid() -> Response:
    try:
        import torch

        model, device = _load_model()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Model load error: {exc}"}), 500

    body      = request.get_json(silent=True) or {}
    dim_x     = int(body.get("dim_x", 0))
    dim_y     = int(body.get("dim_y", 1))
    grid_size = int(body.get("grid_size", 6))
    base_z    = body.get("base_z")

    import torch

    # Build or validate base latent vector
    if base_z is None:
        z_base = torch.zeros(1, _model_latent_dim, device=device)
    else:
        try:
            z_base = torch.tensor(base_z, dtype=torch.float32, device=device).unsqueeze(0)
        except Exception as exc:
            return jsonify({"error": f"Invalid base_z: {exc}"}), 400

    # Validate dimension indices
    if dim_x >= _model_latent_dim or dim_y >= _model_latent_dim:
        return jsonify({
            "error": f"dim_x / dim_y must be < latent_dim ({_model_latent_dim})."
        }), 400

    # Range over which each dimension is swept (±3σ)
    values = torch.linspace(-3.0, 3.0, grid_size, device=device)

    grid_images = []

    with torch.no_grad():
        for vy in values:
            row = []
            for vx in values:
                z = z_base.clone()
                z[0, dim_x] = vx
                z[0, dim_y] = vy
                x_hat = model.decode(z)
                row.append(_tensor_to_b64png(x_hat[0]))
            grid_images.append(row)

    return jsonify({
        "images": grid_images,
        "dim_x":  dim_x,
        "dim_y":  dim_y,
    })


# ---------------------------------------------------------------------------
# API – dataset: add font
# ---------------------------------------------------------------------------

@app.route("/api/dataset/add-font", methods=["POST"])
def api_dataset_add_font() -> Response:
    """Collect a font into the training dataset.

    Body (JSON):
        font_data  : base64-encoded TTF/OTF bytes
        font_name  : human-readable name (e.g. "Roboto-Regular")

    Returns:
        font_name, glyph_count, by_script, sample_images, chars_preview
    """
    import tempfile, numpy as np
    from PIL import Image as PILImage

    body      = request.get_json(silent=True) or {}
    font_b64  = body.get("font_data")
    font_name = (body.get("font_name") or "unknown").strip()

    if not font_b64:
        return jsonify({"error": "font_data (base64 TTF) is required"}), 400

    try:
        font_bytes = base64.b64decode(font_b64)
    except Exception:
        return jsonify({"error": "font_data is not valid base64"}), 400

    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        tmp.write(font_bytes)
        tmp_path = tmp.name

    try:
        # ── 1. Extract unicode map ────────────────────────────────────────
        chars_info = _get_font_unicode_map(tmp_path)
        if not chars_info:
            return jsonify({"error": "Could not read unicode map from this font."}), 400

        # ── 2. Render each supported char as TSDF ─────────────────────────
        glyphs, valid_chars = [], []
        for info in chars_info:
            sdf = _render_glyph_tsdf(tmp_path, info["char"])
            if sdf is not None:
                glyphs.append(sdf)
                valid_chars.append(info)

        if not glyphs:
            return jsonify({"error": "No renderable glyphs found in this font."}), 400

        # ── 3. Save to training_data/{font_key}/ ──────────────────────────
        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = "".join(c if c.isalnum() or c in "-_." else "_" for c in font_name)
        font_dir  = DATASET_DIR / safe_name
        font_dir.mkdir(exist_ok=True)

        import numpy as np
        glyphs_arr = np.array(glyphs, dtype=np.float32)   # (N, 64, 64)
        np.savez_compressed(
            str(font_dir / "glyphs.npz"),
            glyphs     = glyphs_arr,
            chars      = np.array([c["char"]       for c in valid_chars]),
            codepoints = np.array([c["codepoint"]  for c in valid_chars]),
            scripts    = np.array([c["script"]     for c in valid_chars]),
        )

        # ── 4. Build per-script stats ──────────────────────────────────────
        by_script: dict = {}
        for c in valid_chars:
            by_script[c["script"]] = by_script.get(c["script"], 0) + 1

        meta = {
            "font_name":   font_name,
            "glyph_count": len(glyphs),
            "by_script":   by_script,
            "added":       time.time(),
        }
        with open(font_dir / "meta.json", "w") as fh:
            json.dump(meta, fh, indent=2)

        _update_manifest(safe_name, meta)

        # ── 5. Sample preview images (first 12) ───────────────────────────
        samples = []
        for sdf in glyphs[:12]:
            inv = (255 - sdf * 255).clip(0, 255).astype("uint8")
            img = PILImage.fromarray(inv, "L")
            buf = io.BytesIO()
            img.save(buf, "PNG")
            samples.append("data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())

        return jsonify({
            "font_name":     font_name,
            "glyph_count":   len(glyphs),
            "total_in_font": len(chars_info),   # incl. unrenderable
            "by_script":     by_script,
            "sample_images": samples,
            "chars_preview": [c["char"] for c in valid_chars[:80]],
        })

    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# API – dataset: info
# ---------------------------------------------------------------------------

@app.route("/api/dataset/info", methods=["GET"])
def api_dataset_info() -> Response:
    """Return aggregate stats for the collected training dataset."""
    manifest_path = DATASET_DIR / "manifest.json"
    try:
        with open(manifest_path) as fh:
            manifest = json.load(fh)
    except Exception:
        manifest = {}

    total_fonts  = len(manifest)
    total_glyphs = sum(v.get("glyph_count", 0) for v in manifest.values())
    all_scripts: dict = {}
    for v in manifest.values():
        for script, count in v.get("by_script", {}).items():
            all_scripts[script] = all_scripts.get(script, 0) + count

    fonts_list = [
        {"key": k, "name": v.get("font_name", k),
         "glyph_count": v.get("glyph_count", 0),
         "by_script": v.get("by_script", {})}
        for k, v in manifest.items()
    ]

    return jsonify({
        "total_fonts":  total_fonts,
        "total_glyphs": total_glyphs,
        "by_script":    all_scripts,
        "fonts":        fonts_list,
    })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Project root : {PROJECT_ROOT}")
    print(f"Webapp       : {WEBAPP_DIR}")
    print(f"Models dir   : {MODELS_DIR}")
    print(f"Model file   : {MODEL_FILE}  (exists={MODEL_FILE.exists()})")
    print("Starting Flask on http://localhost:5001 …")
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
