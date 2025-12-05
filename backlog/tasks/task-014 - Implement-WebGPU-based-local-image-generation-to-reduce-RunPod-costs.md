---
id: task-014
title: Implement WebGPU-based local image generation to reduce RunPod costs
status: To Do
assignee: []
created_date: '2025-12-04 11:46'
updated_date: '2025-12-04 11:47'
labels:
  - performance
  - cost-optimization
  - webgpu
  - ai
  - image-generation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate WebGPU-powered browser-based image generation (SD-Turbo) to reduce RunPod API costs and eliminate cold start delays. This creates a hybrid pipeline where quick drafts/iterations run locally in the browser (FREE, ~1-3 seconds), while high-quality final renders still use RunPod SDXL.

**Problem:**
- Current image generation always hits RunPod (~$0.02/image + 10-30s cold starts)
- No instant feedback loop for creative iteration
- 100% of compute costs are cloud-based

**Solution:**
- Add WebGPU capability detection
- Integrate SD-Turbo for instant browser-based previews
- Smart routing: drafts → browser, final renders → RunPod
- Potential 70% reduction in RunPod image generation costs

**Cost Impact (projected):**
- 1,000 images/mo: $20 → $6 (save $14/mo)
- 5,000 images/mo: $100 → $30 (save $70/mo)
- 10,000 images/mo: $200 → $60 (save $140/mo)

**Browser Support:**
- Chrome/Edge: Full WebGPU (v113+)
- Firefox: Windows (July 2025)
- Safari: v26 beta
- Fallback: WASM backend for unsupported browsers
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebGPU capability detection added to clientConfig.ts
- [ ] #2 SD-Turbo model loads and runs in browser via WebGPU
- [ ] #3 ImageGenShapeUtil has Quick Preview vs High Quality toggle
- [ ] #4 Smart routing in aiOrchestrator routes drafts to browser
- [ ] #5 Fallback to WASM for browsers without WebGPU
- [ ] #6 User can generate preview images with zero cold start
- [ ] #7 RunPod only called for High Quality final renders
- [ ] #8 Model download progress indicator shown to user
- [ ] #9 Works offline after initial model download
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Foundation (Quick Wins)

### 1.1 WebGPU Capability Detection
**File:** `src/lib/clientConfig.ts`

```typescript
export async function detectWebGPUCapabilities(): Promise<{
  hasWebGPU: boolean
  hasF16: boolean
  adapterInfo?: GPUAdapterInfo
  estimatedVRAM?: number
}> {
  if (!navigator.gpu) {
    return { hasWebGPU: false, hasF16: false }
  }
  
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    return { hasWebGPU: false, hasF16: false }
  }
  
  const hasF16 = adapter.features.has('shader-f16')
  const adapterInfo = await adapter.requestAdapterInfo()
  
  return {
    hasWebGPU: true,
    hasF16,
    adapterInfo,
    estimatedVRAM: adapterInfo.memoryHeaps?.[0]?.size
  }
}
```

### 1.2 Install Dependencies
```bash
npm install @anthropic-ai/sdk onnxruntime-web
# Or for transformers.js v3:
npm install @huggingface/transformers
```

### 1.3 Vite Config Updates
**File:** `vite.config.ts`
- Ensure WASM/ONNX assets are properly bundled
- Add WebGPU shader compilation support
- Configure chunk splitting for ML models

---

## Phase 2: Browser Diffusion Integration

### 2.1 Create WebGPU Diffusion Module
**New File:** `src/lib/webgpuDiffusion.ts`

```typescript
import { pipeline } from '@huggingface/transformers'

let generator: any = null
let loadingPromise: Promise<void> | null = null

export async function initSDTurbo(
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  if (generator) return
  if (loadingPromise) return loadingPromise
  
  loadingPromise = (async () => {
    onProgress?.(0, 'Loading SD-Turbo model...')
    
    generator = await pipeline(
      'text-to-image',
      'Xenova/sdxl-turbo', // or 'stabilityai/sd-turbo'
      {
        device: 'webgpu',
        dtype: 'fp16',
        progress_callback: (p) => onProgress?.(p.progress, p.status)
      }
    )
    
    onProgress?.(100, 'Ready')
  })()
  
  return loadingPromise
}

export async function generateLocalImage(
  prompt: string,
  options?: {
    width?: number
    height?: number
    steps?: number
    seed?: number
  }
): Promise<string> {
  if (!generator) {
    throw new Error('SD-Turbo not initialized. Call initSDTurbo() first.')
  }
  
  const result = await generator(prompt, {
    width: options?.width || 512,
    height: options?.height || 512,
    num_inference_steps: options?.steps || 1, // SD-Turbo = 1 step
    seed: options?.seed
  })
  
  // Returns base64 data URL
  return result[0].image
}

export function isSDTurboReady(): boolean {
  return generator !== null
}

export async function unloadSDTurbo(): Promise<void> {
  generator = null
  loadingPromise = null
  // Force garbage collection of GPU memory
}
```

