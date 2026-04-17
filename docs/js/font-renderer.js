/**
 * font-renderer.js — Glyph rasterisation, SDF generation, Bezier visualisation
 * Uses opentype.js path.draw() for correct rendering.
 */
window.FontRenderer = (() => {

    /* ──────────── Render a single glyph to canvas ──────────── */
    function renderGlyph(font, char, canvas, opts = {}) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const glyph = charToGlyph(font, char);
        if (!glyph) return null;

        const fontSize = opts.fontSize || Math.min(w, h) * 0.8;
        const scale = fontSize / font.unitsPerEm;

        // centre the glyph
        const bb = glyph.getBoundingBox();
        const gw = (bb.x2 - bb.x1) * scale;
        const gh = (bb.y2 - bb.y1) * scale;
        const x = (w - gw) / 2 - bb.x1 * scale;
        const y = h * 0.75;                     // baseline at 75%

        const path = glyph.getPath(x, y, fontSize);
        ctx.fillStyle = opts.color || getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
        path.fill = ctx.fillStyle;
        path.draw(ctx);

        return { glyph, path, scale, x, y, fontSize };
    }

    /* ──────────── Render rasterised bitmap (for SDF) ───────── */
    function rasterise(font, char, res) {
        const c = document.createElement('canvas');
        c.width = c.height = res;
        renderGlyph(font, char, c, { fontSize: res * 0.8 });
        const ctx = c.getContext('2d');
        const id = ctx.getImageData(0, 0, res, res);
        const binaryGrid = new Float32Array(res * res);
        for (let i = 0; i < res * res; i++) {
            binaryGrid[i] = id.data[i * 4 + 3] > 127 ? 1 : 0;
        }
        return { canvas: c, binaryGrid };
    }

    /* ──────────── SDF computation (brute-force exact) ──────── */
    function computeSDF(binaryGrid, res) {
        const sdf = new Float32Array(res * res);
        const maxD = res * 0.5;
        const search = Math.min(res, 32);       // limit search radius for perf
        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                const inside = binaryGrid[y * res + x] > 0;
                let minDist = search;
                for (let dy = -search; dy <= search; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= res) continue;
                    for (let dx = -search; dx <= search; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= res) continue;
                        const other = binaryGrid[ny * res + nx] > 0;
                        if (other !== inside) {
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < minDist) minDist = d;
                        }
                    }
                }
                sdf[y * res + x] = (inside ? minDist : -minDist) / maxD;
            }
        }
        return sdf;
    }

    function drawSDF(sdf, res, canvas) {
        canvas.width = canvas.height = res;
        const ctx = canvas.getContext('2d');
        const id = ctx.createImageData(res, res);
        for (let i = 0; i < res * res; i++) {
            const v = Math.max(0, Math.min(1, sdf[i] * 0.5 + 0.5));
            id.data[i * 4 + 0] = v * 255;
            id.data[i * 4 + 1] = v * 255;
            id.data[i * 4 + 2] = v * 255;
            id.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);
    }

    function drawContours(sdf, res, canvas) {
        canvas.width = canvas.height = res;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, res, res);
        const id = ctx.createImageData(res, res);
        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                const i = y * res + x;
                const v = sdf[i];
                const a = Math.abs(v);
                let r = 0, g = 0, b = 0, al = 255;
                if (a < 0.04) { r = 255; g = 255; b = 0; }
                else if (v > 0) { b = Math.max(0, 255 - a * 600); }
                else { r = Math.max(0, 255 - a * 600); }
                id.data[i * 4 + 0] = r;
                id.data[i * 4 + 1] = g;
                id.data[i * 4 + 2] = b;
                id.data[i * 4 + 3] = al;
            }
        }
        ctx.putImageData(id, 0, 0);
    }

    /* ──────────── Bezier Visualisation ──────────────────────── */
    function drawBezier(font, char, canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const glyph = charToGlyph(font, char);
        if (!glyph) return null;

        const fontSize = Math.min(w, h) * 0.7;
        const scale = fontSize / font.unitsPerEm;
        const bb = glyph.getBoundingBox();
        const gw = (bb.x2 - bb.x1) * scale;
        const ox = (w - gw) / 2 - bb.x1 * scale;
        const oy = h * 0.75;

        const path = glyph.getPath(ox, oy, fontSize);
        const cmds = path.commands;

        // draw filled glyph faintly
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#58a6ff';
        path.draw(ctx);
        ctx.restore();

        // Resolve theme-aware colors
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF5500';
        const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#444';

        // draw path segments
        let contours = 0, segments = 0, qCurves = 0, cCurves = 0, lines = 0;
        let cx = 0, cy = 0;
        for (const c of cmds) {
            if (c.type === 'M') {
                cx = c.x; cy = c.y;
                drawDot(ctx, cx, cy, 3, accent);
                contours++;
            } else if (c.type === 'L') {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(c.x, c.y);
                ctx.strokeStyle = text3;
                ctx.lineWidth = 1;
                ctx.stroke();
                cx = c.x; cy = c.y;
                lines++; segments++;
            } else if (c.type === 'Q') {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
                ctx.strokeStyle = accent;
                ctx.lineWidth = 1;
                ctx.stroke();
                drawDot(ctx, c.x1, c.y1, 2, text3);
                drawLine(ctx, cx, cy, c.x1, c.y1);
                drawLine(ctx, c.x1, c.y1, c.x, c.y);
                cx = c.x; cy = c.y;
                drawDot(ctx, cx, cy, 2, accent);
                qCurves++; segments++;
            } else if (c.type === 'C') {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
                ctx.strokeStyle = accent;
                ctx.lineWidth = 1;
                ctx.stroke();
                drawDot(ctx, c.x1, c.y1, 2, text3);
                drawDot(ctx, c.x2, c.y2, 2, text3);
                drawLine(ctx, cx, cy, c.x1, c.y1);
                drawLine(ctx, c.x2, c.y2, c.x, c.y);
                cx = c.x; cy = c.y;
                drawDot(ctx, cx, cy, 2, accent);
                cCurves++; segments++;
            } else if (c.type === 'Z') {
                contours; // already counted on M
            }
        }

        return { contours, segments, lines, qCurves, cCurves, commands: cmds };
    }

    function drawDot(ctx, x, y, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
    function drawLine(ctx, x1, y1, x2, y2) {
        const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#222';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = border;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /* ──────────── Helper ────────────────────────────────────── */
    function charToGlyph(font, char) {
        if (!char || !font.charToGlyphIndex) return null;
        // opentype.js 1.3.4 expects a string character, NOT a code point number
        const idx = font.charToGlyphIndex(char.charAt(0));
        if (idx === 0 || idx == null) return null;
        return font.glyphs.get(idx);
    }

    /* ──────────── Extract raw path commands ────────────────── */
    function getPathCommands(font, char, size) {
        const glyph = charToGlyph(font, char);
        if (!glyph) return null;
        const fontSize = size || 256;
        const scale = fontSize / font.unitsPerEm;
        const bb = glyph.getBoundingBox();
        const gw = (bb.x2 - bb.x1) * scale;
        const ox = (fontSize - gw) / 2 - bb.x1 * scale;
        const oy = fontSize * 0.75;
        const path = glyph.getPath(ox, oy, fontSize);
        return path.commands.map(c => ({...c}));
    }

    return { renderGlyph, rasterise, computeSDF, drawSDF, drawContours, drawBezier, charToGlyph, getPathCommands };
})();
