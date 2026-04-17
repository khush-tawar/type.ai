# 📚 Font Analysis Examples

This document shows real examples of how to use the font analysis tools with different fonts.

---

## 🎯 Example 1: Compare Font Weights

Analyze all Montserrat weights to see how Bezier curves change:

```bash
# Analyze Thin
python font_explorer.py "Montserrat/static/Montserrat-Thin.ttf"
mv font_analysis_output analysis_Thin

# Analyze Regular
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"
mv font_analysis_output analysis_Regular

# Analyze Bold
python font_explorer.py "Montserrat/static/Montserrat-Bold.ttf"
mv font_analysis_output analysis_Bold

# Analyze Black
python font_explorer.py "Montserrat/static/Montserrat-Black.ttf"
mv font_analysis_output analysis_Black
```

**What to observe:**
- Open `glyph_outline_A.png` in each folder
- Notice how the stroke width increases but the overall shape structure remains
- The Bezier control points shift outward as weight increases

---

## 🎯 Example 2: Analyze Variable Font

Variable fonts contain multiple weights in one file:

```bash
python font_explorer.py "Montserrat/Montserrat-VariableFont_wght.ttf"
```

**What to observe:**
- The analysis shows the default instance
- Check `metadata.json` for variable font information
- Variable fonts are used in modern web design for flexibility

---

## 🎯 Example 3: Quick Analysis of Multiple Fonts

Use the simple script for fast comparison:

```bash
# Create a comparison folder
mkdir quick_comparison

# Analyze multiple fonts quickly
for font in Montserrat/static/Montserrat-{Regular,Bold,Light}.ttf; do
    echo "=== Analyzing $(basename $font) ==="
    python main.py "$font" > "quick_comparison/$(basename $font .ttf).txt"
done

# Now compare the text reports
cat quick_comparison/*.txt
```

---

## 🎯 Example 4: Analyze Non-Latin Font (Devanagari)

First, download a Devanagari font (example: Noto Sans Devanagari):

```bash
# After downloading the font to your Downloads folder:
python font_explorer.py "~/Downloads/NotoSansDevanagari-Regular.ttf"
```

**What to observe:**
- Check `unicode_mappings.txt` for the Devanagari block (U+0900-U+097F)
- The glyph outlines will show complex ligatures unique to Devanagari
- Notice the different Unicode block coverage compared to Montserrat

**To analyze Devanagari characters**, modify `font_explorer.py` line 574:
```python
# Add Devanagari characters
for char in ['A', 'B', 'a', 'अ', 'आ', 'क']:
    explorer.extract_glyph_outlines(char)
```

---

## 🎯 Example 5: Analyze System Fonts

### macOS
```bash
# Analyze SF Pro (macOS system font)
python font_explorer.py "/System/Library/Fonts/SFNS.ttf"

# Analyze Helvetica
python font_explorer.py "/System/Library/Fonts/Helvetica.ttc"
```

### Windows
```bash
# Analyze Arial
python font_explorer.py "C:/Windows/Fonts/arial.ttf"

# Analyze Segoe UI
python font_explorer.py "C:/Windows/Fonts/segoeui.ttf"
```

### Linux
```bash
# Analyze Liberation Sans
python font_explorer.py "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

# Analyze DejaVu Sans
python font_explorer.py "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
```

---

## 🎯 Example 6: Analyze Downloaded Google Fonts

