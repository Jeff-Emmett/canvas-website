# Terminal Tool Feature Specification

## Executive Summary

This specification details the implementation of an interactive tmux terminal interface integrated into the canvas dashboard. Users will be able to connect to their DigitalOcean droplets, manage tmux sessions, and collaborate on terminal sessions directly from the collaborative whiteboard.

---

## 1. Architecture Overview

### 1.1 High-Level Flow

```
User → Canvas UI → TerminalShape (xterm.js)
                        ↓
                  WebSocket
                        ↓
            Cloudflare Worker (SSH Proxy)
                        ↓
                  SSH Connection
                        ↓
            DigitalOcean Droplet → tmux
```

### 1.2 Technology Stack

**Frontend**
- `xterm.js` ^5.3.0 - Terminal emulator
- `xterm-addon-fit` ^0.8.0 - Responsive sizing
- `xterm-addon-web-links` ^0.9.0 - Clickable URLs
- React 18.2.0 (existing)
- TLDraw 3.15.4 (existing)

**Backend**
- `ssh2` ^1.15.0 - SSH client for Cloudflare Worker
- Cloudflare Workers (existing)
- Cloudflare Durable Objects (existing)

**Server**
- DigitalOcean Droplet (existing)
- tmux (user-installed)
- SSH daemon (standard)

---

## 2. Frontend Implementation

### 2.1 TerminalShape Definition

**File**: `src/shapes/TerminalShapeUtil.tsx`

```typescript
export type ITerminalShape = TLBaseShape<"Terminal", {
  w: number                    // width (default: 800)
  h: number                    // height (default: 600)
  sessionId: string            // current tmux session name
  collaborationMode: boolean   // enable shared input (default: false)
  ownerId: string             // shape creator's user ID
  pinnedToView: boolean       // pin to viewport
  tags: string[]              // organization tags
  fontFamily: string          // terminal font (default: "Monaco")
  fontSize: number            // terminal font size (default: 13)
  terminalTheme: "dark" | "light"
}>

export class TerminalShape extends BaseBoxShapeUtil<ITerminalShape> {
  static override type = "Terminal"
  static readonly PRIMARY_COLOR = "#10b981"  // Green

  getDefaultProps(): ITerminalShape["props"] {
    return {
      w: 800,
      h: 600,
      sessionId: "",
      collaborationMode: false,
      ownerId: "",
      pinnedToView: false,
      tags: ['terminal'],
      fontFamily: "Monaco, Menlo, 'Courier New', monospace",
      fontSize: 13,
      terminalTheme: "dark"
    }
  }

  component(shape: ITerminalShape) {
    // Uses StandardizedToolWrapper pattern
    // Renders TerminalContent component
  }
}
```

### 2.2 TerminalTool

**File**: `src/tools/TerminalTool.ts`

```typescript
export class TerminalTool extends BaseBoxShapeTool {
  static override id = "Terminal"
  shapeType = "Terminal"

  // Creates terminal shape when user drags on canvas
}
```

### 2.3 TerminalContent Component

**File**: `src/components/TerminalContent.tsx`

**Features**:
- xterm.js instance management
- WebSocket connection to backend
- Session browser UI (when no session selected)
- Collaboration mode toggle
- Input handling (keyboard, paste)
- Auto-resize on shape dimension changes

**States**:
1. **Loading**: Connecting to backend
2. **Session Browser**: List available tmux sessions
3. **Connected**: Active terminal session
4. **Error**: Connection failed or SSH error

**UI Layout**:
```
┌──────────────────────────────────────┐
│ Terminal (header from StandardizedToolWrapper)
├──────────────────────────────────────┤
│ [Session Browser Mode]               │
│                                      │
│ Available tmux sessions:             │
│ ┌──────────────────────────────┐    │
│ │ ○ session-1    [Attach]      │    │
│ │ ○ canvas-main  [Attach]      │    │
│ └──────────────────────────────┘    │
│                                      │
│ [+ Create New Session]               │
│                                      │
│ [OR: Terminal Output when connected] │
│                                      │
└──────────────────────────────────────┘
│ [🔒 Read-only] [👥 Collaboration: Off]│
└──────────────────────────────────────┘
```

### 2.4 SessionBrowser Component

