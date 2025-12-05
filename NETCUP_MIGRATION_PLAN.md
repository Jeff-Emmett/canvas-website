# Netcup RS 8000 Migration & AI Orchestration Setup Plan

## 🎯 Overview

Complete migration plan from DigitalOcean droplets to Netcup RS 8000 G12 Pro with smart AI orchestration layer that routes between local CPU (RS 8000) and serverless GPU (RunPod).

**Server Specs:**
- 20 cores, 64GB RAM, 3TB storage
- IP: 159.195.32.209
- Location: Germany (EU)
- SSH: `ssh netcup`

**Expected Savings:** $86-350/month ($1,032-4,200/year)

---

## 📋 Phase 1: Pre-Migration Preparation

### 1.1 Inventory Current Services

**DigitalOcean Main Droplet (143.198.39.165):**
```bash
# Document all running services
ssh droplet "docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'"
ssh droplet "pm2 list"
ssh droplet "systemctl list-units --type=service --state=running"

# Backup configurations
ssh droplet "tar -czf ~/configs-backup.tar.gz /etc/nginx /etc/systemd/system ~/.config"
scp droplet:~/configs-backup.tar.gz ~/backups/droplet-configs-$(date +%Y%m%d).tar.gz
```

**DigitalOcean AI Services Droplet (178.128.238.87):**
```bash
# Document AI services
ssh ai-droplet "docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'"
ssh ai-droplet "nvidia-smi" # Check GPU usage
ssh ai-droplet "df -h" # Check disk usage for models

# Backup AI model weights and configs
ssh ai-droplet "tar -czf ~/ai-models-backup.tar.gz ~/models ~/.cache/huggingface"
scp ai-droplet:~/ai-models-backup.tar.gz ~/backups/ai-models-$(date +%Y%m%d).tar.gz
```

**Create Service Inventory Document:**
```bash
cat > ~/migration-inventory.md << 'EOF'
# Service Inventory

## Main Droplet (143.198.39.165)
- [ ] nginx reverse proxy
- [ ] canvas-website
- [ ] Other web apps: ________________
- [ ] Databases: ________________
- [ ] Monitoring: ________________

## AI Droplet (178.128.238.87)
- [ ] Stable Diffusion
- [ ] Ollama/LLM services
- [ ] Model storage location: ________________
- [ ] Current GPU usage: ________________

## Data to Migrate
- [ ] Databases (size: ___GB)
- [ ] User uploads (size: ___GB)
- [ ] AI models (size: ___GB)
- [ ] Configuration files
- [ ] SSL certificates
- [ ] Environment variables
EOF
```

### 1.2 Test Netcup RS 8000 Access

```bash
# Verify SSH access
ssh netcup "hostname && uname -a && df -h"

# Check system resources
ssh netcup "nproc && free -h && lscpu | grep 'Model name'"

# Install basic tools
ssh netcup "apt update && apt install -y docker.io docker-compose git htop ncdu curl wget"

# Configure Docker
ssh netcup "systemctl enable docker && systemctl start docker"
ssh netcup "docker run hello-world"
```

### 1.3 Setup Directory Structure on Netcup

```bash
ssh netcup << 'EOF'
# Create organized directory structure
mkdir -p /opt/{ai-orchestrator,apps,databases,monitoring,backups}
mkdir -p /data/{models,uploads,databases}
mkdir -p /etc/docker/compose

# Set permissions
chown -R $USER:$USER /opt /data
chmod 755 /opt /data

ls -la /opt /data
EOF
```

---

## 📋 Phase 2: Deploy AI Orchestration Infrastructure

### 2.1 Transfer AI Orchestration Stack

```bash
# Create the AI orchestration directory structure
cat > /tmp/create-ai-orchestrator.sh << 'SCRIPT'
#!/bin/bash
set -e

BASE_DIR="/opt/ai-orchestrator"
mkdir -p $BASE_DIR/{services/{router,workers,monitor},configs,data/{redis,postgres,prometheus}}

echo "✅ Created AI orchestrator directory structure"
ls -R $BASE_DIR
SCRIPT

# Copy to Netcup and execute
scp /tmp/create-ai-orchestrator.sh netcup:/tmp/
ssh netcup "chmod +x /tmp/create-ai-orchestrator.sh && /tmp/create-ai-orchestrator.sh"
```

