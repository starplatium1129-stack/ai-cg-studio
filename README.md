# AI CG Studio

> **From Story to Scene**
>
> Don't write prompts. Direct a CG.

中文: [README_zh.md](README_zh.md)

---

## What is this?

AI CG Studio is an **AI Galgame CG creation studio** — a **Scene Library for AI Artists**, not a prompt library.

| ❌ Others give | ✅ We give |
|---|---|
| 5,000 prompts | 500 scenes |

A scene is worth a thousand prompts. A scene contains story, emotion, camera, composition, lighting, recommended parameters, and the auto-generated prompt — all in one complete creative unit.

---

## Try it

Open `index.html` directly in your browser. No server, no install, no build.

[Live Demo](https://starplatium1129-stack.github.io/ai-cg-studio/) *(if GitHub Pages enabled)*

---

## Project structure

```
AI-CG-Studio/
├── index.html                          # Home — navigation, philosophy, road
├── css/
│   └── design-system.css               # Global design tokens (deep grey + sakura pink)
├── docs/                               # Spec docs (self-contained, interactive)
│   ├── worldview.html                  # Why this exists (the soul)
│   ├── philosophy.html                 # Scene Engineering > Prompt Engineering
│   ├── art-direction.html              # Color / lighting / character / background
│   ├── prompt-spec.html                # 9-module prompt ordering (user invisible)
│   ├── tag-standard.html               # 40+ canonical tags (unique, zh↔en)
│   ├── scene-spec.html                 # SC0001 template + official examples
│   ├── quality-standard.html           # ⭐⭐⭐⭐⭐ review dimensions
│   └── roadmap.html                    # v0.5 → v7.0
└── tools/                              # Interactive creation tools
    ├── director-flow.html              # 7-step Story→Character→Emotion→...→CG
    ├── color-script.html               # Emotion → palette → lighting → prompt
    └── scenario.html                   # Multi-act CG scripts (visual novel style)
```

---

## Three Rules (never violated)

1. **Scene First** — Scene before prompt. Prompt is always the last step.
2. **Character First** — Character is the center. All else serves the character.
3. **Emotion First** — User remembers the feeling, not the prompt words.

---

## Core idea

> **Prompt describes a picture. Scene describes a moment.**
>
> A great CG is not great because its prompt is long. It's great because it captures a moment worth remembering.

Evolution: **Prompt Engineering → Scene Engineering → Visual Story Engineering**

---

## Quick start (local)

```bash
git clone https://github.com/starplatium1129-stack/ai-cg-studio.git
cd ai-cg-studio
# open index.html in browser, or:
python -m http.server 8090
# then visit http://localhost:8090
```

Nothing else. Pure HTML + CSS, zero dependencies (except Google Fonts).

---

## Documentation

All specs are self-contained interactive HTML. Start with:

- [Worldview](docs/worldview.html) — read this first (the soul of the project)
- [Philosophy](docs/philosophy.html) — why Scene > Prompt
- [Director Flow tool](tools/director-flow.html) — start creating

---

## Roadmap (high-level)

| Version | Focus |
|---|---|
| v0.5 | Docs + tools + design system *(current)* |
| v1.0 | Prompt Builder 3.0 — unified tool |
| v2.0 | Scene library 500+ with community submissions |
| v3.0 | AI-assisted director — one sentence → full scene decision |
| v4.0 | Image management & gallery |
| v5.0 | LoRA library management |
| v6.0 | ComfyUI workflow export |
| v7.0 | Cloud sync + community |

See [Roadmap](docs/roadmap.html) for full detail.

---

## Designed for

- Creators who want to generate Galgame CG with AI
- LoRA trainers who need scene-level test/comparison workflow
- Anyone tired of stacking tags and getting empty images

---

## Tech stack

Pure HTML + CSS + vanilla JS. No framework, no build step, no node_modules. Designed to be forked, read, and extended.

---

## License

TBD (open source, choose your license)

---

## Author

[starplatium1129-stack](https://github.com/starplatium1129-stack)