**File**: `src/components/SessionBrowser.tsx`

**Features**:
- Fetch list of tmux sessions from backend
- Display session metadata (name, windows, creation time)
- "Attach" button per session
- "Create New Session" button with name input
- Refresh button for session list

**Props**:
```typescript
interface SessionBrowserProps {
  onSelectSession: (sessionId: string) => void
  onCreateSession: (sessionName: string) => void
}
```

---

## 3. Backend Implementation

### 3.1 SSH Proxy Architecture

**File**: `worker/TerminalProxy.ts`

**Responsibilities**:
- Establish SSH connections to DigitalOcean droplet
- Pool SSH connections per user (reuse across terminals)
- Execute tmux commands over SSH
- Stream terminal I/O via WebSocket
- Handle SSH authentication (private key)

**Key Methods**:
```typescript
class TerminalProxy {
  // Connection management
  async connect(config: SSHConfig): Promise<SSHConnection>
  async disconnect(connectionId: string): Promise<void>

  // tmux operations
  async listSessions(): Promise<TmuxSession[]>
  async createSession(name: string): Promise<string>
  async attachSession(sessionId: string): Promise<void>
  async sendInput(sessionId: string, data: string): Promise<void>

  // Stream management
  async streamOutput(sessionId: string): AsyncIterator<Buffer>
  async resize(sessionId: string, cols: number, rows: number): Promise<void>
}
```

### 3.2 Worker Routes

**Extend**: `worker/AutomergeDurableObject.ts`

**New Routes**:
```typescript
// WebSocket upgrade for terminal I/O
GET /terminal/ws/:sessionId

// tmux session management
GET /terminal/sessions          // List all tmux sessions
POST /terminal/sessions         // Create new session
GET /terminal/sessions/:id      // Get session details
DELETE /terminal/sessions/:id   // Kill session

// Terminal I/O (used by WebSocket)
POST /terminal/:sessionId/input    // Send input
POST /terminal/:sessionId/resize   // Resize terminal
```

### 3.3 WebSocket Protocol

**Message Types (Client → Server)**:
```typescript
// Initialize terminal connection
{
  type: "init",
  sessionId: string,
  cols: number,
  rows: number
}

// Send user input
{
  type: "input",
  data: string  // keyboard input, paste, etc.
}

// Resize terminal
{
  type: "resize",
  cols: number,
  rows: number
}

// List tmux sessions (for browser)
{
  type: "list_sessions"
}

// Create new tmux session
{
  type: "create_session",
  name: string
}

// Detach from current session
{
  type: "detach"
}
```

**Message Types (Server → Client)**:
```typescript
// Terminal output (binary)
{
  type: "output",
  data: Uint8Array  // raw terminal output
}

// Session list response
{
  type: "sessions",
  sessions: [
    {
      name: string,
      windows: number,
      created: string,
      attached: boolean
    }
  ]
}

// Error messages
{
  type: "error",
  message: string
}

// Status updates
{
  type: "status",
  status: "connected" | "disconnected" | "attached"
}
```

---

## 4. Configuration System

### 4.1 Config File Structure

**File**: `terminal-config.json` (gitignored)
**Example**: `terminal-config.example.json` (committed)

```json
{
  "version": "1.0",
  "default_connection": "primary",
  "connections": {
    "primary": {
      "name": "Primary Droplet",
      "host": "165.227.xxx.xxx",
      "port": 22,
      "user": "root",
      "auth": {
        "type": "privateKey",
        "keyPath": "~/.ssh/id_ed25519"
      },
      "tmux": {
        "default_session": "canvas-main",
        "socket_name": null
      }
    },
    "staging": {
      "name": "Staging Droplet",
      "host": "192.168.xxx.xxx",
      "port": 22,
      "user": "deploy",
      "auth": {
        "type": "privateKey",
        "keyPath": "~/.ssh/staging_key"
      }
    }
  },
  "terminal": {
    "default_font_family": "Monaco, Menlo, monospace",
    "default_font_size": 13,
    "default_theme": "dark",
    "themes": {
      "dark": {
        "background": "#1e1e1e",
        "foreground": "#d4d4d4",
        "cursor": "#ffffff",
        "selection": "#264f78"
      },
      "light": {
        "background": "#ffffff",
        "foreground": "#333333",
        "cursor": "#000000",
        "selection": "#add6ff"
      }
    }
  },
  "security": {
    "allowed_users": [],
    "read_only_default": true,
    "collaboration_requires_permission": true
  }
}
```

