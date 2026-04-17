# Setup & Deployment Guide

## 🚀 Local Setup (5 minutes)

### Prerequisites
```bash
# Python 3.8+
python3 --version

# Install dependencies
pip install -r requirements.txt
```

### Start the App
```bash
python3 server.py
# Server running on http://localhost:5001
```

### Test It
1. Open http://localhost:5001
2. Look for **Model** and **Font** dropdowns in header
3. Try selecting different models/fonts
4. Check browser console (F12) for errors

---

## 🚢 Deploy to GitHub Pages (10 minutes)

### Step 1: Create `docs` folder with webapp
```bash
mkdir -p docs
cp -r webapp/* docs/
```

### Step 2: Commit & Push
```bash
git add docs/
git commit -m "Deploy to GitHub Pages"
git push origin main
```

### Step 3: Enable Pages in GitHub
1. Go to your repo → **Settings** → **Pages**
2. Select **Source**: `main` branch / `docs` folder
3. Wait 1-2 minutes
4. Visit: `https://<username>.github.io/<repo>/`

### Step 4: Update API URL (if needed)
If API is separate from UI, edit `webapp/js/model-manager.js`:
```javascript
const API = 'https://your-api.railway.app';  // Change this
```

---

## 🌐 Deploy Server to Railway (10 minutes, free tier available)

### Step 1: Create Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub
- Connect your repo

### Step 2: Create Python Service
- **New** → **GitHub Repo** → Select your repo
- Set **Start Command**: `python3 server.py`

### Step 3: Set Environment
- Add env var: `FLASK_ENV=production`

### Step 4: Deploy
- Railway auto-deploys on push
- Your API URL: `https://yourapp-prod.railway.app`
- Update `docs/` webapp with this URL

### Your full stack:
```
Frontend:     https://user.github.io/repo/ (GitHub Pages)
Backend API:  https://yourapp-prod.railway.app (Railway)
```

---

## 🐳 Docker Deployment (Optional)

### Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python3", "server.py"]
```

### Build & Run:
```bash
docker build -t font-ai .
docker run -p 5001:5001 font-ai
```

### Push to Docker Hub:
```bash
docker tag font-ai yourusername/font-ai
docker push yourusername/font-ai
```

---

## ⚠️ Troubleshooting

### **Model dropdown not showing?**
1. Check server is running: `python3 server.py`
2. Check API: `curl http://localhost:5001/api/models/list`
3. Check browser console (F12) for JavaScript errors
4. Verify `model-manager.js` is loaded (F12 → Network tab)

### **Font dropdown not showing?**
1. Check fonts exist: `ls training_data/`
2. Check manifest: `cat training_data/training_manifest.json`
3. Check API: `curl http://localhost:5001/api/pipeline/status`

### **GitHub Pages shows only blank page?**
1. Check `docs/index.html` exists
2. Check JS paths are relative: `js/app.js` not `/js/app.js`
3. Check GitHub Pages is enabled in Settings

### **Railway deployment fails?**
1. Check start command: `python3 server.py`
2. Check port: Flask uses `5001` by default
3. Check logs in Railway dashboard

---

## 📋 Checklist

- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Server starts: `python3 server.py`
- [ ] Local working: http://localhost:5001
- [ ] Model dropdown visible
- [ ] Font dropdown visible
- [ ] Can select different models
- [ ] Can select different fonts
- [ ] Dropdowns sync with API
- [ ] No console errors (F12)
- [ ] Ready to deploy to GitHub Pages

---

## Next Steps

1. ✅ Get local working first
2. ✅ Test model/font selection
3. ✅ Deploy to GitHub Pages
4. ⏳ Implement font generation (see [FONT_GENERATION.md](FONT_GENERATION.md))
