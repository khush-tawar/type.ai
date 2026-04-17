# Unified Training Pipeline — Complete Guide

## Architecture: Single Source of Truth

```
┌──────────────────────────────────────────────────────────────┐
│                    WEBAPP (webapp/index.html)                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Explore Tab: Upload fonts → /api/dataset/add-font        │ │
│ │ → Saves to training_data/{font_name}/                    │ │
│ │   - glyphs.npz (SDF arrays)                              │ │
│ │   - meta.json (unicode, scripts, glyph count)            │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│         unified_pipeline_manager.py (LOCAL)                  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ python3 unified_pipeline_manager.py --prepare            │ │
│ │ → Discovers training_data/*/                             │ │
│ │ → Generates training_manifest.json                       │ │
│ │ → Shows: "Ready for {N} fonts with {M} glyphs"          │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│      Google Colab: train_unified_pipeline.ipynb              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. Upload training_manifest.json                         │ │
│ │ 2. Select fonts to train on                              │ │
│ │ 3. Run cells:                                            │ │
│ │    - Import shared SDF renderer (scripts/sdf.py)         │ │
│ │    - Load fonts from manifest                            │ │
│ │    - Build multi-script dataset                          │ │
│ │    - Train VAE with KL annealing                         │ │
│ │    - Save → font_vae_unified.pt                          │ │
│ │ 4. Download model                                        │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│              LOCAL: models/font_vae_unified.pt               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Copy downloaded model here:                              │ │
│ │ $ cp ~/Downloads/font_vae_unified.pt models/              │ │
│ │                                                          │ │
│ │ Then restart server:                                     │ │
│ │ $ python3 server.py                                      │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│              FLASK SERVER (server.py)                        │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ /api/generate              → Single glyph               │ │
│ │ /api/generate-alphabet     → 26 unique chars             │ │
│ │ /api/encode-font           → Font → latent vector        │ │
│ │ /api/style-grid            → 6×6 latent exploration      │ │
│ │ /api/interpolate           → A → B → C interpolation     │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│            WEBAPP (webapp/js/ai-generator.js)                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ AI Generate Tab:                                         │ │
│ │ • Canvas display of generated glyph                      │ │
│ │ • Sliders for latent dimensions [0..63]                  │ │
│ │ • "Generate" button → /api/generate                      │ │
│ │ • "Alphabet" button → /api/generate-alphabet             │ │
│ │ • "Style Transfer" → encode ref font → apply z           │ │
│ │ • "Interpolate" → morph between fonts                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Workflow

### Phase 1: Collect Fonts (Webapp)

**User actions:**
1. Open webapp → "Explore" tab
2. Search for font (e.g., "Roboto", "Noto Sans Devanagari")
3. Click "Add to Dataset"
4. Repeat for 5-10 fonts (mix of scripts)

**What happens:**
- `webapp/js/app.js` uploads font → `POST /api/dataset/add-font`
- `server.py` endpoint:
  - Decodes base64 TTF → temp file
  - Calls `get_font_unicode_map()` → finds all glyphs
  - Calls `render_sdf()` for each glyph → 64×64 SDF image
  - Saves to `training_data/{font_name}/glyphs.npz`
  - Saves metadata → `training_data/{font_name}/meta.json`

**Example:**
```
training_data/
├── Roboto/
│   ├── glyphs.npz          # [N, 64, 64] array
│   └── meta.json           # {"glyph_count": 450, "scripts": ["Latin"]}
├── Noto_Sans_Devanagari/
│   ├── glyphs.npz
│   └── meta.json
└── Poppins/
    ├── glyphs.npz
    └── meta.json
