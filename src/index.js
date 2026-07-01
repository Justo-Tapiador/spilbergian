/**
 * src/index.js — Public API for PREDATOR JUNGLE v3.0 "Spilbergian"
 *
 * Re-exports the public surface of the system so users can do:
 *
 *   import { SpilbergianDirector, SpielbergPersona } from 'predator-jungle-agent';
 *
 * The package entrypoint is this file.
 */

// Core
export { SpilbergianDirector } from './core/SpilbergianDirector.js';
export { CinematicBrain }     from './core/CinematicBrain.js';

// Persona
export { SpielbergPersona }   from './persona/SpielbergPersona.js';

// Pipeline
export { MoviePipeline }      from './pipeline/MoviePipeline.js';
export { ScriptWriter }       from './pipeline/ScriptWriter.js';
export { StoryboardPlanner }  from './pipeline/StoryboardPlanner.js';
export { RenderQueue }        from './pipeline/RenderQueue.js';

// Video providers
export { VideoOrchestrator }  from './video/VideoOrchestrator.js';
export { VideoGenerator }     from './video/VideoGenerator.js';
export { MinimaxVideoGenerator } from './video/MinimaxVideoGenerator.js';
export { MetaVideoGenerator }    from './video/MetaVideoGenerator.js';
export { KlingVideoGenerator }   from './video/KlingVideoGenerator.js';
export { RunwayVideoGenerator }  from './video/RunwayVideoGenerator.js';
export { PikaVideoGenerator }    from './video/PikaVideoGenerator.js';

// Audio providers
export { AudioMixer }         from './audio/AudioMixer.js';
export { AudioGenerator }     from './audio/AudioGenerator.js';
export { UdioGenerator }      from './audio/UdioGenerator.js';
export { SunoGenerator }      from './audio/SunoGenerator.js';
export { ElevenLabsGenerator } from './audio/ElevenLabsGenerator.js';

// Editor
export { CapCutController }   from './editor/CapCutController.js';
export { CapCutDraftBuilder } from './editor/CapCutDraftBuilder.js';
export { TimelineAssembler }  from './editor/TimelineAssembler.js';

// Voice
export { WhisperListener }    from './voice/WhisperListener.js';
export { VoiceCommandRouter } from './voice/VoiceCommandRouter.js';

// YouTube
export { YouTubeUploader }    from './youtube/YouTubeUploader.js';
export { ThumbnailGenerator } from './youtube/ThumbnailGenerator.js';

// Training
export { SpilbergianTrainer }    from './training/SpilbergianTrainer.js';
export { CinematicDatasetLoader } from './training/CinematicDatasetLoader.js';
export { StyleRewardModel }      from './training/StyleRewardModel.js';

// Modules (from v2.0)
export { MemorySystem }       from './modules/MemorySystem.js';
export { SafetyGuardrails }   from './modules/SafetyGuardrails.js';
export { MetricsCollector }   from './modules/MetricsCollector.js';
export { PluginManager }      from './modules/PluginManager.js';

// Tools
export { MediaAssetTool }     from './tools/MediaAssetTool.js';

// LLM
export { OpenAIAdapter }      from './llm/OpenAIAdapter.js';

// Config
export { loadConfig, dumpEffectiveConfig } from '../config/loader.js';
export { ConfigSchema, validateConfig }    from '../config/schema.js';

// Default export — ready-to-use director instance (lazy)
import { SpilbergianDirector } from './core/SpilbergianDirector.js';
let _director = null;
export async function getDirector(opts) {
  if (!_director) _director = new SpilbergianDirector(opts);
  return _director;
}

// Quick-start helper for one-shot movie creation
export async function makeMovie(brief, opts) {
  const d = await getDirector();
  return d.createMovie(brief, opts);
}
