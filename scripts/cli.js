#!/usr/bin/env node
/**
 * scripts/cli.js — PREDATOR JUNGLE v3.0 "Spilbergian" CLI
 *
 * Usage:
 *   spilbergian create "A lonely lighthouse keeper finds a mermaid"
 *   spilbergian create "..." --format vertical --genre sci-fi --upload
 *   spilbergian voice
 *   spilbergian train [--phase all|cinematic|style]
 *   spilbergian status
 *   spilbergian youtube upload <video.mp4> --title "..."
 *   spilbergian capcut open <project-name>
 *   spilbergian checkpoint save [--label ...]
 *   spilbergian demo
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import { SpilbergianDirector, dumpEffectiveConfig } from '../src/index.js';

const program = new Command();

program
  .name('spilbergian')
  .description(chalk.magenta.bold('PREDATOR JUNGLE v3.0') + ' — ' +
               chalk.cyan('"Spilbergian"') + chalk.gray(' — AI Cinematic Director\n') +
               chalk.gray('  Based on Agentic Theory by Justo Tapiador García (UA)'))
  .version('3.0.0');

// ── create ─────────────────────────────────────────────────────────────
program
  .command('create <brief>')
  .description('Create a complete cinematic video from a creative brief')
  .option('-f, --format <format>', 'Format: short | featurette | trailer | vertical | documentary', 'short')
  .option('-g, --genre <genre>',   'Genre: adventure | sci-fi | family | wonder | historical_drama')
  .option('-l, --language <lang>', 'Script/narration language (es/en)', 'es')
  .option('-d, --duration <sec>',  'Target duration in seconds')
  .option('--upload',              'Auto-upload to YouTube when finished')
  .option('--no-train',            'Skip pre-training')
  .option('--project-name <name>', 'Explicit project name')
  .action(async (brief, opts) => {
    console.log(banner());

    const director = new SpilbergianDirector();
    attachListeners(director);

    if (opts.train !== false) {
      const spin = ora({ text: chalk.yellow('Pre-training Spilbergian...'), color: 'yellow' }).start();
      try {
        await director.train({
          epochsI: 3, epochsII_T1: 2, epochsII_T2: 2, epochsII_T3: 2,
          epochsIII: 3, epochsIV: 2, epochsCinematic: 4, epochsStyleReward: 3,
        });
        spin.succeed(chalk.green('Pre-training complete'));
      } catch (err) {
        spin.fail(chalk.red('Pre-training failed: ' + err.message));
      }
    }

    console.log(chalk.cyan('\n+-- Creative Brief ' + '-'.repeat(60)));
    console.log(chalk.white(`|  ${brief}`));
    console.log(chalk.cyan(`|  Format: ${opts.format}  |  Genre: ${opts.genre || 'auto'}  |  Language: ${opts.language}`));
    console.log(chalk.cyan('+' + '-'.repeat(70) + '\n'));

    const spin = ora({ text: chalk.magenta('Spilbergian is directing...'), color: 'magenta' }).start();
    try {
      const result = await director.createMovie(brief, {
        format:    opts.format,
        genre:     opts.genre,
        language:  opts.language,
        targetDurationSec: opts.duration ? parseInt(opts.duration) : undefined,
        uploadToYouTube: opts.upload === true,
        projectName: opts.projectName,
      });
      spin.succeed(chalk.green('Movie complete!'));

      console.log('\n' + chalk.green('+-- Result ' + '-'.repeat(67)));
      console.log(chalk.white(`|  Title:    ${result.title}`));
      const finalVideoPath = typeof result.finalVideo === 'string'
        ? result.finalVideo
        : (result.finalVideo?.finalVideo || JSON.stringify(result.finalVideo));
      console.log(chalk.white(`|  Video:    ${finalVideoPath}`));
      if (typeof result.finalVideo === 'object' && result.finalVideo?.engine) {
        console.log(chalk.gray(`|  Engine:   ${result.finalVideo.engine}`));
        console.log(chalk.gray(`|  CapCut:   ${result.finalVideo.draftPath}`));
      }
      console.log(chalk.white(`|  Thumbnail:${result.thumbnailPath}`));
      console.log(chalk.white(`|  Duration: ${result.durationSec}s`));
      console.log(chalk.white(`|  Style adherence: ${(result.styleAdherence.score * 100).toFixed(1)}%`));
      if (result.youTube) {
        console.log(chalk.white(`|  YouTube:  ${result.youTube.url}`));
      }
      console.log(chalk.green('+' + '-'.repeat(70)));
    } catch (err) {
      spin.fail(chalk.red('Failed: ' + err.message));
      console.error(err);
      process.exit(1);
    } finally {
      await director.shutdown();
    }
  });

// ── voice ─────────────────────────────────────────────────────────────
program
  .command('voice')
  .description('Start voice command mode (Whisper)')
  .option('-m, --mode <mode>', 'continuous | wake_word | push_to_talk', 'wake_word')
  .action(async (opts) => {
    console.log(banner());
    console.log(chalk.cyan('Voice mode: ' + opts.mode));
    console.log(chalk.gray('Say "Spilbergian, crea un video sobre..." to give a command.'));
    console.log(chalk.gray('Say "Spilbergian, para" to stop.\n'));

    const director = new SpilbergianDirector({ voice: { commandMode: opts.mode } });
    attachListeners(director);
    await director.init();

    director.on('voice:transcript', (t) => {
      console.log(chalk.gray(`  [heard] "${t}"`));
    });
    director.on('voice:command', (c) => {
      console.log(chalk.magenta(`  [cmd] ${c.intent} ${JSON.stringify({ ...c, raw: undefined })}`));
    });

    await director.startVoiceMode();
  });

// ── train ─────────────────────────────────────────────────────────────
program
  .command('train')
  .description('Run the full Spilbergian training pipeline (6 phases)')
  .option('-p, --phase <phase>', 'Phase: all | cinematic | style | I | II | III | IV | V | VI', 'all')
  .option('--epochs <n>',        'Override default epoch count for the chosen phase')
  .action(async (opts) => {
    console.log(banner());
    const director = new SpilbergianDirector();
    attachListeners(director);

    const override = {};
    if (opts.epochs) {
      const n = parseInt(opts.epochs);
      if (opts.phase === 'I' || opts.phase === 'all') override.epochsI = n;
      if (opts.phase === 'II' || opts.phase === 'all') {
        override.epochsII_T1 = n; override.epochsII_T2 = n; override.epochsII_T3 = n;
      }
      if (opts.phase === 'III' || opts.phase === 'all') override.epochsIII = n;
      if (opts.phase === 'IV' || opts.phase === 'all') override.epochsIV = n;
      if (opts.phase === 'V' || opts.phase === 'cinematic' || opts.phase === 'all') override.epochsCinematic = n;
      if (opts.phase === 'VI' || opts.phase === 'style' || opts.phase === 'all') override.epochsStyleReward = n;
    }
    if (opts.phase !== 'all') override.phase = opts.phase;

    const spin = ora({ text: chalk.yellow('Training Spilbergian...'), color: 'yellow' }).start();
    try {
      const history = await director.train(override);
      spin.succeed(chalk.green('Training complete!'));
      console.log(chalk.cyan(`\n${history.length} epochs across all phases.`));
      const lastByPhase = {};
      for (const r of history) {
        const key = r.phase;
        if (!lastByPhase[key] || r.epoch > lastByPhase[key].epoch) lastByPhase[key] = r;
      }
      for (const [phase, rec] of Object.entries(lastByPhase)) {
        const metric = rec.loss !== undefined ? `loss=${rec.loss.toFixed(4)}` : `reward=${(rec.reward || 0).toFixed(4)}`;
        console.log(chalk.gray(`  Phase ${phase}: epoch ${rec.epoch}  ${metric}`));
      }
    } catch (err) {
      spin.fail(chalk.red('Training failed: ' + err.message));
      process.exit(1);
    } finally {
      await director.shutdown();
    }
  });

// ── status ────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show current Spilbergian status')
  .action(async () => {
    const director = new SpilbergianDirector();
    await director.init();
    const s = director.status();
    console.log(banner());
    console.log(chalk.cyan('Status:'));
    console.log(chalk.white(`  Persona:        ${s.persona}`));
    console.log(chalk.white(`  Version:        ${s.version}`));
    console.log(chalk.white(`  Specialty:      ${s.specialty}`));
    console.log(chalk.white(`  Initialized:    ${s.initialized}`));
    console.log(chalk.white(`  Voice active:   ${s.voiceActive}`));
    console.log(chalk.white(`  Current project:${s.currentProject || '—'}`));
    console.log(chalk.cyan('\nVideo providers:'));
    for (const p of s.videoProviders) {
      console.log(chalk.white(`  ${p.priority}. ${p.name}  →  ${p.endpoint}`));
    }
    console.log(chalk.cyan('\nMetrics:'));
    console.log(chalk.gray(JSON.stringify(s.metrics, null, 2)));
    await director.shutdown();
  });

// ── youtube ───────────────────────────────────────────────────────────
program
  .command('youtube <action>')
  .description('YouTube actions: upload | auth | list')
  .option('--title <title>')
  .option('--description <desc>')
  .option('--privacy <privacy>', 'private | unlisted | public', 'private')
  .option('--thumbnail <path>')
  .action(async (action, opts) => {
    const director = new SpilbergianDirector();
    await director.init();
    if (action === 'auth') {
      console.log(chalk.cyan('Starting OAuth flow...'));
      await director.youtube._ensureAuth();
      console.log(chalk.green('Authorized!'));
    } else if (action === 'list') {
      const vids = await director.youtube.listRecent();
      console.log(chalk.cyan('\nRecent uploads:'));
      for (const v of vids) {
        console.log(chalk.white(`  ${v.title}  —  ${v.url}`));
      }
    } else if (action === 'upload') {
      const remaining = process.argv.slice(process.argv.indexOf('upload') + 1);
      const file = remaining[0];
      if (!file) {
        console.error(chalk.red('Specify a video file to upload.'));
        process.exit(1);
      }
      const spin = ora({ text: chalk.yellow('Uploading to YouTube...'), color: 'yellow' }).start();
      const res = await director.youtube.upload(file, {
        title: opts.title,
        description: opts.description,
        privacy: opts.privacy,
        thumbnail: opts.thumbnail,
      });
      spin.succeed(chalk.green('Uploaded: ' + res.url));
    } else {
      console.error(chalk.red('Unknown youtube action: ' + action));
    }
    await director.shutdown();
  });

// ── capcut ────────────────────────────────────────────────────────────
program
  .command('capcut <action>')
  .description('CapCut actions: open <project> | render <draft>')
  .action(async (action) => {
    const director = new SpilbergianDirector();
    await director.init();
    if (action === 'open') {
      const projectName = process.argv[process.argv.indexOf('open') + 1];
      const p = path.join(director.config.editor.capcut.draftDir, `${projectName}_*`, 'draft_content.json');
      const target = await director.capcut.openInCapCutDesktop(p);
      console.log(chalk.green('Project copied to CapCut drafts: ' + target));
    } else if (action === 'render') {
      const draft = process.argv[process.argv.indexOf('render') + 1];
      const out = await director.capcut._renderWithCLI(draft, `render_${Date.now()}`);
      console.log(chalk.green('Rendered: ' + out));
    }
    await director.shutdown();
  });

// ── checkpoint ────────────────────────────────────────────────────────
program
  .command('checkpoint <action>')
  .description('Checkpoint actions: save | list | load')
  .option('--label <label>')
  .option('--id <id>')
  .action(async (action, opts) => {
    console.log(chalk.cyan(`Checkpoint ${action} (placeholder — wire to StateSerializer)`));
  });

// ── config ────────────────────────────────────────────────────────────
program
  .command('config')
  .description('Show the effective configuration')
  .action(async () => {
    const director = new SpilbergianDirector();
    const path = dumpEffectiveConfig(director.config);
    console.log(chalk.green('Effective config written to: ' + path));
  });

// ── demo ──────────────────────────────────────────────────────────────
program
  .command('demo')
  .description('Run a built-in demo: create a 30s short')
  .action(async () => {
    console.log(banner());
    console.log(chalk.cyan('Demo: 30s short film in Spanish'));
    const director = new SpilbergianDirector();
    attachListeners(director);
    const brief = 'Un ni\u00f1o encuentra una vieja linterna en la playa que, al frotarla, libera una peque\u00f1a galaxia.';
    await director.createMovie(brief, { format: 'short', genre: 'family', language: 'es' });
    await director.shutdown();
  });

// ── Helpers ───────────────────────────────────────────────────────────
function banner() {
  return chalk.magenta.bold('\n╔══════════════════════════════════════════════════════════════╗\n') +
         chalk.magenta.bold('║') + chalk.cyan('  PREDATOR JUNGLE v3.0 — "Spilbergian"                       ').slice(0, 62) + chalk.magenta.bold('║\n') +
         chalk.magenta.bold('║') + chalk.gray('  AI Cinematic Director · AJN Framework · UA                  ').slice(0, 62) + chalk.magenta.bold('║\n') +
         chalk.magenta.bold('╚══════════════════════════════════════════════════════════════╝\n');
}

function attachListeners(director) {
  director.on('pipeline:phase', ({ phase }) => {
    ora(chalk.gray(`  phase: ${phase}`)).start().stop();
  });
  director.on('video:progress', ({ completed, total }) => {
    if (completed && total) {
      process.stdout.write(chalk.gray(`\r  renders: ${completed}/${total}`));
    }
  });
  director.on('voice:transcript', (t) => {
    console.log(chalk.gray(`\n  [voice] ${t}`));
  });
  director.on('training:epoch', (rec) => {
    const m = rec.loss !== undefined ? `loss=${rec.loss.toFixed(4)}` : `reward=${(rec.reward || 0).toFixed(4)}`;
    process.stdout.write(chalk.gray(`\r  epoch ${rec.phase}/${rec.epoch}: ${m}`));
  });
}

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