```

### Phase 2: Prepare for Colab (Local)

**Run locally:**
```bash
python3 unified_pipeline_manager.py --prepare
```

**What happens:**
- Discovers all fonts in `training_data/`
- Generates `training_data/training_manifest.json`:
  ```json
  {
    "fonts": {
      "Roboto": {"glyph_count": 450, "scripts": ["Latin"]},
      "Noto_Sans_Devanagari": {"glyph_count": 350, "scripts": ["Devanagari"]},
      ...
    },
    "total_glyphs": 1200,
    "scripts_to_train": ["Latin", "Devanagari"],
    "recommended_config": {...}
  }
  ```
- Prints status:
  ```
  Stage: collecting
  Fonts collected: 3
  Total glyphs: 1200
  ```

### Phase 3: Train on Colab (Google Colab)

**Download files:**
1. `train_unified_pipeline.ipynb` from repo
2. `training_data/training_manifest.json` from local

**In Colab:**
1. Upload both files
2. Run cells 1-14:
   - Cell 1: Install dependencies
   - Cell 2: Mount Drive (optional)
   - Cell 3: Load manifest → discover fonts
   - Cell 4: Build multi-script dataset using shared `render_sdf()`
   - Cells 5-11: Train VAE with:
     - **KL Annealing**: β starts at 0.0001, increases to 1.0 over 20 epochs
     - **LeakyReLU**: Prevents dead neurons
     - **Latent dim = 64**: Better disentanglement
   - Cell 12: Save trained model → `font_vae_unified.pt`
   - Cell 13: Download model

**Notebook output:**
```
✓ Encoded 1200 samples into latent space (64-dim)
✓ Latent space visualization (PCA): fonts cluster by style
✓ Style space grid: smooth interpolations across latent axes
✓ Model saved: font_vae_unified.pt (45 MB)
```

### Phase 4: Deploy Model (Local)

**After downloading from Colab:**
```bash
# Copy model to local
cp ~/Downloads/font_vae_unified.pt models/

# Verify
ls -la models/font_vae_unified.pt

# Restart Flask server
python3 server.py
# → http://localhost:5001
```

### Phase 5: Use in Webapp (Inference)

**AI Generate tab:**
1. **Generate**: Sliders [0..63] → adjust latent dimensions → "Generate"
   - Calls `/api/generate` with `latent_vector`
   - Returns SDF → rendered on canvas
2. **Alphabet**: "Alphabet" button → `/api/generate-alphabet`
   - Returns all 26 letters (each unique due to char-specific encoding)
   - Click letter to preview in main canvas
3. **Style Transfer**:
   - Upload reference font (e.g., "bold Montserrat")
   - Encode → extract latent style
   - Apply to other characters → see "bold" applied to any glyph
4. **Interpolate**:
   - Select 2 fonts → morph between them in latent space

---

## Configuration: train_unified_pipeline.ipynb

In the notebook, modify `CONFIG` dict (cell 7):

```python
CONFIG = {
    'image_size': 64,              # 64×64 SDF images
    'latent_dim': 64,              # Reduced from 128 for disentanglement
    'batch_size': 32,              # Larger = faster but more VRAM
    'epochs': 100,                 # Full training
    'learning_rate': 1e-3,         # Adam LR
    'beta_start': 0.0001,          # KL annealing start (prevent collapse)
    'beta_end': 1.0,               # KL annealing end (final weight)
    'beta_warmup_epochs': 20,      # How long to anneal (first 20 epochs)
    'scripts': ['Latin', 'Devanagari'],  # Which scripts to support
}
```

**Tuning tips:**
- **KL Collapse**: If KL loss → 0, decrease `beta_warmup_epochs` (e.g., 10)
- **Blurry output**: Increase `epochs` or decrease learning rate
- **Too slow**: Reduce `batch_size` or `epochs`
- **Multi-script quality**: Add more diverse fonts to `training_data/`

---

## Key Improvements Over Previous Approach

### Before
- ❌ Fonts fetched 2 ways (webapp CDN, server GitHub)
- ❌ SDF computed 4 ways (browser, server, train_vae.py, Colab)
- ❌ Training 2 ways (Flask subprocess, manual Colab)
- ❌ No script coordination between uploads and training

### After
- ✅ Single unified SDF renderer: `scripts/sdf.py`
- ✅ Single data pipeline: webapp → training_data → Colab → models/
- ✅ Colab as primary training (GPU-accelerated)
- ✅ Flask as secondary (quick local iteration)
- ✅ Automatic font discovery and manifest generation
- ✅ KL annealing prevents model collapse
- ✅ Multi-script support (Latin + Devanagari + more)
- ✅ Per-character latent encoding for true style transfer

---

## Troubleshooting

### "Training manifest not found"
```bash
# Generate it:
python3 unified_pipeline_manager.py --prepare

