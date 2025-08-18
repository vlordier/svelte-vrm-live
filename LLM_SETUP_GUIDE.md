# LLM Setup Guide

## Quick Start with Auto-Detection ✨

1. **Copy environment template:**

   ```bash
   cp .env.example .env
   ```

2. **Uncomment ONE provider in your `.env` file** (the system will auto-detect which to use):

### Google Gemini (Recommended for beginners)

- **Pros:** Easiest setup, fast, advanced features
- **Cons:** Requires API key, costs money per use
- **Setup:** Uncomment Google section, add your API key

```bash
# Just uncomment this line in .env:
GOOGLE_API_KEY=your_api_key_here  # Get from https://aistudio.google.com
```

### Ollama (For developers)

- **Pros:** Free, completely local, privacy-focused
- **Cons:** Requires technical setup, slower on modest hardware
- **Setup:** Install Ollama, pull model, uncomment Ollama section

```bash
brew install ollama
ollama serve
ollama pull llama3.2:latest

# Then uncomment these lines in .env:
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.2:latest
```

### LM Studio (For GUI users)

- **Pros:** Free, local, user-friendly interface
- **Cons:** Requires download and setup, slower on modest hardware
- **Setup:** Download LM Studio, load model, start server, uncomment section

```bash
# 1. Download from https://lmstudio.ai
# 2. Load a model and start local server
# 3. LM Studio is enabled by default, or uncomment:
# LMSTUDIO_BASE_URL=http://localhost:1234
# LMSTUDIO_MODEL=llama-3.2-1b-instruct
```

## Test Your Setup

```bash
npm run test:llm
```

This command will:

- Show available providers
- Display auto-detection results
- Check your current configuration
- Validate required environment variables
- Provide specific help if there are issues

## Development

```bash
npm run dev
```

The app will show your LLM configuration status on startup.

## Switching Providers

To change providers, simply:

1. Edit your `.env` file
2. Comment out the current provider's variables
3. Uncomment your new provider's variables
4. Run `npm run test:llm` to verify auto-detection
5. Restart your dev server

**Advanced:** You can also manually override auto-detection by setting `LLM_PROVIDER=google` (or `ollama`, `lmstudio`)

## Troubleshooting

### "Configuration Error" messages

- Run `npm run test:llm` for specific guidance
- Check that your `.env` file has the correct variables
- Ensure local services (Ollama/LM Studio) are running

### Performance with local providers

- Local models depend heavily on your hardware
- For better performance, use a machine with dedicated GPU
- Consider lighter models for resource-constrained systems

### API key issues with Google

- Verify your API key at https://aistudio.google.com
- Check for any usage limits or billing issues
- Ensure the key has proper permissions
