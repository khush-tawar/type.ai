"""
Font Convolution Module
Applies various convolutional filters to font glyphs for feature extraction and style transfer.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy import signal
from scipy.ndimage import convolve, gaussian_filter
import os


class FontConvolution:
    """Class to perform various convolutions on font glyphs"""
    
    def __init__(self, output_dir="font_analysis_results"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
    
    @staticmethod
    def create_edge_detection_kernels():
        """Create various edge detection kernels"""
        # Sobel operators
        sobel_x = np.array([[-1, 0, 1],
                           [-2, 0, 2],
                           [-1, 0, 1]])
        
        sobel_y = np.array([[-1, -2, -1],
                           [0, 0, 0],
                           [1, 2, 1]])
        
        # Prewitt operators
        prewitt_x = np.array([[-1, 0, 1],
                             [-1, 0, 1],
                             [-1, 0, 1]])
        
        prewitt_y = np.array([[-1, -1, -1],
                             [0, 0, 0],
                             [1, 1, 1]])
        
        # Laplacian
        laplacian = np.array([[0, 1, 0],
                             [1, -4, 1],
                             [0, 1, 0]])
        
        # Enhanced Laplacian
        laplacian_enhanced = np.array([[1, 1, 1],
                                      [1, -8, 1],
                                      [1, 1, 1]])
        
        return {
            'sobel_x': sobel_x,
            'sobel_y': sobel_y,
            'prewitt_x': prewitt_x,
            'prewitt_y': prewitt_y,
            'laplacian': laplacian,
            'laplacian_enhanced': laplacian_enhanced
        }
    
    @staticmethod
    def create_style_kernels():
        """Create kernels for style extraction"""
        # Sharpen
        sharpen = np.array([[0, -1, 0],
                          [-1, 5, -1],
                          [0, -1, 0]])
        
        # Emboss
        emboss = np.array([[-2, -1, 0],
                          [-1, 1, 1],
                          [0, 1, 2]])
        
        # Ridge detection
        ridge_horizontal = np.array([[-1, -1, -1],
                                    [2, 2, 2],
                                    [-1, -1, -1]])
        
        ridge_vertical = np.array([[-1, 2, -1],
                                  [-1, 2, -1],
                                  [-1, 2, -1]])
        
        # Outline detection
        outline = np.array([[-1, -1, -1],
                           [-1, 8, -1],
                           [-1, -1, -1]])
        
        return {
            'sharpen': sharpen,
            'emboss': emboss,
            'ridge_horizontal': ridge_horizontal,
            'ridge_vertical': ridge_vertical,
            'outline': outline
        }
    
    def apply_convolution(self, glyph_data, kernel, mode='constant'):
        """Apply a convolution kernel to glyph data"""
        return convolve(glyph_data, kernel, mode=mode)
    
    def extract_edge_features(self, glyph_data):
        """Extract edge features using multiple kernels"""
        kernels = self.create_edge_detection_kernels()
        features = {}
        
        for name, kernel in kernels.items():
            features[name] = self.apply_convolution(glyph_data, kernel)
        
        # Compute gradient magnitude (combining Sobel x and y)
        gradient_magnitude = np.sqrt(
            features['sobel_x']**2 + features['sobel_y']**2
        )
        features['gradient_magnitude'] = gradient_magnitude
        
        # Compute gradient direction
        gradient_direction = np.arctan2(
            features['sobel_y'], features['sobel_x']
        )
        features['gradient_direction'] = gradient_direction
        
        return features
    
    def extract_style_features(self, glyph_data):
        """Extract style features using various kernels"""
        kernels = self.create_style_kernels()
        features = {}
        
        for name, kernel in kernels.items():
            features[name] = self.apply_convolution(glyph_data, kernel)
        
        return features
    
    def apply_multi_scale_convolution(self, glyph_data, kernel, scales=[1, 2, 4]):
        """Apply convolution at multiple scales"""
        multi_scale_features = {}
        
        for scale in scales:
            # Resize kernel
            if scale > 1:
                scaled_kernel = np.kron(kernel, np.ones((scale, scale)))
            else:
                scaled_kernel = kernel
            
            # Apply convolution
            result = self.apply_convolution(glyph_data, scaled_kernel)
            multi_scale_features[f'scale_{scale}'] = result
        
        return multi_scale_features
    
    def extract_texture_features(self, glyph_data, window_size=3):
        """Extract local texture features using statistical moments"""
        features = {}
        
        # Local mean
        features['local_mean'] = convolve(
            glyph_data, 
            np.ones((window_size, window_size)) / (window_size**2)
        )
        
        # Local variance
        local_sq_mean = convolve(
            glyph_data**2,
            np.ones((window_size, window_size)) / (window_size**2)
        )
        features['local_variance'] = local_sq_mean - features['local_mean']**2
        
        # Local standard deviation
        features['local_std'] = np.sqrt(np.abs(features['local_variance']))
        
        return features
    
    def visualize_convolution_results(self, glyph_data, char='A', save_path=None):
        """Visualize all convolution results"""
        edge_features = self.extract_edge_features(glyph_data)
        style_features = self.extract_style_features(glyph_data)
        texture_features = self.extract_texture_features(glyph_data)
        
        # Create comprehensive visualization
        fig = plt.figure(figsize=(20, 12))
        
        # Original
        ax = plt.subplot(4, 5, 1)
        ax.imshow(glyph_data, cmap='gray')
        ax.set_title('Original Glyph', fontweight='bold')
        ax.axis('off')
        
        # Edge features
        plot_idx = 2
        for name in ['sobel_x', 'sobel_y', 'gradient_magnitude', 'laplacian']:
            ax = plt.subplot(4, 5, plot_idx)
            ax.imshow(edge_features[name], cmap='RdBu_r')
            ax.set_title(name.replace('_', ' ').title(), fontweight='bold')
            ax.axis('off')
            plot_idx += 1
        
        # Style features
        for name in ['sharpen', 'emboss', 'outline', 'ridge_horizontal', 'ridge_vertical']:
            ax = plt.subplot(4, 5, plot_idx)
            ax.imshow(style_features[name], cmap='viridis')
            ax.set_title(name.replace('_', ' ').title(), fontweight='bold')
            ax.axis('off')
            plot_idx += 1
        
        # Texture features
        for name in ['local_mean', 'local_variance', 'local_std']:
            ax = plt.subplot(4, 5, plot_idx)
            ax.imshow(texture_features[name], cmap='plasma')
            ax.set_title(name.replace('_', ' ').title(), fontweight='bold')
            ax.axis('off')
            plot_idx += 1
        
        # Gaussian blur (different scales)
        plot_idx += 1
        for sigma in [1, 2, 3]:
            ax = plt.subplot(4, 5, plot_idx)
            blurred = gaussian_filter(glyph_data, sigma=sigma)
            ax.imshow(blurred, cmap='gray')
            ax.set_title(f'Gaussian σ={sigma}', fontweight='bold')
            ax.axis('off')
            plot_idx += 1
        
        plt.suptitle(f'Convolution Features for Character "{char}"', 
                    fontsize=18, fontweight='bold', y=0.995)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight')
            print(f"Saved convolution visualization to: {save_path}")
        
        plt.close()
        
        return {
            'edge_features': edge_features,
            'style_features': style_features,
            'texture_features': texture_features
        }
    
    def extract_feature_vector(self, glyph_data):
        """Extract a comprehensive feature vector from glyph data"""
        edge_features = self.extract_edge_features(glyph_data)
        style_features = self.extract_style_features(glyph_data)
        texture_features = self.extract_texture_features(glyph_data)
        
        feature_vector = []
        
        # Statistical features from each convolution
        for features_dict in [edge_features, style_features, texture_features]:
            for name, feature_map in features_dict.items():
                # Extract statistics
                feature_vector.extend([
                    np.mean(feature_map),
                    np.std(feature_map),
                    np.min(feature_map),
                    np.max(feature_map),
                    np.median(feature_map)
                ])
        
        return np.array(feature_vector)


def test_convolution():
    """Test the convolution module with sample data"""
    print("Testing Font Convolution Module...")
    
    # Create a simple test glyph (letter-like shape)
    test_glyph = np.zeros((64, 64))
    test_glyph[10:50, 20:25] = 1  # Vertical stroke
    test_glyph[30:35, 20:45] = 1  # Horizontal stroke
    test_glyph[10:50, 40:45] = 1  # Vertical stroke
    
    # Initialize convolution module
    conv = FontConvolution(output_dir="test_conv_output")
    
    # Visualize results
    features = conv.visualize_convolution_results(
        test_glyph, 
        char='Test',
        save_path="test_conv_output/convolution_test.png"
    )
    
    # Extract feature vector
    feature_vec = conv.extract_feature_vector(test_glyph)
    print(f"\nExtracted feature vector length: {len(feature_vec)}")
    print(f"Feature vector sample: {feature_vec[:10]}")
    
    print("\nConvolution test complete!")


if __name__ == "__main__":
    test_convolution()