### 2.2 Deploy Docker Compose Stack

**Create main docker-compose.yml:**

```bash
ssh netcup "cat > /opt/ai-orchestrator/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  # Redis for job queues
  redis:
    image: redis:7-alpine
    container_name: ai-redis
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # PostgreSQL for job history and analytics
  postgres:
    image: postgres:15-alpine
    container_name: ai-postgres
    environment:
      POSTGRES_DB: ai_orchestrator
      POSTGRES_USER: aiuser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aiuser"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Smart Router API (FastAPI)
  router:
    build: ./services/router
    container_name: ai-router
    ports:
      - "8000:8000"
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
      RUNPOD_API_KEY: ${RUNPOD_API_KEY}
      OLLAMA_URL: http://ollama:11434
      SD_CPU_URL: http://stable-diffusion-cpu:7860
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Text Worker (processes text generation queue)
  text-worker:
    build: ./services/workers
    container_name: ai-text-worker
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
      WORKER_TYPE: text
      OLLAMA_URL: http://ollama:11434
      RUNPOD_API_KEY: ${RUNPOD_API_KEY}
    depends_on:
      - redis
      - postgres
      - router
    restart: unless-stopped
    deploy:
      replicas: 2

  # Image Worker (processes image generation queue)
  image-worker:
    build: ./services/workers
    container_name: ai-image-worker
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
      WORKER_TYPE: image
      SD_CPU_URL: http://stable-diffusion-cpu:7860
      RUNPOD_API_KEY: ${RUNPOD_API_KEY}
    depends_on:
      - redis
      - postgres
      - router
    restart: unless-stopped

  # Code Worker (processes code generation queue)
  code-worker:
    build: ./services/workers
    container_name: ai-code-worker
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
      WORKER_TYPE: code
      OLLAMA_URL: http://ollama:11434
    depends_on:
      - redis
      - postgres
      - router
    restart: unless-stopped

  # Video Worker (processes video generation queue - always RunPod)
  video-worker:
    build: ./services/workers
    container_name: ai-video-worker
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
      WORKER_TYPE: video
      RUNPOD_API_KEY: ${RUNPOD_API_KEY}
      RUNPOD_VIDEO_ENDPOINT_ID: ${RUNPOD_VIDEO_ENDPOINT_ID}
    depends_on:
      - redis
      - postgres
      - router
    restart: unless-stopped

  # Ollama (local LLM server)
  ollama:
    image: ollama/ollama:latest
    container_name: ai-ollama
    ports:
      - "11434:11434"
    volumes:
      - /data/models/ollama:/root/.ollama
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Stable Diffusion (CPU fallback)
  stable-diffusion-cpu:
    image: ghcr.io/stablecog/sc-worker:latest
    container_name: ai-sd-cpu
    ports:
      - "7860:7860"
    volumes:
      - /data/models/stable-diffusion:/models
    environment:
      USE_CPU: "true"
      MODEL_PATH: /models/sd-v2.1
    restart: unless-stopped

  # Cost Monitor & Analytics
  monitor:
    build: ./services/monitor
    container_name: ai-monitor
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://aiuser:${POSTGRES_PASSWORD:-changeme}@postgres:5432/ai_orchestrator
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  # Prometheus (metrics collection)
  prometheus:
    image: prom/prometheus:latest
    container_name: ai-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./configs/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  # Grafana (dashboards)
  grafana:
    image: grafana/grafana:latest
    container_name: ai-grafana
    ports:
      - "3001:3000"
    volumes:
      - ./data/grafana:/var/lib/grafana
      - ./configs/grafana-dashboards:/etc/grafana/provisioning/dashboards
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    depends_on:
      - prometheus
    restart: unless-stopped

networks:
  default:
    name: ai-orchestrator-network
EOF
```

### 2.3 Create Smart Router Service

```bash
ssh netcup "mkdir -p /opt/ai-orchestrator/services/router"
ssh netcup "cat > /opt/ai-orchestrator/services/router/Dockerfile" << 'EOF'
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    redis==5.0.1 \
    asyncpg==0.29.0 \
    httpx==0.25.1 \
    pydantic==2.5.0 \
    pydantic-settings==2.1.0

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
```

**Create Router API:**

