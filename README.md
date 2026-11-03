<p align="center">
  <img src="assets/icon-png.png" alt="flost8 Logo" width="100">
</p>

<h1 align="center">flost8</h1>

<p align="center">
  <strong>An uncompromisingly minimal, always-visible desktop task manager.
  Stay productive. Never lose track of what matters.</strong><br>
</p>

<p align="center">
  <a href="#-downloads"><img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square" alt="Platform"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Engine-Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/UI-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
</p>

---

<p align="center">
  <img src="assets/flost8.png" alt="flost8 Application Interface" width="300">
</p>

<br>

flost8 is a lightweight utility engineered to solve a single problem: context switching. By floating a persistent, frameless interface above your workspace, it ensures your immediate priorities remain visible without burying them in browser tabs or requiring you to minimize your IDE.

<br>

## Downloads

<p align="center">
  <a href="https://github.com/singharyan006/flost8/releases/download/v2.0.0/flost8.exe">
    <img src="https://img.shields.io/badge/⬇_Windows-flost8.exe-0078D4?style=for-the-badge&logo=microsoft&logoColor=white" alt="Download for Windows">
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/singharyan006/flost8/releases/download/v2.0.0/flost8.dmg">
    <img src="https://img.shields.io/badge/⬇_macOS-flost8.dmg-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS">
  </a>
</p>

<p align="center">
  <sub><a href="https://github.com/singharyan006/flost8/releases/latest">View all releases and changelogs →</a></sub>
</p>

<br>

## Highlights

- **Persistent Visibility:** Engineered to stay pinned above all applications, bypassing OS-level window layering restrictions.
- **Zero-Friction UX:** Pure keyboard-driven input (`Enter` to add, `Esc` to clear) with automatic restoration on system boot.
- **Glass Morphism Engine:** Utilizes backdrop blurring and transparent window constraints to maintain context of the applications beneath it.
- **Cross-Platform:** Distributed via NSIS (Windows) and DMG (macOS) with native system tray integration on both operating systems.

<br>

## In Action

<p align="center">
  <em>Works seamlessly over any application — Discord, VS Code, browsers, and more.</em>
</p>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="assets/Homescreen.png" alt="flost8 on Homescreen" width="100%"><br>
      <sub><b>Desktop View</b> — Clean desktop integration</sub>
    </td>
    <td align="center" width="50%">
      <img src="assets/web.png" alt="flost8 compact mode" width="100%"><br>
      <sub><b>Compact Mode</b> — Minimal footprint</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="assets/discord.png" alt="flost8 over Discord" width="100%"><br>
      <sub><b>Over Discord</b> — Track tasks while chatting</sub>
    </td>
    <td align="center" width="50%">
      <img src="assets/editor.png" alt="flost8 over VS Code" width="100%"><br>
      <sub><b>Over VS Code</b> — Always visible while coding</sub>
    </td>
  </tr>
</table>


<br>

## Technical Architecture

flost8 is built on a strict, security-first Electron architecture separating the Node.js backend from the Chromium frontend.

```text
flost8/
├── src/
│   ├── main.js                    # Main process (System integration, Window management)
│   ├── preload.js                 # IPC Bridge (Context-isolated API exposure)
│   └── renderer/
│       ├── index.html             # View layer
│       ├── app.js                 # State management & Event delegation
│       ├── styles.css             # Tailwind v4 compiled utilities
│       ├── components/            # Modular DOM constructors
│       ├── services/              # Pure business logic (Task Manager, Storage)
│       └── utils/                 # Helper functions and formatters
├── assets/                        # Distribution binaries & icons
└── .github/workflows/             # CI/CD automated build pipelines
```

### Engineering Decisions

- **State Management:** Handled locally via `electron-store` synchronously to ensure zero data loss on unexpected process termination.
- **Styling:** Migrated entirely to **Tailwind CSS v4**, removing the need for a configuration file and relying solely on CSS variables and native rendering.
- **DOM Manipulation:** Operates without virtual DOM overhead (no React/Vue). Pure vanilla JavaScript event delegation provides instant feedback loops.

<br>

## Security Model

The application strictly adheres to the Electron security guidelines to prevent arbitrary code execution:

1. `nodeIntegration: false` — The renderer process has zero access to Node.js APIs.
2. `contextIsolation: true` — The preload script runs in an isolated V8 context.
3. **Strict IPC:** Communication between the UI and system layers happens exclusively through an explicitly defined `window.electronAPI` bridge.
4. **Input Sanitization:** All user inputs are HTML-escaped before DOM insertion to prevent Cross-Site Scripting (XSS).

<br>

## Development Setup

<details>
<summary><b>View instructions for building from source</b></summary>

<br>

Requires [Node.js](https://nodejs.org/) v20+

```bash
# Clone and install dependencies
git clone https://github.com/singharyan006/flost8.git
cd flost8
npm install

# Run in development mode with hot-reload
npm run dev

# Compile distribution binaries
npm run build:win    # Windows (.exe)
npm run build:mac    # macOS (.dmg)
```
</details>

<br>

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <img src="assets/icon-png.png" alt="flost8" width="32"><br>
  <strong>Engineered by <a href="https://github.com/singharyan006">Aryan Singh</a></strong>
  <br>
  Focus on what matters most
</p>
