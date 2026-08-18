# Lingji Atelier · 绫季绘境

> A local creative studio for turning story moments into Galgame-style AI CGs, 4-perspective character reference bibles, and AI narrative short films.

[中文说明](README_zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## About

绫季绘境 (Lingji Atelier) is a personal hobby project built for local use and occasional sharing with trusted friends. It is not a hosted service, public community, or commercial platform.

The system supports the core heroines **Ayachi Nene** and **Shiki Natsume**, as well as a rich catalog of **35 popular anime/game characters** across 177 outfit forms. A Scene keeps the story, character, mood, camera, composition, lighting, prompt, LoRA, and generation settings together, so creation starts with an image idea instead of an empty prompt box.

This is an unofficial, non-commercial fan project and is not affiliated with or endorsed by the original rights holders.

## Features

- **Scene & Character Libraries**:
  - 297+ searchable and filterable Scenes, classified as All, R15, or R18 by depicted content.
  - 35 popular characters across Arknights, Genshin Impact, Honkai Star Rail, Frieren, Fate, Re:Zero, Roshidere, Bunny Girl Senpai, SAO, Toaru, Date A Live, Guilty Crown, Mushoku Tensei, Monogatari, Bocchi the Rock, Chainsaw Man, Lycoris Recoil, Attack on Titan, etc.
  - 335+ verified showcase samples in `AI/SceneShowcase/` with direct links back into the studio.
- **4-Perspective Character Reference Bible**:
  - 35 characters $\times$ 177 outfit forms (736 standard perspectives): Face Close-up (`ref_01_face_closeup`, 85mm f/1.4), Medium 3/4 Shot (`ref_02_half_medium`), Full Body Dynamic (`ref_03_full_dynamic`), and Back/Turnaround (`ref_04_back_rear`).
  - Automated closed-loop pipeline: 3-concurrency generation, 4-concurrency pure-vision Gemini 3.7 Flash audit pool, and fine-tuned repair engine.
  - Standardized reference asset contract for downstream MiniMax H3 Ref2VA identity locking.
- **Multi-Engine Generation & 30 Curated Artist Styles**:
  - Automatic prompt compilation across Stable Diffusion / WAI (Danbooru tags), Anima 1.1 (`@artist` + native tags), and Krea 2 Turbo (natural language prose).
  - 30 curated anime artist & chief animation director styles (e.g. Nekotomi Chao / 猫富ちゃお, Kyoji Asano / WIT Studio, Rella moonlight, Misaki Kurehito, Muririn, Kobuichi, So-bin, etc.).
  - Regional Prompter dual-character composition stabilization on reForge.
- **AI Narrative Video Studio**:
  - Local AI video creation supporting Wan 2.2 TI2V and MiniMax H3 (Ref2VA reference image binding).
  - Intelligent shot list script decomposition, style anchor injection, and explicit dialogue language control (`dialogueLang: auto/zh/ja/en`).
- **Character Space & Voice Pipeline**:
  - Local character room backed by Ollama / OpenAI-compatible APIs with streaming sentence-level Japanese / Chinese voice synthesis (GPT-SoVITS).
  - Live2D lip sync driven by audio amplitude and emotion-matched expressions.
  - VRAM resource scheduler: one-click draw-first / chat-first modes with automatic model unloading.
- **Desktop Companion (Tauri 2)**:
  - Lightweight desktop shell with Companion + Atelier dual windows, system tray, Native Live2D overlay, and elevated quick-deploy pipeline (`deploy-desktop-quick.ps1`).

## Recommended setup

1. In Stability Matrix, keep `--api --port 7860` in the WebUI launch arguments.
2. Double-click `control.bat`.
3. Confirm the WebUI address. When the sibling local voice setup is present, the launcher also starts GPT-SoVITS.
4. Click **启动并生成分享链接**.
5. Use **打开本地网站（无需 Token）** for yourself, or copy the token-protected link for a friend.
6. Click **停止全部服务** when finished.

See [STARTUP.md](STARTUP.md) for full setup and troubleshooting instructions.

For current implementation details, verification baselines, and the complete documentation index, see [docs/project-status.md](docs/project-status.md) and [docs/INDEX.md](docs/INDEX.md).

## Project layout

```text
AI-CG-Studio/
├── DESIGN.md               # Website and control-panel design contract
├── AGENTS.md               # Collaboration rules, quality gates & operational constraints
├── index.html              # Vite SPA entry point (no global scripts)
├── vite.config.ts          # Vite build config + dev proxy to Express
├── control.bat             # Windows control panel launcher
├── server.js               # Express: static serving, SD proxy, sharing
├── src/                    # Vue 3 SPA source (Vite build target)
│   ├── config/             #   Character constants, artist styles, prompt definitions
│   ├── utils/              #   Stream parsing, character reference data, prompt compiler
│   ├── stores/             #   Pinia: scene data, prompt-builder state
│   ├── composables/        #   Chat storage, Live2D, voice, SD generate, IndexedDB
│   ├── components/         #   AppLayout, AppNav, SceneCard, Video Studio components
│   ├── views/              #   One .vue per route (all lazy-loaded)
│   └── assets/css/         #   Design system tokens, component styles
├── routes/                 # Express API routes (chat, voice, live2d, video, maintenance)
├── services/               # TypeScript runtime services (Ollama, TTS, HTTP client…)
├── desktop-tauri/          # Tauri 2 shell, Native Live2D overlay, sidecar and packaging
├── types/                  # Shared TypeScript type definitions
├── data/                   # Runtime JSON: scenes, characters, tags, blueprints, reference standards
├── assets/                 # Static assets: character images, Live2D models, vendor SDKs
├── docs/                   # Creative standards, quality checks, master index (docs/INDEX.md)
├── scripts/                # Maintenance, tests, reference generation, and runtime helpers
└── runtime/                # Local config, logs, process state, generated outputs
```

## Validation

```powershell
npm run typecheck:app     # TypeScript check for Vue SFCs
npm run build             # Build web application bundle
npm run validate          # Complete validation suite
```

## Scope

The project stays intentionally small: reliable local creation, high-quality Scene and reference assets, straightforward maintenance, and safe temporary sharing come first. Accounts, subscriptions, a public Scene store, and community uploads are not planned.

## License

MIT — see [LICENSE](LICENSE). The character content and original works belong to their respective rights holders; this project is an unofficial fan work and does not claim ownership of them.

> Prompts describe images. Scenes describe moments.