```bash
ssh netcup "cat > /opt/ai-orchestrator/services/router/main.py" << 'EOF'
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Literal
import redis.asyncio as redis
import asyncpg
import httpx
import json
import time
import os
from datetime import datetime
import uuid

app = FastAPI(title="AI Orchestrator", version="1.0.0")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
SD_CPU_URL = os.getenv("SD_CPU_URL", "http://localhost:7860")

# Redis connection pool
redis_pool = None

@app.on_event("startup")
async def startup():
    global redis_pool
    redis_pool = redis.ConnectionPool.from_url(REDIS_URL, decode_responses=True)

@app.on_event("shutdown")
async def shutdown():
    if redis_pool:
        await redis_pool.disconnect()

# Request Models
class TextGenerationRequest(BaseModel):
    prompt: str
    model: str = "llama3-70b"
    priority: Literal["low", "normal", "high"] = "normal"
    user_id: Optional[str] = None
    wait: bool = False  # Wait for result or return job_id

class ImageGenerationRequest(BaseModel):
    prompt: str
    model: str = "sdxl"
    priority: Literal["low", "normal", "high"] = "normal"
    size: str = "1024x1024"
    user_id: Optional[str] = None
    wait: bool = False

class VideoGenerationRequest(BaseModel):
    prompt: str
    model: str = "wan2.1-i2v"
    duration: int = 3  # seconds
    user_id: Optional[str] = None
    wait: bool = False

class CodeGenerationRequest(BaseModel):
    prompt: str
    language: str = "python"
    priority: Literal["low", "normal", "high"] = "normal"
    user_id: Optional[str] = None
    wait: bool = False

# Response Models
class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

class ResultResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[dict] = None
    cost: Optional[float] = None
    provider: Optional[str] = None
    processing_time: Optional[float] = None

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Smart Routing Logic
async def route_text_job(request: TextGenerationRequest) -> str:
    """
    Text routing logic:
    - Always use local Ollama (FREE, fast enough with 20 cores)
    - Only use RunPod for extremely large context or special models
    """
    return "local"  # 99% of text goes to local CPU

async def route_image_job(request: ImageGenerationRequest) -> str:
    """
    Image routing logic:
    - Low priority → Local SD CPU (slow but FREE)
    - Normal priority → Check queue depth, route to faster option
    - High priority → RunPod GPU (fast, $0.02)
    """
    if request.priority == "high":
        return "runpod"

    if request.priority == "low":
        return "local"

    # Normal priority: check queue depth
    r = redis.Redis(connection_pool=redis_pool)
    queue_depth = await r.llen("queue:image:local")

    # If local queue is backed up (>10 jobs), use RunPod for faster response
    if queue_depth > 10:
        return "runpod"

    return "local"

async def route_video_job(request: VideoGenerationRequest) -> str:
    """
    Video routing logic:
    - Always RunPod (no local option for video generation)
    """
    return "runpod"

async def route_code_job(request: CodeGenerationRequest) -> str:
    """
    Code routing logic:
    - Always local (CodeLlama/DeepSeek on Ollama)
    """
    return "local"

# Text Generation Endpoint
@app.post("/generate/text", response_model=JobResponse)
async def generate_text(request: TextGenerationRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    provider = await route_text_job(request)

    # Add to queue
    r = redis.Redis(connection_pool=redis_pool)
    job_data = {
        "job_id": job_id,
        "type": "text",
        "provider": provider,
        "request": request.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "status": "queued"
    }

    await r.lpush(f"queue:text:{provider}", json.dumps(job_data))
    await r.set(f"job:{job_id}", json.dumps(job_data))

    return JobResponse(
        job_id=job_id,
        status="queued",
        message=f"Job queued on {provider} provider"
    )

# Image Generation Endpoint
@app.post("/generate/image", response_model=JobResponse)
async def generate_image(request: ImageGenerationRequest):
    job_id = str(uuid.uuid4())
    provider = await route_image_job(request)

    r = redis.Redis(connection_pool=redis_pool)
    job_data = {
        "job_id": job_id,
        "type": "image",
        "provider": provider,
        "request": request.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "status": "queued"
    }

    await r.lpush(f"queue:image:{provider}", json.dumps(job_data))
    await r.set(f"job:{job_id}", json.dumps(job_data))

    return JobResponse(
        job_id=job_id,
        status="queued",
        message=f"Job queued on {provider} provider (priority: {request.priority})"
    )

# Video Generation Endpoint
@app.post("/generate/video", response_model=JobResponse)
async def generate_video(request: VideoGenerationRequest):
    job_id = str(uuid.uuid4())
    provider = "runpod"  # Always RunPod for video

    r = redis.Redis(connection_pool=redis_pool)
    job_data = {
        "job_id": job_id,
        "type": "video",
        "provider": provider,
        "request": request.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "status": "queued"
    }

    await r.lpush(f"queue:video:{provider}", json.dumps(job_data))
    await r.set(f"job:{job_id}", json.dumps(job_data))

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Video generation queued on RunPod GPU"
    )

# Code Generation Endpoint
@app.post("/generate/code", response_model=JobResponse)
async def generate_code(request: CodeGenerationRequest):
    job_id = str(uuid.uuid4())
    provider = "local"  # Always local for code

    r = redis.Redis(connection_pool=redis_pool)
    job_data = {
        "job_id": job_id,
        "type": "code",
        "provider": provider,
        "request": request.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "status": "queued"
    }

    await r.lpush(f"queue:code:{provider}", json.dumps(job_data))
    await r.set(f"job:{job_id}", json.dumps(job_data))

    return JobResponse(
        job_id=job_id,
        status="queued",
        message="Code generation queued on local provider"
    )

# Job Status Endpoint
@app.get("/job/{job_id}", response_model=ResultResponse)
async def get_job_status(job_id: str):
    r = redis.Redis(connection_pool=redis_pool)
    job_data = await r.get(f"job:{job_id}")

    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(job_data)

    return ResultResponse(
        job_id=job_id,
        status=job.get("status", "unknown"),
        result=job.get("result"),
        cost=job.get("cost"),
        provider=job.get("provider"),
        processing_time=job.get("processing_time")
    )

# Queue Status Endpoint
@app.get("/queue/status")
async def get_queue_status():
    r = redis.Redis(connection_pool=redis_pool)

    queues = {
        "text_local": await r.llen("queue:text:local"),
        "text_runpod": await r.llen("queue:text:runpod"),
        "image_local": await r.llen("queue:image:local"),
        "image_runpod": await r.llen("queue:image:runpod"),
        "video_runpod": await r.llen("queue:video:runpod"),
        "code_local": await r.llen("queue:code:local"),
    }

    return {
        "queues": queues,
        "total_pending": sum(queues.values()),
        "timestamp": datetime.utcnow().isoformat()
    }

# Cost Summary Endpoint
@app.get("/costs/summary")
async def get_cost_summary():
    # This would query PostgreSQL for cost data
    # For now, return mock data
    return {
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
EOF
```

