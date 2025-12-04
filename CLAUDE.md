## 🔧 AUTO-APPROVED OPERATIONS

The following operations are auto-approved and do not require user confirmation:
- **Read**: All file read operations (`Read(*)`)
- **Glob**: All file pattern matching (`Glob(*)`)
- **Grep**: All content searching (`Grep(*)`)

These permissions are configured in `~/.claude/settings.json`.

---

## ⚠️ SAFETY GUIDELINES

**ALWAYS WARN THE USER before performing any action that could:**
- Overwrite existing files (use `ls` or `cat` to check first)
- Overwrite credentials, API keys, or secrets
- Delete data or files
- Modify production configurations
- Run destructive git commands (force push, hard reset, etc.)
- Drop databases or truncate tables

**Best practices:**
- Before writing to a file, check if it exists and show its contents
- Use `>>` (append) instead of `>` (overwrite) for credential files
- Create backups before modifying critical configs (e.g., `cp file file.backup`)
- Ask for confirmation before irreversible actions

**Sudo commands:**
- **NEVER run sudo commands directly** - the Bash tool doesn't support interactive input
- Instead, **provide the user with the exact sudo command** they need to run in their terminal
- Format the command clearly in a code block for easy copy-paste
- After user runs the sudo command, continue with the workflow
- Alternative: If user has recently run sudo (within ~15 min), subsequent sudo commands may not require password

---

## 🔑 ACCESS & CREDENTIALS

