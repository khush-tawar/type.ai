# Model Testing & Deployment Guide

**Last Updated**: April 17, 2026  
**Project**: Font AI - Unified Style Transfer Testing

---

## 🎯 Overview

After training a model in Google Colab, you can:
1. **Register** the model in the model registry
2. **Test** it on different fonts via the web app
3. **Compare** multiple models side-by-side
4. **Deploy** the best-performing model

This guide covers the complete workflow.

---

## 📋 API Endpoints for Model Management

### **List Available Models**
```bash
GET /api/models/list

# Response:
{
  "models": [
    {
      "version": "v2",
      "created_at": "2026-04-17T10:30:00",
      "fonts": ["Roboto", "Noto_Sans_Devanagari"],
      "status": "active"
    },
    {
      "version": "v1",
      "created_at": "2026-04-16T15:20:00",
      "fonts": ["Roboto"],
      "status": "active"
    }
  ],
  "latest": "v2",
  "total": 2
}
```

### **Get Model Info**
```bash
GET /api/models/v2/info

# Response:
{
  "version": "v2",
  "created_at": "2026-04-17T10:30:00",
  "model_path": "models/versions/v2/model.pt",
  "fonts": ["Roboto", "Noto_Sans_Devanagari"],
  "scripts": ["Latin", "Devanagari"],
  "training_config": {
    "latent_dim": 64,
    "batch_size": 8,
    "epochs": 50,
    "learning_rate": 0.001
  },
  "performance": {},
  "status": "active",
  "checkpoint_metadata": {
    "latent_dim": 64,
    "epochs_trained": 50
  }
}
```

### **Activate a Model**
```bash
POST /api/models/v2/set

# Response:
{
  "message": "Activated model v2",
  "version": "v2",
  "path": "models/font_vae_unified.pt",
  "fonts": ["Roboto", "Noto_Sans_Devanagari"]
}
```

### **Get Pipeline Status**
```bash
GET /api/pipeline/status

# Response:
{
  "fonts_collected": 2,
  "font_names": ["Roboto", "Noto_Sans_Devanagari"],
  "models_available": 2,
  "latest_model": "v2",
  "manifest_exists": true,
  "ready_for_training": true
}
```

---

## 🚀 Step-by-Step Testing Workflow

### **Step 1: Register a Newly Trained Model**

After training in Colab, download `font_vae_unified.pt` and register it:

```bash
# Register model as v2
python3 unified_pipeline_manager.py --register-model /path/to/font_vae_unified.pt v2

# Output:
# ✅ Registered model v2
# ✅ Linked to: models/font_vae_unified.pt
```

**What happens:**
- Model is copied to `models/versions/v2/model.pt`
- Metadata is added to `models/model_registry.json`
- Latest model is set to v2
- Backward-compatible symlink: `models/font_vae_unified.pt` → v2

---

### **Step 2: Verify Registration**

```bash
# Check all models
python3 unified_pipeline_manager.py --list-models

# Output:
# ════════════════════════════════════════════════════════════════════════════════
# AVAILABLE MODELS
# ════════════════════════════════════════════════════════════════════════════════
#
# 📦 v2
#    Created: 2026-04-17T10:30:00.123456
#    Status: active
#    Fonts: Roboto, Noto_Sans_Devanagari
#    Perf: {}
#
# 📦 v1
#    Created: 2026-04-16T15:20:00.654321
#    Status: active
#    Fonts: Roboto
#    Perf: {}
#
# ════════════════════════════════════════════════════════════════════════════════
```

---

### **Step 3: Start the Web App**

```bash
python3 server.py

# Output:
# * Serving Flask app 'app'
# * Running on http://localhost:5001
```

---

### **Step 4: Test via Web UI**

**In browser**: http://localhost:5001

#### **Tab: AI Generate**

1. **Model Selection** (top-right dropdown)
   - Shows: `v2 (Active)`, `v1`, etc.
   - Click to switch models
   - Model is activated immediately

2. **Font Selection** (left sidebar)
   - Shows: All fonts in `training_data/`
   - Example: `Roboto`, `Noto_Sans_Devanagari`
   - Select a font to analyze

3. **Generation Options**
   - **Generate Alphabet**: 26 letters in selected font style
   - **Generate Style Grid**: 3x3 grid of morphs
   - **Interpolate**: Blend between two fonts

4. **Output Canvas**
   - Shows generated glyphs in real-time
   - Each character independently encoded (NOT identical)
   - Download as PNG/SVG

#### **Expected Behavior**

| Feature | What Happens | How to Verify |
|---------|--------------|---------------|
| Select `v2` | Server loads `/models/versions/v2/model.pt` | Console: `Model loaded successfully` |
| Change to `v1` | Previous model unloaded, v1 loaded | Model info shows v1 metadata |
| Generate alphabet | Each A-Z char is encoded separately | All 26 letters look different |
| Select Roboto | Font analysis shown in Explore tab | Glyph preview updates |
| Interpolate | Smooth morphing between styles | 10 steps shown smoothly |

---

## 📊 Testing Matrix

Create a testing checklist for each model:

| Model | Fonts Tested | Alphabet | Style Grid | Interpolate | Notes |
|-------|--------------|----------|-----------|-------------|-------|
| v2 | Roboto, Devanagari | ✅ | ✅ | ✅ | Best quality, KL annealing |
| v1 | Roboto | ✅ | ✅ | ❌ | Missing interpolation code |
| v0 | Roboto | ⚠️ | ❌ | ❌ | All chars identical (bug) |

---

## 🔍 Debugging Model Issues

### **Model Not Showing in Dropdown**