### 2.4 Create Worker Service

```bash
ssh netcup "cat > /opt/ai-orchestrator/services/workers/Dockerfile" << 'EOF'
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    redis==5.0.1 \
    asyncpg==0.29.0 \
    httpx==0.25.1 \
    openai==1.3.0

COPY worker.py .

CMD ["python", "worker.py"]
EOF
```

```bash
ssh netcup "cat > /opt/ai-orchestrator/services/workers/worker.py" << 'EOF'
import redis
import json
import os
import time
import httpx
import asyncio
from datetime import datetime

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
WORKER_TYPE = os.getenv("WORKER_TYPE", "text")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
SD_CPU_URL = os.getenv("SD_CPU_URL", "http://localhost:7860")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

async def process_text_job(job_data):
    """Process text generation job using Ollama"""
    request = job_data["request"]
    provider = job_data["provider"]

    start_time = time.time()

    if provider == "local":
        # Use Ollama
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": request["model"],
                    "prompt": request["prompt"],
                    "stream": False
                },
                timeout=120.0
            )
            result = response.json()

        return {
            "text": result.get("response", ""),
            "cost": 0.00,  # Local is free
            "provider": "ollama",
            "processing_time": time.time() - start_time
        }
    else:
        # Use RunPod (fallback)
        # Implementation for RunPod text endpoint
        return {
            "text": "RunPod text generation",
            "cost": 0.01,
            "provider": "runpod",
            "processing_time": time.time() - start_time
        }

async def process_image_job(job_data):
    """Process image generation job"""
    request = job_data["request"]
    provider = job_data["provider"]

    start_time = time.time()

    if provider == "local":
        # Use local Stable Diffusion (CPU)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SD_CPU_URL}/sdapi/v1/txt2img",
                json={
                    "prompt": request["prompt"],
                    "steps": 20,
                    "width": 512,
                    "height": 512
                },
                timeout=180.0
            )
            result = response.json()

        return {
            "image_url": result.get("images", [""])[0],
            "cost": 0.00,  # Local is free
            "provider": "stable-diffusion-cpu",
            "processing_time": time.time() - start_time
        }
    else:
        # Use RunPod SDXL
        # Implementation for RunPod image endpoint
        return {
            "image_url": "runpod_image_url",
            "cost": 0.02,
            "provider": "runpod-sdxl",
            "processing_time": time.time() - start_time
        }

async def process_video_job(job_data):
    """Process video generation job (always RunPod)"""
    request = job_data["request"]
    start_time = time.time()

    # Implementation for RunPod video endpoint (Wan2.1)
    return {
        "video_url": "runpod_video_url",
        "cost": 0.50,
        "provider": "runpod-wan2.1",
        "processing_time": time.time() - start_time
    }

async def process_code_job(job_data):
    """Process code generation job (local only)"""
    request = job_data["request"]
    start_time = time.time()

    # Use Ollama with CodeLlama
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": "codellama",
                "prompt": request["prompt"],
                "stream": False
            },
            timeout=120.0
        )
        result = response.json()

    return {
        "code": result.get("response", ""),
        "cost": 0.00,
        "provider": "ollama-codellama",
        "processing_time": time.time() - start_time
    }

async def worker_loop():
    """Main worker loop"""
    print(f"🚀 Starting {WORKER_TYPE} worker...")

    processors = {
        "text": process_text_job,
        "image": process_image_job,
        "video": process_video_job,
        "code": process_code_job
    }

    processor = processors.get(WORKER_TYPE)
    if not processor:
        raise ValueError(f"Unknown worker type: {WORKER_TYPE}")

    while True:
        try:
            # Try both local and runpod queues
            for provider in ["local", "runpod"]:
                queue_name = f"queue:{WORKER_TYPE}:{provider}"

                # Block for 1 second waiting for job
                job_json = r.brpop(queue_name, timeout=1)

                if job_json:
                    _, job_data_str = job_json
                    job_data = json.loads(job_data_str)
                    job_id = job_data["job_id"]

                    print(f"📝 Processing job {job_id} ({WORKER_TYPE}/{provider})")

                    # Update status to processing
                    job_data["status"] = "processing"
                    r.set(f"job:{job_id}", json.dumps(job_data))

                    try:
                        # Process the job
                        result = await processor(job_data)

                        # Update job with result
                        job_data["status"] = "completed"
                        job_data["result"] = result
                        job_data["cost"] = result.get("cost", 0)
                        job_data["processing_time"] = result.get("processing_time", 0)
                        job_data["completed_at"] = datetime.utcnow().isoformat()

                        r.set(f"job:{job_id}", json.dumps(job_data))
                        print(f"✅ Completed job {job_id} (cost: ${result.get('cost', 0):.4f})")

                    except Exception as e:
                        print(f"❌ Error processing job {job_id}: {e}")
                        job_data["status"] = "failed"
                        job_data["error"] = str(e)
                        r.set(f"job:{job_id}", json.dumps(job_data))

                    break  # Processed a job, start loop again

            # Small delay to prevent tight loop
            await asyncio.sleep(0.1)

        except Exception as e:
            print(f"❌ Worker error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(worker_loop())
EOF
```