### 4.2 Config Loading

**File**: `src/config/terminalConfig.ts`

```typescript
export async function loadTerminalConfig(): Promise<TerminalConfig> {
  // Load from local file or environment variables
  // Validate schema
  // Return parsed config
}

export function getDefaultConnection(): ConnectionConfig {
  // Return default connection from config
}
```

### 4.3 Environment Variables (Alternative)

For production deployment:
```bash
TERMINAL_SSH_HOST=165.227.xxx.xxx
TERMINAL_SSH_PORT=22
TERMINAL_SSH_USER=root
TERMINAL_SSH_KEY_PATH=/path/to/private_key
TERMINAL_DEFAULT_SESSION=canvas-main
```

---

## 5. Multiplayer & Collaboration

### 5.1 Permission Model

**Owner (Shape Creator)**:
- Full control: input, resize, session switching
- Can toggle collaboration mode
- Can close terminal

**Viewer (Other Users)**:
- **Read-only mode** (default):
  - See terminal output
  - Cannot send input
  - Cannot resize or change session

- **Collaboration mode** (enabled by owner):
  - Can send input to terminal
  - Shared cursor visibility (optional)
  - Input from any user broadcasts to all viewers

### 5.2 State Synchronization

**Via Automerge** (shape metadata):
- Position, size, pinned status
- Current session ID
- Collaboration mode flag
- Owner ID

**Via WebSocket** (terminal output):
- Terminal output streams to all connected clients
- Input messages sent to backend, broadcast to collaborators
- Not persisted (ephemeral)

### 5.3 Collaboration UI

**Indicators**:
- Collaboration mode toggle (owner only)
- User count badge (e.g., "3 viewers")
- Input lock icon when read-only
- Color-coded user cursors (when collaboration enabled)

**Implementation**:
```typescript
// In TerminalContent component
const isOwner = shape.props.ownerId === currentUserId
const canInput = isOwner || shape.props.collaborationMode

// Disable input handling if read-only
term.onData((data) => {
  if (!canInput) {
    showNotification("Terminal is read-only. Owner must enable collaboration.")
    return
  }
  ws.send(JSON.stringify({ type: 'input', data }))
})
```

---

## 6. Security Considerations

### 6.1 SSH Key Management

**Storage**:
- SSH private keys stored in secure location (not in repo)
- Path reference in config file
- Worker reads key from environment or secure storage

**Best Practices**:
- Use dedicated SSH keys for canvas terminal (not personal keys)
- Restrict key permissions on droplet (`authorized_keys`)
- Consider using SSH certificates with short TTLs
- Rotate keys periodically

### 6.2 User Authentication

**Requirements**:
- Users must be authenticated to canvas dashboard (existing auth)
- Terminal access tied to user session
- Worker validates user token before SSH connection

**Implementation**:
```typescript
// In worker route handler
const userId = await validateUserToken(request.headers.get('Authorization'))
if (!userId) {
  return new Response('Unauthorized', { status: 401 })
}
```

### 6.3 Command Restrictions

**Considerations**:
- Terminal gives full shell access to droplet
- No command filtering by default (tmux limitation)
- Rely on droplet-level user permissions

**Recommendations**:
- Create dedicated `canvas-terminal` user on droplet
- Use sudo for privileged operations
- Consider shell restrictions (rbash, restricted commands)

### 6.4 Rate Limiting

**Protection**:
- Limit SSH connections per user
- Throttle WebSocket message rate
- Connection timeout after inactivity

**Implementation**:
```typescript
// In Durable Object
private readonly MAX_CONNECTIONS_PER_USER = 5
private readonly MESSAGE_RATE_LIMIT = 1000  // messages per minute
private readonly IDLE_TIMEOUT = 30 * 60 * 1000  // 30 minutes
```

---

## 7. Error Handling

### 7.1 Connection Failures

**Scenarios**:
- SSH connection refused
- Authentication failed
- Network timeout
- Droplet unreachable

