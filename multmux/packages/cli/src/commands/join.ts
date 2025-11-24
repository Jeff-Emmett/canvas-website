import chalk from 'chalk';
import ora from 'ora';
import { WebSocketClient } from '../connection/WebSocketClient';
import { TerminalUI } from '../ui/Terminal';

export async function joinSession(
  token: string,
  options: { server?: string }
): Promise<void> {
  const serverUrl = options.server || 'ws://localhost:3001';
  const spinner = ora('Connecting to session...').start();

  try {
    const client = new WebSocketClient(serverUrl, token);

    // Wait for connection
    await client.connect();
    spinner.succeed('Connected!');

    // Wait a moment for the 'joined' event
    await new Promise((resolve) => {
      client.once('joined', resolve);
      setTimeout(resolve, 1000); // Fallback timeout
    });

    console.log(chalk.green('\nJoined session! Press ESC or Ctrl-C to exit.\n'));

    // Create terminal UI
    const ui = new TerminalUI(client);

    // Handle errors
    client.on('error', (error: Error) => {
      console.error(chalk.red('\nConnection error:'), error.message);
    });

    client.on('reconnect-failed', () => {
      console.error(chalk.red('\nFailed to reconnect. Exiting...'));
      process.exit(1);
    });
  } catch (error) {
    spinner.fail('Failed to connect');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