### 2.5 Create Environment Configuration

```bash
ssh netcup "cat > /opt/ai-orchestrator/.env" << 'EOF'
# PostgreSQL
POSTGRES_PASSWORD=change_this_password_$(openssl rand -hex 16)

# RunPod API Keys
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_TEXT_ENDPOINT_ID=your_text_endpoint_id
RUNPOD_IMAGE_ENDPOINT_ID=your_image_endpoint_id
RUNPOD_VIDEO_ENDPOINT_ID=your_video_endpoint_id

# Grafana
GRAFANA_PASSWORD=change_this_password_$(openssl rand -hex 16)

# Monitoring
ALERT_EMAIL=your@email.com
COST_ALERT_THRESHOLD=100  # Alert if daily cost exceeds $100
EOF
```

### 2.6 Deploy AI Orchestration Stack

```bash
# Deploy the stack
ssh netcup "cd /opt/ai-orchestrator && docker-compose up -d"

# Check status
ssh netcup "cd /opt/ai-orchestrator && docker-compose ps"

# View logs
ssh netcup "cd /opt/ai-orchestrator && docker-compose logs -f router"

# Test health
ssh netcup "curl http://localhost:8000/health"
ssh netcup "curl http://localhost:8000/docs"  # API documentation
```

---

## 📋 Phase 3: Setup Local AI Models