**UI Response**:
```
┌────────────────────────────────┐
│ Terminal                       │
├────────────────────────────────┤
│                                │
│  ⚠️ Connection Failed          │
│                                │
│  Could not connect to droplet  │
│  165.227.xxx.xxx               │
│                                │
│  Error: Connection timeout     │
│                                │
│  [Retry]  [Check Config]       │
│                                │
└────────────────────────────────┘
```

### 7.2 Session Errors

**Scenarios**:
- tmux session not found
- Session killed externally
- Permission denied

**Handling**:
- Return to session browser
- Show error notification
- Auto-refresh session list

### 7.3 WebSocket Disconnection

**Reconnection Strategy**:
1. Detect disconnect (onclose event)
2. Show "Reconnecting..." overlay
3. Exponential backoff retry (1s, 2s, 4s, 8s, 16s)
4. Max 5 attempts
5. Show error if all attempts fail

**Implementation**:
```typescript
private reconnect(attempt: number = 0) {
  if (attempt >= 5) {
    this.showError("Connection lost. Please refresh.")
    return
  }

  const delay = Math.min(1000 * Math.pow(2, attempt), 16000)
  setTimeout(() => {
    this.connect()
  }, delay)
}
```

---

## 8. UI/UX Details

### 8.1 Terminal Appearance

**Default Theme (Dark)**:
```css
.terminal-container {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: Monaco, Menlo, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  padding: 8px;
}
```

**xterm.js Configuration**:
```typescript
const term = new Terminal({
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selection: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5'
  },
  fontFamily: "Monaco, Menlo, 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 1.4,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  tabStopWidth: 4
})
```

### 8.2 Toolbar Button

**Location**: `src/ui/CustomToolbar.tsx`

**Button Config**:
```typescript
<ToolbarButton
  icon="terminal"  // or custom SVG icon
  label="Terminal"
  onClick={() => setActiveTool('Terminal')}
  isActive={activeTool === 'Terminal'}
  tooltip="Create terminal window (Ctrl+`)"
/>
```

**Icon** (SVG):
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
  <path d="M6 8L10 12L6 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="12" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
```

### 8.3 Keyboard Shortcuts

**Global**:
- `Ctrl/Cmd + `` - Create new terminal
- `Ctrl/Cmd + Shift + T` - Focus terminal (if exists)

**Within Terminal**:
- `Ctrl + C` - Send SIGINT (normal terminal behavior)
- `Ctrl + D` - Send EOF / exit shell
- `Ctrl + L` - Clear screen
- `Ctrl + Shift + C` - Copy selection
- `Ctrl + Shift + V` - Paste

**Shape Controls**:
- `Escape` - Deselect terminal
- `Delete` - Close terminal (prompt for confirmation)

### 8.4 Context Menu

**Right-click on Terminal Shape**:
```
┌───────────────────────────┐
│ Copy                      │
│ Paste                     │
├───────────────────────────┤
│ Clear Terminal            │
│ Reset Terminal            │
├───────────────────────────┤
│ Switch Session...         │
│ Detach from Session       │
├───────────────────────────┤
│ Toggle Collaboration Mode │
│ Pin to View               │
├───────────────────────────┤
│ Settings                  │
│ Close                     │
└───────────────────────────┘
```

---

## 9. Performance Optimizations

### 9.1 Connection Pooling

**Strategy**:
- Maintain persistent SSH connections per user
- Reuse connections across terminal shapes
- Close connections after idle timeout (30 min)

**Benefits**:
- Faster terminal creation (no SSH handshake delay)
- Reduced load on droplet
- Better resource utilization

### 9.2 Output Buffering

**Implementation**:
- Buffer terminal output on backend
- Send batched updates every 16ms (60 FPS)
- Avoid overwhelming WebSocket with rapid output

```typescript
// In TerminalProxy
private outputBuffer: Buffer[] = []
private flushInterval: NodeJS.Timer

