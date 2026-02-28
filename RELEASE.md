# Release Guide

This document describes the development, build, and release workflow for `@302ai/ai-sdk`.

## Table of Contents

- [Development](#development)
- [Build](#build)
- [Testing](#testing)
- [Release Process](#release-process)
- [Adding a New Image Model](#adding-a-new-image-model)
- [Troubleshooting](#troubleshooting)

---

## Development

### Prerequisites

- Node.js >= 18
- pnpm 10.23.0+

### Setup

```bash
pnpm install        # Install all workspace dependencies
pnpm dev            # Start dev mode (hot reload, 16 concurrency, no cache)
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development mode with hot reload |
| `pnpm build` | Build all packages via Turbo |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run all tests (Node.js + Edge) |
| `pnpm prettier-check` | Check code formatting |
| `pnpm prettier-fix` | Auto-fix code formatting |

### Code Style

- **Prettier**: single quotes, 2-space indent, trailing commas
- **ESLint**: custom `eslint-config-302ai`
- **Git Hooks**: Husky + lint-staged auto-format on every commit

---

## Build

The build pipeline uses **Turbo** for orchestration and **tsup** for bundling:

```
pnpm build
  -> turbo build (respects dependency order across workspace)
       -> tsup (packages/ai/)
            -> dist/index.js    (CJS)
            -> dist/index.mjs   (ESM)
            -> dist/index.d.ts  (Type declarations)
```

---

## Testing

Dual-environment testing to ensure compatibility with both Node.js and Edge runtimes:

```bash
pnpm test             # Run both environments
pnpm test:node        # Node.js only (vitest.node.config.js)
pnpm test:edge        # Edge runtime only (vitest.edge.config.js)
```

---

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated publishing via GitHub Actions.

### Overview

```
Developer                          GitHub Actions (CI)
--------                          -------------------
1. Create changeset
2. Commit & push to main
                          ------> 3. CI detects changeset
                                     -> Creates "Version Packages" PR
                                        (bumps version, updates CHANGELOG)
4. Review & merge the PR
                          ------> 5. CI detects no remaining changesets
                                     -> turbo clean && turbo build
                                     -> changeset publish
                                     -> @302ai/ai-sdk@x.x.x on npm
```

### Step-by-Step

#### 1. Create a Changeset

After your feature/fix is merged to `main`, create a changeset:

```bash
pnpm changeset
```

Interactive prompts:
1. **Select package** -> `@302ai/ai-sdk`
2. **Version type** -> `patch` (for new models, bug fixes) / `minor` (for breaking feature additions)
3. **Summary** -> e.g. `feat: add support for xxx model`

This generates a file like `.changeset/random-name.md`:

```markdown
---
'@302ai/ai-sdk': patch
---

feat: add support for xxx model
```

> **Convention**: This project uses `patch` for almost all changes, including new model additions. Use `minor` only for significant API changes.

#### 2. Commit and Push

```bash
git add .changeset/<generated-file>.md
git commit -m "chore: add changeset for xxx"
git push origin main
```

#### 3. CI Creates Version PR (automatic)

GitHub Actions (`release.yml`) triggers on push to `main` with `.changeset/**` changes:

- `changesets/action@v1` detects unconsumed changesets
- Runs `pnpm ci:version` (bumps version in `package.json`, generates CHANGELOG)
- Creates a PR titled **"Version Packages"** from branch `changeset-release/main`

#### 4. Review and Merge the Version PR

Check that the version bump is correct (e.g. `0.2.15` -> `0.2.16`), then merge.

#### 5. CI Publishes to npm (automatic)

After merging, CI triggers again:

- No remaining changesets detected -> runs `pnpm ci:release`
- Executes: `turbo clean && turbo build && changeset publish`
- Publishes to npm using `NPM_TOKEN_ELEVATED` secret

#### Manual Trigger

If needed, you can manually trigger the release workflow:

- Go to **Actions** -> **Release** -> **Run workflow**

---

## Adding a New Image Model

A standard checklist for adding a new image generation model. Use any recent model commit as reference (e.g. Kling O1 `cbeec15`).

### Files to Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `packages/ai/src/ai302-image-settings.ts` | Edit | Add model ID to `AI302ImageModelId` type union + add entry in `modelToBackendConfig` |
| 2 | `packages/ai/src/ai302-types.ts` | Edit | Define Zod request/response schemas and TypeScript types (if the model has a unique API shape) |
| 3 | `packages/ai/src/models/<model-name>.ts` | **New** | Handler class extending `BaseModelHandler`, implement `processRequest()` |
| 4 | `packages/ai/src/models/model-factory.ts` | Edit | Import handler + add `case` branch in the switch statement |
| 5 | `examples/core/src/generate-image/302ai.ts` | Edit | Add model to the example models list |
| 6 | `.changeset/<name>.md` | **New** | Create changeset via `pnpm changeset` |

### Handler Pattern

All image model handlers extend `BaseModelHandler` and implement `processRequest()`:

```typescript
import { type ImageModelV3CallOptions, type SharedV3Warning } from '@ai-sdk/provider';
import { BaseModelHandler } from './base-model';

export class MyModelHandler extends BaseModelHandler {
  protected async processRequest({
    prompt, n, size, aspectRatio, providerOptions, headers, abortSignal,
  }: ImageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];

    // 1. Validate parameters, collect warnings
    // 2. Call the model's API (sync or async polling)
    // 3. Download result images -> base64
    // 4. Return { images, warnings, response }
  }
}
```

Common patterns:
- **Sync models** (e.g. DALL-E, Flux): Single API call, response contains image directly
- **Async polling models** (e.g. Kling, Midjourney): Submit task -> poll status -> download images

### Verify Before Committing

```bash
pnpm build        # Build passes
pnpm type-check   # Types are correct
pnpm lint         # ESLint passes
pnpm test         # All tests pass
```

---

## Troubleshooting

### `E404 Not Found` during publish

```
npm error 404 Not Found - PUT https://registry.npmjs.org/@302ai%2fai-sdk
npm notice Access token expired or revoked.
```

**Cause**: The `NPM_TOKEN_ELEVATED` secret in GitHub has expired or been revoked.

**Fix**: Generate a new npm token and update the GitHub secret:
1. npmjs.com -> Access Tokens -> Generate New Token
2. GitHub repo -> Settings -> Secrets and variables -> Actions -> Update `NPM_TOKEN_ELEVATED`
3. Re-run the failed workflow

### `E403 Forbidden` - Two-factor authentication required

```
403 Forbidden - Two-factor authentication or granular access token
with bypass 2fa enabled is required to publish packages.
```

**Cause**: The npm token type doesn't satisfy the 2FA requirement of the `@302ai` organization.

**Fix**: Generate a token with the correct type:
- **Option A**: Granular Access Token with **"Bypass two-factor authentication for automation"** enabled
- **Option B**: **Automation** type token (inherently bypasses 2FA, designed for CI/CD)

### CI not triggering after push

The release workflow only triggers when `.changeset/**` files change on `main`:

```yaml
on:
  push:
    branches: [main]
    paths: ['.changeset/**', '.github/workflows/release.yml']
```

If your push doesn't include changeset file changes, the workflow won't run. Use `workflow_dispatch` for manual triggers.
