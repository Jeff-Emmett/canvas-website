import blessed from 'blessed';
import { WebSocketClient } from '../connection/WebSocketClient';

export class TerminalUI {
  private screen: blessed.Widgets.Screen;
  private terminal: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private buffer: string = '';

  constructor(private client: WebSocketClient) {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'mulTmux',
    });

    // Status bar
    this.statusBar = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        fg: 'white',
        bg: 'blue',
      },
      content: ' mulTmux - Connecting...',
    });

    // Terminal output
    this.terminal = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        style: {
          bg: 'blue',
        },
      },
      keys: true,
      vi: true,
      mouse: true,
      content: '',
    });

    this.screen.append(this.statusBar);
    this.screen.append(this.terminal);

    // Focus terminal
    this.terminal.focus();

    // Setup event handlers
    this.setupEventHandlers();

    // Render
    this.screen.render();
  }

  private setupEventHandlers(): void {
    // Handle terminal output from server
    this.client.on('output', (data: string) => {
      this.buffer += data;
      this.terminal.setContent(this.buffer);
      this.terminal.setScrollPerc(100);
      this.screen.render();
    });

    // Handle connection events
    this.client.on('connected', () => {
      this.updateStatus('Connected', 'green');
    });

    this.client.on('joined', (info: any) => {
      this.updateStatus(`Session: ${info.sessionName} (${info.clientId.slice(0, 8)})`, 'green');
    });

    this.client.on('disconnected', () => {
      this.updateStatus('Disconnected', 'red');
    });

    this.client.on('reconnecting', (attempt: number) => {
      this.updateStatus(`Reconnecting (${attempt}/5)...`, 'yellow');
    });

    this.client.on('presence', (data: any) => {
      if (data.action === 'join') {
        this.showNotification(`User joined (${data.totalClients} online)`);
      } else if (data.action === 'leave') {
        this.showNotification(`User left (${data.totalClients} online)`);
      }
    });

    // Handle keyboard input
    this.screen.on('keypress', (ch: string, key: any) => {
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        this.close();
        return;
      }

      // Send input to server
      if (ch) {
        this.client.sendInput(ch);
      } else if (key.name) {
        // Handle special keys
        const specialKeys: { [key: string]: string } = {
          enter: '\r',
          backspace: '\x7f',
          tab: '\t',
          up: '\x1b[A',
          down: '\x1b[B',
          right: '\x1b[C',
          left: '\x1b[D',
        };

        if (specialKeys[key.name]) {
          this.client.sendInput(specialKeys[key.name]);
        }
      }
    });

    // Handle resize
    this.screen.on('resize', () => {
      const { width, height } = this.terminal;
      this.client.resize(width as number, (height as number) - 1);
    });

    // Quit on Ctrl-C
    this.screen.key(['C-c'], () => {
      this.close();
    });
  }

  private updateStatus(text: string, color: string = 'blue'): void {
    this.statusBar.style.bg = color;
    this.statusBar.setContent(` mulTmux - ${text}`);
    this.screen.render();
  }

  private showNotification(text: string): void {
    // Append notification to buffer
    this.buffer += `\n[mulTmux] ${text}\n`;
    this.terminal.setContent(this.buffer);
    this.screen.render();
  }

  close(): void {
    this.client.disconnect();
    this.screen.destroy();
    process.exit(0);
  }
}
