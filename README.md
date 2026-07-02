# Spilbergian — A Cinematic AI Director #

> An autonomous cinematic AI agent built on the **Artificial Junky Neuron (AJN)** framework by **Justo Tapiador García (UA)**.
> v3.0 transforms PREDATOR into a **virtual film director in the style of Steven Spielberg** that generates, edits, and publishes complete videos to YouTube without human intervention.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.0.0-blue)](https://github.com/Justo-Tapiador/splibergian)
[![Codename](https://img.shields.io/badge/codename-Spilbergian-magenta)](#)

---

<div align="center">
<h2>🎬 Spilbergian doesn't just create videos — it directs them.🎬</h2>

<i>It thinks in shots, in beats, in emotions. Its single goal is to make the audience feel something — and to make them feel it the way Spielberg would have filmed it.</i>

`ACTION!` 🎞️
</div>


<div align="center">
<img src="https://github.com/user-attachments/assets/dce59cef-df12-4af9-87fd-ca7792e56ab6" alt="Spilbergian — AI Cinematic Director""  width="640"/>
</div>
---

## 📑 Table of Contents

1. [What's New in v3.0](#-whats-new-in-v30)
2. [Architecture](#-architecture)
3. [Installation](#-installation)
4. [Configuration](#-configuration)
5. [Quick Start](#-quick-start)
6. [Voice Mode with Whisper](#-voice-mode-with-whisper)
7. [Cinematic Pipeline](#-cinematic-pipeline)
8. [Video Generation](#-video-generation-meta--minimax--kling--runway--pika)
9. [Audio Generation](#-audio-generation-udio--suno--elevenlabs)
10. [Editing with CapCut](#-editing-with-capcut)
11. [Publishing to YouTube](#-publishing-to-youtube)
12. [Detailed Training](#-detailed-training)
13. [Programmatic API](#-programmatic-api)
14. [Plugin System](#-plugin-system)
15. [Docker Deployment](#-docker-deployment)
16. [Theoretical References](#-theoretical-references)
17. [License](#-license)

---

## 🆕 What's New in v3.0

v3.0 is a **qualitative leap** over v2.0: PREDATOR ceases to be a generic agent and specializes as an **autonomous film director**. The new features are grouped into five areas:

### 1. Directorial Persona — "Spilbergian"

| Feature | Description |
|---------|-------------|
| **Encoded persona** | Vocabulary, palette, cut pacing, and narrative arcs extracted from the Steven Spielberg canon |
| **9-beat arcs** | `ordinary_world → inciting_incident → reluctant_hero → threshold_crossing → rising_action → midpoint_reversal → dark_night_of_soul → climactic_showdown → resolution_and_wonder` |
| **Signature techniques** | Long-take suspense, wide-eyed wonder, silhouette against sky, amber backlight, child POV, Spielberg face, John-Williams swelling score, machine POV reveal |
| **Style adherence scorer** | Every plan receives a 0..1 score of how "Spielberg" it is, used as a reward signal during training |

### 2. Full Cinematic Pipeline

| Stage | Module | Output |
|-------|--------|--------|
| **Plan** | `CinematicBrain` | script + storyboard + shot list + render prompts |
| **Render** | `VideoOrchestrator` + 5 providers | per-shot MP4 clips |
| **Audio** | `AudioMixer` (Udio + Suno + ElevenLabs) | soundtrack + voiceover + SFX, mixed |
| **Editing** | `CapCutController` (CapCut draft + ffmpeg fallback) | final assembled MP4 |
| **Thumbnail** | `ThumbnailGenerator` | 1280×720 PNG in wonder-face style |
| **Publishing** | `YouTubeUploader` (OAuth + Data API v3) | video live on YouTube |

### 3. Video Generation Integrations

| Provider | Model | Default status | Approx. cost |
|----------|-------|----------------|--------------|
| **Minimax** (Hailuo) | `video-01` | enabled (priority 1) | ~$0.10/s 720p |
| **Meta Movie Gen** | `movie-gen-2` | enabled (priority 2) | ~$0.35/s 1080p |
| **Kling (Kuaishou)** | `kling-v2` | enabled (priority 3) | ~$0.20/s 1080p |
| **Runway Gen-3 Alpha** | `gen-3-alpha` | disabled | ~$0.50/s 1080p |
| **Pika 1.5** | `pika-1.5` | disabled | ~$0.15/s 720p |

`VideoOrchestrator` tries providers in priority order and falls back to the next on any failure, guaranteeing resilience.

### 4. Multi-Provider Audio Generation

| Provider | Specialty | Default status |
|----------|-----------|----------------|
| **Udio** | Instrumental orchestral soundtrack | enabled |
| **Suno** | Soundtrack (Udio fallback) | enabled |
| **ElevenLabs** | Multivoice voiceover + SFX | enabled |

Pre-configured **voice profile** system: `narrator_warm`, `narrator_grandpa`, `character_child`, `character_villain`, `character_ally`, `news_anchor`. Each profile tunes `stability`, `similarity_boost`, and `style` according to the scene's tone.

### 5. Editing with CapCut

Three complementary mechanisms depending on the environment:

1. **CapCut Draft JSON** — Generates `draft_content.json` ready to open in CapCut Desktop (Windows/macOS). Includes clips on the timeline, fade transitions, per-tone color adjustments, keyframes for slow push-ins.
2. **CapCut CLI** — If the headless `capcut` binary is installed, renders without a GUI.
3. **FFmpeg fallback** — On Linux servers without CapCut, `TimelineAssembler` produces an equivalent MP4 with per-shot normalization, side-chain audio mixing, and per-tone color grading.

### 6. Voice Commands with Whisper

`WhisperListener` supports three modes:

| Mode | Behavior |
|------|----------|
| `continuous` | Transcribes everything it hears, no filter |
| `wake_word` *(default)* | Waits for the word "Spilbergian" before capturing the command |
| `push_to_talk` | Records for a fixed window |

Supported engines (in order of preference):
1. **OpenAI Whisper API** (if `OPENAI_API_KEY` is present)
2. **whisper** CLI (local Python binary install)
3. **whisper.cpp** (local C++ install)

Audio capture via `sox`/`rec` (cross-platform) or `ffmpeg` as a fallback. Configurable silence detection (VAD).

### 7. YouTube Publishing

- **OAuth 2.0** with token caching (`data/youtube/token.json`)
- **Resumable** upload with progress bar via `youtube.videos.insert`
- **Automatic thumbnails** generated in "wonder face" style with title composited via `sharp`
- **Publication scheduling** (preferred day + time, configurable tz)
- Listing of recent uploads for verification

---

## 🧠 Architecture

```
        ┌──────────────────────────────────────────────────────────┐
        │                  Owner Directive (text or voice)         │
        │         "Spilbergian, crea un video sobre X"             │
        └────────────────────────┬─────────────────────────────────┘
                                 │
                                 v
        ┌──────────────────────────────────────────────────────────┐
        │              SpilbergianDirector (orchestrator)          │
        │  ┌────────────────┐  ┌─────────────────┐  ┌───────────┐  │
        │  │ SpielbergPersona│  │  CinematicBrain │  │ Memory    │  │
        │  │  (style canon)  │  │  (plan writer)  │  │  System   │  │
        │  └────────────────┘  └─────────────────┘  └───────────┘  │
        │  ┌────────────────┐  ┌─────────────────┐  ┌───────────┐  │
        │  │ SafetyGuardrails│  │ MetricsCollector│  │  Plugin   │  │
        │  │  (rate limits)  │  │  (observability)│  │ Manager   │  │
        │  └────────────────┘  └─────────────────┘  └───────────┘  │
        └────────┬───────────────────────────────────┬─────────────┘
                 │                                   │
        ┌────────v────────┐                 ┌────────v────────┐
        │ MoviePipeline   │                 │ WhisperListener │
        │  (6 phases)     │                 │ (voice → text)  │
        └────────┬────────┘                 └────────┬────────┘
                 │                                   │
                 v                                   v
   ┌──────────────────────────────────┐   ┌──────────────────────┐
   │ 1. plan     → brief → script     │   │ VoiceCommandRouter   │
   │              → storyboard        │   │ (parse + route)      │
   │              → shot list         │   └──────────────────────┘
   │              → render prompts    │
   │                                  │
   │ 2. render_video                  │
   │    VideoOrchestrator             │
   │    ├─ Minimax                    │
   │    ├─ Meta Movie Gen             │
   │    ├─ Kling                      │
   │    ├─ Runway                     │
   │    └─ Pika                       │
   │                                  │
   │ 3. compose_audio                 │
   │    AudioMixer                    │
   │    ├─ Udio (soundtrack)          │
   │    ├─ Suno (soundtrack fallback) │
   │    └─ ElevenLabs (VO + SFX)      │
   │                                  │
   │ 4. edit                          │
   │    CapCutController              │
   │    ├─ CapCut Draft JSON          │
   │    ├─ CapCut CLI render          │
   │    └─ FFmpeg TimelineAssembler   │
   │                                  │
   │ 5. thumbnail                     │
   │    ThumbnailGenerator (cogview-3)│
   │                                  │
   │ 6. finalize → manifest.json      │
   │              style adherence     │
   └────────────────┬─────────────────┘
                    │
                    v
        ┌───────────────────────────┐
        │   YouTubeUploader (OAuth) │
        │   upload + thumbnail +    │
        │   schedule                │
        └───────────────────────────┘
```

---

## 📦 Installation

### Prerequisites

| Software | Min version | Used for |
|----------|-------------|----------|
| **Node.js** | 18.0+ | main runtime |
| **ffmpeg** | 5.0+ | video assembly (CapCut fallback) |
| **sox** | 14.4+ | audio capture for Whisper |
| **Python 3** | 3.10+ | only if you use the whisper Python CLI |
| **CapCut Desktop** | 3.x | only if you want to open drafts in the GUI |

### Standard install

```bash
git clone https://github.com/Justo-Tapiador/splibergian.git
cd splibergian
git checkout v3.0        # if released as a branch/tag
npm install
cp .env.example .env     # edit with your API keys
```

### Quick verification

```bash
# Check the agent boots
node scripts/cli.js status

# Run smoke tests
npm test

# Seed built-in training datasets
node scripts/train-spilbergian.js --seed-datasets --phase all --epochs 2
```

### Installing with Docker

```bash
docker build -t spilbergian-v3 -f docker/Dockerfile .
docker run -it --rm \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config:ro \
  --env-file .env \
  spilbergian-v3 status
```

For development with Ollama (local LLM) as a sidecar:

```bash
docker-compose --profile llm up
```

---

## ⚙️ Configuration

Configuration follows the **layered system** inherited from v2.0:

1. `config/default.json` — default values
2. `config/{NODE_ENV}.json` — environment overrides
3. `.env` — environment variables (loaded by `dotenv`)
4. `process.env` with `PREDATOR_*` or `SPILBERGIAN_*` prefixes
5. Explicit overrides passed to the constructor

The result is validated with **Zod** (`config/schema.js`). Any unknown field or wrong type triggers a clear failure at startup.

### Key environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZAI_API_KEY` | — | API key for z-ai-web-dev-sdk (LLM + image) |
| `OPENAI_API_KEY` | — | API key for Whisper API and OpenAI-compatible LLMs |
| `MINIMAX_API_KEY` | — | Minimax video generation |
| `META_AI_API_KEY` | — | Meta Movie Gen |
| `KLING_API_KEY` | — | Kling video |
| `UDIO_API_KEY` | — | Udio soundtrack |
| `SUNO_API_KEY` | — | Suno soundtrack |
| `ELEVENLABS_API_KEY` | — | ElevenLabs voiceover + SFX |
| `WHISPER_MODEL` | `base` | Whisper model: tiny/base/small/medium/large-v3 |
| `WHISPER_LANGUAGE` | `es` | Transcription language |
| `PREDATOR_SAFETY__SAFETY_LEVEL` | `standard` | permissive / standard / strict |
| `SPILBERGIAN_VOICE__COMMAND_MODE` | `wake_word` | continuous / wake_word / push_to_talk |
| `SPILBERGIAN_YOUTUBE__DEFAULT_PRIVACY` | `private` | private / unlisted / public |

### YouTube channel configuration

Edit `config/default.json`:

```json
"youtube": {
  "channelId": "UCxxxxxxxxxxxx",
  "channelName": "My AI Cinema Channel",
  "defaultPrivacy": "private",
  "defaultTags": ["Spilbergian", "AI Director", "Predator Jungle v3"],
  "defaultLanguage": "en",
  "publishSchedule": {
    "frequency": "weekly",
    "preferredDay": "friday",
    "preferredTime": "18:00",
    "timezone": "Europe/Madrid"
  }
}
```

And download your OAuth credentials from Google Cloud Console to `data/youtube/credentials.json` (type "Desktop app").

---

## 🚀 Quick Start

### Create a short film from text

```bash
# Family short film in Spanish, 60s
spilbergian create "A boy finds an old lantern on the beach that releases a tiny galaxy" \
  --format short --genre family --language en

# With automatic YouTube upload
spilbergian create "..." --upload

# Vertical (for Shorts/Reels)
spilbergian create "..." --format vertical

# 3-minute featurette
spilbergian create "..." --format featurette --duration 180
```

### Train the model

```bash
# Full training (6 phases)
spilbergian train --phase all

# Only the new cinematic phase
spilbergian train --phase cinematic --epochs 30

# Only the style-reward phase (RLHF-lite)
spilbergian train --phase style --epochs 20

# Seed built-in datasets before the first training run
spilbergian train --seed-datasets --phase all
```

### Agent status

```bash
spilbergian status
```

Expected output:

```
╔══════════════════════════════════════════════════════════════╗
║  PREDATOR JUNGLE v3.0 — "Spilbergian"                       ║
╚══════════════════════════════════════════════════════════════╝

Status:
  Persona:        Spilbergian
  Version:        3.0.0
  Specialty:      cinematic_video_creation
  Voice active:   false
  Current project: —

Video providers:
  1. minimax  →  https://api.minimax.chat/v1/video_generation
  2. meta     →  https://api.meta.ai/v1/movie-gen
  3. kling    →  https://api.kuaishoux.com/v1/kling/video
```

---

## 🎙 Voice Mode with Whisper

Spilbergian listens to voice commands as an alternative to typing.

### Startup

```bash
# Wake-word mode (default) — say "Spilbergian, ..." before each command
spilbergian voice

# Continuous mode — transcribes everything
spilbergian voice --mode continuous
```

### Recognized voice commands

| Example phrase | Intent | Action |
|-----------------|--------|--------|
| *"Spilbergian, create a video about a cat lost in space"* | `create_movie` | `createMovie("a cat lost in space")` |
| *"Spilbergian, make a short film about a grandpa and his boat"* | `create_movie_short` | `createMovie(..., { format: 'short' })` |
| *"Spilbergian, create a vertical about quick recipes"* | `create_movie_vertical` | `createMovie(..., { format: 'vertical' })` |
| *"Spilbergian, upload the last video to YouTube"* | `upload_youtube` | uploads `currentProject` to YouTube |
| *"Spilbergian, edit with CapCut the project spilbergian-1234"* | `capcut_open` | opens the draft in CapCut Desktop |
| *"Spilbergian, train the model"* | `train` | launches `director.train()` |
| *"Spilbergian, train the cinematic phase"* | `train_phase` | launches `train({ phase: 'cinematic' })` |
| *"Spilbergian, status"* | `status` | prints `director.status()` |
| *"Spilbergian, stop"* | `stop` | stops voice mode |

### Hotwords

Hotwords are configured in `config/default.json` and passed to Whisper as a prompt to improve accuracy on domain-specific terms:

```json
"voice": {
  "whisper": {
    "hotwords": [
      "Spilbergian", "crea un video", "haz un video", "make a movie",
      "sube a YouTube", "render", "edita con CapCut", "_STOP_"
    ]
  }
}
```

### Without an OpenAI API key

If you don't have an `OPENAI_API_KEY`, install Whisper locally:

```bash
# Option A: Python Whisper
pip install openai-whisper
whisper --version  # verify

# Option B: whisper.cpp (much faster on CPU)
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
./models/download-ggml-model.sh base
./main --version
```

Spilbergian automatically detects which engine is available.

---

## 🎬 Cinematic Pipeline

The `MoviePipeline` runs 6 sequential phases. Each phase emits events that the CLI and the web use to show progress.

### Phase 1 — Plan

```
brief → CinematicBrain.plan() → MoviePlan
```

Output (`data/projects/<name>/plan.json`):

```json
{
  "id": "uuid",
  "brief": "A boy finds an old lantern...",
  "format": "short",
  "genre": "family",
  "language": "en",
  "durationSec": 60,
  "arc": [
    { "index": 0, "beat": "ordinary_world",        "tone": "calm_yearning" },
    { "index": 1, "beat": "inciting_incident",     "tone": "mysterious_awe" },
    ...
    { "index": 4, "beat": "resolution_and_wonder", "tone": "transcendent_wonder" }
  ],
  "script": {
    "title": "Chronicle of A boy finds an old",
    "scenes": [
      {
        "scene_number": 1,
        "location": "small town — kitchen / porch",
        "time_of_day": "morning — soft warm light",
        "description": "We meet our protagonist...",
        "voiceover": "Once, in a place where time seemed to stand still...",
        "tone": "calm_yearning",
        "duration_sec": 12
      },
      ...
    ]
  },
  "storyboard": [
    {
      "sceneRef": 1, "shotIndex": 1,
      "shotType": "wide_shot", "camera": "slow_push_in",
      "lighting": "natural_soft", "color": "amber_warm",
      "durationMs": 6000, "tone": "calm_yearning",
      "description": "We meet our protagonist... (Shot 1/2: wide_shot slow_push_in)"
    },
    ...
  ],
  "shotList": [ { "id": "shot_001", ... }, ... ],
  "renderPrompts": [ { "shotId": "shot_001", "prompt": "...", "durationSec": 6, ... } ],
  "title": "Chronicle of A boy finds an old",
  "description": "...",
  "tags": ["Spilbergian", "PREDATOR JUNGLE v3", ...],
  "thumbnailPrompt": "Close-up of protagonist face. Wide-eyed wonder..."
}
```

### Phase 2 — Video rendering

`RenderQueue` launches up to `maxConcurrentRenders` (default 3) renders in parallel through `VideoOrchestrator`. Each shot is tried first on the highest-priority provider; on failure it falls back to the next.

Result: `data/projects/<name>/video/shot_001_<hash>.mp4`, `shot_002_<hash>.mp4`, …

### Phase 3 — Audio composition

`AudioMixer` produces three layers and mixes them with ffmpeg:

1. **Soundtrack** — Udio first, Suno as fallback. Prompt: "Cinematic orchestral score in the style of John Williams…"
2. **Voiceover** — ElevenLabs with voice profiles per tone (e.g., `narrator_warm` for wonder, `character_villain` for peril)
3. **SFX** — ElevenLabs sound-effect API (thunder, magical chimes, rumbles, etc.)

Output: `data/projects/<name>/audio/final_mix.mp3`

### Phase 4 — Editing

`CapCutController.assemble()` produces the final MP4 via one of three backends:

- **capcut-cli** (preferred): renders the draft JSON headless
- **capcut-draft**: copies the draft into the CapCut Desktop project folder for manual editing
- **ffmpeg** (guaranteed fallback): `TimelineAssembler` normalizes each shot to 1920×1080/30fps, applies per-tone color grading, concatenates with cross-dissolves, and mixes audio with side-chain compression

Output: `data/projects/renders/<projectName>.mp4`

### Phase 5 — Thumbnail

`ThumbnailGenerator` produces a 1280×720 PNG with:
- Background image generated by cogview-3-plus (wonder-face style)
- Dark gradient at the bottom for title legibility
- Movie title in amber color (`#f4a261`)
- Tagline "Spilbergian · PREDATOR JUNGLE v3"

Output: `data/projects/<name>/thumbnail.png`

### Phase 6 — Finalize

Generates `manifest.json` with the ENTIRE project state (paths, metadata, style-adherence scores) for reproducibility and debugging.

---

## 🎥 Video Generation (Meta / Minimax / Kling / Runway / Pika)

All providers implement the same interface:

```javascript
class VideoGenerator {
  async generate(promptSpec, outPath) {
    // 1. If no API key, returns a placeholder
    // 2. POST to /v1/.../generate → returns task_id
    // 3. Poll /v1/.../status until status=completed
    // 4. Download video_url → outPath
    // 5. Return { path, cost, metadata }
  }
}
```

### Adding a new provider

1. Create `src/video/<MyProvider>VideoGenerator.js` extending `VideoGenerator`
2. Register it in `src/video/VideoOrchestrator.js` (`PROVIDER_CLASSES`)
3. Add it to `config/default.json` → `video.providers`

Minimal example:

```javascript
import { VideoGenerator } from './VideoGenerator.js';

export class MyProviderVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey = process.env.MYPROVIDER_API_KEY;
    this.endpoint = config.endpoint;
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) return this.savePlaceholder(promptSpec, outPath);
    // ... POST + poll + download
    return { path: outPath, cost: 0.1, metadata: { provider: 'myprovider' } };
  }
}
```

---

## 🎵 Audio Generation (Udio / Suno / ElevenLabs)

### Soundtrack

`AudioMixer._composeSoundtrack()` builds a cinematic prompt:

```
Cinematic orchestral score in the style of John Williams.
Genre: family. Tones: calm_yearning, mysterious_awe, wide_eyed_wonder.
Tempo: starts soft, builds to triumphant climax, ends with wonder.
Instrumentation: strings, brass, woodwinds, subtle choir.
Duration: 60 seconds. No vocals, no lyrics.
```

And sends it to Udio. If Udio fails (no API key, rate limit, etc.), it falls back to Suno automatically.

### Voiceover

Each scene with a `voiceover` is synthesized with ElevenLabs. The voice profile is selected based on tone:

```javascript
_voiceFor(scene) {
  if (scene.tone.includes('wonder'))    return 'narrator_warm';     // Adam
  if (scene.tone.includes('peril'))     return 'character_villain'; // Arnold
  if (scene.tone.includes('desolation')) return 'narrator_grandpa'; // Antoni
  return 'narrator_warm';
}
```

### SFX

SFX are generated via the ElevenLabs `eleven-v3` sound-effect endpoint:

```javascript
async generateSfx(prompt, outPath) {
  // POST https://api.elevenlabs.io/v1/sound-generation
  // { text: "distant thunder roll, cinematic, deep", prompt_influence: 0.3 }
}
```

SFX are **optional** — if generation fails, the pipeline continues without them.

### Final mix

ffmpeg with side-chain compression so the narrator is always intelligible over the music:

```
[0:a]volume=0.5[bg];
[bg][vo]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[bg2];
[bg2][sfx]amix=inputs=2:duration=longest:weights=1 0.6[out]
```

---

## ✂ Editing with CapCut

### Generating the Draft JSON

`CapCutDraftBuilder` produces a `draft_content.json` compatible with CapCut Desktop 3.x:

- **Tracks**: video (clips), voice (ElevenLabs VO), audio (soundtrack)
- **Segments**: one per shot, with `target_timerange` and `source_timerange`
- **Transitions**: 0.5s fade between consecutive shots
- **Effects**: color adjustment (brightness/saturation/temperature) per tone:
  - `wide_eyed_wonder` / `transcendent_wonder` → +brightness +saturation +temperature (golden hour)
  - `desolation` → −brightness −saturation −temperature (cold steel blue)
  - `triumphant_peril` → +contrast +saturation +temperature (punchy warm)
- **Keyframes**: slow push-in via scale keyframes (1.0 → 1.08) on `slow_push_in` shots

### Opening in CapCut Desktop

```bash
# Copy the draft into the CapCut Desktop project folder
spilbergian capcut open <projectName>
```

On Windows: copies to `%USERPROFILE%/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/`
On macOS: copies to `~/Library/Application Support/CapCut/User Data/Projects/com.lveditor.draft/`

Open CapCut Desktop and you'll see the project ready to edit manually.

### Headless render with CapCut CLI

If you have the `capcut` CLI binary (path configured in `editor.capcut.capcutCliPath`):

```bash
spilbergian capcut render <draft_path>
```

This executes:

```bash
capcut render \
  --project <draft_path> \
  --output <outPath> \
  --resolution 1920x1080 \
  --fps 30 \
  --bitrate 8M
```

### FFmpeg fallback

On Linux or without CapCut CLI, `TimelineAssembler` produces an equivalent MP4:

1. **Per-shot normalization**: each clip is re-encoded to 1920×1080, 30fps, yuv420p, with per-tone color grading via the `eq=` filter
2. **Concatenation**: ffmpeg concat demuxer
3. **Audio mixing**: amix with weights 1.0 (original video) and 0.6 (generated audio mix)

---

## 📺 Publishing to YouTube

### OAuth on first run

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 credentials of type **Desktop app**
3. Enable the **YouTube Data API v3**
4. Download the JSON and save it to `data/youtube/credentials.json`
5. Run:

```bash
spilbergian youtube:auth
```

A browser window opens, you authorize your channel, and the token is saved to `data/youtube/token.json`. Subsequent runs don't need to re-authorize.

### Manual upload

```bash
spilbergian youtube:upload data/projects/renders/my-movie.mp4 \
  --title "My Movie by Spilbergian" \
  --description "..." \
  --privacy private \
  --thumbnail data/projects/my-movie/thumbnail.png \
  --tags "Spilbergian,AI Director,Short film"
```

### Automatic upload inside the pipeline

```bash
spilbergian create "..." --upload
```

`SpilbergianDirector.createMovie()` will call `YouTubeUploader.upload()` at the end with the auto-generated metadata (title, description, tags, thumbnail).

### Scheduling publications

```javascript
import { SpilbergianDirector } from 'splibergian';

const director = new SpilbergianDirector();
await director.init();

// Upload on Friday at 18:00 Europe/Madrid (configurable)
const result = await director.createMovie("...", {});
await director.youtube.schedule(result.finalVideo, {
  title: result.title,
  description: result.description,
  thumbnail: result.thumbnailPath,
});
```

### List recent uploads

```bash
spilbergian youtube:list
```

---

## 🎓 Detailed Training

Spilbergian's training consists of **6 phases**. The first four inherit the PREDATOR v2.0 pipeline; the last two (V and VI) are new in v3.0 and specialize the agent in cinematic tasks.

### Phase I — Large-scale pre-training (default: 15 epochs)

The `ANN-Psi` backbone (12 layers: AJN + Transformer) is pre-trained with a large dataset of synthetic stimuli to stabilize later phases. Learning rate: cosine annealing from `eta=0.05` to `etaMin=0.001`.

```bash
spilbergian train --phase I --epochs 15
```

### Phase II — Addiction seeding (3 sub-phases × 8 epochs)

AJN neurons acquire "addiction" to specific stimuli across three sub-phases:

| Sub-phase | Goal | Behavior |
|-----------|------|----------|
| **II-T1** | Tolerance building | Gradually raises the θSat threshold |
| **II-T2** | Frustration hardening | Expands covariance to generate diversity |
| **II-T3** | Withdrawal cycle | Makes the craving return after saturation |

### Phase III — Hierarchical fine-tuning (HIFT, 12 epochs)

Hierarchical fine-tuning: the upper layers (concepts, praxic assembly) receive stronger gradients than the lower ones (sensory encoding). This preserves the representations learned in Phase I while specializing reasoning.

### Phase IV — Adversarial frustration hardening (10 epochs)

Adversarial stimuli designed to trigger cascade extinctions are injected. The Cascade Monitor learns to detect and self-heal these cases. Improves resilience to real-world failures.

### Phase V — Cinematic fine-tuning (NEW v3.0, 20 epochs)

This is the phase that turns PREDATOR into **Spilbergian**. For each sample in the `data/training/scenes/` dataset:

1. `CinematicBrain.plan(brief, opts)` generates a full plan (script + storyboard + shots)
2. `SpielbergPersona.styleAdherence(plan)` computes a 0..1 score
3. **Loss = 1 − adherence.score + structural penalties** (no title, fewer than 3 shots, etc.)
4. The backbone adjusts to minimize this loss

```bash
spilbergian train --phase cinematic --epochs 30
```

#### Dataset format

Each sample is a JSON in `data/training/scenes/`:

```json
[
  {
    "brief": "A lonely lighthouse keeper discovers a stranded mermaid at dawn.",
    "opts": { "format": "short", "genre": "family", "language": "en" },
    "expected": {
      "tones": ["wide_eyed_wonder", "transcendent_wonder"],
      "minShots": 6
    }
  },
  ...
]
```

If no samples are present, a built-in dataset of 6 scenes is used (in `src/training/CinematicDatasetLoader.js`). To seed it on disk and edit it:

```bash
spilbergian train --seed-datasets --phase all
ls data/training/scenes/
# builtin_scenes.json
```

### Phase VI — Style Reward (NEW v3.0, 15 epochs)

An **RLHF-lite** phase: the `StyleRewardModel` scores each generated plan on:

| Factor | Weight | How it's measured |
|--------|--------|-------------------|
| `persona.styleAdherence()` | 60% | Aggregate score (arc, signature shots, tone vocabulary, pacing) |
| Tone diversity | 15% | # of distinct tones / 6 |
| Pacing consistency | 10% | 1 − |cuts/min − default| / default |
| Title wonder keyword | 15% | Title contains "wonder", "hope", "journey", etc. |

The reward promotes plans that feel more Spielberg and penalizes generic ones. In a full implementation the reward gradients would flow back into the backbone; in this scaffold they are logged for traceability.

```bash
spilbergian train --phase style --epochs 20
```

### Full training

```bash
spilbergian train --phase all --seed-datasets
```

Typical output:

```
+-- Spilbergian Training Pipeline v3.0
|  Phase: all
|  Epochs: default
|  Seed datasets: yes

Training — phase I / epoch 15 — loss=0.0234
Training — phase II-T1 / epoch 8 — loss=0.0198
Training — phase II-T2 / epoch 8 — loss=0.0187
...
Training — phase V / epoch 20 — loss=0.3210
Training — phase VI / epoch 15 — reward=0.7823

Phase summaries:
  Phase I               — epochs: 15  final loss=0.0234
  Phase II-T1           — epochs: 8   final loss=0.0198
  Phase II-T2           — epochs: 8   final loss=0.0187
  Phase II-T3           — epochs: 8   final loss=0.0176
  Phase III             — epochs: 12  final loss=0.0143
  Phase IV              — epochs: 10  final loss=0.0121
  Phase V-cinematic     — epochs: 20  final loss=0.3210
  Phase VI-style-reward — epochs: 15  final reward=0.7823
```

### Early stopping and checkpoints

Inherited from v2.0:

- `earlyStoppingPatience: 7` — if loss doesn't improve for 7 consecutive epochs, the phase stops
- `enableCheckpoints: true` — a checkpoint is saved at the end of each phase in `data/checkpoints/`

### Data augmentation

| Type | Description |
|------|-------------|
| `augmentScenes` | Injects noise into briefs (synonyms, paraphrases) |
| `augmentAudio` | Changes pitch/tempo of audio samples |
| `augmentScripts` | Permutes the order of non-critical scenes |

---

## 🛠 Programmatic API

### Basic usage

```javascript
import { SpilbergianDirector } from 'splibergian';

const director = new SpilbergianDirector();
await director.init();

const result = await director.createMovie(
  'A boy finds an old lantern on the beach that releases a tiny galaxy',
  { format: 'short', genre: 'family', language: 'en' }
);

console.log(result.title);
console.log(result.finalVideo);
console.log(`Style adherence: ${(result.styleAdherence.score * 100).toFixed(1)}%`);
```

### Voice mode

```javascript
const director = new SpilbergianDirector({ voice: { commandMode: 'wake_word' } });
await director.init();

director.on('voice:transcript', (t) => console.log('Heard:', t));
director.on('voice:command',    (c) => console.log('Command:', c.intent));
director.on('project:complete', (p) => console.log('Movie ready:', p.result.finalVideo));

await director.startVoiceMode();
```

### Customizing the persona

```javascript
const director = new SpilbergianDirector({
  persona: {
    name: 'Nolanesque',
    inspiration: 'Christopher Nolan',
    preferredGenres: ['thriller', 'sci-fi'],
    toneKeywords: ['tension', 'time', 'memory', 'sacrifice'],
    narrativeBeats: ['ordinary_world', 'inciting_incident', 'midpoint_reversal',
                     'climactic_showdown', 'resolution_and_wonder'],
    pacing: { defaultCutsPerMinute: 6, actionCutsPerMinute: 22, emotionalCutsPerMinute: 2 },
  },
});
```

### With plugins

```javascript
import { renderBudgetAlertPlugin, movieAuditPlugin } from './plugins/example-plugin.js';

const director = new SpilbergianDirector();
director.plugins.use(renderBudgetAlertPlugin);
director.plugins.use(movieAuditPlugin);
```

### Low-level access

```javascript
// Only the cinematic brain (without the full pipeline)
const { CinematicBrain, SpielbergPersona } = require('splibergian');
const brain = new CinematicBrain(config, new SpielbergPersona(config.persona));
const plan = await brain.plan('...', { format: 'short' });

// Only Whisper
const { WhisperListener } = require('splibergian');
const listener = new WhisperListener({ whisper: { language: 'en' } });
await listener.init();
const text = await listener.transcribe('./audio.wav');
```

---

## 🔌 Plugin System

Available hooks (v3.0 adds the last two):

| Hook | Cancelable | When it fires |
|------|------------|---------------|
| `directiveReceived` | yes | When a text or voice command is received |
| `beforeStep` | yes | Before each pipeline step |
| `afterStep` | no | After each pipeline step |
| `beforeRender` | yes | **NEW v3.0** — before rendering each shot |
| `afterEmit` | no | After emitting each praxis |
| `taskComplete` | no | When a task completes |
| `movieComplete` | no | **NEW v3.0** — when a movie completes |
| `extinction` | no | On AJN extinction events |
| `trainingEpoch` | no | At the end of each training epoch |

Example plugin:

```javascript
export const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  priority: 50,
  hooks: {
    beforeRender: async (payload) => {
      console.log(`About to render ${payload.shotId}`);
      // To cancel: return { ...payload, _cancel: true };
      return payload;
    },
    movieComplete: async (payload) => {
      console.log(`Movie done: ${payload.result.finalVideo}`);
      return payload;
    },
  },
};
```

---

## 🐳 Docker Deployment

### Build

```bash
docker build -t spilbergian-v3 -f docker/Dockerfile .
```

### Run

```bash
docker run -it --rm \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config:ro \
  --env-file .env \
  spilbergian-v3 create "An astronaut discovers a flower on Mars"
```

### Docker Compose

```bash
docker-compose up -d
```

Includes a `llm` profile to spin up Ollama as a sidecar:

```bash
docker-compose --profile llm up
```

### Health check

The Dockerfile includes a `HEALTHCHECK` that pings `http://localhost:3000/health`. If you run the web (`npm run web`), the endpoint will be available.

---

## 📚 Theoretical References

The AJN framework that underpins Spilbergian is defined in:

- Tapiador Garcia, J. (2024). *Agentic Theory: Definition of the Artificial Junky Neuron (AJN).* WALLERMAX-AI 2604.00012.
- Tapiador Garcia, J. (2024). *Agentic Theory II: The AJN and ANN-Psi.* WALLERMAX-AI 2604.00013.
- Tapiador Garcia, J. (2024). *Agentic Theory III: Stimulus Tensor Propagation.* WALLERMAX-AI 2604.00014.

The cinematic decisions of the "Spilbergian" persona are inspired by public analyses of Steven Spielberg's filmography, in particular:

- *Bordwell, D. & Thompson, K.* — Film Art: An Introduction
- *Mott, D.* — The Style of Steven Spielberg (visual analysis)
- *Kaminski, J.* (DP) — interviews about Spielberg's cinematography

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

**v3.0 "Spilbergian" (c) 2024-2026. Based on Agentic Theory by Justo Tapiador García (UA).**

---

<div align="center">
<i>Spilbergian v3.0 — "Every movie deserves to end with a shot of the sky."</i>
</div>
