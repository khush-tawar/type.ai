"""
Font Morphing System with Multi-Axis Control
Inspired by "Learning a Manifold of Fonts" (SIGGRAPH 2014)
http://vecg.cs.ucl.ac.uk/Projects/projects_fonts/projects_fonts.html

This module implements:
- Multi-dimensional font style space
- Axis-based morphing (serif/sans-serif, weight, slant, etc.)
- Style transfer for Devanagari and other scripts
- Interactive font exploration
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from scipy.interpolate import interp1d, RBFInterpolator
from scipy.ndimage import gaussian_filter, map_coordinates
import json
import os
from typing import Dict, List, Tuple, Optional


class FontStyleAxis:
    """Represents a single style axis in font space"""
    
    def __init__(self, name: str, min_val: float = -1.0, max_val: float = 1.0,
                 description: str = ""):
        self.name = name
        self.min_val = min_val
        self.max_val = max_val
        self.description = description
        self.reference_fonts = {}  # Maps positions on axis to font examples
    
    def add_reference(self, position: float, font_data: np.ndarray, font_name: str = ""):
        """Add a reference font at a specific position on this axis"""
        self.reference_fonts[position] = {
            'data': font_data,
            'name': font_name
        }
    
    def interpolate(self, position: float, glyph_data: np.ndarray) -> np.ndarray:
        """Interpolate font style at a given position on this axis"""
        if not self.reference_fonts:
            return glyph_data
        
        # Find nearest references
        positions = sorted(self.reference_fonts.keys())
        
        if position <= positions[0]:
            return self.reference_fonts[positions[0]]['data']
        elif position >= positions[-1]:
            return self.reference_fonts[positions[-1]]['data']
        
        # Linear interpolation between two nearest points
        for i in range(len(positions) - 1):
            if positions[i] <= position <= positions[i + 1]:
                t = (position - positions[i]) / (positions[i + 1] - positions[i])
                data1 = self.reference_fonts[positions[i]]['data']
                data2 = self.reference_fonts[positions[i + 1]]['data']
                return (1 - t) * data1 + t * data2
        
        return glyph_data


class FontMorphingSystem:
    """Multi-axis font morphing system"""
    
    def __init__(self, output_dir="font_morphing_results"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        self.axes = {}
        self.base_fonts = {}  # Dictionary of base fonts for different styles
        self.feature_extractors = []
        
        # Initialize default axes
        self._initialize_default_axes()
    
    def _initialize_default_axes(self):
        """Initialize common font style axes"""
        # Axis 1: Serif vs Sans-Serif
        self.add_axis(
            "serif_scale",
            min_val=-1.0,
            max_val=1.0,
            description="Serif (-1) to Sans-Serif (+1)"
        )
        
        # Axis 2: Weight (thin to bold)
        self.add_axis(
            "weight",
            min_val=-1.0,
            max_val=1.0,
            description="Thin (-1) to Bold (+1)"
        )
        
        # Axis 3: Slant (italic/oblique)
        self.add_axis(
            "slant",
            min_val=-1.0,
            max_val=1.0,
            description="Backward slant (-1) to Forward slant (+1)"
        )
        
        # Axis 4: Width (condensed to extended)
        self.add_axis(
            "width",
            min_val=-1.0,
            max_val=1.0,
            description="Condensed (-1) to Extended (+1)"
        )
        
        # Axis 5: Geometric vs Humanist
        self.add_axis(
            "geometric",
            min_val=-1.0,
            max_val=1.0,
            description="Humanist (-1) to Geometric (+1)"
        )
        
        # Axis 6: Decorative/Ornamental
        self.add_axis(
            "decorative",
            min_val=0.0,
            max_val=1.0,
            description="Plain (0) to Decorative (1)"
        )
    
    def add_axis(self, name: str, min_val: float = -1.0, max_val: float = 1.0,
                 description: str = ""):
        """Add a new style axis to the system"""
        self.axes[name] = FontStyleAxis(name, min_val, max_val, description)
        print(f"Added axis: {name} - {description}")
    
    def add_base_font(self, font_name: str, glyph_data: np.ndarray, 
                      axis_positions: Dict[str, float]):
        """Add a base font with its position in the multi-dimensional style space"""
        self.base_fonts[font_name] = {
            'data': glyph_data,
            'positions': axis_positions
        }
        
        # Add as reference to each axis
        for axis_name, position in axis_positions.items():
            if axis_name in self.axes:
                self.axes[axis_name].add_reference(position, glyph_data, font_name)
    
    def morph_glyph(self, input_glyph: np.ndarray, 
                    axis_values: Dict[str, float]) -> np.ndarray:
        """
        Morph a glyph according to specified axis values
        
        Args:
            input_glyph: Input glyph as numpy array
            axis_values: Dictionary mapping axis names to values
            
        Returns:
            Morphed glyph data
        """
        morphed = input_glyph.copy()
        
        # Apply transformations for each axis
        for axis_name, value in axis_values.items():
            if axis_name in self.axes:
                morphed = self._apply_axis_transformation(
                    morphed, axis_name, value
                )
        
        return morphed
    
    def _apply_axis_transformation(self, glyph: np.ndarray, 
                                   axis_name: str, value: float) -> np.ndarray:
        """Apply transformation for a specific axis"""
        
        if axis_name == "serif_scale":
            return self._apply_serif_transformation(glyph, value)
        elif axis_name == "weight":
            return self._apply_weight_transformation(glyph, value)
        elif axis_name == "slant":
            return self._apply_slant_transformation(glyph, value)
        elif axis_name == "width":
            return self._apply_width_transformation(glyph, value)
        elif axis_name == "geometric":
            return self._apply_geometric_transformation(glyph, value)
        elif axis_name == "decorative":
            return self._apply_decorative_transformation(glyph, value)
        else:
            return glyph
    
    def _apply_serif_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply serif transformation
        value: -1 (add serifs) to +1 (remove serifs/make sans-serif)
        """
        if value > 0:
            # Remove serifs by smoothing edges
            sigma = value * 2.0
            return gaussian_filter(glyph, sigma=sigma)
        else:
            # Add serifs by enhancing edges
            from scipy.ndimage import sobel
            edges_x = sobel(glyph, axis=0)
            edges_y = sobel(glyph, axis=1)
            edge_magnitude = np.sqrt(edges_x**2 + edges_y**2)
            
            # Add serifs at stroke ends
            serif_strength = abs(value)
            enhanced = glyph + serif_strength * edge_magnitude * 0.3
            return np.clip(enhanced, 0, 1)
    
    def _apply_weight_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply weight transformation
        value: -1 (thin) to +1 (bold)
        """
        if value > 0:
            # Make bolder by dilation
            from scipy.ndimage import binary_dilation, grey_dilation
            iterations = int(value * 3) + 1
            structure = np.ones((3, 3))
            return grey_dilation(glyph, footprint=structure, size=(iterations, iterations))
        else:
            # Make thinner by erosion
            from scipy.ndimage import binary_erosion, grey_erosion
            iterations = int(abs(value) * 3) + 1
            structure = np.ones((3, 3))
            return grey_erosion(glyph, footprint=structure, size=(iterations, iterations))
    
    def _apply_slant_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply slant transformation
        value: -1 (backward slant) to +1 (forward slant/italic)
        """
        height, width = glyph.shape
        slant_angle = value * 0.3  # Max slant of ~17 degrees
        
        # Create transformation matrix for shearing
        result = np.zeros_like(glyph)
        
        for y in range(height):
            shift = int(slant_angle * (height - y))
            for x in range(width):
                new_x = x + shift
                if 0 <= new_x < width:
                    result[y, new_x] = glyph[y, x]
        
        return result
    
    def _apply_width_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply width transformation
        value: -1 (condensed) to +1 (extended)
        """
        from scipy.ndimage import zoom
        
        height, width = glyph.shape
        scale_factor = 1.0 + value * 0.5  # 0.5x to 1.5x width
        
        # Zoom horizontally
        scaled = zoom(glyph, (1.0, scale_factor), order=3)
        
        # Crop or pad to original width
        new_width = scaled.shape[1]
        if new_width > width:
            # Crop from center
            start = (new_width - width) // 2
            return scaled[:, start:start+width]
        else:
            # Pad to center
            result = np.zeros_like(glyph)
            start = (width - new_width) // 2
            result[:, start:start+new_width] = scaled
            return result
    
    def _apply_geometric_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply geometric vs humanist transformation
        value: -1 (humanist) to +1 (geometric)
        """
        if value > 0:
            # Make more geometric (perfect circles, straight lines)
            # Threshold to make edges sharper
            threshold = 0.5 - value * 0.2
            return (glyph > threshold).astype(float)
        else:
            # Make more humanist (softer, more variation)
            # Add subtle variations
            noise = np.random.normal(0, abs(value) * 0.05, glyph.shape)
            return np.clip(glyph + noise, 0, 1)
    
    def _apply_decorative_transformation(self, glyph: np.ndarray, value: float) -> np.ndarray:
        """
        Apply decorative transformation
        value: 0 (plain) to 1 (decorative)
        """
        if value > 0:
            # Add decorative elements
            from scipy.ndimage import binary_dilation
            
            # Detect edges
            edges = np.gradient(glyph)
            edge_magnitude = np.sqrt(edges[0]**2 + edges[1]**2)
            
            # Add decorative flourishes
            decorations = gaussian_filter(edge_magnitude, sigma=2) * value
            return np.clip(glyph + decorations * 0.5, 0, 1)
        
        return glyph
    
    def create_style_heatmap(self, glyph: np.ndarray, axis1: str, axis2: str,
                           resolution: int = 10, char_name: str = "A"):
        """
        Create a 2D heatmap showing morphing across two axes
        Similar to the SIGGRAPH paper visualization
        """
        axis1_range = np.linspace(
            self.axes[axis1].min_val,
            self.axes[axis1].max_val,
            resolution
        )
        axis2_range = np.linspace(
            self.axes[axis2].min_val,
            self.axes[axis2].max_val,
            resolution
        )
        
        fig, axes = plt.subplots(resolution, resolution, 
                                figsize=(16, 16))
        
        for i, val2 in enumerate(axis2_range):
            for j, val1 in enumerate(axis1_range):
                # Morph glyph
                morphed = self.morph_glyph(
                    glyph,
                    {axis1: val1, axis2: val2}
                )
                
                # Plot
                ax = axes[i, j]
                ax.imshow(morphed, cmap='gray')
                ax.axis('off')
                
                # Add labels on edges
                if i == 0:
                    ax.set_title(f'{val1:.1f}', fontsize=8)
                if j == 0:
                    ax.set_ylabel(f'{val2:.1f}', fontsize=8, rotation=0, 
                                ha='right', va='center')
        
        # Add axis labels
        fig.text(0.5, 0.98, f'{self.axes[axis1].description}', 
                ha='center', fontsize=14, fontweight='bold')
        fig.text(0.02, 0.5, f'{self.axes[axis2].description}', 
                va='center', rotation=90, fontsize=14, fontweight='bold')
        
        plt.suptitle(f'Font Style Space: "{char_name}"', 
                    fontsize=16, fontweight='bold', y=0.995)
        plt.tight_layout(rect=[0.03, 0.03, 0.97, 0.97])
        
        save_path = os.path.join(
            self.output_dir,
            f'style_heatmap_{char_name}_{axis1}_vs_{axis2}.png'
        )
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved style heatmap to: {save_path}")
        plt.close()
    
    def create_interactive_explorer(self, glyph: np.ndarray, char_name: str = "A"):
        """Create an interactive explorer with sliders for each axis"""
        fig, ax = plt.subplots(figsize=(10, 10))
        plt.subplots_adjust(left=0.1, bottom=0.35)
        
        # Initial display
        im = ax.imshow(glyph, cmap='gray')
        ax.set_title(f'Interactive Font Morpher: "{char_name}"', 
                    fontsize=16, fontweight='bold')
        ax.axis('off')
        
        # Create sliders
        sliders = {}
        slider_height = 0.03
        slider_spacing = 0.04
        
        for i, (axis_name, axis) in enumerate(self.axes.items()):
            ax_slider = plt.axes([0.1, 0.25 - i * slider_spacing, 
                                 0.8, slider_height])
            slider = Slider(
                ax_slider, axis_name,
                axis.min_val, axis.max_val,
                valinit=0.0,
                valstep=0.1
            )
            sliders[axis_name] = slider
        
        def update(val):
            # Get all slider values
            axis_values = {name: slider.val 
                          for name, slider in sliders.items()}
            
            # Morph glyph
            morphed = self.morph_glyph(glyph, axis_values)
            
            # Update display
            im.set_data(morphed)
            fig.canvas.draw_idle()
        
        # Connect sliders
        for slider in sliders.values():
            slider.on_changed(update)
        
        save_path = os.path.join(
            self.output_dir,
            f'interactive_morpher_{char_name}.png'
        )
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved interactive morpher interface to: {save_path}")
        
        # Note: Interactive version works in Jupyter/GUI mode
        return fig, sliders
    
    def apply_style_transfer(self, source_glyph: np.ndarray, 
                            target_style_axes: Dict[str, float],
                            char_name: str = "Input") -> np.ndarray:
        """
        Apply style transfer to a glyph (e.g., Devanagari character)
        using the learned style space
        """
        print(f"\nApplying style transfer to '{char_name}'...")
        print(f"Target style: {target_style_axes}")
        
        # Morph the glyph
        morphed = self.morph_glyph(source_glyph, target_style_axes)
        
        # Create visualization
        fig, axes = plt.subplots(1, 2, figsize=(12, 6))
        
        axes[0].imshow(source_glyph, cmap='gray')
        axes[0].set_title('Original', fontsize=14, fontweight='bold')
        axes[0].axis('off')
        
        axes[1].imshow(morphed, cmap='gray')
        style_text = '\n'.join([f'{k}: {v:.1f}' 
                               for k, v in target_style_axes.items()])
        axes[1].set_title(f'Styled\n{style_text}', 
                         fontsize=14, fontweight='bold')
        axes[1].axis('off')
        
        plt.suptitle(f'Style Transfer: "{char_name}"', 
                    fontsize=16, fontweight='bold')
        plt.tight_layout()
        
        save_path = os.path.join(
            self.output_dir,
            f'style_transfer_{char_name}.png'
        )
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved style transfer result to: {save_path}")
        plt.close()
        
        return morphed
    
    def save_configuration(self, filepath: str):
        """Save the morphing system configuration"""
        config = {
            'axes': {
                name: {
                    'min_val': axis.min_val,
                    'max_val': axis.max_val,
                    'description': axis.description
                }
                for name, axis in self.axes.items()
            },
            'base_fonts': list(self.base_fonts.keys())
        }
        
        with open(filepath, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"Saved configuration to: {filepath}")
    
    def load_configuration(self, filepath: str):
        """Load morphing system configuration"""
        with open(filepath, 'r') as f:
            config = json.load(f)
        
        # Recreate axes
        self.axes = {}
        for name, axis_config in config['axes'].items():
            self.add_axis(
                name,
                axis_config['min_val'],
                axis_config['max_val'],
                axis_config['description']
            )
        
        print(f"Loaded configuration from: {filepath}")


