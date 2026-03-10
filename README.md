# svgforce

<p align="center">
  <img src="https://svgforce.dev/favicon.svg" width="140">
</p>

![npm version](https://img.shields.io/npm/v/svgforce)
![npm downloads](https://img.shields.io/npm/dm/svgforce)
![node version](https://img.shields.io/node/v/svgforce)
![license](https://img.shields.io/npm/l/svgforce)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/svgforce)

Official CLI for [SvgForce](https://svgforce.dev).

Optimize SVG files and generate production-ready icon components for:

- React
- React Native
- Angular

Directly from your terminal.

> ⚠ CLI access is included with the **Team plan**. See [pricing](https://svgforce.dev/subscription) for details.

## Why SvgForce CLI

SvgForce CLI lets you integrate SVG optimization and icon generation directly into your development workflow.

Benefits:

- ⚡ Batch process entire icon libraries
- 🧼 Automatically clean SVG files from design tools
- 📦 Generate ready-to-use framework components
- 🤖 Perfect for CI/CD pipelines

## Install

```bash
npm install -g svgforce
```

Works with any project — React, React Native, Angular or plain SVG folders.

Or run instantly without installing:

```bash
npx svgforce
```

**Requirements:** Node.js >= 20

## Quick start

```bash
# 1. Authenticate
svgforce login

# 2. Set up your project
svgforce init

# 3. Generate components
npm run icons
```

Or manually:

```bash
svgforce login --api-key sf_live_...  # API key (recommended for CI/CD)
svgforce react icons/ -o src/components/icons/
```

## Authentication

### Interactive login

```bash
svgforce login
```

You will be prompted for email and password. A JWT token is stored locally in `~/.config/svgforce/`.

### API key

Generate an API key in your [profile](https://svgforce.dev/profile) (API Keys tab), then:

```bash
svgforce login --api-key sf_live_a1b2c3d4...
```

For CI/CD pipelines, set the environment variable instead:

```bash
export SVGFORCE_API_KEY=sf_live_a1b2c3d4...
svgforce react icons/ -o src/components/
```

**Priority:** `SVGFORCE_API_KEY` env > stored API key > stored JWT token.

### Other auth commands

```bash
svgforce logout   # remove stored credentials
svgforce whoami   # show user, plan, and usage
```

## Project setup

### `svgforce init`

Interactive wizard that configures SvgForce for your project:

```bash
svgforce init
```

The wizard will ask you:

1. **Which framework?** — React, React Native, Angular, or Optimize only
2. **Where are your SVG files?** — e.g. `./icons`
3. **Where to save generated files?** — e.g. `./src/components/icons`
4. **Component name** — e.g. `Icon`
5. **Create `svgforce.config.json`?** — project config for default settings
6. **Add npm scripts?** — adds `icons` / `icons:optimize` scripts to `package.json`

Example generated config (`svgforce.config.json`):

```json
{
  "framework": "react",
  "input": "./icons",
  "output": "./src/components/icons",
  "componentName": "Icon"
}
```

Example npm scripts added to `package.json`:

```json
{
  "scripts": {
    "icons": "svgforce react ./icons -o ./src/components/icons -n Icon",
    "icons:optimize": "svgforce optimize ./icons -o ./icons"
  }
}
```

## Commands

### `svgforce optimize`

Optimize SVG files — removes editor metadata (Figma, Sketch, Illustrator), minifies paths, strips unnecessary attributes.

```bash
svgforce optimize icons/*.svg -o dist/icons/
svgforce optimize ./assets/svg/ -o optimized/
```

### `svgforce react`

Generate a React icon component (`.tsx`) from one or more SVGs.

```bash
svgforce react icons/*.svg -o src/components/ -n AppIcon
```

Output: `src/components/AppIcon.tsx`

### `svgforce react-native`

Generate a React Native icon component using `react-native-svg`.

```bash
svgforce react-native icons/ -o src/icons/ -n MobileIcon
```

### `svgforce angular`

Generate an Angular standalone icon component.

```bash
svgforce angular icons/ -o src/app/icons/ -n AppIcon -s app-icon
```

## Options

All conversion commands share these options:

| Option               | Description                                  | Default              |
| -------------------- | -------------------------------------------- | -------------------- |
| `-o, --output <dir>` | Output directory                             | `./svgforce-output/` |
| `-n, --name <name>`  | Component name                               | `Icon`               |
| `--opacity`          | Add opacity prop support                     | `false`              |
| `--dry-run`          | Preview without writing files                | `false`              |
| `--json`             | Output result as JSON (useful for scripting) | `false`              |

Angular additionally supports:

| Option                 | Description                |
| ---------------------- | -------------------------- |
| `-s, --selector <sel>` | Angular component selector |

## Input formats

You can pass files, glob patterns, or directories:

```bash
svgforce react arrow.svg                     # single file
svgforce react icons/*.svg                   # glob pattern
svgforce react icons/                        # entire directory (recursive)
svgforce react icons/ assets/extra/*.svg     # mixed
```

Only `.svg` files are processed; everything else is silently skipped.

## CI/CD example

### GitHub Actions

```yaml
- name: Generate icon components
  env:
    SVGFORCE_API_KEY: ${{ secrets.SVGFORCE_API_KEY }}
  run: |
    npx svgforce react icons/ -o src/components/icons/ -n AppIcon
    npx svgforce react-native icons/ -o src/mobile/icons/ -n MobileIcon
```

## Environment variables

| Variable           | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `SVGFORCE_API_KEY` | API key for authentication (takes priority over stored credentials) |
| `SVGFORCE_API_URL` | Override the API base URL (for development/testing)                 |
| `DEBUG`            | Set to any value to see stack traces on errors                      |

## Configuration

**Project config** — `svgforce.config.json` in your project root (created by `svgforce init`):

```json
{
  "framework": "react",
  "input": "./icons",
  "output": "./src/components/icons",
  "componentName": "Icon"
}
```

**User credentials** — stored in `~/.config/svgforce/config.json`. Verify with:

```bash
svgforce whoami
```

## Links

- [SvgForce](https://svgforce.dev) — web app
- [Pricing](https://svgforce.dev/pricing) — plans & pricing
- [Documentation](https://svgforce.dev/documentation) — full docs

## License

MIT
