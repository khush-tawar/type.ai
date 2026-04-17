"""
download_fonts.py  –  Download diverse typefaces from Google Fonts GitHub
=========================================================================
Downloads fonts covering 10+ type categories before training starts.
Run this BEFORE training to ensure the model learns from diverse styles.

Usage:
    python3 scripts/download_fonts.py [--dest fonts/downloaded] [--verify]
"""

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

BASE = "https://raw.githubusercontent.com/google/fonts/main"

# ─── Font catalogue ───────────────────────────────────────────────────────────
# Organised by category so the model gets balanced representation.
# Each entry: (display_name, url_path)

FONT_CATALOGUE = {

    "Geometric Sans": [
        ("Montserrat Thin",         "ofl/montserrat/static/Montserrat-Thin.ttf"),
        ("Montserrat ExtraLight",   "ofl/montserrat/static/Montserrat-ExtraLight.ttf"),
        ("Montserrat Light",        "ofl/montserrat/static/Montserrat-Light.ttf"),
        ("Montserrat Regular",      "ofl/montserrat/static/Montserrat-Regular.ttf"),
        ("Montserrat Medium",       "ofl/montserrat/static/Montserrat-Medium.ttf"),
        ("Montserrat SemiBold",     "ofl/montserrat/static/Montserrat-SemiBold.ttf"),
        ("Montserrat Bold",         "ofl/montserrat/static/Montserrat-Bold.ttf"),
        ("Montserrat ExtraBold",    "ofl/montserrat/static/Montserrat-ExtraBold.ttf"),
        ("Montserrat Black",        "ofl/montserrat/static/Montserrat-Black.ttf"),
        ("Poppins Thin",            "ofl/poppins/Poppins-Thin.ttf"),
        ("Poppins Light",           "ofl/poppins/Poppins-Light.ttf"),
        ("Poppins Regular",         "ofl/poppins/Poppins-Regular.ttf"),
        ("Poppins Medium",          "ofl/poppins/Poppins-Medium.ttf"),
        ("Poppins SemiBold",        "ofl/poppins/Poppins-SemiBold.ttf"),
        ("Poppins Bold",            "ofl/poppins/Poppins-Bold.ttf"),
        ("Poppins ExtraBold",       "ofl/poppins/Poppins-ExtraBold.ttf"),
        ("Poppins Black",           "ofl/poppins/Poppins-Black.ttf"),
        ("Nunito ExtraLight",       "ofl/nunito/static/Nunito-ExtraLight.ttf"),
        ("Nunito Light",            "ofl/nunito/static/Nunito-Light.ttf"),
        ("Nunito Regular",          "ofl/nunito/static/Nunito-Regular.ttf"),
        ("Nunito Medium",           "ofl/nunito/static/Nunito-Medium.ttf"),
        ("Nunito SemiBold",         "ofl/nunito/static/Nunito-SemiBold.ttf"),
        ("Nunito Bold",             "ofl/nunito/static/Nunito-Bold.ttf"),
        ("Nunito ExtraBold",        "ofl/nunito/static/Nunito-ExtraBold.ttf"),
        ("Nunito Black",            "ofl/nunito/static/Nunito-Black.ttf"),
        ("Raleway Thin",            "ofl/raleway/static/Raleway-Thin.ttf"),
        ("Raleway ExtraLight",      "ofl/raleway/static/Raleway-ExtraLight.ttf"),
        ("Raleway Light",           "ofl/raleway/static/Raleway-Light.ttf"),
        ("Raleway Regular",         "ofl/raleway/static/Raleway-Regular.ttf"),
        ("Raleway Medium",          "ofl/raleway/static/Raleway-Medium.ttf"),
        ("Raleway SemiBold",        "ofl/raleway/static/Raleway-SemiBold.ttf"),
        ("Raleway Bold",            "ofl/raleway/static/Raleway-Bold.ttf"),
        ("Raleway ExtraBold",       "ofl/raleway/static/Raleway-ExtraBold.ttf"),
        ("Raleway Black",           "ofl/raleway/static/Raleway-Black.ttf"),
    ],

    "Humanist Sans": [
        ("Roboto Thin",             "apache/roboto/static/Roboto-Thin.ttf"),
        ("Roboto Light",            "apache/roboto/static/Roboto-Light.ttf"),
        ("Roboto Regular",          "apache/roboto/static/Roboto-Regular.ttf"),
        ("Roboto Medium",           "apache/roboto/static/Roboto-Medium.ttf"),
        ("Roboto Bold",             "apache/roboto/static/Roboto-Bold.ttf"),
        ("Roboto Black",            "apache/roboto/static/Roboto-Black.ttf"),
        ("Lato Thin",               "ofl/lato/Lato-Thin.ttf"),
        ("Lato Light",              "ofl/lato/Lato-Light.ttf"),
        ("Lato Regular",            "ofl/lato/Lato-Regular.ttf"),
        ("Lato Bold",               "ofl/lato/Lato-Bold.ttf"),
        ("Lato Black",              "ofl/lato/Lato-Black.ttf"),
        ("Open Sans Light",         "apache/opensans/static/OpenSans-Light.ttf"),
        ("Open Sans Regular",       "apache/opensans/static/OpenSans-Regular.ttf"),
        ("Open Sans Medium",        "apache/opensans/static/OpenSans-Medium.ttf"),
        ("Open Sans SemiBold",      "apache/opensans/static/OpenSans-SemiBold.ttf"),
        ("Open Sans Bold",          "apache/opensans/static/OpenSans-Bold.ttf"),
        ("Open Sans ExtraBold",     "apache/opensans/static/OpenSans-ExtraBold.ttf"),
        ("Ubuntu Light",            "ofl/ubuntu/Ubuntu-L.ttf"),
        ("Ubuntu Regular",          "ofl/ubuntu/Ubuntu-R.ttf"),
        ("Ubuntu Medium",           "ofl/ubuntu/Ubuntu-M.ttf"),
        ("Ubuntu Bold",             "ofl/ubuntu/Ubuntu-B.ttf"),
        ("Noto Sans Thin",          "ofl/notosans/static/NotoSans-Thin.ttf"),
        ("Noto Sans Light",         "ofl/notosans/static/NotoSans-Light.ttf"),
        ("Noto Sans Regular",       "ofl/notosans/static/NotoSans-Regular.ttf"),
        ("Noto Sans Medium",        "ofl/notosans/static/NotoSans-Medium.ttf"),
        ("Noto Sans SemiBold",      "ofl/notosans/static/NotoSans-SemiBold.ttf"),
        ("Noto Sans Bold",          "ofl/notosans/static/NotoSans-Bold.ttf"),
        ("Noto Sans Black",         "ofl/notosans/static/NotoSans-Black.ttf"),
    ],

    "Transitional Serif": [
        ("Merriweather Light",      "ofl/merriweather/Merriweather-Light.ttf"),
        ("Merriweather Regular",    "ofl/merriweather/Merriweather-Regular.ttf"),
        ("Merriweather Bold",       "ofl/merriweather/Merriweather-Bold.ttf"),
        ("Merriweather Black",      "ofl/merriweather/Merriweather-Black.ttf"),
        ("Lora Regular",            "ofl/lora/static/Lora-Regular.ttf"),
        ("Lora Medium",             "ofl/lora/static/Lora-Medium.ttf"),
        ("Lora SemiBold",           "ofl/lora/static/Lora-SemiBold.ttf"),
        ("Lora Bold",               "ofl/lora/static/Lora-Bold.ttf"),
        ("Libre Baskerville Regular","ofl/librebaskerville/LibreBaskerville-Regular.ttf"),
        ("Libre Baskerville Bold",  "ofl/librebaskerville/LibreBaskerville-Bold.ttf"),
        ("Noto Serif Regular",      "ofl/notoserif/static/NotoSerif-Regular.ttf"),
        ("Noto Serif Medium",       "ofl/notoserif/static/NotoSerif-Medium.ttf"),
        ("Noto Serif SemiBold",     "ofl/notoserif/static/NotoSerif-SemiBold.ttf"),
        ("Noto Serif Bold",         "ofl/notoserif/static/NotoSerif-Bold.ttf"),
        ("Noto Serif Black",        "ofl/notoserif/static/NotoSerif-Black.ttf"),
        ("Bitter Regular",          "ofl/bitter/static/Bitter-Regular.ttf"),
        ("Bitter Medium",           "ofl/bitter/static/Bitter-Medium.ttf"),
        ("Bitter SemiBold",         "ofl/bitter/static/Bitter-SemiBold.ttf"),
        ("Bitter Bold",             "ofl/bitter/static/Bitter-Bold.ttf"),
        ("Bitter Black",            "ofl/bitter/static/Bitter-Black.ttf"),
    ],

    "Old Style / Humanist Serif": [
        ("EB Garamond Regular",     "ofl/ebgaramond/static/EBGaramond-Regular.ttf"),
        ("EB Garamond Medium",      "ofl/ebgaramond/static/EBGaramond-Medium.ttf"),
        ("EB Garamond SemiBold",    "ofl/ebgaramond/static/EBGaramond-SemiBold.ttf"),
        ("EB Garamond Bold",        "ofl/ebgaramond/static/EBGaramond-Bold.ttf"),
        ("EB Garamond ExtraBold",   "ofl/ebgaramond/static/EBGaramond-ExtraBold.ttf"),
        ("Cormorant Light",         "ofl/cormorant/static/Cormorant-Light.ttf"),
        ("Cormorant Regular",       "ofl/cormorant/static/Cormorant-Regular.ttf"),
        ("Cormorant Medium",        "ofl/cormorant/static/Cormorant-Medium.ttf"),
        ("Cormorant SemiBold",      "ofl/cormorant/static/Cormorant-SemiBold.ttf"),
        ("Cormorant Bold",          "ofl/cormorant/static/Cormorant-Bold.ttf"),
        ("Crimson Text Regular",    "ofl/crimsontext/CrimsonText-Regular.ttf"),
        ("Crimson Text SemiBold",   "ofl/crimsontext/CrimsonText-SemiBold.ttf"),
        ("Crimson Text Bold",       "ofl/crimsontext/CrimsonText-Bold.ttf"),
    ],

    "Display / High Contrast Serif": [
        ("Playfair Display Regular",    "ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf"),
        ("Playfair Display Medium",     "ofl/playfairdisplay/static/PlayfairDisplay-Medium.ttf"),
        ("Playfair Display SemiBold",   "ofl/playfairdisplay/static/PlayfairDisplay-SemiBold.ttf"),
        ("Playfair Display Bold",       "ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf"),
        ("Playfair Display ExtraBold",  "ofl/playfairdisplay/static/PlayfairDisplay-ExtraBold.ttf"),
        ("Playfair Display Black",      "ofl/playfairdisplay/static/PlayfairDisplay-Black.ttf"),
        ("DM Serif Display Regular",    "ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf"),
    ],

    "Slab Serif": [
        ("Roboto Slab Thin",        "apache/robotoslab/static/RobotoSlab-Thin.ttf"),
        ("Roboto Slab Light",       "apache/robotoslab/static/RobotoSlab-Light.ttf"),
        ("Roboto Slab Regular",     "apache/robotoslab/static/RobotoSlab-Regular.ttf"),
        ("Roboto Slab Medium",      "apache/robotoslab/static/RobotoSlab-Medium.ttf"),
        ("Roboto Slab SemiBold",    "apache/robotoslab/static/RobotoSlab-SemiBold.ttf"),
        ("Roboto Slab Bold",        "apache/robotoslab/static/RobotoSlab-Bold.ttf"),
        ("Roboto Slab ExtraBold",   "apache/robotoslab/static/RobotoSlab-ExtraBold.ttf"),
        ("Roboto Slab Black",       "apache/robotoslab/static/RobotoSlab-Black.ttf"),
        ("Arvo Regular",            "ofl/arvo/Arvo-Regular.ttf"),
        ("Arvo Bold",               "ofl/arvo/Arvo-Bold.ttf"),
        ("Arvo Italic",             "ofl/arvo/Arvo-Italic.ttf"),
        ("Arvo BoldItalic",         "ofl/arvo/Arvo-BoldItalic.ttf"),
    ],

    "Display Sans / Condensed": [
        ("Oswald ExtraLight",       "ofl/oswald/static/Oswald-ExtraLight.ttf"),
        ("Oswald Light",            "ofl/oswald/static/Oswald-Light.ttf"),
        ("Oswald Regular",          "ofl/oswald/static/Oswald-Regular.ttf"),
        ("Oswald Medium",           "ofl/oswald/static/Oswald-Medium.ttf"),
        ("Oswald SemiBold",         "ofl/oswald/static/Oswald-SemiBold.ttf"),
        ("Oswald Bold",             "ofl/oswald/static/Oswald-Bold.ttf"),
        ("Barlow Condensed Thin",       "ofl/barlowcondensed/BarlowCondensed-Thin.ttf"),
        ("Barlow Condensed Light",      "ofl/barlowcondensed/BarlowCondensed-Light.ttf"),
        ("Barlow Condensed Regular",    "ofl/barlowcondensed/BarlowCondensed-Regular.ttf"),
        ("Barlow Condensed Medium",     "ofl/barlowcondensed/BarlowCondensed-Medium.ttf"),
        ("Barlow Condensed SemiBold",   "ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf"),
        ("Barlow Condensed Bold",       "ofl/barlowcondensed/BarlowCondensed-Bold.ttf"),
        ("Barlow Condensed ExtraBold",  "ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf"),
        ("Barlow Condensed Black",      "ofl/barlowcondensed/BarlowCondensed-Black.ttf"),
        ("Fjalla One Regular",      "ofl/fjallaone/FjallaOne-Regular.ttf"),
    ],

    "Monospace": [
        ("Source Code Pro ExtraLight",  "ofl/sourcecodepro/static/SourceCodePro-ExtraLight.ttf"),
        ("Source Code Pro Light",       "ofl/sourcecodepro/static/SourceCodePro-Light.ttf"),
        ("Source Code Pro Regular",     "ofl/sourcecodepro/static/SourceCodePro-Regular.ttf"),
        ("Source Code Pro Medium",      "ofl/sourcecodepro/static/SourceCodePro-Medium.ttf"),
        ("Source Code Pro SemiBold",    "ofl/sourcecodepro/static/SourceCodePro-SemiBold.ttf"),
        ("Source Code Pro Bold",        "ofl/sourcecodepro/static/SourceCodePro-Bold.ttf"),
        ("Source Code Pro Black",       "ofl/sourcecodepro/static/SourceCodePro-Black.ttf"),
        ("JetBrains Mono Thin",         "ofl/jetbrainsmono/static/JetBrainsMono-Thin.ttf"),
        ("JetBrains Mono Light",        "ofl/jetbrainsmono/static/JetBrainsMono-Light.ttf"),
        ("JetBrains Mono Regular",      "ofl/jetbrainsmono/static/JetBrainsMono-Regular.ttf"),
        ("JetBrains Mono Medium",       "ofl/jetbrainsmono/static/JetBrainsMono-Medium.ttf"),
        ("JetBrains Mono SemiBold",     "ofl/jetbrainsmono/static/JetBrainsMono-SemiBold.ttf"),
        ("JetBrains Mono Bold",         "ofl/jetbrainsmono/static/JetBrainsMono-Bold.ttf"),
        ("JetBrains Mono ExtraBold",    "ofl/jetbrainsmono/static/JetBrainsMono-ExtraBold.ttf"),
        ("Space Mono Regular",          "ofl/spacemono/SpaceMono-Regular.ttf"),
        ("Space Mono Bold",             "ofl/spacemono/SpaceMono-Bold.ttf"),
        ("Roboto Mono Thin",            "apache/robotomono/static/RobotoMono-Thin.ttf"),
        ("Roboto Mono Light",           "apache/robotomono/static/RobotoMono-Light.ttf"),
        ("Roboto Mono Regular",         "apache/robotomono/static/RobotoMono-Regular.ttf"),
        ("Roboto Mono Medium",          "apache/robotomono/static/RobotoMono-Medium.ttf"),
        ("Roboto Mono Bold",            "apache/robotomono/static/RobotoMono-Bold.ttf"),
    ],

    "Italic / Variable": [
        ("Montserrat Italic",           "ofl/montserrat/static/Montserrat-Italic.ttf"),
        ("Montserrat BoldItalic",       "ofl/montserrat/static/Montserrat-BoldItalic.ttf"),
        ("Montserrat LightItalic",      "ofl/montserrat/static/Montserrat-LightItalic.ttf"),
        ("Montserrat BlackItalic",      "ofl/montserrat/static/Montserrat-BlackItalic.ttf"),
        ("Roboto Italic",               "apache/roboto/static/Roboto-Italic.ttf"),
        ("Roboto BoldItalic",           "apache/roboto/static/Roboto-BoldItalic.ttf"),
        ("Lato Italic",                 "ofl/lato/Lato-Italic.ttf"),
        ("Lato BoldItalic",             "ofl/lato/Lato-BoldItalic.ttf"),
        ("Playfair Display Italic",     "ofl/playfairdisplay/static/PlayfairDisplay-Italic.ttf"),
        ("Playfair Display BoldItalic", "ofl/playfairdisplay/static/PlayfairDisplay-BoldItalic.ttf"),
        ("Merriweather Italic",         "ofl/merriweather/Merriweather-Italic.ttf"),
        ("Merriweather BoldItalic",     "ofl/merriweather/Merriweather-BoldItalic.ttf"),
        ("Poppins Italic",              "ofl/poppins/Poppins-Italic.ttf"),
        ("Poppins BoldItalic",          "ofl/poppins/Poppins-BoldItalic.ttf"),
        ("Lora Italic",                 "ofl/lora/static/Lora-Italic.ttf"),
        ("Lora BoldItalic",             "ofl/lora/static/Lora-BoldItalic.ttf"),
        ("EB Garamond Italic",          "ofl/ebgaramond/static/EBGaramond-Italic.ttf"),
        ("EB Garamond BoldItalic",      "ofl/ebgaramond/static/EBGaramond-BoldItalic.ttf"),
        ("Cormorant Italic",            "ofl/cormorant/static/Cormorant-Italic.ttf"),
        ("Cormorant BoldItalic",        "ofl/cormorant/static/Cormorant-BoldItalic.ttf"),
    ],
}


