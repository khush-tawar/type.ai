# 📖 Usage Guide - Font Analysis Scripts

## 🚀 How to Analyze Any Font

Your scripts now support **three different ways** to analyze fonts. Choose the method that works best for you!

---

## Method 1: Command-Line Argument (Recommended)

Specify the font file directly when running the script:

```bash
# Simple analysis
python main.py "Montserrat/static/Montserrat-Bold.ttf"

# Complete analysis with visualizations
python font_explorer.py "Montserrat/static/Montserrat-Bold.ttf"
```

### Examples:

```bash
# Analyze a specific Montserrat variant
python font_explorer.py "Montserrat/static/Montserrat-Black.ttf"

# Analyze a font from your Desktop
python font_explorer.py "/Users/khush/Desktop/MyFont.ttf"

# Analyze a font from Downloads
python font_explorer.py "~/Downloads/NewFont.otf"

# Analyze variable font
python font_explorer.py "Montserrat/Montserrat-VariableFont_wght.ttf"
```

**Pros:**
- Fast and direct
- Great for scripting/automation
- Can use absolute or relative paths

---

## Method 2: Interactive Selection

Just run the script without arguments, and it will find all fonts in your project:

```bash
python font_explorer.py
```

You'll see a menu like this:

```
======================================================================
AVAILABLE FONTS
======================================================================
1. Montserrat/Montserrat-Italic-VariableFont_wght.ttf
2. Montserrat/Montserrat-VariableFont_wght.ttf
3. Montserrat/static/Montserrat-Black.ttf
4. Montserrat/static/Montserrat-BlackItalic.ttf
5. Montserrat/static/Montserrat-Bold.ttf
... (more fonts listed)

Select a font (1-18) or press Enter for first font: 
```

Just type the number and press Enter!

**Pros:**
- Easy for beginners
- See all available fonts at once
- No need to remember exact paths

---

## Method 3: Default Font

If you keep the default Montserrat font in place, the script will automatically use it:

```bash
python font_explorer.py
# Automatically uses: Montserrat/static/Montserrat-Regular.ttf
```

**Pros:**
- Quickest for testing
- No interaction needed

---

## 📦 Analyzing Different Font Types

### TrueType Fonts (.ttf)
```bash
python font_explorer.py "MyFont.ttf"
```

### OpenType Fonts (.otf)
```bash
python font_explorer.py "MyFont.otf"
```

### Variable Fonts
```bash
python font_explorer.py "Montserrat/Montserrat-VariableFont_wght.ttf"
```
*Note: Variable fonts have adjustable weight/width - analysis shows the default variant*

---

## 🌍 Working with Non-Latin Fonts

### Devanagari Fonts
```bash
# Download a Devanagari font first, then:
python font_explorer.py "NotoSansDevanagari-Regular.ttf"
```

### Arabic Fonts
```bash
python font_explorer.py "NotoNaskhArabic-Regular.ttf"
```

### Chinese Fonts
```bash
python font_explorer.py "NotoSansSC-Regular.otf"
```

The script will automatically detect and show which Unicode blocks are supported!

---

## 📂 Organizing Multiple Font Analyses

### Analyze a Series of Fonts

**Option A: Run individually** (each gets its own output folder)
```bash
python font_explorer.py "Montserrat/static/Montserrat-Thin.ttf"
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"
python font_explorer.py "Montserrat/static/Montserrat-Bold.ttf"
python font_explorer.py "Montserrat/static/Montserrat-Black.ttf"
```

**Option B: Create a batch script**

Create `analyze_all.sh`:
```bash
#!/bin/bash

for font in Montserrat/static/*.ttf; do
    echo "Analyzing $font..."
    python font_explorer.py "$font"
    
    # Move results to a named folder
    font_name=$(basename "$font" .ttf)
    mkdir -p "analysis_results/$font_name"
    mv font_analysis_output/* "analysis_results/$font_name/"
done
```

Run it:
```bash
chmod +x analyze_all.sh
./analyze_all.sh
```

---

## 🎨 Analyzing Your Own Font Projects

### For Font Designers

If you're working on your own font:

```bash
# Drag and drop your font onto the terminal
# Then add "python font_explorer.py" before the path
python font_explorer.py "/Users/khush/MyFontProject/build/MyFont-Regular.ttf"
```

### For Downloaded Fonts

