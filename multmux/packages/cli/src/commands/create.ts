import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';

export async function createSession(
  name: string,
  options: { server?: string; repo?: string }
): Promise<void> {
  const serverUrl = options.server || 'http://localhost:3000';
  const spinner = ora('Creating session...').start();

  try {
    const response = await fetch(`${serverUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        repoPath: options.repo,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data: any = await response.json();

    spinner.succeed('Session created!');

    console.log('');
    console.log(chalk.bold('Session Details:'));
    console.log(`  Name:       ${chalk.cyan(data.session.name)}`);
    console.log(`  ID:         ${chalk.gray(data.session.id)}`);
    console.log(`  Created:    ${new Date(data.session.createdAt).toLocaleString()}`);
    console.log('');
    console.log(chalk.bold('To join this session:'));
    console.log(chalk.green(`  ${data.inviteUrl}`));
    console.log('');
    console.log(chalk.bold('Or share this token:'));
    console.log(`  ${chalk.yellow(data.token)}`);
    console.log('');
    console.log(chalk.dim('Token expires in 60 minutes'));
  } catch (error) {
    spinner.fail('Failed to create session');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
