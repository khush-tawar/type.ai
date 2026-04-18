"""
train_vae.py  –  Font VAE training script
==========================================
Discovers .ttf / .otf fonts under PROJECT_ROOT/fonts/, renders every
character as a 64×64 signed-distance-field image, and trains a
convolutional β-VAE.

Usage
-----
python scripts/train_vae.py [--epochs N] [--batch-size B]
                            [--latent-dim D] [--beta B] [--quick]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from fontTools.ttLib import TTFont

# Import shared SDF renderer
try:
    from scripts.sdf import render_sdf
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sdf import render_sdf

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR    = PROJECT_ROOT / "fonts"
TRAINING_DATA_DIR = PROJECT_ROOT / "training_data"
MODELS_DIR   = PROJECT_ROOT / "models"
STATUS_FILE  = MODELS_DIR / "training_status.json"
MODEL_FILE   = MODELS_DIR / "font_vae3.pt"

IMG_SIZE  = 64      # pixels
CHARS_ALL = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    "!@#$%&"
)
CHARS_QUICK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

SERIF_KEYWORDS = {
    "serif", "garamond", "baskerville", "merriweather", "lora", "playfair",
    "times", "bitter", "cormorant", "slab"
}
SANS_KEYWORDS = {
    "sans", "montserrat", "roboto", "poppins", "lato", "ubuntu", "nunito",
    "oswald", "barlow", "mono", "code", "jetbrains"
}

# ---------------------------------------------------------------------------
# SDF rendering  (delegates to shared scripts/sdf.py)
# ---------------------------------------------------------------------------

def render_glyph(
    font_path: str,
    char: str,
    size: int = IMG_SIZE,
) -> Optional[np.ndarray]:
    """Render *char* as a 64×64 SDF image using the shared SDF renderer."""
    return render_sdf(font_path, char, image_size=size)


def _infer_style_label(font_path: str) -> int:
    """Infer style class from font filename/path: 1=serif, 0=sans/non-serif."""
    name = Path(font_path).name.lower().replace("-", " ").replace("_", " ")
    serif_hits = sum(1 for k in SERIF_KEYWORDS if k in name)
    sans_hits = sum(1 for k in SANS_KEYWORDS if k in name)
    if "sans" in name:
        return 0
    if "serif" in name:
        return 1
    if serif_hits == sans_hits:
        return 0
    return 1 if serif_hits > sans_hits else 0


def _extract_unicode_chars(
    font_path: str,
    max_chars: int,
    min_codepoint: int,
    max_codepoint: int,
    include_private_use: bool,
) -> str:
    """Extract up to max_chars renderable Unicode characters from a font cmap."""
    chars: List[str] = []
    seen: Set[str] = set()

    try:
        with TTFont(font_path, lazy=True) as tt:
            cmap = tt.getBestCmap() or {}
    except Exception:
        return ""

    for cp in sorted(cmap.keys()):
        if cp < min_codepoint or cp > max_codepoint:
            continue
        if not include_private_use and (
            0xE000 <= cp <= 0xF8FF or
            0xF0000 <= cp <= 0xFFFFD or
            0x100000 <= cp <= 0x10FFFD
        ):
            continue
        try:
            ch = chr(cp)
        except ValueError:
            continue
        if ch in seen:
            continue
        seen.add(ch)
        chars.append(ch)
        if len(chars) >= max_chars:
            break
    return "".join(chars)


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class FontDataset(Dataset):
    """Pre-rendered SDF glyphs stored in memory."""

    def __init__(
        self,
        font_paths: List[str],
        chars: str = CHARS_ALL,
        char_mode: str = "alphabet",
        max_chars_per_font: int = 512,
        min_codepoint: int = 32,
        max_codepoint: int = 0x10FFFF,
        include_private_use: bool = False,
        img_size: int = IMG_SIZE,
    ) -> None:
        self.samples: List[Tuple[np.ndarray, float]] = []
        self.style_counts: Dict[str, int] = {"sans": 0, "serif": 0}
        self.style_sample_counts: Dict[str, int] = {"sans": 0, "serif": 0}

        font_charsets: Dict[str, str] = {}
        total = 0
        for fp in font_paths:
            if char_mode == "unicode":
                font_chars = _extract_unicode_chars(
                    fp,
                    max_chars=max_chars_per_font,
                    min_codepoint=min_codepoint,
                    max_codepoint=max_codepoint,
                    include_private_use=include_private_use,
                )
                if not font_chars:
                    font_chars = chars
            else:
                font_chars = chars
            font_charsets[fp] = font_chars
            total += len(font_chars)

        done = 0
        print(
            f"Rendering glyphs from {len(font_paths)} font(s) "
            f"in {char_mode} mode = up to {total} samples …"
        )

        for fp in font_paths:
            label = float(_infer_style_label(fp))
            if label > 0.5:
                self.style_counts["serif"] += 1
            else:
                self.style_counts["sans"] += 1

            for ch in font_charsets[fp]:
                sdf = render_glyph(fp, ch, img_size)
                if sdf is not None:
                    self.samples.append((sdf, label))
                    if label > 0.5:
                        self.style_sample_counts["serif"] += 1
                    else:
                        self.style_sample_counts["sans"] += 1
                done += 1
                if done % 500 == 0:
                    print(f"  rendered {done}/{total} "
                          f"({len(self.samples)} kept)", flush=True)

        print(f"Dataset ready – {len(self.samples)} valid glyphs.")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        arr, style_label = self.samples[idx]           # (H, W), float
        glyph = torch.from_numpy(arr).unsqueeze(0)     # (1, H, W)
        label = torch.tensor(style_label, dtype=torch.float32)
        return glyph, label


class PrecomputedGlyphDataset(Dataset):
    """Dataset backed by precomputed glyph arrays in training_data/*/glyphs.npz."""

    def __init__(self, training_data_dir: Path, img_size: int = IMG_SIZE) -> None:
        self.samples: List[Tuple[np.ndarray, float]] = []
        self.style_counts: Dict[str, int] = {"sans": 0, "serif": 0}
        self.style_sample_counts: Dict[str, int] = {"sans": 0, "serif": 0}

        font_dirs = [
            p for p in training_data_dir.iterdir()
            if p.is_dir() and (p / "glyphs.npz").exists()
        ] if training_data_dir.exists() else []

        total_fonts = len(font_dirs)
        print(f"Loading precomputed glyphs from {total_fonts} training_data font(s) …")

        for fdir in font_dirs:
            npz_path = fdir / "glyphs.npz"
            meta_path = fdir / "meta.json"

            style_source = fdir.name
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        meta = json.load(mf)
                        style_source = meta.get("font_name", style_source)
                except Exception:
                    pass

            label = float(_infer_style_label(style_source))
            if label > 0.5:
                self.style_counts["serif"] += 1
            else:
                self.style_counts["sans"] += 1

            try:
                with np.load(npz_path, allow_pickle=False) as data:
                    glyphs = data["glyphs"]
            except Exception as exc:
                print(f"  skip {npz_path}: {exc}")
                continue

            if glyphs.ndim != 3:
                print(f"  skip {npz_path}: expected (N,H,W), got {glyphs.shape}")
                continue

            for g in glyphs:
                arr = np.asarray(g, dtype=np.float32)
                if arr.shape != (img_size, img_size):
                    # Keep behavior strict and predictable for model input size.
                    continue
                self.samples.append((arr, label))
                if label > 0.5:
                    self.style_sample_counts["serif"] += 1
                else:
                    self.style_sample_counts["sans"] += 1

        print(f"Precomputed dataset ready – {len(self.samples)} valid glyphs.")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        arr, style_label = self.samples[idx]
        glyph = torch.from_numpy(arr).unsqueeze(0)
        label = torch.tensor(style_label, dtype=torch.float32)
        return glyph, label


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

class FontVAE(nn.Module):
    """
    Convolutional β-VAE for 64×64 SDF glyph images.

    Encoder path:  1 → 32 → 64 → 128 → 256  (stride-2 convolutions)
    Decoder path:  256 → 128 → 64 → 32 → 1   (transposed convolutions)
    Latent space:  `latent_dim`-dimensional Gaussian
    """

    def __init__(self, latent_dim: int = 64) -> None:
        super().__init__()
        self.latent_dim = latent_dim

        # ---- encoder -----------------------------------------------------
        self.encoder = nn.Sequential(
            # 1×64×64 → 32×32×32
            nn.Conv2d(1, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.LeakyReLU(0.2, inplace=True),
            # 32×32×32 → 64×16×16
            nn.Conv2d(32, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.LeakyReLU(0.2, inplace=True),
            # 64×16×16 → 128×8×8
            nn.Conv2d(64, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            # 128×8×8 → 256×4×4
            nn.Conv2d(128, 256, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True),
        )
        # 256 × 4 × 4 = 4096 features
        self._enc_flat = 256 * 4 * 4

        self.fc_mu     = nn.Linear(self._enc_flat, latent_dim)
        self.fc_logvar = nn.Linear(self._enc_flat, latent_dim)
        self.fc_style  = nn.Linear(latent_dim, 1)

        # ---- decoder -----------------------------------------------------
        self.fc_decode = nn.Linear(latent_dim, self._enc_flat)

        self.decoder = nn.Sequential(
            # 256×4×4 → 128×8×8
            nn.ConvTranspose2d(256, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            # 128×8×8 → 64×16×16
            nn.ConvTranspose2d(128, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            # 64×16×16 → 32×32×32
            nn.ConvTranspose2d(64, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            # 32×32×32 → 1×64×64
            nn.ConvTranspose2d(32, 1, kernel_size=4, stride=2, padding=1),
            nn.Sigmoid(),
        )

    # ------------------------------------------------------------------
    def encode(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        h = self.encoder(x).view(-1, self._enc_flat)
        return self.fc_mu(h), self.fc_logvar(h)

    def reparameterise(
        self,
        mu: torch.Tensor,
        logvar: torch.Tensor,
    ) -> torch.Tensor:
        if self.training:
            std = torch.exp(0.5 * logvar)
            eps = torch.randn_like(std)
            return mu + eps * std
        return mu

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        h = F.relu(self.fc_decode(z))
        h = h.view(-1, 256, 4, 4)
        return self.decoder(h)

    def predict_style(self, z: torch.Tensor) -> torch.Tensor:
        """Predict serif probability logits from latent vector."""
        return self.fc_style(z)

    def forward(
        self,
        x: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        mu, logvar = self.encode(x)
        z          = self.reparameterise(mu, logvar)
        x_hat      = self.decode(z)
        return x_hat, mu, logvar


# ---------------------------------------------------------------------------
# Loss
# ---------------------------------------------------------------------------

def vae_loss(
    x: torch.Tensor,
    x_hat: torch.Tensor,
    mu: torch.Tensor,
    logvar: torch.Tensor,
    beta: float = 1.0,
    recon_reduction: str = "mean",
) -> Tuple[torch.Tensor, float, float]:
    """β-VAE loss = reconstruction + β × KL divergence."""
    if recon_reduction == "sum":
        recon = F.binary_cross_entropy(x_hat, x, reduction="sum") / x.size(0)
    else:
        recon = F.binary_cross_entropy(x_hat, x, reduction="mean")

    kl_per_sample = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp(), dim=1)
    if recon_reduction == "sum":
        kl = kl_per_sample.mean()
    else:
        # Keep KL scale closer to mean-recon scale.
        kl = (kl_per_sample / mu.size(1)).mean()

    loss  = recon + beta * kl
    return loss, recon.item(), kl.item()


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _write_status(data: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATUS_FILE.with_suffix(".tmp")
    with open(tmp, "w") as fh:
        json.dump(data, fh, indent=2)
    tmp.replace(STATUS_FILE)


def _read_status() -> dict:
    try:
        with open(STATUS_FILE) as fh:
            return json.load(fh)
    except Exception:
        return {}


def _stop_requested() -> bool:
    return bool(_read_status().get("stop_requested", False))


# ---------------------------------------------------------------------------
# Font discovery
# ---------------------------------------------------------------------------

def discover_fonts(root: Path) -> List[str]:
    paths = []
    for ext in ("*.ttf", "*.otf", "*.TTF", "*.OTF"):
        paths.extend(str(p) for p in root.rglob(ext))
    paths.sort()
    return paths


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

def train(
    epochs: int      = 50,
    batch_size: int  = 16,
    latent_dim: int  = 64,
    beta: float      = 1.0,
    beta_start: float = 0.0,
    beta_warmup_epochs: int = 20,
    style_weight: float = 0.5,
    center_weight: float = 0.05,
    recon_reduction: str = "mean",
    char_mode: str = "unicode",
    max_chars_per_font: int = 512,
    min_codepoint: int = 32,
    max_codepoint: int = 0x10FFFF,
    include_private_use: bool = False,
    quick: bool      = False,
    fonts_dir: str = "",
    use_precomputed: bool = True,
) -> None:

    if quick:
        epochs     = 20
        latent_dim = 32
        chars      = CHARS_QUICK
        char_mode  = "alphabet"
    else:
        chars = CHARS_ALL

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Announce start
    # ------------------------------------------------------------------
    _write_status({
        "status":       "initialising",
        "epoch":        0,
        "total_epochs": epochs,
        "progress":     0.0,
    })

    # ------------------------------------------------------------------
    # Fonts & dataset
    # ------------------------------------------------------------------
    dataset: Optional[Dataset] = None

    # Prefer precomputed glyphs from training_data unless explicit font dirs are provided.
    if use_precomputed and not fonts_dir:
        try:
            precomputed = PrecomputedGlyphDataset(TRAINING_DATA_DIR)
            if len(precomputed) > 0:
                dataset = precomputed
        except Exception as exc:
            print(f"Precomputed dataset unavailable, falling back to raw fonts: {exc}")

    if dataset is None:
        raw_dirs = []
        if fonts_dir:
            raw_dirs = [d.strip() for d in fonts_dir.split(",") if d.strip()]
        if not raw_dirs:
            raw_dirs = [str(FONTS_DIR)]

        search_dirs: List[Path] = []
        for d in raw_dirs:
            p = Path(d)
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            search_dirs.append(p)

        font_paths: List[str] = []
        for sdir in search_dirs:
            if sdir.exists():
                font_paths.extend(discover_fonts(sdir))

        # De-duplicate while preserving order
        font_paths = list(dict.fromkeys(font_paths))
        if not font_paths:
            _write_status({"status": "error", "message": f"No fonts found in {search_dirs}"})
            print("ERROR: No .ttf/.otf fonts found under", search_dirs, file=sys.stderr)
            sys.exit(1)

        print(f"Found {len(font_paths)} font file(s) in {len(search_dirs)} search dir(s).")
        for sdir in search_dirs:
            print(f"  - {sdir}")

        try:
            dataset = FontDataset(
                font_paths,
                chars=chars,
                char_mode=char_mode,
                max_chars_per_font=max_chars_per_font,
                min_codepoint=min_codepoint,
                max_codepoint=max_codepoint,
                include_private_use=include_private_use,
            )
        except Exception as exc:
            _write_status({"status": "error", "message": str(exc)})
            raise

    if len(dataset) == 0:
        _write_status({"status": "error", "message": "Dataset is empty after rendering."})
        print("ERROR: Dataset is empty.", file=sys.stderr)
        sys.exit(1)

    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=False,
    )

    # ------------------------------------------------------------------
    # Model, optimiser
    # ------------------------------------------------------------------
    device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model     = FontVAE(latent_dim=latent_dim).to(device)
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimiser, patience=5, factor=0.5
    )

    print(f"Device: {device} | Latent dim: {latent_dim} | β: {beta}")
    print(
        f"KL annealing: start={beta_start}, end={beta}, warmup_epochs={beta_warmup_epochs}"
    )
    print(f"Reconstruction reduction: {recon_reduction}")
    print(f"Style supervision: weight={style_weight}, center_weight={center_weight}")
    print(
        f"Style balance (fonts): sans={dataset.style_counts['sans']} "
        f"serif={dataset.style_counts['serif']}"
    )
    print(
        f"Style balance (samples): sans={dataset.style_sample_counts['sans']} "
        f"serif={dataset.style_sample_counts['serif']}"
    )

    serif_samples = dataset.style_sample_counts["serif"]
    sans_samples = dataset.style_sample_counts["sans"]
    style_pos_weight = None
    if serif_samples > 0 and sans_samples > 0:
        style_pos_weight = torch.tensor(
            [max(1.0, sans_samples / max(1, serif_samples))],
            dtype=torch.float32,
            device=device,
        )
        print(f"Style BCE pos_weight: {style_pos_weight.item():.3f}")
    else:
        print("Style BCE pos_weight: disabled (single-class style data)")
    print(f"Training for {epochs} epoch(s) with batch size {batch_size}.")

    history: dict = {
        "loss": [],
        "recon": [],
        "kl": [],
        "style": [],
        "style_acc": [],
        "beta": [],
    }
    t_start   = time.time()

    # ------------------------------------------------------------------
    # Epoch loop
    # ------------------------------------------------------------------
    for epoch in range(1, epochs + 1):

        # ---- stop-requested check ------------------------------------
        if _stop_requested():
            print("Stop requested — halting training.")
            _write_status({
                "status":       "stopped",
                "epoch":        epoch - 1,
                "total_epochs": epochs,
                "progress":     (epoch - 1) / epochs,
                "history":      history,
            })
            return

        model.train()
        if beta_warmup_epochs > 0:
            warmup_frac = min(1.0, epoch / float(beta_warmup_epochs))
            current_beta = beta_start + (beta - beta_start) * warmup_frac
        else:
            current_beta = beta

        epoch_loss  = 0.0
        epoch_recon = 0.0
        epoch_kl    = 0.0
        epoch_style = 0.0
        epoch_style_acc = 0.0
        n_batches   = 0

        for batch in loader:
            x, y = batch
            x = x.to(device)
            y = y.unsqueeze(1).to(device)
            optimiser.zero_grad()
            x_hat, mu, logvar = model(x)
            loss, recon, kl   = vae_loss(
                x,
                x_hat,
                mu,
                logvar,
                beta=current_beta,
                recon_reduction=recon_reduction,
            )

            style_logits = model.predict_style(mu)
            if style_pos_weight is not None:
                style_loss = F.binary_cross_entropy_with_logits(
                    style_logits,
                    y,
                    pos_weight=style_pos_weight,
                )
            else:
                style_loss = torch.tensor(0.0, device=device)

            center_loss = torch.tensor(0.0, device=device)
            serif_mask = (y.squeeze(1) > 0.5)
            sans_mask = ~serif_mask
            if style_pos_weight is not None and serif_mask.any() and sans_mask.any():
                serif_center = mu[serif_mask].mean(dim=0)
                sans_center = mu[sans_mask].mean(dim=0)
                center_loss = -torch.norm(serif_center - sans_center, p=2)

            total_loss = loss + style_weight * style_loss + center_weight * center_loss
            total_loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimiser.step()

            with torch.no_grad():
                pred = (torch.sigmoid(style_logits) >= 0.5).float()
                acc = (pred == y).float().mean().item()

            epoch_loss  += total_loss.item()
            epoch_recon += recon
            epoch_kl    += kl
            epoch_style += style_loss.item()
            epoch_style_acc += acc
            n_batches   += 1

        avg_loss  = epoch_loss  / n_batches
        avg_recon = epoch_recon / n_batches
        avg_kl    = epoch_kl    / n_batches
        avg_style = epoch_style / n_batches
        avg_style_acc = epoch_style_acc / n_batches

        scheduler.step(avg_loss)

        history["loss"].append(round(avg_loss,  4))
        history["recon"].append(round(avg_recon, 4))
        history["kl"].append(round(avg_kl,    4))
        history["style"].append(round(avg_style, 4))
        history["style_acc"].append(round(avg_style_acc, 4))
        history["beta"].append(round(current_beta, 4))

        elapsed  = time.time() - t_start
        progress = epoch / epochs
        eta      = (elapsed / progress) * (1 - progress) if progress > 0 else 0

        print(
            f"Epoch {epoch:4d}/{epochs}  "
            f"loss={avg_loss:.4f}  recon={avg_recon:.4f}  kl={avg_kl:.4f}  "
            f"beta={current_beta:.3f}  "
            f"style={avg_style:.4f}  style_acc={avg_style_acc:.3f}  "
            f"elapsed={elapsed:.0f}s  eta={eta:.0f}s"
        )

        _write_status({
            "status":       "training",
            "epoch":        epoch,
            "total_epochs": epochs,
            "loss":         round(avg_loss,  4),
            "recon_loss":   round(avg_recon, 4),
            "kl_loss":      round(avg_kl,    4),
            "style_loss":   round(avg_style, 4),
            "style_acc":    round(avg_style_acc, 4),
            "beta_current": round(current_beta, 4),
            "progress":     round(progress,  4),
            "elapsed":      round(elapsed,   1),
            "eta":          round(eta,        1),
            "history":      history,
        })

    serif_centroid = None
    sans_centroid = None
    with torch.no_grad():
        serif_vectors = []
        sans_vectors = []
        for x, y in loader:
            x = x.to(device)
            y = y.to(device)
            mu, _ = model.encode(x)
            serif_mask = y > 0.5
            if serif_mask.any():
                serif_vectors.append(mu[serif_mask])
            if (~serif_mask).any():
                sans_vectors.append(mu[~serif_mask])
        if serif_vectors:
            serif_centroid = torch.cat(serif_vectors, dim=0).mean(dim=0).cpu()
        if sans_vectors:
            sans_centroid = torch.cat(sans_vectors, dim=0).mean(dim=0).cpu()

    style_axis_delta = None
    if serif_centroid is not None and sans_centroid is not None:
        style_axis_delta = serif_centroid - sans_centroid

    # ------------------------------------------------------------------
    # Save model
    # ------------------------------------------------------------------
    font_count = int(dataset.style_counts["sans"] + dataset.style_counts["serif"])

    checkpoint = {
        "model_state_dict": model.state_dict(),
        "latent_dim":       latent_dim,
        "epochs":           epochs,
        "epochs_trained":   epochs,
        "beta":             beta,
        "history":          history,
        "characters":       chars if char_mode == "alphabet" else "UNICODE_DYNAMIC",
        "character_mode":   char_mode,
        "max_chars_per_font": max_chars_per_font,
        "font_count":       font_count,
        "font_style_counts": dataset.style_counts,
        "style_weight":     style_weight,
        "center_weight":    center_weight,
        "recon_reduction":  recon_reduction,
        "beta_start":       beta_start,
        "beta_warmup_epochs": beta_warmup_epochs,
    }

    if serif_centroid is not None:
        checkpoint["serif_centroid"] = serif_centroid.tolist()
    if sans_centroid is not None:
        checkpoint["sans_centroid"] = sans_centroid.tolist()
    if style_axis_delta is not None:
        checkpoint["style_axis_delta"] = style_axis_delta.tolist()

    torch.save(checkpoint, MODEL_FILE)
    for alias in ("font_vae.pt", "font_vae_unified.pt"):
        torch.save(checkpoint, MODELS_DIR / alias)

    print(f"Model saved → {MODEL_FILE}")

    elapsed = time.time() - t_start
    _write_status({
        "status":       "complete",
        "epoch":        epochs,
        "total_epochs": epochs,
        "loss":         history["loss"][-1]  if history["loss"]  else None,
        "recon_loss":   history["recon"][-1] if history["recon"] else None,
        "kl_loss":      history["kl"][-1]   if history["kl"]    else None,
        "progress":     1.0,
        "elapsed":      round(elapsed, 1),
        "eta":          0,
        "history":      history,
    })
    print("Training complete.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a Font VAE on glyph SDF images."
    )
    parser.add_argument("--epochs",      type=int,   default=50,
                        help="Number of training epochs (default: 50).")
    parser.add_argument("--batch-size",  type=int,   default=16,
                        help="Mini-batch size (default: 16).")
    parser.add_argument("--latent-dim",  type=int,   default=64,
                        help="Latent space dimensionality (default: 64).")
    parser.add_argument("--beta",        type=float, default=1.0,
                        help="β coefficient for KL term (default: 1.0).")
    parser.add_argument("--beta-start", type=float, default=0.0,
                        help="Initial β at epoch 1 for KL annealing (default: 0.0).")
    parser.add_argument("--beta-warmup-epochs", type=int, default=20,
                        help="Epochs to linearly anneal β from beta_start to beta.")
    parser.add_argument("--style-weight", type=float, default=0.5,
                        help="Weight for serif/sans classification loss (default: 0.5).")
    parser.add_argument("--center-weight", type=float, default=0.05,
                        help="Weight for latent centroid-separation regularizer (default: 0.05).")
    parser.add_argument("--recon-reduction", choices=["mean", "sum"], default="mean",
                        help="Reduction for reconstruction loss (default: mean).")
    parser.add_argument("--char-mode", choices=["alphabet", "unicode"], default="unicode",
                        help="Character sampling mode (default: unicode).")
    parser.add_argument("--max-chars-per-font", type=int, default=512,
                        help="Max Unicode characters sampled per font in unicode mode.")
    parser.add_argument("--min-codepoint", type=int, default=32,
                        help="Minimum Unicode codepoint to include (default: 32).")
    parser.add_argument("--max-codepoint", type=int, default=0x10FFFF,
                        help="Maximum Unicode codepoint to include.")
    parser.add_argument("--include-private-use", action="store_true",
                        help="Include Private Use Area codepoints in unicode mode.")
    parser.add_argument("--quick",       action="store_true",
                        help="Quick mode: 20 epochs, latent_dim=32, A-Z only.")
    parser.add_argument("--fonts-dir",   type=str,   default="",
                        help="Override font search directory. Use comma-separated directories for multi-source training.")
    parser.add_argument("--no-precomputed", action="store_true",
                        help="Disable training_data precomputed glyph loading and force raw font rendering.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        train(
            epochs     = args.epochs,
            batch_size = args.batch_size,
            latent_dim = args.latent_dim,
            beta       = args.beta,
            beta_start = args.beta_start,
            beta_warmup_epochs = args.beta_warmup_epochs,
            style_weight = args.style_weight,
            center_weight = args.center_weight,
            recon_reduction = args.recon_reduction,
            char_mode = args.char_mode,
            max_chars_per_font = args.max_chars_per_font,
            min_codepoint = args.min_codepoint,
            max_codepoint = args.max_codepoint,
            include_private_use = args.include_private_use,
            quick      = args.quick,
            fonts_dir  = args.fonts_dir,
            use_precomputed = not args.no_precomputed,
        )
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        _write_status({"status": "stopped", "message": "KeyboardInterrupt"})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        _write_status({"status": "error", "message": str(exc)})
        sys.exit(1)
