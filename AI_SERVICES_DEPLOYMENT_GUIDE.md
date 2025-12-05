# AI Services Deployment & Testing Guide

Complete guide for deploying and testing the AI services integration in canvas-website with Netcup RS 8000 and RunPod.

---

## 🎯 Overview

This project integrates multiple AI services with smart routing:

**Smart Routing Strategy:**
- **Text/Code (70-80% workload)**: Local Ollama on RS 8000 → **FREE**
- **Images - Low Priority**: Local Stable Diffusion on RS 8000 → **FREE** (slow ~60s)
- **Images - High Priority**: RunPod GPU (SDXL) → **$0.02/image** (fast ~5s)
- **Video Generation**: RunPod GPU (Wan2.1) → **$0.50/video** (30-90s)

**Expected Cost Savings:** $86-350/month compared to persistent GPU instances

---

## 📦 What's Included

### AI Services:
1. ✅ **Text Generation (LLM)**
   - RunPod integration via `src/lib/runpodApi.ts`
   - Enhanced LLM utilities in `src/utils/llmUtils.ts`
   - AI Orchestrator client in `src/lib/aiOrchestrator.ts`
   - Prompt shapes, arrow LLM actions, command palette

2. ✅ **Image Generation**
   - ImageGenShapeUtil in `src/shapes/ImageGenShapeUtil.tsx`
   - ImageGenTool in `src/tools/ImageGenTool.ts`
   - Mock mode **DISABLED** (ready for production)
   - Smart routing: low priority → local CPU, high priority → RunPod GPU

3. ✅ **Video Generation (NEW!)**
   - VideoGenShapeUtil in `src/shapes/VideoGenShapeUtil.tsx`
   - VideoGenTool in `src/tools/VideoGenTool.ts`
   - Wan2.1 I2V 14B 720p model on RunPod
   - Always uses GPU (no local option)

4. ✅ **Voice Transcription**
   - WhisperX integration via `src/hooks/useWhisperTranscriptionSimple.ts`
   - Automatic fallback to local Whisper model

---

## 🚀 Deployment Steps

### Step 1: Deploy AI Orchestrator on Netcup RS 8000

**Prerequisites:**
- SSH access to Netcup RS 8000: `ssh netcup`
- Docker and Docker Compose installed
- RunPod API key

**1.1 Create AI Orchestrator Directory:**

```bash
ssh netcup << 'EOF'
mkdir -p /opt/ai-orchestrator/{services/{router,workers,monitor},configs,data/{redis,postgres,prometheus}}
cd /opt/ai-orchestrator
EOF
```

**1.2 Copy Configuration Files:**

From your local machine, copy the AI orchestrator files created in `NETCUP_MIGRATION_PLAN.md`:

```bash
# Copy docker-compose.yml
scp /path/to/docker-compose.yml netcup:/opt/ai-orchestrator/

# Copy service files
scp -r /path/to/services/* netcup:/opt/ai-orchestrator/services/
```

**1.3 Configure Environment Variables:**

```bash
ssh netcup "cat > /opt/ai-orchestrator/.env" << 'EOF'
# PostgreSQL
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# RunPod API Keys
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_TEXT_ENDPOINT_ID=your_text_endpoint_id
RUNPOD_IMAGE_ENDPOINT_ID=your_image_endpoint_id
RUNPOD_VIDEO_ENDPOINT_ID=your_video_endpoint_id

# Grafana
GRAFANA_PASSWORD=$(openssl rand -hex 16)

# Monitoring
ALERT_EMAIL=your@email.com
COST_ALERT_THRESHOLD=100
EOF
```

**1.4 Deploy the Stack:**

```bash
ssh netcup << 'EOF'
cd /opt/ai-orchestrator

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f router
EOF
```

**1.5 Verify Deployment:**

```bash
# Check health endpoint
ssh netcup "curl http://localhost:8000/health"

# Check API documentation
ssh netcup "curl http://localhost:8000/docs"

# Check queue status
ssh netcup "curl http://localhost:8000/queue/status"
```

### Step 2: Setup Local AI Models on RS 8000

**2.1 Download Ollama Models:**

```bash
ssh netcup << 'EOF'
# Download recommended models
docker exec ai-ollama ollama pull llama3:70b
docker exec ai-ollama ollama pull codellama:34b
docker exec ai-ollama ollama pull deepseek-coder:33b
docker exec ai-ollama ollama pull mistral:7b

# Verify
docker exec ai-ollama ollama list

# Test a model
docker exec ai-ollama ollama run llama3:70b "Hello, how are you?"
EOF
```

**2.2 Download Stable Diffusion Models:**

