# AI Font Analyzer & Morpher — Web Application

A browser-based font analysis, morphing, and feature extraction tool.  
**All processing runs locally in your browser** — no server required.

## Features

- **Font Upload** — Drag & drop `.ttf`, `.otf`, `.woff` files or try sample fonts
- **Analysis Dashboard** — Metadata, Unicode coverage, font tables, glyph inspector
- **SDF Generation** — Signed Distance Field visualization with contours
- **Bezier Curve Viewer** — Control points and path visualization
- **6-Axis Morphing** — Real-time style morphing with interactive sliders
  - Serif ↔ Sans-serif
  - Thin ↔ Bold (weight)
  - Backward ↔ Italic (slant)
  - Condensed ↔ Extended (width)
  - Humanist ↔ Geometric
  - Plain ↔ Decorative
- **Style Heatmap** — 2D grid showing morphing across two axes
- **Convolution Filters** — Sobel, Prewitt, Laplacian, Sharpen, Emboss, and more
- **Feature Vector Extraction** — 80+ dimensional feature vectors for ML
- **Export** — Reports (TXT), metadata (JSON), morphing config, PNGs

## Live Demo

Visit: `https://<your-username>.github.io/<repo-name>/webapp/`

## Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set Source to **Deploy from a branch**
4. Select **main** branch and **/ (root)** folder
5. Save — your site will be at `https://<username>.github.io/<repo>/webapp/`

Alternatively, for direct root deployment:
- Copy the contents of `webapp/` to the repo root, or
- Set the GitHub Pages source to the `webapp` directory (via GitHub Actions)

## Local Development

Simply open `webapp/index.html` in a browser, or use a local server:

```bash
cd webapp
python3 -m http.server 8000
# Visit http://localhost:8000
```

Design system showcase:

- Open `webapp/design-system.html` to review BIQ-aligned tokens and components.

## Technology

- **opentype.js** — Font parsing (TrueType/OpenType)
- **Canvas 2D API** — All rendering and image processing
- **Pure JavaScript** — No build tools, no frameworks, no dependencies beyond opentype.js
- **GitHub Pages** — Static hosting (no backend required)

## Based On

Inspired by *"Learning a Manifold of Fonts"* (SIGGRAPH 2014) and the companion Python analysis toolkit.
