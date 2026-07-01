#!/usr/bin/env node
/**
 * scripts/make-movie.js — Quick "make me a movie" entrypoint.
 *
 * Usage:
 *   node scripts/make-movie.js "A lonely lighthouse keeper finds a mermaid"
 *   node scripts/make-movie.js "..." --upload
 */
import { SpilbergianDirector } from '../src/index.js';
import chalk from 'chalk';

const brief = process.argv[2];
if (!brief) {
  console.error(chalk.red('Usage: node scripts/make-movie.js "<brief>" [--upload]'));
  process.exit(1);
}

const upload = process.argv.includes('--upload');

console.log(chalk.magenta.bold('\n+-- Spilbergian Quick Movie'));
console.log(chalk.gray('|  Brief: ') + chalk.white(brief));
console.log(chalk.gray('|  Upload: ') + (upload ? chalk.green('yes') : chalk.gray('no')) + '\n');

const director = new SpilbergianDirector();
director.on('pipeline:phase', ({ phase }) => {
  console.log(chalk.gray(`  • ${phase}`));
});

const result = await director.createMovie(brief, { uploadToYouTube: upload });
console.log(chalk.green('\n+-- Movie Ready'));
console.log(chalk.white(`  Title:    ${result.title}`));
console.log(chalk.white(`  Video:    ${result.finalVideo}`));
console.log(chalk.white(`  Thumb:    ${result.thumbnailPath}`));
console.log(chalk.white(`  Style:    ${(result.styleAdherence.score * 100).toFixed(1)}%`));
if (result.youTube) {
  console.log(chalk.white(`  YouTube:  ${result.youTube.url}`));
}
await director.shutdown();
