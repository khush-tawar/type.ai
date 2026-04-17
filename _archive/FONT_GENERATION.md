# Font Generation with Unicode Mapping

## The Goal

**Generate downloadable fonts** from model outputs where:

1. ✅ Model generates glyph shapes (SDF vectors)
2. ✅ System maps shapes → Unicode codepoints
3. ✅ Create valid TTF/OTF binary with mapped glyphs
4. ✅ User downloads font file they can install
5. ✅ Font works in any application (Word, Figma, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (GitHub Pages)                                     │
│                                                              │
│  ┌─────────────────┐         ┌──────────────────┐          │
│  │ Model Selector  │         │  Font Selector   │          │
│  └────────┬────────┘         └────────┬─────────┘          │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│           ┌───────────▼──────────────┐                     │
│           │  Character Selection UI  │                     │
│           │  ┌────────────────────┐  │                     │
│           │  │ Mode:              │  │                     │
│           │  │ ○ Predefined Set   │  │                     │
│           │  │ ○ Custom Text      │  │                     │
│           │  │ ○ Character Range  │  │                     │
│           │  └────────────────────┘  │                     │
│           │  ┌────────────────────┐  │                     │
│           │  │ Input: "Hello ABC" │  │                     │
│           │  │ or: U+0041-U+005A │  │                     │
│           │  └────────────────────┘  │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│                  [Generate Font]                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ POST /api/generate
                        │ {
                        │   model: "v2",
                        │   font: "Roboto",
                        │   chars: "ABC" | "U+0041-U+005A",
                        │   mode: "text" | "range" | "preset"
                        │ }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (API Server)                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ FontGenerator.generate(model, font, chars, mode)     │  │
│  │                                                      │  │
│  │  1. Parse input:                                     │  │
│  │     "ABC" → ['A', 'B', 'C']                         │  │
│  │     "U+0041-U+005A" → [U+0041...U+005A]            │  │
│  │     "preset:latin" → [U+0000...U+007F]             │  │
│  │                                                      │  │
│  │  2. Lookup unicode codepoints:                       │  │
│  │     'A' → U+0041                                     │  │
│  │     'B' → U+0042                                     │  │
│  │     ...                                              │  │
│  │                                                      │  │
│  │  3. Generate glyph shapes:                           │  │
│  │     model.generate(U+0041) → [glyph vectors]       │  │
│  │     [glyph vectors] → SVG path → TTF contours     │  │
│  │                                                      │  │
│  │  4. Build font file:                                │  │
│  │     fontTools.ttLib.TTFont()                        │  │
│  │     ├─ cmap (character map)                         │  │
│  │     ├─ glyf (glyph contours)                        │  │
│  │     ├─ head (metadata)                              │  │
│  │     ├─ hhea (horizontal metrics)                    │  │
│  │     └─ [other required tables]                      │  │
│  │                                                      │  │
│  │  5. Embed unicode mapping:                           │  │
│  │     cmap[U+0041] = glyph_id_for_A                  │  │
│  │     cmap[U+0042] = glyph_id_for_B                  │  │
│  │     ...                                              │  │
│  │                                                      │  │
│  │  6. Export TTF/OTF:                                  │  │
│  │     font.save('output.ttf')                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                     │
│                  [binary TTF/OTF]                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ Download
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ USER'S COMPUTER                                             │
│                                                              │
│ generated-font-v2-roboto.ttf  ← Install & use in any app  │
│                                                              │
│ Works in:                                                   │
│ • Microsoft Word/Google Docs                                │
│ • Figma/Adobe Design Tools                                  │
│ • Web Browsers (with @font-face)                           │
│ • All OS (Windows/Mac/Linux)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation: Backend (Python)

### `server.py` - Font Generation Endpoint

```python
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
import numpy as np
import json

class FontGenerator:
    def __init__(self, model_version, source_font_path):
        """
        Args:
            model_version: "v2" (loaded from models/versions/v2/model.pt)
            source_font_path: Path to base font (e.g., "training_data/Roboto/Roboto-Regular.ttf")
        """
        self.model = load_model(model_version)  # Your VAE model
        self.base_font = TTFont(source_font_path)
        self.unicode_map = self._build_unicode_map()
    
    def _build_unicode_map(self):
        """
        Extract unicode → glyph mapping from base font
        Returns: {U+0041: 'A', U+0042: 'B', ...}
        """
        cmap = self.base_font['cmap']
        return cmap.getBestCmap()  # Gets the best cmap table
    
    def parse_input(self, input_str, mode):
        """
        Parse different input formats:
        - "ABC" (text) → ['A', 'B', 'C']
        - "U+0041-U+005A" (range) → [U+0041, ..., U+005A]
        - "preset:latin" → predefined sets
        """
        if mode == "text":
            return list(input_str)
        
        elif mode == "range":
            # "U+0041-U+005A"
            parts = input_str.split('-')
            start = int(parts[0].replace('U+', ''), 16)
            end = int(parts[1].replace('U+', ''), 16)
            return [chr(i) for i in range(start, end + 1)]
        
        elif mode == "preset":
            presets = {
                "latin": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
                "digits": "0123456789",
                "punctuation": "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
                "devanagari": "देवनागरी",  # Unicode Devanagari range
            }
            return list(presets.get(input_str, ""))
    
    def generate_glyph(self, unicode_char):
        """
        Generate glyph for a unicode character using the model
        
        Returns:
            path_data: SVG path string (e.g., "M 0 0 L 100 100 Z")
        """
        # 1. Get Unicode codepoint
        codepoint = ord(unicode_char)
        
        # 2. Create input vector for model
        # (encode codepoint as 32-dim vector or one-hot)
        input_vec = self._encode_codepoint(codepoint)
        
        # 3. Run through VAE to generate glyph
        with torch.no_grad():
            latent = self.model.encode(input_vec)
            glyph_vectors = self.model.decode(latent)
        
        # 4. Convert SDF vectors to TTF contours
        path = self._vectors_to_path(glyph_vectors)
        
        return path
    
    def _vectors_to_path(self, vectors):
        """
        Convert model output vectors to SVG/TTF path
        
        vectors shape: (n_points, 2) - x,y coordinates
        """
        # Normalize to glyph metrics
        vectors = np.array(vectors)
        
        # Scale to fit in glyph bounding box (1000x1000 typical)
        min_x, min_y = vectors.min(axis=0)
        max_x, max_y = vectors.max(axis=0)
        
        width = max_x - min_x
        height = max_y - min_y
        
        if width > 0:
            scale_x = 1000 / width
        else:
            scale_x = 1
        
        if height > 0:
            scale_y = 1000 / height
        else:
            scale_y = 1
        
        vectors = (vectors - np.array([min_x, min_y])) * np.array([scale_x, scale_y])
        
        # Convert to path string (simplified Bezier)
        path = f"M {int(vectors[0, 0])} {int(vectors[0, 1])}"
        
        for i in range(1, len(vectors)):
            path += f" L {int(vectors[i, 0])} {int(vectors[i, 1])}"
        
        path += " Z"  # Close path
        
        return path
    
    def build_font(self, glyphs_dict):
        """
        Build TTF font from glyph dictionary
        
        Args:
            glyphs_dict: {char: path_data, 'A': 'M 0 0 L ...', ...}
        
        Returns:
            TTFont object
        """
        # Create new font from base
        font = TTFont(self.base_font.path)  # Deep copy
        
        # Get existing glyf table
        glyphs = font['glyf']
        cmap_table = font['cmap'].getBestCmap()
        
        # Generate glyphs
        for char, path_data in glyphs_dict.items():
            codepoint = ord(char)
            
            # Skip if not in cmap
            if codepoint not in cmap_table:
                continue
            
            # Draw glyph from SVG path
            pen = TTGlyphPen(None)
            self._draw_path_to_pen(path_data, pen)
            
            # Get glyph name from cmap
            glyph_name = cmap_table[codepoint]
            
            # Update glyph
            glyphs[glyph_name] = pen.glyph()
        
        return font
    
    def _draw_path_to_pen(self, path_data, pen):
        """
        Parse SVG path and draw to TTGlyphPen
        Simplified parser (handles M, L, Z commands)
        """
        import re
        
        commands = re.findall(r'([MLHVCSQTAZ])([^MLHVCSQTAZ]*)', path_data)
        
        for cmd, coords_str in commands:
            coords = [float(x) for x in re.findall(r'-?\d+\.?\d*', coords_str)]
            
            if cmd == 'M':  # Move
                pen.moveTo((coords[0], coords[1]))
            elif cmd == 'L':  # Line
                pen.lineTo((coords[0], coords[1]))
            elif cmd == 'Z':  # Close
                pen.closePath()
    
    def generate(self, input_chars, mode="text"):
        """
        Main entry point
        
        Args:
            input_chars: "ABC" or "U+0041-U+005A"
            mode: "text" | "range" | "preset"
        
        Returns:
            TTF binary data (bytes)
        """
        # 1. Parse input to character list
        chars = self.parse_input(input_chars, mode)
        
        # 2. Generate glyphs for each character
        glyphs = {}
        for char in chars:
            try:
                glyph_path = self.generate_glyph(char)
                glyphs[char] = glyph_path
                print(f"✓ Generated: {char} (U+{ord(char):04X})")
            except Exception as e:
                print(f"✗ Failed for {char}: {e}")
                continue
        
        # 3. Build font
        font = self.build_font(glyphs)
        
        # 4. Export to bytes
        import io
        output = io.BytesIO()
        font.save(output)
        return output.getvalue()

# Flask endpoint
@app.route('/api/generate', methods=['POST'])
def generate_font():
    """
    POST /api/generate
    {
      "model": "v2",
      "font": "Roboto",
      "chars": "Hello",
      "mode": "text"  // or "range", "preset"
    }
    """
    data = request.json
    
    try:
        model_version = data.get('model', 'v2')
        font_name = data.get('font', 'Roboto')
        input_chars = data.get('chars', 'ABC')
        mode = data.get('mode', 'text')
        
        # Find font path
        font_path = f"training_data/{font_name}/{font_name}-Regular.ttf"
        
        # Generate
        gen = FontGenerator(model_version, font_path)
        font_bytes = gen.generate(input_chars, mode)
        
        # Return as downloadable file
        return send_file(
            io.BytesIO(font_bytes),
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=f'generated-{model_version}-{font_name}.ttf'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400
```

---

## Implementation: Frontend (JavaScript)

### `js/font-generator.js` - Character Selection UI

```javascript
const FontGeneratorUI = (() => {
  const modes = {
    preset: ['latin', 'digits', 'punctuation', 'devanagari'],
    text: '', // User enters text
    range: 'U+0041-U+005A' // User enters range
  };

  const createUI = () => {
    const html = `
      <div class="font-gen-panel">
        <h3>Generate Font</h3>
        
        <div class="gen-mode-selector">
          <label>
            <input type="radio" name="gen-mode" value="preset" checked>
            Preset Character Sets
          </label>
          <label>
            <input type="radio" name="gen-mode" value="text">
            Custom Text
          </label>
          <label>
            <input type="radio" name="gen-mode" value="range">
            Unicode Range
          </label>
        </div>
        
        <div id="mode-preset" class="gen-mode-content active">
          <select id="preset-select">
            <option value="latin">Latin A-Z, a-z, 0-9</option>
            <option value="digits">Digits 0-9</option>
            <option value="punctuation">Punctuation</option>
            <option value="devanagari">Devanagari (देवनागरी)</option>
          </select>
        </div>
        
        <div id="mode-text" class="gen-mode-content">
          <input 
            type="text" 
            id="custom-text" 
            placeholder="Enter text to generate (e.g., Hello World)"
            maxlength="100"
          >
          <small>Max 100 characters</small>
        </div>
        
        <div id="mode-range" class="gen-mode-content">
          <input 
            type="text" 
            id="unicode-range" 
            placeholder="e.g., U+0041-U+005A"
          >
          <small>Format: U+0041-U+005A for A-Z range</small>
        </div>
        
        <button id="gen-button" class="btn-generate">
          📥 Generate & Download Font
        </button>
        
        <div id="gen-status" class="gen-status"></div>
      </div>
    `;
    
    return html;
  };

  const setupListeners = () => {
    // Mode switching
    document.querySelectorAll('input[name="gen-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        document.querySelectorAll('.gen-mode-content').forEach(el => {
          el.classList.remove('active');
        });
        document.getElementById(`mode-${e.target.value}`).classList.add('active');
      });
    });

    // Generate button
    document.getElementById('gen-button').addEventListener('click', () => {
      generateFont();
    });
  };

  const getInput = () => {
    const mode = document.querySelector('input[name="gen-mode"]:checked').value;
    
    if (mode === 'preset') {
      return {
        mode: 'preset',
        chars: document.getElementById('preset-select').value
      };
    } else if (mode === 'text') {
      return {
        mode: 'text',
        chars: document.getElementById('custom-text').value
      };
    } else if (mode === 'range') {
      return {
        mode: 'range',
        chars: document.getElementById('unicode-range').value
      };
    }
  };

  const generateFont = async () => {
    const input = getInput();
    const model = ModelManager.currentModel;
    const font = ModelManager.currentFont;
    const status = document.getElementById('gen-status');

    if (!model || !font) {
      status.textContent = '❌ Select model and font first';
      return;
    }

    if (!input.chars) {
      status.textContent = '❌ Enter characters or select preset';
      return;
    }

    status.textContent = '⏳ Generating font...';
    status.className = 'gen-status loading';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          font: font,
          chars: input.chars,
          mode: input.mode
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-${model}-${font}.ttf`;
      link.click();

      status.textContent = '✅ Font downloaded! Install it to use.';
      status.className = 'gen-status success';
    } catch (error) {
      status.textContent = `❌ Error: ${error.message}`;
      status.className = 'gen-status error';
      console.error(error);
    }
  };

  return {
    createUI,
    setupListeners,
    init() {
      const container = document.getElementById('font-gen-container');
      if (container) {
        container.innerHTML = this.createUI();
        this.setupListeners();
      }
    }
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  FontGeneratorUI.init();
});
```

### `css/font-generator.css` - Styling

```css
.font-gen-panel {
  padding: 1.5rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 1rem 0;
}