constructor() {
  this.flushInterval = setInterval(() => {
    if (this.outputBuffer.length > 0) {
      const combined = Buffer.concat(this.outputBuffer)
      this.ws.send(combined)
      this.outputBuffer = []
    }
  }, 16)  // 60 FPS
}
```

### 9.3 Lazy Loading

**Strategy**:
- Load xterm.js dynamically when first terminal created
- Preload terminal config on dashboard load
- Cache session list with 5-second TTL

### 9.4 Viewport Optimization

**When Minimized**:
- Pause xterm.js rendering
- Buffer output in memory
- Resume rendering when expanded

**When Off-screen**:
- Reduce render rate to 10 FPS
- Full rate when terminal visible

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Components**:
- `TerminalShape.test.tsx` - Shape creation, props
- `SessionBrowser.test.tsx` - Session list rendering
- `TerminalContent.test.tsx` - xterm.js integration
- `TerminalProxy.test.ts` - SSH connection logic

**Coverage Goals**:
- Core functionality: 90%+
- Edge cases: 80%+
- Error handling: 100%

### 10.2 Integration Tests

**Scenarios**:
1. Create terminal → Session browser appears
2. Select session → Terminal connects and displays output
3. Send input → Appears in terminal
4. Resize shape → Terminal resizes
5. Close terminal → SSH connection cleaned up
6. Multiplayer: Owner enables collaboration → Viewer can send input

### 10.3 Manual Testing Checklist

- [ ] SSH connection to droplet succeeds
- [ ] Session browser lists tmux sessions
- [ ] Can attach to existing session
- [ ] Can create new session with custom name
- [ ] Terminal displays output correctly (colors, formatting)
- [ ] Keyboard input works (typing, special keys)
- [ ] Copy/paste works
- [ ] Resize terminal updates dimensions
- [ ] Minimize/expand preserves state
- [ ] Pin to view works during pan/zoom
- [ ] Collaboration mode toggle works
- [ ] Read-only mode blocks input
- [ ] WebSocket reconnects after disconnect
- [ ] Multiple terminals can be open simultaneously
- [ ] Terminal state syncs across multiplayer clients
- [ ] SSH connection pools work (reuse connections)
- [ ] Error messages display correctly
- [ ] Config file loads properly
- [ ] Toolbar button creates terminal

---

## 11. Deployment Guide

### 11.1 Prerequisites

**Droplet Setup**:
```bash
# On DigitalOcean droplet
apt update && apt install tmux

# Create dedicated user (optional)
adduser canvas-terminal
usermod -aG sudo canvas-terminal

# Add SSH public key to authorized_keys
mkdir -p /home/canvas-terminal/.ssh
echo "ssh-ed25519 AAAA..." >> /home/canvas-terminal/.ssh/authorized_keys
chmod 700 /home/canvas-terminal/.ssh
chmod 600 /home/canvas-terminal/.ssh/authorized_keys
```

**Local Setup**:
```bash
# Generate SSH key pair (if needed)
ssh-keygen -t ed25519 -f ~/.ssh/canvas_terminal -C "canvas-terminal"

# Copy terminal-config.example.json to terminal-config.json
cp terminal-config.example.json terminal-config.json

# Edit config with your droplet details
nano terminal-config.json
```

### 11.2 Installation

```bash
# Install dependencies
npm install xterm xterm-addon-fit xterm-addon-web-links ssh2

# Build project
npm run build

