/**
 * google-fonts.js — Curated Google Fonts library with CDN loading
 * Embeds a list of ~200 popular fonts so no API key is needed.
 */
window.GoogleFonts = (() => {

    /* ── Curated font list ─────────────────────────────────────────────── */
    const FONTS = [
        // Sans-Serif
        {name:'Roboto',cat:'sans-serif'},{name:'Open Sans',cat:'sans-serif'},{name:'Lato',cat:'sans-serif'},
        {name:'Montserrat',cat:'sans-serif'},{name:'Poppins',cat:'sans-serif'},{name:'Noto Sans',cat:'sans-serif'},
        {name:'Inter',cat:'sans-serif'},{name:'Raleway',cat:'sans-serif'},{name:'Ubuntu',cat:'sans-serif'},
        {name:'Nunito',cat:'sans-serif'},{name:'Rubik',cat:'sans-serif'},{name:'Work Sans',cat:'sans-serif'},
        {name:'DM Sans',cat:'sans-serif'},{name:'Fira Sans',cat:'sans-serif'},{name:'Mulish',cat:'sans-serif'},
        {name:'Barlow',cat:'sans-serif'},{name:'Manrope',cat:'sans-serif'},{name:'Outfit',cat:'sans-serif'},
        {name:'Quicksand',cat:'sans-serif'},{name:'Josefin Sans',cat:'sans-serif'},
        {name:'Nunito Sans',cat:'sans-serif'},{name:'Archivo',cat:'sans-serif'},
        {name:'Cabin',cat:'sans-serif'},{name:'Karla',cat:'sans-serif'},{name:'Source Sans 3',cat:'sans-serif'},
        {name:'Mukta',cat:'sans-serif'},{name:'Overpass',cat:'sans-serif'},{name:'Exo 2',cat:'sans-serif'},
        {name:'Asap',cat:'sans-serif'},{name:'Titillium Web',cat:'sans-serif'},
        {name:'Catamaran',cat:'sans-serif'},{name:'Hind',cat:'sans-serif'},
        {name:'Lexend',cat:'sans-serif'},{name:'Assistant',cat:'sans-serif'},
        {name:'Abel',cat:'sans-serif'},{name:'Didact Gothic',cat:'sans-serif'},
        {name:'Signika',cat:'sans-serif'},{name:'Comfortaa',cat:'sans-serif'},
        {name:'Questrial',cat:'sans-serif'},{name:'Varela Round',cat:'sans-serif'},
        {name:'Maven Pro',cat:'sans-serif'},{name:'Red Hat Display',cat:'sans-serif'},
        {name:'Plus Jakarta Sans',cat:'sans-serif'},{name:'Space Grotesk',cat:'sans-serif'},
        {name:'Albert Sans',cat:'sans-serif'},{name:'Figtree',cat:'sans-serif'},
        {name:'Sora',cat:'sans-serif'},{name:'Urbanist',cat:'sans-serif'},
        {name:'Libre Franklin',cat:'sans-serif'},{name:'Be Vietnam Pro',cat:'sans-serif'},

        // Serif
        {name:'Playfair Display',cat:'serif'},{name:'Merriweather',cat:'serif'},
        {name:'Lora',cat:'serif'},{name:'PT Serif',cat:'serif'},{name:'Noto Serif',cat:'serif'},
        {name:'Bitter',cat:'serif'},{name:'Libre Baskerville',cat:'serif'},
        {name:'EB Garamond',cat:'serif'},{name:'Crimson Text',cat:'serif'},
        {name:'Source Serif 4',cat:'serif'},{name:'Cormorant Garamond',cat:'serif'},
        {name:'Vollkorn',cat:'serif'},{name:'Spectral',cat:'serif'},
        {name:'Cardo',cat:'serif'},{name:'Arvo',cat:'serif'},
        {name:'DM Serif Display',cat:'serif'},{name:'Zilla Slab',cat:'serif'},
        {name:'Alegreya',cat:'serif'},{name:'Noticia Text',cat:'serif'},
        {name:'Alice',cat:'serif'},{name:'Mate',cat:'serif'},
        {name:'Aleo',cat:'serif'},{name:'Domine',cat:'serif'},
        {name:'Literata',cat:'serif'},{name:'Gelasio',cat:'serif'},
        {name:'Cormorant',cat:'serif'},{name:'Frank Ruhl Libre',cat:'serif'},
        {name:'Bree Serif',cat:'serif'},{name:'Unna',cat:'serif'},
        {name:'Lusitana',cat:'serif'},{name:'Petrona',cat:'serif'},

        // Display
        {name:'Abril Fatface',cat:'display'},{name:'Pacifico',cat:'display'},
        {name:'Lobster',cat:'display'},{name:'Satisfy',cat:'display'},
        {name:'Righteous',cat:'display'},{name:'Passion One',cat:'display'},
        {name:'Alfa Slab One',cat:'display'},{name:'Permanent Marker',cat:'display'},
        {name:'Lilita One',cat:'display'},{name:'Bungee',cat:'display'},
        {name:'Archivo Black',cat:'display'},{name:'Anton',cat:'display'},
        {name:'Concert One',cat:'display'},{name:'Bebas Neue',cat:'display'},
        {name:'Teko',cat:'display'},{name:'Black Ops One',cat:'display'},
        {name:'Russo One',cat:'display'},{name:'Monoton',cat:'display'},
        {name:'Orbitron',cat:'display'},{name:'Fredoka One',cat:'display'},
        {name:'Berkshire Swash',cat:'display'},{name:'Modak',cat:'display'},
        {name:'Shrikhand',cat:'display'},{name:'Bungee Shade',cat:'display'},
        {name:'Bowlby One SC',cat:'display'},

        // Handwriting
        {name:'Dancing Script',cat:'handwriting'},{name:'Caveat',cat:'handwriting'},
        {name:'Indie Flower',cat:'handwriting'},{name:'Sacramento',cat:'handwriting'},
        {name:'Great Vibes',cat:'handwriting'},{name:'Kalam',cat:'handwriting'},
        {name:'Patrick Hand',cat:'handwriting'},{name:'Covered By Your Grace',cat:'handwriting'},
        {name:'Architects Daughter',cat:'handwriting'},{name:'Shadows Into Light',cat:'handwriting'},
        {name:'Gloria Hallelujah',cat:'handwriting'},{name:'Amatic SC',cat:'handwriting'},
        {name:'Handlee',cat:'handwriting'},{name:'Pangolin',cat:'handwriting'},
        {name:'Courgette',cat:'handwriting'},{name:'Rock Salt',cat:'handwriting'},
        {name:'Reenie Beanie',cat:'handwriting'},{name:'Comic Neue',cat:'handwriting'},

        // Monospace
        {name:'Fira Code',cat:'monospace'},{name:'Source Code Pro',cat:'monospace'},
        {name:'JetBrains Mono',cat:'monospace'},{name:'Roboto Mono',cat:'monospace'},
        {name:'Space Mono',cat:'monospace'},{name:'Inconsolata',cat:'monospace'},
        {name:'IBM Plex Mono',cat:'monospace'},{name:'Ubuntu Mono',cat:'monospace'},
        {name:'Cousine',cat:'monospace'},{name:'Anonymous Pro',cat:'monospace'},
        {name:'PT Mono',cat:'monospace'},{name:'Overpass Mono',cat:'monospace'},

        // Indic / International
        {name:'Hind Siliguri',cat:'sans-serif'},{name:'Hind Madurai',cat:'sans-serif'},
        {name:'Noto Sans Devanagari',cat:'sans-serif'},{name:'Noto Sans Bengali',cat:'sans-serif'},
        {name:'Noto Sans Tamil',cat:'sans-serif'},{name:'Noto Sans Telugu',cat:'sans-serif'},
        {name:'Noto Sans Arabic',cat:'sans-serif'},{name:'Noto Sans JP',cat:'sans-serif'},
        {name:'Noto Sans KR',cat:'sans-serif'},{name:'Noto Sans SC',cat:'sans-serif'},
        {name:'Noto Sans TC',cat:'sans-serif'}
    ];

    const PAGE_SIZE = 40;
    let displayedCount = 0;
    let filteredFonts = [...FONTS];
    let gridEl = null, moreEl = null;
    const loadedCSS = new Set();
    const loadedBinaries = {};          // name → opentype.Font

    /* ── CSS loading via Google Fonts CDN ───────────────────────────── */
    function loadFontCSS(fontName) {
        if (loadedCSS.has(fontName)) return;
        loadedCSS.add(fontName);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;700&display=swap`;
        document.head.appendChild(link);
    }

    /* ── Binary fetch → opentype.js Font object ────────────────────── */
    function fontNameToId(name) {
        return name.toLowerCase().replace(/\s+/g, '-');
    }

    async function loadFontBinary(fontName) {
        if (loadedBinaries[fontName]) return loadedBinaries[fontName];

        const id = fontNameToId(fontName);

        // fontsource CDN — .woff only (opentype.js cannot parse woff2)
        const sources = [
            `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-400-normal.woff`,
            `https://cdn.jsdelivr.net/npm/@fontsource/${id}@latest/files/${id}-latin-400-normal.woff`,
        ];

        for (const url of sources) {
            try {
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const buf = await resp.arrayBuffer();
                const font = opentype.parse(buf);
                loadedBinaries[fontName] = font;
                return font;
            } catch (e) {
                console.warn(`[GoogleFonts] ${url} failed:`, e.message);
            }
        }

        // Strategy 2: Google Fonts CSS → extract font URL (may be woff2)
        try {
            const cssURL = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400&display=swap`;
            const resp = await fetch(cssURL);
            const cssText = await resp.text();
            const urlMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
            if (urlMatch) {
                const buf = await fetch(urlMatch[1]).then(r => r.arrayBuffer());
                const font = opentype.parse(buf);
                loadedBinaries[fontName] = font;
                return font;
            }
        } catch (e) {
            console.warn(`[GoogleFonts] CSS fallback failed for "${fontName}":`, e.message);
        }

        console.warn(`[GoogleFonts] All sources failed for "${fontName}"`);
        return null;
    }

    /* ── Render the grid ───────────────────────────────────────────── */
    function renderGrid() {
        if (!gridEl) return;
        const batch = filteredFonts.slice(displayedCount, displayedCount + PAGE_SIZE);
        batch.forEach(f => {
            loadFontCSS(f.name);
            const card = document.createElement('div');
            card.className = 'font-card';
            card.innerHTML = `
                <div class="font-name">${f.name}</div>
                <div class="font-sample" style="font-family:'${f.name}',${f.cat}">AaBb 123</div>
                <div class="font-category">${f.cat}</div>`;
            card.addEventListener('click', () => onSelectFont(f));
            gridEl.appendChild(card);
        });
        displayedCount += batch.length;
        if (moreEl) moreEl.classList.toggle('hidden', displayedCount >= filteredFonts.length);
    }

    function filterFonts(query) {
        const q = query.toLowerCase().trim();
        filteredFonts = q ? FONTS.filter(f =>
            f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)
        ) : [...FONTS];
        displayedCount = 0;
        if (gridEl) gridEl.innerHTML = '';
        renderGrid();
    }

    let _selectHandler = null;
    function onSelectFont(f) {
        if (_selectHandler) _selectHandler(f);
    }

    /* ── Public API ────────────────────────────────────────────────── */
    function init(gridElement, moreElement, selectCb) {
        gridEl = gridElement;
        moreEl = moreElement;
        _selectHandler = selectCb;
        displayedCount = 0;
        gridEl.innerHTML = '';
        renderGrid();
    }

    return { FONTS, ALL_FONTS: FONTS, init, filterFonts, loadMore: renderGrid, loadFontBinary, loadFontCSS };
})();
