# Contributing to flost8

First off, thank you for considering contributing to flost8! It's people like you that make open-source software such a great community.

## Project Philosophy

flost8 is designed to be **uncompromisingly minimal**. When considering a new feature, please ask yourself:
1. Does this solve a problem related to *context switching*?
2. Can it be implemented without cluttering the UI?
3. Can we do this without adding heavy dependencies (like React, Vue, or large utility libraries)?

## Development Setup

The project is built on Electron and Vanilla JavaScript, styled with Tailwind CSS v4.

### Prerequisites
- Node.js (v20 or higher recommended)
- Git

### Getting Started

1. Fork the repository and clone it locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/flost8.git
   cd flost8
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the app in development mode (this will open the Chrome DevTools automatically):
   ```bash
   npm run dev
   ```

## Architecture Rules

- **No UI Frameworks:** The renderer uses pure Vanilla JS and DOM manipulation. Please do not introduce React, Vue, jQuery, etc.
- **Tailwind Only:** All styling is handled via Tailwind CSS v4 in `src/renderer/styles.css`. Avoid inline styles unless absolutely necessary for dynamic layout calculations.
- **Strict IPC:** The renderer (`app.js`, `components/`) must NEVER require Node.js modules directly. All communication with the OS or file system must go through `window.electronAPI` defined in `preload.js` and handled in `main.js`.
- **Synchronous Storage:** We use `electron-store` for state management to prevent data loss. State changes should be atomic and reliable.

## Pull Request Process

1. Create a new branch for your feature or bugfix: `git checkout -b feature/my-awesome-feature`
2. Keep your commits clean, atomic, and descriptive.
3. Test your changes locally on Windows and/or macOS if possible.
4. Push your branch and open a Pull Request against the `main` branch.
5. In your PR description, clearly explain *what* you changed and *why*. Include screenshots or videos for UI changes!

## Reporting Bugs

If you find a bug, please open an issue on GitHub. Include:
- Your OS and version (e.g., Windows 11, macOS Sonoma)
- Steps to reproduce the bug
- What you expected to happen
- What actually happened

Thank you for helping make flost8 better!
