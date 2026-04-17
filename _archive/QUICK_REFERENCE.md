# Quick Reference Card

**Print this out or bookmark for easy access!**

---

## 🚀 5-Minute Quick Start

```bash
# 1. Check status
python3 unified_pipeline_manager.py --status

# 2. Prepare manifest
python3 unified_pipeline_manager.py --prepare

# 3. Start server
python3 server.py

# 4. Go to browser
# http://localhost:5001

# 5. Upload font, train, register, test!
```

---

## 📋 Commands You'll Use

| Task | Command |
|------|---------|
| Check what's ready | `python3 unified_pipeline_manager.py --status` |
| Prepare for Colab training | `python3 unified_pipeline_manager.py --prepare` |
| List all models | `python3 unified_pipeline_manager.py --list-models` |
| Get model details | `python3 unified_pipeline_manager.py --info v2` |
| Register new model | `python3 unified_pipeline_manager.py --register-model ./model.pt v2` |
| Start web server | `python3 server.py` |
| Test API (list models) | `curl http://localhost:5001/api/models/list` |
| Test API (get status) | `curl http://localhost:5001/api/pipeline/status` |

---

## 📁 Key Directories

| Directory | Purpose | What's Inside |
|-----------|---------|---------------|
| `training_data/` | Fonts for training | Font folders (Roboto/, Devanagari/...) |
| `training_data/training_manifest.json` | Index for Colab | List of all fonts + metadata |
| `models/versions/v0/` | Model v0 | Checkpoint file (model.pt) |
| `models/versions/v1/` | Model v1 | Checkpoint file (model.pt) |
| `models/model_registry.json` | Model index | Metadata for all models |
| `models/font_vae_unified.pt` | Current model | Symlink to latest |
| `webapp/` | Web UI | HTML, JS, CSS |
| `webapp/js/model-manager.js` | Model selection UI | Component to select models/fonts |

---

## 🎯 Model Lifecycle

```
TRAINING         REGISTRATION       TESTING          DEPLOYMENT
═════════════════════════════════════════════════════════════════

Train in      Register with    Test in webapp   Server uses
Colab    ──►  --register-model  with dropdown  ──► it for
model.pt      ──► v2            model switch       inference
              
              model_registry.json is updated
              models/versions/v2/ created
              models/font_vae_unified.pt updated
```

---

## 🌐 Web UI Workflow

1. **Open** http://localhost:5001
2. **Select Model** (dropdown, top-right)
3. **Select Font** (dropdown, left side)
4. **Generate** (click button)
5. **See Results** (26 unique characters)
6. **Compare** (switch model, regenerate)

---

## 🔍 API Endpoints

```
GET  /api/models/list
     Returns JSON with all active models

GET  /api/models/v2/info
     Returns JSON with v2 metadata

POST /api/models/v2/set
     Activates v2 for inference

GET  /api/pipeline/status
     Returns readiness: fonts, models, manifest
```

---

## 📚 Documentation Quick Links

| Document | When to Read |
|----------|--------------|
| **EXECUTIVE_SUMMARY.md** | First (overview) |
| **FILE_INDEX.md** | Finding files |
| **DEPLOYMENT_GUIDE.md** | Deploying |
| **MODEL_TESTING.md** | Testing models |
| **SYSTEM_ORGANIZATION.md** | Understanding architecture |

---

## ⚠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Model dropdown empty | Run `--status`, check registry exists |
| Can't find fonts | Upload via webapp Explore tab |
| Generation fails | Check server logs, verify model exists |
| Slow generation | First load caches model (~2 seconds) |
| Model not switching | Restart server: `python3 server.py` |

---

## ✅ Pre-Training Checklist

- [ ] Fonts uploaded to `training_data/`
- [ ] `python3 unified_pipeline_manager.py --status` shows fonts
- [ ] `python3 unified_pipeline_manager.py --prepare` creates manifest
- [ ] `training_data/training_manifest.json` exists
- [ ] Ready to upload to Colab!

---

## ✅ Post-Training Checklist

- [ ] Model trained in Colab
- [ ] Downloaded `font_vae_unified.pt` from Colab
- [ ] Run `--register-model ./model.pt v2`
- [ ] `model_registry.json` updated
- [ ] `models/versions/v2/model.pt` exists
- [ ] `python3 server.py` starts
- [ ] http://localhost:5001 loads
- [ ] Model dropdown shows v2
- [ ] Font dropdown shows fonts
- [ ] Generate works: 26 unique letters

---

## 📊 File Sizes (Typical)

| Item | Size | Note |
|------|------|------|
| Model checkpoint | 50-80 MB | PyTorch .pt file |
| Model registry | <1 KB | JSON metadata |
| Font metadata | ~10 KB | Per font |
| Font glyphs (NPZ) | ~20 MB | Pre-computed SDF |

---

## 🎨 UI Elements

```
┌─────────────────────────────────┐
│ Model ▼  │ Font ▼              │ ← Dropdowns (model-manager.js)
├─────────────────────────────────┤
│ ✅ Model Status                 │ ← Shows active model + fonts
├─────────────────────────────────┤
│ ✅ Pipeline Status              │ ← Shows readiness
├─────────────────────────────────┤
│ ✅ Model Details                │ ← Shows metadata
├─────────────────────────────────┤
│ [Generate] [Style] [Morph]     │ ← Action buttons
└─────────────────────────────────┘
```

---

## 🔐 Important Files (Don't Delete!)

- `scripts/sdf.py` — Unified SDF renderer
- `models/model_registry.json` — Model index
- `training_data/training_manifest.json` — Font index
- `webapp/css/style.css` — UI styles
- `unified_pipeline_manager.py` — Pipeline orchestration
- `server.py` — Flask API

---

## 📞 Quick Troubleshooting

**Q: How do I know which model is latest?**  
A: Check registry: `cat models/model_registry.json | jq .latest`

**Q: How do I switch models?**  
A: Via webapp dropdown OR: `curl -X POST http://localhost:5001/api/models/v2/set`

**Q: Can I keep old models?**  
A: Yes! All versions in `models/versions/v0`, `v1`, `v2`... are kept.

**Q: What if I want to revert to v1?**  
A: `curl -X POST http://localhost:5001/api/models/v1/set`

**Q: How do I add a new font?**  
A: Via webapp Explore tab → Upload Font → Saves to `training_data/`

---

## 🎯 Next Steps

1. [ ] Read EXECUTIVE_SUMMARY.md (overview)
2. [ ] Read DEPLOYMENT_GUIDE.md (workflow)
3. [ ] Upload a font to `training_data/`
4. [ ] Run `--prepare` to generate manifest
5. [ ] Train in Colab
6. [ ] Register model with `--register-model`
7. [ ] Test in webapp
8. [ ] Compare different models
9. [ ] Select best model for production

---

**Bookmark this file for quick reference!** 🔖
