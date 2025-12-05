#!/usr/bin/env node

import { Command } from 'commander';
import { createSession } from './commands/create';
import { joinSession } from './commands/join';
import { listSessions } from './commands/list';

const program = new Command();

program
  .name('multmux')
  .description('Collaborative terminal tool with tmux backend')
  .version('0.1.0');

program
  .command('create <name>')
  .description('Create a new collaborative session')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000')
  .option('-r, --repo <path>', 'Repository path to use')
  .action(createSession);

program
  .command('join <token>')
  .description('Join an existing session with a token')
  .option('-s, --server <url>', 'WebSocket server URL', 'ws://localhost:3001')
  .action(joinSession);

program
  .command('list')
  .description('List active sessions')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000')
  .action(listSessions);

program.parse();
