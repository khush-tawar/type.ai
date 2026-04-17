# Project File Index & Organization

**Last Updated**: April 17, 2026  
**Project**: Font AI - Unified Style Transfer Training & Testing Pipeline

---

## 📁 Directory Structure

```
/Users/khush/Documents/IIT ID works/sem 4/AI Type reseaarch/Project file/
│
├── 🚀 MAIN EXECUTION
│   ├── server.py                          # Flask API server (main entry point)
│   ├── run_server.sh                      # Quick server startup
│   └── unified_pipeline_manager.py        # Pipeline orchestration + model versioning
│
├── 🧠 TRAINING PIPELINE
│   ├── train_unified_pipeline.ipynb       # PRIMARY: Colab notebook (GPU training)
│   ├── train_colab_vscode.ipynb           # LEGACY: VSCode-compatible Colab
│   ├── scripts/
│   │   ├── train_vae.py                   # VAE training (local alternative)
│   │   ├── sdf.py                         # ✨ UNIFIED SDF renderer (single source)
│   │   ├── download_fonts.py              # Font acquisition from Google Fonts
│   │   └── [other utility scripts]
│   └── requirements.txt                   # Python dependencies
│
├── 🎨 WEB APPLICATION (Flask + Vanilla JS)
│   ├── webapp/
│   │   ├── index.html                     # Main UI shell (Explore, AI Generate, etc.)
│   │   ├── design-system.html             # Component showcase
│   │   ├── README.md                      # Webapp documentation
│   │   ├── css/
│   │   │   ├── style.css                  # Global styles
│   │   │   └── biq-design-system.css      # BIQ design tokens + components
│   │   └── js/
│   │       ├── app.js                     # Main app orchestration
│   │       ├── ai-generator.js            # AI Generate tab logic
│   │       ├── font-analyzer.js           # Explore tab (font analysis)
│   │       ├── font-morphing.js           # Style transfer morphing
│   │       ├── font-renderer.js           # Glyph rendering (SDF, rasterization)
│   │       ├── font-convolution.js        # Filter effects
│   │       └── google-fonts.js            # Google Fonts loader
│   │
│   └── [webapp files]
│
├── 📊 TRAINED MODELS (Versioned)
│   ├── models/
│   │   ├── font_vae_unified.pt            # LATEST: Active model (symlink/copy)
│   │   ├── font_vae3.pt                   # LEGACY: Old model
│   │   ├── versions/                      # Versioned model storage
│   │   │   ├── v0/model.pt                # First trained model
│   │   │   ├── v1/model.pt                # Second iteration
│   │   │   ├── v2/model.pt                # Current best
│   │   │   └── ...
│   │   ├── model_registry.json            # ✨ MODEL METADATA (version tracking)
│   │   └── training_status.json           # Training state
│   │
│   └── [legacy models]
│
├── 📁 TRAINING DATA (Font Collections)
│   ├── training_data/
│   │   ├── Roboto/                        # Font 1: Roboto
│   │   │   ├── glyphs.npz                 # Pre-computed SDF data
│   │   │   ├── meta.json                  # Font metadata (name, weight, unicode)
│   │   │   └── Roboto-Regular.ttf
│   │   ├── Noto_Sans_Devanagari/          # Font 2: Devanagari (multi-script)
│   │   │   ├── glyphs.npz
│   │   │   ├── meta.json
│   │   │   └── NotoSansDevanagari-Regular.ttf
│   │   ├── training_manifest.json         # ✨ INDEX OF ALL FONTS (for Colab)
│   │   └── ...
│   │
│   └── [test data, processed datasets]
│
├── 🔍 FONT ANALYSIS RESULTS (Cached)
│   ├── font_analysis_results/
│   │   ├── Roboto/
│   │   │   ├── ANALYSIS_REPORT.txt
│   │   │   ├── metadata.json
│   │   │   ├── sdf_A_data.npy
│   │   │   ├── unicode_mappings.txt
│   │   │   └── font_tables.txt
│   │   ├── Montserrat/
│   │   ├── Hind/
│   │   ├── Samarkan/
│   │   └── ...
│
├── 📖 DOCUMENTATION (Important!)
│   ├── CLAUDE.md                          # ⭐ BIQ Design System Rules (READ FIRST)
│   ├── UNIFIED_PIPELINE_GUIDE.md          # ⭐ End-to-end workflow
│   ├── UNIFIED_PIPELINE_IMPLEMENTATION.md # ⭐ Technical architecture
│   ├── FILE_INDEX.md                      # This file
│   ├── README.md                          # Project overview
│   ├── QUICKSTART.md                      # 5-step quick start
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── PROJECT_ORGANIZATION.md
│   ├── REFACTORING_COMPLETE.md
│   ├── PIPELINE_REFACTORED.md
│   ├── AGENTS.md                          # Development workflows
│   ├── ARCHITECTURE.md
│   └── docs/
│       ├── USAGE_GUIDE.md
│       ├── EXAMPLES.md
│       ├── MORPHING_GUIDE.md
│       └── README.md
│
└── 🎯 UTILITY / CONFIG
    ├── fonts/                             # Font library
    │   ├── Roboto/static/
    │   ├── Montserrat/static/
    │   ├── Hind/
    │   ├── samarkan/
    │   └── ...
    ├── font_morphing_results/
    │   └── config.json
    ├── test_conv_output/
    └── [other utilities]
```

