/**
 * config/schema.js — Zod validation schema for PREDATOR JUNGLE v3.0 "Spilbergian"
 * Extends v2.0 schema with cinematic, video, audio, editor, voice, and YouTube
 * configuration validation.
 */
import { z } from 'zod';

export const ConfigSchema = z.object({
  agent: z.object({
    version: z.string().default('3.0.0'),
    codename: z.string().default('Spilbergian'),
    specialty: z.string().default('cinematic_video_creation'),
    dModel: z.number().int().positive().default(128),
    nHeads: z.number().int().positive().default(8),
    dFF: z.number().int().positive().default(512),
    maxSteps: z.number().int().positive().default(500),
    creativeTemperature: z.number().min(0).max(2).default(0.85),
    directorialStyle: z.string().default('spielberg'),
  }),

  persona: z.object({
    name: z.string().default('Spilbergian'),
    inspiration: z.string().default('Steven Spielberg'),
    signatureTechniques: z.array(z.string()).default([]),
    preferredGenres: z.array(z.string()).default([]),
    narrativeBeats: z.array(z.string()).default([]),
    toneKeywords: z.array(z.string()).default([]),
    colorPalette: z.record(z.string()).default({}),
    pacing: z.object({
      defaultCutsPerMinute: z.number().positive().default(8),
      actionCutsPerMinute: z.number().positive().default(18),
      emotionalCutsPerMinute: z.number().positive().default(4),
      minShotMs: z.number().int().positive().default(1400),
      maxShotMs: z.number().int().positive().default(12000),
    }).default({}),
  }),

  ajn: z.object({
    betaM: z.number().min(0).max(1).default(0.85),
    lambdaUp: z.number().min(0).max(1).default(0.30),
    delta: z.number().positive().default(0.02),
    thetaSat: z.number().min(0).max(1).default(0.75),
    tau: z.number().positive().default(20),
    eta: z.number().positive().default(0.05),
    praximDim: z.number().int().positive().default(128),
    creativeBoost: z.number().min(0).max(1).default(0.15),
  }),

  budget: z.object({
    defaultTokens: z.number().int().positive().default(200000),
    defaultEnergy: z.number().positive().default(2.0),
    defaultWallClockMs: z.number().int().positive().default(3600000),
    maxConcurrentRenders: z.number().int().positive().default(3),
    maxConcurrentAudioJobs: z.number().int().positive().default(4),
  }),

  cascade: z.object({
    rhoWarn: z.number().min(0).max(1).default(0.35),
    rhoModerate: z.number().min(0).max(1).default(0.50),
    rhoCritical: z.number().min(0).max(1).default(0.65),
    pollMs: z.number().int().positive().default(500),
    selfHealing: z.boolean().default(true),
  }),

  memory: z.object({
    storageDir: z.string().default('./data/memory'),
    maxEpisodic: z.number().int().positive().default(5000),
    maxWorking: z.number().int().positive().default(25),
    enablePersistence: z.boolean().default(true),
    rememberSuccessfulRenders: z.boolean().default(true),
    rememberStyleAdherence: z.boolean().default(true),
  }),

  safety: z.object({
    safetyLevel: z.enum(['permissive', 'standard', 'strict']).default('standard'),
    protectedPaths: z.array(z.string()).default([]),
    maxFileSize: z.number().int().positive().default(2147483648),
    rateLimits: z.object({
      perMinute: z.number().int().positive().default(60),
      perHour: z.number().int().positive().default(500),
      videoRendersPerDay: z.number().int().positive().default(50),
      audioJobsPerDay: z.number().int().positive().default(100),
      youtubeUploadsPerDay: z.number().int().positive().default(6),
    }).default({}),
    contentFilter: z.object({
      blockExplicit: z.boolean().default(false),
      blockViolent: z.boolean().default(false),
      blockCopyrighted: z.boolean().default(true),
      requireLicenseClearance: z.boolean().default(true),
    }).default({}),
  }),

  training: z.object({
    epochsI: z.number().int().positive().default(15),
    epochsII_T1: z.number().int().positive().default(8),
    epochsII_T2: z.number().int().positive().default(8),
    epochsII_T3: z.number().int().positive().default(8),
    epochsIII: z.number().int().positive().default(12),
    epochsIV: z.number().int().positive().default(10),
    epochsCinematic: z.number().int().positive().default(20),
    epochsStyleReward: z.number().int().positive().default(15),
    batchSize: z.number().int().positive().default(16),
    enableCheckpoints: z.boolean().default(true),
    earlyStoppingPatience: z.number().int().positive().default(7),
    datasets: z.object({
      scenesDir: z.string().default('./data/training/scenes'),
      scriptsDir: z.string().default('./data/training/scripts'),
      storyboardsDir: z.string().default('./data/training/storyboards'),
    }).default({}),
    augmentScenes: z.boolean().default(true),
    augmentAudio: z.boolean().default(true),
    augmentScripts: z.boolean().default(true),
  }),

  tools: z.object({
    timeout: z.number().int().positive().default(60000),
    maxRetries: z.number().int().positive().default(3),
    maxConcurrent: z.number().int().positive().default(5),
  }),

  llm: z.object({
    provider: z.enum(['none', 'openai', 'local']).default('openai'),
    model: z.string().default('glm-4.6'),
    temperature: z.number().min(0).max(2).default(0.85),
    maxTokens: z.number().int().positive().default(8192),
    systemPrompt: z.string().default(''),
  }),

  video: z.object({
    defaultResolution: z.string().default('1920x1080'),
    defaultFps: z.number().int().positive().default(30),
    defaultAspectRatio: z.string().default('16:9'),
    verticalAspectRatio: z.string().default('9:16'),
    defaultDuration: z.number().int().positive().default(8),
    maxDuration: z.number().int().positive().default(60),
    providers: z.record(z.object({
      enabled: z.boolean().default(false),
      priority: z.number().int().positive().default(1),
      endpoint: z.string().url().or(z.literal('')),
      model: z.string().default(''),
      defaultResolution: z.string().default('1920x1080'),
    })).default({}),
    fallbackStrategy: z.string().default('priority_then_cost'),
    cacheGeneratedClips: z.boolean().default(true),
    cacheDir: z.string().default('./data/assets/video'),
  }),

  audio: z.object({
    defaultSampleRate: z.number().int().positive().default(44100),
    defaultFormat: z.string().default('mp3'),
    defaultBitrate: z.string().default('256k'),
    providers: z.record(z.object({
      enabled: z.boolean().default(false),
      priority: z.number().int().positive().default(1),
      endpoint: z.string().url().or(z.literal('')),
      model: z.string().optional(),
      defaultDuration: z.number().int().positive().optional(),
      specialty: z.string().default(''),
      defaultVoice: z.string().optional(),
    })).default({}),
    voiceProfiles: z.record(z.object({
      voice: z.string(),
      stability: z.number().min(0).max(1),
      similarity: z.number().min(0).max(1),
      style: z.number().min(0).max(1),
    })).default({}),
    cacheGeneratedAudio: z.boolean().default(true),
    cacheDir: z.string().default('./data/assets/audio'),
  }),

  editor: z.object({
    engine: z.string().default('capcut'),
    capcut: z.object({
      draftDir: z.string().default('./data/projects/capcut_drafts'),
      exportDir: z.string().default('./data/projects/renders'),
      capcutCliPath: z.string().default('/opt/capcut/cli'),
      capcutDesktopProjectDir: z.string().default(''),
      defaultExportResolution: z.string().default('1920x1080'),
      defaultExportFps: z.number().int().positive().default(30),
      defaultExportBitrate: z.string().default('8M'),
      autoOpenInCapCut: z.boolean().default(false),
      templateDir: z.string().default('./data/projects/capcut_templates'),
    }).default({}),
    ffmpegFallback: z.boolean().default(true),
    ffmpegPath: z.string().default('ffmpeg'),
  }),

  voice: z.object({
    whisper: z.object({
      enabled: z.boolean().default(true),
      model: z.enum(['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3']).default('base'),
      language: z.string().default('es'),
      device: z.string().default('auto'),
      sampleRate: z.number().int().positive().default(16000),
      vad: z.object({
        enabled: z.boolean().default(true),
        threshold: z.number().min(0).max(1).default(0.5),
        minSilenceMs: z.number().int().positive().default(700),
        maxSpeechMs: z.number().int().positive().default(30000),
      }).default({}),
      hotwords: z.array(z.string()).default([]),
    }).default({}),
    wakeWord: z.string().default('Spilbergian'),
    commandMode: z.enum(['continuous', 'wake_word', 'push_to_talk']).default('continuous'),
    microphone: z.object({
      device: z.string().default('default'),
      channels: z.number().int().positive().default(1),
    }).default({}),
  }),

  youtube: z.object({
    channelId: z.string().default(''),
    channelName: z.string().default(''),
    defaultPrivacy: z.enum(['private', 'unlisted', 'public']).default('private'),
    defaultCategory: z.string().default('24'),
    defaultTags: z.array(z.string()).default([]),
    defaultLanguage: z.string().default('es'),
    defaultDescription: z.string().default(''),
    publishSchedule: z.object({
      frequency: z.string().default('weekly'),
      preferredDay: z.string().default('friday'),
      preferredTime: z.string().default('18:00'),
      timezone: z.string().default('Europe/Madrid'),
    }).default({}),
    thumbnails: z.object({
      autoGenerate: z.boolean().default(true),
      style: z.string().default('spielberg_wonder_face'),
      size: z.string().default('1280x720'),
    }).default({}),
    credentialsFile: z.string().default('./data/youtube/credentials.json'),
    tokenFile: z.string().default('./data/youtube/token.json'),
  }),

  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    enableConsole: z.boolean().default(true),
    enableFile: z.boolean().default(true),
    fileDir: z.string().default('./data/logs'),
    enableAudit: z.boolean().default(true),
    auditFile: z.string().default('./data/logs/audit.jsonl'),
  }),
});

export function validateConfig(rawConfig) {
  const result = ConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const errors = result.error.issues
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid Spilbergian configuration:\n${errors}`);
  }
  return result.data;
}