```bash
# Move font to project directory first
cp ~/Downloads/InterestingFont.ttf .

# Then analyze
python font_explorer.py "InterestingFont.ttf"
```

---

## 📊 Output Location

All analysis results are saved to: **`font_analysis_output/`**

This folder contains:
- `ANALYSIS_REPORT.txt` - Text summary
- `*.png` - Visual representations
- `*.json` - Structured data
- `*.txt` - Raw data files

**Tip:** Rename or move this folder after each analysis to preserve results!

```bash
# Rename output for a specific font
mv font_analysis_output Montserrat_Bold_Analysis

# Now run another analysis
python font_explorer.py "Montserrat/static/Montserrat-Light.ttf"
```

---

## 🔍 Quick Comparison Examples

### Compare Regular vs Bold
```bash
# Analyze Regular
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"
mv font_analysis_output Regular_Analysis

# Analyze Bold
python font_explorer.py "Montserrat/static/Montserrat-Bold.ttf"
mv font_analysis_output Bold_Analysis

# Now compare the images side by side!
```

### Compare Different Font Families
```bash
# Analyze Montserrat
python font_explorer.py "Montserrat/static/Montserrat-Regular.ttf"
mv font_analysis_output Montserrat_Analysis

# Analyze another font family
python font_explorer.py "Arial.ttf"
mv font_analysis_output Arial_Analysis
```

---

## ⚡ Quick Reference

| What you want | Command |
|---------------|---------|
| Specify font directly | `python font_explorer.py "path/to/font.ttf"` |
| Choose from available | `python font_explorer.py` (then select) |
| Use default font | `python font_explorer.py` (just press Enter) |
| Simple analysis only | `python main.py "path/to/font.ttf"` |
| Get help | `python font_explorer.py --help` |

---

## 🐛 Troubleshooting

### "Font file not found"
**Problem:** The path to your font is incorrect.

**Solution:**
```bash
# Check if file exists
ls -la "Montserrat/static/Montserrat-Bold.ttf"

# Or use absolute path
python font_explorer.py "/Users/khush/Documents/IIT ID works/sem 4/AI Type/Montserrat/static/Montserrat-Bold.ttf"
```

### "No fonts found"
**Problem:** No .ttf or .otf files in current directory.

**Solution:**
```bash
# Check current directory
pwd

# Find fonts
find . -name "*.ttf"

# Or specify path directly
python font_explorer.py "path/to/your/font.ttf"
```

### Script shows empty Unicode blocks
**Problem:** Font doesn't support certain scripts.

**Solution:** This is normal! Not all fonts support all languages. The script shows what IS supported.

---

## 💡 Pro Tips

### 1. Use Tab Completion
```bash
python font_explorer.py Montserrat/static/Montserrat-<TAB>
# Your shell will auto-complete available files!
```

### 2. Drag and Drop (macOS/Linux)
```bash
# Type this:
python font_explorer.py 

# Then drag the .ttf file from Finder into Terminal
# The path will be auto-filled!
```

### 3. Analyze System Fonts
```bash
# macOS
python font_explorer.py "/System/Library/Fonts/Helvetica.ttc"

# Linux
python font_explorer.py "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
```

### 4. Process Multiple Characters
Edit `font_explorer.py` line ~574:
```python
# Change from:
for char in ['A', 'B', 'a']:

# To analyze more:
for char in ['A', 'B', 'C', 'a', 'b', 'c', '0', '1', '!', '@']:
```

### 5. Test Devanagari Characters
If your font supports Devanagari, add these lines:
```python
for char in ['अ', 'आ', 'इ', 'ई']:
    explorer.extract_glyph_outlines(char)
```

---

## 📚 Next Steps

1. **Test with different fonts**: Try analyzing 3-4 different fonts to see the differences
2. **Compare styles**: Analyze Thin, Regular, Bold, Black versions of the same font
3. **Test with target script**: Download and analyze a Devanagari font for your project
4. **Document findings**: Take screenshots and notes for your assignment

---

## 🎯 For Your Assignment

Show your professor:
1. **Multiple analyses**: Run the script on at least 3 different fonts
2. **Comparisons**: Show how Bezier curves differ between Thin and Bold
3. **Unicode coverage**: Show which scripts different fonts support
4. **SDF visualizations**: Explain how distance fields work using the generated images

---

## 📞 Need Help?

Check the main [README.md](README.md) for:
- Detailed concept explanations
- Understanding the output
- AI font generation next steps

Happy analyzing! 🚀