---

## 🔑 KEY FILES EXPLAINED

### Execution & Control

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `server.py` | Flask API + static file serving | ✅ Active | Main entry point: `python3 server.py` → http://localhost:5001 |
| `unified_pipeline_manager.py` | Pipeline orchestration + model registry | ✅ Active | `python3 unified_pipeline_manager.py --status` |
| `run_server.sh` | Quick startup script | ✅ Active | `./run_server.sh` |

### Training

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `train_unified_pipeline.ipynb` | PRIMARY Colab training | ✅ Primary | Use this for GPU training in Google Colab |
| `train_colab_vscode.ipynb` | Legacy VSCode Colab | ⚠️ Legacy | Kept for reference, use primary instead |
| `scripts/train_vae.py` | Local VAE training | ✅ Fallback | For local testing without GPU |
| `scripts/sdf.py` | UNIFIED SDF renderer | ✅ Critical | Single source of truth for SDF computation |

### Web Application

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `webapp/index.html` | Main UI shell | ✅ Active | Tabs: Explore, AI Generate, Font Morphing, Design System |
| `webapp/css/biq-design-system.css` | BIQ tokens + components | ✅ Active | All colors, typography, spacing tokens defined here |
| `webapp/js/ai-generator.js` | AI Generate tab | ✅ Active | Model testing & generation interface |
| `webapp/js/font-analyzer.js` | Explore tab | ✅ Active | Font selection, upload, analysis |

### Models & Data

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `models/font_vae_unified.pt` | CURRENT MODEL | ✅ Active | Latest trained model (symlink to `versions/vX/model.pt`) |
| `models/model_registry.json` | Model metadata index | ✅ Active | Tracks: version, fonts used, creation date, performance |
| `models/versions/v0/model.pt` | Model v0 | 📦 Archived | First training iteration |
| `models/versions/v1/model.pt` | Model v1 | 📦 Archived | Second iteration |
| `models/versions/v2/model.pt` | Model v2 | 🟢 Current | Latest best model |
| `training_data/training_manifest.json` | Font index for training | ✅ Active | Generated by `--prepare`, used by Colab |
| `training_data/{FontName}/meta.json` | Per-font metadata | ✅ Active | Unicode ranges, weight, file path |
| `training_data/{FontName}/glyphs.npz` | Pre-computed SDFs | ✅ Active | Binary glyph data for training |

---

## 🎯 HOW TO USE THIS INDEX

### **For Training a New Model**