# Deploy worker
npm run deploy
```

### 11.3 Configuration

**Update `terminal-config.json`**:
```json
{
  "connections": {
    "primary": {
      "host": "YOUR_DROPLET_IP",
      "user": "canvas-terminal",
      "auth": {
        "keyPath": "~/.ssh/canvas_terminal"
      }
    }
  }
}
```

**Environment Variables** (for Cloudflare Worker):
```bash
# Set via Cloudflare dashboard or CLI
wrangler secret put TERMINAL_SSH_KEY < ~/.ssh/canvas_terminal
wrangler secret put TERMINAL_SSH_HOST
wrangler secret put TERMINAL_SSH_USER
```

### 11.4 Verification

**Test Checklist**:
1. SSH to droplet manually: `ssh -i ~/.ssh/canvas_terminal canvas-terminal@YOUR_IP`
2. Start tmux: `tmux new-session -d -s test`
3. Open canvas dashboard
4. Create terminal shape
5. Verify session browser shows "test" session
6. Attach to session
7. Type commands and verify output

---

## 12. Future Enhancements

### 12.1 Phase 2 Features

**Terminal History**:
- Save terminal session snapshots
- Replay terminal sessions
- Export terminal output

**Custom Themes**:
- Theme builder UI
- Import/export themes
- Community theme gallery

**Split Panes**:
- tmux pane support in UI
- Visual pane management
- Keyboard shortcuts for splits

### 12.2 Phase 3 Features

**File Transfer**:
- Drag-and-drop file upload to droplet
- Download files from terminal
- Integration with FileSystemContext

**Command Palette**:
- Quick command execution
- Command history search
- Saved command snippets

**Terminal Templates**:
- Predefined terminal layouts
- Auto-run commands on session start
- Environment variable presets

### 12.3 Advanced Features

**AI Integration**:
- Command suggestions
- Error explanation
- Code generation in terminal

**Monitoring**:
- Resource usage graphs (CPU, memory)
- Network traffic visualization
- Log tailing with filtering

**Team Features**:
- Shared tmux sessions per project
- Session recording for training
- Permission groups (read/write/admin)

---

## 13. Maintenance & Support

### 13.1 Monitoring

**Metrics to Track**:
- SSH connection success rate
- WebSocket disconnect frequency
- Average terminal response time
- Active terminal count
- Error rate by type

**Logging**:
- SSH connection events
- Session creation/destruction
- WebSocket errors
- Input/output volume

### 13.2 Known Limitations

1. **Cloudflare Worker Timeout**: Workers have 30-second CPU time limit
   - Mitigation: Use Durable Objects for persistent connections

2. **SSH Key Storage**: Securely storing private keys in Worker
   - Mitigation: Use Cloudflare Secrets or external key management

3. **Terminal Output Size**: Large output can overwhelm WebSocket
   - Mitigation: Output buffering and rate limiting

4. **tmux Version**: Feature compatibility depends on tmux version
   - Requirement: tmux 2.0+ recommended

### 13.3 Troubleshooting

**Common Issues**:

**"Connection timeout"**:
- Check droplet firewall (allow port 22)
- Verify SSH daemon running: `systemctl status sshd`
- Test SSH manually from local machine

**"Authentication failed"**:
- Verify SSH key permissions (600 for private key)
- Check authorized_keys on droplet
- Confirm username matches config

**"No tmux sessions found"**:
- Create test session: `tmux new-session -d -s test`
- Check tmux socket: `ls /tmp/tmux-*`
- Verify user has tmux installed

**"Terminal output garbled"**:
- Check terminal encoding (UTF-8)
- Verify TERM environment variable: `echo $TERM`
- Reset terminal: `Ctrl+C` then `reset`

---

## 14. Documentation Files

### 14.1 Files to Create

1. **TERMINAL_SPEC.md** (this document)
2. **terminal-config.example.json** - Example configuration
3. **README_TERMINAL.md** - User-facing documentation
4. **TERMINAL_SETUP.md** - Deployment guide
5. **API.md** - Backend API documentation

### 14.2 Code Comments

**Required Comments**:
- Function/class JSDoc comments
- Complex algorithm explanations
- Security considerations
- Performance optimization notes

---

## 15. Acceptance Criteria

### 15.1 Functional Requirements

- [x] Users can create terminal shapes on canvas
- [x] Terminal displays session browser when no session selected
- [x] Users can attach to existing tmux sessions
- [x] Users can create new tmux sessions with custom names
- [x] Terminal renders output with correct colors and formatting
- [x] Users can send input to terminal (keyboard, paste)
- [x] Terminal resizes correctly when shape dimensions change
- [x] Read-only mode prevents non-owners from sending input
- [x] Collaboration mode allows multiple users to send input
- [x] Terminal reconnects automatically after disconnect
- [x] SSH connections are pooled and reused
- [x] Config file system works for droplet credentials
- [x] Toolbar button creates new terminal

### 15.2 Non-Functional Requirements

- [ ] Terminal response time < 100ms (local network)
- [ ] WebSocket reconnection < 5 seconds
- [ ] SSH connection pool reduces latency by 50%+
- [ ] Terminal handles 10+ simultaneous users
- [ ] No memory leaks after 1 hour of usage
- [ ] Code coverage > 80%
- [ ] Documentation complete and accurate

### 15.3 Security Requirements

- [ ] SSH private keys not exposed in client code
- [ ] User authentication validated on every request
- [ ] Rate limiting prevents abuse
- [ ] Collaboration mode requires owner permission
- [ ] SSH connections closed after idle timeout
- [ ] No command injection vulnerabilities

---

## 16. Timeline Estimate

**Phase 1: Foundation** (3-4 days)
- Day 1: Dependencies, config system, TerminalShape/Tool
- Day 2: TerminalContent component, xterm.js integration
- Day 3: SessionBrowser component, UI polish
- Day 4: Testing, bug fixes

**Phase 2: Backend** (3-4 days)
- Day 1: SSH proxy setup, connection pooling
- Day 2: Worker routes, WebSocket protocol
- Day 3: tmux integration, session management
- Day 4: Testing, error handling

**Phase 3: Integration** (2-3 days)
- Day 1: Register shape/tool, toolbar button
- Day 2: Multiplayer, collaboration mode
- Day 3: Testing, documentation

**Phase 4: Polish** (2-3 days)
- Day 1: Performance optimization
- Day 2: Error handling, edge cases
- Day 3: Final testing, deployment

**Total: 10-14 days** (2-3 weeks)

---

## 17. Success Metrics

**Adoption**:
- 50% of active users create at least one terminal
- Average 2-3 terminals per canvas
- 80% session success rate (no connection errors)

**Performance**:
- < 100ms terminal response time
- < 5% WebSocket disconnect rate
- > 95% SSH connection success rate

**Engagement**:
- Average 10+ minutes per terminal session
- 30% of terminals use collaboration mode
- 5+ commands per terminal session

---

## 18. Risks & Mitigations

### 18.1 Technical Risks

**Risk**: Cloudflare Worker CPU timeout
- **Mitigation**: Use Durable Objects for long-running connections

**Risk**: SSH connection overhead
- **Mitigation**: Connection pooling, keep-alive

**Risk**: WebSocket scalability
- **Mitigation**: Load testing, rate limiting

### 18.2 Security Risks

**Risk**: SSH key compromise
- **Mitigation**: Use dedicated keys, rotate regularly, monitor access

**Risk**: Unauthorized terminal access
- **Mitigation**: User authentication, permission checks

**Risk**: Command injection
- **Mitigation**: Input sanitization, no shell interpolation

### 18.3 UX Risks

**Risk**: Confusing session browser
- **Mitigation**: Clear UI, tooltips, onboarding

**Risk**: Collaboration conflicts (multiple users typing)
- **Mitigation**: Input queueing, visual feedback, cursor indicators

**Risk**: Terminal performance degradation
- **Mitigation**: Output buffering, viewport optimization

---

## 19. Appendix

### 19.1 tmux Commands Reference

```bash
# List sessions
tmux ls