### Version Control & Code Hosting
- **Gitea**: Self-hosted at `gitea.jeffemmett.com` - PRIMARY repository
  - Push here FIRST, then mirror to GitHub
  - Private repos and source of truth
  - SSH Key: `~/.ssh/gitea_ed25519` (private), `~/.ssh/gitea_ed25519.pub` (public)
  - Public Key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIE2+2UZElEYptgZ9GFs2CXW0PIA57BfQcU9vlyV6fz4 gitea@jeffemmett.com`
  - **Gitea CLI (tea)**: ✅ Installed at `~/bin/tea` (added to PATH)

- **GitHub**: Public mirror and collaboration
  - Receives pushes from Gitea via mirror sync
  - Token: `(REDACTED-GITHUB-TOKEN)`
  - SSH Key: `~/.ssh/github_deploy_key` (private), `~/.ssh/github_deploy_key.pub` (public)
  - **GitHub CLI (gh)**: ✅ Installed and available for PR/issue management

### Git Workflow
**Two-way sync between Gitea and GitHub:**

**Gitea-Primary Repos (Default):**
1. Develop locally in `/home/jeffe/Github/`
2. Commit and push to Gitea first
3. Gitea automatically mirrors TO GitHub (built-in push mirror)
4. GitHub used for public collaboration and visibility

**GitHub-Primary Repos (Mirror Repos):**
For repos where GitHub is source of truth (v0.dev exports, client collabs):
1. Push to GitHub
2. Deploy webhook pulls from GitHub and deploys
3. Webhook triggers Gitea to sync FROM GitHub

### 🔀 DEV BRANCH WORKFLOW (MANDATORY)

**CRITICAL: All development work on canvas-website (and other active projects) MUST use a dev branch.**

#### Branch Strategy
```
main (production)
  └── dev (integration/staging)
        └── feature/* (optional feature branches)
```

#### Development Rules

1. **ALWAYS work on the `dev` branch** for new features and changes:
   ```bash
   cd /home/jeffe/Github/canvas-website
   git checkout dev
   git pull origin dev
   ```

2. **After completing a feature**, push to dev:
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin dev
   ```

3. **Update backlog task** immediately after pushing:
   ```bash
   backlog task edit <task-id> --status "Done" --append-notes "Pushed to dev branch"
   ```

4. **NEVER push directly to main** - main is for tested, verified features only

5. **Merge dev → main manually** when features are verified working:
   ```bash
   git checkout main
   git pull origin main
   git merge dev
   git push origin main
   git checkout dev  # Return to dev for continued work
   ```

#### Complete Feature Deployment Checklist

- [ ] Work on `dev` branch (not main)
- [ ] Test locally before committing
- [ ] Commit with descriptive message
- [ ] Push to `dev` branch on Gitea
- [ ] Update backlog task status to "Done"
- [ ] Add notes to backlog task about what was implemented
- [ ] (Later) When verified working: merge dev → main manually

#### Why This Matters
- **Protects production**: main branch always has known-working code
- **Enables testing**: dev branch can be deployed to staging for verification
- **Clean history**: main only gets complete, tested features
- **Easy rollback**: if dev breaks, main is still stable

### Server Infrastructure
- **Netcup RS 8000 G12 Pro**: Primary application & AI server
  - IP: `159.195.32.209`
  - 20 cores, 64GB RAM, 3TB storage
  - Hosts local AI models (Ollama, Stable Diffusion)
  - All websites and apps deployed here in Docker containers
  - Location: Germany (low latency EU)
  - SSH Key (local): `~/.ssh/netcup_ed25519` (private), `~/.ssh/netcup_ed25519.pub` (public)
  - Public Key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKmp4A2klKv/YIB1C6JAsb2UzvlzzE+0EcJ0jtkyFuhO netcup-rs8000@jeffemmett.com`
  - SSH Access: `ssh netcup`
  - **SSH Keys ON the server** (for git operations):
    - Gitea: `~/.ssh/gitea_ed25519` → `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIE2+2UZElEYptgZ9GFs2CXW0PIA57BfQcU9vlyV6fz4 gitea@jeffemmett.com`
    - GitHub: `~/.ssh/github_ed25519` → `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC6xXNICy0HXnqHO+U7+y7ui+pZBGe0bm0iRMS23pR1E github-deploy@netcup-rs8000`

- **RunPod**: GPU burst capacity for AI workloads
  - Host: `ssh.runpod.io`
  - Serverless GPU pods (pay-per-use)
  - Used for: SDXL/SD3, video generation, training
  - Smart routing from RS 8000 orchestrator
  - SSH Key: `~/.ssh/runpod_ed25519` (private), `~/.ssh/runpod_ed25519.pub` (public)
  - Public Key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAC7NYjI0U/2ChGaZBBWP7gKt/V12Ts6FgatinJOQ8JG runpod@jeffemmett.com`
  - SSH Access: `ssh runpod`
  - **API Key**: `(REDACTED-RUNPOD-KEY)`
  - **CLI Config**: `~/.runpod/config.toml`
  - **Serverless Endpoints**:
    - Image (SD): `tzf1j3sc3zufsy` (Automatic1111)
    - Video (Wan2.2): `4jql4l7l0yw0f3`
    - Text (vLLM): `03g5hz3hlo8gr2`
    - Whisper: `lrtisuv8ixbtub`
    - ComfyUI: `5zurj845tbf8he`

### API Keys & Services

**IMPORTANT**: All API keys and tokens are stored securely on the Netcup server. Never store credentials locally.
- Access credentials via: `ssh netcup "cat ~/.cloudflare-credentials.env"` or `ssh netcup "cat ~/.porkbun_credentials"`
- All API operations should be performed FROM the Netcup server, not locally

#### Credential Files on Netcup (`/root/`)
| File | Contents |
|------|----------|
| `~/.cloudflare-credentials.env` | Cloudflare API tokens, account ID, tunnel token |
| `~/.cloudflare_credentials` | Legacy/DNS token |
| `~/.porkbun_credentials` | Porkbun API key and secret |
| `~/.v0_credentials` | V0.dev API key |

#### Cloudflare
- **Account ID**: `0e7b3338d5278ed1b148e6456b940913`
- **Tokens stored on Netcup** - source `~/.cloudflare-credentials.env`:
  - `CLOUDFLARE_API_TOKEN` - Zone read, Worker:read/edit, R2:read/edit
  - `CLOUDFLARE_TUNNEL_TOKEN` - Tunnel management
  - `CLOUDFLARE_ZONE_TOKEN` - Zone:Edit, DNS:Edit (for adding domains)

#### Porkbun (Domain Registrar)
- **Credentials stored on Netcup** - source `~/.porkbun_credentials`:
  - `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY`
- **API Endpoint**: `https://api-ipv4.porkbun.com/api/json/v3/`
- **API Docs**: https://porkbun.com/api/json/v3/documentation
- **Important**: JSON must have `secretapikey` before `apikey` in requests
- **Capabilities**: Update nameservers, get auth codes for transfers, manage DNS
- **Note**: Each domain must have "API Access" enabled individually in Porkbun dashboard

#### Domain Onboarding Workflow (Porkbun → Cloudflare)
Run these commands FROM Netcup (`ssh netcup`):
1. Add domain to Cloudflare (creates zone, returns nameservers)
2. Update nameservers at Porkbun to point to Cloudflare
3. Add CNAME record pointing to Cloudflare tunnel
4. Add hostname to tunnel config and restart cloudflared
5. Domain is live through the tunnel!

#### V0.dev (AI UI Generation)
- **Credentials stored on Netcup** - source `~/.v0_credentials`:
  - `V0_API_KEY` - Platform API access
- **API Key**: `v1:5AwJbit4j9rhGcAKPU4XlVWs:05vyCcJLiWRVQW7Xu4u5E03G`
- **SDK**: `npm install v0-sdk` (use `v0` CLI for adding components)
- **Docs**: https://v0.app/docs/v0-platform-api
- **Capabilities**:
  - List/create/update/delete projects
  - Manage chats and versions
  - Download generated code
  - Create deployments
  - Manage environment variables
- **Limitations**: GitHub-only for git integration (no Gitea/GitLab support)
- **Usage**:
  ```javascript
  const { v0 } = require('v0-sdk');
  // Uses V0_API_KEY env var automatically
  const projects = await v0.projects.find();
  const chats = await v0.chats.find();
  ```

#### Other Services
- **HuggingFace**: CLI access available for model downloads
- **RunPod**: API access for serverless GPU orchestration (see Server Infrastructure above)

### Dev Ops Stack & Principles
- **Platform**: Linux WSL2 (Ubuntu on Windows) for development
- **Working Directory**: `/home/jeffe/Github`
- **Container Strategy**:
  - ALL repos should be Dockerized
  - Optimized containers for production deployment
  - Docker Compose for multi-service orchestration
- **Process Management**: PM2 available for Node.js services
- **Version Control**: Git configured with GitHub + Gitea mirrors
- **Package Managers**: npm/pnpm/yarn available

### 🚀 Traefik Reverse Proxy (Central Routing)
All HTTP services on Netcup RS 8000 route through Traefik for automatic service discovery.

**Architecture:**
```
Internet → Cloudflare Tunnel → Traefik (:80/:443) → Docker Services
                                    │
                                    ├── gitea.jeffemmett.com → gitea:3000
                                    ├── mycofi.earth → mycofi:3000
                                    ├── games.jeffemmett.com → games:80
                                    └── [auto-discovered via Docker labels]
```

**Location:** `/root/traefik/` on Netcup RS 8000

**Adding a New Service:**
```yaml
# In your docker-compose.yml, add these labels:
services:
  myapp:
    image: myapp:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`myapp.jeffemmett.com`)"
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"
    networks:
      - traefik-public
networks:
  traefik-public:
    external: true
```

**Traefik Dashboard:** `http://159.195.32.209:8888` (internal only)

**SSH Git Access:**
- SSH goes direct (not through Traefik): `git.jeffemmett.com:223` → `159.195.32.209:223`
- Web UI goes through Traefik: `gitea.jeffemmett.com` → Traefik → gitea:3000

### ☁️ Cloudflare Tunnel Configuration
**Location:** `/root/cloudflared/` on Netcup RS 8000

The tunnel uses a token-based configuration managed via Cloudflare Zero Trust Dashboard.
All public hostnames should point to `http://localhost:80` (Traefik), which routes based on Host header.

**Managed hostnames:**
- `gitea.jeffemmett.com` → Traefik → Gitea
- `photos.jeffemmett.com` → Traefik → Immich
- `movies.jeffemmett.com` → Traefik → Jellyfin
- `search.jeffemmett.com` → Traefik → Semantic Search
- `mycofi.earth` → Traefik → MycoFi
- `games.jeffemmett.com` → Traefik → Games Platform
- `decolonizeti.me` → Traefik → Decolonize Time

**Tunnel ID:** `a838e9dc-0af5-4212-8af2-6864eb15e1b5`
**Tunnel CNAME Target:** `a838e9dc-0af5-4212-8af2-6864eb15e1b5.cfargotunnel.com`

**To deploy a new website/service:**

1. **Dockerize the project** with Traefik labels in `docker-compose.yml`:
   ```yaml
   services:
     myapp:
       build: .
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.myapp.rule=Host(`mydomain.com`) || Host(`www.mydomain.com`)"
         - "traefik.http.services.myapp.loadbalancer.server.port=3000"
       networks:
         - traefik-public
   networks:
     traefik-public:
       external: true
   ```

2. **Deploy to Netcup:**
   ```bash
   ssh netcup "cd /opt/websites && git clone <repo-url>"
   ssh netcup "cd /opt/websites/<project> && docker compose up -d --build"
   ```

3. **Add hostname to tunnel config** (`/root/cloudflared/config.yml`):
   ```yaml
   - hostname: mydomain.com
     service: http://localhost:80
   - hostname: www.mydomain.com
     service: http://localhost:80
   ```
   Then restart: `ssh netcup "docker restart cloudflared"`

4. **Configure DNS in Cloudflare dashboard** (CRITICAL - prevents 525 SSL errors):
   - Go to Cloudflare Dashboard → select domain → DNS → Records
   - Delete any existing A/AAAA records for `@` and `www`
   - Add CNAME records:
     | Type | Name | Target | Proxy |
     |------|------|--------|-------|
     | CNAME | `@` | `a838e9dc-0af5-4212-8af2-6864eb15e1b5.cfargotunnel.com` | Proxied ✓ |
     | CNAME | `www` | `a838e9dc-0af5-4212-8af2-6864eb15e1b5.cfargotunnel.com` | Proxied ✓ |

**API Credentials** (on Netcup at `~/.cloudflare*`):
- `CLOUDFLARE_API_TOKEN` - Zone read access only
- `CLOUDFLARE_TUNNEL_TOKEN` - Tunnel management only
- See **API Keys & Services** section above for Domain Management Token (required for DNS automation)

### 🔄 Auto-Deploy Webhook System
**Location:** `/opt/deploy-webhook/` on Netcup RS 8000
**Endpoint:** `https://deploy.jeffemmett.com/deploy/<repo-name>`
**Secret:** `gitea-deploy-secret-2025`

Pushes to Gitea automatically trigger rebuilds. The webhook receiver:
1. Validates HMAC signature from Gitea
2. Runs `git pull && docker compose up -d --build`
3. Returns build status

**Adding a new repo to auto-deploy:**
1. Add entry to `/opt/deploy-webhook/webhook.py` REPOS dict
2. Restart: `ssh netcup "cd /opt/deploy-webhook && docker compose up -d --build"`
3. Add Gitea webhook:
   ```bash
   curl -X POST "https://gitea.jeffemmett.com/api/v1/repos/jeffemmett/<repo>/hooks" \
     -H "Authorization: token <gitea-token>" \
     -H "Content-Type: application/json" \
     -d '{"type":"gitea","active":true,"events":["push"],"config":{"url":"https://deploy.jeffemmett.com/deploy/<repo>","content_type":"json","secret":"gitea-deploy-secret-2025"}}'
   ```

**Currently auto-deploying:**
- `decolonize-time-website` → /opt/websites/decolonize-time-website
- `mycofi-earth-website` → /opt/websites/mycofi-earth-website
- `games-platform` → /opt/apps/games-platform

### 🔐 SSH Keys Quick Reference

**Local keys** (in `~/.ssh/` on your laptop):

| Service | Private Key | Public Key | Purpose |
|---------|-------------|------------|---------|
| **Gitea** | `gitea_ed25519` | `gitea_ed25519.pub` | Primary git repository |
| **GitHub** | `github_deploy_key` | `github_deploy_key.pub` | Public mirror sync |
| **Netcup RS 8000** | `netcup_ed25519` | `netcup_ed25519.pub` | Primary server SSH |
| **RunPod** | `runpod_ed25519` | `runpod_ed25519.pub` | GPU pods SSH |
| **Default** | `id_ed25519` | `id_ed25519.pub` | General purpose/legacy |

**Server-side keys** (in `/root/.ssh/` on Netcup RS 8000):

| Service | Key File | Purpose |
|---------|----------|---------|
| **Gitea** | `gitea_ed25519` | Server pulls from Gitea repos |
| **GitHub** | `github_ed25519` | Server pulls from GitHub (mirror repos) |

**SSH Config**: `~/.ssh/config` contains all host configurations
**Quick Access**:
- `ssh netcup` - Connect to Netcup RS 8000
- `ssh runpod` - Connect to RunPod
- `ssh gitea.jeffemmett.com` - Git operations

---

## 🤖 AI ORCHESTRATION ARCHITECTURE

### Smart Routing Strategy
All AI requests go through intelligent orchestration layer on RS 8000:

**Routing Logic:**
- **Text/Code (70-80% of workload)**: Always local RS 8000 CPU (Ollama) → FREE
- **Images - Low Priority**: RS 8000 CPU (SD 1.5/2.1) → FREE but slow (~60s)
- **Images - High Priority**: RunPod GPU (SDXL/SD3) → $0.02/image, fast
- **Video Generation**: Always RunPod GPU → $0.50/video (only option)
- **Training/Fine-tuning**: RunPod GPU on-demand

**Queue System:**
- Redis-based queues: text, image, code, video
- Priority-based routing (low/normal/high)
- Worker pools scale based on load
- Cost tracking per job, per user

**Cost Optimization:**
- Target: $90-120/mo (vs $136-236/mo current)
- Savings: $552-1,392/year
- 70-80% of workload FREE (local CPU)
- GPU only when needed (serverless = no idle costs)

### Deployment Architecture
```
RS 8000 G12 Pro (Netcup)
├── Cloudflare Tunnel (secure ingress)
├── Traefik Reverse Proxy (auto-discovery)
│   └── Routes to all services via Docker labels
├── Core Services
│   ├── Gitea (git hosting) - gitea.jeffemmett.com
│   └── Other internal tools
├── AI Services
│   ├── Ollama (text/code models)
│   ├── Stable Diffusion (CPU fallback)
│   └── Smart Router API (FastAPI)
├── Queue Infrastructure
│   ├── Redis (job queues)
│   └── PostgreSQL (job history/analytics)
├── Monitoring
│   ├── Prometheus (metrics)
│   ├── Grafana (dashboards)
│   └── Cost tracking API
└── Application Hosting
    ├── All websites (Dockerized + Traefik labels)
    ├── All apps (Dockerized + Traefik labels)
    └── Backend services (Dockerized)

RunPod Serverless (GPU Burst)
├── SDXL/SD3 endpoints
├── Video generation (Wan2.1)
└── Training/fine-tuning jobs
```

### Integration Pattern for Projects
All projects use unified AI client SDK:
```python
from orchestrator_client import AIOrchestrator
ai = AIOrchestrator("http://rs8000-ip:8000")

# Automatically routes based on priority & model
result = await ai.generate_text(prompt, priority="low")  # → FREE CPU
result = await ai.generate_image(prompt, priority="high") # → RunPod GPU
```

---

## 💰 GPU COST ANALYSIS & MIGRATION PLAN

### Current Infrastructure Costs (Monthly)

| Service | Type | Cost | Notes |
|---------|------|------|-------|
| Netcup RS 8000 G12 Pro | Fixed | ~€45 | 20 cores, 64GB RAM, 3TB (CPU-only) |
| RunPod Serverless | Variable | $50-100 | Pay-per-use GPU (images, video) |
| DigitalOcean Droplets | Fixed | ~$48 | ⚠️ DEPRECATED - migrate ASAP |
| **Current Total** | | **~$140-190/mo** | |

### GPU Provider Comparison

#### Netcup vGPU (NEW - Early Access, Ends July 7, 2025)

| Plan | GPU | VRAM | vCores | RAM | Storage | Price/mo | Price/hr equiv |
|------|-----|------|--------|-----|---------|----------|----------------|
| RS 2000 vGPU 7 | H200 | 7 GB dedicated | 8 | 16 GB DDR5 | 512 GB NVMe | €137.31 (~$150) | $0.21/hr |
| RS 4000 vGPU 14 | H200 | 14 GB dedicated | 12 | 32 GB DDR5 | 1 TB NVMe | €261.39 (~$285) | $0.40/hr |

**Pros:**
- NVIDIA H200 (latest gen, better than H100 for inference)
- Dedicated VRAM (no noisy neighbors)
- Germany location (EU data sovereignty, low latency to RS 8000)
- Fixed monthly cost = predictable budgeting
- 24/7 availability, no cold starts

**Cons:**
- Pay even when idle
- Limited to 7GB or 14GB VRAM options
- Early access = limited availability

#### RunPod Serverless (Current)

| GPU | VRAM | Price/hr | Typical Use |
|-----|------|----------|-------------|
| RTX 4090 | 24 GB | ~$0.44/hr | SDXL, medium models |
| A100 40GB | 40 GB | ~$1.14/hr | Large models, training |
| H100 80GB | 80 GB | ~$2.49/hr | Largest models |

**Current Endpoint Costs:**
- Image (SD/SDXL): ~$0.02/image (~2s compute)
- Video (Wan2.2): ~$0.50/video (~60s compute)
- Text (vLLM): ~$0.001/request
- Whisper: ~$0.01/minute audio

**Pros:**
- Zero idle costs
- Unlimited burst capacity
- Wide GPU selection (up to 80GB VRAM)
- Pay only for actual compute

**Cons:**
- Cold start delays (10-30s first request)
- Variable availability during peak times
- Per-request costs add up at scale

### Break-even Analysis

**When does Netcup vGPU become cheaper than RunPod?**

| Scenario | RunPod Cost | Netcup RS 2000 vGPU 7 | Netcup RS 4000 vGPU 14 |
|----------|-------------|----------------------|------------------------|
| 1,000 images/mo | $20 | $150 ❌ | $285 ❌ |
| 5,000 images/mo | $100 | $150 ❌ | $285 ❌ |
| **7,500 images/mo** | **$150** | **$150 ✅** | $285 ❌ |
| 10,000 images/mo | $200 | $150 ✅ | $285 ❌ |
| **14,250 images/mo** | **$285** | $150 ✅ | **$285 ✅** |
| 100 videos/mo | $50 | $150 ❌ | $285 ❌ |
| **300 videos/mo** | **$150** | **$150 ✅** | $285 ❌ |
| 500 videos/mo | $250 | $150 ✅ | $285 ❌ |

**Recommendation by Usage Pattern:**

| Monthly Usage | Best Option | Est. Cost |
|---------------|-------------|-----------|
| < 5,000 images OR < 250 videos | RunPod Serverless | $50-100 |
| 5,000-10,000 images OR 250-500 videos | **Netcup RS 2000 vGPU 7** | $150 fixed |
| > 10,000 images OR > 500 videos + training | **Netcup RS 4000 vGPU 14** | $285 fixed |
| Unpredictable/bursty workloads | RunPod Serverless | Variable |

### Migration Strategy

#### Phase 1: Immediate (Before July 7, 2025)
**Decision Point: Secure Netcup vGPU Early Access?**

- [ ] Monitor actual GPU usage for 2-4 weeks
- [ ] Calculate average monthly image/video generation
- [ ] If consistently > 5,000 images/mo → Consider RS 2000 vGPU 7
- [ ] If consistently > 10,000 images/mo → Consider RS 4000 vGPU 14
- [ ] **ACTION**: Redeem early access code if usage justifies fixed GPU

#### Phase 2: Hybrid Architecture (If vGPU Acquired)

```
RS 8000 G12 Pro (CPU - Current)
├── Ollama (text/code) → FREE
├── SD 1.5/2.1 CPU fallback → FREE
└── Orchestrator API

Netcup vGPU Server (NEW - If purchased)
├── Primary GPU workloads
├── SDXL/SD3 generation
├── Video generation (Wan2.1 I2V)
├── Model inference (14B params with 14GB VRAM)
└── Connected via internal netcup network (low latency)

RunPod Serverless (Burst Only)
├── Overflow capacity
├── Models requiring > 14GB VRAM
├── Training/fine-tuning jobs
└── Geographic distribution needs
```

#### Phase 3: Cost Optimization Targets

| Scenario | Current | With vGPU Migration | Savings |
|----------|---------|---------------------|---------|
| Low usage | $140/mo | $95/mo (RS8000 + minimal RunPod) | $540/yr |
| Medium usage | $190/mo | $195/mo (RS8000 + vGPU 7) | Break-even |
| High usage | $250/mo | $195/mo (RS8000 + vGPU 7) | $660/yr |
| Very high usage | $350/mo | $330/mo (RS8000 + vGPU 14) | $240/yr |

### Model VRAM Requirements Reference

| Model | VRAM Needed | Fits vGPU 7? | Fits vGPU 14? |
|-------|-------------|--------------|---------------|
| SD 1.5 | ~4 GB | ✅ | ✅ |
| SD 2.1 | ~5 GB | ✅ | ✅ |
| SDXL | ~7 GB | ⚠️ Tight | ✅ |
| SD3 Medium | ~8 GB | ❌ | ✅ |
| Wan2.1 I2V 14B | ~12 GB | ❌ | ✅ |
| Wan2.1 T2V 14B | ~14 GB | ❌ | ⚠️ Tight |
| Flux.1 Dev | ~12 GB | ❌ | ✅ |
| LLaMA 3 8B (Q4) | ~6 GB | ✅ | ✅ |
| LLaMA 3 70B (Q4) | ~40 GB | ❌ | ❌ (RunPod) |

### Decision Framework

```
┌─────────────────────────────────────────────────────────┐
│              GPU WORKLOAD DECISION TREE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Is usage predictable and consistent?                   │
│  ├── YES → Is monthly GPU spend > $150?                 │
│  │         ├── YES → Netcup vGPU (fixed cost wins)      │
│  │         └── NO  → RunPod Serverless (no idle cost)   │
│  └── NO  → RunPod Serverless (pay for what you use)     │
│                                                         │
│  Does model require > 14GB VRAM?                        │
│  ├── YES → RunPod (A100/H100 on-demand)                 │
│  └── NO  → Netcup vGPU or RS 8000 CPU                   │
│                                                         │
│  Is low latency critical?                               │
│  ├── YES → Netcup vGPU (same datacenter as RS 8000)     │
│  └── NO  → RunPod Serverless (acceptable for batch)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Monitoring & Review Schedule

- **Weekly**: Review RunPod spend dashboard
- **Monthly**: Calculate total GPU costs, compare to vGPU break-even
- **Quarterly**: Re-evaluate architecture, consider plan changes
- **Annually**: Full infrastructure cost audit

### Action Items

- [ ] **URGENT**: Decide on Netcup vGPU early access before July 7, 2025
- [ ] Set up GPU usage tracking in orchestrator
- [ ] Create Grafana dashboard for cost monitoring
- [ ] Test Wan2.1 I2V 14B model on vGPU 14 (if acquired)
- [ ] Document migration runbook for vGPU setup
- [ ] Complete DigitalOcean deprecation (separate from GPU decision)

---

## 📁 PROJECT PORTFOLIO STRUCTURE

### Repository Organization
- **Location**: `/home/jeffe/Github/`
- **Primary Flow**: Gitea (source of truth) → GitHub (public mirror)
- **Containerization**: ALL repos must be Dockerized with optimized production containers

### 🎯 MAIN PROJECT: canvas-website
**Location**: `/home/jeffe/Github/canvas-website`
**Description**: Collaborative canvas deployment - the integration hub where all tools come together
- Tldraw-based collaborative canvas platform
- Integrates Hyperindex, rSpace, MycoFi, and other tools
- Real-time collaboration features
- Deployed on RS 8000 in Docker
- Uses AI orchestrator for intelligent features

### Project Categories

**AI & Infrastructure:**
- AI Orchestrator (smart routing between RS 8000 & RunPod)
- Model hosting & fine-tuning pipelines
- Cost optimization & monitoring dashboards

**Web Applications & Sites:**
- **canvas-website**: Main collaborative canvas (integration hub)
- All deployed in Docker containers on RS 8000
- Cloudflare Workers for edge functions (Hyperindex)
- Static sites + dynamic backends containerized

**Supporting Projects:**
- **Hyperindex**: Tldraw canvas integration (Cloudflare stack) - integrates into canvas-website
- **rSpace**: Real-time collaboration platform - integrates into canvas-website
- **MycoFi**: DeFi/Web3 project - integrates into canvas-website
- **Canvas-related tools**: Knowledge graph & visualization components

### Deployment Strategy
1. **Development**: Local WSL2 environment (`/home/jeffe/Github/`)
2. **Version Control**: Push to Gitea FIRST → Auto-mirror to GitHub
3. **Containerization**: Build optimized Docker images with Traefik labels
4. **Deployment**: Deploy to RS 8000 via Docker Compose (join `traefik-public` network)
5. **Routing**: Traefik auto-discovers service via labels, no config changes needed
6. **DNS**: Add hostname to Cloudflare tunnel (if new domain) or it just works (existing domains)
7. **AI Integration**: Connect to local orchestrator API
8. **Monitoring**: Grafana dashboards for all services

### Infrastructure Philosophy
- **Self-hosted first**: Own your infrastructure (RS 8000 + Gitea)
- **Cloud for edge cases**: Cloudflare (edge), RunPod (GPU burst)
- **Cost-optimized**: Local CPU for 70-80% of workload
- **Dockerized everything**: Reproducible, scalable, maintainable
- **Smart orchestration**: Right compute for the right job

---

- can you make sure you are runing the hf download for a non deprecated version?  After that, you can proceed with  Image-to-Video 14B 720p (RECOMMENDED)
huggingface-cli download Wan-AI/Wan2.1-I2V-14B-720P \
  --include "*.safetensors" \
  --local-dir models/diffusion_models/wan2.1_i2v_14b

## 🕸️ HYPERINDEX PROJECT - TOP PRIORITY

**Location:** `/home/jeffe/Github/hyperindex-system/`

When user is ready to work on the hyperindexing system:
1. Reference `HYPERINDEX_PROJECT.md` for complete architecture and implementation details
2. Follow `HYPERINDEX_TODO.md` for step-by-step checklist
3. Start with Phase 1 (Database & Core Types), then proceed sequentially through Phase 5
4. This is a tldraw canvas integration project using Cloudflare Workers, D1, R2, and Durable Objects
5. Creates a "living, mycelial network" of web discoveries that spawn on the canvas in real-time

---

## 📋 BACKLOG.MD - UNIFIED TASK MANAGEMENT

**All projects use Backlog.md for task tracking.** Tasks are managed as markdown files and can be viewed at `backlog.jeffemmett.com` for a unified cross-project view.

### MCP Integration
Backlog.md is integrated via MCP server. Available tools:
- `backlog.task_create` - Create new tasks
- `backlog.task_list` - List tasks with filters
- `backlog.task_update` - Update task status/details
- `backlog.task_view` - View task details
- `backlog.search` - Search across tasks, docs, decisions

### Task Lifecycle Workflow

**CRITICAL: Claude agents MUST follow this workflow for ALL development tasks:**

#### 1. Task Discovery (Before Starting Work)
```bash
# Check if task already exists
backlog search "<task description>" --plain

# List current tasks
backlog task list --plain
```

#### 2. Task Creation (If Not Exists)
```bash
# Create task with full details
backlog task create "Task Title" \
  --desc "Detailed description" \
  --priority high \
  --status "To Do"
```

#### 3. Starting Work (Move to In Progress)
```bash
# Update status when starting
backlog task edit <task-id> --status "In Progress"
```

#### 4. During Development (Update Notes)
```bash
# Append progress notes
backlog task edit <task-id> --append-notes "Completed X, working on Y"

# Update acceptance criteria
backlog task edit <task-id> --check-ac 1
```

#### 5. Completion (Move to Done)
```bash
# Mark complete when finished
backlog task edit <task-id> --status "Done"
```

### Project Initialization

When starting work in a new repository that doesn't have backlog:
```bash
cd /path/to/repo
backlog init "Project Name" --integration-mode mcp --defaults
```

This creates the `backlog/` directory structure:
```
backlog/
├── config.yml          # Project configuration
├── tasks/              # Active tasks
├── completed/          # Finished tasks
├── drafts/             # Draft tasks
├── docs/               # Project documentation
├── decisions/          # Architecture decision records
└── archive/            # Archived tasks
```

### Task File Format
Tasks are markdown files with YAML frontmatter:
```yaml
---
id: task-001
title: Feature implementation
status: In Progress
assignee: [@claude]
created_date: '2025-12-03 14:30'
labels: [feature, backend]
priority: high
dependencies: [task-002]
---

## Description
What needs to be done...

## Plan
1. Step one
2. Step two

## Acceptance Criteria
- [ ] Criterion 1
- [x] Criterion 2 (completed)

## Notes
Progress updates go here...
```

### Cross-Project Aggregation (backlog.jeffemmett.com)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                  backlog.jeffemmett.com                     │
│              (Unified Kanban Dashboard)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ canvas-web  │  │ hyperindex  │  │  mycofi     │  ...    │
│  │  (purple)   │  │  (green)    │  │  (blue)     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │    Aggregation API    │                     │
│              │  (polls all projects) │                     │
│              └───────────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Data Sources:
├── Local: /home/jeffe/Github/*/backlog/
└── Remote: ssh netcup "ls /opt/*/backlog/"
```

**Color Coding by Project:**
| Project | Color | Location |
|---------|-------|----------|
| canvas-website | Purple | Local + Netcup |
| hyperindex-system | Green | Local |
| mycofi-earth | Blue | Local + Netcup |
| decolonize-time | Orange | Local + Netcup |
| ai-orchestrator | Red | Netcup |

**Aggregation Service** (to be deployed on Netcup):
- Polls all project `backlog/tasks/` directories
- Serves unified JSON API at `api.backlog.jeffemmett.com`
- Web UI at `backlog.jeffemmett.com` shows combined Kanban
- Real-time updates via WebSocket
- Filter by project, status, priority, assignee

### Agent Behavior Requirements

**When Claude starts working on ANY task:**

1. **Check for existing backlog** in the repo:
   ```bash
   ls backlog/config.yml 2>/dev/null || echo "Backlog not initialized"
   ```

2. **If backlog exists**, search for related tasks:
   ```bash
   backlog search "<relevant keywords>" --plain
   ```

3. **Create or update task** before writing code:
   ```bash
   # If new task needed:
   backlog task create "Task title" --status "In Progress"

   # If task exists:
   backlog task edit <id> --status "In Progress"
   ```

4. **Update task on completion**:
   ```bash
   backlog task edit <id> --status "Done" --append-notes "Implementation complete"
   ```

5. **Never leave tasks in "In Progress"** when stopping work - either complete them or add notes explaining blockers.

### Viewing Tasks

**Terminal Kanban Board:**
```bash
backlog board
```

**Web Interface (single project):**
```bash
backlog browser --port 6420
```

**Unified View (all projects):**
Visit `backlog.jeffemmett.com` (served from Netcup)

### Backlog CLI Quick Reference

#### Task Operations
| Action | Command |
|--------|---------|
| View task | `backlog task 42 --plain` |
| List tasks | `backlog task list --plain` |
| Search tasks | `backlog search "topic" --plain` |
| Filter by status | `backlog task list -s "In Progress" --plain` |
| Create task | `backlog task create "Title" -d "Description" --ac "Criterion 1"` |
| Edit task | `backlog task edit 42 -t "New Title" -s "In Progress"` |
| Assign task | `backlog task edit 42 -a @claude` |

#### Acceptance Criteria Management
| Action | Command |
|--------|---------|
| Add AC | `backlog task edit 42 --ac "New criterion"` |
| Check AC #1 | `backlog task edit 42 --check-ac 1` |
| Check multiple | `backlog task edit 42 --check-ac 1 --check-ac 2` |
| Uncheck AC | `backlog task edit 42 --uncheck-ac 1` |
| Remove AC | `backlog task edit 42 --remove-ac 2` |

#### Multi-line Input (Description/Plan/Notes)
The CLI preserves input literally. Use shell-specific syntax for real newlines:

```bash
# Bash/Zsh (ANSI-C quoting)
backlog task edit 42 --notes $'Line1\nLine2\nLine3'
backlog task edit 42 --plan $'1. Step one\n2. Step two'

