/**
 * font-analyzer.js — Metadata, Unicode coverage, font tables, glyph info
 * Works with opentype.js Font objects.
 */
window.FontAnalyzer = (() => {

    /* ──────────────────────── Metadata ──────────────────────── */
    function extractMetadata(font) {
        const names = font.names || {};
        const os2   = (font.tables && font.tables.os2) || {};
        const head  = (font.tables && font.tables.head) || {};
        const post  = (font.tables && font.tables.post) || {};

        const gn = k => {
            const v = names[k];
            if (!v) return '';
            if (typeof v === 'string') return v;
            return v.en || Object.values(v)[0] || '';
        };

        return {
            family:        gn('fontFamily'),
            subfamily:     gn('fontSubfamily'),
            fullName:      gn('fullName'),
            postScriptName:gn('postScriptName'),
            version:       gn('version'),
            copyright:     gn('copyright'),
            designer:      gn('designer'),
            description:   gn('description'),
            license:       gn('license'),
            manufacturer:  gn('manufacturer'),
            trademark:     gn('trademark'),
            unitsPerEm:    font.unitsPerEm,
            ascender:      font.ascender,
            descender:     font.descender,
            numGlyphs:     font.numGlyphs || (font.glyphs ? font.glyphs.length : 0),
            weightClass:   os2.usWeightClass  || '',
            widthClass:    os2.usWidthClass   || '',
            italicAngle:   post.italicAngle   || 0,
            isMonospace:   post.isFixedPitch  || false,
            created:       head.created  ? new Date(head.created * 1000).toISOString().split('T')[0] : '',
            modified:      head.modified ? new Date(head.modified * 1000).toISOString().split('T')[0] : '',
        };
    }

    /* ──────────────────── Unicode Coverage ──────────────────── */
    const UNICODE_BLOCKS = [
        ['Basic Latin',0x0020,0x007F],['Latin-1 Supplement',0x0080,0x00FF],
        ['Latin Extended-A',0x0100,0x017F],['Latin Extended-B',0x0180,0x024F],
        ['IPA Extensions',0x0250,0x02AF],['Spacing Modifier Letters',0x02B0,0x02FF],
        ['Combining Diacritical',0x0300,0x036F],['Greek and Coptic',0x0370,0x03FF],
        ['Cyrillic',0x0400,0x04FF],['Armenian',0x0530,0x058F],
        ['Hebrew',0x0590,0x05FF],['Arabic',0x0600,0x06FF],
        ['Devanagari',0x0900,0x097F],['Bengali',0x0980,0x09FF],
        ['Tamil',0x0B80,0x0BFF],['Telugu',0x0C00,0x0C7F],
        ['Thai',0x0E00,0x0E7F],['Georgian',0x10A0,0x10FF],
        ['CJK Unified Ideographs',0x4E00,0x9FFF],
        ['General Punctuation',0x2000,0x206F],
        ['Currency Symbols',0x20A0,0x20CF],
        ['Letterlike Symbols',0x2100,0x214F],
        ['Mathematical Operators',0x2200,0x22FF],
        ['Box Drawing',0x2500,0x257F],
        ['Geometric Shapes',0x25A0,0x25FF],
        ['Miscellaneous Symbols',0x2600,0x26FF],
        ['Dingbats',0x2700,0x27BF],
        ['Private Use Area',0xE000,0xF8FF],
    ];

    function getUnicodeCoverage(font) {
        // build set of supported codepoints
        const cmap = {};
        try {
            if (font.encoding && font.encoding.cmap && font.encoding.cmap.glyphIndexMap) {
                for (const cp of Object.keys(font.encoding.cmap.glyphIndexMap)) {
                    cmap[Number(cp)] = true;
                }
            }
        } catch(e) { console.warn('Could not read cmap:', e); }
        const supported = Object.keys(cmap).map(Number);
        const total = supported.length;

        const blocks = UNICODE_BLOCKS.map(([name, start, end]) => {
            let count = 0;
            for (const cp of supported) {
                if (cp >= start && cp <= end) count++;
            }
            return count > 0 ? { name, start, end, count, total: end - start + 1 } : null;
        }).filter(Boolean);

        return { total, blocks };
    }

    /* ──────────────────── Font Tables ───────────────────────── */
    const TABLE_DESCRIPTIONS = {
        'cmap':'Character to Glyph mapping','glyf':'Glyph Data','head':'Font Header',
        'hhea':'Horizontal Header','hmtx':'Horizontal Metrics','maxp':'Maximum Profile',
        'name':'Naming Table','os2':'OS/2 and Windows metrics','post':'PostScript',
        'cvt':'Control Value','fpgm':'Font Program','prep':'Pre-program',
        'loca':'Index to Location','gasp':'Grid-fitting / Scan-conversion',
        'GDEF':'Glyph Definition','GPOS':'Glyph Positioning','GSUB':'Glyph Substitution',
        'kern':'Kerning','CFF':'Compact Font Format','CFF2':'Compact Font Format 2',
        'DSIG':'Digital Signature','LTSH':'Linear Threshold','VDMX':'Vertical Device Metrics',
        'vhea':'Vertical Header','vmtx':'Vertical Metrics','BASE':'Baseline',
        'fvar':'Font Variations','gvar':'Glyph Variations','STAT':'Style Attributes',
    };

    function listTables(font) {
        const tables = [];
        if (font.tables) {
            for (const tag of Object.keys(font.tables)) {
                tables.push({ tag, desc: TABLE_DESCRIPTIONS[tag] || tag });
            }
        }
        return tables;
    }

    /* ──────────────────── Glyph List ───────────────────────── */
    /**
     * Returns ALL glyphs in the font — every glyph that has a unicode mapping plus
     * optionally unmapped glyphs (ligatures, contextual alternates, etc.).
     * No artificial cap — if a font has 20,000 glyphs we return all of them.
     */
    function getGlyphList(font, includeUnmapped) {
        const glyphs = [];
        const n = font.numGlyphs || (font.glyphs ? font.glyphs.length : 0);
        for (let i = 0; i < n; i++) {
            try {
                const g = font.glyphs.get(i);
                if (!g) continue;

                // Collect all unicodes (some glyphs have multiple via g.unicodes)
                let unicodeList = [];
                if (g.unicodes && g.unicodes.length > 0) {
                    unicodeList = g.unicodes;
                } else if (g.unicode != null) {
                    unicodeList = [g.unicode];
                }

                const primaryUnicode = unicodeList.length > 0 ? unicodeList[0] : null;

                // Skip unmapped glyphs unless requested (or if it's .notdef at 0)
                if (primaryUnicode == null && i !== 0 && !includeUnmapped) continue;

                let ch = '';
                if (primaryUnicode != null) {
                    try { ch = String.fromCodePoint(primaryUnicode); } catch(e) { ch = ''; }
                }

                glyphs.push({
                    index: i,
                    name: g.name || `.glyph${i}`,
                    unicode: primaryUnicode,
                    unicodes: unicodeList,
                    char: ch,
                    advanceWidth: g.advanceWidth || 0,
                });
            } catch(e) {
                continue;
            }
        }
        return glyphs;
    }

    /**
     * Return all codepoints mapped in the font's cmap.
     * This gives the complete set of unicode characters the font supports.
     */
    function getAllMappedCodepoints(font) {
        const codepoints = [];
        try {
            if (font.encoding && font.encoding.cmap && font.encoding.cmap.glyphIndexMap) {
                for (const cp of Object.keys(font.encoding.cmap.glyphIndexMap)) {
                    codepoints.push(Number(cp));
                }
            }
        } catch(e) { console.warn('Could not read cmap:', e); }
        return codepoints;
    }

    /* ──────────────────── Glyph Detail ─────────────────────── */
    function getGlyphDetail(font, glyphIndex) {
        try {
            const g = font.glyphs.get(glyphIndex);
            if (!g) return null;
            const bb = g.getBoundingBox ? g.getBoundingBox() : { x1:0,y1:0,x2:0,y2:0 };
            let ch = '';
            if (g.unicode != null) {
                try { ch = String.fromCodePoint(g.unicode); } catch(e) { ch = ''; }
            }
            return {
                index: glyphIndex,
                name: g.name,
                unicode: g.unicode,
                char: ch,
                advanceWidth: g.advanceWidth || 0,
                bbox: bb,
                path: g.path || g.getPath(0,0,72),
                numberOfContours: g.numberOfContours || (g.path ? countContours(g.path) : 0),
            };
        } catch(e) {
            console.error('[GlyphDetail] Error:', e);
            return null;
        }
    }

    function countContours(path) {
        let c = 0;
        for (const cmd of path.commands) { if (cmd.type === 'Z') c++; }
        return c;
    }

    /* ──────────────────── Public API ────────────────────────── */
    return { extractMetadata, getUnicodeCoverage, listTables, getGlyphList, getGlyphDetail, getAllMappedCodepoints };
})();
