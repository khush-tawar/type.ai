#!/usr/bin/env python3
"""
Unified Pipeline Manager — Orchestrate training pipeline with model versioning
==============================================================================

Handles:
  1. Font discovery from training_data/
  2. Manifest generation for Colab training
  3. Model versioning (v0, v1, v2...) with metadata
  4. Model registry tracking (fonts used, training date, performance)
  5. Model testing and deployment

Usage:
  python3 unified_pipeline_manager.py --status              # Show pipeline status
  python3 unified_pipeline_manager.py --prepare             # Generate training manifest
  python3 unified_pipeline_manager.py --register-model <path> <version>
  python3 unified_pipeline_manager.py --list-models         # Show all models
  python3 unified_pipeline_manager.py --info <version>      # Model details
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent


class ModelRegistry:
    """Manages versioned models and their metadata"""
    
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.registry_path = models_dir / "model_registry.json"
        self.versions_dir = models_dir / "versions"
        self.versions_dir.mkdir(parents=True, exist_ok=True)
        self.registry = self._load_registry()
    
    def _load_registry(self) -> Dict:
        """Load or initialize the model registry"""
        if self.registry_path.exists():
            with open(self.registry_path) as f:
                return json.load(f)
        return {
            "latest": None,
            "models": {},
            "legacy": []
        }
    
    def _save_registry(self) -> None:
        """Persist registry to disk"""
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.registry_path, 'w') as f:
            json.dump(self.registry, f, indent=2)
    
    def register_model(self, version: str, model_path: Path, metadata: Dict) -> Dict:
        """Register a new trained model"""
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        version_dir = self.versions_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy model to versioned directory
        versioned_model = version_dir / "model.pt"
        import shutil
        shutil.copy2(model_path, versioned_model)
        
        # Create model record
        record = {
            "version": version,
            "created_at": datetime.now().isoformat(),
            "model_path": str(versioned_model.relative_to(PROJECT_ROOT)),
            "fonts": metadata.get("fonts", []),
            "scripts": metadata.get("scripts", []),
            "training_config": metadata.get("training_config", {}),
            "performance": metadata.get("performance", {}),
            "status": "active"
        }
        
        # Update registry
        self.registry["models"][version] = record
        self.registry["latest"] = version
        self._save_registry()
        
        print(f"✅ Registered model v{version}")
        return record
    
    def get_model_path(self, version: str) -> Optional[Path]:
        """Get path to a specific model version"""
        if version not in self.registry["models"]:
            return None
        model_info = self.registry["models"][version]
        return PROJECT_ROOT / model_info["model_path"]
    
    def get_latest(self) -> Optional[str]:
        """Get the latest model version"""
        return self.registry.get("latest")
    
    def list_models(self) -> List[Dict]:
        """List all active models"""
        models = []
        for version, info in self.registry["models"].items():
            if info.get("status") == "active":
                models.append(info)
        return sorted(models, key=lambda x: x["version"], reverse=True)
    
    def get_model_info(self, version: str) -> Optional[Dict]:
        """Get detailed info about a model"""
        return self.registry["models"].get(version)
    
    def deprecate_model(self, version: str) -> None:
        """Mark a model as deprecated"""
        if version in self.registry["models"]:
            self.registry["models"][version]["status"] = "deprecated"
            self.registry["legacy"].append(version)
            self._save_registry()
            print(f"⚠️  Deprecated model v{version}")


class UnifiedPipelineManager:
    """Main pipeline orchestration"""
    
    def __init__(self):
        self.training_data_dir = PROJECT_ROOT / "training_data"
        self.models_dir = PROJECT_ROOT / "models"
        self.manifest_path = self.training_data_dir / "training_manifest.json"
        self.model_registry = ModelRegistry(self.models_dir)
    
    def discover_fonts(self) -> Dict:
        """Discover all fonts in training_data/"""
        fonts = {}
        if not self.training_data_dir.exists():
            return fonts
        
        for font_dir in self.training_data_dir.iterdir():
            if not font_dir.is_dir() or font_dir.name.startswith('.'):
                continue
            if font_dir.name in ['versions']:
                continue
            
            meta_file = font_dir / "meta.json"
            if meta_file.exists():
                with open(meta_file) as f:
                    meta = json.load(f)
                fonts[font_dir.name] = {
                    "path": str(font_dir),
                    "meta": meta
                }
        return fonts
    
    def print_status(self) -> None:
        """Print pipeline status"""
        fonts = self.discover_fonts()
        latest_model = self.model_registry.get_latest()
        latest_path = None
        if latest_model:
            latest_path = self.model_registry.get_model_path(latest_model)
        
        print("\n" + "="*80)
        print("UNIFIED PIPELINE STATUS")
        print("="*80)
        print(f"\n📦 FONTS COLLECTED: {len(fonts)}")
        if fonts:
            for name in sorted(fonts.keys()):
                print(f"   • {name}")
        
        print(f"\n🤖 MODELS: {len(self.model_registry.list_models())}")
        if latest_model:
            print(f"   Latest: v{latest_model}")
            print(f"   Path: {latest_path}")
            info = self.model_registry.get_model_info(latest_model)
            if info:
                print(f"   Created: {info.get('created_at', 'N/A')}")
                print(f"   Fonts used: {', '.join(info.get('fonts', []))}")
        else:
            print("   No models registered")
        
        print(f"\n📋 MANIFEST: {self.manifest_path}")
        print(f"   Status: {'✅ EXISTS' if self.manifest_path.exists() else '❌ MISSING'}")
        
        print("\n" + "="*80 + "\n")
    
    def prepare_manifest(self) -> None:
        """Generate training manifest for Colab"""
        fonts = self.discover_fonts()
        
        manifest = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "fonts": fonts,
            "total_fonts": len(fonts),
            "scripts": ["Latin", "Devanagari", "Arabic", "CJK"],
        }
        
        self.training_data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"\n✅ Manifest created: {self.manifest_path}")
        print(f"   Fonts: {len(fonts)}")
        print(f"   For Colab: train_unified_pipeline.ipynb")
        print()
    
    def register_trained_model(self, model_path: Path, version: str, metadata: Dict = None) -> None:
        """Register a newly trained model"""
        if metadata is None:
            metadata = {}
        
        fonts = self.discover_fonts()
        metadata["fonts"] = list(fonts.keys())
        
        self.model_registry.register_model(version, model_path, metadata)
        
        # Link to default location for backward compatibility
        default_path = self.models_dir / "font_vae_unified.pt"
        import shutil
        shutil.copy2(model_path, default_path)
        print(f"✅ Linked to: {default_path}")
    
    def list_models(self) -> None:
        """List all available models"""
        models = self.model_registry.list_models()
        
        print("\n" + "="*80)
        print("AVAILABLE MODELS")
        print("="*80)
        
        if not models:
            print("No models registered")
            print("="*80 + "\n")
            return
        
        for model in models:
            print(f"\n📦 v{model['version']}")
            print(f"   Created: {model['created_at']}")
            print(f"   Status: {model['status']}")
            print(f"   Fonts: {', '.join(model['fonts'])}")
            if model.get('performance'):
                print(f"   Perf: {model['performance']}")
        
        print("\n" + "="*80 + "\n")
    
    def get_model_info(self, version: str) -> None:
        """Print detailed model info"""
        info = self.model_registry.get_model_info(version)
        
        if not info:
            print(f"❌ Model v{version} not found")
            return
        
        print("\n" + "="*80)
        print(f"MODEL v{version} - DETAILS")
        print("="*80)
        print(json.dumps(info, indent=2))
        print("="*80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Unified Pipeline Manager")
    parser.add_argument('--status', action='store_true', help='Show pipeline status')
    parser.add_argument('--prepare', action='store_true', help='Generate training manifest')
    parser.add_argument('--list-models', action='store_true', help='List all models')
    parser.add_argument('--info', type=str, help='Model info (version)')
    parser.add_argument('--register-model', nargs=2, metavar=('PATH', 'VERSION'),
                        help='Register a trained model')
    
    args = parser.parse_args()
    
    manager = UnifiedPipelineManager()
    
    if args.prepare:
        manager.prepare_manifest()
    elif args.list_models:
        manager.list_models()
    elif args.info:
        manager.get_model_info(args.info)
    elif args.register_model:
        path, version = args.register_model
        manager.register_trained_model(Path(path), version)
    else:
        manager.print_status()


if __name__ == '__main__':
    main()