def create_demo_glyph():
    """Create a demo glyph for testing"""
    glyph = np.zeros((128, 128))
    
    # Draw a simple letter-like shape
    glyph[20:100, 35:45] = 1  # Left vertical stroke
    glyph[40:50, 35:85] = 1   # Horizontal stroke
    glyph[20:100, 75:85] = 1  # Right vertical stroke
    
    # Smooth it
    glyph = gaussian_filter(glyph, sigma=1.5)
    
    return glyph


def demo_morphing_system():
    """Demonstrate the font morphing system"""
    print("="*70)
    print("Font Morphing System Demo")
    print("="*70)
    
    # Create system
    morpher = FontMorphingSystem()
    
    # Create demo glyph
    test_glyph = create_demo_glyph()
    
    # Create style heatmaps
    print("\n1. Creating style heatmaps...")
    morpher.create_style_heatmap(test_glyph, 'serif_scale', 'weight', 
                                resolution=8, char_name='Demo')
    morpher.create_style_heatmap(test_glyph, 'slant', 'width',
                                resolution=8, char_name='Demo')
    
    # Test style transfer
    print("\n2. Testing style transfer...")
    styles = [
        {'serif_scale': -0.8, 'weight': 0.6},  # Serif Bold
        {'serif_scale': 0.8, 'weight': -0.4},  # Sans Thin
        {'slant': 0.7, 'width': -0.5},         # Italic Condensed
        {'decorative': 0.8, 'geometric': 0.6}  # Decorative Geometric
    ]
    
    for i, style in enumerate(styles):
        morpher.apply_style_transfer(test_glyph, style, 
                                    char_name=f'Style_{i+1}')
    
    # Save configuration
    print("\n3. Saving configuration...")
    morpher.save_configuration('font_morphing_results/config.json')
    
    print("\n" + "="*70)
    print("Demo complete! Check 'font_morphing_results/' folder.")
    print("="*70)


if __name__ == "__main__":
    demo_morphing_system()
