# File Organization Guide

## Project Structure Overview

### 🎯 Critical Production Files

#### Frontend (`webapp/`)
```
webapp/
├── index.html                    Main application UI
├── css/
│   └── style.css                 All styles (design system + components)
└── js/
    ├── app.js                    Main app initialization & tab routing
    ├── model-manager.js          Model & font selection dropdowns
    ├── ai-generator.js           AI generation engine
    ├── font-analyzer.js          Font metadata extraction
    ├── font-renderer.js          SVG rendering for glyphs
    ├── font-morpher.js           Morphing interpolation logic
    ├── font-convolution.py       Convolution filters (LEGACY - check usage)
    └── google-fonts.js           Google Fonts API integration
```

**Purpose**: Web UI for font analysis, morphing, and generation

---

#### Backend (`server.py`)
**Purpose**: Flask REST API server
- Model inference endpoints
- Font download endpoints
- Pipeline status queries
- Model management API

**Key Endpoints**:
- `GET /api/models/list` → List available models
- `GET /api/models/{version}/info` → Model details
- `POST /api/models/{version}/set` → Switch active model
- `GET /api/pipeline/status` → System status
- `POST /api/generate` → Generate font variations
- `GET /api/download/{fontname}` → Download font (TTF/OTF)

---

### 🔧 Model & Training Infrastructure

#### Model Management (`unified_pipeline_manager.py`)
```python
UnifiedPipelineManager()
  ├── discover_fonts()              # Find fonts in training_data/
  ├── generate_manifest()           # Create training manifest
  └── list_models()                 # List registered models

ModelRegistry()
  ├── register_model(path, v2)      # Register new trained model
  ├── get_latest()                  # Get v2 → versions/v2/
  ├── get_model_info(version)       # Get metadata
  └── deprecate_model(version)      # Mark as legacy
```

**CLI Commands**:
```bash
python3 unified_pipeline_manager.py --status          # Check system status
python3 unified_pipeline_manager.py --prepare         # Generate training manifest
python3 unified_pipeline_manager.py --list-models     # List all models
python3 unified_pipeline_manager.py --info v2         # Model details
python3 unified_pipeline_manager.py --register-model model.pt v2
```

---

#### Training Data (`training_data/`)
```
training_data/
├── Roboto/                       OpenType fonts for training
│   ├── Roboto-Regular.ttf
│   ├── Roboto-Bold.ttf
│   └── meta.json                 Font metadata
├── Hind/
├── Montserrat/
├── Noto_Sans_Devanagari/         Multi-script example
├── training_manifest.json        Auto-generated index of all fonts
└── Morphed-HL__1_/               (ARCHIVE) Old training output
```

**How it works**:
1. Add fonts to `training_data/{FontName}/` folder
2. Run `unified_pipeline_manager.py --prepare`
3. Manifest scans all fonts → generates `training_manifest.json`
4. Upload manifest to Colab
5. Training reads from manifest

---

#### Models (`models/`)
```
models/
├── font_vae_unified.pt           Latest model symlink (always v2/model.pt)
├── model_registry.json           Central metadata
└── versions/
    ├── v0/
    │   └── model.pt              Initial training
    ├── v1/
    │   └── model.pt              Improved version
    └── v2/
        └── model.pt              Current production
```

**Registry Structure**:
```json
{
  "latest": "v2",
  "models": {
    "v2": {
      "version": "v2",
      "created_at": "2026-04-17T10:30:00Z",
      "fonts": ["Roboto", "Hind"],
      "epochs": 100,
      "performance": {...}
    }
  }
}
```

---

### 📚 Notebooks for Training

#### `train_unified_pipeline.ipynb`
**Purpose**: Main Colab training notebook
- **When to use**: Upload to Colab, run in GPU environment
- **Input**: `training_manifest.json` (from `--prepare` command)
- **Output**: `model.pt` checkpoint
- **Post-training**: Download, register with `--register-model model.pt v2`

---

### 🔬 Reference/Analysis Data

#### `font_analysis_results/`
```
font_analysis_results/
└── {FontName}/
    ├── metadata.json             Font tables, glyphs, unicode
    ├── ANALYSIS_REPORT.txt       Human-readable analysis
    ├── unicode_mappings.txt      Char → codepoint mappings
    ├── sdf_A_data.npy            Pre-computed SDF for 'A' glyph
    └── font_tables.txt           Raw OpenType table data
```

**Purpose**: Pre-computed analysis cached for fast lookup
- Useful for understanding font structure
- Can be regenerated if deleted (will recompute on demand)

