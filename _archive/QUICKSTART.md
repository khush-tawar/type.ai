# Quick Start: Font Morphing & Style Transfer

## 🎯 What You Can Do Now

### 1. **Convolution Features** - Extract rich visual features
- Edge detection (Sobel, Laplacian)
- Style features (sharpen, emboss, ridges)
- Texture analysis (mean, variance)

### 2. **Multi-Axis Morphing** - Control 6 style axes
- **Serif ↔ Sans-Serif**: Transform between serif and sans-serif styles
- **Thin ↔ Bold**: Adjust weight/thickness
- **Backward ↔ Italic**: Apply slant transformations
- **Condensed ↔ Extended**: Adjust width
- **Humanist ↔ Geometric**: Control geometric precision
- **Plain ↔ Decorative**: Add ornamental details

### 3. **Style Transfer** - Apply styles across scripts
- Transfer Latin font styles to Devanagari
- Create consistent multi-script designs
- Blend multiple style attributes

### 4. **Neural Network Training** - Learn style representations
- Train on Google Colab (GPU accelerated)
- Learn latent font representations
- Generate new font variations

---

## 🚀 Get Started in 3 Steps

### Step 1: Run the Complete Pipeline

```bash
# Navigate to project directory
cd "/Users/khush/Documents/IIT ID works/sem 4/AI Type reseaarch/Project file"

# Activate virtual environment
source .venv/bin/activate

# Run complete pipeline on a font
./run_pipeline.sh fonts/Montserrat/static/Montserrat-Regular.ttf ABC
```

**What this does:**
- Analyzes the font structure
- Generates SDF representations
- Applies convolution filters
- Creates style heatmaps
- Generates morphing examples

**Output:** Check `font_pipeline_output/` folder

---

### Step 2: Test Individual Features

#### A. Test Convolution Module

```bash
cd scripts
python3 font_convolution.py
```

This creates a test glyph and applies all convolution filters.

**Output:** `test_conv_output/convolution_test.png`

#### B. Test Morphing System

```bash
cd scripts
python3 font_morphing.py
```

This demonstrates font morphing with various style combinations.

**Output:** `font_morphing_results/` folder with:
- Style heatmaps
- Style transfer examples
- Configuration files

---

### Step 3: Train on Google Colab