# POSIX portable
backlog task edit 42 --notes "$(printf 'Line1\nLine2')"

# Append notes progressively
backlog task edit 42 --append-notes $'- Completed X\n- Working on Y'
```

#### Definition of Done (DoD)
A task is **Done** only when ALL of these are complete:

**Via CLI:**
1. All acceptance criteria checked: `--check-ac <index>` for each
2. Implementation notes added: `--notes "..."` or `--append-notes "..."`
3. Status set to Done: `-s Done`

**Via Code/Testing:**
4. Tests pass (run test suite and linting)
5. Documentation updated if needed
6. Code self-reviewed
7. No regressions

**NEVER mark a task as Done without completing ALL items above.**

### Configuration Reference

---

## 🔧 TROUBLESHOOTING

### tmux "server exited unexpectedly"
This error occurs when a stale socket file exists from a crashed tmux server.

**Fix:**
```bash
rm -f /tmp/tmux-$(id -u)/default
```

Then start a new session normally with `tmux` or `tmux new -s <name>`.

---

Default `backlog/config.yml`:
```yaml
project_name: "Project Name"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
date_format: yyyy-mm-dd
max_column_width: 20
auto_open_browser: true
default_port: 6420
remote_operations: true
auto_commit: true
zero_padded_ids: 3
bypass_git_hooks: false
check_active_branches: true
active_branch_days: 60
```