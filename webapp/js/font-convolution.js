/**
 * font-convolution.js — Convolution filters & 80-D feature vector
 * Operates on rasterised glyph image data.
 */
window.FontConvolution = (() => {

    /* ── Kernel definitions ────────────────────────────────────── */
    const KERNELS = {
        // Edge detection
        'Sobel X':       { cat:'edge', k:[[-1,0,1],[-2,0,2],[-1,0,1]] },
        'Sobel Y':       { cat:'edge', k:[[-1,-2,-1],[0,0,0],[1,2,1]] },
        'Prewitt X':     { cat:'edge', k:[[-1,0,1],[-1,0,1],[-1,0,1]] },
        'Prewitt Y':     { cat:'edge', k:[[-1,-1,-1],[0,0,0],[1,1,1]] },
        'Roberts X':     { cat:'edge', k:[[1,0],[0,-1]] },
        'Roberts Y':     { cat:'edge', k:[[0,1],[-1,0]] },
        'Laplacian':     { cat:'edge', k:[[0,1,0],[1,-4,1],[0,1,0]] },
        'Laplacian Diag':{ cat:'edge', k:[[1,1,1],[1,-8,1],[1,1,1]] },
        'Scharr X':      { cat:'edge', k:[[-3,0,3],[-10,0,10],[-3,0,3]] },
        'Scharr Y':      { cat:'edge', k:[[-3,-10,-3],[0,0,0],[3,10,3]] },

        // Style
        'Sharpen':       { cat:'style', k:[[0,-1,0],[-1,5,-1],[0,-1,0]] },
        'Emboss':        { cat:'style', k:[[-2,-1,0],[-1,1,1],[0,1,2]] },
        'Ridge':         { cat:'style', k:[[-1,-1,-1],[-1,8,-1],[-1,-1,-1]] },
        'Unsharp Mask':  { cat:'style', k:[[1,4,6,4,1],[4,16,24,16,4],[6,24,-476,24,6],[4,16,24,16,4],[1,4,6,4,1]].map(r=>r.map(v=>v/-256)) },

        // Texture / Blur
        'Box Blur 3':    { cat:'texture', k:[[1,1,1],[1,1,1],[1,1,1]].map(r=>r.map(v=>v/9)) },
        'Box Blur 5':    { cat:'texture', k: Array(5).fill(null).map(()=>Array(5).fill(1/25)) },
        'Gaussian 3':    { cat:'texture', k:[[1,2,1],[2,4,2],[1,2,1]].map(r=>r.map(v=>v/16)) },
        'Gaussian 5':    { cat:'texture', k:[[1,4,6,4,1],[4,16,24,16,4],[6,24,36,24,6],[4,16,24,16,4],[1,4,6,4,1]].map(r=>r.map(v=>v/256)) },
        'High-Pass':     { cat:'texture', k:[[-1,-1,-1],[-1,9,-1],[-1,-1,-1]] },

        // Multi-scale
        'Gradient Mag':  { cat:'multiscale', k:null, fn:'gradientMag' },
        'LoG (5×5)':     { cat:'multiscale', k:[[0,0,1,0,0],[0,1,2,1,0],[1,2,-16,2,1],[0,1,2,1,0],[0,0,1,0,0]] },
        'Diagonal':      { cat:'multiscale', k:[[2,-1,0],[-1,2,-1],[0,-1,2]] },
    };

    /* ── Helpers ───────────────────────────────────────────────── */
    function getGrayData(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const id = ctx.getImageData(0, 0, w, h);
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) gray[i] = id.data[i * 4 + 3] / 255; // use alpha
        return { gray, w, h };
    }

    function convolve(gray, w, h, kernel) {
        const kh = kernel.length, kw = kernel[0].length;
        const oh = Math.floor(kh / 2), ow = Math.floor(kw / 2);
        const out = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                for (let ky = 0; ky < kh; ky++) {
                    for (let kx = 0; kx < kw; kx++) {
                        const ny = Math.min(h - 1, Math.max(0, y + ky - oh));
                        const nx = Math.min(w - 1, Math.max(0, x + kx - ow));
                        sum += gray[ny * w + nx] * kernel[ky][kx];
                    }
                }
                out[y * w + x] = sum;
            }
        }
        return out;
    }

    function gradientMag(gray, w, h) {
        const sx = convolve(gray, w, h, KERNELS['Sobel X'].k);
        const sy = convolve(gray, w, h, KERNELS['Sobel Y'].k);
        const out = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(sx[i] ** 2 + sy[i] ** 2);
        return out;
    }

    function floatToCanvas(data, w, h) {
        let mn = Infinity, mx = -Infinity;
        for (const v of data) { if (v < mn) mn = v; if (v > mx) mx = v; }
        const range = mx - mn || 1;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const id = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
            const v = ((data[i] - mn) / range) * 255;
            id.data[i * 4 + 0] = v;
            id.data[i * 4 + 1] = v;
            id.data[i * 4 + 2] = v;
            id.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);
        return c;
    }

    /* ── Run all filters ───────────────────────────────────────── */
    function runAll(sourceCanvas) {
        const { gray, w, h } = getGrayData(sourceCanvas);
        const results = {};
        for (const [name, def] of Object.entries(KERNELS)) {
            let data;
            if (def.fn === 'gradientMag') {
                data = gradientMag(gray, w, h);
            } else if (def.k) {
                data = convolve(gray, w, h, def.k);
            } else {
                continue;
            }
            results[name] = {
                canvas: floatToCanvas(data, w, h),
                data, w, h, cat: def.cat,
            };
        }
        return results;
    }

    /* ── Feature vector (statistics per filter) ────────────────── */
    function computeFeatureVector(results) {
        const features = {};
        for (const [name, r] of Object.entries(results)) {
            const d = r.data;
            let sum = 0, sum2 = 0, mn = Infinity, mx = -Infinity;
            for (const v of d) {
                sum += v; sum2 += v * v;
                if (v < mn) mn = v; if (v > mx) mx = v;
            }
            const n = d.length;
            const mean = sum / n;
            const std = Math.sqrt(sum2 / n - mean ** 2);
            features[name + ' mean'] = mean;
            features[name + ' std'] = std;
            features[name + ' min'] = mn;
            features[name + ' max'] = mx;
        }
        return features;
    }

    return { KERNELS, runAll, computeFeatureVector };
})();
