# Threlte Live - 3D VRM Avatar Streaming Platform

A SvelteKit application for live-streaming 3D VRM avatars with AI-powered chat, text-to-speech, mixamo animations.

![Banner!](showcase.png 'Showcase')
[Click to see showcase video](showcase.mp4)

## Features

- Threlte/Three.js for 3D rendering
- VRM avatar loading and animation with @pixiv/three-vrm
- **Multi-LLM Support**: Google Generative AI, Ollama, and LM Studio
- Text-to-speech with lip-sync
- Chat interface
- Mixamo animation integration

See [roadmap.md](roadmap.md) for full details and planned features.

### Text-to-Speech and Phonemes

The project uses ElevenLabs TTS with phoneme timings for VRM lip-sync.

Learn more:

- [What is a Phoneme](https://elevenlabs.io/blog/what-is-a-phoneme)
- [Prompting Controls](https://elevenlabs.io/docs/best-practices/prompting/controls)

Phonemes mapped: A, AA, AH, AE, AO, AW, AY, E, EH, ER, EY, I, IH, IY, O, OH, OW, OY, U, UH, UW, M, B, P, F, V, TH, L, R, NEUTRAL.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/svelte-vrm-live.git
   cd svelte-vrm-live
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

### Quick Setup

1. **Copy the environment template:**

   ```bash
   cp .env.example .env
   ```

2. **Choose your LLM provider** (auto-detected based on configuration):

   | Provider          | Setup                | Cost           | Performance            | Privacy  |
   | ----------------- | -------------------- | -------------- | ---------------------- | -------- |
   | **Google Gemini** | ⭐⭐⭐ Easiest       | 💰 Pay-per-use | ⚡ Fast                | 🌐 Cloud |
   | **Ollama**        | ⭐⭐ Technical       | 🆓 Free        | 🐌 Depends on hardware | 🔒 Local |
   | **LM Studio**     | ⭐⭐⭐ User-friendly | 🆓 Free        | 🐌 Depends on hardware | 🔒 Local |

   **✨ Just uncomment ONE option in your `.env` file:**

   **Option A: Google Gemini**

   ```bash
   # Uncomment in .env:
   GOOGLE_API_KEY=your_api_key_here  # Get from https://aistudio.google.com
   ```

   **Option B: Ollama**

   ```bash
   # Uncomment in .env:
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2:latest
   # Then: brew install ollama && ollama pull llama3.2:latest
   ```

   **Option C: LM Studio** (default if nothing else configured)

   ```bash
   # Already enabled by default in .env, or uncomment:
   LMSTUDIO_BASE_URL=http://localhost:1234
   LMSTUDIO_MODEL=llama-3.2-1b-instruct
   # Then: download from https://lmstudio.ai and start server
   ```

   **🎯 Auto-Detection:** The system automatically detects which provider to use based on your configuration. No need to set `LLM_PROVIDER` manually!

3. **Test your configuration:**

   ```bash
   npm run test:llm
   ```

   This will verify your setup and provide specific help if needed.

## Developing

Start the development server:

```bash
pnpm dev
```

Open http://localhost:5173.

## Building

Build for production:

```bash
pnpm build
```

Preview:

```bash
pnpm run preview
```

## Architecture

### LLM Integration

The application features a unified LLM client (`src/lib/llm/client.ts`) that supports multiple providers:

- **UnifiedLLMClient**: Abstraction layer supporting Google Gemini, Ollama, and LM Studio
- **Automatic fallbacks**: Structured output with plain chat fallback
- **Provider-specific optimizations**: Native structured output for Gemini, JSON prompting for local models
- **Environment-based configuration**: Switch providers via configuration without code changes

### API Endpoints

- `/api/chat/send`: Chat with structured output and emotion detection
- `/api/generate`: Generate responses with emotion analysis
- `/api/tts`: Text-to-speech with phoneme timing

## Keywords

svelte, sveltekit, threejs, threlte, vrm, 3d-avatar, ai-chat, text-to-speech, lipsync, phonemes, mixamo, animations, ollama, lmstudio, local-llm, generative-ai, youtube-streaming

## Contributing

We welcome contributions! Before we can merge your first pull request you must sign our Contributor License Agreement (CLA). When you open a PR, GitHub will display a message from the CLA bot with a link to sign.

- Individual contributors: see [docs/CLA_INDIVIDUAL.md](docs/CLA_INDIVIDUAL.md)
- Companies/corporations: see [docs/CLA_CORPORATE.md](docs/CLA_CORPORATE.md)

Once the CLA is signed, the status check will update automatically, and we’ll be able to review your contribution.

## License

AGPL (see LICENSE file)
