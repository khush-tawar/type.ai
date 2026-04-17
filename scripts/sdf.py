"""
sdf.py — Unified Signed Distance Field rendering for font glyphs
================================================================
Single source of truth for SDF/TSDF generation used by:
  - train_vae.py   (training data preparation)
  - server.py      (inference-time glyph rendering)
  - Colab notebook  (training on Google Colab)

All SDF rendering goes through `render_sdf()`.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
from typing import Optional


def render_sdf(
    font_path: str,
    char: str,
    image_size: int = 64,
    band: float = 8.0,
) -> Optional[np.ndarray]:
    """Render a character from a font file as a Truncated SDF array in [0, 1].

    Pipeline:
        1. Rasterize glyph at 2× resolution (anti-aliased)
        2. Threshold to binary ink mask
        3. Compute distance transform inside & outside
        4. Truncate to ±band pixels → normalize to [0, 1]
        5. Downsample to image_size × image_size

    Args:
        font_path:  Path to .ttf / .otf file
        char:       Single character to render
        image_size: Output resolution (default 64×64)
        band:       SDF truncation band in pixels (default 8)

    Returns:
        float32 ndarray of shape (image_size, image_size) in [0, 1],
        where 1.0 = deep inside glyph, 0.0 = far outside.
        Returns None if the glyph is empty or unsupported.
    """
    try:
        hi_res = image_size * 2
        font_size = int(hi_res * 0.75)
        pil_font = ImageFont.truetype(font_path, font_size)

        # Draw glyph centered on canvas
        img = Image.new("L", (hi_res, hi_res), 255)
        draw = ImageDraw.Draw(img)

        bb = draw.textbbox((0, 0), char, font=pil_font)
        char_w = bb[2] - bb[0]
        char_h = bb[3] - bb[1]
        if char_w <= 0 or char_h <= 0:
            return None

        x = (hi_res - char_w) // 2 - bb[0]
        y = (hi_res - char_h) // 2 - bb[1]
        draw.text((x, y), char, font=pil_font, fill=0)

        arr = np.array(img, dtype=np.float32) / 255.0  # 0 = ink, 1 = bg

        # Binary mask: ink = 1, background = 0
        ink_mask = (arr < 0.5).astype(np.float32)

        # Skip glyphs with too few ink pixels
        if ink_mask.sum() < 10:
            return None

        # Signed distance field
        d_inside = distance_transform_edt(ink_mask)       # dist from bg
        d_outside = distance_transform_edt(1 - ink_mask)  # dist from ink

        # SDF: positive inside, negative outside
        sdf = d_inside - d_outside

        # Truncate and normalize to [0, 1]
        sdf = np.clip(sdf, -band, band) / band   # → [-1, 1]
        sdf = (sdf + 1.0) / 2.0                  # → [0, 1]

        # Downsample to target size
        out = Image.fromarray((sdf * 255).astype(np.uint8))
        out = out.resize((image_size, image_size), Image.LANCZOS)

        return np.array(out, dtype=np.float32) / 255.0

    except Exception:
        return None


def get_font_unicode_map(font_path: str) -> list:
    """Return list of {char, codepoint, glyph_name, script} for every
    codepoint the font's cmap supports.

    Used to discover all renderable characters in a font before SDF generation.
    """
    _SCRIPT_RANGES = [
        ("latin",      [(0x0041, 0x007A), (0x00C0, 0x024F), (0x1E00, 0x1EFF)]),
        ("devanagari", [(0x0900, 0x097F)]),
        ("bengali",    [(0x0980, 0x09FF)]),
        ("tamil",      [(0x0B80, 0x0BFF)]),
        ("telugu",     [(0x0C00, 0x0C7F)]),
        ("arabic",     [(0x0600, 0x06FF), (0x0750, 0x077F)]),
        ("cyrillic",   [(0x0400, 0x04FF)]),
        ("greek",      [(0x0370, 0x03FF)]),
        ("tibetan",    [(0x0F00, 0x0FFF)]),
        ("batak",      [(0x1BC0, 0x1BFF)]),
        ("meetei",     [(0xAAE0, 0xAAFF), (0xABC0, 0xABFF)]),
        ("cjk",        [(0x4E00, 0x9FFF), (0x3040, 0x30FF)]),
        ("symbols",    [(0x2000, 0x26FF)]),
    ]

    def _get_script(cp: int) -> str:
        for name, ranges in _SCRIPT_RANGES:
            for lo, hi in ranges:
                if lo <= cp <= hi:
                    return name
        return "other"

    try:
        from fontTools.ttLib import TTFont
        tt = TTFont(font_path, lazy=True)
        cmap = tt.getBestCmap()
        tt.close()
        if not cmap:
            return []
        result = []
        for cp, glyph_name in cmap.items():
            if cp < 0x0020 or cp > 0x10FFFF:
                continue
            try:
                result.append({
                    "char":       chr(cp),
                    "codepoint":  cp,
                    "glyph_name": glyph_name,
                    "script":     _get_script(cp),
                })
            except (ValueError, OverflowError):
                continue
        return result
    except Exception:
        return []
