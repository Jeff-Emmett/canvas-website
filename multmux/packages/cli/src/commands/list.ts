import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';

export async function listSessions(options: { server?: string }): Promise<void> {
  const serverUrl = options.server || 'http://localhost:3000';
  const spinner = ora('Fetching sessions...').start();

  try {
    const response = await fetch(`${serverUrl}/api/sessions`);

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }

    const data: any = await response.json();
    spinner.stop();

    if (data.sessions.length === 0) {
      console.log(chalk.yellow('No active sessions found.'));
      return;
    }

    console.log(chalk.bold(`\nActive Sessions (${data.sessions.length}):\n`));

    data.sessions.forEach((session: any) => {
      console.log(chalk.cyan(`  ${session.name}`));
      console.log(`    ID:      ${chalk.gray(session.id)}`);
      console.log(`    Clients: ${session.activeClients}`);
      console.log(`    Created: ${new Date(session.createdAt).toLocaleString()}`);
      console.log('');
    });
  } catch (error) {
    spinner.fail('Failed to fetch sessions');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