### 3.1 Download and Configure Ollama Models

```bash
# Pull recommended models
ssh netcup << 'EOF'
docker exec ai-ollama ollama pull llama3:70b
docker exec ai-ollama ollama pull codellama:34b
docker exec ai-ollama ollama pull deepseek-coder:33b
docker exec ai-ollama ollama pull mistral:7b

# List installed models
docker exec ai-ollama ollama list

# Test a model
docker exec ai-ollama ollama run llama3:70b "Hello, how are you?"
EOF
```

### 3.2 Setup Stable Diffusion Models

```bash
# Download Stable Diffusion v2.1 weights
ssh netcup << 'EOF'
mkdir -p /data/models/stable-diffusion/sd-v2.1

# Download from HuggingFace
cd /data/models/stable-diffusion/sd-v2.1
wget https://huggingface.co/stabilityai/stable-diffusion-2-1/resolve/main/v2-1_768-ema-pruned.safetensors

# Verify download
ls -lh /data/models/stable-diffusion/sd-v2.1/
EOF
```

### 3.3 Setup Video Generation Models (Wan2.1)

```bash
# Download Wan2.1 I2V model weights
ssh netcup << 'EOF'
# Install huggingface-cli if not already installed
pip install huggingface-hub

# Download Wan2.1 I2V 14B 720p model
mkdir -p /data/models/video-generation
cd /data/models/video-generation

huggingface-cli download Wan-AI/Wan2.1-I2V-14B-720P \
  --include "*.safetensors" \
  --local-dir wan2.1_i2v_14b

# Verify download
du -sh wan2.1_i2v_14b
ls -lh wan2.1_i2v_14b/
EOF
```

**Note:** The Wan2.1 model is very large (~28GB) and is designed to run on RunPod GPU, not locally on CPU. We'll configure RunPod endpoints for video generation.

---

## 📋 Phase 4: Migrate Existing Services

### 4.1 Migrate canvas-website

```bash
# On Netcup, create app directory
ssh netcup "mkdir -p /opt/apps/canvas-website"

# From local machine, sync the code
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ~/Github/canvas-website/ \
  netcup:/opt/apps/canvas-website/

# Build and deploy on Netcup
ssh netcup << 'EOF'
cd /opt/apps/canvas-website

# Install dependencies
npm install

# Build
npm run build

# Create systemd service or Docker container
# Option 1: Docker (recommended)
cat > Dockerfile << 'DOCKER'
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
DOCKER

docker build -t canvas-website .
docker run -d --name canvas-website -p 3000:3000 canvas-website

# Option 2: PM2
pm2 start npm --name canvas-website -- start
pm2 save
EOF
```

### 4.2 Setup Nginx Reverse Proxy

```bash
ssh netcup << 'EOF'
apt install -y nginx certbot python3-certbot-nginx

# Create nginx config
cat > /etc/nginx/sites-available/canvas-website << 'NGINX'
server {
    listen 80;
    server_name canvas.jeffemmett.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# AI Orchestrator API
server {
    listen 80;
    server_name ai-api.jeffemmett.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

# Enable site
ln -s /etc/nginx/sites-available/canvas-website /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Setup SSL
certbot --nginx -d canvas.jeffemmett.com -d ai-api.jeffemmett.com
EOF
```

### 4.3 Migrate Databases

