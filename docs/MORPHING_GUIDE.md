# Font Morphing and Style Transfer Guide

## Overview

This guide covers the new font morphing and style transfer capabilities inspired by the SIGGRAPH 2014 paper ["Learning a Manifold of Fonts"](http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/projects_fonts.html).

## Features

### 1. **Convolution-Based Feature Extraction**
Extract rich features from font glyphs using various convolutional filters:
- Edge detection (Sobel, Prewitt, Laplacian)
- Style features (sharpen, emboss, ridge detection)
- Texture features (local mean, variance, std)
- Multi-scale analysis

### 2. **Multi-Axis Font Morphing**
Control font styles through multiple independent axes:
- **Serif Scale**: Serif ↔ Sans-Serif
- **Weight**: Thin ↔ Bold
- **Slant**: Backward ↔ Italic/Forward
- **Width**: Condensed ↔ Extended
- **Geometric**: Humanist ↔ Geometric
- **Decorative**: Plain ↔ Ornamental

### 3. **Neural Network Training (Google Colab)**
Train a Variational Autoencoder (VAE) to learn font style representations and enable style transfer.

---

## Quick Start

### Method 1: Complete Integrated Pipeline

Run the full pipeline on a font:

```bash
./run_pipeline.sh fonts/Montserrat/static/Montserrat-Regular.ttf ABC
```

This will:
1. Analyze the font and extract metadata
2. Generate SDFs for specified characters
3. Apply convolution filters
4. Create style heatmaps
5. Generate style transfer examples

### Method 2: Individual Components

#### A. Convolution Features

```python
from scripts.font_convolution import FontConvolution
import numpy as np

# Load your glyph data (e.g., from SDF)
glyph_data = np.load('font_analysis_results/Montserrat/sdf_A_data.npy')

# Initialize convolution module
conv = FontConvolution(output_dir="convolution_output")

# Extract all features
features = conv.visualize_convolution_results(
    glyph_data, 
    char='A',
    save_path='convolution_output/features_A.png'
)

# Get feature vector for ML
feature_vector = conv.extract_feature_vector(glyph_data)
print(f"Feature vector length: {len(feature_vector)}")
```

#### B. Font Morphing

```python
from scripts.font_morphing import FontMorphingSystem
import numpy as np

# Load glyph SDF
glyph = np.load('font_analysis_results/Montserrat/sdf_A_data.npy')

# Initialize morphing system
morpher = FontMorphingSystem(output_dir="morphing_output")

# Apply style transformation
styled_glyph = morpher.morph_glyph(
    glyph,
    axis_values={
        'serif_scale': -0.8,  # More serif
        'weight': 0.6,        # Bolder
        'slant': 0.3          # Slight italic
    }
)

# Create style heatmap
morpher.create_style_heatmap(
    glyph, 
    'serif_scale', 'weight',
    resolution=10,
    char_name='A'
)

# Apply style transfer
result = morpher.apply_style_transfer(
    glyph,
    target_style_axes={'serif_scale': 0.8, 'weight': -0.4},
    char_name='A_thin_sans'
)
```

---

## Google Colab Training

### Setup