### 2.2 Create Model Download Manager
**New File:** `src/lib/modelDownloadManager.ts`

Handle progressive model downloads with:
- IndexedDB caching for persistence
- Progress tracking UI
- Resume capability for interrupted downloads
- Storage quota management

---

## Phase 3: UI Integration

### 3.1 Update ImageGenShapeUtil
**File:** `src/shapes/ImageGenShapeUtil.tsx`

Add to shape props:
```typescript
type IImageGen = TLBaseShape<"ImageGen", {
  // ... existing props
  generationMode: 'auto' | 'local' | 'cloud'  // NEW
  localModelStatus: 'not-loaded' | 'loading' | 'ready' | 'error'  // NEW
  localModelProgress: number  // NEW (0-100)
}>
```

Add UI toggle:
```tsx
<div className="generation-mode-toggle">
  <button 
    onClick={() => setMode('local')}
    disabled={!hasWebGPU}
    title={!hasWebGPU ? 'WebGPU not supported' : 'Fast preview (~1-3s)'}
  >
    ⚡ Quick Preview
  </button>
  <button 
    onClick={() => setMode('cloud')}
    title="High quality SDXL (~10-30s)"
  >
    ✨ High Quality
  </button>
</div>
```

### 3.2 Smart Generation Logic
```typescript
const generateImage = async (prompt: string) => {
  const mode = shape.props.generationMode
  const capabilities = await detectWebGPUCapabilities()
  
  // Auto mode: local for iterations, cloud for final
  if (mode === 'auto' || mode === 'local') {
    if (capabilities.hasWebGPU && isSDTurboReady()) {
      // Generate locally - instant!
      const imageUrl = await generateLocalImage(prompt)
      updateShape({ imageUrl, source: 'local' })
      return
    }
  }
  
  // Fall back to RunPod
  await generateWithRunPod(prompt)
}
```

---

## Phase 4: AI Orchestrator Integration

### 4.1 Update aiOrchestrator.ts
**File:** `src/lib/aiOrchestrator.ts`

Add browser as compute target:
```typescript
type ComputeTarget = 'browser' | 'netcup' | 'runpod'

interface ImageGenerationOptions {
  prompt: string
  priority: 'draft' | 'final'
  preferLocal?: boolean
}

async function generateImage(options: ImageGenerationOptions) {
  const { hasWebGPU } = await detectWebGPUCapabilities()
  
  // Routing logic
  if (options.priority === 'draft' && hasWebGPU && isSDTurboReady()) {
    return { target: 'browser', cost: 0 }
  }
  
  if (options.priority === 'final') {
    return { target: 'runpod', cost: 0.02 }
  }
  
  // Fallback chain
  return { target: 'runpod', cost: 0.02 }
}
```

---

## Phase 5: Advanced Features (Future)

### 5.1 Real-time img2img Refinement
- Start with browser SD-Turbo draft
- User adjusts/annotates
- Send to RunPod SDXL for final with img2img

### 5.2 Browser-based Upscaling
- Add Real-ESRGAN-lite via ONNX Runtime
- 2x/4x upscale locally before cloud render

### 5.3 Background Removal
- U2Net in browser via transformers.js
- Zero-cost background removal

### 5.4 Style Transfer
- Fast neural style transfer via WebGPU shaders
- Real-time preview on canvas

---

## Technical Considerations

### Model Sizes
| Model | Size | Load Time | Generation |
|-------|------|-----------|------------|
| SD-Turbo | ~2GB | 30-60s (first) | 1-3s |
| SD-Turbo (quantized) | ~1GB | 15-30s | 2-4s |

### Memory Management
- Unload model when tab backgrounded
- Clear GPU memory on low-memory warnings
- IndexedDB for model caching (survives refresh)

### Error Handling
- Graceful degradation to WASM if WebGPU fails
- Clear error messages for unsupported browsers
- Automatic fallback to RunPod on local failure

---

## Files to Create/Modify

**New Files:**
- `src/lib/webgpuDiffusion.ts` - SD-Turbo wrapper
- `src/lib/modelDownloadManager.ts` - Model caching
- `src/lib/webgpuCapabilities.ts` - Detection utilities
- `src/components/ModelDownloadProgress.tsx` - UI component

**Modified Files:**
- `src/lib/clientConfig.ts` - Add WebGPU detection
- `src/lib/aiOrchestrator.ts` - Add browser routing
- `src/shapes/ImageGenShapeUtil.tsx` - Add mode toggle
- `vite.config.ts` - ONNX/WASM config
- `package.json` - New dependencies

---

## Testing Checklist

- [ ] WebGPU detection works on Chrome, Edge, Firefox
- [ ] WASM fallback works on Safari/older browsers
- [ ] Model downloads and caches correctly
- [ ] Generation completes in <5s on modern GPU
- [ ] Memory cleaned up properly on unload
- [ ] Offline generation works after model cached
- [ ] RunPod fallback triggers correctly
- [ ] Cost tracking reflects local vs cloud usage
<!-- SECTION:PLAN:END -->
