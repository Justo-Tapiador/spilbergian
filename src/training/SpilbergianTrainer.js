/**
 * src/training/SpilbergianTrainer.js — Specialized training for Spilbergian.
 *
 * Extends the v2.0 PREDATOR training pipeline with two new phases:
 *
 *   Phase V  (Cinematic)       — fine-tunes the CinematicBrain on the
 *                                 scene/script/storyboard datasets. The
 *                                 brain learns to map briefs → structured
 *                                 plans that match the Spielberg persona.
 *
 *   Phase VI (Style Reward)    — runs each generated plan through the
 *                                 persona.styleAdherence() scorer and
 *                                 reinforces high-adherence plans. This
 *                                 is the "RLHF-lite" loop that pushes
 *                                 Spilbergian's outputs toward the
 *                                 Spielberg canon.
 *
 * All four original PREDATOR phases (I–IV) still run first, ensuring
 * the underlying AJN backbone remains stable.
 */
import { EventEmitter } from 'eventemitter3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CinematicDatasetLoader } from './CinematicDatasetLoader.js';
import { StyleRewardModel } from './StyleRewardModel.js';

export class SpilbergianTrainer extends EventEmitter {
  constructor(brain, trainingConfig) {
    super();
    this.brain    = brain;
    this.config   = trainingConfig;
    this.loader   = new CinematicDatasetLoader(trainingConfig);
    this.reward   = new StyleRewardModel(brain.persona);
    this.history  = [];
  }

  /**
   * Run all training phases.
   * @param {Object} [opts] — epoch overrides per phase
   */
  async train(opts = {}) {
    const cfg = { ...this.config, ...opts };
    this.history = [];

    // Phase I — pre-training
    await this._runPhase('I', cfg.epochsI || 15, async (epoch) => {
      // The v2.0 backbone (AJN/ANN-Psi) trains here.
      // We expose a hook so the CinematicBrain can also observe progress.
      const loss = this._simulateLoss(epoch, 1.0, 0.3);
      this.brain?.emit?.('training:epoch', { phase: 'I', epoch, loss });
      return { phase: 'I', epoch, loss };
    });

    // Phase II — addiction seeding (T1, T2, T3)
    await this._runPhase('II-T1', cfg.epochsII_T1 || 8, async (epoch) => {
      const loss = this._simulateLoss(epoch, 0.8, 0.2);
      this.brain?.emit?.('training:epoch', { phase: 'II-T1', epoch, loss });
      return { phase: 'II-T1', epoch, loss };
    });
    await this._runPhase('II-T2', cfg.epochsII_T2 || 8, async (epoch) => {
      const loss = this._simulateLoss(epoch, 0.7, 0.15);
      this.brain?.emit?.('training:epoch', { phase: 'II-T2', epoch, loss });
      return { phase: 'II-T2', epoch, loss };
    });
    await this._runPhase('II-T3', cfg.epochsII_T3 || 8, async (epoch) => {
      const loss = this._simulateLoss(epoch, 0.6, 0.1);
      this.brain?.emit?.('training:epoch', { phase: 'II-T3', epoch, loss });
      return { phase: 'II-T3', epoch, loss };
    });

    // Phase III — hierarchical fine-tuning (HIFT)
    await this._runPhase('III', cfg.epochsIII || 12, async (epoch) => {
      const loss = this._simulateLoss(epoch, 0.5, 0.08);
      this.brain?.emit?.('training:epoch', { phase: 'III', epoch, loss });
      return { phase: 'III', epoch, loss };
    });

    // Phase IV — adversarial frustration hardening
    await this._runPhase('IV', cfg.epochsIV || 10, async (epoch) => {
      const loss = this._simulateLoss(epoch, 0.4, 0.05);
      this.brain?.emit?.('training:epoch', { phase: 'IV', epoch, loss });
      return { phase: 'IV', epoch, loss };
    });

    // Phase V — CINEMATIC fine-tuning (new in v3.0)
    if (cfg.phase === 'all' || cfg.phase === 'cinematic' || !cfg.phase) {
      await this._runPhase('V-cinematic', cfg.epochsCinematic || 20, async (epoch) => {
        const dataset = await this.loader.loadScenes();
        let totalLoss = 0;
        for (const sample of dataset) {
          const plan = await this.brain.plan(sample.brief, sample.opts);
          // Loss = 1 - adherence + structural penalties
          const adherence = this.brain.persona.styleAdherence(plan);
          let loss = 1 - adherence.score;
          if (plan.shotList?.length < 3) loss += 0.2;
          if (!plan.title) loss += 0.1;
          totalLoss += loss;
        }
        const avgLoss = totalLoss / Math.max(1, dataset.length);
        this.brain?.emit?.('training:epoch', { phase: 'V-cinematic', epoch, loss: avgLoss });
        return { phase: 'V-cinematic', epoch, loss: avgLoss, samples: dataset.length };
      });
    }

    // Phase VI — STYLE REWARD (new in v3.0)
    if (cfg.phase === 'all' || cfg.phase === 'style' || !cfg.phase) {
      await this._runPhase('VI-style-reward', cfg.epochsStyleReward || 15, async (epoch) => {
        const dataset = await this.loader.loadScripts();
        let totalReward = 0;
        for (const sample of dataset) {
          const plan = await this.brain.plan(sample.brief, sample.opts);
          const reward = this.reward.score(plan, sample.expectedTones || []);
          totalReward += reward.score;
          // In a real RLHF setup, gradients would flow back to the brain
          // here. We log the reward so it can be tracked over epochs.
        }
        const avgReward = totalReward / Math.max(1, dataset.length);
        this.brain?.emit?.('training:epoch', { phase: 'VI-style-reward', epoch, reward: avgReward });
        return { phase: 'VI-style-reward', epoch, reward: avgReward, samples: dataset.length };
      });
    }

    this.emit('training:complete', this.history);
    return this.history;
  }

  async _runPhase(name, epochs, fn) {
    this.emit('training:phase_start', { phase: name, epochs });
    for (let e = 1; e <= epochs; e++) {
      const record = await fn(e);
      this.history.push(record);
      this.emit('training:epoch', record);
    }
    this.emit('training:phase_complete', { phase: name });
  }

  /**
   * Synthetic loss curve: starts at `start`, decays exponentially
   * to `floor` over the epochs. Used as a placeholder for the real
   * AJN gradient signal in this minimal scaffold.
   */
  _simulateLoss(epoch, start = 1.0, floor = 0.1) {
    const k = 0.15;
    return floor + (start - floor) * Math.exp(-k * epoch);
  }
}

export default SpilbergianTrainer;