1. **Upload the notebook to Google Colab:**
   - Open [Google Colab](https://colab.research.google.com/)
   - Upload `font_training_colab.ipynb`

2. **Upload your font files:**
   - Run the upload cell in the notebook
   - Upload TTF/OTF files from your `fonts/` directory

3. **Configure training:**
   ```python
   EPOCHS = 100
   LEARNING_RATE = 1e-3
   LATENT_DIM = 128
   BATCH_SIZE = 32
   ```

4. **Start training:**
   - Run all cells in sequence
   - Training will take 1-3 hours depending on GPU

### Using the Trained Model

After training, download the model and use it locally:

```python
import torch
from scripts.font_morphing import FontMorphingSystem

# Load the trained model
checkpoint = torch.load('font_vae_final.pt')
model = FontVAE(latent_dim=checkpoint['latent_dim'])
model.load_state_dict(checkpoint['model_state_dict'])
model.eval()

# Encode a glyph
with torch.no_grad():
    glyph_tensor = torch.FloatTensor(glyph).unsqueeze(0).unsqueeze(0)
    latent_z = model.encode(glyph_tensor)
    
    # Modify latent representation
    latent_z_modified = latent_z.clone()
    latent_z_modified[0, 10] += 2.0  # Change specific dimension
    
    # Decode back to glyph
    morphed_glyph = model.decode(latent_z_modified)
```

---

## Style Transfer for Devanagari

You can apply learned styles to Devanagari characters:

```python
from PIL import Image, ImageDraw, ImageFont
from scripts.font_morphing import FontMorphingSystem
import numpy as np

# Render Devanagari character
def render_devanagari(char, font_path, size=128):
    img = Image.new('L', (size, size), color=255)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, size=int(size * 0.8))
    
    bbox = draw.textbbox((0, 0), char, font=font)
    x = (size - (bbox[2] - bbox[0])) // 2 - bbox[0]
    y = (size - (bbox[3] - bbox[1])) // 2 - bbox[1]
    
    draw.text((x, y), char, font=font, fill=0)
    return np.array(img).astype(np.float32) / 255.0

# Render a Devanagari character
devanagari_char = 'अ'  # Hindi letter 'A'
glyph = render_devanagari(devanagari_char, 'path/to/devanagari-font.ttf')

# Apply style transfer
morpher = FontMorphingSystem()
styled = morpher.apply_style_transfer(
    glyph,
    target_style_axes={
        'serif_scale': 0.7,   # Sans-serif
        'weight': 0.5,        # Bold
        'geometric': 0.6      # More geometric
    },
    char_name=f'Devanagari_{devanagari_char}'
)
```

---

## Understanding the Axis System

### Axis Combinations

The power of this system comes from combining multiple axes:

| Left Axis ← | → Right Axis | Left Axis ← | → Right Axis |
|-------------|--------------|-------------|--------------|
| **Serif** (-1) | **Sans-Serif** (+1) | **Thin** (-1) | **Bold** (+1) |
| **Backward Slant** (-1) | **Italic** (+1) | **Condensed** (-1) | **Extended** (+1) |
| **Humanist** (-1) | **Geometric** (+1) | **Plain** (0) | **Decorative** (+1) |

### Example Combinations

```python
# Classic combinations
styles = {
    'Times New Roman style': {
        'serif_scale': -0.8,
        'weight': 0.2,
        'geometric': -0.4
    },
    'Helvetica style': {
        'serif_scale': 0.9,
        'weight': 0.0,
        'geometric': 0.6
    },
    'Italic Bold': {
        'slant': 0.7,
        'weight': 0.8
    },
    'Thin Condensed': {
        'weight': -0.7,
        'width': -0.6
    }
}

morpher = FontMorphingSystem()
for style_name, axes in styles.items():
    result = morpher.morph_glyph(glyph, axes)
    # Save or display result
```

---

## Advanced Usage

### Creating Custom Axes

```python
morpher = FontMorphingSystem()

# Add custom axis
morpher.add_axis(
    "roundness",
    min_val=-1.0,
    max_val=1.0,
    description="Angular (-1) to Rounded (+1)"
)

# Use the custom axis
result = morpher.morph_glyph(
    glyph,
    {'roundness': 0.8}  # Very rounded
)
```

### Interactive Exploration

```python
# Create interactive interface with sliders
fig, sliders = morpher.create_interactive_explorer(
    glyph, 
    char_name='A'
)

# In Jupyter/GUI mode, you can adjust sliders in real-time
```

### Batch Processing

```python
# Process multiple characters
characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
target_style = {'serif_scale': 0.7, 'weight': 0.3}

for char in characters:
    # Load glyph
    glyph = np.load(f'font_analysis_results/Font/sdf_{char}_data.npy')
    
    # Apply style
    styled = morpher.morph_glyph(glyph, target_style)
    
    # Save
    np.save(f'styled_output/styled_{char}.npy', styled)
```

---

## Tips and Best Practices

### 1. **Preprocessing**
- Always use SDF representations for better morphing results
- Normalize glyph data to [0, 1] range
- Center glyphs in the image space

### 2. **Training**
- Use diverse font families for training
- Include both serif and sans-serif fonts
- Train for at least 50-100 epochs
- Use beta-VAE (β > 1) for more disentangled representations

### 3. **Style Transfer**
- Start with conservative axis values (-0.5 to 0.5)
- Combine 2-3 axes at a time for best results
- Use heatmaps to explore the style space first

### 4. **Performance**
- Cache SDF computations for repeated use
- Use GPU for neural network inference
- Batch process multiple characters

---

## Troubleshooting

### Common Issues

**1. Characters not rendering correctly**
```python
# Ensure font supports the character
from fontTools.ttLib import TTFont
font = TTFont(font_path)
cmap = font.getBestCmap()
char_code = ord('A')
if char_code in cmap:
    print(f"Character supported: {cmap[char_code]}")
```

**2. Morphing produces artifacts**
- Reduce axis values (use smaller magnitudes)
- Increase SDF resolution
- Apply gaussian smoothing: `gaussian_filter(result, sigma=1)`

**3. Training not converging**
- Reduce learning rate
- Increase batch size
- Add more diverse training data
- Adjust beta parameter in VAE loss

---

## Examples Gallery

After running the pipeline, you'll find these visualizations:

```
font_pipeline_output/
├── convolution_A.png          # All convolution filters applied
├── style_heatmap_A_serif_scale_vs_weight.png
├── style_heatmap_A_slant_vs_width.png
├── style_transfer_A_Bold_Serif.png
├── style_transfer_A_Thin_Sans.png
└── pipeline_config.json
```

---

## References

- **Original Paper**: [Learning a Manifold of Fonts (SIGGRAPH 2014)](http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/projects_fonts.html)
- **Paper PDF**: [Download](http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/papers/siggraph14_learning_fonts.pdf)
- **VAE Tutorial**: [Understanding VAEs](https://arxiv.org/abs/1312.6114)
- **PyTorch Documentation**: [pytorch.org](https://pytorch.org/)

---

## Next Steps

1. **Experiment with different fonts**: Try various font families to see how styles transfer
2. **Train on your own data**: Collect fonts with specific characteristics you want to learn
3. **Extend to other scripts**: Apply to Arabic, Chinese, Korean, etc.
4. **Fine-tune models**: Train specialized models for specific use cases
5. **Build applications**: Create font generation tools, style transfer apps, or design assistants

Happy font morphing! 🎨
