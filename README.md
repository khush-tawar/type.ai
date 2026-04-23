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

## ☁️ Train On Colab, Use In App

### A. Colab Setup

1. Open a GPU notebook in Colab.
2. Clone your repo and install dependencies:

```bash
!git clone https://github.com/<your-user>/<your-repo>.git
%cd <your-repo>
!pip install -r requirements.txt
```

3. Put your fonts into a folder (for example `fonts/downloaded`).
4. Build precomputed training data:

```bash
!python scripts/build_training_data.py --fonts-dir fonts/downloaded --max-chars-per-font 768
```

5. Train:

```bash
!python scripts/train_vae.py --epochs 50 --batch-size 24 --latent-dim 64 --beta 1.0 --style-weight 0.6 --center-weight 0.08 --char-mode unicode --max-chars-per-font 768
```

### B. Download Artifacts From Colab

Download these from Colab after training:

- `models/font_vae3.pt`
- `models/font_vae.pt`
- `models/font_vae_unified.pt`
- `models/model_registry.json`
- `models/versions/` (entire folder)

### C. Copy Artifacts Into Local App

On your local machine, place the files in the same paths inside this project.

Then start or restart the app server:

```bash
./run_server.sh
```

### D. Verify In The App

1. Open the app at `http://localhost:5001`.
2. Check model list endpoint:

```bash
curl http://localhost:5001/api/models/list
```

3. In the app header, choose your new model from the Model dropdown.
4. Generate with different characters (A/B/C/Z) and confirm source preview + output both change.

### E. If Model Does Not Show Up

- Ensure `models/model_registry.json` includes your new version.
- Ensure the version file exists under `models/versions/<version>/font_vae.pt`.
- Ensure `models/font_vae3.pt` exists (server default active model file).
- Restart server after replacing files.

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