---

#### `font_morphing_results/`
```
font_morphing_results/
├── config.json                   Morphing parameters used
└── [generated morphs]            SVG/TTF outputs from morphing
```

**Purpose**: Archive of generated morphs
- Can be deleted to free space (outputs regenerated on demand)

---

### 📁 Scripts & Utilities (`scripts/`)

#### Core Training
- **`train_vae.py`** — VAE training logic (used by notebook)
- **`sdf.py`** — Signed distance field generation

#### Utilities  
- **`font_convolution.py`** — Convolution filters & processing
- **`font_morphing.py`** — Morphing interpolation utils
- **`font_explorer.py`** — Debug utility for analyzing fonts
- **`font_renderer.py`** — Glyph rendering utilities

#### Deprecated/Check Usage
- **`download_fonts.py`** — Font downloading utility (check if used)
- **`integrated_pipeline.py`** — OLD pipeline (removed, use unified_pipeline_manager.py)

---

### 📖 Documentation

#### Active Documentation (READ THESE)
1. **`CLAUDE.md`** — Design system rules & component specs
2. **`EXECUTIVE_SUMMARY.md`** — Overview of entire system
3. **`FILE_INDEX.md`** — File reference (this document was updated)
4. **`DEPLOYMENT_GUIDE.md`** — 5-step training workflow
5. **`MODEL_TESTING.md`** — API testing guide
6. **`SYSTEM_ORGANIZATION.md`** — Architecture deep-dive
7. **`QUICK_REFERENCE.md`** — Cheat sheet & commands
8. **`FILE_ORGANIZATION.md`** — THIS FILE

#### Archived Documentation (`_archived_docs/`)
- Old implementation notes (reference only)
- Can be deleted if space is needed

---

### 🔧 Configuration & Build

- **`requirements.txt`** — Python dependencies
- **`.github/`** — GitHub Actions (for future CI/CD)
- **`.venv/`** — Python virtual environment
- **`.vscode/`** — VS Code settings (optional)
- **`run_server.sh`** — Shell script to start server

---

## Quick Lookup

### "I want to..."

#### ...add a new font for training
```
1. Add font files to training_data/{FontName}/
2. Run: python3 unified_pipeline_manager.py --prepare
3. Upload training_manifest.json to Colab
```

#### ...train a new model
```
1. Run --prepare command (above)
2. Upload train_unified_pipeline.ipynb to Colab
3. Run all cells
4. Download model.pt
5. Run: python3 unified_pipeline_manager.py --register-model model.pt v2
```

#### ...test different models in the webapp
```
1. Models dropdown in header shows all registered versions
2. Select model → API calls /api/models/{version}/set
3. Generator uses active model automatically
```

#### ...download a generated font with unicode mapping
```
1. (Feature in development)
2. Will map generated glyphs → unicode codepoints
3. Generate valid TTF/OTF with mapping
4. Download from /api/download/{fontname}
```

#### ...understand model registry
```
1. Open models/model_registry.json
2. Shows all versions, metadata, status
3. "latest" field points to production model
```

---

## File Cleanup Summary

### Deleted (No longer needed)
- ❌ `train_colab_vscode.ipynb` (duplicate, use train_unified_pipeline.ipynb)
- ❌ `scripts/integrated_pipeline.py` (old pipeline, use unified_pipeline_manager.py)
- ❌ `test_conv_output/` (test artifacts)

### Archived (Kept for reference, moved to `_archived_docs/`)
- `IMPLEMENTATION_SUMMARY.md`
- `UNIFIED_PIPELINE_GUIDE.md`
- `PIPELINE_REFACTORED.md`
- `PROJECT_ORGANIZATION.md`
- `REFACTORING_COMPLETE.md`
- `QUICKSTART.md`

### Kept (Can delete if space needed, but recommended to keep)
- `font_analysis_results/` — Pre-computed font data (cached, regenerates on demand)
- `font_morphing_results/` — Generated outputs (regenerates on demand)

---

## Summary

| Category | Status | Count |
|----------|--------|-------|
| Production Code | ✅ Active | 3 files (server, manager, webapp) |
| Frontend Components | ✅ Active | 9 JS files |
| Model/Training | ✅ Active | 5 scripts |
| Documentation | ✅ Updated | 8 guides |
| Archive | ⚠️ Reference | 7 files (_archived_docs/) |
| Test Artifacts | ❌ Deleted | - |

**Total Project Size**: ~150MB (mostly models + training data)

