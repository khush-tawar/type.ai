#!/usr/bin/env python3
"""
Integrated Font Analysis and Morphing Pipeline
Combines convolution, SDF, and morphing capabilities
"""

import os
import sys
import numpy as np
import argparse
from pathlib import Path

# Import our custom modules
try:
    from scripts.font_explorer import FontExplorer
    from scripts.font_convolution import FontConvolution
    from scripts.font_morphing import FontMorphingSystem
except ImportError:
    sys.path.append('scripts')
    from font_explorer import FontExplorer
    from font_convolution import FontConvolution
    from font_morphing import FontMorphingSystem


class IntegratedFontPipeline:
    """Complete pipeline for font analysis and morphing"""
    
    def __init__(self, font_path, output_dir="font_pipeline_output"):
        self.font_path = font_path
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize components
        print("Initializing pipeline components...")
        self.explorer = FontExplorer(font_path)
        self.convolution = FontConvolution(output_dir)
        self.morpher = FontMorphingSystem(output_dir)
        
        print(f"✓ Pipeline ready for: {font_path}")
    
    def analyze_font(self, chars='ABC'):
        """Step 1: Analyze font and extract features"""
        print("\n" + "="*70)
        print("STEP 1: FONT ANALYSIS")
        print("="*70)
        
        # Extract metadata
        metadata = self.explorer.extract_metadata()
        
        # Extract unicode mappings
        unicode_mappings = self.explorer.extract_unicode_mappings()
        
        # Analyze font tables
        self.explorer.analyze_font_tables()
        
        return metadata, unicode_mappings
    
    def extract_glyphs_with_features(self, chars='ABC'):
        """Step 2: Extract glyphs with convolution features"""
        print("\n" + "="*70)
        print("STEP 2: GLYPH EXTRACTION & FEATURE ANALYSIS")
        print("="*70)
        
        glyph_data = {}
        
        for char in chars:
            print(f"\nProcessing character: '{char}'")
            
            # Extract basic outlines
            outline = self.explorer.extract_glyph_outlines(char)
            
            # Visualize Bezier curves
            self.explorer.visualize_bezier_curves(char)
            
            # Generate rasterizations
            raster_data = self.explorer.generate_rasterizations(char)
            
            # Generate SDF
            sdf_data = self.explorer.generate_sdf(char)
            
            # Apply convolutions
            if sdf_data is not None:
                print(f"\nApplying convolution filters to '{char}'...")
                conv_features = self.convolution.visualize_convolution_results(
                    sdf_data, 
                    char=char,
                    save_path=f"{self.output_dir}/convolution_{char}.png"
                )
                
                # Extract feature vector
                feature_vec = self.convolution.extract_feature_vector(sdf_data)
                
                glyph_data[char] = {
                    'outline': outline,
                    'sdf': sdf_data,
                    'features': conv_features,
                    'feature_vector': feature_vec
                }
                
                print(f"✓ Extracted {len(feature_vec)} features for '{char}'")
        
        return glyph_data
    
    def create_morphing_space(self, glyph_data):
        """Step 3: Create morphing space for style transfer"""
        print("\n" + "="*70)
        print("STEP 3: FONT MORPHING & STYLE SPACE")
        print("="*70)
        
        # For each glyph, create style variations
        for char, data in glyph_data.items():
            sdf = data['sdf']
            if sdf is None:
                continue
            
            print(f"\nCreating style variations for '{char}'...")
            
            # Create 2D heatmaps for different axis combinations
            print("  - Creating serif vs weight heatmap...")
            self.morpher.create_style_heatmap(
                sdf, 'serif_scale', 'weight',
                resolution=8, char_name=char
            )
            
            print("  - Creating slant vs width heatmap...")
            self.morpher.create_style_heatmap(
                sdf, 'slant', 'width',
                resolution=8, char_name=char
            )
            
            # Test various style transfers
            print("  - Applying style transfers...")
            styles = [
                {'serif_scale': -0.7, 'weight': 0.5, 'name': 'Bold_Serif'},
                {'serif_scale': 0.7, 'weight': -0.3, 'name': 'Thin_Sans'},
                {'slant': 0.6, 'decorative': 0.5, 'name': 'Italic_Decorative'},
                {'geometric': 0.8, 'weight': 0.3, 'name': 'Geometric_Medium'}
            ]
            
            for style in styles:
                style_name = style.pop('name')
                result = self.morpher.apply_style_transfer(
                    sdf, style, char_name=f"{char}_{style_name}"
                )
    
    def run_complete_pipeline(self, chars='ABC'):
        """Run the complete pipeline"""
        print("\n" + "="*70)
        print("INTEGRATED FONT ANALYSIS & MORPHING PIPELINE")
        print("="*70)
        print(f"Font: {self.font_path}")
        print(f"Characters: {chars}")
        print(f"Output: {self.output_dir}")
        print("="*70)
        
        # Step 1: Analyze
        metadata, mappings = self.analyze_font(chars)
        
        # Step 2: Extract and process
        glyph_data = self.extract_glyphs_with_features(chars)
        
        # Step 3: Create morphing space
        self.create_morphing_space(glyph_data)
        
        # Save configuration
        config_path = os.path.join(self.output_dir, 'pipeline_config.json')
        self.morpher.save_configuration(config_path)
        
        print("\n" + "="*70)
        print("PIPELINE COMPLETE!")
        print("="*70)
        print(f"\nResults saved to: {self.output_dir}")
        print("\nGenerated files:")
        print("  - Font metadata and analysis reports")
        print("  - SDF visualizations")
        print("  - Convolution feature maps")
        print("  - Style heatmaps (2D morphing spaces)")
        print("  - Style transfer examples")
        print("  - Configuration files")
        print("\nNext steps:")
        print("  1. Review the generated visualizations")
        print("  2. Upload the notebook to Google Colab for training")
        print("  3. Use the trained model for style transfer")
        print("="*70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Integrated Font Analysis and Morphing Pipeline'
    )
    parser.add_argument(
        'font_path',
        type=str,
        help='Path to the font file (TTF/OTF)'
    )
    parser.add_argument(
        '--chars',
        type=str,
        default='ABC',
        help='Characters to analyze (default: ABC)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='font_pipeline_output',
        help='Output directory (default: font_pipeline_output)'
    )
    
    args = parser.parse_args()
    
    # Check if font exists
    if not os.path.exists(args.font_path):
        print(f"Error: Font file not found: {args.font_path}")
        sys.exit(1)
    
    # Run pipeline
    pipeline = IntegratedFontPipeline(args.font_path, args.output)
    pipeline.run_complete_pipeline(args.chars)


if __name__ == "__main__":
    main()
