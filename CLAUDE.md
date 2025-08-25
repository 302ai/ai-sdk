# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the 302AI AI SDK - a provider SDK that integrates with the Vercel AI SDK to offer access to 302AI's comprehensive suite of AI models. The SDK supports text generation, image generation, and embeddings through a unified, type-safe API.

## Development Commands

### Core Commands
- `pnpm build` - Build all packages using Turbo
- `pnpm dev` - Start development mode with hot reload (no cache, 16 concurrency)
- `pnpm lint` - Run ESLint across all packages
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run all tests (both Node.js and Edge environments)

### Package-Specific Commands (run from packages/ai/)
- `pnpm build:watch` - Build with watch mode
- `pnpm test:node` - Run Node.js environment tests
- `pnpm test:edge` - Run Edge environment tests
- `pnpm prettier-check` - Check code formatting
- `pnpm prettier-fix` - Auto-fix code formatting

### Release Commands
- `pnpm changeset` - Create a changeset for versioning
- `pnpm ci:release` - Full release process (clean, build, publish)
- `pnpm ci:version` - Version bump and cleanup

## Architecture

### Monorepo Structure
- **packages/ai/** - Core 302AI provider SDK implementation
- **examples/core/** - Usage examples demonstrating SDK capabilities
- **tools/** - Shared development tools (ESLint config, TypeScript configs)

### Core Components

**Provider Architecture:**
- `ai302-provider.ts` - Main provider factory with OpenAI-compatible chat and embedding models
- `ai302-image-model.ts` - Specialized image generation model implementation
- `models/` directory - Individual model implementations for various image generation services

**Model Categories:**
1. **Language Models** - 200+ models including GPT-4, Claude-3, Gemini, Qwen, and many others
2. **Image Models** - 50+ models including Midjourney, DALL-E 3, Flux, Stable Diffusion variants
3. **Embedding Models** - 10+ models including OpenAI embeddings, BGE, and specialized Chinese models

**Key Files:**
- `index.ts` - Main entry point exporting provider and types
- `ai302-config.ts` - Configuration management and API key handling
- `ai302-*-settings.ts` - Type definitions and settings for different model types
- `utils/api-handlers.ts` - API request/response handling utilities

### Development Patterns

**Error Handling:**
The SDK uses a structured error handling approach via `ai302ErrorSchema` that parses 302AI API errors into readable messages.

**Type Safety:**
All models are strongly typed with specific model IDs and settings. The SDK leverages Zod for runtime validation and TypeScript for compile-time safety.

**Testing Strategy:**
- Dual environment testing (Node.js and Edge)
- Vitest for test runner
- Separate configs for different runtime environments

## Package Management

- Uses **pnpm** with workspaces
- **Turbo** for build orchestration and caching
- **Changesets** for version management and publishing
- **Husky** for git hooks with lint-staged

## Code Style

- **Prettier** for formatting (single quotes, 2-space tabs, trailing commas)
- **ESLint** with custom 302ai config
- **TypeScript 5.6.3** across all packages
- Node.js 18+ minimum requirement

## API Integration

The SDK integrates with 302AI's API endpoints:
- Text generation: Chat completions API
- Image generation: Image generation API with model-specific implementations
- Embeddings: Text embedding API

All API calls use the OpenAI-compatible format where possible, with custom implementations for image generation models that require specific parameter handling.