# Check fonts were uploaded:
ls -la training_data/
```

### "Model not loading in server"
```bash
# Check model path:
ls -la models/font_vae_unified.pt

# Verify model format:
python3 -c "import torch; m = torch.load('models/font_vae_unified.pt'); print(m.keys())"
# Should print: dict_keys(['model_state_dict', 'config', ...])
```

### "Generated glyphs are blurry"
- **Short-term**: Increase `beta_end` (more KL penalty)
- **Long-term**: Train more epochs or with more fonts

### "KL divergence drops to zero"
- **Posterior collapse**: KL becomes 0, meaning latent space is unused
- **Fix**: Reduce `beta_start` (e.g., 0.00001) or increase `beta_warmup_epochs` (e.g., 30)

### "Devanagari transfer not working"
- Ensure Devanagari font is in `training_data/` before training
- Model must see Devanagari glyphs during training
- Check Colab cell 4 output: "Devanagari: XXX glyphs"

---

## File Structure (Updated)

```
Project Root/
├── train_unified_pipeline.ipynb    ← 🆕 PRIMARY training notebook
├── unified_pipeline_manager.py     ← 🆕 Pipeline orchestration
├── scripts/
│   ├── sdf.py                      ← Unified SDF renderer
│   └── train_vae.py                ← Alternative (local) training
├── server.py                       ← Flask API
├── webapp/
│   ├── index.html
│   ├── js/
│   │   ├── ai-generator.js         ← Fixed for per-char encoding
│   │   └── ...
│   └── css/
├── models/
│   ├── font_vae_unified.pt         ← 🆕 Main trained model
│   └── font_vae3.pt                ← (legacy)
├── training_data/
│   ├── Roboto/
│   │   ├── glyphs.npz
│   │   └── meta.json
│   ├── Noto_Sans_Devanagari/
│   │   ├── glyphs.npz
│   │   └── meta.json
│   └── training_manifest.json      ← 🆕 Generated manifest
└── fonts/
    ├── downloaded/                 ← Auto-downloaded fonts
    └── ...
```

---

## Integration with Server.py

The Flask server (`server.py`) now:

1. **Automatically loads** the latest model from `models/font_vae_unified.pt`
2. **Serves** `/api/pipeline/status` endpoint:
   ```bash
   curl http://localhost:5001/api/pipeline/status
   # Returns: {model_ready: true, fonts_collected: 3, total_glyphs: 1200}
   ```
3. **Supports** `/api/generate`, `/api/generate-alphabet`, etc.
4. **Uses shared SDF** renderer for consistency with Colab

**No changes needed** — just restart Flask after updating `models/font_vae_unified.pt`.

---

## Summary: You Now Have

1. **Unified SDF Rendering** — Single implementation shared everywhere
2. **Single Training Pipeline** — Colab as primary, Flask as secondary
3. **Automatic Font Management** — Webapp collects → manager prepares → Colab trains
4. **Multi-Script Support** — Latin + Devanagari + Arabic + CJK (extensible)
5. **Improved VAE** — KL annealing + LeakyReLU + 64D latent
6. **Per-Character Encoding** — True style transfer to any glyph
7. **Production Ready** — Deploy locally with single model file

**Next:** Collect fonts in webapp → run `unified_pipeline_manager.py --prepare` → train in Colab → download model → use in webapp! 🚀
