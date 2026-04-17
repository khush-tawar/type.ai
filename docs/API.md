# API Reference

## Core Endpoints

### List Available Models
```
GET /api/models/list
```

**Response:**
```json
{
  "models": [
    {
      "version": "v2",
      "created_at": "2024-04-17",
      "status": "active",
      "checkpoint_size_mb": 45.2
    },
    {
      "version": "v1",
      "created_at": "2024-04-10",
      "status": "active",
      "checkpoint_size_mb": 45.0
    }
  ],
  "latest": "v2",
  "total": 2
}
```

---

### Get System Status
```
GET /api/pipeline/status
```

**Response:**
```json
{
  "fonts_collected": 3,
  "font_names": ["Roboto", "Hind", "Montserrat"],
  "models_available": 2,
  "latest_model": "v2",
  "manifest_exists": true,
  "ready_for_training": true
}
```

---

### Switch Active Model
```
POST /api/models/{version}/set
Content-Type: application/json

{}
```

**Example:**
```bash
curl -X POST http://localhost:5001/api/models/v2/set
```

**Response:**
```json
{
  "success": true,
  "active_model": "v2",
  "model_path": "models/versions/v2/model.pt",
  "message": "Model v2 activated"
}
```

**Status Codes:**
- `200` ✓ Success
- `404` ✗ Model not found
- `500` ✗ Error loading model

---

## Generation Endpoint

### Generate Font
```
POST /api/generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "mode": "preset|custom|range",
  "preset": "latin|devanagari|arabic|cjk",
  "text": "Hello World",
  "start_code": 65,
  "end_code": 90,
  "font_name": "MyFont.ttf",
  "model_version": "v2",
  "base_font": "fonts/Roboto/static/Roboto-Regular.ttf"
}
```

**Response:**
- **Success (200)**: Binary TTF file for download
- **Error (400)**: `{"error": "Invalid mode"}`
- **Error (500)**: `{"error": "Model loading failed"}`

**Examples:**

**1. Generate Latin preset:**
```bash
curl -X POST http://localhost:5001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preset",
    "preset": "latin",
    "font_name": "Latin.ttf"
  }' \
  > Latin.ttf
```

**2. Generate custom text:**
```bash
curl -X POST http://localhost:5001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "custom",
    "text": "Hello Khush",
    "font_name": "Custom.ttf"
  }' \
  > Custom.ttf
```

**3. Generate unicode range:**
```bash
curl -X POST http://localhost:5001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "range",
    "start_code": 65,
    "end_code": 90,
    "font_name": "Range.ttf"
  }' \
  > Range.ttf
```

---

## Model Management (Command Line)

### List Models
```bash
python3 unified_pipeline_manager.py --list-models
```

**Output:**
```
Available Models:
├─ v2  (latest) - 4 days ago
├─ v1  - 11 days ago
└─ v0  - 18 days ago
```

---

### Get Model Info
```bash
python3 unified_pipeline_manager.py --info v2
```

**Output:**
```
Model: v2
├─ Status: active
├─ Created: 2024-04-17
├─ File: models/versions/v2/model.pt
├─ Size: 45.2 MB
├─ Latent Dim: 128
└─ Trained On: Roboto, Hind
```

---

### Register New Model
```bash
python3 unified_pipeline_manager.py --register-model ./trained_model.pt v3
```

**Output:**
```
✓ Model v3 registered
  Path: models/versions/v3/model.pt
  Size: 45.5 MB
  Status: active (latest)
```

---

### Check Pipeline Status
```bash
python3 unified_pipeline_manager.py --status
```

**Output:**
```
Pipeline Status:
├─ Fonts Collected: 3
│  ├─ Roboto
│  ├─ Hind
│  └─ Montserrat
├─ Models Available: 2
│  ├─ v2 (latest)
│  └─ v1
├─ Training Data: ✓ manifest.json ready
└─ Ready for Training: Yes
```

---

### Prepare Manifest
```bash
python3 unified_pipeline_manager.py --prepare
```

**Creates:** `training_data/training_manifest.json`

**Output:**
```
✓ Training manifest created
  Fonts: 3
  Glyphs per font: ~1000
  Ready for Colab training
```

---

## JavaScript API (Browser)

### Load Models
```javascript
const models = await ModelManager.loadModels();
console.log(models);
// Output: [{ version: "v2" }, { version: "v1" }]
```

---

### Load Fonts
```javascript
const fonts = await ModelManager.loadFonts();
console.log(fonts);
// Output: ["Roboto", "Hind", "Montserrat"]
```

---

### Switch Model
```javascript
await ModelManager.switchModel('v2');
console.log(ModelManager.getCurrentModel());
// Output: "v2"
```

---

### Get Current State
```javascript
const model = ModelManager.getCurrentModel();
const font = ModelManager.getCurrentFont();
console.log(`Using ${model} with ${font}`);
```

---

## Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 400 | Bad request | Check JSON syntax |
| 404 | Not found | Model/file doesn't exist |
| 500 | Server error | Check server logs |
| 503 | Service unavailable | Server not running |

---

## Test Checklist

- [ ] Server running: `python3 server.py`
- [ ] GET `/api/models/list` returns models
- [ ] GET `/api/pipeline/status` returns fonts
- [ ] POST `/api/models/v2/set` switches model
- [ ] Browser shows model dropdown populated
- [ ] Browser shows font dropdown populated
- [ ] Can select different models
- [ ] Can select different fonts
- [ ] No console errors (F12)