# Create new session
tmux new-session -s session_name

# Attach to session
tmux attach -t session_name

# Detach from session
tmux detach

# Kill session
tmux kill-session -t session_name

# Resize pane
tmux resize-pane -x 100 -y 30

# Capture pane output
tmux capture-pane -t session_name:window.pane -p
```

### 19.2 SSH Connection Example

```typescript
import { Client } from 'ssh2'

const conn = new Client()
conn.on('ready', () => {
  console.log('SSH connected')

  conn.exec('tmux ls', (err, stream) => {
    if (err) throw err

    stream.on('data', (data: Buffer) => {
      console.log('Sessions:', data.toString())
    })
  })
})

conn.connect({
  host: '165.227.xxx.xxx',
  port: 22,
  username: 'canvas-terminal',
  privateKey: fs.readFileSync('/path/to/private_key')
})
```

### 19.3 xterm.js Integration Example

```typescript
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

const term = new Terminal()
const fitAddon = new FitAddon()

term.loadAddon(fitAddon)
term.open(document.getElementById('terminal'))
fitAddon.fit()

// Connect to WebSocket
const ws = new WebSocket('wss://worker.url/terminal/ws/session-123')

ws.onmessage = (event) => {
  term.write(event.data)
}

term.onData((data) => {
  ws.send(JSON.stringify({ type: 'input', data }))
})
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-19 | Initial | Complete specification document |

---

## Contact & Support

For questions or issues with the terminal feature:
- GitHub Issues: https://github.com/yourusername/canvas-website/issues
- Documentation: /docs/terminal-tool.md
- Slack: #canvas-terminal

---

**End of Specification**
