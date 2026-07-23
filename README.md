# Lingji Atelier · 绫季绘境

> A small, local workspace for turning story moments into Galgame-style AI CGs.

[中文说明](README_zh.md)

## About

绫季绘境 is a personal hobby project built for local use and occasional sharing with trusted friends. It is not a hosted service, public community, or commercial platform.

The current scene and character presets focus on **Ayachi Nene** and **Shiki Natsume**. A Scene keeps the story, character, mood, camera, composition, lighting, prompt, LoRA, and generation settings together, so creation starts with an image idea instead of an empty prompt box.

This is an unofficial, non-commercial fan project and is not affiliated with or endorsed by the original rights holders.

## Features

- 284 searchable and filterable Scenes, classified as All, R15, or R18 by depicted content
- A reviewed result gallery with one approved image per Scene, featured/character/rating filters, and direct links back into the director
- A director workspace for story, character, mood, camera, composition, lighting, and color
- Automatic Positive / Negative Prompt assembly and scene-aware LoRA injection
- Direct generation through AUTOMATIC1111, Forge, or ReForge
- Automatic dual-character composition enhancement on the configured reForge setup: Regional Prompter separates Nene and Natsume, scene-specific OpenPose maps stabilize placement, and conservative ADetailer repair is limited to distant dual faces. Single-character generation keeps the audited baseline unchanged.
- An optional local character room backed by Ollama: stream a conversation with Nene or Natsume, reuse the existing GPT-SoVITS voice gateway, and show lightweight breathing, blinking, and speaking feedback.
- Model and sampler discovery, progress display, interrupt, fixed seeds, hires.fix, and a sequential generation queue
- Independent Chinese reading text and voice scripts: keep captions Chinese while characters speak Japanese by default, with optional Chinese delivery
- Scene-aware Japanese voice references for neutral, gentle, happy, shy, serious, and sad delivery; Chinese keeps the stable neutral reference
- Local history, ratings, favorites, notes, projects, and image storage, with a versioned JSON backup and restore flow
- Temporary token-protected links for trusted friends to use your local SD WebUI

## Recommended setup

1. In Stability Matrix, keep `--api --port 7860` in the WebUI launch arguments. The current reForge package is started automatically by the control panel.
2. Double-click `control.bat`.
3. Confirm the WebUI address. When the sibling local voice setup is present, the launcher also starts GPT-SoVITS; the gateway switches the evaluated Nene/Natsume weights for each request.
4. Click **启动并生成分享链接**.
5. Use **打开本地网站（无需 Token）** for yourself, or copy the token-protected link for a friend.
6. Click **停止全部服务** when finished. This stops the local gateway, sharing tunnel, GPT-SoVITS, and the reForge process started by the control panel. A separately manual WebUI is left untouched.

`--api` does not prevent normal use of the WebUI interface. If Stability Matrix uses another port, enter the address shown in its log.

On the configured machine, the control panel also supplies the shared ControlNet model directory. Regional Prompter, ControlNet, and ADetailer are discovered through their APIs; if one is unavailable, the director falls back gracefully instead of changing the single-character pipeline.

Public sharing requires `cloudflared` at its standard Windows install path. Without it, the local site and SD connection still work.

See [STARTUP.md](STARTUP.md) for full setup and troubleshooting instructions.

## Static preview

To browse the site without SD generation:

```powershell
python -m http.server 8090
```

Open `http://127.0.0.1:8090/`. A plain static server does not provide the `/sdapi` proxy or mount the separate approved showcase; use `control.bat` when you need the result gallery.

## Data and privacy

- Scene and character presets are stored as JSON in the repository.
- Personal history and images are stored mainly in the current browser through IndexedDB.
- The project has no account system or hosted cloud database.
- Runtime configuration, logs, process state, and friend-generated outputs stay in the git-ignored `runtime/` directory.
- Reviewed samples stay in the sibling `AI/SceneShowcase/` directory. The gateway exposes only its manifest, thumbnails, contact sheets, and approved full images; `SCENE_SHOWCASE_DIR` can override the location.
- A friend link reaches your local gateway through a temporary tunnel, so share it only with people you trust.
- Restarting the gateway creates a new token; the temporary domain may also change.

## Project layout

```text
绫季绘境/
├── DESIGN.md               # Canonical website and control-panel design contract
├── index.html              # Home page
├── control.bat             # Windows control panel launcher
├── server.js               # Site server, SD proxy, and temporary sharing
├── tools/                  # Creator, scene, showcase, character, gallery, and LoRA pages
├── data/                   # Scene, character, tag, and preset data
├── css/                    # Shared design system
├── docs/                   # Creative standards, quality checks, and maintenance notes
├── scripts/                # Validation and maintenance scripts
└── runtime/                # Local config, logs, process state, and generated outputs
```

Run the scene validator with:

```powershell
npm run validate
```

Website and control-panel changes follow [DESIGN.md](DESIGN.md). It is the
canonical UI contract; `css/design-system.css` implements its tokens at runtime.
The separate CG art-direction note describes generated images rather than the
interface.

Use `npm run optimize-scenes` after importing or bulk-editing Scenes to canonicalize prompt tags, camera framing, negative prompts, and unresolved placeholders.

Use `npm run classify-ratings` after adding Scenes. It keeps `rating` (`All`, `R15`, `R18`) aligned with the image tags; only `R18` scenes are behind the adult-content toggle.

For normal maintenance, use **More → Scene Manager** in the local site. It can add,
edit, duplicate, retire, and validate Scenes, replace reviewed samples, create a
backup, and write the correct source shards without requiring manual JSON edits.
Direct edits to `data/scenes/*.json` are reserved for bulk or structural work;
`data/scenes.json` remains generated output.

## Scope

The project stays intentionally small: reliable local creation, high-quality Scene
content, straightforward maintenance, and safe temporary sharing come first.
Desktop is the primary workspace; mobile remains usable but is not allowed to
reduce the desktop canvas. Accounts, subscriptions, a public Scene store, and
community uploads are not planned.

> Prompts describe images. Scenes describe moments.
