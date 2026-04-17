/**
 * app.js — Main application controller
 * Wires up all modules: FontAnalyzer, FontRenderer, FontMorpher, FontConvolution, GoogleFonts
 */
(() => {
    'use strict';

    /* ══════════════════════════════════════════════════════════════
       STATE
    ══════════════════════════════════════════════════════════════ */
    let currentFont = null;
    let currentFontName = '';
    let morphAxisValues = {};
    let styleMatrixMeta = null;
    let _listenersInitAnalysis = false;
    let _listenersInitMorph = false;
    let _listenersInitGlyphSearch = false;
    let _listenersInitConvExport = false;
    let convResults = null;
    let _convHasRun = false;

    /* ══════════════════════════════════════════════════════════════
       DOM REFERENCES
    ══════════════════════════════════════════════════════════════ */
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    /* ══════════════════════════════════════════════════════════════
       THEME TOGGLE
    ══════════════════════════════════════════════════════════════ */
    $('themeToggle').addEventListener('click', () => {
        const html = document.documentElement;
        html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', html.dataset.theme);
    });
    if (localStorage.getItem('theme')) document.documentElement.dataset.theme = localStorage.getItem('theme');

    /* ══════════════════════════════════════════════════════════════
       TABS
    ══════════════════════════════════════════════════════════════ */
    for (const tab of $$('.tab')) {
        tab.addEventListener('click', () => {
            if (tab.disabled) return;
            $$('.tab').forEach(t => t.classList.remove('active'));
            $$('.tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $(`tab-${tab.dataset.tab}`).classList.add('active');
            // Show remix banner only on morphing tab
            const banner = $('remixSheet');
            if (banner) banner.style.display = tab.dataset.tab === 'morphing' ? '' : 'none';
            // Auto-run convolution when switching to convolution tab
            if (tab.dataset.tab === 'convolution' && currentFont && !_convHasRun) {
                setTimeout(runConvolution, 50);
            }
        });
    }

    function enableTabs() {
        $$('.tab').forEach(t => t.disabled = false);
    }

    function switchTab(name) {
        $$('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === name);
        });
        $$('.tab-content').forEach(t => {
            t.classList.toggle('active', t.id === `tab-${name}`);
        });
        // Show remix banner only on morphing tab
        const banner = $('remixSheet');
        if (banner) banner.style.display = name === 'morphing' ? '' : 'none';
    }

    /* ══════════════════════════════════════════════════════════════
       TOAST
    ══════════════════════════════════════════════════════════════ */
    function toast(msg, type = 'success') {
        const t = $('toast');
        t.textContent = msg;
        t.className = `toast ${type}`;
        t.classList.remove('hidden');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
    }

    /* ══════════════════════════════════════════════════════════════
       FILE UPLOAD
    ══════════════════════════════════════════════════════════════ */
    const dropZone = $('dropZone');
    const fileInput = $('fontFileInput');
    $('browseBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFontFile(e.target.files[0]); });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) loadFontFile(e.dataTransfer.files[0]);
    });

    async function loadFontFile(file) {
        showLoading('Parsing font file...');
        try {
            console.log('[App] loadFontFile:', file.name, file.size, 'bytes');
            if (file.name.toLowerCase().endsWith('.woff2')) {
                toast('WOFF2 files are not supported. Please use .ttf, .otf, or .woff format.', 'error');
                hideLoading();
                return;
            }
            const buf = await file.arrayBuffer();
            const font = opentype.parse(buf);
            if (!font || !font.glyphs) throw new Error('Invalid font file');
            activateFont(font, file.name.replace(/\.[^.]+$/, ''));
        } catch (err) {
            console.error('Font parse error:', err);
            toast('Failed to parse font: ' + err.message, 'error');
        }
        hideLoading();
    }

    /* ══════════════════════════════════════════════════════════════
       GOOGLE FONTS
    ══════════════════════════════════════════════════════════════ */
    GoogleFonts.init($('fontGrid'), $('fontGridMore'), async (f) => {
        showLoading(`Loading ${f.name} from Google Fonts...`);
        try {
            const font = await GoogleFonts.loadFontBinary(f.name);
            if (font) {
                activateFont(font, f.name);
            } else {
                toast('Could not load font binary. Try uploading a file instead.', 'error');
            }
        } catch (err) {
            toast('Error: ' + err.message, 'error');
        }
        hideLoading();
    });

    $('fontSearch').addEventListener('input', e => GoogleFonts.filterFonts(e.target.value));
    if ($('loadMoreFonts')) $('loadMoreFonts').addEventListener('click', () => GoogleFonts.loadMore());

    /* ══════════════════════════════════════════════════════════════
       ACTIVATE FONT → populate all tabs
    ══════════════════════════════════════════════════════════════ */
    function activateFont(font, name) {
        console.log('[App] activateFont called:', name, font ? 'font OK' : 'NO FONT');
        if (!font) { toast('Font object is invalid', 'error'); return; }
        currentFont = font;
        currentFontName = name;
        _convHasRun = false; // reset so conv re-runs on next visit
        convResults = null;
        enableTabs();
        try { populateAnalysis(); } catch(e) { console.error('Analysis tab error:', e); toast('Analysis failed: ' + e.message, 'error'); }
        try { initMorphing(); } catch(e) { console.error('Morphing init error:', e); toast('Morphing init failed: ' + e.message, 'error'); }

        switchTab('analysis');
        toast(`Loaded: ${name}`);
    }

    /* ══════════════════════════════════════════════════════════════
       ANALYSIS TAB
    ══════════════════════════════════════════════════════════════ */
    function populateAnalysis() {
        const font = currentFont;
        if (!font) { console.warn('[Analysis] No font loaded'); return; }

        // ── Metadata ──
        try {
            const meta = FontAnalyzer.extractMetadata(font);
            const mc = $('metadataContent');
            mc.innerHTML = '';
            const fields = [
                ['Family', meta.family], ['Subfamily', meta.subfamily],
                ['Full Name', meta.fullName], ['PostScript', meta.postScriptName],
                ['Version', meta.version], ['Designer', meta.designer],
                ['Units/Em', meta.unitsPerEm], ['Glyphs', meta.numGlyphs],
                ['Ascender', meta.ascender], ['Descender', meta.descender],
                ['Weight', meta.weightClass], ['Width', meta.widthClass],
                ['Italic Angle', (meta.italicAngle || 0) + '°'], ['Monospace', meta.isMonospace ? 'Yes' : 'No'],
            ];
            for (const [label, value] of fields) {
                const d = document.createElement('div');
                d.className = 'meta-item';
                d.innerHTML = `<div class="meta-label">${label}</div><div class="meta-value">${value || '—'}</div>`;
                mc.appendChild(d);
            }
        } catch (e) { console.error('[Analysis] Metadata error:', e); }

        // ── Preview ──
        try {
            updatePreview();
            if (!_listenersInitAnalysis) {
                const pt = $('previewText');
                if (pt) pt.addEventListener('input', updatePreview);
            }
        } catch (e) { console.error('[Analysis] Preview error:', e); }

        // ── Unicode ──
        try {
            const uniData = FontAnalyzer.getUnicodeCoverage(font);
            const gc = $('glyphCount');
            if (gc) gc.textContent = `${uniData.total} glyphs`;
            const uc = $('unicodeContent');
            if (uc) {
                uc.innerHTML = '';
                for (const b of uniData.blocks) {
                    const d = document.createElement('div');
                    d.className = 'unicode-block';
                    d.innerHTML = `<span class="unicode-block-name">${b.name}</span><span class="unicode-block-count">${b.count}/${b.total}</span>`;
                    uc.appendChild(d);
                }
            }
        } catch (e) { console.error('[Analysis] Unicode error:', e); }

        // ── Tables ──
        try {
            const tables = FontAnalyzer.listTables(font);
            const tc = $('tablesContent');
            if (tc) {
                tc.innerHTML = '';
                for (const t of tables) {
                    const d = document.createElement('div');
                    d.className = 'table-item';
                    d.innerHTML = `<span class="table-tag">${t.tag}</span><span class="table-desc">${t.desc}</span>`;
                    tc.appendChild(d);
                }
            }
        } catch (e) { console.error('[Analysis] Tables error:', e); }

        // ── Glyph Grid ──
        try { populateGlyphGrid(); } catch (e) { console.error('[Analysis] Glyph grid error:', e); }

        // ── SDF ──
        try { updateSDF(); } catch (e) { console.error('[Analysis] SDF error:', e); }

        // ── Event listeners (once) ──
        if (!_listenersInitAnalysis) {
            try {
                const sc = $('sdfChar');  if (sc) sc.addEventListener('input', () => { try { updateSDF(); } catch(e) { console.error('SDF update err:', e); } });
                const sr = $('sdfRes');   if (sr) sr.addEventListener('change', () => { try { updateSDF(); } catch(e) { console.error('SDF update err:', e); } });
                const bc = $('bezierChar'); if (bc) bc.addEventListener('input', () => { try { updateBezier(); } catch(e) { console.error('Bezier update err:', e); } });
            } catch(e) { console.error('[Analysis] Listener bind error:', e); }
        }
        _listenersInitAnalysis = true;

        // ── Bezier ──
        try { updateBezier(); } catch (e) { console.error('[Analysis] Bezier error:', e); }
    }

    function updatePreview() {
        const text = $('previewText').value || 'AaBb 123';
        const fp = $('fontPreview');
        fp.style.fontFamily = `"${currentFontName}"`;
        fp.textContent = text;

        const ps = $('previewSizes');
        ps.innerHTML = '';
        for (const sz of [12, 16, 24, 36, 48]) {
            const d = document.createElement('div');
            d.className = 'preview-size-item';
            d.innerHTML = `<span class="preview-size-label">${sz}px</span><span style="font-family:'${currentFontName}';font-size:${sz}px">${text}</span>`;
            ps.appendChild(d);
        }
        GoogleFonts.loadFontCSS(currentFontName);
    }

    /* ── Glyph Grid — full multi-script support with pagination ── */
    const SCRIPT_RANGES = {
        latin:      [[0x0020,0x024F],[0x1E00,0x1EFF],[0x2C60,0x2C7F],[0xA720,0xA7FF]],
        devanagari: [[0x0900,0x097F],[0xA8E0,0xA8FF],[0x1CD0,0x1CFF]],
        bengali:    [[0x0980,0x09FF]],
        tamil:      [[0x0B80,0x0BFF]],
        telugu:     [[0x0C00,0x0C7F]],
        arabic:     [[0x0600,0x06FF],[0x0750,0x077F],[0xFB50,0xFDFF],[0xFE70,0xFEFF]],
        cyrillic:   [[0x0400,0x04FF],[0x0500,0x052F]],
        greek:      [[0x0370,0x03FF],[0x1F00,0x1FFF]],
        cjk:        [[0x4E00,0x9FFF],[0x3400,0x4DBF],[0x3000,0x303F],[0x3040,0x309F],[0x30A0,0x30FF],[0xAC00,0xD7AF]],
        symbols:    [[0x2000,0x2BFF],[0x2E00,0x2E7F],[0xFE00,0xFE0F],[0x25A0,0x27BF]],
    };

    function cpInScript(cp, script) {
        if (script === 'all') return true;
        if (script === 'unmapped') return cp == null;
        if (cp == null) return false;
        const ranges = SCRIPT_RANGES[script];
        if (!ranges) return true;
        for (const [lo, hi] of ranges) {
            if (cp >= lo && cp <= hi) return true;
        }
        return false;
    }

    let _allGlyphs = [];        // full list from font
    let _filteredGlyphs = [];   // after search + script filter
    let _glyphPage = 0;
    const GLYPH_PAGE_SIZE = 400;

    function populateGlyphGrid(resetPage) {
        const includeUnmapped = ($('glyphScriptFilter').value === 'unmapped');
        _allGlyphs = FontAnalyzer.getGlyphList(currentFont, includeUnmapped);
        if (resetPage !== false) _glyphPage = 0;

        const search = ($('glyphSearch').value || '').toLowerCase();
        const script = $('glyphScriptFilter').value;

        _filteredGlyphs = _allGlyphs.filter(g => {
            // Script filter
            if (!cpInScript(g.unicode, script)) return false;
            // Text search
            if (search) {
                return (g.char && g.char.toLowerCase().includes(search)) ||
                       (g.name && g.name.toLowerCase().includes(search)) ||
                       (g.unicode != null && ('u+' + g.unicode.toString(16)).includes(search));
            }
            return true;
        });

        // Show count info
        const info = $('glyphGridInfo');
        if (info) {
            info.textContent = `${_filteredGlyphs.length} glyphs` +
                (script !== 'all' ? ` (${script})` : '') +
                ` of ${_allGlyphs.length} total`;
        }

        renderGlyphPage();

        if (!_listenersInitGlyphSearch) {
            $('glyphSearch').addEventListener('input', () => populateGlyphGrid());
            $('glyphScriptFilter').addEventListener('change', () => populateGlyphGrid());
            const loadMoreBtn = $('loadMoreGlyphs');
            if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
                _glyphPage++;
                renderGlyphPage(true);
            });
            _listenersInitGlyphSearch = true;
        }
    }

    function renderGlyphPage(append) {
        const grid = $('glyphGrid');
        if (!append) grid.innerHTML = '';

        const start = append ? _glyphPage * GLYPH_PAGE_SIZE : 0;
        const end = (_glyphPage + 1) * GLYPH_PAGE_SIZE;
        const page = _filteredGlyphs.slice(start, end);

        for (const g of page) {
            const cell = document.createElement('div');
            cell.className = 'glyph-cell';
            cell.textContent = g.char || '□';
            cell.dataset.glyphIndex = g.index;
            const uHex = g.unicode != null
                ? 'U+' + g.unicode.toString(16).toUpperCase().padStart(4, '0')
                : 'unmapped';
            cell.title = `${g.name} (${uHex}) idx:${g.index}`;
            cell.addEventListener('click', () => {
                $$('.glyph-cell.active').forEach(c => c.classList.remove('active'));
                cell.classList.add('active');
                showGlyphDetail(g);
            });
            grid.appendChild(cell);
        }

        // Show/hide "Load More"
        const moreEl = $('glyphGridMore');
        if (moreEl) {
            moreEl.classList.toggle('hidden', end >= _filteredGlyphs.length);
        }
    }

    function showGlyphDetail(g) {
        const detail = $('glyphDetail');
        detail.classList.remove('hidden');
        const canvas = $('glyphDetailCanvas');
        FontRenderer.renderGlyph(currentFont, g.char, canvas, { fontSize: 220 });

        $('glyphDetailInfo').innerHTML = `
            <strong>${g.name}</strong><br>
            Unicode: U+${(g.unicode||0).toString(16).toUpperCase().padStart(4,'0')}<br>
            Index: ${g.index}<br>
            Advance Width: ${g.advanceWidth}<br>
            Character: ${g.char || '—'}
        `;

        // Sync selected glyph to SDF and Bezier inputs
        if (g.char) {
            const sdfInput = $('sdfChar');
            const bezierInput = $('bezierChar');
            if (sdfInput) { sdfInput.value = g.char; try { updateSDF(); } catch(e) { console.error('SDF sync error:', e); } }
            if (bezierInput) { bezierInput.value = g.char; try { updateBezier(); } catch(e) { console.error('Bezier sync error:', e); } }
        }
    }

    /* ── SDF ───────────────────────────────────────────────────── */
    function updateSDF() {
        try {
            if (!currentFont) return;
            const ch = $('sdfChar').value || 'A';
            const res = parseInt($('sdfRes').value) || 128;
            const result = FontRenderer.rasterise(currentFont, ch, res);
            if (!result || !result.binaryGrid) { console.warn('[SDF] rasterise returned empty'); return; }
            const { binaryGrid } = result;

            const rc = $('sdfRasterCanvas');
            if (!rc) return;
            rc.width = rc.height = res;
            const rctx = rc.getContext('2d');
            const rid = rctx.createImageData(res, res);
            for (let i = 0; i < res * res; i++) {
                const v = binaryGrid[i] * 255;
                rid.data[i*4] = v; rid.data[i*4+1] = v; rid.data[i*4+2] = v; rid.data[i*4+3] = 255;
            }
            rctx.putImageData(rid, 0, 0);

            const sdf = FontRenderer.computeSDF(binaryGrid, res);
            FontRenderer.drawSDF(sdf, res, $('sdfCanvas'));
            FontRenderer.drawContours(sdf, res, $('sdfContourCanvas'));
        } catch(e) {
            console.error('[SDF] Error:', e);
        }
    }

    /* ── Bezier ────────────────────────────────────────────────── */
    function updateBezier() {
        try {
            const ch = $('bezierChar').value || 'A';
            const info = FontRenderer.drawBezier(currentFont, ch, $('bezierCanvas'));
            if (info) {
                $('bezierInfo').innerHTML = `
                    <strong>Contours:</strong> ${info.contours}<br>
                    <strong>Segments:</strong> ${info.segments}<br>
                    <strong>Lines:</strong> ${info.lines}<br>
                    <strong>Quadratic Curves:</strong> ${info.qCurves}<br>
                    <strong>Cubic Curves:</strong> ${info.cCurves}<br>
                    <strong>Total Commands:</strong> ${info.commands.length}
                `;
            }
        } catch(e) { console.error('Bezier error:', e); }
    }

    /* ══════════════════════════════════════════════════════════════
       MORPHING TAB
    ══════════════════════════════════════════════════════════════ */
    function initMorphing() {
        if (!currentFont) { console.warn('[Morphing] No font loaded'); return; }
        try {
            morphAxisValues = FontMorpher.defaultValues();
        } catch(e) { console.error('[Morphing] defaultValues error:', e); morphAxisValues = {}; }

        try { buildSliders(); } catch(e) { console.error('[Morphing] Sliders error:', e); }
        try { buildPresets(); } catch(e) { console.error('[Morphing] Presets error:', e); }
        try { updateMorph(); } catch(e) { console.error('[Morphing] Initial morph error:', e); }
        try { updateManifold(); } catch(e) { console.error('[Morphing] Manifold error:', e); }
        try { updateAxisRows(); } catch(e) { console.error('[Morphing] Axis rows error:', e); }

        if (!_listenersInitMorph) {
            try {
                const mc = $('morphChar'); if (mc) mc.addEventListener('input', () => { try { updateMorph(); updateManifold(); } catch(e) { console.error('Morph update err:', e); } });
                const rm = $('resetMorphing'); if (rm) rm.addEventListener('click', () => {
                    morphAxisValues = FontMorpher.defaultValues();
                    try { updateSliderUI(); } catch(e) {}
                    try { updateMorph(); } catch(e) {}
                    try { updateManifold(); } catch(e) {}
                });
                // Style matrix click
                const smc = $('styleMatrixCanvas');
                if (smc) smc.addEventListener('click', onStyleMatrixClick);
                // TTF download
                const ttfBtn = $('downloadTTF');
                if (ttfBtn) ttfBtn.addEventListener('click', downloadAsTTF);

                // Remix sheet toggle
                const handle = $('remixHandle');
                const sheet = $('remixSheet');
                if (handle && sheet) {
                    handle.addEventListener('click', () => {
                        sheet.classList.toggle('open');
                    });
                    // Auto-open on init
                    sheet.classList.add('open');
                }
            } catch(e) { console.error('[Morphing] Listener bind error:', e); }
            try { initSkeletonPanel(); } catch(e) { console.error('[Morphing] Skeleton panel init error:', e); }
            _listenersInitMorph = true;
        }

    }

    let _activeRemixCat = null;

    function buildSliders() {
        const container = $('morphSlidersContainer');
        container.innerHTML = '';
        const tabBar = $('remixTabs');
        if (tabBar) tabBar.innerHTML = '';

        const categories = FontMorpher.AXIS_CATEGORIES || [{ id: 'all', name: 'All Axes' }];

        // Build horizontal category tabs
        categories.forEach((cat, idx) => {
            const catAxes = FontMorpher.AXES.filter(a => a.category === cat.id);
            if (!catAxes.length) return;

            // Create tab button
            if (tabBar) {
                const tab = document.createElement('button');
                tab.className = 'remix-tab' + (idx === 0 ? ' active' : '');
                tab.textContent = cat.name.replace(/ Controls?/i, '');
                tab.dataset.cat = cat.id;
                tab.addEventListener('click', () => {
                    tabBar.querySelectorAll('.remix-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    showCategorySliders(cat.id);
                });
                tabBar.appendChild(tab);
            }

            // Create slider panel for this category (hidden by default except first)
            const panel = document.createElement('div');
            panel.className = 'remix-cat-panel';
            panel.dataset.cat = cat.id;
            panel.style.display = (idx === 0) ? 'block' : 'none';
            if (idx === 0) _activeRemixCat = cat.id;

            for (const axis of catAxes) {
                const sliderGroup = document.createElement('div');
                sliderGroup.className = 'slider-group';

                // Per-axis manifold row canvas
                const rowWrap = document.createElement('div');
                rowWrap.className = 'axis-row-wrap';
                const rowCanvas = document.createElement('canvas');
                rowCanvas.id = `axisRow-${axis.id}`;
                rowCanvas.dataset.axis = axis.id;
                rowWrap.appendChild(rowCanvas);

                // Build slider controls with DOM (not innerHTML +=, which destroys canvas)
                const header = document.createElement('div');
                header.className = 'slider-header';
                const lbl = document.createElement('label');
                lbl.textContent = axis.name;
                const valSpan = document.createElement('span');
                valSpan.className = 'slider-value';
                valSpan.id = `sv-${axis.id}`;
                valSpan.textContent = axis.default.toFixed(2);
                header.appendChild(lbl);
                header.appendChild(valSpan);

                const labels = document.createElement('div');
                labels.className = 'slider-labels';
                labels.innerHTML = `<span>${axis.leftLabel}</span><span>${axis.rightLabel}</span>`;

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'morph-slider';
                slider.id = `ms-${axis.id}`;
                slider.min = axis.min;
                slider.max = axis.max;
                slider.step = '0.01';
                slider.value = axis.default;
                slider.dataset.axis = axis.id;

                sliderGroup.appendChild(rowWrap);
                sliderGroup.appendChild(header);
                sliderGroup.appendChild(labels);
                sliderGroup.appendChild(slider);
                panel.appendChild(sliderGroup);

                // Click on axis row → set value
                rowCanvas.addEventListener('click', e => {
                    const rect = rowCanvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width * rowCanvas.width;
                    const vals = FontMorpher.axisRowClickToValue(x, { steps: 7, cellSize: 32, gap: 3, axisId: axis.id });
                    if (vals) {
                        Object.assign(morphAxisValues, vals);
                        updateSliderUI();
                        updateMorph();
                        updateManifold();
                        updateAxisRows();
                    }
                });

                slider.addEventListener('input', e => {
                    const val = parseFloat(e.target.value);
                    morphAxisValues[axis.id] = val;
                    $(`sv-${axis.id}`).textContent = val.toFixed(2);
                    styleSliderProgress(e.target);
                    updateMorph();
                    updateManifold();
                    updateAxisRows();
                    updateRemixPreview();
                });
                // Initialize progress fill
                const sl = sliderGroup.querySelector('.morph-slider');
                if (sl) styleSliderProgress(sl);
            }

            container.appendChild(panel);
        });
    }

    function showCategorySliders(catId) {
        _activeRemixCat = catId;
        const container = $('morphSlidersContainer');
        container.querySelectorAll('.remix-cat-panel').forEach(p => {
            p.style.display = p.dataset.cat === catId ? 'block' : 'none';
        });
        updateAxisRows();
    }

    function updateAxisRows() {
        try {
            if (!currentFont) return;
            const ch = $('morphChar').value || 'A';
            // Only update rows in currently visible category panel
            const container = $('morphSlidersContainer');
            if (!container) return;
            const visiblePanel = container.querySelector(`.remix-cat-panel[data-cat="${_activeRemixCat}"]`);
            if (!visiblePanel) return;
            const canvases = visiblePanel.querySelectorAll('.axis-row-wrap canvas');
            for (const c of canvases) {
                const axisId = c.dataset.axis;
                if (axisId) FontMorpher.drawAxisRow(currentFont, ch, morphAxisValues, c, axisId, 7);
            }
        } catch(e) { console.error('Axis rows error:', e); }
    }

    function updateRemixPreview() {
        try {
            const canvas = $('remixPreviewCanvas');
            if (!canvas || !currentFont) return;
            const ch = $('morphChar').value || 'A';
            const size = 160;
            const cmds = FontRenderer.getPathCommands(currentFont, ch, size);
            if (cmds) {
                const morphed = FontMorpher.morphCommands(cmds, morphAxisValues, size);
                FontMorpher.drawMorphed(morphed, canvas);
            }
        } catch(e) { /* silent */ }
    }

    /** Style slider track: filled portion in accent, rest in border color */
    function styleSliderProgress(slider) {
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const val = parseFloat(slider.value);
        const pct = ((val - min) / (max - min)) * 100;
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF5500';
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#222';
        slider.style.background = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, ${borderColor} ${pct}%, ${borderColor} 100%)`;
    }

    function updateSliderUI() {
        for (const axis of FontMorpher.AXES) {
            const slider = $(`ms-${axis.id}`);
            if (slider) {
                slider.value = morphAxisValues[axis.id];
                $(`sv-${axis.id}`).textContent = morphAxisValues[axis.id].toFixed(2);
                styleSliderProgress(slider);
            }
        }
    }

    function buildPresets() {
        const grid = $('presetsGrid');
        grid.innerHTML = '';
        for (const [name, vals] of Object.entries(FontMorpher.PRESETS)) {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                morphAxisValues = { ...FontMorpher.defaultValues(), ...vals };
                updateSliderUI();
                updateMorph();
                updateManifold();
            });
            grid.appendChild(btn);
        }
    }

    function updateMorph() {
        if (!currentFont) return;
        try {
            const ch = $('morphChar').value || 'A';
            const size = 280;

            // Original
            FontRenderer.renderGlyph(currentFont, ch, $('morphOrigCanvas'), { fontSize: size * 0.8 });

            // Get path commands for morphing
            const cmds = FontRenderer.getPathCommands(currentFont, ch, size);
            if (cmds) {
                // ── SKELETON-FIRST: extract skeleton on ORIGINAL glyph ──
                // Only re-extract if character changed
                if (_lastSkeletonChar !== ch) {
                    try {
                        const statusEl = $('skeletonStatus');
                        if (statusEl) statusEl.innerHTML = '<span>Extracting skeleton...</span>';
                        lastSkeletonData = FontMorpher.extractSkeleton(cmds, size);
                        _lastSkeletonChar = ch;
                        renderSkeletonViz();
                        updateSkeletonInfo();
                        if (statusEl) {
                            statusEl.className = 'skeleton-status ready';
                            statusEl.innerHTML = '<span>&#10003; Skeleton ready — guiding morph controls</span>';
                        }
                    } catch(e) {
                        console.warn('Auto-skeleton extraction failed:', e);
                        lastSkeletonData = null;
                    }
                }

                // Morphed — skeleton data available for anatomy controls
                const morphed = FontMorpher.morphCommands(cmds, morphAxisValues, size);
                FontMorpher.drawMorphed(morphed, $('morphResultCanvas'));

                // Remix preview (small canvas in bottom sheet)
                try { updateRemixPreview(); } catch(e) {}

                // ── Live vector stats ──
                updateVectorStats(cmds, morphed);

                // ── Topology analysis & validation ──
                updateTopologyPanel(cmds, morphed, size);
            }

            // Alphabet preview
            FontMorpher.renderAlphabet(currentFont, morphAxisValues, $('alphabetCanvas'));

            // Text preview
            const preview = $('morphTextPreview');
            preview.style.fontFamily = `"${currentFontName}"`;
            const slant = morphAxisValues.slant || 0;
            preview.style.fontStyle = slant > 0.2 ? 'italic' : 'normal';
            preview.style.fontWeight = Math.round(400 + (morphAxisValues.weight || 0) * 300);
            preview.textContent = 'The quick brown fox jumps over the lazy dog';
        } catch(e) { console.error('Morph update error:', e); }
    }

    /* ── Vector Stats panel update ────────────────────────────── */
    function updateVectorStats(origCmds, morphedCmds) {
        try {
            const orig = FontMorpher.countCommandStats(origCmds);
            const morph = FontMorpher.countCommandStats(morphedCmds);

            // Helper to format value with delta
            function fmt(val, origVal) {
                const delta = val - origVal;
                if (delta === 0) return `${val}`;
                const sign = delta > 0 ? '+' : '';
                return `${val} <small style="color:var(--text3)">(${sign}${delta})</small>`;
            }

            const el = id => document.getElementById(id);
            if (el('statContours'))   el('statContours').innerHTML   = fmt(morph.contours, orig.contours);
            if (el('statSegments'))   el('statSegments').innerHTML   = fmt(morph.segments, orig.segments);
            if (el('statPoints'))     el('statPoints').innerHTML     = fmt(morph.points, orig.points);
            if (el('statLines'))      el('statLines').innerHTML      = fmt(morph.lines, orig.lines);
            if (el('statQuadCurves')) el('statQuadCurves').innerHTML = fmt(morph.quadCurves, orig.quadCurves);
            if (el('statCubicCurves'))el('statCubicCurves').innerHTML= fmt(morph.cubicCurves, orig.cubicCurves);
            if (el('statTotalCmds'))  el('statTotalCmds').innerHTML  = fmt(morph.totalCommands, orig.totalCommands);
            if (el('statMoves'))      el('statMoves').innerHTML      = fmt(morph.moves, orig.moves);

            // Update proportional bar
            const total = morph.lines + morph.quadCurves + morph.cubicCurves;
            if (total > 0) {
                if (el('barLines')) el('barLines').style.width = `${(morph.lines / total * 100).toFixed(1)}%`;
                if (el('barQuad'))  el('barQuad').style.width  = `${(morph.quadCurves / total * 100).toFixed(1)}%`;
                if (el('barCubic')) el('barCubic').style.width = `${(morph.cubicCurves / total * 100).toFixed(1)}%`;
            }
        } catch (e) {
            console.warn('Vector stats update failed:', e);
        }
    }

    /* ── Topology panel update ─────────────────────────────────── */
    function updateTopologyPanel(origCmds, morphedCmds, size) {
        console.log('[Topology] updateTopologyPanel called, cmds:', origCmds?.length, 'morphed:', morphedCmds?.length);
        try {
            const topo = FontMorpher.analyseGlyphTopology(origCmds, size);
            console.log('[Topology] analysis result:', topo);
            if (!topo) return;

            // Contour Hierarchy
            const contourEl = $('topoContours');
            if (contourEl) {
                const lines = [];
                lines.push(`<b>Total contours:</b> ${topo.contours.length}`);
                lines.push(`<b>Outer shells:</b> ${topo.numOuter}`);
                lines.push(`<b>Counters (holes):</b> ${topo.numCounters}`);
                if (topo.numNested > 0) lines.push(`<b>Nested islands:</b> ${topo.numNested}`);
                for (const c of topo.contours) {
                    const roleColor = c.role === 'outer' ? 'var(--ok)' : c.role === 'counter' ? 'var(--err)' : 'var(--warn)';
                    lines.push(`<span style="color:${roleColor}">● ${c.role}</span> — area: ${c.absArea.toFixed(0)}, winding: ${c.windingScreen} (signed: ${c.signedArea.toFixed(0)})`);
                }
                contourEl.innerHTML = lines.join('<br>');
            }

            // Structural Features
            const structEl = $('topoStructure');
            if (structEl) {
                const feat = topo.structure;
                const lines = [];
                lines.push(`<b>Stems:</b> ${feat.stems.length}`);
                lines.push(`<b>Crossbars:</b> ${feat.crossbars.length}`);
                lines.push(`<b>Bowls:</b> ${feat.bowls.length}`);
                lines.push(`<b>Counters:</b> ${feat.counters.length}`);
                lines.push(`<b>Diagonals:</b> ${feat.hasDiagonals ? 'Yes' : 'No'}`);
                lines.push(`<b>Serifs:</b> ${feat.hasSerifs ? 'Detected' : 'None'}`);
                lines.push(`<b>Symmetry:</b> ${feat.symmetryAxis || 'None'}`);
                structEl.innerHTML = lines.join('<br>');
            }

            // Stroke Analysis
            const strokeEl = $('topoStrokes');
            if (strokeEl) {
                const sw = topo.strokeWidths;
                const lines = [];
                lines.push(`<b>H-stroke width:</b> ${(sw.horizontal.mean * 100).toFixed(1)}% (med: ${(sw.horizontal.median * 100).toFixed(1)}%)`);
                lines.push(`<b>V-stroke width:</b> ${(sw.vertical.mean * 100).toFixed(1)}% (med: ${(sw.vertical.median * 100).toFixed(1)}%)`);
                const ratio = sw.vertical.mean > 0 ? (sw.horizontal.mean / sw.vertical.mean).toFixed(2) : 'N/A';
                lines.push(`<b>H/V ratio:</b> ${ratio}`);
                lines.push(`<b>Min stroke:</b> ${(sw.overall.min * 100).toFixed(1)}%`);
                lines.push(`<b>Max stroke:</b> ${(sw.overall.max * 100).toFixed(1)}%`);
                strokeEl.innerHTML = lines.join('<br>');
            }

            // Morph Validation
            const validEl = $('topoValidation');
            if (validEl) {
                const validation = FontMorpher.validateMorphedTopology(topo, morphedCmds, size);
                const lines = [];
                const scoreColor = validation.score > 0.7 ? 'var(--ok)' : validation.score > 0.4 ? 'var(--warn)' : 'var(--err)';
                lines.push(`<b>Identity Score:</b> <span style="color:${scoreColor}">${(validation.score * 100).toFixed(0)}%</span>`);
                lines.push(`<b>Valid:</b> ${validation.valid ? '✓ Yes' : '✗ No'}`);
                if (validation.warnings.length > 0) {
                    lines.push(`<b>Warnings:</b>`);
                    for (const w of validation.warnings) {
                        lines.push(`<span style="color:var(--warn)">⚠ ${w}</span>`);
                    }
                } else {
                    lines.push(`<span style="color:var(--ok)">✓ Character structure preserved</span>`);
                }
                validEl.innerHTML = lines.join('<br>');
            }

            // Draw topology visualization on canvas
            drawTopologyVisualization(origCmds, morphedCmds, size, topo);

        } catch(e) { console.error('Topology analysis error:', e); }
    }

    function drawTopologyVisualization(origCmds, morphedCmds, size, topo) {
        const canvas = $('topoCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const scale = w / size;
        ctx.save();
        ctx.scale(scale, scale);

        // Draw morphed glyph faintly
        ctx.beginPath();
        for (const c of morphedCmds) {
            switch (c.type) {
                case 'M': ctx.moveTo(c.x, c.y); break;
                case 'L': ctx.lineTo(c.x, c.y); break;
                case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                case 'Z': ctx.closePath(); break;
            }
        }
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
        ctx.fill('nonzero');
        ctx.globalAlpha = 1;

        // Draw contour outlines color-coded by role
        const contours = FontMorpher.splitContours(morphedCmds);
        const hierarchy = FontMorpher.analyseContourHierarchy(contours);
        const roleColors = { outer: '#3fb950', counter: '#f85149', nested: '#d29922' };

        for (let ci = 0; ci < contours.length; ci++) {
            const contour = contours[ci];
            const color = roleColors[hierarchy[ci].role] || '#58a6ff';
            ctx.beginPath();
            for (const c of contour) {
                switch (c.type) {
                    case 'M': ctx.moveTo(c.x, c.y); break;
                    case 'L': ctx.lineTo(c.x, c.y); break;
                    case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                    case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                    case 'Z': ctx.closePath(); break;
                }
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / scale;
            ctx.stroke();

            // Draw centroid dot
            const ctr = hierarchy[ci].centroid;
            ctx.beginPath();
            ctx.arc(ctr[0], ctr[1], 3 / scale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        // Draw stem/crossbar indicators from structural features
        if (topo && topo.structure) {
            const feat = topo.structure;
            // Stems (vertical lines)
            ctx.strokeStyle = '#d29922';
            ctx.lineWidth = 1.5 / scale;
            ctx.setLineDash([4 / scale, 4 / scale]);
            for (const stem of feat.stems) {
                const x = stem.x * size;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
                ctx.stroke();
            }
            // Crossbars (horizontal lines)
            ctx.strokeStyle = '#58a6ff';
            for (const bar of feat.crossbars) {
                const y = bar.y * size;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(size, y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    /* ── Skeleton Panel ────────────────────────────────────────── */
    let lastSkeletonData = null;
    let _lastSkeletonChar = null;

    function initSkeletonPanel() {
        const btn = $('extractSkeletonBtn');
        if (!btn) return;

        // "Re-extract" button forces re-extraction even if char hasn't changed
        btn.addEventListener('click', () => {
            if (!currentFont) { toast('No font loaded', 'error'); return; }
            try {
                const ch = $('morphChar').value || 'A';
                const size = 280;
                const cmds = FontRenderer.getPathCommands(currentFont, ch, size);
                if (!cmds) { toast('Could not get path commands', 'error'); return; }

                btn.textContent = 'Extracting...';
                btn.disabled = true;

                requestAnimationFrame(() => {
                    try {
                        // Extract skeleton on ORIGINAL glyph (not morphed)
                        lastSkeletonData = FontMorpher.extractSkeleton(cmds, size);
                        _lastSkeletonChar = ch;
                        renderSkeletonViz();
                        updateSkeletonInfo();
                        btn.textContent = 'Re-extract Skeleton';
                        btn.disabled = false;
                        const statusEl = $('skeletonStatus');
                        if (statusEl) {
                            statusEl.className = 'skeleton-status ready';
                            statusEl.innerHTML = '<span>&#10003; Skeleton ready — guiding morph controls</span>';
                        }
                    } catch(e) {
                        console.error('Skeleton extraction error:', e);
                        btn.textContent = 'Re-extract Skeleton';
                        btn.disabled = false;
                        toast('Skeleton extraction failed: ' + e.message, 'error');
                    }
                });
            } catch(e) {
                console.error('Skeleton init error:', e);
                toast('Error: ' + e.message, 'error');
            }
        });

        // Checkbox toggles for visualization options
        const checkboxes = ['skelShowDT', 'skelShowWidth', 'skelShowNodes', 'skelShowFeatures'];
        for (const id of checkboxes) {
            const el = $(id);
            if (el) el.addEventListener('change', renderSkeletonViz);
        }
    }

    function renderSkeletonViz() {
        if (!lastSkeletonData) return;
        const canvas = $('skeletonCanvas');
        if (!canvas) return;

        FontMorpher.drawSkeletonViz(lastSkeletonData, canvas, {
            showDT: $('skelShowDT')?.checked || false,
            showStrokeWidth: $('skelShowWidth')?.checked ?? true,
            showNodes: $('skelShowNodes')?.checked ?? true,
            showFeatures: $('skelShowFeatures')?.checked ?? true,
            showGlyph: true,
        });
    }

    function updateSkeletonInfo() {
        const metricsEl = $('skelMetrics');
        const featuresEl = $('skelFeatures');
        if (!metricsEl || !lastSkeletonData) return;

        const { graph, features, res } = lastSkeletonData;

        // Metric cards
        metricsEl.innerHTML = [
            { val: graph.pixelCount, label: 'Skeleton px' },
            { val: graph.junctions.length, label: 'Junctions' },
            { val: graph.endpoints.length, label: 'Endpoints' },
            { val: graph.edges.length, label: 'Edges' },
            { val: graph.avgStrokeWidth.toFixed(1), label: 'Avg Width' },
            { val: features.totalStrokeLength.toFixed(0), label: 'Stroke Len' },
        ].map(m => `<div class="skel-metric-card"><div class="metric-val">${m.val}</div><div class="metric-label">${m.label}</div></div>`).join('');

        // Feature details
        if (!featuresEl) return;
        const lines = [];
        if (features.stems.length > 0) {
            lines.push(`<div class="skel-feature-group"><b>Stems</b> — ${features.stems.length} vertical`);
            for (const s of features.stems) lines.push(`<div class="skel-feature-item">x = ${(s.x*100).toFixed(0)}%  ·  width ${s.avgWidth.toFixed(1)}px</div>`);
            lines.push('</div>');
        }
        if (features.crossbars.length > 0) {
            lines.push(`<div class="skel-feature-group"><b>Crossbars</b> — ${features.crossbars.length} horizontal`);
            for (const c of features.crossbars) lines.push(`<div class="skel-feature-item">y = ${(c.y*100).toFixed(0)}%  ·  width ${c.avgWidth.toFixed(1)}px</div>`);
            lines.push('</div>');
        }
        if (features.diagonals.length > 0) lines.push(`<div class="skel-feature-group"><b>Diagonals</b> — ${features.diagonals.length}</div>`);
        if (features.serifs.length > 0) lines.push(`<div class="skel-feature-group"><b>Short segments (serifs)</b> — ${features.serifs.length}</div>`);
        featuresEl.innerHTML = lines.join('');
    }

    /* ── Manifold (radar + matrix) ─────────────────────────────── */
    function updateManifold() {
        if (!currentFont) return;
        try {
            FontMorpher.drawRadarChart($('radarCanvas'), morphAxisValues);
        } catch(e) { console.error('Radar chart error:', e); }
        try {
            const ch = $('morphChar').value || 'A';
            styleMatrixMeta = FontMorpher.drawStyleMatrix(currentFont, ch, morphAxisValues, $('styleMatrixCanvas'), 7);
        } catch(e) { console.error('Style matrix error:', e); }
    }

    function onStyleMatrixClick(e) {
        if (!styleMatrixMeta) return;
        const rect = e.target.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * e.target.width;
        const y = (e.clientY - rect.top) / rect.height * e.target.height;
        const vals = FontMorpher.styleMatrixClickToValues(x, y, styleMatrixMeta);
        if (vals) {
            Object.assign(morphAxisValues, vals);
            updateSliderUI();
            updateMorph();
            updateManifold();
        }
    }

    /* ══════════════════════════════════════════════════════════════
       TTF DOWNLOAD — Generate TTF from morphed vectors
    ══════════════════════════════════════════════════════════════ */
    function downloadAsTTF() {
        if (!currentFont) { toast('No font loaded', 'error'); return; }
        try {
            toast('Generating TTF — processing all glyphs...', 'success');
            const upm = currentFont.unitsPerEm || 1000;

            // Get ALL unicode-mapped codepoints from the font's cmap
            const allCodepoints = FontAnalyzer.getAllMappedCodepoints(currentFont);
            console.log(`[TTF] Font has ${allCodepoints.length} mapped codepoints`);

            // .notdef glyph
            const notdefPath = new opentype.Path();
            notdefPath.moveTo(50, 0); notdefPath.lineTo(50, 700); notdefPath.lineTo(450, 700); notdefPath.lineTo(450, 0); notdefPath.close();
            const notdefGlyph = new opentype.Glyph({
                name: '.notdef', unicode: 0, advanceWidth: 500, path: notdefPath
            });

            const glyphs = [notdefGlyph];
            const baseline = upm * 0.75;
            const seenUnicodes = new Set([0]);
            let skipped = 0;

            for (const cp of allCodepoints) {
                if (seenUnicodes.has(cp)) continue;
                seenUnicodes.add(cp);

                try {
                    const ch = String.fromCodePoint(cp);
                    const srcGlyph = FontRenderer.charToGlyph(currentFont, ch);
                    if (!srcGlyph) { skipped++; continue; }

                    const cmds = FontRenderer.getPathCommands(currentFont, ch, upm);
                    if (!cmds || !cmds.length) {
                        // Glyph exists but has no outline (e.g. space) — copy as-is
                        const emptyPath = new opentype.Path();
                        glyphs.push(new opentype.Glyph({
                            name: srcGlyph.name || `uni${cp.toString(16).toUpperCase().padStart(4,'0')}`,
                            unicode: cp,
                            advanceWidth: srcGlyph.advanceWidth || upm * 0.5,
                            path: emptyPath
                        }));
                        continue;
                    }

                    const morphed = FontMorpher.morphCommands(cmds, morphAxisValues, upm);
                    const path = new opentype.Path();
                    for (const c of morphed) {
                        switch(c.type) {
                            case 'M': path.moveTo(c.x, baseline - c.y); break;
                            case 'L': path.lineTo(c.x, baseline - c.y); break;
                            case 'Q': path.quadraticCurveTo(c.x1, baseline - c.y1, c.x, baseline - c.y); break;
                            case 'C': path.bezierCurveTo(c.x1, baseline - c.y1, c.x2, baseline - c.y2, c.x, baseline - c.y); break;
                            case 'Z': path.close(); break;
                        }
                    }

                    const glyphName = srcGlyph.name || (cp === 0x20 ? 'space' : `uni${cp.toString(16).toUpperCase().padStart(4,'0')}`);
                    const glyph = new opentype.Glyph({
                        name: glyphName,
                        unicode: cp,
                        advanceWidth: srcGlyph.advanceWidth || upm * 0.6,
                        path: path
                    });
                    glyphs.push(glyph);
                } catch(ge) {
                    skipped++;
                    /* skip problematic glyphs */
                }
            }

            const morphName = 'Morphed-' + currentFontName.replace(/[^a-zA-Z0-9]/g, '');
            const newFont = new opentype.Font({
                familyName: morphName,
                styleName: 'Regular',
                unitsPerEm: upm,
                ascender: currentFont.ascender || upm * 0.8,
                descender: currentFont.descender || -(upm * 0.2),
                glyphs: glyphs
            });

            newFont.download(morphName + '.ttf');
            console.log(`[TTF] Exported ${glyphs.length} glyphs, skipped ${skipped}`);
            toast(`Downloaded ${morphName}.ttf (${glyphs.length} glyphs including all scripts)`);
        } catch(e) {
            console.error('TTF generation error:', e);
            toast('TTF generation failed: ' + e.message, 'error');
        }
    }

    /* ══════════════════════════════════════════════════════════════
       CONVOLUTION TAB
    ══════════════════════════════════════════════════════════════ */
    // Wire filter pill buttons
    for (const pill of $$('.conv-pill')) {
        pill.addEventListener('click', () => {
            $$('.conv-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            displayConvResults(pill.dataset.cat);
        });
    }
    // Re-run on character change
    const convCharEl = $('convChar');
    if (convCharEl) convCharEl.addEventListener('change', runConvolution);

    function runConvolution() {
        if (!currentFont) return;
        const ch = $('convChar')?.value || 'A';

        const src = document.createElement('canvas');
        src.width = src.height = 128;
        FontRenderer.renderGlyph(currentFont, ch, src, { fontSize: 100 });

        convResults = FontConvolution.runAll(src);
        displayConvResults('all');

        // Feature vector
        const fv = FontConvolution.computeFeatureVector(convResults);
        const fvEl = $('featureVector');
        fvEl.classList.remove('hidden');
        const fvContent = $('fvContent');
        fvContent.innerHTML = '';
        for (const [k, v] of Object.entries(fv)) {
            const row = document.createElement('div');
            row.className = 'fv-row';
            row.innerHTML = `<span>${k}</span><span>${v.toFixed(4)}</span>`;
            fvContent.appendChild(row);
        }

        // Show export section
        const exportSec = $('convExportSection');
        if (exportSec) exportSec.classList.remove('hidden');

        // Wire export buttons once
        if (!_listenersInitConvExport) {
            _listenersInitConvExport = true;
            const exportFVBtn = $('exportFV');
            if (exportFVBtn) exportFVBtn.addEventListener('click', exportFeatureVector);
            const exportAllBtn = $('exportAllConv');
            if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllConvFilters);
        }

        toast('Convolution complete — ' + Object.keys(convResults).length + ' filters');
        _convHasRun = true;
    }

    function displayConvResults(cat) {
        if (!convResults) return;
        const grid = $('convGrid');
        grid.innerHTML = '';
        for (const [name, r] of Object.entries(convResults)) {
            if (cat !== 'all' && r.cat !== cat) continue;
            const item = document.createElement('div');
            item.className = 'conv-item';
            const c = document.createElement('canvas');
            c.width = r.w; c.height = r.h;
            c.getContext('2d').drawImage(r.canvas, 0, 0);
            item.appendChild(c);
            const label = document.createElement('div');
            label.className = 'conv-label';
            label.textContent = name;
            item.appendChild(label);
            // Per-filter download button
            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn btn-sm conv-dl-btn';
            dlBtn.textContent = '⬇';
            dlBtn.title = 'Download ' + name;
            dlBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                exportCanvas(r.canvas, `${currentFontName}_${name.replace(/\s+/g, '_')}.png`);
            });
            item.appendChild(dlBtn);
            grid.appendChild(item);
        }
    }

    function exportFeatureVector() {
        if (!convResults) return;
        const fv = FontConvolution.computeFeatureVector(convResults);
        let csv = 'Feature,Value\n';
        for (const [k, v] of Object.entries(fv)) {
            csv += `"${k}",${v}\n`;
        }
        download(csv, `${currentFontName}_feature_vector.csv`, 'text/csv');
    }

    function exportAllConvFilters() {
        if (!convResults) return;
        // Download each filter as a separate PNG (since no ZIP lib available in browser)
        let count = 0;
        for (const [name, r] of Object.entries(convResults)) {
            setTimeout(() => {
                exportCanvas(r.canvas, `${currentFontName}_${name.replace(/\s+/g, '_')}.png`);
            }, count * 200);
            count++;
        }
        toast(`Downloading ${count} filter images...`);
    }

    /* ══════════════════════════════════════════════════════════════
       CONTEXTUAL EXPORTS (Analysis tab)
    ══════════════════════════════════════════════════════════════ */
    $('exportReport').addEventListener('click', () => {
        if (!currentFont) return;
        const meta = FontAnalyzer.extractMetadata(currentFont);
        const uni = FontAnalyzer.getUnicodeCoverage(currentFont);
        let txt = `FONT ANALYSIS REPORT\n${'='.repeat(50)}\n\n`;
        for (const [k, v] of Object.entries(meta)) txt += `${k}: ${v}\n`;
        txt += `\nUnicode Coverage: ${uni.total} codepoints\n`;
        for (const b of uni.blocks) txt += `  ${b.name}: ${b.count}/${b.total}\n`;
        txt += `\nMorphing Axis Values:\n`;
        for (const [k, v] of Object.entries(morphAxisValues)) txt += `  ${k}: ${v}\n`;
        download(txt, `${currentFontName}_report.txt`, 'text/plain');
    });

    $('exportJSON').addEventListener('click', () => {
        if (!currentFont) return;
        const meta = FontAnalyzer.extractMetadata(currentFont);
        download(JSON.stringify(meta, null, 2), `${currentFontName}_metadata.json`, 'application/json');
    });

    $('exportSDF').addEventListener('click', () => exportCanvas($('sdfCanvas'), `${currentFontName}_sdf.png`));

    $('exportMorphCfg').addEventListener('click', () => {
        const cfg = { font: currentFontName, axes: morphAxisValues };
        download(JSON.stringify(cfg, null, 2), `${currentFontName}_morph_config.json`, 'application/json');
    });

    $('exportMorphed').addEventListener('click', () => exportCanvas($('morphResultCanvas'), `${currentFontName}_morphed.png`));

    /* ══════════════════════════════════════════════════════════════
       DOWNLOAD HELPERS
    ══════════════════════════════════════════════════════════════ */
    function download(content, filename, mime) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: mime }));
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        toast(`Downloaded ${filename}`);
    }

    function exportCanvas(canvas, filename) {
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = filename;
        a.click();
        toast(`Downloaded ${filename}`);
    }

    /* ══════════════════════════════════════════════════════════════
       LOADING
    ══════════════════════════════════════════════════════════════ */
    function showLoading(msg) {
        $('loadingMsg').textContent = msg || 'Loading...';
        $('loadingIndicator').classList.remove('hidden');
    }
    function hideLoading() {
        $('loadingIndicator').classList.add('hidden');
    }

})();