Download fonts from [Google Fonts](https://fonts.google.com/) and analyze them:

```bash
# Example: After downloading Roboto
python font_explorer.py "~/Downloads/Roboto/Roboto-Regular.ttf"

# Example: After downloading Noto Serif
python font_explorer.py "~/Downloads/Noto_Serif/NotoSerif-Regular.ttf"
```

---

## 🎯 Example 7: Batch Analysis with Results Organization

Create organized analysis of multiple fonts:

```bash
#!/bin/bash
# Save this as batch_analyze.sh

FONTS=(
    "Montserrat/static/Montserrat-Thin.ttf"
    "Montserrat/static/Montserrat-Regular.ttf"
    "Montserrat/static/Montserrat-Bold.ttf"
    "Montserrat/static/Montserrat-Black.ttf"
)

for font in "${FONTS[@]}"; do
    echo "Analyzing $font..."
    
    # Extract font name without path and extension
    font_name=$(basename "$font" .ttf)
    
    # Run analysis
    python font_explorer.py "$font"
    
    # Create organized output
    mkdir -p "batch_results/$font_name"
    mv font_analysis_output/* "batch_results/$font_name/"
    
    echo "Results saved to batch_results/$font_name/"
    echo "---"
done

echo "All analyses complete! Check batch_results/ folder."
```

Run it:
```bash
chmod +x batch_analyze.sh
./batch_analyze.sh
```

---

## 🎯 Example 8: Comparing Serif vs Sans-Serif

If you have both types of fonts:

```bash
# Sans-serif (Montserrat)
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"
mv font_analysis_output analysis_sans_serif

# Serif (if you have one, like Merriweather)
python font_explorer.py "Merriweather-Regular.ttf"
mv font_analysis_output analysis_serif
```

**What to observe:**
- Compare `glyph_outline_A.png` in both folders
- Serif fonts have decorative strokes (serifs) at the ends
- Sans-serif fonts have clean, straight endings
- The Bezier curves are fundamentally different

---

## 🎯 Example 9: Focus on Specific Characters

Modify the script to analyze specific characters you're interested in:

Edit `font_explorer.py` around line 574:

```python
# For Latin uppercase
for char in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']:
    explorer.extract_glyph_outlines(char)
    explorer.rasterize_glyph(char, sizes=[32, 64, 128, 256])
    explorer.generate_sdf(char, size=128)

# For punctuation and numbers
for char in ['!', '?', '.', ',', '0', '1', '2', '3']:
    explorer.extract_glyph_outlines(char)

# For special characters
for char in ['@', '#', '$', '%', '&']:
    explorer.extract_glyph_outlines(char)
```

---

## 🎯 Example 10: Create a Font Comparison Report

Compare multiple fonts for your assignment:

```bash
# Create comparison directory
mkdir font_comparison_report

# Analyze 3-4 different fonts
fonts=("Montserrat/static/Montserrat-Regular.ttf" 
       "Montserrat/static/Montserrat-Bold.ttf"
       "Montserrat/static/Montserrat-Thin.ttf")

for font in "${fonts[@]}"; do
    font_name=$(basename "$font" .ttf)
    echo "Processing $font_name..."
    
    python font_explorer.py "$font"
    
    # Copy specific images for comparison
    mkdir -p "font_comparison_report/$font_name"
    cp font_analysis_output/glyph_outline_A.png "font_comparison_report/$font_name/"
    cp font_analysis_output/rasterization_A_comparison.png "font_comparison_report/$font_name/"
    cp font_analysis_output/sdf_A.png "font_comparison_report/$font_name/"
    cp font_analysis_output/ANALYSIS_REPORT.txt "font_comparison_report/$font_name/"
done

echo "Comparison report ready in font_comparison_report/"
```

---

## 🎯 Example 11: Interactive Mode Demo

Simply run without arguments and follow the prompts:

```bash
python font_explorer.py
```

You'll see:
```
======================================================================
AVAILABLE FONTS
======================================================================
1. Montserrat/Montserrat-Italic-VariableFont_wght.ttf
2. Montserrat/Montserrat-VariableFont_wght.ttf
3. Montserrat/static/Montserrat-Black.ttf
...

Select a font (1-18) or press Enter for first font: 
```

Just type a number and press Enter!

---

## 🎯 Example 12: For Your Assignment Submission

Create a comprehensive analysis for your professor:

```bash
# 1. Quick overview of all fonts
echo "FONT INVENTORY" > assignment_report.txt
python main.py >> assignment_report.txt

# 2. Detailed analysis of one font
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"

# 3. Rename output for submission
mv font_analysis_output assignment_detailed_analysis

# 4. Compare two weights
python font_explorer.py "Montserrat/static/Montserrat-Thin.ttf"
mv font_analysis_output assignment_thin_weight

python font_explorer.py "Montserrat/static/Montserrat-Black.ttf"
mv font_analysis_output assignment_black_weight

# 5. Create a summary document
cat assignment_detailed_analysis/ANALYSIS_REPORT.txt >> assignment_report.txt
```

**Submit:**
- `assignment_report.txt` - Text summary
- `assignment_detailed_analysis/` - Full analysis with images
- `assignment_thin_weight/glyph_outline_A.png` - Thin weight example
- `assignment_black_weight/glyph_outline_A.png` - Black weight example

---

## 📊 Understanding the Output

Each analysis generates these key files:

### 1. `ANALYSIS_REPORT.txt`
- Complete summary in text format
- Font metadata and statistics
- Explained concepts
- Next steps

### 2. `glyph_outline_*.png`
- Visual representation of Bezier curves
- Shows control points (red dots)
- Demonstrates vector-based font rendering

### 3. `rasterization_*_comparison.png`
- Shows same character at 32x32, 64x64, 128x128, 256x256
- Demonstrates resolution vs. quality tradeoff

### 4. `sdf_*.png`
- Three panels: original, SDF, SDF with contours
- Red = outside glyph, Blue = inside glyph
- Shows distance field concept

### 5. `unicode_mappings.txt`
- Complete list of supported characters
- Organized by Unicode blocks
- Shows language coverage

---

## 💡 Pro Tips

1. **Always rename `font_analysis_output` after analysis** to preserve results:
   ```bash
   mv font_analysis_output results_FontName
   ```

2. **Use descriptive names** for saved analyses:
   ```bash
   mv font_analysis_output Montserrat_Bold_Analysis_Feb2026
   ```

3. **Compare images side-by-side** using Preview (macOS) or your image viewer

4. **Look for patterns** in Bezier curves across different weights

5. **Document insights** as you analyze - write notes in a separate file

---

## 🎓 For Your Learning

Try these exercises:

1. **Exercise 1:** Analyze 3 different weights, compare the number of glyphs
2. **Exercise 2:** Find which Unicode blocks are supported in Montserrat
3. **Exercise 3:** Compare Bezier curves between 'O' and '0' (letter O vs number zero)
4. **Exercise 4:** See how SDF changes between thin and bold weights
5. **Exercise 5:** Analyze an italic variant and compare with regular

---

## 📞 Quick Reference Commands

| Task | Command |
|------|---------|
| Analyze specific font | `python font_explorer.py "path/to/font.ttf"` |
| Choose interactively | `python font_explorer.py` |
| Quick text analysis | `python main.py "path/to/font.ttf"` |
| Menu-driven | `python analyze.py` |
| Batch analysis | See Example 7 above |

---

Happy analyzing! Use these examples as templates for your own exploration. 🚀
