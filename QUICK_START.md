# Quick Start Guide - AI Services Setup

**Get your AI orchestration running in under 30 minutes!**

---

## 🎯 Goal

Deploy a smart AI orchestration layer that saves you $768-1,824/year by routing 70-80% of workload to your Netcup RS 8000 (FREE) and only using RunPod GPU when needed.

---

## ⚡ 30-Minute Quick Start

### Step 1: Verify Access (2 min)

```bash
# Test SSH to Netcup RS 8000
ssh netcup "hostname && docker --version"

# Expected output:
# vXXXXXX.netcup.net
# Docker version 24.0.x
```

✅ **Success?** Continue to Step 2
❌ **Failed?** Setup SSH key or contact Netcup support

### Step 2: Deploy AI Orchestrator (10 min)

```bash
# Create directory structure
ssh netcup << 'EOF'
mkdir -p /opt/ai-orchestrator/{services/{router,workers,monitor},configs,data}
cd /opt/ai-orchestrator
EOF

# Deploy minimal stack (text generation only for quick start)
ssh netcup "cat > /opt/ai-orchestrator/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["./data/redis:/data"]
    command: redis-server --appendonly yes

  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    volumes: ["/data/models/ollama:/root/.ollama"]
EOF

# Start services
ssh netcup "cd /opt/ai-orchestrator && docker-compose up -d"

# Verify
ssh netcup "docker ps"
```

### Step 3: Download AI Model (5 min)

```bash
# Pull Llama 3 8B (smaller, faster for testing)
ssh netcup "docker exec ollama ollama pull llama3:8b"

# Test it
ssh netcup "docker exec ollama ollama run llama3:8b 'Hello, world!'"
```

Expected output: A friendly AI response!

### Step 4: Test from Your Machine (3 min)

```bash
# Get Netcup IP
NETCUP_IP="159.195.32.209"

# Test Ollama directly
curl -X POST http://$NETCUP_IP:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3:8b",
    "prompt": "Write hello world in Python",
    "stream": false
  }'
```

Expected: Python code response!

### Step 5: Configure canvas-website (5 min)

```bash
cd /home/jeffe/Github/canvas-website-branch-worktrees/add-runpod-AI-API

# Create minimal .env.local
cat > .env.local << 'EOF'
# Ollama direct access (for quick testing)
VITE_OLLAMA_URL=http://159.195.32.209:11434

# Your existing vars...
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_TLDRAW_WORKER_URL=your_worker_url
EOF

# Install and start
npm install
npm run dev
```

### Step 6: Test in Browser (5 min)

1. Open http://localhost:5173 (or your dev port)
2. Create a Prompt shape or use LLM command
3. Type: "Write a hello world program"
4. Submit
5. Verify: Response appears using your local Ollama!

**🎉 Success!** You're now running AI locally for FREE!

---

## 🚀 Next: Full Setup (Optional)

Once quick start works, deploy the full stack:

### Option A: Full AI Orchestrator (1 hour)

Follow: `AI_SERVICES_DEPLOYMENT_GUIDE.md` Phase 2-3

Adds:
- Smart routing layer
- Image generation (local SD + RunPod)
- Video generation (RunPod Wan2.1)
- Cost tracking
- Monitoring dashboards

### Option B: Just Add Image Generation (30 min)

```bash
# Add Stable Diffusion CPU to docker-compose.yml
ssh netcup "cat >> /opt/ai-orchestrator/docker-compose.yml" << 'EOF'

  stable-diffusion:
    image: ghcr.io/stablecog/sc-worker:latest
    ports: ["7860:7860"]
    volumes: ["/data/models/stable-diffusion:/models"]
    environment:
      USE_CPU: "true"
EOF

ssh netcup "cd /opt/ai-orchestrator && docker-compose up -d"
```

### Option C: Full Migration (4-5 weeks)

Follow: `NETCUP_MIGRATION_PLAN.md` for complete DigitalOcean → Netcup migration

---

## 🐛 Quick Troubleshooting

### "Connection refused to 159.195.32.209:11434"

```bash
# Check if firewall blocking
ssh netcup "sudo ufw status"
ssh netcup "sudo ufw allow 11434/tcp"
ssh netcup "sudo ufw allow 8000/tcp"  # For AI orchestrator later
```

### "docker: command not found"

```bash
# Install Docker
ssh netcup << 'EOF'
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
EOF

# Reconnect and retry
ssh netcup "docker --version"
```

### "Ollama model not found"

```bash
# List installed models
ssh netcup "docker exec ollama ollama list"

# If empty, pull model
ssh netcup "docker exec ollama ollama pull llama3:8b"
```

### "AI response very slow (>30s)"

```bash
# Check if downloading model for first time
ssh netcup "docker exec ollama ollama list"

# Use smaller model for testing
ssh netcup "docker exec ollama ollama pull mistral:7b"
```

---

## 💡 Quick Tips

1. **Start with 8B model**: Faster responses, good for testing
2. **Use localhost for dev**: Point directly to Ollama URL
3. **Deploy orchestrator later**: Once basic setup works
4. **Monitor resources**: `ssh netcup htop` to check CPU/RAM
5. **Test locally first**: Verify before adding RunPod costs

---

## 📋 Checklist

- [ ] SSH access to Netcup works
- [ ] Docker installed and running
- [ ] Redis and Ollama containers running
- [ ] Llama3 model downloaded
- [ ] Test curl request works
- [ ] canvas-website .env.local configured
- [ ] Browser test successful

**All checked?** You're ready! 🎉

---

## 🎯 Next Steps

Choose your path:

**Path 1: Keep it Simple**
- Use Ollama directly for text generation
- Add user API keys in canvas settings for images
- Deploy full orchestrator later

**Path 2: Deploy Full Stack**
- Follow `AI_SERVICES_DEPLOYMENT_GUIDE.md`
- Setup image + video generation
- Enable cost tracking and monitoring

**Path 3: Full Migration**
- Follow `NETCUP_MIGRATION_PLAN.md`
- Migrate all services from DigitalOcean
- Setup production infrastructure

---

## 📚 Reference Docs

- **This Guide**: Quick 30-min setup
- **AI_SERVICES_SUMMARY.md**: Complete feature overview
- **AI_SERVICES_DEPLOYMENT_GUIDE.md**: Full deployment (all services)
- **NETCUP_MIGRATION_PLAN.md**: Complete migration plan (8 phases)
- **RUNPOD_SETUP.md**: RunPod WhisperX setup
- **TEST_RUNPOD_AI.md**: Testing guide

---

**Questions?** Check `AI_SERVICES_SUMMARY.md` or deployment guide!

**Ready for full setup?** Continue to `AI_SERVICES_DEPLOYMENT_GUIDE.md`! 🚀
