# System Architecture

## 🏗️ Overall Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browser (UI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Model Selector (v0, v1, v2...)│   Font Selector│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│           │                │                  │             │
│           └────────────────┼──────────────────┘             │
│                            │                                 │
│                  API (HTTP JSON)                            │
└────────────────────────────┼──────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────┐
│                   Flask Server (API)                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  /api/models/list           → List all models       │ │
│  │  /api/models/{v}/set        → Switch model          │ │
│  │  /api/pipeline/status       → System status         │ │
│  │  /api/generate              → Generate font         │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Model Manager                          │ │
│  │  ├─ Load model from disk                            │ │
│  │  ├─ Switch active model                             │ │
│  │  └─ Cache loaded models                             │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            Font Generator                           │ │
│  │  ├─ Encode char with VAE                            │ │
│  │  ├─ Decode to SVG/glyph                             │ │
│  │  ├─ Map unicode → glyph                             │ │
│  │  └─ Create TTF file                                 │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────────┬──────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────┐
│                     File System                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  models/                                             │ │
│  │  ├─ versions/v0/model.pt                            │ │
│  │  ├─ versions/v1/model.pt                            │ │
│  │  ├─ versions/v2/model.pt    ← Latest               │ │
│  │  └─ font_vae_unified.pt     → Symlink to v2        │ │
│  ├─ training_data/                                      │ │
│  │  ├─ Roboto/      → Font collection 1               │ │
│  │  ├─ Hind/        → Font collection 2               │ │
│  │  └─ Montserrat/  → Font collection 3               │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

### Essentials (In Use)
```
webapp/                      → Web UI
├─ index.html              → Main page with dropdowns
├─ js/
│  ├─ app.js               → Main app logic
│  ├─ model-manager.js     → Model/font selection
│  ├─ ai-generator.js      → Font generation UI
│  └─ [other components]
└─ css/
   └─ style.css            → All styling

server.py                   → Flask API (+ model management)
unified_pipeline_manager.py → Training orchestration

scripts/
├─ sdf.py                  → Unified SDF rendering
├─ train_vae.py            → VAE training
└─ [preprocessing scripts]

models/                     → Model checkpoints
├─ versions/
│  ├─ v0/model.pt
│  ├─ v1/model.pt
│  └─ v2/model.pt          ← Latest
└─ font_vae_unified.pt      → Symlink to latest

training_data/             → Font collections
├─ Roboto/
├─ Hind/
└─ Montserrat/

requirements.txt           → Python dependencies
```

### Documentation (Reference)
```
docs/
├─ SETUP.md                → Installation & deployment
├─ FONT_GENERATION.md      → Font gen implementation
├─ API.md                  → API reference
└─ ARCHITECTURE.md         → This file

README.md                   → Entry point
```

### Archive (Not Used)
```
_archive/                   → Old documentation
├─ AGENTS.md
├─ MODEL_TESTING.md
└─ [other outdated docs]
```

---

## 🔄 Data Flow: Model Selection

```
User clicks dropdown
        ↓
model-manager.js loads via AJAX
        ↓
GET /api/models/list
        ↓
server.py queries ModelRegistry
        ↓
Returns JSON: [{v0}, {v1}, {v2}]
        ↓
JavaScript populates <select>
        ↓
User selects "v2"
        ↓
POST /api/models/v2/set
        ↓
server.py:
  1. Validate v2 exists
  2. Copy models/versions/v2/model.pt → font_vae_unified.pt
  3. Reset model cache (reload on next request)
  4. Return success
        ↓
JavaScript updates UI
        ↓
Next inference uses v2 model ✓
```

---

## 🎨 Data Flow: Font Generation

```
User clicks "Generate"
        ↓
Collect: mode, characters, model, font
        ↓
POST /api/generate {mode, chars, model, font}
        ↓
Server: FontGenerator.generate_from_text("Hello")
        │
        ├─ For each character:
        │  ├─ Render reference from base font
        │  ├─ Encode through VAE: img → latent
        │  ├─ Decode through VAE: latent → glyph
        │  └─ Store: unicode → glyph mapping
        │
        └─ Create TTF file with:
           ├─ All glyphs in font
           ├─ Unicode mapping (cmap table)
           ├─ Metrics (from base font)
           └─ Ready for download
        ↓
Return TTF file
        ↓
Browser downloads
        ↓
User installs → Works immediately ✓
```

