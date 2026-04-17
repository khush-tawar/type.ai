/**
 * MODEL MANAGER - Handles model and font selection
 * Populates the header dropdowns with available models and fonts
 * Dispatches events when selections change
 */

const ModelManager = (() => {
  let state = {
    currentModel: null,
    currentFont: null,
    models: [],
    fonts: [],
    loading: false
  };

  /**
   * Initialize model manager - load models and fonts on page load
   */
  const init = async () => {
    try {
      console.log('[ModelManager] Initializing...');
      state.loading = true;
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          loadModels();
          loadFonts();
        });
      } else {
        await loadModels();
        await loadFonts();
      }
      
      // Setup event listeners
      setupEventListeners();
      console.log('[ModelManager] Initialized successfully');
    } catch (error) {
      console.error('[ModelManager] Initialization error:', error);
      showError('Failed to initialize Model Manager');
    }
  };

  /**
   * Load available models from API
   */
  const loadModels = async () => {
    try {
      const select = document.getElementById('model-select');
      const status = document.getElementById('model-status');
      
      if (!select) {
        console.warn('[ModelManager] model-select not found');
        return;
      }

      const response = await fetch('/api/models/list');
      const data = await response.json();

      state.models = data.models || [];
      
      // Clear existing options
      select.innerHTML = '';

      if (state.models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        option.disabled = true;
        select.appendChild(option);
        
        if (status) {
          status.textContent = 'No models';
          status.className = 'selector-status';
        }
        return;
      }

      // Add models to select
      state.models.forEach((model, idx) => {
        const option = document.createElement('option');
        option.value = model.version;
        option.textContent = `${model.version} (${new Date(model.created_at).toLocaleDateString()})`;
        if (idx === 0) option.selected = true;
        select.appendChild(option);
      });

      // Set current model to latest
      state.currentModel = state.models[0]?.version || null;
      
      if (status) {
        status.textContent = `${state.models.length} available`;
        status.className = 'selector-status active';
      }

      console.log(`[ModelManager] Loaded ${state.models.length} models`);
    } catch (error) {
      console.error('[ModelManager] Error loading models:', error);
      const select = document.getElementById('model-select');
      if (select) {
        select.innerHTML = '<option value="">Error loading models</option>';
      }
    }
  };

  /**
   * Load available fonts from API
   */
  const loadFonts = async () => {
    try {
      const select = document.getElementById('font-select');
      const status = document.getElementById('font-status');
      
      if (!select) {
        console.warn('[ModelManager] font-select not found');
        return;
      }

      const response = await fetch('/api/pipeline/status');
      const data = await response.json();

      state.fonts = data.font_names || [];
      
      // Clear existing options
      select.innerHTML = '';

      if (state.fonts.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No fonts available';
        option.disabled = true;
        select.appendChild(option);
        
        if (status) {
          status.textContent = 'No fonts';
          status.className = 'selector-status';
        }
        return;
      }

      // Add fonts to select
      state.fonts.forEach((font, idx) => {
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        if (idx === 0) option.selected = true;
        select.appendChild(option);
      });

      // Set current font to first available
      state.currentFont = state.fonts[0] || null;
      
      if (status) {
        status.textContent = `${state.fonts.length} available`;
        status.className = 'selector-status active';
      }

      console.log(`[ModelManager] Loaded ${state.fonts.length} fonts`);
    } catch (error) {
      console.error('[ModelManager] Error loading fonts:', error);
      const select = document.getElementById('font-select');
      if (select) {
        select.innerHTML = '<option value="">Error loading fonts</option>';
      }
    }
  };

  /**
   * Switch to a different model
   */
  const switchModel = async (version) => {
    try {
      console.log(`[ModelManager] Switching to model ${version}...`);
      
      const response = await fetch(`/api/models/${version}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to switch model: ${response.statusText}`);
      }

      state.currentModel = version;
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('model-selected', {
        detail: { version, timestamp: new Date() }
      }));

      console.log(`[ModelManager] Switched to model ${version}`);
      
      // Notify AI generator if available
      if (window.AIGenerator && window.AIGenerator.onModelChanged) {
        window.AIGenerator.onModelChanged(version);
      }
      
      return true;
    } catch (error) {
      console.error('[ModelManager] Error switching model:', error);
      showError(`Failed to switch to model ${version}`);
      return false;
    }
  };

  /**
   * Set current font for generation
   */
  const setFont = (fontName) => {
    try {
      state.currentFont = fontName;
      console.log(`[ModelManager] Font set to ${fontName}`);
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('font-selected', {
        detail: { font: fontName, timestamp: new Date() }
      }));

      // Notify AI generator if available
      if (window.AIGenerator && window.AIGenerator.onFontChanged) {
        window.AIGenerator.onFontChanged(fontName);
      }
      
      return true;
    } catch (error) {
      console.error('[ModelManager] Error setting font:', error);
      return false;
    }
  };

  /**
   * Setup change event listeners
   */
  const setupEventListeners = () => {
    const modelSelect = document.getElementById('model-select');
    const fontSelect = document.getElementById('font-select');

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          switchModel(e.target.value);
        }
      });
    }

    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          setFont(e.target.value);
        }
      });
    }
  };

  /**
   * Show error message to user
   */
  const showError = (message) => {
    console.error('[ModelManager]', message);
    // Could add toast notification here
    alert(message);
  };

  /**
   * Get current state (for debugging)
   */
  const getState = () => ({
    ...state,
    isLoading: state.loading
  });

  /**
   * Public API
   */
  return {
    init,
    loadModels,
    loadFonts,
    switchModel,
    setFont,
    getState,
    
    // Direct access to state getters (read-only)
    get currentModel() { return state.currentModel; },
    get currentFont() { return state.currentFont; },
    get models() { return [...state.models]; },
    get fonts() { return [...state.fonts]; },
    
    // Convenience methods
    getCurrentModel() { return state.currentModel; },
    getCurrentFont() { return state.currentFont; }
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ModelManager.init());
} else {
  ModelManager.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelManager;
}
