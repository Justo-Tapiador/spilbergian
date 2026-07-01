# PREDATOR JUNGLE v3.0 — *"Spilbergian"*

### Praxic Reinforcement and Extinction-Driven Agentic Task Orchestrator and Realizer — Cinematic Director Edition

> Un agente de IA cinematográfico autónomo construido sobre el framework **Artificial Junky Neuron (AJN)** por **Justo Tapiador García (UA)**.
> v3.0 transforma a PREDATOR en un **director de cine virtual estilo Steven Spielberg** que genera, edita y publica videos completos en YouTube sin intervención humana.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.0.0-blue)](https://github.com/Justo-Tapiador/spilbergian)
[![Codename](https://img.shields.io/badge/codename-Spilbergian-magenta)](#)

---

<div align="center">
<h1>Spilbergian — es una AI Director Cinematográfico </h1>
<i><b>"Spilbergian</b> no solo crea videos: los <b>dirige</b>. Piensa en planos, en compases, en emociones. Su único objetivo es que el espectador sienta algo —y lo sienta de la manera en que Spielberg lo habría filmado."</i><p></p>
</div>

<div align="center">
<img src="https://github.com/user-attachments/assets/dce59cef-df12-4af9-87fd-ca7792e56ab6" alt="Spilbergian — AI Cinematic Director""  width="640"/>
</div>
---

## 📑 Tabla de Contenidos

1. [Novedades en v3.0](#-novedades-en-v30)
2. [Arquitectura](#-arquitectura)
3. [Instalación](#-instalación)
4. [Configuración](#-configuración)
5. [Guía rápida](#-guía-rápida)
6. [Modo voz con Whisper](#-modo-voz-con-whisper)
7. [Pipeline cinematográfico](#-pipeline-cinematográfico)
8. [Generación de video](#-generación-de-video-meta--minimax--kling--runway--pika)
9. [Generación de audio](#-generación-de-audio-udio--suno--elevenlabs)
10. [Edición con CapCut](#-edición-con-capcut)
11. [Publicación en YouTube](#-publicación-en-youtube)
12. [Entrenamiento detallado](#-entrenamiento-detallado)
13. [API programática](#-api-programática)
14. [Sistema de plugins](#-sistema-de-plugins)
15. [Despliegue con Docker](#-despliegue-con-docker)
16. [Referencias teóricas](#-referencias-teóricas)
17. [Licencia](#-licencia)

---

## 🆕 Novedades en v3.0

v3.0 es un **salto cualitativo** respecto a v2.0: PREDATOR deja de ser un agente genérico y se especializa como **director cinematográfico autónomo**. Las novedades se agrupan en cinco áreas:

### 1. Personalidad directiva — "Spilbergian"

| Característica | Descripción |
|----------------|-------------|
| **Persona codificada** | Vocabulario, paleta, ritmo de cortes y arcos narrativos extraídos del canon de Steven Spielberg |
| **9 beat arcs** | `ordinary_world → inciting_incident → reluctant_hero → threshold_crossing → rising_action → midpoint_reversal → dark_night_of_soul → climactic_showdown → resolution_and_wonder` |
| **Técnicas signature** | Long-take suspense, wide-eyed wonder, silhouette against sky, amber backlight, child POV, Spielberg face, John-Williams swelling score, machine POV reveal |
| **Style adherence scorer** | Cada plan recibe un score 0..1 de cuán "Spielberg" es, usado como reward en entrenamiento |

### 2. Pipeline cinematográfico completo

| Etapa | Módulo | Salida |
|-------|--------|--------|
| **Plan** | `CinematicBrain` | script + storyboard + shot list + render prompts |
| **Render** | `VideoOrchestrator` + 5 providers | clips MP4 por plano |
| **Audio** | `AudioMixer` (Udio + Suno + ElevenLabs) | soundtrack + voiceover + SFX mezclados |
| **Edición** | `CapCutController` (CapCut draft + ffmpeg fallback) | MP4 final montado |
| **Thumbnail** | `ThumbnailGenerator` | PNG 1280×720 estilo wonder-face |
| **Publicación** | `YouTubeUploader` (OAuth + Data API v3) | video live en YouTube |

### 3. Integraciones de generación de video

| Provider | Modelo | Estado por defecto | Coste aprox. |
|----------|--------|--------------------|--------------|
| **Minimax** (Hailuo) | `video-01` | habilitado (prioridad 1) | ~$0.10/s 720p |
| **Meta Movie Gen** | `movie-gen-2` | habilitado (prioridad 2) | ~$0.35/s 1080p |
| **Kling (Kuaishou)** | `kling-v2` | habilitado (prioridad 3) | ~$0.20/s 1080p |
| **Runway Gen-3 Alpha** | `gen-3-alpha` | deshabilitado | ~$0.50/s 1080p |
| **Pika 1.5** | `pika-1.5` | deshabilitado | ~$0.15/s 720p |

`VideoOrchestrator` prueba los providers en orden de prioridad y cae al siguiente ante cualquier fallo, garantizando resiliencia.

### 4. Generación de audio multi-provider

| Provider | Especialidad | Estado por defecto |
|----------|--------------|--------------------|
| **Udio** | Banda sonora orquestal instrumental | habilitado |
| **Suno** | Banda sonora (fallback de Udio) | habilitado |
| **ElevenLabs** | Voiceover multivoz + SFX | habilitado |

Sistema de **perfiles de voz** preconfigurados: `narrator_warm`, `narrator_grandpa`, `character_child`, `character_villain`, `character_ally`, `news_anchor`. Cada perfil ajusta `stability`, `similarity_boost` y `style` según el tono de la escena.

### 5. Edición con CapCut

Tres mecanismos complementarios según el entorno:

1. **CapCut Draft JSON** — Genera `draft_content.json` listo para abrir en CapCut Desktop (Windows/macOS). Incluye clips en timeline, transiciones fade, ajustes de color por tono, keyframes para slow push-in.
2. **CapCut CLI** — Si está instalado el binario `capcut` headless, renderiza sin GUI.
3. **FFmpeg fallback** — En servidores Linux sin CapCut, `TimelineAssembler` produce un MP4 equivalente con normalización por plano, mezcla audio side-chain y color grade por tono.

### 6. Comandos de voz con Whisper

`WhisperListener` soporta tres modos:

| Modo | Comportamiento |
|------|----------------|
| `continuous` | Transcribe todo lo que oye, sin filtro |
| `wake_word` *(default)* | Espera la palabra "Spilbergian" antes de capturar el comando |
| `push_to_talk` | Graba durante una ventana fija |

Motores soportados (en orden de preferencia):
1. **OpenAI Whisper API** (si `OPENAI_API_KEY` está presente)
2. **whisper** CLI (instalación local del binario Python)
3. **whisper.cpp** (instalación local C++)

Captura de audio vía `sox`/`rec` (cross-platform) o `ffmpeg` como fallback. Detección de silencio (VAD) configurable.

### 7. Publicación en YouTube

- **OAuth 2.0** con token caching (`data/youtube/token.json`)
- Subida **resumable** con barra de progreso vía `youtube.videos.insert`
- **Thumbnails automáticos** generados con estilo "wonder face" y título compuesto con `sharp`
- **Programación de publicaciones** (día + hora preferidos, tz configurable)
- Listado de últimos uploads para verificación

---

## 🧠 Arquitectura

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

## 📦 Instalación

### Requisitos previos

| Software | Versión mínima | Para qué se usa |
|----------|----------------|-----------------|
| **Node.js** | 18.0+ | runtime principal |
| **ffmpeg** | 5.0+ | ensamblado de video (fallback CapCut) |
| **sox** | 14.4+ | captura de audio para Whisper |
| **Python 3** | 3.10+ | solo si usas whisper Python CLI |
| **CapCut Desktop** | 3.x | solo si quieres abrir drafts en GUI |

### Instalación estándar

```bash
git clone https://github.com/Justo-Tapiador/spilbergian.git
cd spilbergian
git checkout v3.0        # si está publicada como rama/tag
npm install
cp .env.example .env     # editar con tus API keys
```

### Verificación rápida

```bash
# Comprobar que el agente arranca
node scripts/cli.js status

# Lanzar los tests de humo
npm test

# Sembrar datasets de entrenamiento built-in
node scripts/train-spilbergian.js --seed-datasets --phase all --epochs 2
```

### Instalación con Docker

```bash
docker build -t spilbergian-v3 -f docker/Dockerfile .
docker run -it --rm \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config:ro \
  --env-file .env \
  spilbergian-v3 status
```

Para desarrollo con Ollama (LLM local) como sidecar:

```bash
docker-compose --profile llm up
```

---

## ⚙️ Configuración

La configuración sigue el sistema **en capas** heredado de v2.0:

1. `config/default.json` — valores por defecto
2. `config/{NODE_ENV}.json` — overrides por entorno
3. `.env` — variables de entorno (cargado por `dotenv`)
4. `process.env` con prefijos `PREDATOR_*` o `SPILBERGIAN_*`
5. Overrides explícitos pasados al constructor

El resultado se valida con **Zod** (`config/schema.js`). Cualquier campo desconocido o tipo incorrecto provoca un fallo claro al arrancar.

### Variables de entorno clave

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ZAI_API_KEY` | — | API key para z-ai-web-dev-sdk (LLM + imagen) |
| `OPENAI_API_KEY` | — | API key para Whisper API y OpenAI-compatible LLM |
| `MINIMAX_API_KEY` | — | Minimax video generation |
| `META_AI_API_KEY` | — | Meta Movie Gen |
| `KLING_API_KEY` | — | Kling video |
| `UDIO_API_KEY` | — | Udio soundtrack |
| `SUNO_API_KEY` | — | Suno soundtrack |
| `ELEVENLABS_API_KEY` | — | ElevenLabs voiceover + SFX |
| `WHISPER_MODEL` | `base` | Modelo Whisper: tiny/base/small/medium/large-v3 |
| `WHISPER_LANGUAGE` | `es` | Idioma de transcripción |
| `PREDATOR_SAFETY__SAFETY_LEVEL` | `standard` | permissive / standard / strict |
| `SPILBERGIAN_VOICE__COMMAND_MODE` | `wake_word` | continuous / wake_word / push_to_talk |
| `SPILBERGIAN_YOUTUBE__DEFAULT_PRIVACY` | `private` | private / unlisted / public |

### Configuración del canal de YouTube

Edita `config/default.json`:

```json
"youtube": {
  "channelId": "UCxxxxxxxxxxxx",
  "channelName": "Mi Canal de Cine IA",
  "defaultPrivacy": "private",
  "defaultTags": ["Spilbergian", "AI Director", "Predator Jungle v3"],
  "defaultLanguage": "es",
  "publishSchedule": {
    "frequency": "weekly",
    "preferredDay": "friday",
    "preferredTime": "18:00",
    "timezone": "Europe/Madrid"
  }
}
```

Y descarga tus credenciales OAuth desde Google Cloud Console a `data/youtube/credentials.json` (tipo "Desktop app").

---

## 🚀 Guía rápida

### Crear un cortometraje desde texto

```bash
# Cortometraje familiar en español, 60s
spilbergian create "Un niño encuentra una vieja linterna en la playa que libera una pequeña galaxia" \
  --format short --genre family --language es

# Con subida automática a YouTube
spilbergian create "..." --upload

# Vertical (para Shorts/Reels)
spilbergian create "..." --format vertical

# Featurette de 3 minutos
spilbergian create "..." --format featurette --duration 180
```

### Entrenar el modelo

```bash
# Entrenamiento completo (6 fases)
spilbergian train --phase all

# Solo la fase cinematográfica nueva
spilbergian train --phase cinematic --epochs 30

# Solo la fase de style reward (RLHF-lite)
spilbergian train --phase style --epochs 20

# Sembrar datasets built-in antes del primer entrenamiento
spilbergian train --seed-datasets --phase all
```

### Estado del agente

```bash
spilbergian status
```

Salida esperada:

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

## 🎙 Modo voz con Whisper

Spilbergian escucha comandos de voz como alternativa a escribir.

### Arranque

```bash
# Modo wake word (default) — di "Spilbergian, ..." antes de cada comando
spilbergian voice

# Modo continuo — transcribe todo
spilbergian voice --mode continuous
```

### Comandos de voz reconocidos

| Ejemplo de frase | Intención | Acción |
|-------------------|-----------|--------|
| *"Spilbergian, crea un video sobre un gato perdido en el espacio"* | `create_movie` | `createMovie("un gato perdido en el espacio")` |
| *"Spilbergian, haz un cortometraje de un abuelo y su barco"* | `create_movie_short` | `createMovie(..., { format: 'short' })` |
| *"Spilbergian, crea un vertical sobre recetas rápidas"* | `create_movie_vertical` | `createMovie(..., { format: 'vertical' })` |
| *"Spilbergian, sube el último video a YouTube"* | `upload_youtube` | sube `currentProject` a YouTube |
| *"Spilbergian, edita con CapCut el proyecto spilbergian-1234"* | `capcut_open` | abre el draft en CapCut Desktop |
| *"Spilbergian, entrena el modelo"* | `train` | lanza `director.train()` |
| *"Spilbergian, entrena la fase cinematic"* | `train_phase` | lanza `train({ phase: 'cinematic' })` |
| *"Spilbergian, estado"* | `status` | imprime `director.status()` |
| *"Spilbergian, para"* | `stop` | detiene el modo voz |

### Hotwords

Las hotwords se configuran en `config/default.json` y se pasan a Whisper como prompt para mejorar la precisión de términos del dominio:

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

### Sin API key de OpenAI

Si no tienes `OPENAI_API_KEY`, instala Whisper localmente:

```bash
# Opción A: Whisper Python
pip install openai-whisper
whisper --version  # verificar

# Opción B: whisper.cpp (mucho más rápido en CPU)
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
./models/download-ggml-model.sh base
./main --version
```

Spilbergian detecta automáticamente cuál motor está disponible.

---

## 🎬 Pipeline cinematográfico

El `MoviePipeline` ejecuta 6 fases secuenciales. Cada fase emite eventos que el CLI y la web usan para mostrar progreso.

### Fase 1 — Plan

```
brief → CinematicBrain.plan() → MoviePlan
```

Salida (`data/projects/<name>/plan.json`):

```json
{
  "id": "uuid",
  "brief": "Un niño encuentra una vieja linterna...",
  "format": "short",
  "genre": "family",
  "language": "es",
  "durationSec": 60,
  "arc": [
    { "index": 0, "beat": "ordinary_world",        "tone": "calm_yearning" },
    { "index": 1, "beat": "inciting_incident",     "tone": "mysterious_awe" },
    ...
    { "index": 4, "beat": "resolution_and_wonder", "tone": "transcendent_wonder" }
  ],
  "script": {
    "title": "Crónica de Un niño encuentra una vieja",
    "scenes": [
      {
        "scene_number": 1,
        "location": "small town — kitchen / porch",
        "time_of_day": "morning — soft warm light",
        "description": "We meet our protagonist...",
        "voiceover": "Había una vez, en un lugar donde el tiempo parecía detenido...",
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
  "title": "Crónica de Un niño encuentra una vieja",
  "description": "...",
  "tags": ["Spilbergian", "PREDATOR JUNGLE v3", ...],
  "thumbnailPrompt": "Close-up of protagonist face. Wide-eyed wonder..."
}
```

### Fase 2 — Render de video

`RenderQueue` lanza hasta `maxConcurrentRenders` (default 3) renders en paralelo a través de `VideoOrchestrator`. Cada plano se prueba primero en el provider de mayor prioridad; si falla, cae al siguiente.

Resultado: `data/projects/<name>/video/shot_001_<hash>.mp4`, `shot_002_<hash>.mp4`, …

### Fase 3 — Composición de audio

`AudioMixer` produce tres capas y las mezcla con ffmpeg:

1. **Soundtrack** — Udio primero, Suno como fallback. Prompt: "Cinematic orchestral score in the style of John Williams…"
2. **Voiceover** — ElevenLabs con perfiles de voz por tono (e.g., `narrator_warm` para wonder, `character_villain` para peril)
3. **SFX** — ElevenLabs sound-effect API (truenos, campanas mágicas, rumores, etc.)

Salida: `data/projects/<name>/audio/final_mix.mp3`

### Fase 4 — Edición

`CapCutController.assemble()` produce el MP4 final mediante uno de tres backends:

- **capcut-cli** (preferido): renderiza el draft JSON headless
- **capcut-draft**: copia el draft a la carpeta de CapCut Desktop para edición manual
- **ffmpeg** (fallback garantizado): `TimelineAssembler` normaliza cada plano a 1920×1080/30fps, aplica color grade por tono, concatena con cross-dissolves y mezcla audio con side-chain compression

Salida: `data/projects/renders/<projectName>.mp4`

### Fase 5 — Thumbnail

`ThumbnailGenerator` genera un PNG 1280×720 con:
- Imagen de fondo generada por cogview-3-plus (estilo wonder face)
- Gradiente inferior oscuro para legibilidad del título
- Título de la película en color ámbar (`#f4a261`)
- Tagline "Spilbergian · PREDATOR JUNGLE v3"

Salida: `data/projects/<name>/thumbnail.png`

### Fase 6 — Finalize

Genera `manifest.json` con TODO el estado del proyecto (rutas, metadatos, scores de style adherence) para reproducibilidad y depuración.

---

## 🎥 Generación de video (Meta / Minimax / Kling / Runway / Pika)

Todos los providers implementan la misma interfaz:

```javascript
class VideoGenerator {
  async generate(promptSpec, outPath) {
    // 1. Si no hay API key, devuelve un placeholder
    // 2. POST a /v1/.../generate → devuelve task_id
    // 3. Poll /v1/.../status hasta que status=completed
    // 4. Download video_url → outPath
    // 5. Return { path, cost, metadata }
  }
}
```

### Añadir un nuevo provider

1. Crea `src/video/<MiProvider>VideoGenerator.js` extendiendo `VideoGenerator`
2. Regístralo en `src/video/VideoOrchestrator.js` (`PROVIDER_CLASSES`)
3. Añádelo a `config/default.json` → `video.providers`

Ejemplo mínimo:

```javascript
import { VideoGenerator } from './VideoGenerator.js';

export class MiProviderVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey = process.env.MIPROVIDER_API_KEY;
    this.endpoint = config.endpoint;
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) return this.savePlaceholder(promptSpec, outPath);
    // ... POST + poll + download
    return { path: outPath, cost: 0.1, metadata: { provider: 'miprovider' } };
  }
}
```

---

## 🎵 Generación de audio (Udio / Suno / ElevenLabs)

### Soundtrack

`AudioMixer._composeSoundtrack()` construye un prompt cinematográfico:

```
Cinematic orchestral score in the style of John Williams.
Genre: family. Tones: calm_yearning, mysterious_awe, wide_eyed_wonder.
Tempo: starts soft, builds to triumphant climax, ends with wonder.
Instrumentation: strings, brass, woodwinds, subtle choir.
Duration: 60 seconds. No vocals, no lyrics.
```

Y lo envía a Udio. Si Udio falla (sin API key, rate limit, etc.), cae a Suno automáticamente.

### Voiceover

Cada escena con `voiceover` se sintetiza con ElevenLabs. El perfil de voz se selecciona según el tono:

```javascript
_voiceFor(scene) {
  if (scene.tone.includes('wonder'))    return 'narrator_warm';     // Adam
  if (scene.tone.includes('peril'))     return 'character_villain'; // Arnold
  if (scene.tone.includes('desolation')) return 'narrator_grandpa'; // Antoni
  return 'narrator_warm';
}
```

### SFX

Los SFX se generan vía el endpoint `eleven-v3` de ElevenLabs:

```javascript
async generateSfx(prompt, outPath) {
  // POST https://api.elevenlabs.io/v1/sound-generation
  // { text: "distant thunder roll, cinematic, deep", prompt_influence: 0.3 }
}
```

SFX son **opcionales** — si la generación falla, el pipeline continúa sin ellos.

### Mezcla final

ffmpeg con side-chain compression para que el narrador siempre se entienda por encima de la música:

```
[0:a]volume=0.5[bg];
[bg][vo]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[bg2];
[bg2][sfx]amix=inputs=2:duration=longest:weights=1 0.6[out]
```

---

## ✂ Edición con CapCut

### Generación del Draft JSON

`CapCutDraftBuilder` produce un `draft_content.json` compatible con CapCut Desktop 3.x:

- **Tracks**: video (clips), voice (ElevenLabs VO), audio (soundtrack)
- **Segments**: uno por plano, con `target_timerange` y `source_timerange`
- **Transitions**: fade de 0.5s entre planos consecutivos
- **Effects**: ajuste de color (brightness/saturation/temperature) según tono:
  - `wide_eyed_wonder` / `transcendent_wonder` → +brightness +saturation +temperature (golden hour)
  - `desolation` → −brightness −saturation −temperature (cold steel blue)
  - `triumphant_peril` → +contrast +saturation +temperature (punchy warm)
- **Keyframes**: slow push-in mediante keyframes de scale (1.0 → 1.08) en planos `slow_push_in`

### Abrir en CapCut Desktop

```bash
# Copia el draft a la carpeta de proyectos de CapCut Desktop
spilbergian capcut open <projectName>
```

En Windows: copia a `%USERPROFILE%/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/`
En macOS: copia a `~/Library/Application Support/CapCut/User Data/Projects/com.lveditor.draft/`

Abre CapCut Desktop y verás el proyecto listo para editar manualmente.

### Render headless con CapCut CLI

Si tienes el binario `capcut` CLI (path configurado en `editor.capcut.capcutCliPath`):

```bash
spilbergian capcut render <draft_path>
```

Esto ejecuta:

```bash
capcut render \
  --project <draft_path> \
  --output <outPath> \
  --resolution 1920x1080 \
  --fps 30 \
  --bitrate 8M
```

### Fallback FFmpeg

En Linux o sin CapCut CLI, `TimelineAssembler` produce un MP4 equivalente:

1. **Normalización por plano**: cada clip se re-encodea a 1920×1080, 30fps, yuv420p, con color grade por tono vía filtro `eq=`
2. **Concatenación**: ffmpeg concat demuxer
3. **Mezcla de audio**: amix con pesos 1.0 (video original) y 0.6 (mezcla audio generada)

---

## 📺 Publicación en YouTube

### OAuth por primera vez

1. Ve a https://console.cloud.google.com/apis/credentials
2. Crea credenciales OAuth 2.0 tipo **Desktop app**
3. Habilita **YouTube Data API v3**
4. Descarga el JSON y guárdalo en `data/youtube/credentials.json`
5. Ejecuta:

```bash
spilbergian youtube:auth
```

Se abrirá el navegador, autorizas tu canal, y el token se guarda en `data/youtube/token.json`. Las siguientes veces no necesitas volver a autorizar.

### Subida manual

```bash
spilbergian youtube:upload data/projects/renders/mi-pelicula.mp4 \
  --title "Mi Película by Spilbergian" \
  --description "..." \
  --privacy private \
  --thumbnail data/projects/mi-pelicula/thumbnail.png \
  --tags "Spilbergian,AI Director,Cortometraje"
```

### Subida automática dentro del pipeline

```bash
spilbergian create "..." --upload
```

El `SpilbergianDirector.createMovie()` llamará a `YouTubeUploader.upload()` al final con los metadatos autogenerados (título, descripción, tags, thumbnail).

### Programación de publicaciones

```javascript
import { SpilbergianDirector } from 'spilbergian';

const director = new SpilbergianDirector();
await director.init();

// Sube el viernes a las 18:00 Europe/Madrid (configurable)
const result = await director.createMovie("...", {});
await director.youtube.schedule(result.finalVideo, {
  title: result.title,
  description: result.description,
  thumbnail: result.thumbnailPath,
});
```

### Listar últimos uploads

```bash
spilbergian youtube:list
```

---

## 🎓 Entrenamiento detallado

El entrenamiento de Spilbergian consta de **6 fases**. Las 4 primeras heredan el pipeline PREDATOR v2.0; las dos últimas (V y VI) son nuevas en v3.0 y especializan al agente en tareas cinematográficas.

### Fase I — Pre-entrenamiento a gran escala (default: 15 épocas)

El backbone `ANN-Psi` (12 capas: AJN + Transformer) se pre-entrena con un dataset grande de estímulos sintéticos para estabilizar las fases posteriores. Learning rate: cosine annealing desde `eta=0.05` hasta `etaMin=0.001`.

```bash
spilbergian train --phase I --epochs 15
```

### Fase II — Siembra de adicción (3 sub-fases × 8 épocas)

Las neuronas AJN adquieren "adicción" a estímulos específicos en tres sub-fases:

| Sub-fase | Objetivo | Comportamiento |
|----------|----------|----------------|
| **II-T1** | Tolerance building | Aumenta el umbral θSat paulatinamente |
| **II-T2** | Frustration hardening | Expande la covarianza para generar diversidad |
| **II-T3** | Withdrawal cycle | Hace que la craving vuelva tras saturación |

### Fase III — Hierarchical fine-tuning (HIFT, 12 épocas)

Fine-tuning jerárquico: las capas superiores (conceptos, praxic assembly) reciben gradientes más fuertes que las inferiores (sensory encoding). Esto preserva la representación aprendida en Fase I mientras especializa el razonamiento.

### Fase IV — Adversarial frustration hardening (10 épocas)

Se inyectan estímulos adversarios diseñados para provocar extinciones en cadena. El Cascade Monitor aprende a detectar y auto-reparar estos casos. Mejora la resiliencia ante fallos reales.

### Fase V — Cinematic fine-tuning (NUEVO v3.0, 20 épocas)

Esta es la fase que convierte a PREDATOR en **Spilbergian**. Para cada muestra del dataset `data/training/scenes/`:

1. `CinematicBrain.plan(brief, opts)` genera un plan completo (script + storyboard + shots)
2. `SpielbergPersona.styleAdherence(plan)` computa un score 0..1
3. **Loss = 1 − adherence.score + penalizaciones estructurales** (sin título, menos de 3 planos, etc.)
4. El backbone ajusta para minimizar esta loss

```bash
spilbergian train --phase cinematic --epochs 30
```

#### Formato del dataset

Cada muestra es un JSON en `data/training/scenes/`:

```json
[
  {
    "brief": "A lonely lighthouse keeper discovers a stranded mermaid at dawn.",
    "opts": { "format": "short", "genre": "family", "language": "es" },
    "expected": {
      "tones": ["wide_eyed_wonder", "transcendent_wonder"],
      "minShots": 6
    }
  },
  ...
]
```

Si no hay muestras, se usa un dataset built-in de 6 escenas (en `src/training/CinematicDatasetLoader.js`). Para sembrarlo en disco y editarlo:

```bash
spilbergian train --seed-datasets --phase all
ls data/training/scenes/
# builtin_scenes.json
```

### Fase VI — Style Reward (NUEVO v3.0, 15 épocas)

Fase tipo **RLHF-lite**: el `StyleRewardModel` puntúa cada plan generado según:

| Factor | Peso | Cómo se mide |
|--------|------|--------------|
| `persona.styleAdherence()` | 60% | Score agregado (arc, signature shots, tone vocabulary, pacing) |
| Diversidad de tonos | 15% | # de tonos distintos / 6 |
| Consistencia de pacing | 10% | 1 − |cuts/min − default| / default |
| Title keyword wonder | 15% | Título contiene "wonder", "esperanza", "viaje", etc. |

El reward promueve planes que se sientan más Spielberg y penaliza los genéricos. En una implementación completa, los gradientes del reward fluirían de vuelta al backbone; en este scaffold se loguean para trazabilidad.

```bash
spilbergian train --phase style --epochs 20
```

### Entrenamiento completo

```bash
spilbergian train --phase all --seed-datasets
```

Salida típica:

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

### Early stopping y checkpoints

Heredados de v2.0:

- `earlyStoppingPatience: 7` — si la loss no mejora en 7 épocas consecutivas, se detiene la fase
- `enableCheckpoints: true` — se guarda un checkpoint al final de cada fase en `data/checkpoints/`

### Aumentación de datos

| Tipo | Descripción |
|------|-------------|
| `augmentScenes` | Inyecta ruido en los briefs (sinónimos, paráfrasis) |
| `augmentAudio` | Cambia pitch/tempo de los samples de audio |
| `augmentScripts` | Permuta el orden de escenas no críticas |

---

## 🛠 API programática

### Uso básico

```javascript
import { SpilbergianDirector } from 'spilbergian';

const director = new SpilbergianDirector();
await director.init();

const result = await director.createMovie(
  'Un niño encuentra una vieja linterna en la playa que libera una pequeña galaxia',
  { format: 'short', genre: 'family', language: 'es' }
);

console.log(result.title);
console.log(result.finalVideo);
console.log(`Style adherence: ${(result.styleAdherence.score * 100).toFixed(1)}%`);
```

### Modo voz

```javascript
const director = new SpilbergianDirector({ voice: { commandMode: 'wake_word' } });
await director.init();

director.on('voice:transcript', (t) => console.log('Heard:', t));
director.on('voice:command',    (c) => console.log('Command:', c.intent));
director.on('project:complete', (p) => console.log('Movie ready:', p.result.finalVideo));

await director.startVoiceMode();
```

### Personalizar la persona

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

### Con plugins

```javascript
import { renderBudgetAlertPlugin, movieAuditPlugin } from './plugins/example-plugin.js';

const director = new SpilbergianDirector();
director.plugins.use(renderBudgetAlertPlugin);
director.plugins.use(movieAuditPlugin);
```

### Acceso a bajo nivel

```javascript
// Solo el cerebro cinematográfico (sin pipeline completo)
const { CinematicBrain, SpielbergPersona } = require('spilbergian');
const brain = new CinematicBrain(config, new SpielbergPersona(config.persona));
const plan = await brain.plan('...', { format: 'short' });

// Solo Whisper
const { WhisperListener } = require('spilbergian');
const listener = new WhisperListener({ whisper: { language: 'es' } });
await listener.init();
const text = await listener.transcribe('./audio.wav');
```

---

## 🔌 Sistema de plugins

Hooks disponibles (v3.0 añade los dos últimos):

| Hook | Cancelable | Cuándo se dispara |
|------|------------|-------------------|
| `directiveReceived` | sí | Al recibir un comando de texto o voz |
| `beforeStep` | sí | Antes de cada step del pipeline |
| `afterStep` | no | Después de cada step |
| `beforeRender` | sí | **NUEVO v3.0** — antes de renderizar cada plano |
| `afterEmit` | no | Después de emitir cada praxis |
| `taskComplete` | no | Al completar una tarea |
| `movieComplete` | no | **NUEVO v3.0** — al completar una película |
| `extinction` | no | En eventos de extinción AJN |
| `trainingEpoch` | no | Al final de cada época de entrenamiento |

Ejemplo de plugin:

```javascript
export const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  priority: 50,
  hooks: {
    beforeRender: async (payload) => {
      console.log(`About to render ${payload.shotId}`);
      // Para cancelar: return { ...payload, _cancel: true };
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

## 🐳 Despliegue con Docker

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
  spilbergian-v3 create "Un astronauta descubre una flor en Marte"
```

### Docker Compose

```bash
docker-compose up -d
```

Incluye profile `llm` para levantar Ollama como sidecar:

```bash
docker-compose --profile llm up
```

### Health check

El Dockerfile incluye `HEALTHCHECK` que comprueba `http://localhost:3000/health`. Si levantas la web (`npm run web`), el endpoint estará disponible.

---

## 📚 Referencias teóricas

El framework AJN en el que se basa Spilbergian está definido en:

- Tapiador Garcia, J. (2024). *Agentic Theory: Definition of the Artificial Junky Neuron (AJN).* WALLERMAX-AI 2604.00012.
- Tapiador Garcia, J. (2024). *Agentic Theory II: The AJN and ANN-Psi.* WALLERMAX-AI 2604.00013.
- Tapiador Garcia, J. (2024). *Agentic Theory III: Stimulus Tensor Propagation.* WALLERMAX-AI 2604.00014.

Las decisiones cinematográficas de la persona "Spilbergian" están inspiradas en el análisis público de la filmografía de Steven Spielberg, en particular:

- *Bordwell, D. & Thompson, K.* — Film Art: An Introduction
- *Mott, D.* — The Style of Steven Spielberg (análisis visual)
- *Kaminski, J.* (DP) — entrevistas sobre la fotografía de Spielberg

---

## 📄 Licencia

MIT License — ver [LICENSE](LICENSE) para detalles.

**v3.0 "Spilbergian" (c) 2024-2026. Basado en Agentic Theory por Justo Tapiador García (UA).**

---

<div align="center">
<i>Spilbergian v3.0 — "Toda película merece terminar con un plano al cielo."</i>
</div>
