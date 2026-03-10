# svgforce

Official CLI for [SvgForce](https://svgforce.dev) — optimize SVG files and generate production-ready icon components for React, React Native, and Angular right from your terminal.

> **Requires a Team plan.** CLI access is exclusively available to [Team](https://svgforce.dev/pricing) subscribers.

## Install

```bash
npm install -g svgforce
```

Or run without installing:

```bash
npx svgforce --help
```

**Requirements:** Node.js >= 20

## Quick start

```bash
# 1. Authenticate (choose one)
svgforce login                        # interactive email + password
svgforce login --api-key sf_live_...  # API key (recommended for CI/CD)

# 2. Generate components
svgforce react icons/*.svg -o src/components/
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

| Option | Description | Default |
|---|---|---|
| `-o, --output <dir>` | Output directory | `./svgforce-output/` |
| `-n, --name <name>` | Component name | `Icon` |
| `--opacity` | Add opacity prop support | `false` |
| `--dry-run` | Preview without writing files | `false` |
| `--json` | Output result as JSON (useful for scripting) | `false` |

Angular additionally supports:

| Option | Description |
|---|---|
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

| Variable | Description |
|---|---|
| `SVGFORCE_API_KEY` | API key for authentication (takes priority over stored credentials) |
| `SVGFORCE_API_URL` | Override the API base URL (for development/testing) |
| `DEBUG` | Set to any value to see stack traces on errors |

## Configuration

Credentials are stored in `~/.config/svgforce/config.json`. You can inspect the path with:

```bash
svgforce whoami
```

## Links

- [SvgForce](https://svgforce.dev) — web app
- [Pricing](https://svgforce.dev/pricing) — plans & pricing
- [Documentation](https://svgforce.dev/documentation) — full docs

## License

MIT
