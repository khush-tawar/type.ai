/**
 * font-morpher.js — Vector-level morphing engine
 *
 * Operates on actual Bezier path commands (not pixels).
 * 18-step pipeline:
 *   1. Width           6. Ink Trap         11. Stem Width      16. Curve Tension
 *   2. Slant           7. Stroke Angle     12. Shoulder        17. Corner Rounding
 *   3. Weight          8. Gravity          13. Descender       18. Roughness
 *   3b. Auto-smooth    9. Crossbar         14. Smoothing
 *   4. Roundness      10. Aperture         15. Lines↔Curves
 *   5. Terminal
 *
 * Auto-smooth (3b) runs after weight to remove miter jaggedness.
 * Skeleton extraction runs BEFORE morphing to inform anatomy controls.
 * Axes: Typographic / Anatomy / Vector / Styling / Script.
 */
window.FontMorpher = (() => {

    /* ══════════════════════════════════════════════════════════════
       AXIS DEFINITIONS — organised into three control categories:
         • Typographic — metrics and spacing that affect readability
         • Styling     — visual effects / filters that remix the look
         • Script      — orientation and structural transforms
    ══════════════════════════════════════════════════════════════ */
    const AXIS_CATEGORIES = [
        { id: 'typographic', name: 'Typographic Controls', desc: 'Metrics & spacing' },
        { id: 'anatomy',     name: 'Glyph Anatomy',       desc: 'Structural features' },
        { id: 'vector',      name: 'Vector Controls',      desc: 'Points, curves & path structure' },
        { id: 'styling',     name: 'Styling Controls',     desc: 'Visual filters & effects' },
        { id: 'script',      name: 'Script Controls',      desc: 'Orientation & structure' },
    ];

    const AXES = [
        // ── Typographic ──
        { id:'weight',    name:'Weight',        min:-1, max:1, default:0, leftLabel:'Ultra Light', rightLabel:'Ultra Bold',  category:'typographic' },

        // ── Glyph Anatomy ──
        { id:'crossbar',  name:'Crossbar Height', min:-1, max:1, default:0, leftLabel:'Low',        rightLabel:'High',        category:'anatomy' },
        { id:'aperture',  name:'Aperture',         min:-1, max:1, default:0, leftLabel:'Closed',     rightLabel:'Open',        category:'anatomy' },
        { id:'stemWidth', name:'Stem Width',       min:-1, max:1, default:0, leftLabel:'Thin',       rightLabel:'Thick',       category:'anatomy' },
        { id:'shoulder',  name:'Shoulder',          min:-1, max:1, default:0, leftLabel:'Angular',    rightLabel:'Smooth',      category:'anatomy' },
        { id:'descender', name:'Descender/Ascender', min:-1, max:1, default:0, leftLabel:'Short', rightLabel:'Extended',    category:'anatomy' },

        // ── Styling ──
        { id:'roundness', name:'Roundness',      min: 0, max:1, default:0, leftLabel:'Sharp',       rightLabel:'Round',       category:'styling' },
        { id:'terminal',  name:'Terminal Style',  min:-1, max:1, default:0, leftLabel:'Flat Cut',    rightLabel:'Ball/Drop',   category:'styling' },
        { id:'inktrap',   name:'Ink Trap',       min: 0, max:1, default:0, leftLabel:'None',        rightLabel:'Deep',        category:'styling' },
        { id:'gravity',   name:'Gravity',        min:-1, max:1, default:0, leftLabel:'Expand',      rightLabel:'Compact',     category:'styling' },

        // ── Script ──
        { id:'slant',       name:'Slant',        min:-1, max:1, default:0, leftLabel:'Backslant',   rightLabel:'Italic',      category:'script' },
        { id:'width',       name:'Width',        min:-1, max:1, default:0, leftLabel:'Condensed',   rightLabel:'Extended',    category:'script' },
        { id:'strokeAngle', name:'Stroke Angle', min:-1, max:1, default:0, leftLabel:'-45°',        rightLabel:'+45°',        category:'script' },

        // ── Vector Path Controls ──
        { id:'smoothing',     name:'Smoothing',        min:-1, max:1, default:0, leftLabel:'Angular',     rightLabel:'Smooth',      category:'vector' },
        { id:'curveFlatten',  name:'Lines ↔ Curves',   min:-1, max:1, default:0, leftLabel:'All Lines',   rightLabel:'All Curves',  category:'vector' },
        { id:'curveTension',  name:'Curve Tension',    min:-1, max:1, default:0, leftLabel:'Flat',        rightLabel:'Exaggerated', category:'vector' },
        { id:'cornerRound',   name:'Corner Rounding',  min:-1, max:1, default:0, leftLabel:'Sharp',       rightLabel:'Round',       category:'vector' },
        { id:'roughness',     name:'Roughness',        min: 0, max:1, default:0, leftLabel:'Clean',       rightLabel:'Rough',       category:'vector' },
        { id:'handleLength',  name:'Handle Length',    min:-1, max:1, default:0, leftLabel:'Retracted',   rightLabel:'Extended',    category:'vector' },
        { id:'nodeSimplify',  name:'Node Density',     min:-1, max:1, default:0, leftLabel:'Simplified',  rightLabel:'Subdivided',  category:'vector' },
        { id:'contourInset',  name:'Contour Offset',   min:-1, max:1, default:0, leftLabel:'Inset',       rightLabel:'Outset',      category:'vector' },
        { id:'pointSnap',     name:'Point Snap',       min: 0, max:1, default:0, leftLabel:'Precise',     rightLabel:'Quantized',   category:'vector' },
    ];

    const PRESETS = {
        'Thin':            { weight: -0.7, smoothing: 0.1 },
        'Bold':            { weight: 0.6, smoothing: 0.15 },
        'Italic':          { slant: 0.6, strokeAngle: 0.2 },
        'Condensed':       { width: -0.5, weight: 0.1 },
        'Extended':        { width: 0.5 },
        'Round':           { roundness: 0.7, cornerRound: 0.5, shoulder: 0.5, smoothing: 0.2 },
        'Ink Trap':        { inktrap: 0.7, weight: 0.15 },
        'High Crossbar':   { crossbar: 0.6, aperture: 0.2 },
        'Geometric':       { roundness: 0.6, shoulder: 0.7, smoothing: 0.2, aperture: 0.3 },
        'Rough':           { roughness: 0.35, cornerRound: 0.15, curveTension: 0.15 },
    };

    /* ══════════════════════════════════════════════════════════════
       VECTOR MORPH PIPELINE
    ══════════════════════════════════════════════════════════════ */

    /**
     * morphCommands(cmds, axisValues, size)
     *   cmds       – array of {type, x, y, x1, y1, x2, y2} from opentype path
     *   axisValues – { weight, slant, width, roundness, contrast, terminal, serif }
     *   size       – coordinate space (e.g. 256)
     * Returns new array of commands (deep copied).
     */
    function morphCommands(cmds, axisValues, size) {
        if (!cmds || !cmds.length) return [];
        let out = deepCopy(cmds);
        const av = Object.assign({}, defaultValues(), axisValues);
        const cx = size / 2, cy = size / 2;

        // 1. Width scaling
        if (av.width !== 0) {
            const sx = 1 + av.width * 0.5;            // ±50 % hscale
            out = transformPoints(out, (x, y) => [cx + (x - cx) * sx, y]);
        }

        // 2. Slant (shear)
        if (av.slant !== 0) {
            const shear = av.slant * 0.35;             // max ~20°
            const baseline = size * 0.75;
            out = transformPoints(out, (x, y) => [x + (baseline - y) * shear, y]);
        }

        // 3. Weight (offset/inset contours using normals)
        if (av.weight !== 0) {
            out = applyWeight(out, av.weight, size);
            // 3b. Auto-smooth: remove miter jaggedness from weight offset
            const autoSmooth = Math.min(Math.abs(av.weight) * 0.8, 0.5);
            const passes = Math.ceil(Math.abs(av.weight) * 4) + 1;
            if (autoSmooth > 0.02) {
                out = laplacianSmooth(out, autoSmooth, passes);
            }
        }

        // 4. Roundness (smooth corners)
        if (av.roundness > 0.01) {
            out = applyRoundness(out, av.roundness);
        }

        // 5. Terminal style (reshape endpoints)
        if (Math.abs(av.terminal) > 0.01) {
            out = applyTerminal(out, av.terminal, size);
        }

        // 6. Ink Trap — push sharp inner corners outward
        if (av.inktrap > 0.01) {
            out = applyInkTrap(out, av.inktrap, size);
        }

        // 7. Stroke Angle — rotate before/after contrast-like effect
        if (av.strokeAngle !== 0) {
            const angle = av.strokeAngle * Math.PI * 0.25;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const cxr = size / 2, cyr = size / 2;
            // Slight directional contrast based on rotated axes
            out = transformPoints(out, (x, y) => {
                const dx = x - cxr, dy = y - cyr;
                const rx = dx * cos + dy * sin;   // rotated x
                const ry = -dx * sin + dy * cos;  // rotated y
                const stretch = 1 + Math.abs(rx) / size * 0.08;
                const squeeze = 1 - Math.abs(ry) / size * 0.04;
                return [cxr + dx * stretch, cyr + dy * squeeze];
            });
        }

        // 8. Gravity — pull/push points toward/from center
        if (av.gravity !== 0) {
            const allPts = [];
            for (const c of out) { if (c.x !== undefined) allPts.push([c.x, c.y]); }
            if (allPts.length > 0) {
                const ctr = centroid(allPts);
                const strength = av.gravity * 0.2;
                out = transformPoints(out, (x, y) => {
                    const dx = x - ctr[0], dy = y - ctr[1];
                    const d = Math.sqrt(dx * dx + dy * dy) || 1;
                    const factor = 1 - strength * (d / (size * 0.5));
                    return [ctr[0] + dx * factor, ctr[1] + dy * factor];
                });
            }
        }

        // ── 9. Crossbar Height — shift horizontal midline features up/down ──
        if (av.crossbar !== 0) {
            out = applyCrossbarHeight(out, av.crossbar, size);
        }

        // ── 10. Aperture — widen/narrow counter openings ──
        if (av.aperture !== 0) {
            out = applyAperture(out, av.aperture, size);
        }

        // ── 11. Stem Width — selective thickening of vertical strokes ──
        if (av.stemWidth !== 0) {
            out = applyStemWidth(out, av.stemWidth, size);
        }

        // ── 12. Shoulder — smooth or sharpen curved-to-stem transitions ──
        if (Math.abs(av.shoulder) > 0.01) {
            out = applyShoulder(out, av.shoulder, size);
        }

        // ── 13. Descender/Ascender — extend extremes vertically ──
        if (av.descender !== 0) {
            out = applyDescender(out, av.descender, size);
        }

        // ── 14. Smoothing — Laplacian smooth (>0) or angularize (<0) ──
        if (Math.abs(av.smoothing) > 0.01) {
            out = applySmoothing(out, av.smoothing, size);
        }

        // ── 15. Lines ↔ Curves — convert segments between types ──
        if (Math.abs(av.curveFlatten) > 0.01) {
            out = applyCurveFlatten(out, av.curveFlatten);
        }

        // ── 16. Curve Tension — exaggerate or flatten existing curves ──
        if (Math.abs(av.curveTension) > 0.01) {
            out = applyCurveTension(out, av.curveTension);
        }

        // ── 17. Corner Rounding — round sharp corners or sharpen curves ──
        if (Math.abs(av.cornerRound) > 0.01) {
            out = applyCornerRound(out, av.cornerRound, size);
        }

        // ── 18. Roughness — deterministic noise for hand-drawn feel ──
        if (av.roughness > 0.01) {
            out = applyRoughness(out, av.roughness, size);
        }

        // ── 19. Handle Length — scale Bézier control handles ──
        if (Math.abs(av.handleLength) > 0.01) {
            out = applyHandleLength(out, av.handleLength);
        }

        // ── 20. Node Density — simplify or subdivide ──
        if (Math.abs(av.nodeSimplify) > 0.01) {
            out = applyNodeSimplify(out, av.nodeSimplify, size);
        }

        // ── 21. Contour Offset — inset/outset paths ──
        if (Math.abs(av.contourInset) > 0.01) {
            out = applyContourOffset(out, av.contourInset, size);
        }

        // ── 22. Point Snap — quantize coordinates ──
        if (av.pointSnap > 0.01) {
            out = applyPointSnap(out, av.pointSnap, size);
        }

        // ── 23. Structural constraints — clamp point displacement ──
        out = enforceStructuralConstraints(cmds, out, size);

        return out;
    }

    /**
     * Structural constraints: prevent morphed glyph from degenerating.
     * - Max per-point displacement: 40% of glyph diagonal
     * - Bounding box can't grow/shrink beyond 20%-200% of original
     * These limits keep the glyph recognisable regardless of slider values.
     */
    function enforceStructuralConstraints(originalCmds, morphedCmds, size) {
        // 1. Per-point displacement clamping (only if arrays are same length)
        if (originalCmds.length === morphedCmds.length) {
            const bbox = commandsBBox(originalCmds);
            const diagW = (bbox.maxX - bbox.minX) || 1;
            const diagH = (bbox.maxY - bbox.minY) || 1;
            const diag = Math.sqrt(diagW * diagW + diagH * diagH);
            const maxDist = diag * 0.40; // 40% of diagonal

            for (let i = 0; i < morphedCmds.length; i++) {
                const m = morphedCmds[i];
                const o = originalCmds[i];
                if (m.x !== undefined && o.x !== undefined) {
                    let dx = m.x - o.x, dy = m.y - o.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > maxDist) {
                        const s = maxDist / d;
                        m.x = o.x + dx * s;
                        m.y = o.y + dy * s;
                    }
                }
                if (m.x1 !== undefined && o.x1 !== undefined) {
                    let dx = m.x1 - o.x1, dy = m.y1 - o.y1;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > maxDist) {
                        const s = maxDist / d;
                        m.x1 = o.x1 + dx * s;
                        m.y1 = o.y1 + dy * s;
                    }
                }
                if (m.x2 !== undefined && o.x2 !== undefined) {
                    let dx = m.x2 - o.x2, dy = m.y2 - o.y2;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > maxDist) {
                        const s = maxDist / d;
                        m.x2 = o.x2 + dx * s;
                        m.y2 = o.y2 + dy * s;
                    }
                }
            }
        }

        // 2. Bounding box constraint — scale back if too large/small
        const origBB = commandsBBox(originalCmds);
        const morphBB = commandsBBox(morphedCmds);
        const origW = (origBB.maxX - origBB.minX) || 1;
        const origH = (origBB.maxY - origBB.minY) || 1;
        const morphW = (morphBB.maxX - morphBB.minX) || 1;
        const morphH = (morphBB.maxY - morphBB.minY) || 1;
        const scaleX = morphW / origW;
        const scaleY = morphH / origH;
        const minScale = 0.20, maxScale = 2.0;

        if (scaleX < minScale || scaleX > maxScale || scaleY < minScale || scaleY > maxScale) {
            const clampSX = Math.max(minScale, Math.min(maxScale, scaleX));
            const clampSY = Math.max(minScale, Math.min(maxScale, scaleY));
            const origCX = (origBB.minX + origBB.maxX) / 2;
            const origCY = (origBB.minY + origBB.maxY) / 2;
            const morphCX = (morphBB.minX + morphBB.maxX) / 2;
            const morphCY = (morphBB.minY + morphBB.maxY) / 2;
            morphedCmds = transformPoints(morphedCmds, (x, y) => {
                const dx = x - morphCX;
                const dy = y - morphCY;
                return [
                    origCX + dx * (clampSX / scaleX),
                    origCY + dy * (clampSY / scaleY)
                ];
            });
        }

        return morphedCmds;
    }

    /* ──────── Helpers ──────────────────────────────────────────── */
    function deepCopy(cmds) {
        return cmds.map(c => ({ ...c }));
    }

    function defaultValues() {
        const v = {};
        for (const a of AXES) v[a.id] = a.default;
        return v;
    }

    function transformPoints(cmds, fn) {
        return cmds.map(c => {
            const r = { ...c };
            if (r.x !== undefined && r.y !== undefined) {
                [r.x, r.y] = fn(r.x, r.y);
            }
            if (r.x1 !== undefined && r.y1 !== undefined) {
                [r.x1, r.y1] = fn(r.x1, r.y1);
            }
            if (r.x2 !== undefined && r.y2 !== undefined) {
                [r.x2, r.y2] = fn(r.x2, r.y2);
            }
            return r;
        });
    }

    /* ──────── Weight: offset contours along tangent-derived normals ────── */
    // Typographically correct weight change:
    //   • Compute actual tangent directions at each vertex from path commands
    //   • Derive miter normals at corners for uniform, smooth expansion
    //   • Offset Bézier control points consistently with their anchor points
    //     so curve shape and tangent continuity are preserved.
    //   • Inner contours (counters) shrink when outer contours grow.
    //
    // COORDINATE SYSTEM NOTE (screen coords, y-down):
    //   In screen coordinates, the left-hand normal (-ty, tx) points INWARD
    //   for CCW contours. OpenType.js returns outer contours as CCW (positive
    //   signed area) and inner counters as CW (negative signed area) in screen
    //   space. To make weight > 0 → BOLDER (outlines expand, counters shrink),
    //   we negate the direction for outer contours so the offset pushes points
    //   OUTWARD (against the inward-pointing normal).
    function applyWeight(cmds, weight, size) {
        const maxOffset = size * 0.06;           // max ±6% of coordinate space
        const offset = weight * maxOffset;
        const contours = splitContours(cmds);
        const result = [];

        // ── Build contour hierarchy to understand nesting ──
        const contourMeta = analyseContourHierarchy(contours);

        // ════════════════════════════════════════════════════════════
        // GLOBAL WINDING DETECTION
        //
        // The normal (-ty, tx) rotates the tangent 90° CCW (math).
        // Its inward/outward sense depends on the font's winding convention:
        //
        //   TrueType → outer = CW in font (y-up) → positive signed area
        //              in screen coords (y-down).  Normal points INWARD.
        //   CFF      → outer = CCW in font (y-up) → negative signed area
        //              in screen coords.            Normal points OUTWARD.
        //
        // For weight > 0 (bolder), ALL contours must move in the SAME
        // direction: opposite to the outer's normal direction.
        //
        //   TrueType (outer area > 0): normal inward  → move outward → dir = -1
        //   CFF      (outer area < 0): normal outward → move inward err..
        //                              actually: expand outer = move along normal
        //                                        → dir = +1
        //
        // Detect from the largest contour (always the outer shell):
        // ════════════════════════════════════════════════════════════
        let maxAbsArea = 0;
        let globalDir = -1;   // default: TrueType convention
        for (let ci = 0; ci < contours.length; ci++) {
            const pts = contourToPoints(contours[ci], 48);
            if (pts.length < 3) continue;
            const a = signedArea(pts);
            if (Math.abs(a) > maxAbsArea) {
                maxAbsArea = Math.abs(a);
                // Largest contour = outer shell.
                // positive area → TrueType (normal inward)  → dir = -1
                // negative area → CFF      (normal outward) → dir = +1
                globalDir = a > 0 ? -1 : 1;
            }
        }

        // Debug: log winding detection (only on first call per morph)
        if (weight !== 0) {
            console.log(`[Weight] weight=${weight.toFixed(2)}, offset=${offset.toFixed(2)}, globalDir=${globalDir}, contours=${contours.length}`);
            for (let ci = 0; ci < contours.length; ci++) {
                const pts = contourToPoints(contours[ci], 48);
                const a = pts.length >= 3 ? signedArea(pts) : 0;
                const meta = contourMeta[ci];
                console.log(`  contour[${ci}]: area=${a.toFixed(1)}, role=${meta?.role}, amt=${(offset * globalDir).toFixed(2)}`);
            }
        }

        for (let ci = 0; ci < contours.length; ci++) {
            const contour = contours[ci];
            if (contour.length < 3) { result.push(...contour); continue; }

            const samplePts = contourToPoints(contour, 48);
            if (samplePts.length < 3) { result.push(...contour); continue; }

            // ALL contours use the same direction — the normal geometry
            // already encodes the correct inward/outward sense per contour.
            const amt = offset * globalDir;

            // ── Clamp offset to prevent counter collapse ──
            const meta = contourMeta[ci];
            const clampedAmt = clampOffsetForContour(amt, meta, size);

            // Count on-curve anchors (every cmd except Z has x,y)
            const hasZ = contour[contour.length - 1].type === 'Z';
            const anchorN = hasZ ? contour.length - 1 : contour.length;
            if (anchorN < 3) { result.push(...contour); continue; }

            /* ── Per-anchor miter normals from actual tangent geometry ─── */
            const normals = [];          // {nx, ny} per anchor, miter-scaled
            const effectiveAmt = clampedAmt;   // use clamped offset

            for (let i = 0; i < anchorN; i++) {
                const curr = contour[i];
                const prevI = (i - 1 + anchorN) % anchorN;
                const nextI = (i + 1) % anchorN;
                const prevAnchor = contour[prevI];
                const nextCmd    = contour[nextI];

                // ── Incoming tangent at anchor i ──
                let inTx, inTy;
                if (i === 0) {
                    // M point: incoming = closing edge (last anchor → M)
                    const last = contour[anchorN - 1];
                    inTx = curr.x - last.x;
                    inTy = curr.y - last.y;
                } else {
                    const cmd = contour[i];
                    if (cmd.type === 'C' && cmd.x2 !== undefined) {
                        inTx = cmd.x - cmd.x2;
                        inTy = cmd.y - cmd.y2;
                        if (inTx * inTx + inTy * inTy < 0.01) {
                            inTx = cmd.x - prevAnchor.x;
                            inTy = cmd.y - prevAnchor.y;
                        }
                    } else if (cmd.type === 'Q' && cmd.x1 !== undefined) {
                        inTx = cmd.x - cmd.x1;
                        inTy = cmd.y - cmd.y1;
                        if (inTx * inTx + inTy * inTy < 0.01) {
                            inTx = cmd.x - prevAnchor.x;
                            inTy = cmd.y - prevAnchor.y;
                        }
                    } else {
                        inTx = cmd.x - prevAnchor.x;
                        inTy = cmd.y - prevAnchor.y;
                    }
                }

                // ── Outgoing tangent from anchor i ──
                let outTx, outTy;
                if (nextI === 0 && hasZ) {
                    // Closing edge: this anchor → M
                    outTx = contour[0].x - curr.x;
                    outTy = contour[0].y - curr.y;
                } else {
                    if (nextCmd.type === 'C' && nextCmd.x1 !== undefined) {
                        outTx = nextCmd.x1 - curr.x;
                        outTy = nextCmd.y1 - curr.y;
                        if (outTx * outTx + outTy * outTy < 0.01) {
                            outTx = nextCmd.x - curr.x;
                            outTy = nextCmd.y - curr.y;
                        }
                    } else if (nextCmd.type === 'Q' && nextCmd.x1 !== undefined) {
                        outTx = nextCmd.x1 - curr.x;
                        outTy = nextCmd.y1 - curr.y;
                        if (outTx * outTx + outTy * outTy < 0.01) {
                            outTx = nextCmd.x - curr.x;
                            outTy = nextCmd.y - curr.y;
                        }
                    } else {
                        outTx = nextCmd.x - curr.x;
                        outTy = nextCmd.y - curr.y;
                    }
                }

                // Normalise tangent vectors
                let inLen  = Math.sqrt(inTx * inTx + inTy * inTy);
                let outLen = Math.sqrt(outTx * outTx + outTy * outTy);
                if (inLen  < 0.001) { inTx  = 1; inTy  = 0; inLen  = 1; }
                if (outLen < 0.001) { outTx = 1; outTy = 0; outLen = 1; }
                inTx  /= inLen;   inTy  /= inLen;
                outTx /= outLen;  outTy /= outLen;

                // Per-edge normals (rotate tangent 90° CCW: (tx,ty) → (-ty,tx))
                const inNx  = -inTy,  inNy  = inTx;
                const outNx = -outTy, outNy = outTx;

                // Miter normal: average of the two edge normals, scaled so the
                // perpendicular offset from each edge equals |amt|
                let mx = inNx + outNx;
                let my = inNy + outNy;
                let mLen = Math.sqrt(mx * mx + my * my);

                if (mLen < 0.02) {
                    // Nearly opposite normals (knife-edge cusp) → use incoming
                    normals.push({ nx: inNx, ny: inNy });
                } else {
                    mx /= mLen;  my /= mLen;
                    const dot = mx * inNx + my * inNy;   // cos(half-angle)

                    // ── Adaptive miter with bevel fallback for sharp corners ──
                    // dot ≈ 1.0 = smooth/straight, dot ≈ 0 = 90°, dot < 0 = reflex
                    //
                    // Old approach used 3.0 cap which causes miter explosion at
                    // the apex of letters like A, V, W, M.  New approach:
                    //   smooth corners (dot > 0.5): standard miter, cap 2.0
                    //   medium corners (0.15–0.5): blend from full miter → round
                    //   sharp corners  (dot < 0.15): round join (scale ≈ 1.0)
                    //
                    // This prevents the "diagonal arm" artifact at sharp angles
                    // while preserving correct offset geometry at smooth curves.
                    let miterScale;
                    if (dot > 0.5) {
                        // Gentle curve / obtuse corner — full miter, capped
                        miterScale = Math.min(1 / dot, 2.0);
                    } else if (dot > 0.15) {
                        // Moderately sharp — smooth blend: miter → round join
                        const t = (dot - 0.15) / (0.5 - 0.15); // 0→1
                        const fullMiter = Math.min(1 / dot, 2.0);
                        miterScale = 1.0 + t * (fullMiter - 1.0);
                    } else {
                        // Very sharp corner (A apex, V bottom) — round join
                        miterScale = 1.0;
                    }
                    normals.push({ nx: mx * miterScale, ny: my * miterScale });
                }
            }

            /* ── Apply offsets to contour commands ──────────────────── */
            const offsetContour = [];
            for (let i = 0; i < contour.length; i++) {
                const c = contour[i];
                const r = { ...c };

                if (c.type === 'Z') { offsetContour.push(r); continue; }
                if (i >= anchorN)   { offsetContour.push(r); continue; }

                const { nx, ny } = normals[i];

                // Offset the on-curve point
                r.x += nx * effectiveAmt;
                r.y += ny * effectiveAmt;

                // Offset control points using their *associated anchor's* normal
                // so the curve shape and tangent continuity are preserved.
                if (c.type === 'C') {
                    const prevK = (i - 1 + anchorN) % anchorN;
                    const { nx: pnx, ny: pny } = normals[prevK];
                    // x1,y1 is the tangent handle leaving the previous anchor
                    r.x1 += pnx * effectiveAmt;
                    r.y1 += pny * effectiveAmt;
                    // x2,y2 is the tangent handle arriving at this anchor
                    r.x2 += nx * effectiveAmt;
                    r.y2 += ny * effectiveAmt;
                } else if (c.type === 'Q') {
                    const prevK = (i - 1 + anchorN) % anchorN;
                    const { nx: pnx, ny: pny } = normals[prevK];
                    // Shared control point → average of start and end offsets
                    r.x1 += (pnx + nx) / 2 * effectiveAmt;
                    r.y1 += (pny + ny) / 2 * effectiveAmt;
                }

                offsetContour.push(r);
            }

            result.push(...offsetContour);
        }
        return result;
    }

    function splitContours(cmds) {
        const contours = [];
        let cur = [];
        for (const c of cmds) {
            cur.push(c);
            if (c.type === 'Z') { contours.push(cur); cur = []; }
        }
        if (cur.length) contours.push(cur);
        return contours;
    }

    function contourToPoints(contour, density) {
        const pts = [];
        let cx = 0, cy = 0;
        for (const c of contour) {
            if (c.type === 'M') { cx = c.x; cy = c.y; pts.push([cx, cy]); }
            else if (c.type === 'L') { cx = c.x; cy = c.y; pts.push([cx, cy]); }
            else if (c.type === 'Q') {
                for (let t = 1; t <= density; t++) {
                    const tt = t / density;
                    const x = (1-tt)*(1-tt)*cx + 2*(1-tt)*tt*c.x1 + tt*tt*c.x;
                    const y = (1-tt)*(1-tt)*cy + 2*(1-tt)*tt*c.y1 + tt*tt*c.y;
                    pts.push([x, y]);
                }
                cx = c.x; cy = c.y;
            } else if (c.type === 'C') {
                for (let t = 1; t <= density; t++) {
                    const tt = t / density;
                    const x = (1-tt)**3*cx + 3*(1-tt)**2*tt*c.x1 + 3*(1-tt)*tt**2*c.x2 + tt**3*c.x;
                    const y = (1-tt)**3*cy + 3*(1-tt)**2*tt*c.y1 + 3*(1-tt)*tt**2*c.y2 + tt**3*c.y;
                    pts.push([x, y]);
                }
                cx = c.x; cy = c.y;
            }
        }
        return pts;
    }

    // (computeNormals removed — superseded by tangent-derived miter normals in applyWeight)

    function signedArea(pts) {
        let a = 0;
        for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
        }
        return a / 2;
    }

    // (closestNormal removed — superseded by per-anchor miter normals in applyWeight)

    /* ══════════════════════════════════════════════════════════════
       CONTOUR HIERARCHY & TOPOLOGY ANALYSIS
       Determines which contours are outer shells vs inner counters,
       builds a nesting tree, and computes structural metrics to
       prevent degenerate morphing (counter collapse, self-intersection).
    ══════════════════════════════════════════════════════════════ */

    /**
     * Point-in-polygon using ray casting (works in screen coords).
     */
    function pointInPolygon(px, py, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1];
            const xj = pts[j][0], yj = pts[j][1];
            if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Compute the minimum "radius" of a contour — the smallest distance from
     * the centroid to any sampled point. Used to detect counter collapse.
     */
    function contourMinRadius(pts) {
        const ctr = centroid(pts);
        let minR = Infinity;
        for (const [x, y] of pts) {
            const d = Math.sqrt((x - ctr[0]) ** 2 + (y - ctr[1]) ** 2);
            if (d < minR) minR = d;
        }
        return minR;
    }

    /**
     * Compute bounding box of a sampled contour.
     */
    function contourBBox(pts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of pts) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Analyse contour hierarchy: determine nesting depth, parent-child
     * relationships, and structural role of each contour.
     *
     * Returns array of metadata objects, one per contour:
     *   { role: 'outer'|'counter'|'nested', depth, parentIndex, area, bbox, minRadius }
     */
    function analyseContourHierarchy(contours) {
        const meta = [];
        const contourSamples = [];

        // Sample each contour and compute basic metrics
        for (let i = 0; i < contours.length; i++) {
            const pts = contourToPoints(contours[i], 48);
            const area = pts.length >= 3 ? signedArea(pts) : 0;
            const bbox = pts.length >= 3 ? contourBBox(pts) : { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
            const minR = pts.length >= 3 ? contourMinRadius(pts) : 0;
            const ctr = pts.length >= 3 ? centroid(pts) : [0, 0];
            contourSamples.push(pts);
            meta.push({
                index: i,
                role: 'outer',              // will be refined below
                depth: 0,
                parentIndex: -1,
                area: area,
                absArea: Math.abs(area),
                bbox,
                minRadius: minR,
                centroid: ctr,
                // In screen coords (y-down), the shoelace formula gives:
                //   positive area → visually CW on screen (TrueType outer)
                //   negative area → visually CCW on screen (TrueType counter)
                windingScreen: area > 0 ? 'CW' : 'CCW',
                signedArea: area,
            });
        }

        // Determine nesting: for each contour, check if its centroid is inside another
        for (let i = 0; i < contours.length; i++) {
            let bestParent = -1;
            let bestParentArea = Infinity;
            for (let j = 0; j < contours.length; j++) {
                if (i === j) continue;
                if (contourSamples[j].length < 3) continue;
                // Is contour i's centroid inside contour j?
                if (pointInPolygon(meta[i].centroid[0], meta[i].centroid[1], contourSamples[j])) {
                    // Pick the smallest containing contour as the direct parent
                    if (meta[j].absArea < bestParentArea) {
                        bestParentArea = meta[j].absArea;
                        bestParent = j;
                    }
                }
            }
            meta[i].parentIndex = bestParent;
        }

        // Compute depth and role from nesting chain
        for (let i = 0; i < meta.length; i++) {
            let depth = 0;
            let cur = meta[i].parentIndex;
            while (cur >= 0 && depth < 10) {
                depth++;
                cur = meta[cur].parentIndex;
            }
            meta[i].depth = depth;
            // Even depth = outer shell (or nested island), odd depth = counter/hole
            meta[i].role = depth === 0 ? 'outer' : (depth % 2 === 1 ? 'counter' : 'nested');
        }

        return meta;
    }

    /**
     * Clamp the weight offset for a contour to prevent counter collapse
     * or excessive expansion. Uses proportional limiting:
     *   - Counters: preserve at least 20% of original radius
     *   - Outer: cap at 5% of coordinate space
     *   - When thinning (offset < 0), apply softer curve to prevent
     *     thin areas from collapsing before thick areas
     */
    function clampOffsetForContour(amt, meta, size) {
        if (!meta) return amt;

        if (meta.role === 'counter') {
            // For counters: preserve at least 15% of counter radius
            const maxShrink = meta.minRadius * 0.85;
            if (Math.abs(amt) > maxShrink) {
                const excess = Math.abs(amt) - maxShrink;
                const softened = maxShrink + Math.sqrt(excess) * 0.4;
                return Math.sign(amt) * Math.min(softened, maxShrink);
            }
        } else if (meta.role === 'outer') {
            // For outer contours: cap at 8% of coordinate space
            const maxExpand = Math.min(size * 0.08, meta.minRadius * 0.5);
            if (Math.abs(amt) > maxExpand) {
                return Math.sign(amt) * maxExpand;
            }
        }
        return amt;
    }

    /* ══════════════════════════════════════════════════════════════
       GLYPH TOPOLOGY — Structural feature detection
       Identifies what makes a character recognisable: stems, cross-
       bars, bowls, counters, terminals, and stroke relationships.
       This enables structure-preserving morphing and character
       identity validation.
    ══════════════════════════════════════════════════════════════ */

    /**
     * analyseGlyphTopology(cmds, size)
     *
     * Takes path commands for a single glyph and returns a rich topology
     * description including:
     *   - contours[]     — hierarchy with roles, areas, bboxes
     *   - structure       — detected features (stems, crossbars, bowls, counters)
     *   - identity        — character class hints
     *   - metrics         — stroke widths, proportions
     *   - sdfProfile      — sampled SDF cross-sections for validation
     */
    function analyseGlyphTopology(cmds, size) {
        if (!cmds || !cmds.length) return null;

        const contours = splitContours(cmds);
        const hierarchy = analyseContourHierarchy(contours);

        // ── Sample the glyph to a binary raster for stroke analysis ──
        const res = 64;
        const raster = rasteriseCommandsToGrid(cmds, size, res);

        // ── Detect horizontal and vertical strokes via run-length analysis ──
        const hStrokes = detectHorizontalStrokes(raster, res);
        const vStrokes = detectVerticalStrokes(raster, res);

        // ── Compute stroke width statistics ──
        const strokeWidths = computeStrokeWidths(raster, res);

        // ── Detect structural features ──
        const features = detectStructuralFeatures(cmds, size, hierarchy, hStrokes, vStrokes, raster, res);

        // ── SDF cross-sections for morphing validation ──
        const sdfProfiles = computeSDFProfiles(raster, res);

        return {
            contours: hierarchy,
            numOuter: hierarchy.filter(c => c.role === 'outer').length,
            numCounters: hierarchy.filter(c => c.role === 'counter').length,
            numNested: hierarchy.filter(c => c.role === 'nested').length,
            structure: features,
            strokeWidths,
            sdfProfiles,
            raster,
            rasterRes: res,
        };
    }

    /**
     * Rasterise path commands to a binary grid (for analysis, not display).
     */
    function rasteriseCommandsToGrid(cmds, size, res) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = res;
        const ctx = canvas.getContext('2d');

        // Scale commands from 'size' coordinate space to 'res'
        const scale = res / size;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.beginPath();
        for (const c of cmds) {
            switch (c.type) {
                case 'M': ctx.moveTo(c.x, c.y); break;
                case 'L': ctx.lineTo(c.x, c.y); break;
                case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                case 'Z': ctx.closePath(); break;
            }
        }
        ctx.fillStyle = '#fff';
        ctx.fill('nonzero');
        ctx.restore();

        const id = ctx.getImageData(0, 0, res, res);
        const grid = new Uint8Array(res * res);
        for (let i = 0; i < res * res; i++) {
            grid[i] = id.data[i * 4 + 3] > 127 ? 1 : 0;
        }
        return grid;
    }

    /**
     * Detect horizontal strokes (crossbars, etc.) by scanning each row.
     * Returns array of { y, xStart, xEnd, width } normalised to [0,1].
     */
    function detectHorizontalStrokes(grid, res) {
        const strokes = [];
        for (let y = 0; y < res; y++) {
            let inStroke = false, xStart = 0;
            for (let x = 0; x <= res; x++) {
                const on = x < res ? grid[y * res + x] > 0 : false;
                if (on && !inStroke) { inStroke = true; xStart = x; }
                if (!on && inStroke) {
                    inStroke = false;
                    strokes.push({ y: y / res, xStart: xStart / res, xEnd: x / res, width: (x - xStart) / res });
                }
            }
        }
        return strokes;
    }

    /**
     * Detect vertical strokes by scanning each column.
     * Returns array of { x, yStart, yEnd, height } normalised to [0,1].
     */
    function detectVerticalStrokes(grid, res) {
        const strokes = [];
        for (let x = 0; x < res; x++) {
            let inStroke = false, yStart = 0;
            for (let y = 0; y <= res; y++) {
                const on = y < res ? grid[y * res + x] > 0 : false;
                if (on && !inStroke) { inStroke = true; yStart = y; }
                if (!on && inStroke) {
                    inStroke = false;
                    strokes.push({ x: x / res, yStart: yStart / res, yEnd: y / res, height: (y - yStart) / res });
                }
            }
        }
        return strokes;
    }

    /**
     * Compute stroke width distribution via distance-to-edge sampling.
     * Returns { min, max, mean, median, horizontal, vertical }.
     */
    function computeStrokeWidths(grid, res) {
        // Quick approach: for each filled pixel, find nearest empty pixel
        const widths = [];
        const hWidths = []; // horizontal stroke widths (at each row)
        const vWidths = []; // vertical stroke widths (at each col)

        // Horizontal run-lengths
        for (let y = 0; y < res; y++) {
            let run = 0;
            for (let x = 0; x <= res; x++) {
                const on = x < res ? grid[y * res + x] > 0 : false;
                if (on) { run++; }
                else if (run > 0) { hWidths.push(run / res); widths.push(run / res); run = 0; }
            }
        }

        // Vertical run-lengths
        for (let x = 0; x < res; x++) {
            let run = 0;
            for (let y = 0; y <= res; y++) {
                const on = y < res ? grid[y * res + x] > 0 : false;
                if (on) { run++; }
                else if (run > 0) { vWidths.push(run / res); widths.push(run / res); run = 0; }
            }
        }

        widths.sort((a, b) => a - b);
        hWidths.sort((a, b) => a - b);
        vWidths.sort((a, b) => a - b);

        const stats = arr => {
            if (!arr.length) return { min: 0, max: 0, mean: 0, median: 0 };
            return {
                min: arr[0],
                max: arr[arr.length - 1],
                mean: arr.reduce((s, v) => s + v, 0) / arr.length,
                median: arr[Math.floor(arr.length / 2)],
            };
        };

        return {
            overall: stats(widths),
            horizontal: stats(hWidths),
            vertical: stats(vWidths),
        };
    }

    /**
     * Detect structural features: stems, crossbars, bowls, serifs, etc.
     * Uses a combination of contour analysis and raster scanning.
     */
    function detectStructuralFeatures(cmds, size, hierarchy, hStrokes, vStrokes, grid, res) {
        const features = {
            stems: [],           // vertical strokes (main structural supports)
            crossbars: [],       // horizontal connecting strokes
            bowls: [],           // curved enclosed regions
            counters: [],        // holes/enclosed spaces
            terminals: [],       // stroke endpoints
            hasDiagonals: false, // diagonal strokes present
            hasSerifs: false,    // serif features detected
            symmetryAxis: null,  // 'vertical', 'horizontal', 'both', or null
        };

        // ── Counters from contour hierarchy ──
        for (const c of hierarchy) {
            if (c.role === 'counter') {
                const aspectRatio = c.bbox.width / Math.max(c.bbox.height, 0.001);
                features.counters.push({
                    bbox: c.bbox,
                    area: c.absArea,
                    aspectRatio,
                    isRound: aspectRatio > 0.6 && aspectRatio < 1.5,
                    centroid: c.centroid
                });
            }
        }

        // ── Detect bowls (round counters) ──
        features.bowls = features.counters.filter(c => c.isRound);

        // ── Detect dominant vertical strokes (stems) ──
        // Group vertical runs by x-position and find consistent tall runs
        const vRunsByX = new Map();
        for (const v of vStrokes) {
            const xBucket = Math.round(v.x * 20) / 20; // bucket to 5% increments
            if (!vRunsByX.has(xBucket)) vRunsByX.set(xBucket, []);
            vRunsByX.get(xBucket).push(v);
        }
        for (const [x, runs] of vRunsByX) {
            const tallRuns = runs.filter(r => r.height > 0.3); // > 30% of glyph height
            if (tallRuns.length > 0) {
                const avgHeight = tallRuns.reduce((s, r) => s + r.height, 0) / tallRuns.length;
                features.stems.push({ x, avgHeight, count: tallRuns.length });
            }
        }

        // ── Detect crossbars (wide horizontal strokes in the middle zone) ──
        const midYMin = 0.3, midYMax = 0.7;
        const midHStrokes = hStrokes.filter(s => s.y > midYMin && s.y < midYMax && s.width > 0.15);
        // Group by y-position
        const hRunsByY = new Map();
        for (const h of midHStrokes) {
            const yBucket = Math.round(h.y * 20) / 20;
            if (!hRunsByY.has(yBucket)) hRunsByY.set(yBucket, []);
            hRunsByY.get(yBucket).push(h);
        }
        for (const [y, runs] of hRunsByY) {
            if (runs.length > 0) {
                const maxWidth = Math.max(...runs.map(r => r.width));
                features.crossbars.push({ y, maxWidth, count: runs.length });
            }
        }

        // ── Detect diagonals via filled-pixel angle distribution ──
        let diagCount = 0, totalChecked = 0;
        for (let y = 1; y < res - 1; y++) {
            for (let x = 1; x < res - 1; x++) {
                if (grid[y * res + x] === 0) continue;
                totalChecked++;
                // Check diagonal neighbors
                const diagFill = (grid[(y-1)*res+(x-1)] + grid[(y-1)*res+(x+1)] +
                                  grid[(y+1)*res+(x-1)] + grid[(y+1)*res+(x+1)]);
                const orthFill = (grid[(y-1)*res+x] + grid[y*res+(x-1)] +
                                  grid[(y+1)*res+x] + grid[y*res+(x+1)]);
                if (diagFill > orthFill) diagCount++;
            }
        }
        features.hasDiagonals = totalChecked > 0 && (diagCount / totalChecked) > 0.25;

        // ── Detect vertical symmetry ──
        let symScore = 0, symTotal = 0;
        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res / 2; x++) {
                const left = grid[y * res + x];
                const right = grid[y * res + (res - 1 - x)];
                if (left === right) symScore++;
                symTotal++;
            }
        }
        if (symTotal > 0 && symScore / symTotal > 0.85) {
            features.symmetryAxis = 'vertical';
        }

        // ── Detect serifs (tiny horizontal extensions at stroke endpoints) ──
        // Look at the top and bottom rows for small horizontal runs
        const topRows = hStrokes.filter(s => s.y < 0.12);
        const botRows = hStrokes.filter(s => s.y > 0.88);
        const smallHorizTop = topRows.filter(s => s.width < 0.15 && s.width > 0.02);
        const smallHorizBot = botRows.filter(s => s.width < 0.15 && s.width > 0.02);
        features.hasSerifs = smallHorizTop.length >= 2 || smallHorizBot.length >= 2;

        return features;
    }

    /**
     * Compute SDF cross-section profiles for morphing validation.
     * Samples the SDF along horizontal and vertical center lines
     * to create a "signature" that can be compared before/after morphing.
     */
    function computeSDFProfiles(grid, res) {
        // Quick SDF: for key scan lines, compute distance to nearest edge
        const midY = Math.floor(res / 2);
        const midX = Math.floor(res / 2);
        const hProfile = new Float32Array(res); // horizontal through center
        const vProfile = new Float32Array(res); // vertical through center

        const search = Math.min(res, 16);
        for (let i = 0; i < res; i++) {
            // Horizontal profile
            const insideH = grid[midY * res + i] > 0;
            let minDH = search;
            for (let d = -search; d <= search; d++) {
                const ni = i + d;
                if (ni < 0 || ni >= res) continue;
                if ((grid[midY * res + ni] > 0) !== insideH) {
                    minDH = Math.min(minDH, Math.abs(d));
                }
            }
            hProfile[i] = insideH ? minDH : -minDH;

            // Vertical profile
            const insideV = grid[i * res + midX] > 0;
            let minDV = search;
            for (let d = -search; d <= search; d++) {
                const ni = i + d;
                if (ni < 0 || ni >= res) continue;
                if ((grid[ni * res + midX] > 0) !== insideV) {
                    minDV = Math.min(minDV, Math.abs(d));
                }
            }
            vProfile[i] = insideV ? minDV : -minDV;
        }

        return { hProfile: Array.from(hProfile), vProfile: Array.from(vProfile), res };
    }

    /**
     * Validate a morphed glyph against the original topology.
     * Checks that:
     *   1. Counter count is preserved (no collapsed holes)
     *   2. Contour nesting structure is maintained
     *   3. Stroke widths stay within reasonable bounds
     *   4. SDF profiles maintain character identity
     *
     * Returns { valid, warnings[], score (0-1) }
     */
    function validateMorphedTopology(origTopo, morphedCmds, size) {
        if (!origTopo) return { valid: true, warnings: [], score: 1.0 };

        const morphedContours = splitContours(morphedCmds);
        const morphedHierarchy = analyseContourHierarchy(morphedContours);
        const warnings = [];
        let score = 1.0;

        // 1. Counter count preserved?
        const origCounters = origTopo.numCounters;
        const morphCounters = morphedHierarchy.filter(c => c.role === 'counter').length;
        if (morphCounters < origCounters) {
            warnings.push(`Counter collapsed: ${origCounters} → ${morphCounters}`);
            score -= 0.3;
        }

        // 2. Outer contour count preserved?
        const origOuter = origTopo.numOuter;
        const morphOuter = morphedHierarchy.filter(c => c.role === 'outer').length;
        if (morphOuter !== origOuter) {
            warnings.push(`Outer contour count changed: ${origOuter} → ${morphOuter}`);
            score -= 0.2;
        }

        // 3. Check morphed stroke widths against original
        const morphedRaster = rasteriseCommandsToGrid(morphedCmds, size, origTopo.rasterRes);
        const morphedWidths = computeStrokeWidths(morphedRaster, origTopo.rasterRes);
        const origMin = origTopo.strokeWidths.overall.min;
        if (morphedWidths.overall.min < origMin * 0.1) {
            warnings.push('Strokes becoming dangerously thin');
            score -= 0.15;
        }

        // 4. SDF profile similarity (correlation)
        const morphedProfiles = computeSDFProfiles(morphedRaster, origTopo.rasterRes);
        const corrH = profileCorrelation(origTopo.sdfProfiles.hProfile, morphedProfiles.hProfile);
        const corrV = profileCorrelation(origTopo.sdfProfiles.vProfile, morphedProfiles.vProfile);
        if (corrH < 0.5 || corrV < 0.5) {
            warnings.push(`Character shape significantly altered (H:${corrH.toFixed(2)}, V:${corrV.toFixed(2)})`);
            score -= 0.2;
        }

        return { valid: score > 0.4, warnings, score: Math.max(0, score) };
    }

    function profileCorrelation(a, b) {
        if (a.length !== b.length || a.length === 0) return 0;
        const n = a.length;
        let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
        for (let i = 0; i < n; i++) {
            sumA += a[i]; sumB += b[i];
            sumAB += a[i] * b[i];
            sumA2 += a[i] * a[i];
            sumB2 += b[i] * b[i];
        }
        const num = n * sumAB - sumA * sumB;
        const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
        return den > 0 ? num / den : 0;
    }

    /* ══════════════════════════════════════════════════════════════
       SKELETON EXTRACTION VIA SDF
       Computes the medial axis (skeleton) of a glyph using the
       signed distance field. The skeleton encodes:
         • Stroke centrelines (where the writer's pen would travel)
         • Local stroke width at each skeleton point (= 2 × SDF value)
         • Structural junctions and endpoints
       
       This is the foundation for skeleton-based morphing: instead of
       offsetting contours, we modify the skeleton and re-stroke it.
    ══════════════════════════════════════════════════════════════ */

    /**
     * Rasterise path commands to a binary grid at given resolution.
     */
    function rasteriseCommandsForSkeleton(cmds, res, coordSize) {
        const c = document.createElement('canvas');
        c.width = c.height = res;
        const ctx = c.getContext('2d');
        const scale = res / coordSize;

        ctx.clearRect(0, 0, res, res);
        ctx.save();
        ctx.scale(scale, scale);
        ctx.beginPath();
        for (const cmd of cmds) {
            switch (cmd.type) {
                case 'M': ctx.moveTo(cmd.x, cmd.y); break;
                case 'L': ctx.lineTo(cmd.x, cmd.y); break;
                case 'Q': ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); break;
                case 'C': ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); break;
                case 'Z': ctx.closePath(); break;
            }
        }
        ctx.fillStyle = '#fff';
        ctx.fill('nonzero');
        ctx.restore();

        const id = ctx.getImageData(0, 0, res, res);
        const grid = new Uint8Array(res * res);
        for (let i = 0; i < res * res; i++) {
            grid[i] = id.data[i * 4 + 3] > 127 ? 1 : 0;
        }
        return grid;
    }

    /**
     * Compute Euclidean distance transform for interior pixels.
     * Uses two-pass approximation (Saito & Toriwaki) for efficiency.
     * Returns Float32Array where each pixel = distance to nearest boundary.
     */
    function computeDistanceTransform(grid, res) {
        const dt = new Float32Array(res * res);
        const INF = res * 2;

        // Phase 1: horizontal pass
        const hDist = new Float32Array(res * res);
        for (let y = 0; y < res; y++) {
            // Left → right
            let d = INF;
            for (let x = 0; x < res; x++) {
                const i = y * res + x;
                if (grid[i] === 0) { d = 0; } else { d++; }
                hDist[i] = d;
            }
            // Right → left
            d = INF;
            for (let x = res - 1; x >= 0; x--) {
                const i = y * res + x;
                if (grid[i] === 0) { d = 0; } else { d++; }
                hDist[i] = Math.min(hDist[i], d);
            }
        }

        // Phase 2: vertical pass using squared distances
        for (let x = 0; x < res; x++) {
            const col = new Float32Array(res);
            for (let y = 0; y < res; y++) {
                col[y] = hDist[y * res + x] * hDist[y * res + x];
            }

            for (let y = 0; y < res; y++) {
                let minD2 = col[y];
                // Search vertically for closer boundary
                let searchR = Math.min(Math.ceil(Math.sqrt(minD2)) + 1, res);
                for (let dy = 1; dy < searchR; dy++) {
                    const y1 = y - dy, y2 = y + dy;
                    if (y1 >= 0) {
                        const d2 = col[y1] + dy * dy;
                        if (d2 < minD2) { minD2 = d2; searchR = Math.min(Math.ceil(Math.sqrt(d2)) + 1, res); }
                    }
                    if (y2 < res) {
                        const d2 = col[y2] + dy * dy;
                        if (d2 < minD2) { minD2 = d2; }
                    }
                }
                dt[y * res + x] = grid[y * res + x] ? Math.sqrt(minD2) : 0;
            }
        }

        return dt;
    }

    /**
     * Find ridge pixels in the distance transform.
     * Ridge = local maximum of DT in at least one direction (H or V).
     * These form the raw medial axis before thinning.
     */
    function findRidgePixels(dt, res, grid) {
        const ridge = new Uint8Array(res * res);

        for (let y = 1; y < res - 1; y++) {
            for (let x = 1; x < res - 1; x++) {
                const i = y * res + x;
                if (!grid[i]) continue;      // only interior pixels
                if (dt[i] < 1.0) continue;   // ignore boundary-adjacent

                const v = dt[i];

                // Check if local max in horizontal direction
                const isHRidge = v >= dt[i - 1] && v >= dt[i + 1];
                // Check if local max in vertical direction
                const isVRidge = v >= dt[(y - 1) * res + x] && v >= dt[(y + 1) * res + x];
                // Check diagonals for better coverage
                const isDiag1 = v >= dt[(y - 1) * res + x - 1] && v >= dt[(y + 1) * res + x + 1];
                const isDiag2 = v >= dt[(y - 1) * res + x + 1] && v >= dt[(y + 1) * res + x - 1];

                if (isHRidge || isVRidge || (isDiag1 && isDiag2)) {
                    ridge[i] = 1;
                }
            }
        }

        return ridge;
    }

    /**
     * Zhang-Suen morphological thinning.
     * Reduces the ridge to a 1-pixel wide skeleton.
     */
    function zhangSuenThin(mask, res) {
        const out = new Uint8Array(mask);
        let changed = true;

        while (changed) {
            changed = false;

            // Sub-iteration 1
            const toRemove1 = [];
            for (let y = 1; y < res - 1; y++) {
                for (let x = 1; x < res - 1; x++) {
                    const i = y * res + x;
                    if (!out[i]) continue;

                    const p2 = out[(y-1)*res+x], p3 = out[(y-1)*res+x+1];
                    const p4 = out[y*res+x+1],   p5 = out[(y+1)*res+x+1];
                    const p6 = out[(y+1)*res+x],  p7 = out[(y+1)*res+x-1];
                    const p8 = out[y*res+x-1],    p9 = out[(y-1)*res+x-1];

                    const B = p2+p3+p4+p5+p6+p7+p8+p9;
                    if (B < 2 || B > 6) continue;

                    // Count 0→1 transitions in order p2,p3,...,p9,p2
                    const seq = [p2,p3,p4,p5,p6,p7,p8,p9,p2];
                    let A = 0;
                    for (let k = 0; k < 8; k++) { if (seq[k] === 0 && seq[k+1] === 1) A++; }
                    if (A !== 1) continue;

                    if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
                        toRemove1.push(i);
                    }
                }
            }
            for (const i of toRemove1) { out[i] = 0; changed = true; }

            // Sub-iteration 2
            const toRemove2 = [];
            for (let y = 1; y < res - 1; y++) {
                for (let x = 1; x < res - 1; x++) {
                    const i = y * res + x;
                    if (!out[i]) continue;

                    const p2 = out[(y-1)*res+x], p3 = out[(y-1)*res+x+1];
                    const p4 = out[y*res+x+1],   p5 = out[(y+1)*res+x+1];
                    const p6 = out[(y+1)*res+x],  p7 = out[(y+1)*res+x-1];
                    const p8 = out[y*res+x-1],    p9 = out[(y-1)*res+x-1];

                    const B = p2+p3+p4+p5+p6+p7+p8+p9;
                    if (B < 2 || B > 6) continue;

                    const seq = [p2,p3,p4,p5,p6,p7,p8,p9,p2];
                    let A = 0;
                    for (let k = 0; k < 8; k++) { if (seq[k] === 0 && seq[k+1] === 1) A++; }
                    if (A !== 1) continue;

                    if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
                        toRemove2.push(i);
                    }
                }
            }
            for (const i of toRemove2) { out[i] = 0; changed = true; }
        }

        return out;
    }

    /**
     * Build a graph from the thinned skeleton.
     * Returns { nodes[], edges[] } where:
     *   node = { x, y, type: 'endpoint'|'junction'|'normal', strokeWidth, neighbors[] }
     *   edge = { from, to, points[], avgWidth, length }
     */
    function buildSkeletonGraph(skeleton, dt, res) {
        // Collect skeleton pixels
        const pixels = [];
        const pixelMap = new Map();  // "x,y" → index

        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                if (skeleton[y * res + x]) {
                    const idx = pixels.length;
                    pixels.push({ x, y, strokeWidth: dt[y * res + x] * 2, idx });
                    pixelMap.set(`${x},${y}`, idx);
                }
            }
        }

        // Build adjacency (8-connected)
        const neighbors = pixels.map(() => []);
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (const p of pixels) {
            for (const [dy, dx] of dirs) {
                const key = `${p.x + dx},${p.y + dy}`;
                const ni = pixelMap.get(key);
                if (ni !== undefined) {
                    neighbors[p.idx].push(ni);
                }
            }
        }

        // Classify nodes
        const nodes = pixels.map((p, i) => ({
            x: p.x, y: p.y,
            strokeWidth: p.strokeWidth,
            type: neighbors[i].length <= 1 ? 'endpoint' :
                  neighbors[i].length === 2 ? 'normal' : 'junction',
            neighbors: neighbors[i],
            pixelIdx: i,
        }));

        // Trace edges between junctions/endpoints
        const edges = [];
        const visited = new Set();

        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].type === 'normal') continue;  // start only from endpoint/junction

            for (const startNi of neighbors[i]) {
                const edgeKey = `${Math.min(i, startNi)}-${Math.max(i, startNi)}`;
                if (visited.has(edgeKey)) continue;

                // Trace along 'normal' nodes until we hit another endpoint/junction
                const points = [{ x: nodes[i].x, y: nodes[i].y, w: nodes[i].strokeWidth }];
                let prev = i;
                let curr = startNi;

                while (curr !== undefined && nodes[curr].type === 'normal') {
                    visited.add(`${Math.min(prev, curr)}-${Math.max(prev, curr)}`);
                    points.push({ x: nodes[curr].x, y: nodes[curr].y, w: nodes[curr].strokeWidth });
                    const next = neighbors[curr].find(n => n !== prev);
                    prev = curr;
                    curr = next;
                }

                if (curr !== undefined) {
                    visited.add(`${Math.min(prev, curr)}-${Math.max(prev, curr)}`);
                    points.push({ x: nodes[curr].x, y: nodes[curr].y, w: nodes[curr].strokeWidth });

                    // Compute edge length
                    let length = 0;
                    for (let k = 1; k < points.length; k++) {
                        length += Math.sqrt((points[k].x - points[k-1].x)**2 +
                                            (points[k].y - points[k-1].y)**2);
                    }

                    const avgWidth = points.reduce((s, p) => s + p.w, 0) / points.length;
                    edges.push({
                        from: i, to: curr,
                        points, avgWidth, length,
                        // Classify edge direction
                        direction: classifyEdgeDirection(points),
                    });
                }
            }
        }

        // Compute statistics
        const junctions = nodes.filter(n => n.type === 'junction');
        const endpoints = nodes.filter(n => n.type === 'endpoint');
        const avgStrokeWidth = pixels.length > 0
            ? pixels.reduce((s, p) => s + p.strokeWidth, 0) / pixels.length : 0;

        return {
            nodes, edges, pixels,
            junctions, endpoints,
            avgStrokeWidth,
            res,
            pixelCount: pixels.length,
        };
    }

    /**
     * Classify whether an edge is primarily vertical, horizontal, or diagonal.
     */
    function classifyEdgeDirection(points) {
        if (points.length < 2) return 'point';
        const dx = Math.abs(points[points.length-1].x - points[0].x);
        const dy = Math.abs(points[points.length-1].y - points[0].y);
        if (dx + dy < 2) return 'point';
        const angle = Math.atan2(dy, dx);
        if (angle > Math.PI * 0.375) return 'vertical';
        if (angle < Math.PI * 0.125) return 'horizontal';
        return 'diagonal';
    }

    /**
     * extractSkeleton(cmds, size)
     * Main entry point: takes path commands and returns a complete
     * skeleton analysis including graph, stroke widths, and features.
     */
    function extractSkeleton(cmds, size) {
        const res = 128;  // resolution for rasterisation

        // 1. Rasterise
        const grid = rasteriseCommandsForSkeleton(cmds, res, size);

        // 2. Compute distance transform
        const dt = computeDistanceTransform(grid, res);

        // 3. Find ridge pixels (raw medial axis)
        const rawRidge = findRidgePixels(dt, res, grid);

        // 4. Thin to 1-pixel skeleton
        const thinned = zhangSuenThin(rawRidge, res);

        // 5. Prune small branches (noise)
        pruneSkeleton(thinned, dt, res, 4);  // remove branches shorter than 4px

        // 6. Build graph
        const graph = buildSkeletonGraph(thinned, dt, res);

        // 7. Detect structural features from skeleton
        const features = detectSkeletonFeatures(graph, res);

        return {
            grid, dt, skeleton: thinned, graph, features,
            res, size,
            scale: res / size,
        };
    }

    /**
     * Remove short branches from skeleton that are likely noise.
     */
    function pruneSkeleton(skeleton, dt, res, minLength) {
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

        function countNeighbors(x, y) {
            let n = 0;
            for (const [dy, dx] of dirs) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < res && ny >= 0 && ny < res && skeleton[ny * res + nx]) n++;
            }
            return n;
        }

        // Find endpoints and trace back, removing if branch is short
        let pruned = true;
        while (pruned) {
            pruned = false;
            for (let y = 1; y < res - 1; y++) {
                for (let x = 1; x < res - 1; x++) {
                    if (!skeleton[y * res + x]) continue;
                    if (countNeighbors(x, y) !== 1) continue;

                    // This is an endpoint — trace the branch
                    const branch = [{ x, y }];
                    let cx = x, cy = y;
                    let found = true;
                    while (found && branch.length < minLength) {
                        found = false;
                        for (const [dy, dx] of dirs) {
                            const nx = cx + dx, ny = cy + dy;
                            if (nx >= 0 && nx < res && ny >= 0 && ny < res &&
                                skeleton[ny * res + nx] &&
                                !branch.some(p => p.x === nx && p.y === ny)) {
                                if (countNeighbors(nx, ny) <= 2) {
                                    branch.push({ x: nx, y: ny });
                                    cx = nx; cy = ny;
                                    found = true;
                                    break;
                                } else {
                                    found = false; // hit a junction, stop
                                    break;
                                }
                            }
                        }
                    }

                    // If branch is short and ends at a junction, remove it
                    if (branch.length < minLength) {
                        for (const p of branch) {
                            skeleton[p.y * res + p.x] = 0;
                        }
                        pruned = true;
                    }
                }
            }
        }
    }

    /**
     * Detect typographic structural features from the skeleton graph.
     */
    function detectSkeletonFeatures(graph, res) {
        const features = {
            stems: [],        // vertical strokes
            crossbars: [],    // horizontal strokes
            diagonals: [],    // diagonal strokes
            bowls: [],        // curved strokes (arcs)
            serifs: [],       // short terminal strokes
            totalStrokeLength: 0,
        };

        for (const edge of graph.edges) {
            features.totalStrokeLength += edge.length;

            // Classify by direction and length
            if (edge.length < 3) {
                // Very short — likely serif or joint
                features.serifs.push(edge);
            } else if (edge.direction === 'vertical') {
                features.stems.push({
                    ...edge,
                    x: (edge.points[0].x + edge.points[edge.points.length-1].x) / 2 / res,
                    yStart: Math.min(edge.points[0].y, edge.points[edge.points.length-1].y) / res,
                    yEnd: Math.max(edge.points[0].y, edge.points[edge.points.length-1].y) / res,
                });
            } else if (edge.direction === 'horizontal') {
                features.crossbars.push({
                    ...edge,
                    y: (edge.points[0].y + edge.points[edge.points.length-1].y) / 2 / res,
                    xStart: Math.min(edge.points[0].x, edge.points[edge.points.length-1].x) / res,
                    xEnd: Math.max(edge.points[0].x, edge.points[edge.points.length-1].x) / res,
                });
            } else {
                features.diagonals.push(edge);
            }
        }

        // Find crossbar Y positions for crossbarHeight control
        features.crossbarPositions = features.crossbars.map(cb => cb.y);

        return features;
    }

    /**
     * Draw skeleton visualization on a canvas.
     * Shows: thinned skeleton (white), stroke width heat (color),
     *        nodes (red/green/blue dots), structural features.
     */
    function drawSkeletonViz(skeletonData, canvas, options = {}) {
        const { skeleton, dt, graph, features, res, grid } = skeletonData;
        const cw = canvas.width, ch = canvas.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);

        const sx = cw / res, sy = ch / res;

        // 1. Draw glyph silhouette faintly
        if (options.showGlyph !== false) {
            const imgData = ctx.createImageData(cw, ch);
            for (let y = 0; y < res; y++) {
                for (let x = 0; x < res; x++) {
                    if (grid[y * res + x]) {
                        // Map pixel to canvas
                        const cx0 = Math.floor(x * sx);
                        const cy0 = Math.floor(y * sy);
                        const cx1 = Math.ceil((x + 1) * sx);
                        const cy1 = Math.ceil((y + 1) * sy);
                        for (let py = cy0; py < cy1 && py < ch; py++) {
                            for (let px = cx0; px < cx1 && px < cw; px++) {
                                const idx = (py * cw + px) * 4;
                                imgData.data[idx] = 255;
                                imgData.data[idx+1] = 255;
                                imgData.data[idx+2] = 255;
                                imgData.data[idx+3] = 30;  // very faint
                            }
                        }
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }

        // 2. Draw skeleton edges colored by stroke width
        if (options.showStrokeWidth !== false) {
            const maxW = graph.avgStrokeWidth * 2 || 10;
            for (const edge of graph.edges) {
                if (edge.points.length < 2) continue;
                for (let i = 1; i < edge.points.length; i++) {
                    const p0 = edge.points[i-1], p1 = edge.points[i];
                    const w = (p0.w + p1.w) / 2;
                    const t = Math.min(w / maxW, 1.0);
                    // Color: thin=cyan → thick=magenta
                    const r = Math.floor(t * 255);
                    const g = Math.floor((1-t) * 200);
                    const b = 255;
                    ctx.beginPath();
                    ctx.moveTo(p0.x * sx, p0.y * sy);
                    ctx.lineTo(p1.x * sx, p1.y * sy);
                    ctx.strokeStyle = `rgb(${r},${g},${b})`;
                    ctx.lineWidth = Math.max(1.5, w * sx * 0.15);
                    ctx.stroke();
                }
            }
        }

        // 3. Draw nodes
        if (options.showNodes !== false) {
            const nodeColors = { endpoint: '#f85149', junction: '#3fb950', normal: '#58a6ff' };
            for (const node of graph.nodes) {
                if (node.type === 'normal') continue;
                ctx.beginPath();
                ctx.arc(node.x * sx, node.y * sy, node.type === 'junction' ? 4 : 3, 0, Math.PI * 2);
                ctx.fillStyle = nodeColors[node.type];
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        // 4. Draw structural feature indicators
        if (options.showFeatures !== false && features) {
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            // Stems (vertical dashed lines)
            ctx.strokeStyle = '#d29922';
            for (const stem of features.stems) {
                const x = stem.x * cw;
                ctx.beginPath();
                ctx.moveTo(x, stem.yStart * ch);
                ctx.lineTo(x, stem.yEnd * ch);
                ctx.stroke();
            }
            // Crossbars (horizontal dashed lines)
            ctx.strokeStyle = '#58a6ff';
            for (const cb of features.crossbars) {
                const y = cb.y * ch;
                ctx.beginPath();
                ctx.moveTo(cb.xStart * cw, y);
                ctx.lineTo(cb.xEnd * cw, y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        // 5. Draw distance transform heatmap if requested
        if (options.showDT) {
            const maxDT = Math.max(...dt) || 1;
            const imgData = ctx.createImageData(cw, ch);
            for (let y = 0; y < res; y++) {
                for (let x = 0; x < res; x++) {
                    const v = dt[y * res + x] / maxDT;
                    if (v <= 0) continue;
                    const cx0 = Math.floor(x * sx);
                    const cy0 = Math.floor(y * sy);
                    const idx = (cy0 * cw + cx0) * 4;
                    imgData.data[idx] = Math.floor(v * 60);
                    imgData.data[idx+1] = Math.floor(v * 180);
                    imgData.data[idx+2] = Math.floor(v * 255);
                    imgData.data[idx+3] = Math.floor(v * 120);
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }
    }

    /* ──────── Contrast: scale vertical vs horizontal strokes ── */
    function applyContrast(cmds, contrast, size) {
        // Approximate: segments that are more vertical get thinner/thicker
        // We detect the dominant direction of each segment and scale perpendicular
        const contours = splitContours(cmds);
        const result = [];
        for (const contour of contours) {
            const pts = contourToPoints(contour, 30);
            if (pts.length < 3) { result.push(...contour); continue; }

            const ctr = centroid(pts);
            const offsetContour = contour.map(c => {
                const r = { ...c };
                // For each point, determine if it's on a more vertical or horizontal part
                if (r.x !== undefined && r.y !== undefined) {
                    const angle = Math.atan2(r.y - ctr[1], r.x - ctr[0]);
                    // Vertical parts (near 0 or π) → scale X, Horizontal → scale Y
                    const hFact = Math.abs(Math.sin(angle));    // 1 = top/bottom, 0 = left/right
                    const vFact = Math.abs(Math.cos(angle));    // 1 = left/right, 0 = top/bottom
                    // positive contrast: thin horizontals, thicken verticals
                    const dx = (r.x - ctr[0]) * (1 + contrast * 0.15 * vFact);
                    const dy = (r.y - ctr[1]) * (1 - contrast * 0.08 * hFact);
                    r.x = ctr[0] + dx;
                    r.y = ctr[1] + dy;
                }
                return r;
            });
            result.push(...offsetContour);
        }
        return result;
    }

    function centroid(pts) {
        let sx = 0, sy = 0;
        for (const [x, y] of pts) { sx += x; sy += y; }
        return [sx / pts.length, sy / pts.length];
    }

    /* ──────── Roundness: smooth sharp corners ──────────────── */
    function applyRoundness(cmds, roundness) {
        // Insert quadratic curves at L→L corners to soften them
        const result = [];
        for (let i = 0; i < cmds.length; i++) {
            const c = cmds[i];
            const next = cmds[i + 1];
            if (c.type === 'L' && next && next.type === 'L') {
                const prev = getPrevPoint(cmds, i);
                if (prev) {
                    const t = roundness * 0.35;
                    // move endpoint closer, then add a curve through the corner
                    const mx = c.x, my = c.y;
                    const px = prev[0] + (mx - prev[0]) * (1 - t);
                    const py = prev[1] + (my - prev[1]) * (1 - t);
                    const nx = mx + (next.x - mx) * t;
                    const ny = my + (next.y - my) * t;
                    result.push({ type: 'L', x: px, y: py });
                    result.push({ type: 'Q', x1: mx, y1: my, x: nx, y: ny });
                    continue;
                }
            }
            result.push({ ...c });
        }
        return result;
    }

    function getPrevPoint(cmds, idx) {
        for (let i = idx - 1; i >= 0; i--) {
            if (cmds[i].x !== undefined) return [cmds[i].x, cmds[i].y];
        }
        return null;
    }

    /* ──────── Terminal style: reshape stroke endpoints ──────── */
    function applyTerminal(cmds, terminal, size) {
        // Detect terminal points: endpoints before a Z or after an M that are
        // near the top/bottom of the glyph bounding box.
        // Positive: round/ball terminals, Negative: flat/angular cut
        const bbox = commandsBBox(cmds);
        const result = [];
        for (let i = 0; i < cmds.length; i++) {
            const c = cmds[i];
            const next = cmds[i + 1];
            const prev = cmds[i - 1];

            // A terminal is the last point before Z
            if (next && next.type === 'Z' && c.type !== 'M' && c.x !== undefined) {
                if (terminal > 0) {
                    // Add ball terminal: insert a small circular arc
                    const r = terminal * size * 0.018;
                    result.push({ ...c });
                    // tiny circle at the terminal
                    result.push({
                        type: 'C',
                        x1: c.x + r, y1: c.y - r,
                        x2: c.x + r, y2: c.y + r,
                        x: c.x, y: c.y
                    });
                } else {
                    // Flatten: ensure the terminal is a straight line
                    result.push({ type: 'L', x: c.x, y: c.y });
                }
                continue;
            }
            result.push({ ...c });
        }
        return result;
    }

    /* ──────── Ink Trap: notch at sharp corners ────────────── */
    function applyInkTrap(cmds, amount, size) {
        const pushDist = amount * size * 0.025;
        const result = [];
        for (let i = 0; i < cmds.length; i++) {
            const c = cmds[i];
            if (c.type === 'L') {
                const prev = getPrevPoint(cmds, i);
                const next = cmds[i + 1];
                if (prev && next && next.x !== undefined) {
                    const dx1 = c.x - prev[0], dy1 = c.y - prev[1];
                    const dx2 = next.x - c.x, dy2 = next.y - c.y;
                    const len1 = Math.sqrt(dx1*dx1 + dy1*dy1) || 1;
                    const len2 = Math.sqrt(dx2*dx2 + dy2*dy2) || 1;
                    const dot = (dx1*dx2 + dy1*dy2) / (len1 * len2);
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                    if (angle > 0.4 && angle < 2.4) {
                        const bisectX = -(dx1/len1 + dx2/len2);
                        const bisectY = -(dy1/len1 + dy2/len2);
                        const bLen = Math.sqrt(bisectX*bisectX + bisectY*bisectY) || 1;
                        result.push({
                            type: 'L',
                            x: c.x + (bisectX / bLen) * pushDist,
                            y: c.y + (bisectY / bLen) * pushDist
                        });
                        continue;
                    }
                }
            }
            result.push({ ...c });
        }
        return result;
    }

    /* ══════════════════════════════════════════════════════════════
       GLYPH ANATOMY MORPHS — Structure-aware transforms
       These operate on detected typographic features rather than
       blind geometric transforms, enabling finer control over
       individual aspects of letter anatomy.
    ══════════════════════════════════════════════════════════════ */

    /**
     * Crossbar Height — shifts horizontal midline features up or down.
     * Detects the "midzone" of the glyph and warps it vertically.
     * Works on letters like A, H, e, f, t, etc.
     */
    function applyCrossbarHeight(cmds, amount, size) {
        const bbox = commandsBBox(cmds);
        const top = bbox.minY;
        const bottom = bbox.maxY;
        const height = bottom - top || 1;
        const shift = amount * height * 0.12;  // max ±12% of glyph height

        // Find the horizontal crossbar zone by scanning for horizontal segments
        // in the middle 30-70% of the glyph height
        const midLo = top + height * 0.25;
        const midHi = top + height * 0.75;
        const midCenter = top + height * 0.5;

        // Collect horizontal segment y-values to find the actual crossbar band
        let crossbarY = midCenter;
        let horzCount = 0;
        let horzYSum = 0;
        const contours = splitContours(cmds);

        for (const contour of contours) {
            for (let i = 0; i < contour.length - 1; i++) {
                const a = contour[i], b = contour[i + 1];
                if (a.x === undefined || b.x === undefined) continue;
                const dy = Math.abs(b.y - a.y);
                const dx = Math.abs(b.x - a.x);
                if (dx > dy * 3 && dy < height * 0.05) { // horizontal segment
                    const avgY = (a.y + b.y) / 2;
                    if (avgY > midLo && avgY < midHi) {
                        horzYSum += avgY;
                        horzCount++;
                    }
                }
            }
        }
        if (horzCount > 0) crossbarY = horzYSum / horzCount;

        // Influence: Gaussian centered on crossbar zone, narrow band
        const sigma = height * 0.12;
        const result = [];

        for (const contour of contours) {
            for (let i = 0; i < contour.length; i++) {
                const c = { ...contour[i] };
                if (c.type === 'Z' || c.x === undefined) {
                    result.push(c);
                    continue;
                }

                // Only shift Y — never add diagonal X displacement
                const yDist = c.y - crossbarY;
                const influence = Math.exp(-(yDist * yDist) / (2 * sigma * sigma));
                c.y -= influence * shift;

                // Same for control points — pure vertical shift
                if (c.y1 !== undefined) {
                    const cp1Dist = c.y1 - crossbarY;
                    c.y1 -= Math.exp(-(cp1Dist * cp1Dist) / (2 * sigma * sigma)) * shift;
                }
                if (c.y2 !== undefined) {
                    const cp2Dist = c.y2 - crossbarY;
                    c.y2 -= Math.exp(-(cp2Dist * cp2Dist) / (2 * sigma * sigma)) * shift;
                }

                result.push(c);
            }
        }
        return result;
    }

    /**
     * Aperture — widens/narrows openings in partially-closed counters.
     * This affects the "mouth" of letters like C, G, S, e, s, a.
     * Detects points near gap regions and pushes them apart or together.
     */
    function applyAperture(cmds, amount, size) {
        // Strategy: detect the rightmost/leftmost extremes of each contour's
        // gap area and push endpoints outward. For a general approach,
        // we move points that are near the horizontal extremes of the glyph
        // outward/inward based on their proximity to openings.
        const bbox = commandsBBox(cmds);
        const glyphCX = (bbox.minX + bbox.maxX) / 2;
        const glyphCY = (bbox.minY + bbox.maxY) / 2;
        const glyphW = (bbox.maxX - bbox.minX) || 1;
        const glyphH = (bbox.maxY - bbox.minY) || 1;

        // Amount of push: positive = open, negative = close
        const pushAmt = amount * size * 0.03;

        return transformPoints(cmds, (x, y) => {
            // Points far from center horizontally get pushed outward
            const dx = (x - glyphCX) / (glyphW * 0.5); // -1 to 1
            const dy = (y - glyphCY) / (glyphH * 0.5); // -1 to 1

            // Influence is highest at horizontal edges of the glyph,
            // and tapers off toward the center
            const hInfluence = Math.abs(dx);
            // Also consider vertical extremes (top/bottom of letter openings)
            const vInfluence = Math.pow(Math.abs(dy), 0.8);

            // Combined: aperture mostly affects points at left/right edges
            // that are also at vertical extremes (where counters open)
            const influence = hInfluence * vInfluence;

            // Push outward from center along both axes
            const pushX = Math.sign(dx) * influence * pushAmt * 0.5;
            const pushY = Math.sign(dy) * influence * pushAmt * 0.5;

            return [x + pushX, y + pushY];
        });
    }

    /**
     * Stem Width — selectively thicken/thin vertical strokes.
     * Uses local tangent direction to identify which parts of the
     * contour are on vertical stems vs horizontal strokes.
     */
    function applyStemWidth(cmds, amount, size) {
        const contours = splitContours(cmds);
        const result = [];
        const maxOffset = size * 0.02;
        const offset = amount * maxOffset;

        for (const contour of contours) {
            if (contour.length < 3) { result.push(...contour); continue; }

            const offsetContour = [];
            for (let i = 0; i < contour.length; i++) {
                const c = contour[i];
                const r = { ...c };

                if (c.type === 'Z') { offsetContour.push(r); continue; }

                // Compute local tangent direction
                const prevPt = getPrevPoint(contour.map(cmd => cmd), i);
                const nextPt = getNextPoint(contour, i);
                if (prevPt && nextPt) {
                    const tx = nextPt[0] - prevPt[0];
                    const ty = nextPt[1] - prevPt[1];
                    const tLen = Math.sqrt(tx * tx + ty * ty) || 1;

                    // How vertical is this segment? (|sin(angle)| where angle is from horizontal)
                    const verticalness = Math.abs(tx / tLen);  // 1 = horizontal tangent = vertical stroke
                    // Inverted: we want high influence where tangent is vertical (= vertical edges of stems)

                    // Actually: tangent direction → normal direction → offset
                    // A vertical stem has horizontal tangents at its left/right edges
                    // So tangent being primarily horizontal means we're on a vertical stem edge
                    const stemInfluence = Math.pow(verticalness, 2);

                    // The normal points perpendicular to tangent
                    const nx = -ty / tLen;
                    const ny = tx / tLen;

                    r.x += nx * offset * stemInfluence;
                    r.y += ny * offset * stemInfluence;
                }

                offsetContour.push(r);
            }
            result.push(...offsetContour);
        }
        return result;
    }

    /**
     * Shoulder — smooth or sharpen the transitions between curves and stems.
     * Positive = smoother (round), Negative = sharper (angular).
     */
    function applyShoulder(cmds, amount, size) {
        // Approach: for points at curve-to-line transitions, interpolate
        // between the current position and a "smoother" or "sharper" position.
        const result = [];
        for (let i = 0; i < cmds.length; i++) {
            const c = cmds[i];
            const r = { ...c };

            // Only affect curve control points
            if (c.type === 'C' && c.x1 !== undefined) {
                const prev = getPrevPoint(cmds, i) || [c.x, c.y];
                // Smoothing: pull control points toward midpoints
                // Sharpening: push control points toward the on-curve points
                const t = amount * 0.3;  // max 30% interpolation

                if (t > 0) {
                    // Smooth: pull cp1 toward midpoint of (prev, on-curve)
                    const midX1 = (prev[0] + r.x) / 2;
                    const midY1 = (prev[1] + r.y) / 2;
                    r.x1 += (midX1 - r.x1) * t;
                    r.y1 += (midY1 - r.y1) * t;
                    // Pull cp2 toward midpoint too
                    r.x2 += (midX1 - r.x2) * t;
                    r.y2 += (midY1 - r.y2) * t;
                } else {
                    // Sharpen: push control points toward their nearest on-curve point
                    const sharpT = -t;
                    r.x1 += (prev[0] - r.x1) * sharpT;
                    r.y1 += (prev[1] - r.y1) * sharpT;
                    r.x2 += (r.x - r.x2) * sharpT;
                    r.y2 += (r.y - r.y2) * sharpT;
                }
            } else if (c.type === 'Q' && c.x1 !== undefined) {
                const prev = getPrevPoint(cmds, i) || [c.x, c.y];
                const t = amount * 0.3;

                if (t > 0) {
                    const midX = (prev[0] + r.x) / 2;
                    const midY = (prev[1] + r.y) / 2;
                    r.x1 += (midX - r.x1) * t;
                    r.y1 += (midY - r.y1) * t;
                } else {
                    const midX = (prev[0] + r.x) / 2;
                    const midY = (prev[1] + r.y) / 2;
                    // Push away from midpoint
                    r.x1 -= (midX - r.x1) * (-t);
                    r.y1 -= (midY - r.y1) * (-t);
                }
            }

            result.push(r);
        }
        return result;
    }

    /**
     * Descender/Ascender — extend or shorten the vertical extremes.
     * Positive extends both ascenders (top) and descenders (bottom),
     * creating a taller glyph. Negative shortens them.
     */
    function applyDescender(cmds, amount, size) {
        const bbox = commandsBBox(cmds);
        const top = bbox.minY;
        const bottom = bbox.maxY;
        const height = bottom - top || 1;
        const midY = top + height * 0.5;
        const stretch = amount * 0.2;  // ±20% extension

        // Points in the top 25% get stretched upward,
        // points in the bottom 25% get stretched downward,
        // middle 50% stays relatively fixed.
        return transformPoints(cmds, (x, y) => {
            const normalY = (y - top) / height;  // 0 at top, 1 at bottom

            let factor;
            if (normalY < 0.25) {
                // Top zone — stretch upward
                factor = -stretch * (1 - normalY / 0.25);
            } else if (normalY > 0.75) {
                // Bottom zone — stretch downward
                factor = stretch * ((normalY - 0.75) / 0.25);
            } else {
                factor = 0;
            }

            return [x, y + factor * height];
        });
    }

    /**
     * Helper: get the next point in the command list
     */
    function getNextPoint(cmds, index) {
        for (let i = index + 1; i < cmds.length; i++) {
            if (cmds[i].x !== undefined) return [cmds[i].x, cmds[i].y];
        }
        return null;
    }

    /* ══════════════════════════════════════════════════════════════
       VECTOR PATH CONTROLS — visible, deterministic path transforms
    ══════════════════════════════════════════════════════════════ */

    /**
     * Count all vector stats for a command array.
     */
    function countCommandStats(cmds) {
        let contours = 0, segments = 0, lines = 0, quadCurves = 0, cubicCurves = 0, points = 0, moves = 0, closes = 0;
        for (const c of cmds) {
            switch (c.type) {
                case 'M': moves++; contours++; points++; break;
                case 'L': lines++; segments++; points++; break;
                case 'Q': quadCurves++; segments++; points += 2; break;
                case 'C': cubicCurves++; segments++; points += 3; break;
                case 'Z': closes++; break;
            }
        }
        return { contours, segments, lines, quadCurves, cubicCurves, totalCommands: cmds.length, points, moves, closes };
    }

    /**
     * Laplacian smoothing on Bezier anchor and control points.
     * Preserves Bezier structure while removing jagged artifacts.
     * @param {Array} cmds - path commands
     * @param {number} strength - 0..1 smoothing intensity
     * @param {number} passes - number of iterations
     */
    function laplacianSmooth(cmds, strength, passes) {
        if (strength < 0.001 || passes < 1) return cmds;
        const contours = splitContours(cmds);
        const result = [];
        const s = Math.min(strength, 0.5);

        for (const contour of contours) {
            const hasZ = contour[contour.length - 1] && contour[contour.length - 1].type === 'Z';
            const anchorN = hasZ ? contour.length - 1 : contour.length;
            if (anchorN < 3) { result.push(...contour.map(function(c){ return Object.assign({}, c); })); continue; }

            var working = contour.map(function(c){ return Object.assign({}, c); });

            for (var pass = 0; pass < passes; pass++) {
                var snap = working.map(function(c){ return Object.assign({}, c); });
                for (var i = 0; i < anchorN; i++) {
                    var c = working[i];
                    if (c.x === undefined) continue;
                    var pI = (i - 1 + anchorN) % anchorN;
                    var nI = (i + 1) % anchorN;
                    var p = snap[pI], n = snap[nI];
                    if (p.x === undefined || n.x === undefined) continue;

                    var midX = (p.x + n.x) / 2, midY = (p.y + n.y) / 2;
                    c.x += (midX - c.x) * s * 0.3;
                    c.y += (midY - c.y) * s * 0.3;

                    if (c.type === 'C' && c.x2 !== undefined) {
                        c.x2 += (midX - c.x2) * s * 0.12;
                        c.y2 += (midY - c.y2) * s * 0.12;
                    }
                    if (c.type === 'Q' && c.x1 !== undefined) {
                        c.x1 += (midX - c.x1) * s * 0.12;
                        c.y1 += (midY - c.y1) * s * 0.12;
                    }
                }
            }
            result.push.apply(result, working);
        }
        return result;
    }

    /**
     * STEP 14: Smoothing — Laplacian smooth or angularize
     * Positive: smooth all anchor points toward neighbors = rounder output
     * Negative: sample curves at low density, reconstruct as lines = angular
     */
    function applySmoothing(cmds, amount, size) {
        if (Math.abs(amount) < 0.01) return cmds;

        if (amount > 0) {
            var passes = Math.ceil(amount * 6);
            return laplacianSmooth(cmds, amount, passes);
        } else {
            var t = Math.abs(amount);
            var contours = splitContours(cmds);
            var result = [];
            for (var ci = 0; ci < contours.length; ci++) {
                var contour = contours[ci];
                var hasZ = contour[contour.length - 1] && contour[contour.length - 1].type === 'Z';
                var density = Math.max(4, Math.round(32 * (1 - t)));
                var pts = contourToPoints(contour, density);
                if (pts.length < 3) { result.push.apply(result, contour); continue; }

                var clean = [pts[0]];
                for (var i = 1; i < pts.length; i++) {
                    var dx = pts[i][0] - clean[clean.length-1][0];
                    var dy = pts[i][1] - clean[clean.length-1][1];
                    if (dx*dx + dy*dy > 0.5) clean.push(pts[i]);
                }

                result.push({ type: 'M', x: clean[0][0], y: clean[0][1] });
                for (var i = 1; i < clean.length; i++) {
                    result.push({ type: 'L', x: clean[i][0], y: clean[i][1] });
                }
                if (hasZ) result.push({ type: 'Z' });
            }
            return result;
        }
    }

    /**
     * STEP 15: Lines to Curves — convert L to Q (positive) or Q/C to L (negative)
     * Positive: line segments get a perpendicular bow = become Q curves
     * Negative: curves get flattened = control points pulled toward chord
     */
    function applyCurveFlatten(cmds, amount) {
        if (Math.abs(amount) < 0.01) return cmds;
        var t = Math.abs(amount);
        var out = [];
        var lastX = 0, lastY = 0;

        for (var i = 0; i < cmds.length; i++) {
            var c = cmds[i];
            if (c.type === 'M') {
                out.push(Object.assign({}, c)); lastX = c.x; lastY = c.y;
            } else if (c.type === 'L' && amount > 0) {
                var mx = (lastX + c.x) / 2, my = (lastY + c.y) / 2;
                var dx = c.x - lastX, dy = c.y - lastY;
                var len = Math.sqrt(dx*dx + dy*dy);
                if (len < 0.5) { out.push(Object.assign({}, c)); lastX = c.x; lastY = c.y; continue; }
                var bow = len * 0.08 * t;
                var nx = -dy / len, ny = dx / len;
                out.push({ type: 'Q', x1: mx + nx * bow, y1: my + ny * bow, x: c.x, y: c.y });
                lastX = c.x; lastY = c.y;
            } else if (c.type === 'Q' && amount < 0) {
                var mx = (lastX + c.x) / 2, my = (lastY + c.y) / 2;
                var newX1 = c.x1 + (mx - c.x1) * t;
                var newY1 = c.y1 + (my - c.y1) * t;
                var dev = Math.abs(newX1 - mx) + Math.abs(newY1 - my);
                if (dev < 0.5 && t > 0.7) {
                    out.push({ type: 'L', x: c.x, y: c.y });
                } else {
                    out.push({ type: 'Q', x1: newX1, y1: newY1, x: c.x, y: c.y });
                }
                lastX = c.x; lastY = c.y;
            } else if (c.type === 'C' && amount < 0) {
                var p1 = lastX + (c.x - lastX) * 0.333;
                var p2 = lastX + (c.x - lastX) * 0.667;
                var q1 = lastY + (c.y - lastY) * 0.333;
                var q2 = lastY + (c.y - lastY) * 0.667;
                var newX1 = c.x1 + (p1 - c.x1) * t;
                var newY1 = c.y1 + (q1 - c.y1) * t;
                var newX2 = c.x2 + (p2 - c.x2) * t;
                var newY2 = c.y2 + (q2 - c.y2) * t;
                var devA = Math.abs(newX1 - p1) + Math.abs(newY1 - q1);
                var devB = Math.abs(newX2 - p2) + Math.abs(newY2 - q2);
                if (devA + devB < 1.0 && t > 0.7) {
                    out.push({ type: 'L', x: c.x, y: c.y });
                } else {
                    out.push({ type: 'C', x1: newX1, y1: newY1, x2: newX2, y2: newY2, x: c.x, y: c.y });
                }
                lastX = c.x; lastY = c.y;
            } else {
                out.push(Object.assign({}, c));
                if (c.x !== undefined) { lastX = c.x; lastY = c.y; }
            }
        }
        return out;
    }

    /**
     * STEP 16: Curve Tension — scale control point distances from chord
     * Positive: exaggerate (pull control points AWAY from chord)
     * Negative: flatten (pull control points TOWARD chord)
     */
    function applyCurveTension(cmds, amount) {
        if (Math.abs(amount) < 0.01) return cmds;
        var factor = 1.0 + amount * 0.8;
        var out = [];
        var lastX = 0, lastY = 0;

        for (var i = 0; i < cmds.length; i++) {
            var c = cmds[i];
            if (c.type === 'M') {
                out.push(Object.assign({}, c)); lastX = c.x; lastY = c.y;
            } else if (c.type === 'Q') {
                var mx = (lastX + c.x) / 2, my = (lastY + c.y) / 2;
                var dx = c.x1 - mx, dy = c.y1 - my;
                out.push({ type: 'Q', x1: mx + dx * factor, y1: my + dy * factor, x: c.x, y: c.y });
                lastX = c.x; lastY = c.y;
            } else if (c.type === 'C') {
                var t1x = lastX + (c.x - lastX) * 0.333;
                var t1y = lastY + (c.y - lastY) * 0.333;
                var t2x = lastX + (c.x - lastX) * 0.667;
                var t2y = lastY + (c.y - lastY) * 0.667;
                var d1x = c.x1 - t1x, d1y = c.y1 - t1y;
                var d2x = c.x2 - t2x, d2y = c.y2 - t2y;
                out.push({
                    type: 'C',
                    x1: t1x + d1x * factor, y1: t1y + d1y * factor,
                    x2: t2x + d2x * factor, y2: t2y + d2y * factor,
                    x: c.x, y: c.y
                });
                lastX = c.x; lastY = c.y;
            } else {
                out.push(Object.assign({}, c));
                if (c.x !== undefined) { lastX = c.x; lastY = c.y; }
            }
        }
        return out;
    }

    /**
     * STEP 17: Corner Rounding — round L-L corners (>0) or angularize curves (<0)
     * Positive: Insert Q arc at each line-line corner
     * Negative: Replace each Q/C with line segments through control points
     */
    function applyCornerRound(cmds, amount, size) {
        if (Math.abs(amount) < 0.01) return cmds;
        var t = Math.abs(amount);

        if (amount > 0) {
            var radius = size * 0.04 * t;
            var out = [];
            for (var i = 0; i < cmds.length; i++) {
                var c = cmds[i];
                if (c.type === 'L' && i + 1 < cmds.length && cmds[i+1].type === 'L') {
                    var prev = (i > 0 && cmds[i-1].x !== undefined) ? cmds[i-1] : null;
                    var next = cmds[i+1];
                    if (prev) {
                        var dx1 = c.x - prev.x, dy1 = c.y - prev.y;
                        var dx2 = next.x - c.x, dy2 = next.y - c.y;
                        var len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                        var len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
                        if (len1 > 1 && len2 > 1) {
                            var r = Math.min(radius, len1 * 0.4, len2 * 0.4);
                            if (r > 0.5) {
                                var p1x = c.x - (dx1 / len1) * r;
                                var p1y = c.y - (dy1 / len1) * r;
                                var p2x = c.x + (dx2 / len2) * r;
                                var p2y = c.y + (dy2 / len2) * r;
                                out.push({ type: 'L', x: p1x, y: p1y });
                                out.push({ type: 'Q', x1: c.x, y1: c.y, x: p2x, y: p2y });
                                continue;
                            }
                        }
                    }
                }
                out.push(Object.assign({}, c));
            }
            return out;
        } else {
            var out = [];
            for (var i = 0; i < cmds.length; i++) {
                var c = cmds[i];
                if (c.type === 'Q') {
                    out.push({ type: 'L', x: c.x1, y: c.y1 });
                    out.push({ type: 'L', x: c.x, y: c.y });
                } else if (c.type === 'C') {
                    out.push({ type: 'L', x: c.x1, y: c.y1 });
                    out.push({ type: 'L', x: c.x2, y: c.y2 });
                    out.push({ type: 'L', x: c.x, y: c.y });
                } else {
                    out.push(Object.assign({}, c));
                }
            }
            return out;
        }
    }

    /**
     * STEP 18: Roughness — deterministic noise for hand-drawn feel
     * Uses position-based hashing for repeatable results.
     */
    function applyRoughness(cmds, amount, size) {
        if (amount < 0.01) return cmds;
        var mag = size * 0.008 * amount;
        var out = [];

        function hash(x, y) {
            var h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            return h - Math.floor(h);
        }

        for (var i = 0; i < cmds.length; i++) {
            var c = cmds[i];
            var r = Object.assign({}, c);
            if (r.x !== undefined && r.type !== 'M') {
                var h1 = hash(r.x, r.y);
                var h2 = hash(r.y, r.x);
                r.x += (h1 - 0.5) * 2 * mag;
                r.y += (h2 - 0.5) * 2 * mag;
            }
            if (r.x1 !== undefined) {
                var h1 = hash(r.x1 + 1.5, r.y1);
                var h2 = hash(r.y1 + 1.5, r.x1);
                r.x1 += (h1 - 0.5) * 2 * mag * 0.6;
                r.y1 += (h2 - 0.5) * 2 * mag * 0.6;
            }
            if (r.x2 !== undefined) {
                var h1 = hash(r.x2 + 3.7, r.y2);
                var h2 = hash(r.y2 + 3.7, r.x2);
                r.x2 += (h1 - 0.5) * 2 * mag * 0.6;
                r.y2 += (h2 - 0.5) * 2 * mag * 0.6;
            }
            out.push(r);
        }
        return out;
    }

    /* ── Handle Length — scale Bézier control point handle distance ── */
    function applyHandleLength(cmds, amount) {
        // amount: -1 = retract handles fully, +1 = extend 2x
        const scale = 1 + amount;  // range: 0 to 2
        const result = [];
        for (const c of cmds) {
            const r = { ...c };
            if (r.type === 'C' && r.x1 !== undefined && r.x2 !== undefined) {
                // Find on-curve anchor points for this segment
                const prevAnchor = getPrevAnchor(cmds, cmds.indexOf(c));
                if (prevAnchor) {
                    // Scale cp1 relative to start anchor
                    r.x1 = prevAnchor.x + (c.x1 - prevAnchor.x) * scale;
                    r.y1 = prevAnchor.y + (c.y1 - prevAnchor.y) * scale;
                }
                // Scale cp2 relative to end anchor
                r.x2 = c.x + (c.x2 - c.x) * scale;
                r.y2 = c.y + (c.y2 - c.y) * scale;
            } else if (r.type === 'Q' && r.x1 !== undefined) {
                const prevAnchor = getPrevAnchor(cmds, cmds.indexOf(c));
                if (prevAnchor) {
                    const midX = (prevAnchor.x + c.x) / 2;
                    const midY = (prevAnchor.y + c.y) / 2;
                    r.x1 = midX + (c.x1 - midX) * scale;
                    r.y1 = midY + (c.y1 - midY) * scale;
                }
            }
            result.push(r);
        }
        return result;
    }

    function getPrevAnchor(cmds, idx) {
        for (let i = idx - 1; i >= 0; i--) {
            if (cmds[i].x !== undefined) return { x: cmds[i].x, y: cmds[i].y };
        }
        return null;
    }

    /* ── Node Density — simplify (<0) or subdivide (>0) paths ── */
    function applyNodeSimplify(cmds, amount, size) {
        if (amount > 0.01) {
            // Subdivide: split each curve segment into 2
            const subdiv = Math.min(amount, 1);
            const contours = splitContours(cmds);
            const result = [];
            for (const contour of contours) {
                for (let i = 0; i < contour.length; i++) {
                    const c = contour[i];
                    if (c.type === 'C' && Math.random() < subdiv) {
                        // De Casteljau midpoint split
                        const prev = getPrevAnchor(contour, i) || { x: 0, y: 0 };
                        const t = 0.5;
                        const ax = prev.x + (c.x1 - prev.x) * t;
                        const ay = prev.y + (c.y1 - prev.y) * t;
                        const bx = c.x1 + (c.x2 - c.x1) * t;
                        const by = c.y1 + (c.y2 - c.y1) * t;
                        const cx2 = c.x2 + (c.x - c.x2) * t;
                        const cy2 = c.y2 + (c.y - c.y2) * t;
                        const dx = ax + (bx - ax) * t;
                        const dy = ay + (by - ay) * t;
                        const ex = bx + (cx2 - bx) * t;
                        const ey = by + (cy2 - by) * t;
                        const fx = dx + (ex - dx) * t;
                        const fy = dy + (ey - dy) * t;
                        result.push({ type: 'C', x1: ax, y1: ay, x2: dx, y2: dy, x: fx, y: fy });
                        result.push({ type: 'C', x1: ex, y1: ey, x2: cx2, y2: cy2, x: c.x, y: c.y });
                    } else if (c.type === 'L' && Math.random() < subdiv * 0.5) {
                        const prev = getPrevAnchor(contour, i) || { x: 0, y: 0 };
                        const mx = (prev.x + c.x) / 2;
                        const my = (prev.y + c.y) / 2;
                        result.push({ type: 'L', x: mx, y: my });
                        result.push({ type: 'L', x: c.x, y: c.y });
                    } else {
                        result.push({ ...c });
                    }
                }
            }
            return result;
        } else if (amount < -0.01) {
            // Simplify: merge consecutive line segments that are nearly collinear
            const threshold = Math.abs(amount) * size * 0.04;
            const result = [];
            for (let i = 0; i < cmds.length; i++) {
                const c = cmds[i];
                if (c.type === 'L' && i + 1 < cmds.length && cmds[i + 1].type === 'L') {
                    const prev = getPrevAnchor(cmds, i);
                    const next = cmds[i + 1];
                    if (prev) {
                        // Check collinearity
                        const dx1 = c.x - prev.x, dy1 = c.y - prev.y;
                        const dx2 = next.x - c.x, dy2 = next.y - c.y;
                        const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
                        if (cross < threshold) {
                            continue; // Skip this point, go straight to next
                        }
                    }
                }
                result.push({ ...c });
            }
            return result;
        }
        return cmds;
    }

    /* ── Contour Offset — inset/outset with simple normal displacement ── */
    function applyContourOffset(cmds, amount, size) {
        const offset = amount * size * 0.03;
        const contours = splitContours(cmds);
        const result = [];

        for (const contour of contours) {
            const pts = [];
            const indices = [];
            for (let i = 0; i < contour.length; i++) {
                if (contour[i].x !== undefined) { pts.push([contour[i].x, contour[i].y]); indices.push(i); }
            }
            if (pts.length < 3) { result.push(...contour.map(c => ({ ...c }))); continue; }

            // Compute normals per vertex
            const normals = [];
            const n = pts.length;
            for (let i = 0; i < n; i++) {
                const prev = pts[(i - 1 + n) % n];
                const next = pts[(i + 1) % n];
                let nx = -(next[1] - prev[1]);
                let ny = next[0] - prev[0];
                const len = Math.sqrt(nx * nx + ny * ny) || 1;
                nx /= len; ny /= len;
                normals.push([nx, ny]);
            }

            // Apply offset to each point
            let normalIdx = 0;
            for (let i = 0; i < contour.length; i++) {
                const c = { ...contour[i] };
                if (c.x !== undefined && normalIdx < normals.length) {
                    const [nx, ny] = normals[normalIdx];
                    c.x += nx * offset;
                    c.y += ny * offset;
                    if (c.x1 !== undefined) { c.x1 += nx * offset; c.y1 += ny * offset; }
                    if (c.x2 !== undefined) { c.x2 += nx * offset; c.y2 += ny * offset; }
                    normalIdx++;
                }
                result.push(c);
            }
        }
        return result;
    }

    /* ── Point Snap — quantize coordinates to a grid ── */
    function applyPointSnap(cmds, amount, size) {
        if (amount < 0.01) return cmds;
        const gridSize = 2 + (1 - amount) * 0;  // Fixed at 2px when amount=1
        const grid = Math.max(2, size * 0.005 + amount * size * 0.04);
        const result = [];
        for (const c of cmds) {
            const r = { ...c };
            if (r.x !== undefined) {
                r.x = Math.round(r.x / grid) * grid * amount + r.x * (1 - amount);
                r.y = Math.round(r.y / grid) * grid * amount + r.y * (1 - amount);
            }
            if (r.x1 !== undefined) {
                r.x1 = Math.round(r.x1 / grid) * grid * amount + r.x1 * (1 - amount);
                r.y1 = Math.round(r.y1 / grid) * grid * amount + r.y1 * (1 - amount);
            }
            if (r.x2 !== undefined) {
                r.x2 = Math.round(r.x2 / grid) * grid * amount + r.x2 * (1 - amount);
                r.y2 = Math.round(r.y2 / grid) * grid * amount + r.y2 * (1 - amount);
            }
            result.push(r);
        }
        return result;
    }

    /* ══════════════════════════════════════════════════════════════
       FONT BLENDING — interpolate between two font outlines
    ══════════════════════════════════════════════════════════════ */
    function flattenPathToPolylines(cmds, pointsPerContour) {
        const contours = splitContours(cmds);
        const result = [];
        for (const contour of contours) {
            const pts = contourToPoints(contour, 80);
            if (pts.length < 2) continue;
            result.push(resamplePolyline(pts, pointsPerContour));
        }
        return result;
    }

    function resamplePolyline(pts, n) {
        const lengths = [0];
        let totalLen = 0;
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i][0] - pts[i-1][0];
            const dy = pts[i][1] - pts[i-1][1];
            totalLen += Math.sqrt(dx*dx + dy*dy);
            lengths.push(totalLen);
        }
        if (totalLen === 0) return pts.slice(0, n);
        const result = [];
        for (let i = 0; i < n; i++) {
            const targetLen = (i / Math.max(n-1, 1)) * totalLen;
            let j = 1;
            while (j < lengths.length - 1 && lengths[j] < targetLen) j++;
            const segLen = lengths[j] - lengths[j-1];
            const t = segLen > 0 ? (targetLen - lengths[j-1]) / segLen : 0;
            result.push([
                pts[j-1][0] + (pts[j][0] - pts[j-1][0]) * t,
                pts[j-1][1] + (pts[j][1] - pts[j-1][1]) * t
            ]);
        }
        return result;
    }

    function matchContoursByArea(polys1, polys2) {
        const area = (pts) => {
            let a = 0;
            for (let i = 0; i < pts.length; i++) {
                const j = (i + 1) % pts.length;
                a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
            }
            return a / 2;
        };
        const centroids1 = polys1.map(p => centroid(p));
        const centroids2 = polys2.map(p => centroid(p));
        const used2 = new Set();
        const matches = [];
        for (let i = 0; i < polys1.length; i++) {
            let bestJ = -1, bestD = Infinity;
            for (let j = 0; j < polys2.length; j++) {
                if (used2.has(j)) continue;
                const dx = centroids1[i][0] - centroids2[j][0];
                const dy = centroids1[i][1] - centroids2[j][1];
                const d = dx*dx + dy*dy;
                if (d < bestD) { bestD = d; bestJ = j; }
            }
            if (bestJ >= 0) { matches.push({ i, j: bestJ }); used2.add(bestJ); }
            else matches.push({ i, j: -1 });
        }
        for (let j = 0; j < polys2.length; j++) {
            if (!used2.has(j)) matches.push({ i: -1, j });
        }
        return matches;
    }

    /**
     * blendPaths(cmds1, cmds2, t, pointsPerContour)
     * Interpolate between two sets of path commands.
     * t=0 → cmds1,  t=1 → cmds2
     */
    function blendPaths(cmds1, cmds2, t, pointsPerContour = 120) {
        const polys1 = flattenPathToPolylines(cmds1, pointsPerContour);
        const polys2 = flattenPathToPolylines(cmds2, pointsPerContour);
        if (!polys1.length && !polys2.length) return [];
        const matches = matchContoursByArea(polys1, polys2);
        const result = [];
        for (const { i, j } of matches) {
            const p1 = i >= 0 ? polys1[i] : null;
            const p2 = j >= 0 ? polys2[j] : null;
            if (!p1 && !p2) continue;
            const n = pointsPerContour;
            const ctr1 = p1 ? centroid(p1) : centroid(p2);
            const ctr2 = p2 ? centroid(p2) : centroid(p1);
            const ref = p1 || p2;
            result.push({ type: 'M', x: 0, y: 0 }); // placeholder
            for (let k = 0; k < n; k++) {
                const a = p1 ? p1[k] : [ctr1[0], ctr1[1]];
                const b = p2 ? p2[k] : [ctr2[0], ctr2[1]];
                const bx = a[0] * (1 - t) + b[0] * t;
                const by = a[1] * (1 - t) + b[1] * t;
                if (k === 0) { result[result.length - 1].x = bx; result[result.length - 1].y = by; }
                else result.push({ type: 'L', x: bx, y: by });
            }
            result.push({ type: 'Z' });
        }
        return result;
    }

    /* ══════════════════════════════════════════════════════════════
       RADAR CHART — show all axis values as spider web
    ══════════════════════════════════════════════════════════════ */
    function drawRadarChart(canvas, axisValues) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#8b949e';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#58a6ff';

        const cx = w / 2, cy = h / 2;
        const radius = Math.min(cx, cy) * 0.68;
        const n = AXES.length;

        // Grid rings
        for (let lv = 1; lv <= 5; lv++) {
            const r = radius * lv / 5;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const angle = (i % n) * 2 * Math.PI / n - Math.PI / 2;
                const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.strokeStyle = 'rgba(128,128,128,0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Spokes
        for (let i = 0; i < n; i++) {
            const angle = i * 2 * Math.PI / n - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            ctx.strokeStyle = 'rgba(128,128,128,0.2)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Data polygon
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const axis = AXES[i % n];
            const val = (axisValues[axis.id] - axis.min) / (axis.max - axis.min);
            const angle = (i % n) * 2 * Math.PI / n - Math.PI / 2;
            const r = radius * Math.max(0, Math.min(1, val));
            const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.fillStyle = accentColor.replace(')', ',0.15)').replace('rgb', 'rgba');
        ctx.fill();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dots + labels
        ctx.font = '9px Inter, sans-serif';
        for (let i = 0; i < n; i++) {
            const axis = AXES[i];
            const val = (axisValues[axis.id] - axis.min) / (axis.max - axis.min);
            const angle = i * 2 * Math.PI / n - Math.PI / 2;
            const r = radius * Math.max(0, Math.min(1, val));
            const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);

            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.fill();

            const lx = cx + (radius + 16) * Math.cos(angle);
            const ly = cy + (radius + 16) * Math.sin(angle);
            ctx.fillStyle = textColor;
            ctx.textAlign = Math.cos(angle) > 0.1 ? 'left' : Math.cos(angle) < -0.1 ? 'right' : 'center';
            ctx.textBaseline = Math.sin(angle) > 0.1 ? 'top' : Math.sin(angle) < -0.1 ? 'bottom' : 'middle';
            ctx.fillText(axis.name, lx, ly);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       AXIS ROW — single-axis small multiples strip for remix sheet
    ══════════════════════════════════════════════════════════════ */
    function drawAxisRow(font, char, axisValues, canvas, axisId, steps = 7) {
        const axis = AXES.find(a => a.id === axisId);
        if (!axis) return null;
        const ctx = canvas.getContext('2d');
        const cellSize = 32;
        const gap = 3;
        const totalW = steps * (cellSize + gap) - gap;
        const totalH = cellSize;
        canvas.width = totalW;
        canvas.height = totalH;
        ctx.clearRect(0, 0, totalW, totalH);

        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF5500';
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || 'transparent';

        for (let col = 0; col < steps; col++) {
            const x = col * (cellSize + gap);
            const stepVal = axis.min + (col / (steps - 1)) * (axis.max - axis.min);
            const vals = { ...axisValues };
            vals[axis.id] = stepVal;

            const curNorm = ((axisValues[axis.id] || 0) - axis.min) / (axis.max - axis.min);
            const colNorm = col / (steps - 1);
            const isCurrent = Math.abs(curNorm - colNorm) < (1 / (steps - 1) / 2 + 0.01);

            ctx.fillStyle = isCurrent ? accentColor.replace(')', ',0.15)').replace('rgb', 'rgba') : bgColor;
            ctx.fillRect(x, 0, cellSize, cellSize);
            if (isCurrent) {
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 0.5, 0.5, cellSize - 1, cellSize - 1);
            }

            const cmds = FontRenderer.getPathCommands(font, char, cellSize * 0.78);
            if (cmds) {
                const morphed = morphCommands(cmds, vals, cellSize * 0.78);
                ctx.save();
                ctx.translate(x + (cellSize - cellSize * 0.78) / 2, (cellSize - cellSize * 0.78) / 2);
                ctx.beginPath();
                for (const c of morphed) {
                    switch (c.type) {
                        case 'M': ctx.moveTo(c.x, c.y); break;
                        case 'L': ctx.lineTo(c.x, c.y); break;
                        case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                        case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                        case 'Z': ctx.closePath(); break;
                    }
                }
                ctx.fillStyle = textColor;
                ctx.fill('nonzero');
                ctx.restore();
            }
        }

        return { steps, cellSize, gap, axisId };
    }

    /**
     * Map a click on an axis row to an axis value.
     */
    function axisRowClickToValue(clickX, meta) {
        if (!meta) return null;
        const { steps, cellSize, gap, axisId } = meta;
        const col = Math.floor(clickX / (cellSize + gap));
        if (col < 0 || col >= steps) return null;
        const axis = AXES.find(a => a.id === axisId);
        if (!axis) return null;
        return { [axis.id]: axis.min + (col / (steps - 1)) * (axis.max - axis.min) };
    }

    /* ══════════════════════════════════════════════════════════════
       STYLE MATRIX — small multiples for each axis
    ══════════════════════════════════════════════════════════════ */
    function drawStyleMatrix(font, char, axisValues, canvas, steps = 7) {
        const ctx = canvas.getContext('2d');
        const n = AXES.length;
        const cellSize = 38;
        const labelW = 90;
        const gap = 3;
        const totalW = labelW + steps * (cellSize + gap);
        const totalH = n * (cellSize + gap);
        canvas.width = totalW;
        canvas.height = totalH;
        ctx.clearRect(0, 0, totalW, totalH);

        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
        const text2Color = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#8b949e';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#58a6ff';
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || 'transparent';

        for (let row = 0; row < n; row++) {
            const axis = AXES[row];
            const y = row * (cellSize + gap);

            // Axis label
            ctx.fillStyle = text2Color;
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(axis.name, labelW - 8, y + cellSize / 2);

            for (let col = 0; col < steps; col++) {
                const x = labelW + col * (cellSize + gap);
                const stepVal = axis.min + (col / (steps - 1)) * (axis.max - axis.min);

                // Build axis values for this cell
                const vals = { ...axisValues };
                vals[axis.id] = stepVal;

                // Highlight current value
                const curNorm = (axisValues[axis.id] - axis.min) / (axis.max - axis.min);
                const colNorm = col / (steps - 1);
                const isCurrent = Math.abs(curNorm - colNorm) < (1 / (steps - 1) / 2 + 0.01);

                ctx.fillStyle = isCurrent ? accentColor.replace(')', ',0.2)').replace('rgb', 'rgba') : bgColor;
                ctx.fillRect(x, y, cellSize, cellSize);
                if (isCurrent) {
                    ctx.strokeStyle = accentColor;
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
                }

                // Render morphed glyph
                const cmds = FontRenderer.getPathCommands(font, char, cellSize * 0.85);
                if (cmds) {
                    const morphed = morphCommands(cmds, vals, cellSize * 0.85);
                    ctx.save();
                    ctx.translate(x + (cellSize - cellSize * 0.85) / 2, y + (cellSize - cellSize * 0.85) / 2);
                    ctx.beginPath();
                    for (const c of morphed) {
                        switch (c.type) {
                            case 'M': ctx.moveTo(c.x, c.y); break;
                            case 'L': ctx.lineTo(c.x, c.y); break;
                            case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                            case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                            case 'Z': ctx.closePath(); break;
                        }
                    }
                    ctx.fillStyle = textColor;
                    ctx.fill('nonzero');
                    ctx.restore();
                }
            }
        }

        return { steps, labelW, cellSize, gap, axesCount: n };
    }

    /**
     * Map a click on the style matrix back to axis values.
     */
    function styleMatrixClickToValues(clickX, clickY, meta) {
        if (!meta) return null;
        const { steps, labelW, cellSize, gap, axesCount } = meta;
        const col = Math.floor((clickX - labelW) / (cellSize + gap));
        const row = Math.floor(clickY / (cellSize + gap));
        if (col < 0 || col >= steps || row < 0 || row >= axesCount) return null;
        const axis = AXES[row];
        return { [axis.id]: axis.min + (col / (steps - 1)) * (axis.max - axis.min) };
    }

    /* ──────── Bounding box utilities ───────────────────────── */
    function commandsBBox(cmds) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of cmds) {
            for (const k of ['x','y','x1','y1','x2','y2']) {
                if (c[k] === undefined) continue;
                if (k.startsWith('x')) { minX = Math.min(minX, c[k]); maxX = Math.max(maxX, c[k]); }
                else { minY = Math.min(minY, c[k]); maxY = Math.max(maxY, c[k]); }
            }
        }
        return { minX, minY, maxX, maxY };
    }

    function pointsBBox(pts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of pts) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        return { minX, minY, maxX, maxY };
    }

    /* ══════════════════════════════════════════════════════════════
       RENDER MORPHED COMMANDS TO CANVAS
    ══════════════════════════════════════════════════════════════ */
    function drawMorphed(cmds, canvas, opts = {}) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (!cmds || !cmds.length) return;

        ctx.beginPath();
        for (const c of cmds) {
            switch (c.type) {
                case 'M': ctx.moveTo(c.x, c.y); break;
                case 'L': ctx.lineTo(c.x, c.y); break;
                case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                case 'Z': ctx.closePath(); break;
            }
        }
        ctx.fillStyle = opts.color || getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
        ctx.fill(opts.fillRule || 'nonzero');
    }

    /* ══════════════════════════════════════════════════════════════
       2D MANIFOLD HEATMAP
       Generate a grid of morphed glyphs varying two axes.
    ══════════════════════════════════════════════════════════════ */
    function generateHeatmap(font, char, axis1, axis2, gridSize, canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cellW = w / gridSize, cellH = h / gridSize;
        const baseCmds = FontRenderer.getPathCommands(font, char, Math.min(cellW, cellH) * 0.9);
        if (!baseCmds) return;

        const cellSize = Math.min(cellW, cellH) * 0.9;

        // Background gradient (reddish in center → bluish at edges, like UCL)
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const cx = col * cellW, cy = row * cellH;
                const dx = (col / (gridSize - 1)) - 0.5;
                const dy = (row / (gridSize - 1)) - 0.5;
                const dist = Math.sqrt(dx * dx + dy * dy) / 0.707;   // normalised
                const r = Math.max(0, Math.min(255, 200 - dist * 180));
                const b = Math.max(0, Math.min(255, 60 + dist * 195));
                ctx.fillStyle = `rgba(${r|0}, 40, ${b|0}, 0.15)`;
                ctx.fillRect(cx, cy, cellW, cellH);
            }
        }

        // grid lines
        ctx.strokeStyle = 'rgba(128,128,128,0.15)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * cellH); ctx.lineTo(w, i * cellH); ctx.stroke();
        }

        // Render morphed glyphs
        const axis1Obj = AXES.find(a => a.id === axis1);
        const axis2Obj = AXES.find(a => a.id === axis2);
        if (!axis1Obj || !axis2Obj) return;

        // re-generate path commands at cell size
        const cellCmds = FontRenderer.getPathCommands(font, char, cellSize);
        if (!cellCmds) return;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const v1 = axis1Obj.min + (col / (gridSize - 1)) * (axis1Obj.max - axis1Obj.min);
                const v2 = axis2Obj.min + (row / (gridSize - 1)) * (axis2Obj.max - axis2Obj.min);

                const vals = defaultValues();
                vals[axis1] = v1;
                vals[axis2] = v2;

                const morphed = morphCommands(cellCmds, vals, cellSize);

                // translate to cell position
                const ox = col * cellW + (cellW - cellSize) / 2;
                const oy = row * cellH + (cellH - cellSize) / 2;

                ctx.save();
                ctx.translate(ox, oy);
                ctx.beginPath();
                for (const c of morphed) {
                    switch (c.type) {
                        case 'M': ctx.moveTo(c.x, c.y); break;
                        case 'L': ctx.lineTo(c.x, c.y); break;
                        case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                        case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                        case 'Z': ctx.closePath(); break;
                    }
                }
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
                ctx.fill('nonzero');
                ctx.restore();
            }
        }

        // Axis labels
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#8b949e';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`← ${axis1Obj.leftLabel}   ${axis1Obj.name}   ${axis1Obj.rightLabel} →`, w / 2, h - 3);
        ctx.save();
        ctx.translate(10, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`← ${axis2Obj.leftLabel}   ${axis2Obj.name}   ${axis2Obj.rightLabel} →`, 0, 0);
        ctx.restore();

        return { axis1, axis2, gridSize, axis1Obj, axis2Obj };
    }

    /**
     * Get axis values from a heatmap click position.
     */
    function heatmapClickToValues(clickX, clickY, canvasW, canvasH, axis1, axis2, gridSize) {
        const col = Math.floor(clickX / (canvasW / gridSize));
        const row = Math.floor(clickY / (canvasH / gridSize));
        const a1 = AXES.find(a => a.id === axis1);
        const a2 = AXES.find(a => a.id === axis2);
        if (!a1 || !a2) return {};
        return {
            [axis1]: a1.min + (Math.min(col, gridSize - 1) / (gridSize - 1)) * (a1.max - a1.min),
            [axis2]: a2.min + (Math.min(row, gridSize - 1) / (gridSize - 1)) * (a2.max - a2.min),
        };
    }

    /* ══════════════════════════════════════════════════════════════
       RENDER FULL ALPHABET
    ══════════════════════════════════════════════════════════════ */
    function renderAlphabet(font, axisValues, canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const cols = 16;
        const rows = Math.ceil(chars.length / cols);
        const cellW = w / cols;
        const cellH = h / rows;
        const cellSize = Math.min(cellW, cellH) * 0.85;

        for (let i = 0; i < chars.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const ch = chars[i];

            const cmds = FontRenderer.getPathCommands(font, ch, cellSize);
            if (!cmds) continue;

            const morphed = morphCommands(cmds, axisValues, cellSize);
            const ox = col * cellW + (cellW - cellSize) / 2;
            const oy = row * cellH + (cellH - cellSize) / 2;

            ctx.save();
            ctx.translate(ox, oy);
            ctx.beginPath();
            for (const c of morphed) {
                switch (c.type) {
                    case 'M': ctx.moveTo(c.x, c.y); break;
                    case 'L': ctx.lineTo(c.x, c.y); break;
                    case 'Q': ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y); break;
                    case 'C': ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y); break;
                    case 'Z': ctx.closePath(); break;
                }
            }
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e6edf3';
            ctx.fill('nonzero');
            ctx.restore();
        }
    }

    /* ── Public API ────────────────────────────────────────────── */
    return {
        AXES,
        AXIS_CATEGORIES,
        PRESETS,
        morphCommands,
        drawMorphed,
        generateHeatmap,
        heatmapClickToValues,
        renderAlphabet,
        defaultValues,
        blendPaths,
        drawRadarChart,
        drawStyleMatrix,
        styleMatrixClickToValues,
        // Topology & structure analysis
        analyseGlyphTopology,
        validateMorphedTopology,
        analyseContourHierarchy,
        splitContours,
        contourToPoints,
        signedArea,
        // Vector stats
        countCommandStats,
        // Per-axis row for remix sheet
        drawAxisRow,
        axisRowClickToValue,
        // Skeleton extraction & visualization
        extractSkeleton,
        drawSkeletonViz,
    };
})();
