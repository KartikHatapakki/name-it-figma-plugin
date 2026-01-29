<p align="center">
  <img src="assets/quick-rename.png" alt="Name It" width="720">
</p>

<h1 align="center">Name It</h1>

<p align="center">
  <strong>The fastest way to rename layers in Figma.</strong><br>
  No double-clicks. No dialogs. Just type.
</p>

<p align="center">
  <a href="#quick-mode">Quick Mode</a> •
  <a href="#advanced-mode">Advanced Mode</a> •
  <a href="#installation">Installation</a>
</p>

---

## Quick Mode

Rename layers instantly. Select, type, done.

- **Live Preview** — Changes appear as you type
- **Multi-select** — Rename many layers at once
- **Smart Icons** — See what you're renaming at a glance
- **Tab Navigation** — Move between layers without lifting your hands
- **Click to Zoom** — Tap the icon to find your layer

---

## Advanced Mode

Batch rename with precision. An Excel-like grid for your layers.

<p align="center">
  <img src="assets/advanced-naming.png" alt="Advanced Naming" width="720">
</p>

- **Structured Naming** — Split names into columns, combine them your way
- **Smart Parsing** — Automatically detects separators and patterns
- **Direction Sorting** — Rename by reading order or spatial position
- **Drag to Fill** — Create sequences instantly (1, 2, 3… or A, B, C…)
- **Live Preview** — See final names before applying
- **Track Mode** — Auto-zoom to each layer as you navigate

<p align="center">
  <img src="assets/drag-to-fill.png" alt="Drag to Fill" width="720">
</p>

---

## Keyboard Shortcuts

### Quick Mode

| Key | Action |
|:--|:--|
| `Tab` | Next layer |
| `Shift + Tab` | Previous layer |
| `Enter` | Enter frame |

### Advanced Mode

| Key | Action |
|:--|:--|
| `Tab` / `Enter` | Navigate cells |
| `Arrow Keys` | Move selection |
| `Shift + Arrow` | Extend selection |
| `⌘ + C/V/X` | Copy, paste, cut |
| `⌘ + Z` | Undo |
| `⌘ + Shift + Z` | Redo |

---

## Installation

**From Figma Community**

Search for "Name It" in Figma plugins.

**Manual Installation**

```bash
git clone https://github.com/KartikHatapakki/name-it-figma-plugin.git
cd name-it-figma-plugin
npm install && npm run build
```

Then import `manifest.json` in Figma → Plugins → Development.

---

## Development

```bash
npm install       # Install dependencies
npm run build     # Build for production
npm run dev       # Watch mode
```

---

<p align="center">
  <sub>Built with React, TypeScript, and Tailwind CSS</sub>
</p>
