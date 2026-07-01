#!/usr/bin/env node
/**
 * scripts/youtube-upload.js — Standalone YouTube uploader.
 *
 * Usage:
 *   spilbergian youtube:upload <video.mp4> --title "..." --description "..." --thumbnail thumb.png
 *   spilbergian youtube:auth        # First-time OAuth flow
 *   spilbergian youtube:list        # List recent uploads
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { YouTubeUploader } from '../src/index.js';

const program = new Command();
program
  .name('spilbergian-youtube')
  .description('YouTube uploader for Spilbergian')
  .version('3.0.0');

program
  .command('upload <file>')
  .description('Upload a video to YouTube')
  .option('-t, --title <title>')
  .option('-d, --description <desc>')
  .option('--privacy <privacy>', 'private | unlisted | public', 'private')
  .option('--thumbnail <path>')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (file, opts) => {
    const uploader = new YouTubeUploader();
    await uploader.init();
    const spin = ora('Uploading to YouTube...').start();
    uploader.on('youtube:upload_progress', ({ pct }) => {
      spin.text = chalk.yellow(`Uploading... ${pct.toFixed(1)}%`);
    });
    try {
      const res = await uploader.upload(file, {
        title: opts.title,
        description: opts.description,
        privacy: opts.privacy,
        thumbnail: opts.thumbnail,
        tags: opts.tags ? opts.tags.split(',').map(s => s.trim()) : undefined,
      });
      spin.succeed(chalk.green('Uploaded: ' + res.url));
    } catch (err) {
      spin.fail(chalk.red('Upload failed: ' + err.message));
      process.exit(1);
    }
  });

program
  .command('auth')
  .description('Run OAuth consent flow')
  .action(async () => {
    const uploader = new YouTubeUploader();
    await uploader.init();
    console.log(chalk.cyan('Starting OAuth flow...'));
    await uploader._ensureAuth();
    console.log(chalk.green('Authorized! Token saved.'));
  });

program
  .command('list')
  .description('List recent uploads')
  .action(async () => {
    const uploader = new YouTubeUploader();
    await uploader.init();
    const vids = await uploader.listRecent(10);
    if (!vids.length) {
      console.log(chalk.gray('No uploads found (or uploader not authenticated).'));
      return;
    }
    console.log(chalk.cyan('\nRecent uploads:'));
    for (const v of vids) {
      console.log(chalk.white(`  • ${v.title}  —  ${v.url}  —  ${v.publishedAt}`));
    }
  });

program.parseAsync(process.argv);
