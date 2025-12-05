#!/bin/bash
# Script to set up the RunPod network volume with Wan2.2 models
# Run this once on a GPU pod with the network volume attached

echo "=== Setting up RunPod Network Volume for Wan2.2 ==="

# Create directory structure
echo "Creating directory structure..."
mkdir -p /runpod-volume/models/diffusion_models
mkdir -p /runpod-volume/models/vae
mkdir -p /runpod-volume/models/text_encoders
mkdir -p /runpod-volume/models/clip_vision
mkdir -p /runpod-volume/loras

# Check current disk usage
echo "Current network volume usage:"
df -h /runpod-volume

# List what's already on the volume
echo ""
echo "Current contents of /runpod-volume:"
ls -la /runpod-volume/

echo ""
echo "Current contents of /runpod-volume/models/ (if exists):"
ls -la /runpod-volume/models/ 2>/dev/null || echo "(empty or doesn't exist)"

# Check if models exist in the Docker image
echo ""
echo "Models in Docker image /ComfyUI/models/diffusion_models/:"
ls -la /ComfyUI/models/diffusion_models/ 2>/dev/null || echo "(not found)"

echo ""
echo "Models in Docker image /ComfyUI/models/vae/:"
ls -la /ComfyUI/models/vae/ 2>/dev/null || echo "(not found)"

echo ""
echo "Models in Docker image /ComfyUI/models/text_encoders/:"
ls -la /ComfyUI/models/text_encoders/ 2>/dev/null || echo "(not found)"

echo ""
echo "Models in Docker image /ComfyUI/models/clip_vision/:"
ls -la /ComfyUI/models/clip_vision/ 2>/dev/null || echo "(not found)"

echo ""
echo "Models in Docker image /ComfyUI/models/loras/:"
ls -la /ComfyUI/models/loras/ 2>/dev/null || echo "(not found)"

# Copy models to network volume (if not already there)
echo ""
echo "=== Copying models to network volume ==="

# Diffusion models
if [ -d "/ComfyUI/models/diffusion_models" ]; then
    echo "Copying diffusion models..."
    cp -vn /ComfyUI/models/diffusion_models/*.safetensors /runpod-volume/models/diffusion_models/ 2>/dev/null || true
fi

# VAE models
if [ -d "/ComfyUI/models/vae" ]; then
    echo "Copying VAE models..."
    cp -vn /ComfyUI/models/vae/*.safetensors /runpod-volume/models/vae/ 2>/dev/null || true
fi

# Text encoders
if [ -d "/ComfyUI/models/text_encoders" ]; then
    echo "Copying text encoder models..."
    cp -vn /ComfyUI/models/text_encoders/*.safetensors /runpod-volume/models/text_encoders/ 2>/dev/null || true
fi

# CLIP vision
if [ -d "/ComfyUI/models/clip_vision" ]; then
    echo "Copying CLIP vision models..."
    cp -vn /ComfyUI/models/clip_vision/*.safetensors /runpod-volume/models/clip_vision/ 2>/dev/null || true
fi

# LoRAs
if [ -d "/ComfyUI/models/loras" ]; then
    echo "Copying LoRA models..."
    cp -vn /ComfyUI/models/loras/*.safetensors /runpod-volume/loras/ 2>/dev/null || true
fi

# Copy extra_model_paths.yaml to volume
echo ""
echo "Copying extra_model_paths.yaml to network volume..."
cat > /runpod-volume/extra_model_paths.yaml << 'EOF'
# ComfyUI Model Paths Configuration - Network Volume Priority
comfyui:
    base_path: /ComfyUI/
    is_default: true
    checkpoints: |
        /runpod-volume/models/checkpoints/
        models/checkpoints/
    clip: |
        /runpod-volume/models/clip/
        models/clip/
    clip_vision: |
        /runpod-volume/models/clip_vision/
        models/clip_vision/
    configs: models/configs/
    controlnet: |
        /runpod-volume/models/controlnet/
        models/controlnet/
    diffusion_models: |
        /runpod-volume/models/diffusion_models/
        /runpod-volume/models/
        models/diffusion_models/
        models/unet/
    embeddings: |
        /runpod-volume/models/embeddings/
        models/embeddings/
    loras: |
        /runpod-volume/loras/
        /runpod-volume/models/loras/
        models/loras/
    text_encoders: |
        /runpod-volume/models/text_encoders/
        models/text_encoders/
    upscale_models: |
        /runpod-volume/models/upscale_models/
        models/upscale_models/
    vae: |
        /runpod-volume/models/vae/
        models/vae/
EOF

echo ""
echo "=== Final network volume contents ==="
echo ""
echo "/runpod-volume/models/:"
du -sh /runpod-volume/models/*/ 2>/dev/null || echo "(empty)"
echo ""
echo "/runpod-volume/loras/:"
ls -la /runpod-volume/loras/ 2>/dev/null || echo "(empty)"

echo ""
echo "Total network volume usage:"
du -sh /runpod-volume/

echo ""
echo "=== Setup complete! ==="
echo "Models have been copied to the network volume."
echo "On subsequent cold starts, models will load from /runpod-volume/ (faster)."
