#!/usr/bin/env python3
"""
Build precomputed training_data glyph packs from raw font files.

Usage:
  python scripts/build_training_data.py --fonts-dir fonts/downloaded
"""

import argparse
import json
import re
import time
from pathlib import Path

import numpy as np

try:
    from scripts.sdf import render_sdf, get_font_unicode_map
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sdf import render_sdf, get_font_unicode_map

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAINING_DATA_DIR = PROJECT_ROOT / "training_data"


def _safe_key(font_path: Path) -> str:
    raw = f"{font_path.parent.name}__{font_path.stem}" if font_path.parent != font_path.parent.parent else font_path.stem
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", raw).strip("_") or "font"


def _load_manifest(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _save_manifest(path: Path, manifest: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(manifest, indent=2))
    tmp.replace(path)


def _discover_fonts(root_dirs: list[Path]) -> list[Path]:
    results: list[Path] = []
    for root in root_dirs:
        if not root.exists():
            continue
        for ext in ("*.ttf", "*.otf", "*.TTF", "*.OTF"):
            results.extend(root.rglob(ext))
    # Deduplicate preserving order
    seen = set()
    unique: list[Path] = []
    for p in results:
        rp = str(p.resolve())
        if rp in seen:
            continue
        seen.add(rp)
        unique.append(p)
    return unique


def build_training_data(
    fonts_dir_arg: str,
    max_chars_per_font: int,
    min_codepoint: int,
    max_codepoint: int,
    include_private_use: bool,
    overwrite: bool,
) -> None:
    raw_dirs = [d.strip() for d in fonts_dir_arg.split(",") if d.strip()] or ["fonts/downloaded"]
    root_dirs = []
    for d in raw_dirs:
        p = Path(d)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        root_dirs.append(p)

    fonts = _discover_fonts(root_dirs)
    if not fonts:
        print(f"No fonts found in {root_dirs}")
        return

    TRAINING_DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = TRAINING_DATA_DIR / "manifest.json"
    manifest = _load_manifest(manifest_path)

    total = len(fonts)
    added = 0
    skipped = 0

    for i, font_path in enumerate(fonts, 1):
        key = _safe_key(font_path)
        font_dir = TRAINING_DATA_DIR / key
        npz_path = font_dir / "glyphs.npz"

        if npz_path.exists() and not overwrite:
            skipped += 1
            if i % 10 == 0 or i == total:
                print(f"[{i}/{total}] skip {font_path.name} (already processed)")
            continue

        chars_info = get_font_unicode_map(str(font_path))
        if not chars_info:
            continue

        glyphs = []
        valid = []
        for info in chars_info:
            cp = int(info.get("codepoint", -1))
            if cp < min_codepoint or cp > max_codepoint:
                continue
            if not include_private_use and (
                0xE000 <= cp <= 0xF8FF or
                0xF0000 <= cp <= 0xFFFFD or
                0x100000 <= cp <= 0x10FFFD
            ):
                continue
            sdf = render_sdf(str(font_path), str(info["char"]), image_size=64, band=8.0)
            if sdf is None:
                continue
            glyphs.append(np.asarray(sdf, dtype=np.float32))
            valid.append(info)
            if len(valid) >= max_chars_per_font:
                break

        if not glyphs:
            continue

        font_dir.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            str(npz_path),
            glyphs=np.array(glyphs, dtype=np.float32),
            chars=np.array([c["char"] for c in valid]),
            codepoints=np.array([c["codepoint"] for c in valid]),
            scripts=np.array([c.get("script", "other") for c in valid]),
        )

        by_script = {}
        for c in valid:
            script = c.get("script", "other")
            by_script[script] = by_script.get(script, 0) + 1

        meta = {
            "font_name": font_path.stem,
            "font_path": str(font_path),
            "glyph_count": len(valid),
            "by_script": by_script,
            "added": time.time(),
        }
        (font_dir / "meta.json").write_text(json.dumps(meta, indent=2))
        manifest[key] = {
            "font_name": meta["font_name"],
            "glyph_count": meta["glyph_count"],
            "by_script": by_script,
            "added": meta["added"],
        }

        added += 1
        if i % 5 == 0 or i == total:
            print(f"[{i}/{total}] processed {font_path.name} -> {len(valid)} glyphs")

    _save_manifest(manifest_path, manifest)
    print(f"Done. Added/updated {added} font dataset(s), skipped {skipped}, total manifest entries {len(manifest)}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build training_data glyph packs from font files.")
    parser.add_argument("--fonts-dir", type=str, default="fonts/downloaded", help="Comma-separated font roots.")
    parser.add_argument("--max-chars-per-font", type=int, default=768, help="Maximum glyphs per font.")
    parser.add_argument("--min-codepoint", type=int, default=32)
    parser.add_argument("--max-codepoint", type=int, default=0x10FFFF)
    parser.add_argument("--include-private-use", action="store_true")
    parser.add_argument("--overwrite", action="store_true", help="Rebuild existing glyph packs.")
    args = parser.parse_args()

    build_training_data(
        fonts_dir_arg=args.fonts_dir,
        max_chars_per_font=args.max_chars_per_font,
        min_codepoint=args.min_codepoint,
        max_codepoint=args.max_codepoint,
        include_private_use=args.include_private_use,
        overwrite=args.overwrite,
    )