---

## 🔑 Key Components

### ModelRegistry (Python)
**File:** `unified_pipeline_manager.py`

Manages model versioning with JSON persistence:
- `register_model()` - Register new trained model as v3
- `list_models()` - Get all available models
- `get_latest()` - Get latest version
- `get_model_info()` - Get metadata for version

**Storage:** `models/model_registry.json`

---

### FontGenerator (Python)
**File:** `server.py` (to be added)

Generates fonts with unicode mapping:
- `generate_from_text()` - From custom text
- `generate_from_preset()` - From preset (Latin, etc.)
- `generate_from_range()` - From unicode range
- `create_font()` - Creates TTF with proper mapping

**Uses:**
- VAE model (PyTorch)
- Base font (TTF reference)
- fontTools library

---

### ModelManager (JavaScript)
**File:** `webapp/js/model-manager.js`

Manages UI dropdowns and API communication:
- `loadModels()` - Fetch from `/api/models/list`
- `loadFonts()` - Fetch from `/api/pipeline/status`
- `switchModel()` - Call `/api/models/{v}/set`
- `getCurrentModel()` - Get selected model
- `getCurrentFont()` - Get selected font

**DOM Elements:**
- `#model-select` - Dropdown
- `#font-select` - Dropdown
- `#model-status` - Status display

---

### Flask API
**File:** `server.py`

Core endpoints:
- `GET /api/models/list` - List all models
- `POST /api/models/{v}/set` - Switch model
- `GET /api/pipeline/status` - System status
- `POST /api/generate` - Generate font (TBD)

---

## 🎯 Unicode Mapping

Critical for fonts to work correctly.

**Problem:** Without mapping, user types 'A' but gets random glyph.

**Solution:** Create `cmap` table (character map):
```
U+0041 (letter A)      → Glyph Index 1
U+0042 (letter B)      → Glyph Index 2
U+0043 (letter C)      → Glyph Index 3
...
```

**When user types 'A':**
1. Computer: "A = U+0041"
2. Look up: "U+0041 → Glyph 1"
3. Display: Glyph 1 (the 'A' shape) ✓

fontTools library handles this automatically via:
```python
font['cmap'].getcmap(3, 1).cmap = {0x0041: 'A', ...}
```

---

## 🚀 Deployment Architecture

### GitHub Pages (Frontend)
```
docs/
├─ index.html
├─ js/
└─ css/
    ↓
GitHub Pages
    ↓
https://user.github.io/repo/
```

### Railway or Local (Backend)
```
server.py
    ↓
Railway / Docker / Local Machine
    ↓
https://api.railway.app/ or http://localhost:5001/
```

### Configuration
```javascript
// In webapp/js/model-manager.js
const API = process.env.NODE_ENV === 'production' 
  ? 'https://api.railway.app'
  : 'http://localhost:5001';
```

---

## ✅ Scalability

**Can handle:**
- ✅ 100+ models (versioned in `models/versions/`)
- ✅ 50+ fonts (auto-discovered in `training_data/`)
- ✅ 10,000+ glyphs per font
- ✅ 1000+ API requests/hour (depends on server)

**Bottleneck:** Model loading time (first generation after switch ~2-5s)

**Optimization:** Cache models in memory across requests

---

## 🐛 Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Dropdowns empty | API not responding | Check server running |
| Model switch fails | Wrong version path | Check `models/versions/` |
| Font gen slow | Model too large | Optimize VAE size |
| TTF download fails | Glyph gen error | Check model output |
| Fonts look wrong | Bad unicode mapping | Verify cmap table |

---

## 📚 Further Reading

- [SETUP.md](SETUP.md) - How to run locally
- [FONT_GENERATION.md](FONT_GENERATION.md) - Implementation details
- [API.md](API.md) - All endpoints