```bash
# Export from DigitalOcean
ssh droplet << 'EOF'
# PostgreSQL
pg_dump -U postgres your_database > /tmp/db_backup.sql

# MongoDB (if you have it)
mongodump --out /tmp/mongo_backup
EOF

# Transfer to Netcup
scp droplet:/tmp/db_backup.sql /tmp/
scp /tmp/db_backup.sql netcup:/tmp/

# Import on Netcup
ssh netcup << 'EOF'
# PostgreSQL
psql -U postgres -d your_database < /tmp/db_backup.sql

# Verify
psql -U postgres -d your_database -c "SELECT COUNT(*) FROM your_table;"
EOF
```

### 4.4 Migrate User Uploads and Data

```bash
# Sync user uploads
rsync -avz --progress \
  droplet:/var/www/uploads/ \
  netcup:/data/uploads/

# Sync any other data directories
rsync -avz --progress \
  droplet:/var/www/data/ \
  netcup:/data/app-data/
```

---

## 📋 Phase 5: Update canvas-website for AI Orchestration

### 5.1 Update Environment Variables

Now let's update the canvas-website configuration to use the new AI orchestrator:

```bash
# Create updated .env file for canvas-website
cat > .env.local << 'EOF'
# AI Orchestrator
VITE_AI_ORCHESTRATOR_URL=http://159.195.32.209:8000
# Or use domain: https://ai-api.jeffemmett.com

# RunPod (direct access, fallback)
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

### 5.2 Disable Mock Mode for Image Generation

Let's fix the ImageGenShapeUtil to use the real AI orchestrator:

```bash
# Update USE_MOCK_API flag
sed -i 's/const USE_MOCK_API = true/const USE_MOCK_API = false/' \
  src/shapes/ImageGenShapeUtil.tsx
```

### 5.3 Create AI Orchestrator Client

Create a new client library for the AI orchestrator:

```typescript
// src/lib/aiOrchestrator.ts
export interface AIJob {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: any
  cost?: number
  provider?: string
  processing_time?: number
}

export class AIOrchestrator {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ||
      import.meta.env.VITE_AI_ORCHESTRATOR_URL ||
      'http://localhost:8000'
  }

  async generateText(
    prompt: string,
    options: {
      model?: string
      priority?: 'low' | 'normal' | 'high'
      userId?: string
      wait?: boolean
    } = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'llama3-70b',
        priority: options.priority || 'normal',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    const job = await response.json()

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  async generateImage(
    prompt: string,
    options: {
      model?: string
      priority?: 'low' | 'normal' | 'high'
      size?: string
      userId?: string
      wait?: boolean
    } = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'sdxl',
        priority: options.priority || 'normal',
        size: options.size || '1024x1024',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    const job = await response.json()

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  async generateVideo(
    prompt: string,
    options: {
      model?: string
      duration?: number
      userId?: string
      wait?: boolean
    } = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: options.model || 'wan2.1-i2v',
        duration: options.duration || 3,
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    const job = await response.json()

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  async generateCode(
    prompt: string,
    options: {
      language?: string
      priority?: 'low' | 'normal' | 'high'
      userId?: string
      wait?: boolean
    } = {}
  ): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/generate/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        language: options.language || 'python',
        priority: options.priority || 'normal',
        user_id: options.userId,
        wait: options.wait || false
      })
    })

    const job = await response.json()

    if (options.wait) {
      return this.waitForJob(job.job_id)
    }

    return job
  }

  async getJobStatus(jobId: string): Promise<AIJob> {
    const response = await fetch(`${this.baseUrl}/job/${jobId}`)
    return response.json()
  }

  async waitForJob(
    jobId: string,
    maxAttempts: number = 120,
    pollInterval: number = 1000
  ): Promise<AIJob> {
    for (let i = 0; i < maxAttempts; i++) {
      const job = await this.getJobStatus(jobId)

      if (job.status === 'completed') {
        return job
      }

      if (job.status === 'failed') {
        throw new Error(`Job failed: ${JSON.stringify(job)}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`)
  }

  async getQueueStatus() {
    const response = await fetch(`${this.baseUrl}/queue/status`)
    return response.json()
  }

  async getCostSummary() {
    const response = await fetch(`${this.baseUrl}/costs/summary`)
    return response.json()
  }
}

// Singleton instance
export const aiOrchestrator = new AIOrchestrator()
```

---

## 📋 Phase 6: Testing & Validation

### 6.1 Test AI Orchestrator

```bash
# Test text generation
curl -X POST http://159.195.32.209:8000/generate/text \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a hello world program in Python",
    "priority": "normal",
    "wait": false
  }'

