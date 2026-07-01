#!/usr/bin/env node
/**
 * scripts/train-spilbergian.js — Dedicated training entrypoint.
 *
 * Usage:
 *   spilbergian train --phase all
 *   spilbergian train --phase cinematic --epochs 30
 *   spilbergian train --phase style --epochs 20
 *
 * Seeds built-in datasets if none exist yet.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SpilbergianDirector, CinematicDatasetLoader } from '../src/index.js';

const program = new Command();
program
  .name('spilbergian-train')
  .description('Train Spilbergian on cinematic knowledge')
  .version('3.0.0')
  .option('-p, --phase <phase>', 'Phase: all | cinematic | style | I | II | III | IV | V | VI', 'all')
  .option('-e, --epochs <n>', 'Override default epoch count for the chosen phase', parseInt)
  .option('--seed-datasets', 'Seed built-in datasets before training')
  .parse(process.argv);

const opts = program.opts();

console.log(chalk.magenta.bold('\n+-- Spilbergian Training Pipeline v3.0'));
console.log(chalk.gray('|  Phase: ' + opts.phase));
console.log(chalk.gray('|  Epochs: ' + (opts.epochs || 'default')));
console.log(chalk.gray('|  Seed datasets: ' + (opts.seedDatasets ? 'yes' : 'no')) + '\n');

if (opts.seedDatasets) {
  const spin = ora('Seeding built-in datasets...').start();
  const loader = new CinematicDatasetLoader({
    datasets: {
      scenesDir:      './data/training/scenes',
      scriptsDir:     './data/training/scripts',
      storyboardsDir: './data/training/storyboards',
    },
  });
  const n = await loader.seedBuiltinDatasets();
  spin.succeed(chalk.green(`Seeded ${n} built-in samples into data/training/`));
}

const director = new SpilbergianDirector();
const spin = ora('Training Spilbergian...').start();

let lastLoss = null;
director.on('training:epoch', (rec) => {
  if (rec.loss !== undefined) lastLoss = rec.loss;
  const m = rec.loss !== undefined ? `loss=${rec.loss.toFixed(4)}` : `reward=${(rec.reward || 0).toFixed(4)}`;
  spin.text = chalk.yellow(`Training — phase ${rec.phase} / epoch ${rec.epoch} — ${m}`);
});

try {
  const history = await director.train({
    phase: opts.phase,
    ...(opts.epochs ? {
      epochsI: opts.epochs, epochsII_T1: opts.epochs, epochsII_T2: opts.epochs, epochsII_T3: opts.epochs,
      epochsIII: opts.epochs, epochsIV: opts.epochs,
      epochsCinematic: opts.epochs, epochsStyleReward: opts.epochs,
    } : {}),
  });
  spin.succeed(chalk.green(`Training complete — ${history.length} epochs`));

  // Print phase summaries
  const phasesSeen = new Set();
  console.log(chalk.cyan('\nPhase summaries:'));
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (phasesSeen.has(r.phase)) continue;
    phasesSeen.add(r.phase);
    const m = r.loss !== undefined ? `final loss=${r.loss.toFixed(4)}` : `final reward=${(r.reward || 0).toFixed(4)}`;
    console.log(chalk.white(`  Phase ${r.phase.padEnd(15)} — epochs: ${r.epoch}  ${m}`));
  }
} catch (err) {
  spin.fail(chalk.red('Training failed: ' + err.message));
  console.error(err);
  process.exit(1);
} finally {
  await director.shutdown();
}
