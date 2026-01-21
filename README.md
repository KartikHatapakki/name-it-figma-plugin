# Name It

A minimal Figma plugin for lightning-fast layer renaming. Skip the double-click and rename layers instantly.

## Features

- **Live Rename** - See changes as you type, no need to hit save
- **Multi-select Support** - Rename multiple layers at once with the same name
- **Smart Layer Icons** - Visual indicator showing what type of layer you've selected (frame, text, image, shapes, components, etc.)
- **Keyboard Navigation** - Use Tab/Shift+Tab to quickly move between sibling layers
- **Figma-native Feel** - Minimal UI that feels like part of Figma

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Jump to next sibling layer |
| `Shift + Tab` | Jump to previous sibling layer |
| `Enter` | Enter into frame (select children) |

## How to Use

1. Select one or more layers in Figma
2. Run the "Name It" plugin
3. Start typing - the name updates live
4. Press `Tab` to move to the next layer

## Installation

### From Figma Community
Search for "Name It" in the Figma Community plugins.

### Manual Installation (Development)
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. In Figma, go to Plugins → Development → Import plugin from manifest
5. Select the `manifest.json` file

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode for development
npm run dev
```

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite + esbuild
- Phosphor Icons

## License

MIT