1. **Open the notebook:**
   - Go to [Google Colab](https://colab.research.google.com/)
   - Upload `font_training_colab.ipynb`

2. **Configure runtime:**
   - Runtime → Change runtime type → GPU (T4)

3. **Upload fonts:**
   - Run the upload cell
   - Select multiple TTF/OTF files

4. **Start training:**
   - Run all cells
   - Training takes ~2 hours for 100 epochs

5. **Download model:**
   - Download `font_vae_final.pt`
   - Use for local style transfer

---

## 📝 Common Use Cases

### Use Case 1: Create Bold Sans-Serif Version

```python
from scripts.font_morphing import FontMorphingSystem
import numpy as np

# Load glyph
glyph = np.load('font_analysis_results/Montserrat/sdf_A_data.npy')

# Initialize morpher
morpher = FontMorphingSystem()

# Apply transformation
result = morpher.morph_glyph(glyph, {
    'serif_scale': 0.8,  # Sans-serif
    'weight': 0.6        # Bold
})

# Save result
np.save('output_bold_sans.npy', result)
```

### Use Case 2: Explore Style Space

```python
# Create 2D heatmap showing serif vs weight variations
morpher.create_style_heatmap(
    glyph, 
    axis1='serif_scale',  # x-axis
    axis2='weight',       # y-axis
    resolution=10,
    char_name='A'
)

# Output: style_heatmap_A_serif_scale_vs_weight.png
```

### Use Case 3: Style Transfer to Devanagari

```python
from PIL import Image, ImageDraw, ImageFont

# Render Devanagari character
def render_char(char, font_path, size=128):
    img = Image.new('L', (size, size), color=255)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, size=int(size * 0.8))
    
    bbox = draw.textbbox((0, 0), char, font=font)
    x = (size - (bbox[2] - bbox[0])) // 2 - bbox[0]
    y = (size - (bbox[3] - bbox[1])) // 2 - bbox[1]
    
    draw.text((x, y), char, font=font, fill=0)
    return np.array(img).astype(np.float32) / 255.0

# Render
devanagari_glyph = render_char('अ', 'path/to/devanagari-font.ttf')

# Apply style
styled = morpher.apply_style_transfer(
    devanagari_glyph,
    {'serif_scale': 0.8, 'weight': 0.5, 'geometric': 0.6},
    char_name='Devanagari_styled'
)
```

### Use Case 4: Batch Process Characters

```python
# Process all uppercase letters
import string

chars = string.ascii_uppercase
target_style = {'serif_scale': 0.7, 'weight': 0.3, 'slant': 0.2}

for char in chars:
    # Load
    glyph = np.load(f'font_analysis_results/Font/sdf_{char}_data.npy')
    
    # Morph
    result = morpher.morph_glyph(glyph, target_style)
    
    # Save
    np.save(f'styled_output/{char}_styled.npy', result)
    
print(f"Processed {len(chars)} characters!")
```

---

## 🎨 Understanding the Axes

| Axis | Range | Left (-1) | Center (0) | Right (+1) |
|------|-------|-----------|------------|------------|
| **serif_scale** | -1 to +1 | More serif | Original | Sans-serif |
| **weight** | -1 to +1 | Thin | Medium | Bold |
| **slant** | -1 to +1 | Backward | Upright | Italic |
| **width** | -1 to +1 | Condensed | Normal | Extended |
| **geometric** | -1 to +1 | Humanist | Natural | Geometric |
| **decorative** | 0 to +1 | Plain | Moderate | Ornate |

### Combining Axes

You can combine multiple axes for complex styles:

```python
# Classic serif bold
classic_serif = {
    'serif_scale': -0.8,
    'weight': 0.5,
    'geometric': -0.3
}

# Modern sans thin
modern_sans = {
    'serif_scale': 0.9,
    'weight': -0.4,
    'geometric': 0.7
}

# Italic condensed
italic_condensed = {
    'slant': 0.7,
    'width': -0.5
}
```

---

## 📊 Visualizations Generated

After running the pipeline, you'll have:

### Convolution Features (`convolution_*.png`)
- Original glyph
- Sobel X & Y edge detection
- Gradient magnitude
- Laplacian edge detection
- Sharpen, emboss, outline, ridge detection
- Local texture statistics
- Gaussian blur at multiple scales

### Style Heatmaps (`style_heatmap_*.png`)
- 2D grid showing morphing across two axes
- Each cell shows the result at that position
- Useful for exploring the style space

### Style Transfer (`style_transfer_*.png`)
- Original glyph
- Morphed result
- Side-by-side comparison
- Style parameters shown

---

## 🐛 Troubleshooting

### Issue: "Module not found"
```bash
# Ensure you're in the virtual environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### Issue: "Font not rendering"
```python
# Check if character exists in font
from fontTools.ttLib import TTFont
font = TTFont('path/to/font.ttf')
cmap = font.getBestCmap()
print(ord('A') in cmap)  # Should be True
```

### Issue: "Out of memory on Colab"
```python
# Reduce batch size
BATCH_SIZE = 16  # Instead of 32

# Or reduce image size
IMAGE_SIZE = 32  # Instead of 64
```

---

## 📚 Next Steps

1. **Experiment**: Try different axis combinations
2. **Train**: Upload notebook to Colab and train on your fonts
3. **Explore**: Check out `docs/MORPHING_GUIDE.md` for advanced usage
4. **Extend**: Add custom axes for your specific needs
5. **Share**: Use the system for your design projects!

---

## 🔗 Resources

- **Main README**: `README.md`
- **Detailed Guide**: `docs/MORPHING_GUIDE.md`
- **SIGGRAPH Paper**: [http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/papers/siggraph14_learning_fonts.pdf](http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/papers/siggraph14_learning_fonts.pdf)

---

**Ready to start?** Run `./run_pipeline.sh` on your first font! 🚀
