"""
Font Explorer - A comprehensive tool to analyze TTF font files
This script extracts and visualizes various aspects of TrueType fonts:
- Font metadata and information
- Unicode character mappings
- Bezier curves (glyph outlines)
- Rasterization at different resolutions
- Signed Distance Fields (SDF)
"""

import os
import sys
import glob
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import PathPatch
from matplotlib.path import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
import json

class FontExplorer:
    def __init__(self, font_path):
        """Initialize the font explorer with a TTF file path"""
        self.font_path = font_path
        self.font = TTFont(font_path)
        
        # Extract font family name for folder
        font_family = self._get_font_family_name()
        
        # Create font-specific output directory (in project root, not scripts folder)
        # Check if we're in scripts/ subdirectory
        if os.path.basename(os.getcwd()) == 'scripts':
            base_dir = '..'
        else:
            base_dir = '.'
        
        self.output_dir = os.path.join(base_dir, "font_analysis_results", font_family)
        
        # Create output directory if it doesn't exist
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f"\nCreated output directory: {self.output_dir}")
    
    def _get_font_family_name(self):
        """Extract the font family name from the font metadata"""
        try:
            name_table = self.font['name']
            for record in name_table.names:
                if record.nameID == 1:  # Font family name
                    family_name = record.toUnicode()
                    # Clean the name for use as a folder name
                    family_name = family_name.replace(' ', '_')
                    family_name = ''.join(c for c in family_name if c.isalnum() or c in ['_', '-'])
                    return family_name
        except:
            pass
        
        # Fallback: use the font file name without extension
        return os.path.splitext(os.path.basename(self.font_path))[0]
    
    def extract_metadata(self):
        """Extract basic font metadata and information"""
        print("\n" + "="*70)
        print("FONT METADATA")
        print("="*70)
        
        metadata = {}
        
        # Get font name information
        name_table = self.font['name']
        print("\n--- Font Names ---")
        for record in name_table.names:
            if record.nameID in [1, 2, 4, 6]:  # Family, Subfamily, Full name, PostScript name
                name_id_map = {1: "Family", 2: "Subfamily", 4: "Full Name", 6: "PostScript Name"}
                try:
                    value = record.toUnicode()
                    print(f"{name_id_map[record.nameID]}: {value}")
                    metadata[name_id_map[record.nameID]] = value
                except:
                    pass
        
        # Get head table information (font header)
        head = self.font['head']
        print("\n--- Font Header Info ---")
        print(f"Font Revision: {head.fontRevision}")
        print(f"Units Per Em: {head.unitsPerEm}")
        print(f"Created: {head.created}")
        print(f"Modified: {head.modified}")
        metadata['unitsPerEm'] = head.unitsPerEm
        
        # Get OS/2 table for language and script support
        if 'OS/2' in self.font:
            os2 = self.font['OS/2']
            print("\n--- OS/2 Table Info ---")
            print(f"Weight Class: {os2.usWeightClass}")
            print(f"Width Class: {os2.usWidthClass}")
            
        # Get number of glyphs
        if 'maxp' in self.font:
            maxp = self.font['maxp']
            print(f"\nTotal Glyphs: {maxp.numGlyphs}")
            metadata['numGlyphs'] = maxp.numGlyphs
        
        # Save metadata to JSON
        with open(f"{self.output_dir}/metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return metadata
    
    def extract_unicode_mappings(self):
        """Extract Unicode character to glyph mappings (cmap table)"""
        print("\n" + "="*70)
        print("UNICODE CHARACTER MAPPINGS")
        print("="*70)
        
        # Get the best cmap (character map) table
        cmap = self.font.getBestCmap()
        
        if cmap is None:
            print("No character map found in font!")
            return {}
        
        print(f"\nTotal mapped characters: {len(cmap)}")
        
        # Organize by Unicode blocks
        unicode_blocks = {}
        for char_code, glyph_name in cmap.items():
            # Determine Unicode block - comprehensive coverage
            if 0x0000 <= char_code <= 0x007F:
                block = "Basic Latin"
            elif 0x0080 <= char_code <= 0x00FF:
                block = "Latin-1 Supplement"
            elif 0x0100 <= char_code <= 0x017F:
                block = "Latin Extended-A"
            elif 0x0180 <= char_code <= 0x024F:
                block = "Latin Extended-B"
            elif 0x0250 <= char_code <= 0x02AF:
                block = "IPA Extensions"
            elif 0x02B0 <= char_code <= 0x02FF:
                block = "Spacing Modifier Letters"
            elif 0x0300 <= char_code <= 0x036F:
                block = "Combining Diacritical Marks"
            elif 0x0370 <= char_code <= 0x03FF:
                block = "Greek and Coptic"
            elif 0x0400 <= char_code <= 0x04FF:
                block = "Cyrillic"
            elif 0x0500 <= char_code <= 0x052F:
                block = "Cyrillic Supplement"
            elif 0x0530 <= char_code <= 0x058F:
                block = "Armenian"
            elif 0x0590 <= char_code <= 0x05FF:
                block = "Hebrew"
            elif 0x0600 <= char_code <= 0x06FF:
                block = "Arabic"
            elif 0x0700 <= char_code <= 0x074F:
                block = "Syriac"
            elif 0x0750 <= char_code <= 0x077F:
                block = "Arabic Supplement"
            elif 0x0780 <= char_code <= 0x07BF:
                block = "Thaana"
            elif 0x0900 <= char_code <= 0x097F:
                block = "Devanagari"
            elif 0x0980 <= char_code <= 0x09FF:
                block = "Bengali"
            elif 0x0A00 <= char_code <= 0x0A7F:
                block = "Gurmukhi"
            elif 0x0A80 <= char_code <= 0x0AFF:
                block = "Gujarati"
            elif 0x0B00 <= char_code <= 0x0B7F:
                block = "Oriya"
            elif 0x0B80 <= char_code <= 0x0BFF:
                block = "Tamil"
            elif 0x0C00 <= char_code <= 0x0C7F:
                block = "Telugu"
            elif 0x0C80 <= char_code <= 0x0CFF:
                block = "Kannada"
            elif 0x0D00 <= char_code <= 0x0D7F:
                block = "Malayalam"
            elif 0x0D80 <= char_code <= 0x0DFF:
                block = "Sinhala"
            elif 0x0E00 <= char_code <= 0x0E7F:
                block = "Thai"
            elif 0x0E80 <= char_code <= 0x0EFF:
                block = "Lao"
            elif 0x0F00 <= char_code <= 0x0FFF:
                block = "Tibetan"
            elif 0x1000 <= char_code <= 0x109F:
                block = "Myanmar"
            elif 0x10A0 <= char_code <= 0x10FF:
                block = "Georgian"
            elif 0x1100 <= char_code <= 0x11FF:
                block = "Hangul Jamo"
            elif 0x1200 <= char_code <= 0x137F:
                block = "Ethiopic"
            elif 0x13A0 <= char_code <= 0x13FF:
                block = "Cherokee"
            elif 0x1400 <= char_code <= 0x167F:
                block = "Unified Canadian Aboriginal Syllabics"
            elif 0x1680 <= char_code <= 0x169F:
                block = "Ogham"
            elif 0x16A0 <= char_code <= 0x16FF:
                block = "Runic"
            elif 0x1700 <= char_code <= 0x171F:
                block = "Tagalog"
            elif 0x1720 <= char_code <= 0x173F:
                block = "Hanunoo"
            elif 0x1740 <= char_code <= 0x175F:
                block = "Buhid"
            elif 0x1760 <= char_code <= 0x177F:
                block = "Tagbanwa"
            elif 0x1780 <= char_code <= 0x17FF:
                block = "Khmer"
            elif 0x1800 <= char_code <= 0x18AF:
                block = "Mongolian"
            elif 0x1E00 <= char_code <= 0x1EFF:
                block = "Latin Extended Additional"
            elif 0x1F00 <= char_code <= 0x1FFF:
                block = "Greek Extended"
            elif 0x2000 <= char_code <= 0x206F:
                block = "General Punctuation"
            elif 0x2070 <= char_code <= 0x209F:
                block = "Superscripts and Subscripts"
            elif 0x20A0 <= char_code <= 0x20CF:
                block = "Currency Symbols"
            elif 0x20D0 <= char_code <= 0x20FF:
                block = "Combining Diacritical Marks for Symbols"
            elif 0x2100 <= char_code <= 0x214F:
                block = "Letterlike Symbols"
            elif 0x2150 <= char_code <= 0x218F:
                block = "Number Forms"
            elif 0x2190 <= char_code <= 0x21FF:
                block = "Arrows"
            elif 0x2200 <= char_code <= 0x22FF:
                block = "Mathematical Operators"
            elif 0x2300 <= char_code <= 0x23FF:
                block = "Miscellaneous Technical"
            elif 0x2400 <= char_code <= 0x243F:
                block = "Control Pictures"
            elif 0x2440 <= char_code <= 0x245F:
                block = "Optical Character Recognition"
            elif 0x2460 <= char_code <= 0x24FF:
                block = "Enclosed Alphanumerics"
            elif 0x2500 <= char_code <= 0x257F:
                block = "Box Drawing"
            elif 0x2580 <= char_code <= 0x259F:
                block = "Block Elements"
            elif 0x25A0 <= char_code <= 0x25FF:
                block = "Geometric Shapes"
            elif 0x2600 <= char_code <= 0x26FF:
                block = "Miscellaneous Symbols"
            elif 0x2700 <= char_code <= 0x27BF:
                block = "Dingbats"
            elif 0x27C0 <= char_code <= 0x27EF:
                block = "Miscellaneous Mathematical Symbols-A"
            elif 0x2800 <= char_code <= 0x28FF:
                block = "Braille Patterns"
            elif 0x2E80 <= char_code <= 0x2EFF:
                block = "CJK Radicals Supplement"
            elif 0x2F00 <= char_code <= 0x2FDF:
                block = "Kangxi Radicals"
            elif 0x3000 <= char_code <= 0x303F:
                block = "CJK Symbols and Punctuation"
            elif 0x3040 <= char_code <= 0x309F:
                block = "Hiragana"
            elif 0x30A0 <= char_code <= 0x30FF:
                block = "Katakana"
            elif 0x3100 <= char_code <= 0x312F:
                block = "Bopomofo"
            elif 0x3130 <= char_code <= 0x318F:
                block = "Hangul Compatibility Jamo"
            elif 0x3190 <= char_code <= 0x319F:
                block = "Kanbun"
            elif 0x31A0 <= char_code <= 0x31BF:
                block = "Bopomofo Extended"
            elif 0x3200 <= char_code <= 0x32FF:
                block = "Enclosed CJK Letters and Months"
            elif 0x3300 <= char_code <= 0x33FF:
                block = "CJK Compatibility"
            elif 0x3400 <= char_code <= 0x4DBF:
                block = "CJK Unified Ideographs Extension A"
            elif 0x4E00 <= char_code <= 0x9FFF:
                block = "CJK Unified Ideographs"
            elif 0xA000 <= char_code <= 0xA48F:
                block = "Yi Syllables"
            elif 0xA490 <= char_code <= 0xA4CF:
                block = "Yi Radicals"
            elif 0xAC00 <= char_code <= 0xD7AF:
                block = "Hangul Syllables"
            elif 0xE000 <= char_code <= 0xF8FF:
                block = "Private Use Area"
            elif 0xF900 <= char_code <= 0xFAFF:
                block = "CJK Compatibility Ideographs"
            elif 0xFB00 <= char_code <= 0xFB4F:
                block = "Alphabetic Presentation Forms"
            elif 0xFB50 <= char_code <= 0xFDFF:
                block = "Arabic Presentation Forms-A"
            elif 0xFE20 <= char_code <= 0xFE2F:
                block = "Combining Half Marks"
            elif 0xFE30 <= char_code <= 0xFE4F:
                block = "CJK Compatibility Forms"
            elif 0xFE50 <= char_code <= 0xFE6F:
                block = "Small Form Variants"
            elif 0xFE70 <= char_code <= 0xFEFF:
                block = "Arabic Presentation Forms-B"
            elif 0xFF00 <= char_code <= 0xFFEF:
                block = "Halfwidth and Fullwidth Forms"
            elif 0xFFF0 <= char_code <= 0xFFFF:
                block = "Specials"
            elif 0x10000 <= char_code <= 0x1007F:
                block = "Linear B Syllabary"
            elif 0x10080 <= char_code <= 0x100FF:
                block = "Linear B Ideograms"
            elif 0x10100 <= char_code <= 0x1013F:
                block = "Aegean Numbers"
            elif 0x10300 <= char_code <= 0x1032F:
                block = "Old Italic"
            elif 0x10330 <= char_code <= 0x1034F:
                block = "Gothic"
            elif 0x10380 <= char_code <= 0x1039F:
                block = "Ugaritic"
            elif 0x1D000 <= char_code <= 0x1D0FF:
                block = "Byzantine Musical Symbols"
            elif 0x1D100 <= char_code <= 0x1D1FF:
                block = "Musical Symbols"
            elif 0x1D400 <= char_code <= 0x1D7FF:
                block = "Mathematical Alphanumeric Symbols"
            elif 0x20000 <= char_code <= 0x2A6DF:
                block = "CJK Unified Ideographs Extension B"
            elif 0xF0000 <= char_code <= 0xFFFFF:
                block = "Supplementary Private Use Area-A"
            elif 0x100000 <= char_code <= 0x10FFFF:
                block = "Supplementary Private Use Area-B"
            else:
                block = f"Other (U+{char_code:04X})"
            
            if block not in unicode_blocks:
                unicode_blocks[block] = []
            unicode_blocks[block].append((char_code, glyph_name, chr(char_code)))
        
        # Print summary
        print("\n--- Unicode Block Coverage ---")
        for block, chars in sorted(unicode_blocks.items()):
            print(f"{block}: {len(chars)} characters")
            # Show first few characters as examples
            if len(chars) <= 10:
                examples = chars
            else:
                examples = chars[:10]
            for char_code, glyph_name, char in examples:
                print(f"  U+{char_code:04X} '{char}' -> {glyph_name}")
            if len(chars) > 10:
                print(f"  ... and {len(chars) - 10} more")
        
        # Save mappings to file
        with open(f"{self.output_dir}/unicode_mappings.txt", 'w', encoding='utf-8') as f:
            f.write("Unicode Character Mappings\n")
            f.write("="*70 + "\n\n")
            for block, chars in sorted(unicode_blocks.items()):
                f.write(f"\n{block} ({len(chars)} characters):\n")
                f.write("-" * 50 + "\n")
                for char_code, glyph_name, char in chars:
                    f.write(f"U+{char_code:04X} '{char}' -> {glyph_name}\n")
        
        return unicode_blocks
    
    def extract_glyph_outlines(self, char='A'):
        """Extract Bezier curve data (outline) for a specific character"""
        print("\n" + "="*70)
        print(f"GLYPH OUTLINE (BEZIER CURVES) FOR '{char}'")
        print("="*70)
        
        # Get the glyph name for the character
        cmap = self.font.getBestCmap()
        if cmap is None or ord(char) not in cmap:
            print(f"Character '{char}' not found in font!")
            return None
        
        glyph_name = cmap[ord(char)]
        print(f"\nCharacter: '{char}' (U+{ord(char):04X})")
        print(f"Glyph Name: {glyph_name}")
        
        # Get the glyph set
        glyph_set = self.font.getGlyphSet()
        glyph = glyph_set[glyph_name]
        
        # Use a recording pen to capture the outline commands
        pen = RecordingPen()
        glyph.draw(pen)
        
        # Extract the outline data
        outline_data = pen.value
        
        print(f"\nOutline contains {len(outline_data)} drawing commands:")
        print("\nDrawing Commands (Bezier Curves):")
        print("-" * 50)
        
        for i, command in enumerate(outline_data[:10]):  # Show first 10 commands
            cmd_type = command[0]
            points = command[1] if len(command) > 1 else []
            
            if cmd_type == 'moveTo':
                print(f"{i+1}. Move to point: {points}")
            elif cmd_type == 'lineTo':
                print(f"{i+1}. Line to point: {points}")
            elif cmd_type == 'qCurveTo':
                print(f"{i+1}. Quadratic Bezier curve through: {points}")
            elif cmd_type == 'curveTo':
                print(f"{i+1}. Cubic Bezier curve through: {points}")
            elif cmd_type == 'closePath':
                print(f"{i+1}. Close path")
        
        if len(outline_data) > 10:
            print(f"... and {len(outline_data) - 10} more commands")
        
        # Visualize the outline
        self._visualize_glyph_outline(glyph_name, outline_data, char)
        
        return outline_data
    
    def _visualize_glyph_outline(self, glyph_name, outline_data, char):
        """Visualize the glyph outline using matplotlib"""
        fig, ax = plt.subplots(1, 1, figsize=(10, 10))
        
        # Convert outline commands to matplotlib path
        vertices = []
        codes = []
        
        for command in outline_data:
            cmd_type = command[0]
            points = command[1] if len(command) > 1 else []
            
            if cmd_type == 'moveTo':
                vertices.append(points[0])
                codes.append(Path.MOVETO)
            elif cmd_type == 'lineTo':
                vertices.append(points[0])
                codes.append(Path.LINETO)
            elif cmd_type == 'qCurveTo':
                # Quadratic Bezier: add control point and end point
                for i, pt in enumerate(points[:-1]):
                    vertices.append(pt)
                    codes.append(Path.CURVE3)
                vertices.append(points[-1])
                codes.append(Path.CURVE3)
            elif cmd_type == 'curveTo':
                # Cubic Bezier
                for i, pt in enumerate(points):
                    vertices.append(pt)
                    if i < len(points) - 1:
                        codes.append(Path.CURVE4)
                    else:
                        codes.append(Path.CURVE4)
            elif cmd_type == 'closePath':
                if vertices:
                    codes.append(Path.CLOSEPOLY)
                    vertices.append((0, 0))
        
        if vertices:
            path = Path(vertices, codes)
            patch = PathPatch(path, facecolor='lightblue', edgecolor='black', linewidth=2)
            ax.add_patch(patch)
            
            # Plot control points
            vertices_array = np.array(vertices)
            ax.plot(vertices_array[:, 0], vertices_array[:, 1], 'ro', markersize=3, label='Control Points')
        
        ax.set_aspect('equal')
        ax.set_title(f"Glyph Outline for '{char}' (Bezier Curves)", fontsize=16, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(f"{self.output_dir}/glyph_outline_{char}.png", dpi=150)
        print(f"\nSaved outline visualization to: {self.output_dir}/glyph_outline_{char}.png")
        plt.close()
    
    def rasterize_glyph(self, char='A', sizes=[32, 64, 128, 256]):
        """Rasterize a glyph at different resolutions (NxN, MxM)"""
        print("\n" + "="*70)
        print(f"GLYPH RASTERIZATION FOR '{char}'")
        print("="*70)
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 12))
        axes = axes.flatten()
        
        for idx, size in enumerate(sizes):
            print(f"\nRasterizing at {size}x{size} pixels...")
            
            # Create a PIL image
            img = Image.new('L', (size, size), color=255)  # White background
            draw = ImageDraw.Draw(img)
            
            # Try to load the font at the specified size
            try:
                pil_font = ImageFont.truetype(self.font_path, size=int(size * 0.8))
                
                # Draw the character
                # Get bounding box to center the character
                bbox = draw.textbbox((0, 0), char, font=pil_font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                x = (size - text_width) // 2 - bbox[0]
                y = (size - text_height) // 2 - bbox[1]
                
                draw.text((x, y), char, font=pil_font, fill=0)  # Black text
                
                # Convert to numpy array
                img_array = np.array(img)
                
                # Display
                axes[idx].imshow(img_array, cmap='gray')
                axes[idx].set_title(f'{size}x{size} pixels', fontsize=12, fontweight='bold')
                axes[idx].axis('off')
                
                # Save individual rasterization
                img.save(f"{self.output_dir}/raster_{char}_{size}x{size}.png")
                
            except Exception as e:
                print(f"Error rasterizing at {size}x{size}: {e}")
                axes[idx].text(0.5, 0.5, f'Error at {size}x{size}', 
                             ha='center', va='center', transform=axes[idx].transAxes)
                axes[idx].axis('off')
        
        plt.suptitle(f"Rasterization of '{char}' at Different Resolutions", 
                     fontsize=16, fontweight='bold')
        plt.tight_layout()
        plt.savefig(f"{self.output_dir}/rasterization_{char}_comparison.png", dpi=150)
        print(f"\nSaved rasterization comparison to: {self.output_dir}/rasterization_{char}_comparison.png")
        plt.close()
    
    def generate_sdf(self, char='A', size=128):
        """Generate Signed Distance Field (SDF) for a character"""
        print("\n" + "="*70)
        print(f"SIGNED DISTANCE FIELD (SDF) FOR '{char}'")
        print("="*70)
        
        # First, create a high-resolution rasterization
        high_res = size * 2
        img = Image.new('L', (high_res, high_res), color=255)
        draw = ImageDraw.Draw(img)
        
        try:
            pil_font = ImageFont.truetype(self.font_path, size=int(high_res * 0.8))
            bbox = draw.textbbox((0, 0), char, font=pil_font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (high_res - text_width) // 2 - bbox[0]
            y = (high_res - text_height) // 2 - bbox[1]
            
            draw.text((x, y), char, font=pil_font, fill=0)
            
            # Convert to binary (black/white)
            img_array = np.array(img)
            binary = (img_array < 128).astype(np.float32)
            
            # Calculate distance transform for inside (black pixels)
            dist_inside = distance_transform_edt(binary)
            
            # Calculate distance transform for outside (white pixels)
            dist_outside = distance_transform_edt(1 - binary)
            
            # Combine: positive inside, negative outside
            sdf = dist_inside - dist_outside
            
            # Normalize for visualization
            sdf_normalized = (sdf - sdf.min()) / (sdf.max() - sdf.min() + 1e-8)
            
            # Create visualization
            fig, axes = plt.subplots(1, 3, figsize=(18, 6))
            
            # Original raster
            axes[0].imshow(img_array, cmap='gray')
            axes[0].set_title('Original Rasterization', fontsize=14, fontweight='bold')
            axes[0].axis('off')
            
            # SDF visualization
            im = axes[1].imshow(sdf, cmap='RdBu_r')
            axes[1].set_title('Signed Distance Field (SDF)', fontsize=14, fontweight='bold')
            axes[1].axis('off')
            plt.colorbar(im, ax=axes[1], fraction=0.046, pad=0.04)
            
            # SDF with contours
            axes[2].imshow(sdf_normalized, cmap='viridis')
            axes[2].contour(sdf, levels=10, colors='white', linewidths=0.5)
            axes[2].set_title('SDF with Contours', fontsize=14, fontweight='bold')
            axes[2].axis('off')
            
            plt.suptitle(f"Signed Distance Field Analysis for '{char}'", 
                        fontsize=16, fontweight='bold')
            plt.tight_layout()
            plt.savefig(f"{self.output_dir}/sdf_{char}.png", dpi=150)
            print(f"\nSaved SDF visualization to: {self.output_dir}/sdf_{char}.png")
            plt.close()
            
            # Save SDF data
            np.save(f"{self.output_dir}/sdf_{char}_data.npy", sdf)
            print(f"Saved SDF data to: {self.output_dir}/sdf_{char}_data.npy")
            
            print("\nSDF Statistics:")
            print(f"  Min distance: {sdf.min():.2f}")
            print(f"  Max distance: {sdf.max():.2f}")
            print(f"  Mean distance: {sdf.mean():.2f}")
            
            return sdf
            
        except Exception as e:
            print(f"Error generating SDF: {e}")
            return None
    
    def analyze_font_tables(self):
        """Analyze all tables present in the font file"""
        print("\n" + "="*70)
        print("FONT TABLES ANALYSIS")
        print("="*70)
        
        print("\nTables present in this font:")
        print("-" * 50)
        
        table_descriptions = {
            'cmap': 'Character to glyph mapping',
            'head': 'Font header',
            'hhea': 'Horizontal header',
            'hmtx': 'Horizontal metrics',
            'maxp': 'Maximum profile',
            'name': 'Naming table',
            'OS/2': 'OS/2 and Windows metrics',
            'post': 'PostScript information',
            'cvt ': 'Control Value Table',
            'fpgm': 'Font program',
            'glyf': 'Glyph data',
            'loca': 'Index to location',
            'prep': 'Control Value Program',
            'gasp': 'Grid-fitting and scan conversion',
            'kern': 'Kerning',
            'GPOS': 'Glyph positioning',
            'GSUB': 'Glyph substitution',
            'DSIG': 'Digital signature',
        }
        
        for table_tag in self.font.keys():
            description = table_descriptions.get(table_tag, 'Unknown table')
            print(f"  {table_tag}: {description}")
        
        # Save table info
        with open(f"{self.output_dir}/font_tables.txt", 'w') as f:
            f.write("Font Tables\n")
            f.write("="*70 + "\n\n")
            for table_tag in self.font.keys():
                description = table_descriptions.get(table_tag, 'Unknown table')
                f.write(f"{table_tag}: {description}\n")
    
    def create_summary_report(self):
        """Create a summary report of the font analysis"""
        print("\n" + "="*70)
        print("CREATING SUMMARY REPORT")
        print("="*70)
        
        report = []
        report.append("="*70)
        report.append("FONT ANALYSIS SUMMARY REPORT")
        report.append("="*70)
        report.append(f"\nFont File: {os.path.basename(self.font_path)}")
        report.append(f"Analysis Date: {np.datetime64('today')}")
        report.append("\n" + "-"*70)
        
        # Read metadata
        try:
            with open(f"{self.output_dir}/metadata.json", 'r') as f:
                metadata = json.load(f)
                report.append("\nFONT METADATA:")
                for key, value in metadata.items():
                    report.append(f"  {key}: {value}")
        except:
            pass
        
        report.append("\n" + "-"*70)
        report.append("\nKEY CONCEPTS EXPLORED:")
        report.append("\n1. UNICODE MAPPINGS (cmap table):")
        report.append("   - Maps Unicode code points to glyph names")
        report.append("   - Determines which characters the font can display")
        report.append("   - Essential for multi-language support")
        
        report.append("\n2. BEZIER CURVES (glyf table):")
        report.append("   - Vector representation of glyph shapes")
        report.append("   - Uses quadratic and cubic Bezier curves")
        report.append("   - Allows scalable, resolution-independent rendering")
        
        report.append("\n3. RASTERIZATION:")
        report.append("   - Converts vector outlines to pixel grids (NxN, MxM)")
        report.append("   - Different resolutions show detail vs. performance trade-offs")
        report.append("   - Used for actual display on screens")
        
        report.append("\n4. SIGNED DISTANCE FIELD (SDF):")
        report.append("   - Stores distance to nearest edge for each pixel")
        report.append("   - Enables high-quality scaling and effects")
        report.append("   - Used in modern game engines and UI rendering")
        report.append("   - MSDF (Multi-channel SDF) uses RGB channels for better quality")
        
        report.append("\n" + "-"*70)
        report.append("\nOUTPUT FILES GENERATED:")
        report.append(f"  Output Directory: {self.output_dir}")
        report.append(f"  - ANALYSIS_REPORT.txt: This summary report")
        report.append(f"  - metadata.json: Font metadata")
        report.append(f"  - unicode_mappings.txt: Character mappings")
        report.append(f"  - glyph_outline_*.png: Bezier curve visualizations")
        report.append(f"  - rasterization_*.png: Raster representations")
        report.append(f"  - sdf_*.png: SDF visualizations")
        report.append(f"  - sdf_*_data.npy: SDF numerical data")
        report.append(f"  - font_tables.txt: List of font tables")
        
        report.append("\n" + "="*70)
        report.append("\nNEXT STEPS FOR AI FONT GENERATION:")
        report.append("="*70)
        report.append("\n1. Understanding Font Representation:")
        report.append("   - Study how glyphs are represented (vectors, SDFs, etc.)")
        report.append("   - Learn about font features (kerning, ligatures, etc.)")
        
        report.append("\n2. Data Collection:")
        report.append("   - Gather existing fonts in target scripts (e.g., Devanagari)")
        report.append("   - Create style reference images (e.g., Bollywood posters)")
        
        report.append("\n3. AI Model Approaches:")
        report.append("   - Generative models (GANs, VAEs, Diffusion models)")
        report.append("   - Image-to-image translation for style transfer")
        report.append("   - Vector generation (generating Bezier curves directly)")
        
        report.append("\n4. Tools & Libraries to Explore:")
        report.append("   - fontTools: Python library for font manipulation")
        report.append("   - FontForge: Open-source font editor with Python scripting")
        report.append("   - Deepfont: Research on font recognition")
        report.append("   - StyleGAN/Diffusion models for generation")
        
        report_text = '\n'.join(report)
        print(report_text)
        
        # Save report
        with open(f"{self.output_dir}/ANALYSIS_REPORT.txt", 'w', encoding='utf-8') as f:
            f.write(report_text)
        
        print(f"\n✓ Summary report saved to: {self.output_dir}/ANALYSIS_REPORT.txt")


def find_available_fonts():
    """Find all TTF/OTF fonts in the current directory and subdirectories"""
    font_extensions = ['*.ttf', '*.TTF', '*.otf', '*.OTF']
    fonts = []
    for ext in font_extensions:
        fonts.extend(glob.glob(f'**/{ext}', recursive=True))
    return sorted(fonts)


def select_font_interactive():
    """Let user select a font interactively"""
    available_fonts = find_available_fonts()
    
    if not available_fonts:
        print("No font files (.ttf or .otf) found in the current directory or subdirectories.")
        return None
    
    print("\n" + "="*70)
    print("AVAILABLE FONTS")
    print("="*70)
    for i, font in enumerate(available_fonts, 1):
        print(f"{i}. {font}")
    
    print("\n" + "-"*70)
    
    while True:
        try:
            choice = input(f"\nSelect a font (1-{len(available_fonts)}) or press Enter for first font: ").strip()
            
            if choice == "":
                return available_fonts[0]
            
            choice_num = int(choice)
            if 1 <= choice_num <= len(available_fonts):
                return available_fonts[choice_num - 1]
            else:
                print(f"Please enter a number between 1 and {len(available_fonts)}")
        except ValueError:
            print("Please enter a valid number")
        except KeyboardInterrupt:
            print("\n\nExiting...")
            return None


def main():
    """Main function to run the font exploration"""
    print("\n" + "="*70)
    print("FONT EXPLORER - TTF FILE ANALYSIS TOOL")
    print("="*70)
    print("\nThis tool will help you understand font file structure and rendering")
    print("by extracting and visualizing various font properties.\n")
    
    # Determine which font to analyze
    font_path = None
    
    # Method 1: Command-line argument
    if len(sys.argv) > 1:
        font_path = sys.argv[1]
        print(f"Using font from command line: {font_path}")
    
    # Method 2: Check for common locations/patterns
    elif os.path.exists("../fonts/Montserrat/static/Montserrat-Regular.ttf"):
        # Default fallback (when run from scripts/ directory)
        font_path = "../fonts/Montserrat/static/Montserrat-Regular.ttf"
        print(f"Using default font: {font_path}")
    elif os.path.exists("fonts/Montserrat/static/Montserrat-Regular.ttf"):
        # Default fallback (when run from project root)
        font_path = "fonts/Montserrat/static/Montserrat-Regular.ttf"
        print(f"Using default font: {font_path}")
    
    # Method 3: Interactive selection
    else:
        print("No font specified. Let's find available fonts...")
        font_path = select_font_interactive()
    
    # Check if we got a valid font path
    if font_path is None:
        print("\nNo font selected. Exiting.")
        return
    
    # Check if file exists
    if not os.path.exists(font_path):
        print(f"\nError: Font file not found at '{font_path}'")
        print("\nUsage:")
        print(f"  python {sys.argv[0]} <path-to-font.ttf>")
        print(f"\nExample:")
        print(f"  python {sys.argv[0]} Montserrat/static/Montserrat-Bold.ttf")
        print(f"  python {sys.argv[0]} /path/to/your/font.ttf")
        return
    
    print(f"\nAnalyzing font: {font_path}\n")
    
    # Create font explorer instance
    explorer = FontExplorer(font_path)
    
    # 1. Extract metadata
    explorer.extract_metadata()
    
    # 2. Extract Unicode mappings
    explorer.extract_unicode_mappings()
    
    # 3. Analyze font tables
    explorer.analyze_font_tables()
    
    # 4. Extract glyph outlines (Bezier curves)
    print("\nExtracting Bezier curves for sample characters...")
    for char in ['A', 'B', 'a']:
        explorer.extract_glyph_outlines(char)
    
    # 5. Rasterize glyphs at different resolutions
    print("\nRasterizing glyphs at different resolutions...")
    for char in ['A', 'a']:
        explorer.rasterize_glyph(char, sizes=[32, 64, 128, 256])
    
    # 6. Generate SDF
    print("\nGenerating Signed Distance Fields...")
    for char in ['A', 'a']:
        explorer.generate_sdf(char, size=128)
    
    # 7. Create summary report
    explorer.create_summary_report()
    
    print("\n" + "="*70)
    print("ANALYSIS COMPLETE!")
    print("="*70)
    print(f"\n✓ All results saved to: {explorer.output_dir}")
    print("\n📁 Generated files:")
    print("  ├─ ANALYSIS_REPORT.txt (Complete summary)")
    print("  ├─ metadata.json (Font information)")
    print("  ├─ unicode_mappings.txt (Character mappings)")
    print("  ├─ font_tables.txt (Font table info)")
    print("  ├─ glyph_outline_*.png (Bezier curves)")
    print("  ├─ rasterization_*.png (Pixel representations)")
    print("  └─ sdf_*.png (Distance fields)")
    print("\n" + "="*70)


if __name__ == "__main__":
    main()