.gen-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
}

.gen-mode-selector label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.gen-mode-content {
  display: none;
  padding: 1rem;
  background: var(--surface);
  border-radius: 4px;
  margin: 1rem 0;
}

.gen-mode-content.active {
  display: block;
}

.gen-mode-content input,
.gen-mode-content select {
  width: 100%;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.btn-generate {
  width: 100%;
  padding: 1rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-generate:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.gen-status {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-weight: 500;
}

.gen-status.loading {
  background: var(--accent-subtle);
  color: var(--accent);
}

.gen-status.success {
  background: #8AC27C20;
  color: #8AC27C;
}

.gen-status.error {
  background: #FF868620;
  color: #FF8686;
}
```

---

## Character vs Letter Sets

### Preset Sets Logic

```python
PRESETS = {
    "latin": {
        "name": "Latin",
        "range": (0x0041, 0x005A),  # A-Z and a-z + 0-9
        "description": "26 uppercase + 26 lowercase + 10 digits"
    },
    "devanagari": {
        "name": "Devanagari",
        "range": (0x0900, 0x097F),
        "description": "Indian script - 128 characters"
    },
    "arabic": {
        "name": "Arabic",
        "range": (0x0600, 0x06FF),
        "description": "Arabic script - 256 characters"
    },
    "cjk": {
        "name": "CJK Unified",
        "range": (0x4E00, 0x9FFF),
        "description": "Chinese/Japanese/Korean - 20,000+ characters"
    }
}

def get_preset_characters(preset_name):
    if preset_name not in PRESETS:
        return []
    
    range_tuple = PRESETS[preset_name]["range"]
    return [chr(i) for i in range(range_tuple[0], range_tuple[1] + 1)]
```

### Custom Text Mode

```python
# User enters: "Hello World"
# System generates glyphs for: H, e, l, o, space, W, r, d (8 glyphs)
# Maps each to unicode codepoint automatically
```

### Unicode Range Mode

```python
# User enters: "U+0041-U+005A"
# System generates: 26 glyphs (A-Z)
# User enters: "U+0900-U+0950"
# System generates: 80+ Devanagari glyphs
```

---

## Checklist

- [ ] Implement `FontGenerator` class in `server.py`
- [ ] Add `/api/generate` endpoint
- [ ] Create `FontGeneratorUI` in frontend
- [ ] Add font-generator.css styling
- [ ] Test with simple Latin set (A-B-C)
- [ ] Test with Devanagari preset
- [ ] Test with custom text ("Hello")
- [ ] Test with unicode range ("U+0041-U+005A")
- [ ] Verify TTF downloads and installs correctly
- [ ] Verify unicode mapping works (typing "A" shows generated glyph)

---

## Next Steps

1. Deploy API server (see [GITHUB_PAGES_DEPLOYMENT.md](GITHUB_PAGES_DEPLOYMENT.md))
2. Implement FontGenerator in Python
3. Add UI to webapp
4. Test end-to-end

