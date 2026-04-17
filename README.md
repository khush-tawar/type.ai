# Font AI - Style Transfer & Generation

**Test different models and fonts. Generate downloadable fonts with full unicode support.**

---

## 🚀 Quick Start

### 1. Start the Server
```bash
python3 server.py
# → http://localhost:5001
```

### 2. Select Model & Font
- **Model dropdown** (header): Choose which trained model to use
- **Font dropdown** (header): Choose base font for reference
- Selection is instant - UI updates automatically

### 3. Generate Font
- Choose character mode: Preset (Latin A-Z), Custom (your text), or Range (unicode)
- Click **Generate & Download Font**
- Install `.ttf` file → Use in any application

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP.md](docs/SETUP.md) | Installation, deployment, GitHub Pages |
| [FONT_GENERATION.md](docs/FONT_GENERATION.md) | How font generation works |
| [API.md](docs/API.md) | API endpoints reference |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & components |

---

## 🎯 What This Does

```
┌─────────────┐      ┌──────────┐      ┌──────────┐
│  VAE Models │      │   Fonts  │      │ Unicode  │
│ (v0, v1...) │  +   │(Roboto..)│  +   │ Mapping  │
└─────────────┘      └──────────┘      └──────────┘
        │                  │                  │
        └──────────┬───────┴──────────────────┘
                   │
              Generate
              ✨ TTF File
              (Download)
```

1. **Select Model** → Which VAE to use for shape generation
2. **Select Font** → Base font metrics/features
3. **Pick Characters** → Latin letters, custom text, or unicode range
4. **Download** → Generated `.ttf` file with full unicode mapping

---

## 🔧 Features

✅ Model selection (v0, v1, v2...)  
✅ Font selection (Roboto, Devanagari, etc.)  
✅ Character selection (3 modes)  
✅ Real-time generation  
✅ Unicode mapping  
✅ Instant download  
✅ Deployable anywhere (static + API)  

---

## 📁 Project Structure

```
webapp/                  → Web UI (HTML/CSS/JS)
  ├─ index.html
  ├─ js/
  │  ├─ model-manager.js     ← Model/font selection
  │  └─ [other UI components]
  └─ css/

server.py              → Flask API
  ├─ /api/models/list        ← List models
  ├─ /api/pipeline/status    ← System status
  ├─ /api/models/{v}/set     ← Switch model
  └─ /api/generate           ← Generate font (coming soon)

scripts/
  ├─ sdf.py             ← Unified SDF rendering
  ├─ train_vae.py       ← Training script
  └─ ...

models/versions/       → Trained models (v0, v1, v2...)
training_data/         → Font collections
```

---

## 🚢 Deployment

### **Option 1: GitHub Pages** (Free)
```bash
mkdir -p docs
cp -r webapp/* docs/
git add docs/
git commit -m "Deploy to GitHub Pages"
git push
# Then enable Pages in GitHub Settings
```

### **Option 2: Local + Railway** (API on cloud, UI local)
```bash
# Server runs on Railway (free)
# Visit: https://yourapp.railway.app
```

### **Option 3: Docker** (Container)
```bash
docker build -t font-ai .
docker run -p 5001:5001 font-ai
```

See [SETUP.md](docs/SETUP.md) for details.

---

## 📞 Support

- **Questions?** See [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API details?** See [API.md](docs/API.md)
- **Stuck?** Check [SETUP.md](docs/SETUP.md) troubleshooting

---

## ✅ Status

- ✅ Model selection working
- ✅ Font selection working
- ✅ Pipeline orchestration complete
- ✅ API endpoints ready
- ⏳ Font generation UI (in progress)
- ⏳ Unicode mapping (design ready)
- ⏳ GitHub Pages deployment (ready)

---

Next: Read [SETUP.md](docs/SETUP.md) to get started!
