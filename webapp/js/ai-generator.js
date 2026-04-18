/**
 * ai-generator.js  —  Fontera Type 01
 * Frontend for the AI font generation system.
 * Connects to Flask server at :5001 for model inference.
 */

const AIGenerator = (() => {

    // Shared runtime config (set in runtime-config.js)
    const API = (window.APP_CONFIG && typeof window.APP_CONFIG.apiBase === 'string')
        ? window.APP_CONFIG.apiBase
        : (window.location.port === '5001' ? '' : 'http://localhost:5001');

    let pollTimer  = null;
    let latentDim  = 32;

    // ── DOM helper ────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    // ── API ───────────────────────────────────────────────────
    async function get(path) {
        const r = await fetch(API + path);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }
    async function post(path, body) {
        const r = await fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
        return data;
    }

    async function fileToBase64(file) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        bindButtons();
        checkStatus();
    }

    // ── Server / model status ─────────────────────────────────
    async function checkStatus() {
        try {
            const info = await get('/api/model-info');
            latentDim  = info.latent_dim || 32;
            setOnline(true);
            renderStatus(info);
        } catch (_) {
            setOnline(false);
        }
    }

    function setOnline(ok) {
        const banner = $('ai-server-banner');
        const ui     = $('ai-main-ui');
        if (banner) banner.style.display = ok ? 'none' : '';
        if (ui)     ui.style.display     = ok ? ''     : 'none';
    }

    function renderStatus(info) {
        const pill    = $('ai-model-status');
        const txt     = $('ai-status-text');
        const ws      = $('ai-workspace');
        const nameLbl = $('ai-model-name-label');

        const ready = info.model_exists || info.trained;

        // Update model version in header
        if (nameLbl) {
            nameLbl.textContent = info.model_version
                ? `Fontera Type ${info.model_version}`
                : 'Fontera Type 01';
            nameLbl.title = info.version_detail || '';
        }

        if (pill) {
            pill.className = 'ai-status-pill ' + (ready ? 'ai-status-ok' : 'ai-status-idle');
        }
        if (txt) {
            txt.textContent = ready
                ? (info.version_detail || `dim ${latentDim} · ${(info.model_size_mb||0).toFixed(1)} MB`)
                : 'No model — train first';
        }
        if (ws) ws.style.display = ready ? '' : 'none';

        if (ready) {
            buildSliders(latentDim);
            const lbl = $('ai-latent-dim-label');
            if (lbl) lbl.textContent = latentDim;
        }

        // If training was in progress, resume polling
        if (info.training_status === 'training') {
            showTrainingPanel();
            startPoll();
        }
    }

    // ── Training ──────────────────────────────────────────────
    function showTrainingPanel() { const p = $('ai-training-panel'); if (p) p.style.display = ''; }
    function hideTrainingPanel() { const p = $('ai-training-panel'); if (p) p.style.display = 'none'; stopPoll(); }

    async function startTraining(quick) {
        const epochs = parseInt($('ai-epochs-input')?.value || '50', 10);
        try {
            showTrainingPanel();
            setTrainingUI({ status: 'training', epoch: 0, total_epochs: epochs,
                            progress: 0, message: quick ? 'Starting quick train…' : 'Downloading fonts…' });
            await post('/api/train/start', { quick, epochs });
            startPoll();
        } catch (e) {
            toast('Could not start: ' + e.message, 'err');
            hideTrainingPanel();
        }
    }

    function startPoll() {
        stopPoll();
        pollTimer = setInterval(async () => {
            try {
                const s = await get('/api/train/status');
                setTrainingUI(s);
                if (s.status === 'complete' || s.status === 'error') {
                    stopPoll();
                    hideTrainingPanel();
                    await checkStatus();
                    if (s.history) drawLoss(s.history);
                    toast(s.status === 'complete' ? 'Training complete!' : 'Training error: ' + (s.message||''),
                          s.status === 'complete' ? 'ok' : 'err');
                }
            } catch (_) {}
        }, 2000);
    }
    function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

    function setTrainingUI(s) {
        const bar = $('ai-progress-bar');
        const lbl = $('ai-progress-label');
        if (bar) bar.style.width = Math.round((s.progress || 0) * 100) + '%';
        if (lbl) {
            if (s.status === 'training') {
                const eta = s.eta ? ` · ETA ${fmtTime(s.eta)}` : '';
                lbl.textContent = `Epoch ${s.epoch||0}/${s.total_epochs||'?'} · loss ${(s.loss||0).toFixed(3)} · recon ${(s.recon_loss||0).toFixed(3)} · KL ${(s.kl_loss||0).toFixed(3)}${eta}`;
            } else {
                lbl.textContent = s.message || s.status;
            }
        }
        // Update status pill while training
        const pill = $('ai-model-status');
        if (pill && s.status === 'training') pill.className = 'ai-status-pill ai-status-training';
        if (s.history) drawLoss(s.history);
    }

    function drawLoss(history) {
        const canvas = $('ai-loss-canvas');
        if (!canvas || !history?.loss?.length) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const pad = { t: 8, r: 8, b: 20, l: 36 };
        const iW = W - pad.l - pad.r;
        const iH = H - pad.t - pad.b;
        ctx.clearRect(0, 0, W, H);

        const allVals = [...(history.loss||[]), ...(history.recon||[]), ...(history.kl||[])];
        const maxV = Math.max(...allVals) * 1.05;
        const minV = Math.min(0, ...allVals);

        const xp = i => pad.l + (i / (history.loss.length - 1 || 1)) * iW;
        const yp = v => pad.t + iH - ((v - minV) / (maxV - minV + 1e-8)) * iH;

        // Axes
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border') || '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + iH);
        ctx.lineTo(pad.l + iW, pad.t + iH);
        ctx.stroke();

        const series = [
            { data: history.loss,  color: '#a78bfa', label: 'loss'  },
            { data: history.recon, color: '#34d399', label: 'recon' },
            { data: history.kl,    color: '#fb923c', label: 'KL'    },
        ];
        series.forEach(({ data, color, label }) => {
            if (!data?.length) return;
            ctx.strokeStyle = color; ctx.lineWidth = 1.5;
            ctx.beginPath();
            data.forEach((v, i) => i === 0 ? ctx.moveTo(xp(i), yp(v)) : ctx.lineTo(xp(i), yp(v)));
            ctx.stroke();
            // Legend dot
            const idx = series.indexOf(series.find(s => s.label === label));
            ctx.fillStyle = color;
            ctx.fillRect(pad.l + idx * 68, 2, 8, 6);
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text2') || '#aaa';
            ctx.font = '10px Inter,sans-serif';
            ctx.fillText(label, pad.l + idx * 68 + 11, 9);
        });
    }

    // ── Latent sliders ────────────────────────────────────────
    function buildSliders(dim) {
        const container = $('ai-latent-sliders');
        if (!container) return;
        container.innerHTML = '';
        const n = Math.min(dim, 12);  // show up to 12 sliders
        for (let i = 0; i < n; i++) {
            const row = document.createElement('div');
            row.className = 'ai-slider-row';
            row.innerHTML = `
                <span class="ai-slider-label">z[${i}]</span>
                <input type="range" class="ai-slider" id="ai-z${i}" min="-3" max="3" step="0.05" value="0">
                <span class="ai-slider-val" id="ai-zv${i}">0.0</span>`;
            container.appendChild(row);
            const s = row.querySelector(`#ai-z${i}`);
            const v = row.querySelector(`#ai-zv${i}`);
            s.addEventListener('input', () => { v.textContent = parseFloat(s.value).toFixed(1); });
        }
    }

    function getZ() {
        const z = new Array(latentDim).fill(0);
        const n = Math.min(latentDim, 12);
        for (let i = 0; i < n; i++) {
            const s = $(`ai-z${i}`);
            if (s) z[i] = parseFloat(s.value);
        }
        return z;
    }

    function randomizeSliders() {
        const n = Math.min(latentDim, 12);
        for (let i = 0; i < n; i++) {
            const s = $(`ai-z${i}`);
            const v = $(`ai-zv${i}`);
            if (!s) continue;
            const val = ((Math.random() - 0.5) * 4).toFixed(2);
            s.value = val;
            if (v) v.textContent = parseFloat(val).toFixed(1);
        }
    }

    // ── Set sliders from a latent vector ─────────────────────
    function setSliders(z) {
        const n = Math.min(z.length, 12);
        for (let i = 0; i < n; i++) {
            const s = $(`ai-z${i}`);
            const v = $(`ai-zv${i}`);
            if (!s) continue;
            const val = Math.max(-3, Math.min(3, z[i]));
            s.value = val.toFixed(2);
            if (v) v.textContent = val.toFixed(1);
        }
    }

    // ── Style transfer: encode a font's glyph ─────────────────
    async function encodeFromFont() {
        const input = $('ai-font-upload');
        if (!input?.files?.[0]) {
            toast('Please select a font file first', 'err');
            return;
        }
        const btn = $('ai-encode-btn');
        if (btn) btn.disabled = true;

        try {
            const file   = input.files[0];
            const b64  = await fileToBase64(file);
            const char = $('ai-encode-char')?.value || 'K';

            const result = await post('/api/encode-font', { font_data: b64, char });

            // Show before/after images
            const out = $('ai-encode-output');
            if (out) out.style.display = '';
            const srcImg = $('ai-encode-src');
            const decImg = $('ai-encode-dec');
            if (srcImg) srcImg.src = result.source_image;
            if (decImg) decImg.src = result.decoded_image;

            // Populate latent sliders from mu
            setSliders(result.latent_vector);

            toast(`Style encoded from "${file.name}". Sliders updated — hit Generate to explore.`, 'ok');
        } catch (e) {
            toast('Encode error: ' + e.message, 'err');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function applyStyleTransfer() {
        const input = $('ai-font-upload');
        if (!input?.files?.[0]) {
            toast('Please select a font file first', 'err');
            return;
        }

        const btn = $('ai-transfer-btn');
        if (btn) btn.disabled = true;

        try {
            const file = input.files[0];
            const b64 = await fileToBase64(file);
            const char = $('ai-encode-char')?.value || 'K';
            const targetStyle = $('ai-target-style')?.value || 'serif';
            const styleStrength = parseFloat($('ai-style-strength')?.value || '1');

            const result = await post('/api/style-transfer', {
                font_data: b64,
                char,
                target_style: targetStyle,
                style_strength: styleStrength,
            });

            const out = $('ai-transfer-output');
            if (out) out.style.display = '';

            const srcImg = $('ai-transfer-src');
            const styledImg = $('ai-transfer-styled');
            const note = $('ai-transfer-note');
            if (srcImg) srcImg.src = result.reconstructed_image || result.source_image;
            if (styledImg) styledImg.src = result.styled_image;
            if (note) {
                const prob = Number.isFinite(result.source_serif_probability)
                    ? `Source serif prob: ${result.source_serif_probability.toFixed(2)}`
                    : 'Source serif prob unavailable';
                note.textContent = `${prob}. Target: ${result.target_style}, strength ${result.style_strength}.`;
            }

            if (result.styled_image) {
                renderToCanvas(result.styled_image, $('ai-gen-canvas'), true);
                const hint = $('ai-canvas-hint');
                if (hint) hint.classList.add('hidden');
            }

            if (result.styled_latent) {
                setSliders(result.styled_latent);
            }

            toast(`Applied ${targetStyle} style transfer to '${char}'.`, 'ok');
        } catch (e) {
            toast('Style transfer error: ' + e.message, 'err');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ── Generate single glyph ─────────────────────────────────
    async function generate() {
        const btn = $('ai-generate-btn');
        if (btn) btn.disabled = true;
        try {
            const result = await post('/api/generate', { latent_vector: getZ() });
            renderToCanvas(result.image, $('ai-gen-canvas'), true);
            // Hide the "Click generate" hint
            const hint = $('ai-canvas-hint');
            if (hint) hint.classList.add('hidden');
        } catch (e) {
            toast('Generate error: ' + e.message, 'err');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function renderToCanvas(dataUri, canvas, whiteBackground) {
        if (!canvas || !dataUri) return;
        const img = new Image();
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (whiteBackground) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = dataUri;
    }

    // ── Generate full alphabet ────────────────────────────────
    async function generateAlphabet() {
        const strip    = $('ai-alphabet-strip');
        const btn      = $('ai-alphabet-btn');
        if (!strip) return;

        const isVisible = strip.style.display !== 'none';
        if (isVisible) { strip.style.display = 'none'; return; }

        strip.style.display = 'grid';
        strip.innerHTML = '<span style="font-size:.75rem;color:var(--text2);grid-column:1/-1;padding:8px 0">Generating A–Z…</span>';
        if (btn) btn.disabled = true;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const z     = getZ();
        const targetStyle = $('ai-target-style')?.value || '';
        const styleStrength = parseFloat($('ai-style-strength')?.value || '1');
        strip.innerHTML = '';

        try {
            // Use the new generate-alphabet endpoint
            // This will encode each character from a default reference (if available)
            // and apply the latent modifier z to it
            const result = await post('/api/generate-alphabet', {
                latent_vector: z,
                chars: chars,
                target_style: targetStyle,
                style_strength: styleStrength,
                // Optionally could pass reference_font here, but let's use default for now
            });

            if (!result.alphabet) {
                throw new Error('No alphabet data returned');
            }

            for (const ch of chars) {
                const cell = document.createElement('div');
                cell.className = 'ai-alpha-cell';
                cell.title = ch;
                
                const imgSrc = result.alphabet[ch];
                if (imgSrc) {
                    const img = document.createElement('img');
                    img.src = imgSrc;
                    cell.appendChild(img);
                    
                    cell.addEventListener('click', () => {
                        const ci = $('ai-char-input');
                        if (ci) ci.value = ch;
                        renderToCanvas(imgSrc, $('ai-gen-canvas'), true);
                        const hint = $('ai-canvas-hint');
                        if (hint) hint.classList.add('hidden');
                        strip.querySelectorAll('.ai-alpha-cell').forEach(c => c.classList.remove('active'));
                        cell.classList.add('active');
                    });
                } else {
                    cell.style.background = 'var(--surface2)';
                    cell.innerHTML = '<span style="color:var(--text2);font-size:.7rem">—</span>';
                }
                strip.appendChild(cell);
            }
        } catch (e) {
            toast('Alphabet error: ' + e.message, 'err');
            strip.innerHTML = '';
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ── Style grid ────────────────────────────────────────────
    async function generateGrid() {
        const btn = $('ai-grid-btn');
        const out = $('ai-grid-output');
        if (!out) return;
        if (btn) btn.disabled = true;
        out.innerHTML = '<div class="ai-grid-loading">Generating…</div>';

        try {
            const dimX = parseInt($('ai-grid-dimx')?.value || '0', 10);
            const dimY = parseInt($('ai-grid-dimy')?.value || '1', 10);
            const gridSize = parseInt($('ai-grid-size')?.value || '6', 10);

            const result = await post('/api/style-grid', {
                dim_x: dimX, dim_y: dimY, grid_size: gridSize, base_z: getZ(),
            });

            out.innerHTML = '';
            out.style.gridTemplateColumns = `repeat(${gridSize}, 72px)`;

            result.images.forEach((row, ri) => {
                row.forEach((src, ci) => {
                    const img = document.createElement('img');
                    img.src = src;
                    img.className = 'ai-grid-cell';
                    img.title = `z[${dimX}]=${((ri/(gridSize-1))*6-3).toFixed(1)}, z[${dimY}]=${((ci/(gridSize-1))*6-3).toFixed(1)}`;
                    img.addEventListener('click', () => {
                        renderToCanvas(src, $('ai-gen-canvas'), true);
                        const hint = $('ai-canvas-hint');
                        if (hint) hint.classList.add('hidden');
                    });
                    out.appendChild(img);
                });
            });
        } catch (e) {
            toast('Grid error: ' + e.message, 'err');
            out.innerHTML = '';
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ── Interpolation ─────────────────────────────────────────
    async function generateInterp() {
        const btn = $('ai-interp-btn');
        const out = $('ai-interp-output');
        if (!out) return;
        if (btn) btn.disabled = true;
        out.innerHTML = '<div class="ai-grid-loading">Interpolating…</div>';

        try {
            const z_a = Array.from({ length: latentDim }, () => (Math.random()-0.5)*4);
            const z_b = Array.from({ length: latentDim }, () => (Math.random()-0.5)*4);
            const result = await post('/api/interpolate', { z_a, z_b, steps: 8 });

            out.innerHTML = '';
            result.images.forEach((src, i) => {
                const step  = document.createElement('div');
                step.className = 'ai-interp-step';
                const img   = document.createElement('img');
                img.src = src; img.className = 'ai-interp-img';
                const lbl   = document.createElement('div');
                lbl.className = 'ai-interp-label';
                lbl.textContent = 'α ' + result.alphas[i].toFixed(2);
                step.appendChild(img); step.appendChild(lbl);
                img.addEventListener('click', () => {
                    renderToCanvas(src, $('ai-gen-canvas'), true);
                    const hint = $('ai-canvas-hint');
                    if (hint) hint.classList.add('hidden');
                });
                out.appendChild(step);
            });
        } catch (e) {
            toast('Interpolation error: ' + e.message, 'err');
            out.innerHTML = '';
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ── Events ────────────────────────────────────────────────
    function bindButtons() {
        on('ai-train-btn',       () => startTraining(false));
        on('ai-quick-train-btn', () => startTraining(true));
        on('ai-stop-btn',        () => post('/api/train/stop', {}).catch(() => {}));
        on('ai-generate-btn',    generate);
        on('ai-random-btn',      () => { randomizeSliders(); generate(); });
        on('ai-alphabet-btn',    generateAlphabet);
        on('ai-grid-btn',        generateGrid);
        on('ai-interp-btn',      generateInterp);
        on('ai-refresh-btn',     checkStatus);
        on('ai-encode-btn',      encodeFromFont);
        on('ai-transfer-btn',    applyStyleTransfer);

        // Style transfer font picker
        const pickBtn   = $('ai-font-pick-btn');
        const fileInput = $('ai-font-upload');
        if (pickBtn && fileInput) {
            pickBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                const name    = fileInput.files?.[0]?.name;
                const lbl     = $('ai-font-name');
                const encBtn  = $('ai-encode-btn');
                const trfBtn  = $('ai-transfer-btn');
                if (lbl)    lbl.textContent = name || 'No font selected';
                if (encBtn) encBtn.disabled = !name;
                if (trfBtn) trfBtn.disabled = !name;
            });
        }

        const strength = $('ai-style-strength');
        const strengthVal = $('ai-style-strength-value');
        if (strength && strengthVal) {
            const syncStrength = () => {
                strengthVal.textContent = parseFloat(strength.value || '1').toFixed(1);
            };
            strength.addEventListener('input', syncStrength);
            syncStrength();
        }

        // Dataset font picker
        on('ai-dataset-add-btn', addFontToDataset);
        const dsPick  = $('ai-dataset-pick-btn');
        const dsInput = $('ai-dataset-upload');
        if (dsPick && dsInput) {
            dsPick.addEventListener('click', () => dsInput.click());
            dsInput.addEventListener('change', () => {
                const name   = dsInput.files?.[0]?.name;
                const lbl    = $('ai-dataset-font-name');
                const addBtn = $('ai-dataset-add-btn');
                if (lbl)    lbl.textContent = name || 'No font selected';
                if (addBtn) addBtn.disabled = !name;
            });
        }

        // Load dataset stats on init
        refreshDatasetStats();
    }

    function on(id, fn) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    // ── Utils ─────────────────────────────────────────────────
    function fmtTime(s) {
        return s < 60 ? `${Math.round(s)}s` : `${Math.floor(s/60)}m${Math.round(s%60)}s`;
    }

    function toast(msg, type) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast' + (type === 'err' ? ' toast-err' : type === 'ok' ? ' toast-ok' : '');
        el.classList.remove('hidden');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.add('hidden'), 4000);
    }

    // ── Dataset collection ────────────────────────────────────
    async function refreshDatasetStats() {
        try {
            const info = await get('/api/dataset/info');
            renderDatasetStats(info);
        } catch (_) {}
    }

    function renderDatasetStats(info) {
        const el = $('ai-dataset-stats');
        if (!el) return;
        if (!info.total_fonts) {
            el.innerHTML = '<div class="ai-dataset-empty">No fonts collected yet. Choose a font below and click Add to Dataset.</div>';
            return;
        }
        const scripts = Object.entries(info.by_script || {})
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `<span class="ai-script-pill">${s} <strong>${n}</strong></span>`)
            .join('');
        el.innerHTML = `
            <div class="ai-dataset-summary">
                <span class="ai-dataset-num">${info.total_fonts}</span><span class="ai-dataset-lbl"> fonts</span>
                <span class="ai-dataset-sep">·</span>
                <span class="ai-dataset-num">${info.total_glyphs.toLocaleString()}</span><span class="ai-dataset-lbl"> glyphs</span>
            </div>
            <div class="ai-script-pills">${scripts}</div>
            <div class="ai-dataset-fonts">${(info.fonts || []).map(f =>
                `<div class="ai-dataset-font-row">
                    <span class="ai-dataset-font-name">${f.name}</span>
                    <span class="ai-dataset-font-count">${f.glyph_count} glyphs</span>
                    <span class="ai-script-pills ai-script-pills-sm">${Object.entries(f.by_script||{}).map(([s,n])=>`<span class="ai-script-pill">${s} ${n}</span>`).join('')}</span>
                </div>`
            ).join('')}</div>`;
    }

    async function addFontToDataset() {
        const input = $('ai-dataset-upload');
        if (!input?.files?.[0]) { toast('Choose a font file first', 'err'); return; }
        const btn = $('ai-dataset-add-btn');
        if (btn) btn.disabled = true;
        btn.textContent = 'Processing…';

        try {
            const file   = input.files[0];
            const buffer = await file.arrayBuffer();
            const bytes  = new Uint8Array(buffer);
            let binary   = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const b64      = btoa(binary);
            const fontName = file.name.replace(/\.[^.]+$/, '');

            const result = await post('/api/dataset/add-font', { font_data: b64, font_name: fontName });

            // Show result
            const out = $('ai-dataset-result');
            if (out) out.style.display = '';

            const txt = $('ai-dataset-result-text');
            if (txt) {
                const byScript = Object.entries(result.by_script || {})
                    .sort((a,b) => b[1]-a[1])
                    .map(([s,n]) => `<span class="ai-script-pill">${s} <strong>${n}</strong></span>`)
                    .join('');
                txt.innerHTML = `<strong>${result.font_name}</strong> — ${result.glyph_count} glyphs collected
                    <span style="color:var(--text2);font-size:.75rem"> (${result.total_in_font} in font)</span><br>
                    <div class="ai-script-pills" style="margin-top:6px">${byScript}</div>`;
            }

            // Sample preview images
            const samples = $('ai-dataset-samples');
            if (samples) {
                samples.innerHTML = (result.sample_images || []).map(src =>
                    `<img src="${src}" class="ai-dataset-sample-img" title="sample glyph">`
                ).join('');
            }

            // Characters preview
            const chars = $('ai-dataset-chars');
            if (chars) {
                chars.textContent = (result.chars_preview || []).join('  ');
            }

            await refreshDatasetStats();
            toast(`Added ${result.font_name}: ${result.glyph_count} glyphs across ${Object.keys(result.by_script||{}).length} scripts`, 'ok');
        } catch (e) {
            toast('Dataset error: ' + e.message, 'err');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '+ Add to Dataset'; }
        }
    }

    return { init, checkStatus };
})();

// Init on load + re-check status when tab is switched to
document.addEventListener('DOMContentLoaded', () => {
    AIGenerator.init();
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'ai-generate') AIGenerator.checkStatus();
        });
    });
});