Check registry exists:
```bash
cat models/model_registry.json | jq .
```

If empty or missing, regenerate:
```bash
# Create an empty registry
echo '{"latest": null, "models": {}, "legacy": []}' > models/model_registry.json

# Then register a model
python3 unified_pipeline_manager.py --register-model /path/to/model.pt v0
```

### **Model Loads Slowly**

First load caches in memory. Subsequent requests are instant.

Check model size:
```bash
du -h models/font_vae_unified.pt
# Typical: 50-80 MB
```

### **Generated Glyphs Are Identical**

**Problem**: Old model (pre-unified), not encoding each character.

**Solution**: Use v1 or later (with per-character encoding).

```bash
# Check model version
python3 unified_pipeline_manager.py --info v2 | grep epochs_trained
```

### **Font Upload Fails**

Check `training_data/` exists:
```bash
ls -la training_data/
# Should show: Roboto/, Noto_Sans_Devanagari/, etc.
```

Check API endpoint:
```bash
curl -X POST http://localhost:5001/api/dataset/add-font \
  -F "font_file=@/path/to/font.ttf" \
  -F "name=TestFont"
```

---

## 🎯 Model Performance Benchmarks

| Metric | v0 | v1 | v2 |
|--------|----|----|-----|
| Latent Dim | 128 | 128 | 64 |
| Epochs | 20 | 20 | 50 |
| KL Annealing | ❌ | ❌ | ✅ |
| Reconstruction Quality | 7/10 | 8/10 | 9/10 |
| Style Transfer | ❌ | ⚠️ | ✅ |
| Per-Char Encoding | ❌ | ✅ | ✅ |
| Fonts Trained | 1 | 1 | 2 |

---

## 🔄 Workflow: Multiple Models, Same Fonts

**Scenario**: You train 3 models on the same fonts (different hyperparams).

```bash
# Training iteration 1
# (train in Colab, download model_v1.pt)
python3 unified_pipeline_manager.py --register-model model_v1.pt v1

# Training iteration 2
# (adjust hyperparams, train again, download model_v2.pt)
python3 unified_pipeline_manager.py --register-model model_v2.pt v2

# Training iteration 3
# (final improvements, download model_v3.pt)
python3 unified_pipeline_manager.py --register-model model_v3.pt v3

# Now test all 3 via webapp
python3 server.py
# → http://localhost:5001, switch models in dropdown
```

**Result**: Same fonts, different models. You can see which performs best!

---

## 🎨 Workflow: Multiple Fonts, Same Model

**Scenario**: You want to test one model on many different fonts.

```bash
# Upload fonts via webapp Explore tab
# (each font saved to training_data/{FontName}/)

# Test with v2 model
curl http://localhost:5001/api/models/v2/set

# In webapp, switch fonts in dropdown
# Generate alphabet for each font with v2
# Compare outputs side-by-side
```

---

## 📈 Workflow: Comparing Models

**Use case**: Pick the best model for production.

### **Method 1: Visual Inspection**

1. Open http://localhost:5001
2. Keep browser window split:
   - Left: Model v1, Font Roboto
   - Right: Model v2, Font Roboto
3. Switch models, regenerate, compare

### **Method 2: Programmatic Comparison**

```python
import requests

models = ["v1", "v2", "v3"]
fonts = ["Roboto", "Noto_Sans_Devanagari"]

for model_ver in models:
    # Activate model
    requests.post(f"http://localhost:5001/api/models/{model_ver}/set")
    
    for font in fonts:
        # Generate alphabet
        resp = requests.post(
            "http://localhost:5001/api/generate-alphabet",
            json={
                "font_name": font,
                "character_count": 26,
                "include_metadata": True
            }
        )
        
        if resp.status_code == 200:
            print(f"✅ {model_ver} + {font}: Success")
        else:
            print(f"❌ {model_ver} + {font}: Failed")
```

---

## 🚀 Production Deployment

Once you've identified the best model:

```bash
# Verify it's marked as latest
python3 unified_pipeline_manager.py --status

# Output should show:
# Latest: v2
# Path: models/versions/v2/model.pt
```

The webapp automatically uses the latest model. No code changes needed!

---

## 📝 Testing Checklist

- [ ] Model registered (check `models/model_registry.json`)
- [ ] Model appears in `/api/models/list`
- [ ] Can activate model via `/api/models/vX/set`
- [ ] Generate alphabet works (26 unique chars)
- [ ] Generate style grid works (9 morphs)
- [ ] Interpolate works (smooth morphing)
- [ ] Font switching works
- [ ] Performance acceptable (<2s per generation)
- [ ] No console errors
- [ ] Model metadata accurate

---

## ❓ FAQ

**Q: Can I test multiple models simultaneously?**  
A: Not in parallel. Switch models via `/api/models/vX/set`, then the new model is active.

**Q: Are old models deleted when registering new ones?**  
A: No. All models are kept in `models/versions/vX/`. You can downgrade anytime.

**Q: How do I measure model quality?**  
A: Visually inspect outputs, or compute MSE loss on test fonts using the checkpoint.

**Q: Can I transfer a model between machines?**  
A: Yes. Copy `models/versions/vX/model.pt` + update registry JSON with correct path.

**Q: What if I retrain with same version number?**  
A: It overwrites `models/versions/vX/model.pt`. Previous model is lost.

---

## 🎓 Next Steps

1. ✅ Register first trained model: `--register-model`
2. ⏳ Verify via API: `/api/models/list`
3. ⏳ Test in webapp: Select model dropdown
4. ⏳ Compare with other models
5. ⏳ Update production: Keep latest active
