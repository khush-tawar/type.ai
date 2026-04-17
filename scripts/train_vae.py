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
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image, ImageDraw, ImageFont

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
MODELS_DIR   = PROJECT_ROOT / "models"
STATUS_FILE  = MODELS_DIR / "training_status.json"
MODEL_FILE   = MODELS_DIR / "font_vae.pt"

IMG_SIZE  = 64      # pixels
CHARS_ALL = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    "!@#$%&"
)
CHARS_QUICK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

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


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class FontDataset(Dataset):
    """Pre-rendered SDF glyphs stored in memory."""

    def __init__(
        self,
        font_paths: List[str],
        chars: str = CHARS_ALL,
        img_size: int = IMG_SIZE,
    ) -> None:
        self.samples: List[np.ndarray] = []
        total = len(font_paths) * len(chars)
        done  = 0

        print(f"Rendering glyphs from {len(font_paths)} font(s) × "
              f"{len(chars)} character(s) = up to {total} samples …")

        for fp in font_paths:
            for ch in chars:
                sdf = render_glyph(fp, ch, img_size)
                if sdf is not None:
                    self.samples.append(sdf)
                done += 1
                if done % 500 == 0:
                    print(f"  rendered {done}/{total} "
                          f"({len(self.samples)} kept)", flush=True)

        print(f"Dataset ready – {len(self.samples)} valid glyphs.")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> torch.Tensor:
        arr = self.samples[idx]                # (H, W)  float32
        return torch.from_numpy(arr).unsqueeze(0)  # (1, H, W)


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
) -> Tuple[torch.Tensor, float, float]:
    """β-VAE loss = reconstruction + β × KL divergence."""
    recon = F.binary_cross_entropy(x_hat, x, reduction="sum") / x.size(0)
    kl    = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / x.size(0)
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
    quick: bool      = False,
) -> None:

    if quick:
        epochs     = 20
        latent_dim = 32
        chars      = CHARS_QUICK
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
    search_dir = Path(args.fonts_dir) if args.fonts_dir else FONTS_DIR
    if not search_dir.is_absolute():
        search_dir = PROJECT_ROOT / search_dir
    font_paths = discover_fonts(search_dir)
    if not font_paths:
        _write_status({"status": "error", "message": f"No fonts found in {search_dir}"})
        print("ERROR: No .ttf/.otf fonts found under", search_dir, file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(font_paths)} font file(s) in {search_dir}.")

    try:
        dataset = FontDataset(font_paths, chars=chars)
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
    print(f"Training for {epochs} epoch(s) with batch size {batch_size}.")

    history: dict = {"loss": [], "recon": [], "kl": []}
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
        epoch_loss  = 0.0
        epoch_recon = 0.0
        epoch_kl    = 0.0
        n_batches   = 0

        for batch in loader:
            x = batch.to(device)
            optimiser.zero_grad()
            x_hat, mu, logvar = model(x)
            loss, recon, kl   = vae_loss(x, x_hat, mu, logvar, beta)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimiser.step()

            epoch_loss  += loss.item()
            epoch_recon += recon
            epoch_kl    += kl
            n_batches   += 1

        avg_loss  = epoch_loss  / n_batches
        avg_recon = epoch_recon / n_batches
        avg_kl    = epoch_kl    / n_batches

        scheduler.step(avg_loss)

        history["loss"].append(round(avg_loss,  4))
        history["recon"].append(round(avg_recon, 4))
        history["kl"].append(round(avg_kl,    4))

        elapsed  = time.time() - t_start
        progress = epoch / epochs
        eta      = (elapsed / progress) * (1 - progress) if progress > 0 else 0

        print(
            f"Epoch {epoch:4d}/{epochs}  "
            f"loss={avg_loss:.4f}  recon={avg_recon:.4f}  kl={avg_kl:.4f}  "
            f"elapsed={elapsed:.0f}s  eta={eta:.0f}s"
        )

        _write_status({
            "status":       "training",
            "epoch":        epoch,
            "total_epochs": epochs,
            "loss":         round(avg_loss,  4),
            "recon_loss":   round(avg_recon, 4),
            "kl_loss":      round(avg_kl,    4),
            "progress":     round(progress,  4),
            "elapsed":      round(elapsed,   1),
            "eta":          round(eta,        1),
            "history":      history,
        })

    # ------------------------------------------------------------------
    # Save model
    # ------------------------------------------------------------------
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "latent_dim":       latent_dim,
            "epochs":           epochs,
            "beta":             beta,
            "history":          history,
        },
        MODEL_FILE,
    )
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
    parser.add_argument("--quick",       action="store_true",
                        help="Quick mode: 20 epochs, latent_dim=32, A-Z only.")
    parser.add_argument("--fonts-dir",   type=str,   default="",
                        help="Override font search directory (default: fonts/).")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        train(
            epochs     = args.epochs,
            batch_size = args.batch_size,
            latent_dim = args.latent_dim,
            beta       = args.beta,
            quick      = args.quick,
        )
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        _write_status({"status": "stopped", "message": "KeyboardInterrupt"})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        _write_status({"status": "error", "message": str(exc)})
        sys.exit(1)