def download_file(url: str, dest: Path, retries: int = 3) -> bool:
    """Download url → dest. Returns True on success."""
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(req, timeout=20) as r:
                dest.write_bytes(r.read())
            return True
        except HTTPError as e:
            if e.code == 404:
                return False          # file doesn't exist — no point retrying
            if attempt < retries - 1:
                time.sleep(1)
        except URLError:
            if attempt < retries - 1:
                time.sleep(1)
    return False


def run(dest_dir: Path, verify_only: bool = False) -> dict:
    dest_dir.mkdir(parents=True, exist_ok=True)

    total   = sum(len(v) for v in FONT_CATALOGUE.values())
    results = {}   # category → {ok: [...], fail: [...]}
    n_ok = n_fail = 0

    print(f"\n{'='*60}")
    print(f"  Font Download  —  {total} files across {len(FONT_CATALOGUE)} categories")
    print(f"  Destination  : {dest_dir}")
    print(f"{'='*60}\n")

    for category, fonts in FONT_CATALOGUE.items():
        results[category] = {"ok": [], "fail": []}
        cat_ok = cat_fail = 0

        for name, path in fonts:
            filename = path.split("/")[-1]
            dest     = dest_dir / filename

            if dest.exists() and dest.stat().st_size > 1000:
                results[category]["ok"].append(name)
                cat_ok += 1
                n_ok   += 1
                continue

            if verify_only:
                results[category]["fail"].append(name)
                cat_fail += 1
                n_fail   += 1
                continue

            url = f"{BASE}/{path}"
            ok  = download_file(url, dest)

            if ok:
                results[category]["ok"].append(name)
                cat_ok += 1
                n_ok   += 1
            else:
                if dest.exists():
                    dest.unlink()   # remove partial file
                results[category]["fail"].append(name)
                cat_fail += 1
                n_fail   += 1

        status = "✓" if cat_fail == 0 else ("~" if cat_ok > 0 else "✗")
        print(f"  [{status}] {category:<35}  {cat_ok}/{len(fonts)} fonts")
        for f in results[category]["fail"]:
            print(f"        MISS: {f}")

    # ── Summary ──────────────────────────────────────────────────────────────
    categories_ok    = sum(1 for v in results.values() if len(v["fail"]) == 0)
    categories_total = len(FONT_CATALOGUE)
    families         = set(
        path.split("/")[-1].split("-")[0]
        for fonts in FONT_CATALOGUE.values()
        for _, path in fonts
    )
    families_present = set(
        f.stem.split("-")[0]
        for f in dest_dir.glob("*.ttf")
    )

    print(f"\n{'─'*60}")
    print(f"  Downloaded  : {n_ok}/{total} font files")
    print(f"  Categories  : {categories_ok}/{categories_total} fully complete")
    print(f"  Families    : {len(families_present)} unique families in {dest_dir.name}/")
    print(f"  Failed      : {n_fail} files")

    if n_fail > 0:
        print(f"\n  NOTE: {n_fail} files could not be downloaded (URL may have changed).")
        print(f"  Training will proceed with the {n_ok} successfully downloaded fonts.")

    if n_ok < 30:
        print(f"\n  WARNING: Only {n_ok} fonts downloaded.")
        print(f"  Training with fewer than 30 fonts may produce a biased model.")
        print(f"  Check your internet connection and try again.")

    print(f"{'─'*60}\n")

    summary = {
        "total_requested": total,
        "downloaded": n_ok,
        "failed": n_fail,
        "categories": categories_ok,
        "families": len(families_present),
        "dest": str(dest_dir),
    }

    # Write summary JSON next to training status
    out = dest_dir.parent / "models" / "font_download_summary.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(summary, indent=2))

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download diverse fonts for training")
    parser.add_argument("--dest",   default="fonts/downloaded",
                        help="Destination directory (default: fonts/downloaded)")
    parser.add_argument("--verify", action="store_true",
                        help="Only check what's already downloaded, don't download")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    dest = project_root / args.dest

    summary = run(dest, verify_only=args.verify)

    if summary["downloaded"] < 30:
        sys.exit(1)   # signal failure to calling scripts
