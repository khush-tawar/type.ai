# GitHub Pages Deployment Guide

## Overview

This guide covers deploying the Font Analyzer webapp to **GitHub Pages** (free static hosting).

### ⚠️ Important Limitation

GitHub Pages is **static hosting only** - it cannot run Python/Flask server code. This means:

| Component | GitHub Pages | Alternative |
|-----------|--------------|-------------|
| Frontend (HTML/CSS/JS) | ✅ YES | ✅ Works |
| Model inference (Python) | ❌ NO | Use AWS Lambda / Google Cloud |
| Font generation | ⚠️ Partial | JavaScript-based only |
| Unicode mapping | ⚠️ Partial | JavaScript implementation needed |

---

## Deployment Options

### Option 1: Static Frontend Only (GitHub Pages + Cloud API)

```
┌─────────────────────────────────┐
│   GitHub Pages (Frontend)       │
│   ├─ index.html                 │
│   ├─ css/style.css              │
│   └─ js/                         │
│       ├─ app.js                 │
│       ├─ model-manager.js       │
│       └─ ...                    │
└──────────────┬──────────────────┘
               │
               │ HTTPS Requests
               ▼
        ┌──────────────────┐
        │  Cloud API Server│
        │  (Lambda/Cloud Fn)
        │  - /api/models/* │
        │  - /api/generate │
        │  - /api/download │
        └──────────────────┘
```

**Pros**: Free hosting, scalable, no server maintenance  
**Cons**: Need cloud provider account, API latency

---

### Option 2: Full Stack (Heroku / Railway / AWS)

Deploy entire Flask + frontend to a managed service.

**Services**:
- **Heroku** (free tier ended)
- **Railway.app** ($5/month)
- **Render.com** (free with ads)
- **AWS EC2** ($5-20/month)
- **DigitalOcean** ($6/month)

---

### Option 3: Hybrid (GitHub Pages + GitHub Actions + Webhook)

Use GitHub Actions to:
1. Train models in Colab
2. Trigger API deployment on model release
3. Serve frontend from Pages, API from Actions (limited)

---

## Setup: GitHub Pages + Static Frontend

### Step 1: Enable GitHub Pages

```bash
# 1. Go to your GitHub repo
# 2. Settings → Pages
# 3. Set Source to: "Deploy from branch"
# 4. Select branch: main
# 5. Select folder: docs
# 6. Save
```

### Step 2: Copy Webapp to `docs/` Folder

```bash
# Create docs folder if it doesn't exist
mkdir -p docs

# Copy all frontend files
cp -r webapp/* docs/

# Verify
ls -la docs/
# Should show: index.html, css/, js/
```

### Step 3: Create Python API Compatibility Layer

Since GitHub Pages can't run Flask, create a JavaScript-only fallback:

```javascript
// js/api-stub.js - Runs locally without backend
const APIStub = {
  async listModels() {
    return {
      models: [
        { version: 'v0', created_at: '2026-04-15' },
        { version: 'v1', created_at: '2026-04-16' }
      ]
    };
  },
  
  async generateFont(model, font, chars) {
    // For demo: return placeholder
    return { glyphs: [] };
  }
};

// In model-manager.js, use:
const API = window.location.hostname === 'localhost' 
  ? APIStub  // Local fallback
  : /* real API endpoint */;
```

### Step 4: Configure for Static API Calls

Update model-manager.js to handle missing backend:

```javascript
const loadModels = async () => {
  try {
    const response = await fetch('/api/models/list');
    // ...
  } catch (error) {
    // Fallback if no API available
    showDemoModels();
  }
};

const showDemoModels = () => {
  // Show example models without API
  const demoModels = [
    { version: 'v0', created_at: '2026-04-15' },
    { version: 'v1', created_at: '2026-04-16' },
    { version: 'v2', created_at: '2026-04-17' }
  ];
  populateDropdown('model-select', demoModels);
};
```

### Step 5: Update `docs/index.html` for GitHub Pages

```html
<!-- Ensure all paths are relative -->
<script src="js/model-manager.js?v=1"></script>

<!-- For GitHub Pages, use this URL in API calls -->
<script>
window.API_URL = 'https://api.yourdomain.com';
// or for local development:
// window.API_URL = 'http://localhost:5001';
</script>
```

### Step 6: Push to GitHub

```bash
git add .
git commit -m "Deploy to GitHub Pages with static frontend"
git push origin main
```

GitHub will automatically:
1. Run the `.github/workflows/deploy.yml` workflow
2. Copy `docs/` folder to GitHub Pages
3. Publish at: `https://yourusername.github.io/yourrepo`

---

## API Connectivity (Optional)

### For Full Functionality, Deploy API Server Separately

**Option A: Railway.app**
```bash
# 1. Push code to GitHub
# 2. Go to https://railway.app
# 3. New Project → GitHub Repo
# 4. Deploy flask/server.py
# 5. Get API URL: https://your-app.railway.app
# 6. Update API_URL in index.html
```

**Option B: Google Cloud Run**
```bash
# 1. Create Dockerfile (in root):
FROM python:3.10
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "server.py"]

# 2. Deploy:
gcloud run deploy font-analyzer --source . --platform managed --region us-central1

# 3. Get URL, update index.html
```

**Option C: AWS Lambda + API Gateway**
```bash
# Package Flask app for Lambda
pip install zappa

# Initialize:
zappa init

# Deploy:
zappa deploy production

# Get endpoint, update API_URL
```

---

## Multi-Model + Font Download Feature

### Frontend (GitHub Pages)

```javascript
// js/font-generator.js
class FontGenerator {
  async generateFont(model, fontName, characters) {
    // Call backend API
    const response = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_version: model,
        font_name: fontName,
        characters: characters,
        include_unicode_mapping: true
      })
    });
    
    return response.arrayBuffer(); // TTF/OTF binary
  }
  
  downloadFont(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }
}

// Usage:
const generator = new FontGenerator();
const fontBuffer = await generator.generateFont('v2', 'Roboto', 'Hello');
generator.downloadFont(fontBuffer, 'generated-font.ttf');
```

### Backend (Separate API Server)

See next section: **Font Generation with Unicode Mapping**

---

## Checklist

- [ ] Enable GitHub Pages in repo settings
- [ ] Create `/docs` folder
- [ ] Copy `webapp/` contents to `docs/`
- [ ] Commit and push
- [ ] Check: `https://yourusername.github.io/yourrepo`
- [ ] Deploy API server (if needed)
- [ ] Update `API_URL` in index.html
- [ ] Test model selection works
- [ ] Test font generation (if API connected)

---

## Troubleshooting

### Pages not showing
- Check Settings → Pages → Source is set to `docs`
- Wait 1-2 minutes for GitHub to build
- Check Actions tab for any errors

### API calls failing
- Open DevTools (F12) → Console
- Check CORS headers if calling external API
- Use `fetch(...).catch(e => console.error(e))`
- Test API manually: `curl https://api.url/api/models/list`

### Styles not loading
- Ensure paths are relative: `css/style.css` not `/css/style.css`
- Check DevTools → Network tab
- Verify files exist in `docs/` folder

---

## Next: Font Generation with Unicode Mapping

Once API is deployed, see [Font Generation Guide](FONT_GENERATION.md)