# Get job status
curl http://159.195.32.209:8000/job/YOUR_JOB_ID

# Check queue status
curl http://159.195.32.209:8000/queue/status

# Check costs
curl http://159.195.32.209:8000/costs/summary
```

### 6.2 Test Image Generation

```bash
# Low priority (local CPU)
curl -X POST http://159.195.32.209:8000/generate/image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful landscape",
    "priority": "low"
  }'

# High priority (RunPod GPU)
curl -X POST http://159.195.32.209:8000/generate/image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful landscape",
    "priority": "high"
  }'
```

### 6.3 Validate Migration

**Checklist:**
- [ ] All services accessible from new IPs
- [ ] SSL certificates installed and working
- [ ] Databases migrated and verified
- [ ] User uploads accessible
- [ ] AI orchestrator responding
- [ ] Monitoring dashboards working
- [ ] Cost tracking functional

---

## 📋 Phase 7: DNS Updates & Cutover

### 7.1 Update DNS Records

```bash
# Update A records to point to Netcup RS 8000
# Old IP: 143.198.39.165 (DigitalOcean)
# New IP: 159.195.32.209 (Netcup)

# Update these domains:
# - canvas.jeffemmett.com → 159.195.32.209
# - ai-api.jeffemmett.com → 159.195.32.209
# - Any other domains hosted on droplet
```

### 7.2 Parallel Running Period

Run both servers in parallel for 1-2 weeks:
- Monitor traffic on both
- Compare performance
- Watch for issues
- Verify all features work on new server

### 7.3 Final Cutover

Once validated:
1. Update DNS TTL to 300 seconds (5 min)
2. Switch DNS to Netcup IPs
3. Monitor for 48 hours
4. Shut down DigitalOcean droplets
5. Cancel DigitalOcean subscription

---

## 📋 Phase 8: Monitoring & Optimization

### 8.1 Setup Monitoring Dashboards

Access your monitoring:
- **Grafana**: http://159.195.32.209:3001
- **Prometheus**: http://159.195.32.209:9090
- **AI API Docs**: http://159.195.32.209:8000/docs

### 8.2 Cost Optimization Recommendations

```bash
# Get optimization suggestions
curl http://159.195.32.209:3000/api/recommendations

# Review daily costs
curl http://159.195.32.209:3000/api/costs/summary
```

### 8.3 Performance Tuning

Based on usage patterns:
- Adjust worker pool sizes
- Tune queue routing thresholds
- Optimize model choices
- Scale RunPod endpoints

---

## 💰 Expected Cost Breakdown

### Before Migration (DigitalOcean):
- Main Droplet (2 vCPU, 2GB): $18/mo
- AI Droplet (2 vCPU, 4GB): $36/mo
- RunPod persistent pods: $100-200/mo
- **Total: $154-254/mo**

### After Migration (Netcup + RunPod):
- RS 8000 G12 Pro: €55.57/mo (~$60/mo)
- RunPod serverless (70% reduction): $30-60/mo
- **Total: $90-120/mo**

### Savings:
- **Monthly: $64-134**
- **Annual: $768-1,608**

Plus you get:
- 10x CPU cores (20 vs 2)
- 32x RAM (64GB vs 2GB)
- 25x storage (3TB vs 120GB)

---

## 🎯 Next Steps Summary

1. **TODAY**: Verify Netcup RS 8000 access
2. **Week 1**: Deploy AI orchestration stack
3. **Week 2**: Migrate canvas-website and test
4. **Week 3**: Migrate remaining services
5. **Week 4**: DNS cutover and monitoring
6. **Week 5**: Decommission DigitalOcean

Total migration timeline: **4-5 weeks** for safe, validated migration.

---

## 📚 Additional Resources

- **AI Orchestrator API Docs**: http://159.195.32.209:8000/docs
- **Grafana Dashboards**: http://159.195.32.209:3001
- **Queue Monitoring**: http://159.195.32.209:8000/queue/status
- **Cost Tracking**: http://159.195.32.209:3000/api/costs/summary

---

**Ready to start?** Let's begin with Phase 1: Pre-Migration Preparation! 🚀