```bash
ssh netcup << 'EOF'
mkdir -p /data/models/stable-diffusion/sd-v2.1
cd /data/models/stable-diffusion/sd-v2.1

# Download SD 2.1 weights
wget https://huggingface.co/stabilityai/stable-diffusion-2-1/resolve/main/v2-1_768-ema-pruned.safetensors

# Verify
ls -lh v2-1_768-ema-pruned.safetensors
EOF
```

**2.3 Download Wan2.1 Video Generation Model:**

```bash
ssh netcup << 'EOF'
# Install huggingface-cli
pip install huggingface-hub

# Download Wan2.1 I2V 14B 720p
mkdir -p /data/models/video-generation
cd /data/models/video-generation

huggingface-cli download Wan-AI/Wan2.1-I2V-14B-720P \
  --include "*.safetensors" \
  --local-dir wan2.1_i2v_14b

# Check size (~28GB)
du -sh wan2.1_i2v_14b
EOF
```

**Note:** The Wan2.1 model will be deployed to RunPod, not run locally on CPU.

### Step 3: Setup RunPod Endpoints

**3.1 Create RunPod Serverless Endpoints:**

Go to [RunPod Serverless](https://www.runpod.io/console/serverless) and create endpoints for:

1. **Text Generation Endpoint** (optional, fallback)
   - Model: Any LLM (Llama, Mistral, etc.)
   - GPU: Optional (we use local CPU primarily)

2. **Image Generation Endpoint**
   - Model: SDXL or SD3
   - GPU: A4000/A5000 (good price/performance)
   - Expected cost: ~$0.02/image

3. **Video Generation Endpoint**
   - Model: Wan2.1-I2V-14B-720P
   - GPU: A100 or H100 (required for video)
   - Expected cost: ~$0.50/video

**3.2 Get Endpoint IDs:**

For each endpoint, copy the endpoint ID from the URL or endpoint details.

Example: If URL is `https://api.runpod.ai/v2/jqd16o7stu29vq/run`, then `jqd16o7stu29vq` is your endpoint ID.

**3.3 Update Environment Variables:**

Update `/opt/ai-orchestrator/.env` with your endpoint IDs:

```bash
ssh netcup "nano /opt/ai-orchestrator/.env"

# Add your endpoint IDs:
RUNPOD_TEXT_ENDPOINT_ID=your_text_endpoint_id
RUNPOD_IMAGE_ENDPOINT_ID=your_image_endpoint_id
RUNPOD_VIDEO_ENDPOINT_ID=your_video_endpoint_id

# Restart services
cd /opt/ai-orchestrator && docker-compose restart
```

### Step 4: Configure canvas-website

**4.1 Create .env.local:**

In your canvas-website directory:

```bash
cd /home/jeffe/Github/canvas-website-branch-worktrees/add-runpod-AI-API

cat > .env.local << 'EOF'
# AI Orchestrator (Primary - Netcup RS 8000)
VITE_AI_ORCHESTRATOR_URL=http://159.195.32.209:8000
# Or use domain when DNS is configured:
# VITE_AI_ORCHESTRATOR_URL=https://ai-api.jeffemmett.com

# RunPod API (Fallback/Direct Access)
VITE_RUNPOD_API_KEY=your_runpod_api_key_here
VITE_RUNPOD_TEXT_ENDPOINT_ID=your_text_endpoint_id
VITE_RUNPOD_IMAGE_ENDPOINT_ID=your_image_endpoint_id
VITE_RUNPOD_VIDEO_ENDPOINT_ID=your_video_endpoint_id

# Other existing vars...
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_DAILY_DOMAIN=your_daily_domain
VITE_TLDRAW_WORKER_URL=your_worker_url
EOF
```

**4.2 Install Dependencies:**

```bash
npm install
```

**4.3 Build and Start:**

```bash
# Development
npm run dev

# Production build
npm run build
npm run start
```

### Step 5: Register Video Generation Tool

You need to register the VideoGen shape and tool with tldraw. Find where shapes and tools are registered (likely in `src/routes/Board.tsx` or similar):

**Add to shape utilities array:**
```typescript
import { VideoGenShapeUtil } from '@/shapes/VideoGenShapeUtil'

const shapeUtils = [
  // ... existing shapes
  VideoGenShapeUtil,
]
```

**Add to tools array:**
```typescript
import { VideoGenTool } from '@/tools/VideoGenTool'

const tools = [
  // ... existing tools
  VideoGenTool,
]
```

---

## 🧪 Testing

### Test 1: Verify AI Orchestrator

```bash
# Test health endpoint
curl http://159.195.32.209:8000/health

# Expected response:
# {"status":"healthy","timestamp":"2025-11-25T12:00:00.000Z"}

# Test text generation
curl -X POST http://159.195.32.209:8000/generate/text \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a hello world program in Python",
    "priority": "normal"
  }'

# Expected response:
# {"job_id":"abc123","status":"queued","message":"Job queued on local provider"}

# Check job status
curl http://159.195.32.209:8000/job/abc123

# Check queue status
curl http://159.195.32.209:8000/queue/status

# Check costs
curl http://159.195.32.209:8000/costs/summary
```

### Test 2: Test Text Generation in Canvas

1. Open canvas-website in browser
2. Open browser console (F12)
3. Look for log messages:
   - `✅ AI Orchestrator is available at http://159.195.32.209:8000`
4. Create a Prompt shape or use arrow LLM action
5. Enter a prompt and submit
6. Verify response appears
7. Check console for routing info:
   - Should see `Using local Ollama (FREE)`

### Test 3: Test Image Generation

**Low Priority (Local CPU - FREE):**

1. Use ImageGen tool from toolbar
2. Click on canvas to create ImageGen shape
3. Enter prompt: "A beautiful mountain landscape"
4. Select priority: "Low"
5. Click "Generate"
6. Wait 30-60 seconds
7. Verify image appears
8. Check console: Should show `Using local Stable Diffusion CPU`

**High Priority (RunPod GPU - $0.02):**

1. Create new ImageGen shape
2. Enter prompt: "A futuristic city at sunset"
3. Select priority: "High"
4. Click "Generate"
5. Wait 5-10 seconds
6. Verify image appears
7. Check console: Should show `Using RunPod SDXL`
8. Check cost: Should show `~$0.02`

### Test 4: Test Video Generation

1. Use VideoGen tool from toolbar
2. Click on canvas to create VideoGen shape
3. Enter prompt: "A cat walking through a garden"
4. Set duration: 3 seconds
5. Click "Generate"
6. Wait 30-90 seconds
7. Verify video appears and plays
8. Check console: Should show `Using RunPod Wan2.1`
9. Check cost: Should show `~$0.50`
10. Test download button

### Test 5: Test Voice Transcription

1. Use Transcription tool from toolbar
2. Click to create Transcription shape
3. Click "Start Recording"
4. Speak into microphone
5. Click "Stop Recording"
6. Verify transcription appears
7. Check if using RunPod or local Whisper

### Test 6: Monitor Costs and Performance

**Access monitoring dashboards:**

```bash
# API Documentation
http://159.195.32.209:8000/docs

# Queue Status
http://159.195.32.209:8000/queue/status

# Cost Tracking
http://159.195.32.209:3000/api/costs/summary

# Grafana Dashboard
http://159.195.32.209:3001
# Default login: admin / admin (change this!)
```

**Check daily costs:**

```bash
curl http://159.195.32.209:3000/api/costs/summary
```

Expected response:
```json
{
  "today": {
    "local": 0.00,
    "runpod": 2.45,
    "total": 2.45
  },
  "this_month": {
    "local": 0.00,
    "runpod": 45.20,
    "total": 45.20
  },
  "breakdown": {
    "text": 0.00,
    "image": 12.50,
    "video": 32.70,
    "code": 0.00
  }
}
```

---

## 🐛 Troubleshooting

### Issue: AI Orchestrator not available

**Symptoms:**
- Console shows: `⚠️ AI Orchestrator configured but not responding`
- Health check fails

**Solutions:**
```bash
# 1. Check if services are running
ssh netcup "cd /opt/ai-orchestrator && docker-compose ps"

# 2. Check logs
ssh netcup "cd /opt/ai-orchestrator && docker-compose logs -f router"

# 3. Restart services
ssh netcup "cd /opt/ai-orchestrator && docker-compose restart"

# 4. Check firewall
ssh netcup "sudo ufw status"
ssh netcup "sudo ufw allow 8000/tcp"
```

### Issue: Image generation fails with "No output found"

**Symptoms:**
- Job completes but no image URL returned
- Error: `Job completed but no output data found`

**Solutions:**
1. Check RunPod endpoint configuration
2. Verify endpoint handler returns correct format:
   ```json
   {"output": {"image": "base64_or_url"}}
   ```
3. Check endpoint logs in RunPod console
4. Test endpoint directly with curl

### Issue: Video generation timeout

**Symptoms:**
- Job stuck in "processing" state
- Timeout after 120 attempts

**Solutions:**
1. Video generation takes 30-90 seconds, ensure patience
2. Check RunPod GPU availability (might be cold start)
3. Increase timeout in VideoGenShapeUtil if needed
4. Check RunPod endpoint logs for errors

### Issue: High costs

**Symptoms:**
- Monthly costs exceed budget
- Too many RunPod requests

**Solutions:**
```bash
# 1. Check cost breakdown
curl http://159.195.32.209:3000/api/costs/summary

# 2. Review routing decisions
curl http://159.195.32.209:8000/queue/status

# 3. Adjust routing thresholds
# Edit router configuration to prefer local more
ssh netcup "nano /opt/ai-orchestrator/services/router/main.py"

# 4. Set cost alerts
ssh netcup "nano /opt/ai-orchestrator/.env"
# COST_ALERT_THRESHOLD=50  # Alert if daily cost > $50
```

### Issue: Local models slow or failing

**Symptoms:**
- Text generation slow (>30s)
- Image generation very slow (>2min)
- Out of memory errors

**Solutions:**
```bash
# 1. Check system resources
ssh netcup "htop"
ssh netcup "free -h"

# 2. Reduce model size
ssh netcup << 'EOF'
# Use smaller models
docker exec ai-ollama ollama pull llama3:8b  # Instead of 70b
docker exec ai-ollama ollama pull mistral:7b  # Lighter model
EOF

# 3. Limit concurrent workers
ssh netcup "nano /opt/ai-orchestrator/docker-compose.yml"
# Reduce worker replicas if needed

# 4. Increase swap (if low RAM)
ssh netcup "sudo fallocate -l 8G /swapfile"
ssh netcup "sudo chmod 600 /swapfile"
ssh netcup "sudo mkswap /swapfile"
ssh netcup "sudo swapon /swapfile"
```

---

## 📊 Performance Expectations

### Text Generation:
- **Local (Llama3-70b)**: 2-10 seconds
- **Local (Mistral-7b)**: 1-3 seconds
- **RunPod (fallback)**: 3-8 seconds
- **Cost**: $0.00 (local) or $0.001-0.01 (RunPod)

### Image Generation:
- **Local SD CPU (low priority)**: 30-60 seconds
- **RunPod GPU (high priority)**: 3-10 seconds
- **Cost**: $0.00 (local) or $0.02 (RunPod)

### Video Generation:
- **RunPod Wan2.1**: 30-90 seconds
- **Cost**: ~$0.50 per video

### Expected Monthly Costs:

**Light Usage (100 requests/day):**
- 70 text (local): $0
- 20 images (15 local + 5 RunPod): $0.10
- 10 videos: $5.00
- **Total: ~$5-10/month**

**Medium Usage (500 requests/day):**
- 350 text (local): $0
- 100 images (60 local + 40 RunPod): $0.80
- 50 videos: $25.00
- **Total: ~$25-35/month**

**Heavy Usage (2000 requests/day):**
- 1400 text (local): $0
- 400 images (200 local + 200 RunPod): $4.00
- 200 videos: $100.00
- **Total: ~$100-120/month**

Compare to persistent GPU pod: $200-300/month regardless of usage!

---

## 🎯 Next Steps

1. ✅ Deploy AI Orchestrator on Netcup RS 8000
2. ✅ Setup local AI models (Ollama, SD)
3. ✅ Configure RunPod endpoints
4. ✅ Test all AI services
5. 📋 Setup monitoring and alerts
6. 📋 Configure DNS for ai-api.jeffemmett.com
7. 📋 Setup SSL with Let's Encrypt
8. 📋 Migrate canvas-website to Netcup
9. 📋 Monitor costs and optimize routing
10. 📋 Decommission DigitalOcean droplets

---

## 📚 Additional Resources

- **Migration Plan**: See `NETCUP_MIGRATION_PLAN.md`
- **RunPod Setup**: See `RUNPOD_SETUP.md`
- **Test Guide**: See `TEST_RUNPOD_AI.md`
- **API Documentation**: http://159.195.32.209:8000/docs
- **Monitoring**: http://159.195.32.209:3001 (Grafana)

---

## 💡 Tips for Cost Optimization

1. **Prefer low priority for batch jobs**: Use `priority: "low"` for non-urgent tasks
2. **Use local models first**: 70-80% of workload can run locally for $0
3. **Monitor queue depth**: Auto-scales to RunPod when local is backed up
4. **Set cost alerts**: Get notified if daily costs exceed threshold
5. **Review cost breakdown weekly**: Identify optimization opportunities
6. **Batch similar requests**: Process multiple items together
7. **Cache results**: Store and reuse common queries

---

**Ready to deploy?** Start with Step 1 and follow the guide! 🚀
