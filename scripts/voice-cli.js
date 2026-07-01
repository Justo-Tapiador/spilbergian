#!/usr/bin/env node
/**
 * scripts/voice-cli.js — Standalone voice command loop for Spilbergian.
 *
 * Usage:
 *   spilbergian voice
 *   spilbergian voice --mode continuous
 *
 * Listens for utterances via Whisper and routes them through the
 * VoiceCommandRouter. This is the alternative to typing commands.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SpilbergianDirector } from '../src/index.js';

const program = new Command();
program
  .name('spilbergian-voice')
  .description('Voice command loop for Spilbergian')
  .version('3.0.0')
  .option('-m, --mode <mode>', 'continuous | wake_word | push_to_talk', 'wake_word')
  .parse(process.argv);

const opts = program.opts();

console.log(chalk.magenta.bold('\n+-- Spilbergian Voice Interface'));
console.log(chalk.gray('|  Listening via Whisper. Say "Spilbergian, ..." to command.'));
console.log(chalk.gray('|  Say "Spilbergian, para" to exit.\n'));

const director = new SpilbergianDirector({ voice: { commandMode: opts.mode } });

director.on('voice:transcript', (t) => {
  console.log(chalk.gray(`  [heard] "${t}"`));
});
director.on('voice:command', (c) => {
  console.log(chalk.magenta(`  [cmd] ${c.intent} ${JSON.stringify({ ...c, raw: undefined })}`));
});
director.on('project:complete', (p) => {
  console.log(chalk.green(`  [done] ${p.name} → ${p.result?.finalVideo}`));
});
director.on('project:error', ({ error }) => {
  console.error(chalk.red(`  [error] ${error.message || error}`));
});

await director.init();
await director.startVoiceMode();

// Keep process alive
process.on('SIGINT', async () => {
  console.log(chalk.gray('\n  Stopping...'));
  await director.stopVoiceMode();
  await director.shutdown();
  process.exit(0);
});