1. **Upload fonts** via webapp Explore tab → saves to `training_data/{FontName}/`
2. **Check status**: `python3 unified_pipeline_manager.py --status`
3. **Prepare manifest**: `python3 unified_pipeline_manager.py --prepare` → generates `training_data/training_manifest.json`
4. **Train in Colab**: Upload `train_unified_pipeline.ipynb` + `training_manifest.json` to Google Colab
5. **Download model**: Get `font_vae_unified.pt` from Colab
6. **Register model**: `python3 unified_pipeline_manager.py --register-model <path> v3`
7. **Verify**: `python3 unified_pipeline_manager.py --list-models`

### **For Testing a Model**

1. **Start server**: `python3 server.py`
2. **Go to webapp**: http://localhost:5001
3. **AI Generate tab**: Select model → Select font → Generate alphabet/morph/grid
4. **Switch models**: UI shows available models from `model_registry.json`

### **For Debugging**

- **Model registry**: `cat models/model_registry.json`
- **Training manifest**: `cat training_data/training_manifest.json`
- **Font metadata**: `cat training_data/{FontName}/meta.json`
- **Server logs**: Check terminal where `server.py` runs
- **SDF rendering**: Test with `python3 -c "from scripts.sdf import render_sdf; print('✓')"`

---

## 📊 FILE METRICS

### Code Lines
- `server.py`: ~500 lines (API endpoints)
- `unified_pipeline_manager.py`: ~250 lines (pipeline orchestration)
- `scripts/sdf.py`: ~150 lines (SDF rendering)
- `webapp/js/ai-generator.js`: ~200 lines (UI logic)
- **Total**: ~2500 lines of application code

### Data Sizes
- `models/versions/v0/model.pt`: ~50 MB (PyTorch model)
- `training_data/Roboto/glyphs.npz`: ~20 MB (pre-computed SDFs)
- `models/model_registry.json`: <1 KB (metadata only)
- **Total**: Scales with number of fonts + models

### API Endpoints
- `/api/models/list` — List available models
- `/api/models/{version}/info` — Get model metadata
- `/api/models/{version}/set` — Activate a model for inference
- `/api/generate-alphabet` — Generate alphabet with current model
- `/api/generate-font-styles` — Style transfer grid
- `/api/fonts/list` — List available fonts

---

## 🔄 FILE VERSIONING STRATEGY

### Models: Semantic Version
```
models/versions/v0/  ← First complete training
models/versions/v1/  ← Improved (KL annealing added)
models/versions/v2/  ← Current best (LeakyReLU + 64D latent)
→ font_vae_unified.pt (symlink to latest)
```

### Training Data: No version (always latest)
```
training_data/Roboto/          ← Latest Roboto font uploaded
training_data/training_manifest.json  ← Regenerated on each --prepare
```

### Webapp: No version (live)
```
webapp/index.html              ← Always latest UI
webapp/js/ai-generator.js      ← Always latest logic
```

---

## ⚠️ CRITICAL FILES (DO NOT DELETE)

- ✅ `scripts/sdf.py` — If deleted, training will break
- ✅ `models/model_registry.json` — Loss = can't track models
- ✅ `training_data/training_manifest.json` — Loss = Colab won't know which fonts to train on
- ✅ `webapp/css/biq-design-system.css` — Loss = UI design tokens gone
- ✅ `models/versions/v2/model.pt` — Loss = current model gone (but can retrain)

---

## 📝 NOTES

1. **Model Selection**: The webapp reads `models/model_registry.json` to populate the model dropdown
2. **Font Organization**: All fonts must be in `training_data/` with `meta.json` + `glyphs.npz`
3. **SDF is Shared**: Every training, inference, analysis uses `scripts/sdf.py` (single source of truth)
4. **Backward Compatibility**: `models/font_vae_unified.pt` points to latest, old code still works
5. **Manifest is Temporary**: `training_data/training_manifest.json` is regenerated on each `--prepare`, only needed for Colab

---

## 🚀 NEXT STEPS

1. ✅ Test the versioning system: `python3 unified_pipeline_manager.py --status`
2. ⏳ Update server.py with `/api/models/*` endpoints
3. ⏳ Add model selection UI to webapp
4. ⏳ Test model switching + inference
5. ⏳ Document model comparison workflow
