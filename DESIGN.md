---
version: "alpha"
name: "Lingji Atelier"
description: "A sweet, image-first Galgame creation desk for Ayachi Nene and Shiki Natsume."
colors:
  primary: "#FF8FC4"
  on-primary: "#241331"
  primary-hover: "#FFB3D9"
  secondary: "#D8B4FE"
  tertiary: "#7FE7FF"
  neutral: "#2B1823"
  neutral-deep: "#1B1017"
  surface: "#4D2236"
  surface-elevated: "#6A2F4A"
  text-primary: "#FFF5FB"
  text-secondary: "#E8D3E1"
  success: "#81C784"
  warning: "#FFA726"
  danger: "#FF9B8F"
  info: "#90CAF9"
  # 2026-08-28: 浅色主题已下线（美术审计 · 方案 A），light-* 字段随之一并移除。
  # 2026-09-01: 升级为甜系 Galgame 夜主题：高饱和樱花粉 + 薰衣草紫。
  # 深色是唯一主题，上面的 primary / surface / text-* 即唯一真相。
  # frontmatter 是语义色板，CSS 实现用另一套名字，映射如下——
  #   primary→--accent, primary-hover→--accent-hover, secondary→--accent-violet,
  #   on-primary→--text-inverse, neutral→--bg-base, surface→--bg-surface,
  #   surface-elevated→--bg-elevated, disabled-text→--text-disabled,
  #   nene→--nene-violet, natsume→--natsume-amber。tertiary 为历史语义色无直接对应。
  # disabled-text 为禁用态专用：不得用 opacity 压字（压后低于 AA 4.5:1）。
  disabled-text: "#C9AEC0"
  nene: "#D8B4FE"
  natsume: "#F2BB68"
typography:
  display:
    fontFamily: "Noto Sans SC, HarmonyOS Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Noto Sans SC, HarmonyOS Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Noto Sans SC, HarmonyOS Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Noto Sans SC, HarmonyOS Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.7
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  4xl: "64px"
rounded:
  # 2026-09-01: 甜系升级，与 design-system.css --r-* 对齐（大圆角萌系贴纸感）。
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  pill: "999px"
components:
  page-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-primary}"
  surface-dark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  surface-elevated:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  text-secondary-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-secondary}"
  status-success:
    backgroundColor: "{colors.neutral-deep}"
    textColor: "{colors.success}"
  status-warning:
    backgroundColor: "{colors.neutral-deep}"
    textColor: "{colors.warning}"
  status-danger:
    backgroundColor: "{colors.neutral-deep}"
    textColor: "{colors.danger}"
  status-info:
    backgroundColor: "{colors.neutral-deep}"
    textColor: "{colors.info}"
  character-nene:
    backgroundColor: "{colors.nene}"
    textColor: "{colors.on-primary}"
  character-natsume:
    backgroundColor: "{colors.natsume}"
    textColor: "{colors.on-primary}"
  accent-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
  accent-tertiary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
---

## Overview

绫季绘境 is a personal Galgame creation desk, not a generic dashboard and not
a public AI platform. Its visual character is quiet, intimate, precise, and
slightly romantic. It should feel like opening a private visual-novel art book
inside a capable creative tool.

The generated image, the chosen character, and the story moment are always the
visual protagonists. Interface decoration supports those three things and never
competes with them. Sakura pink is the primary interaction accent; silver violet
belongs to Ayachi Nene, while amber and coffee tones belong to Shiki Natsume.

This file is the single source of truth for website and control-panel design.
`src/assets/css/design-system.css` is its runtime implementation. When the two
disagree, update the CSS to follow this document. `docs/art-direction.html` is
intentionally separate: it specifies the visual direction of generated CG
artwork, not website UI.

## Product character

The product has two coordinated voices:

- Narrative surfaces borrow the intimacy and route-specific atmosphere of a
  polished Galgame: character art, short personal copy, quiet transitions, and
  scene-first choices.
- Operational surfaces borrow the clarity of a serious field terminal: service
  state, queue state, current model, recovery action, and generation decisions
  are explicit and compact.

Do not copy the visual skin, iconography, naming, or lore of another game.
Arknights and Endfield are references for information discipline; Yuzusoft is a
reference for character intimacy. 绫季绘境 must still look and sound like one
original personal atelier.

Ayachi Nene and Shiki Natsume are the primary routes rather than interchangeable
skins. Empty states, conversation starters, scene discovery, and character
accents may reflect their different temperaments. Static character art must stay
completely still; animation belongs to a validated Live2D model, page transition,
or voice feedback—not to periodic transforms on a still portrait.

## Colors

The theme is dark only. Backgrounds are violet-black instead of flat black, and
surfaces are slightly lighter with restrained translucency where it improves
hierarchy.

> **2026-08-28 · 浅色主题下线（美术审计 · 方案 A）**
> 此前是 dark / light 双主题，但两者并不对等：设计系统的 154 个令牌本来就
> 围绕深色调设计，浅色是后补的 50 个覆盖，覆盖率只有 32.5%，20 套角色主题
> 里 17 套没有浅色版。对单人使用的创作工具，维护两套完整主题是纯负债 ——
> 每新增一个颜色都要写两遍。现已锁定深色：浅色覆盖、`AppThemeToggle`、
> `theme-fade` 切换过渡均已移除，`preferredTheme()` 恒为 `dark`。
> 若日后要恢复双主题，先补角色主题浅色版，再放开开关，不要只开开关。

- Use `primary` only for the current selection, the main call to action, focus,
  or a small piece of emphasis. A page must not look uniformly pink.
- Use Nene violet and Natsume amber to clarify character context. They are not
  competing global action colors.
- Keep body text neutral. Long paragraphs, parameters, and metadata must not use
  decorative gradients.
- Success, warning, danger, and information colors communicate state only.
- Maintain WCAG AA contrast for normal text. If a translucent surface makes
  contrast uncertain, use its opaque fallback.
- Do not introduce a near-duplicate color when a token already expresses the
  same role.

Runtime surfaces may use the alpha values already defined in
`src/assets/css/design-system.css`; the opaque colors in the front matter are
their validation fallbacks. Disabled controls must use the `--text-disabled`
token directly — never `opacity` on a text-bearing control, because alpha
compositing drops it below AA.

## Typography

Chinese text is primary. English labels such as Scene, Prompt, LoRA, Seed, and
SD WebUI may appear when they are established terms, but must not make an action
harder to understand.

- Use the sans stack for all interface and reading text.
- Use the mono stack only for prompts, seeds, model names, ports, paths, and
  machine-readable state.
- Headings are compact and confident, not oversized landing-page slogans.
- Buttons use short verbs. Error messages state what happened and what the user
  can do next.
- Never depend on font weight or color alone to distinguish a critical state.

## Layout

Use the 4/8/12/16/24/32/48/64 spacing scale. Normal pages use a `1200px` content
maximum. Dense creative workspaces may use the available viewport width while
preserving at least `16px` outer breathing room.

The director workspace follows an image-first hierarchy:

1. The canvas/result stage is the largest region and remains visible before and
   after generation.
2. Story and scene selection form the starting rail.
3. Director decisions form a secondary rail with progressive disclosure.
4. Prompt internals, model details, backup, and diagnostics are utilities, not
   the default visual focus.

At wide desktop sizes, side rails should be approximately `268–324px`; remaining
width belongs to the stage. After an image exists, do not shrink it merely to
show every control without scrolling. Empty space must either frame the artwork,
clarify grouping, or improve touch/click accuracy. Large blank zones with no
communicative purpose are a layout defect.

Desktop is the primary creation environment. Responsive order is stage first,
then story/scene, then detailed decisions. On small screens, controls become a
single column, primary actions stay reachable, and tap targets should be at least
`40px` high; mobile compatibility must not shrink or weaken the desktop stage.

Scene discovery must expose search and the most useful filters near the results.
Do not require a friend who has never used the site to understand the taxonomy
before they can find a scene.

The footer is a quiet colophon, not a floating island: pages keep it pinned to
the bottom of the viewport on short content (`body` is a column flex container
and the footer uses `margin-top: auto`), so no page shows a stranded footer with
empty space beneath it.

## Elevation & Depth

Depth is restrained and functional:

- Level 1: static information, soft border, little or no shadow.
- Level 2: selectable cards and controls, modest hover lift.
- Level 3: the primary action, active modal, or artwork viewer.

Glass surfaces are allowed for navigation, floating utilities, and the director
stage chrome. They must have an opaque fallback and must not be stacked until
text becomes hazy. Prefer one clear surface boundary over several nested glowing
cards. Motion uses the existing `150ms` and `240ms` timings; page and character
transitions may be slightly slower, but never delay an action.

Honor `prefers-reduced-motion` and `prefers-reduced-transparency`.

## Shapes

Use `8–10px` radii for inputs and compact controls, `14–20px` for cards and
sections, and pill shapes only for filters, small status badges, and segmented
controls. The artwork viewer or main stage may use a larger optical radius (up
to 24px) when it reads as one continuous frame.

Do not mix sharp system-tool rectangles, soft consumer-app pills, and oversized
glass bubbles in the same control group. Icon geometry, border weight, radius,
and padding must make adjacent controls feel like one family.

## Anime Visual Language

Established 2026-08-01. This project reads as a blog-style anime atelier: dark
violet night as the single theme. The
"anime" feel comes from light layering, sticker-like details, and motion
rhythm — never from oversaturation (see Colors) or from copying an official
game site.

### Theme semantics

- The single theme is "night studio": violet-black base, sakura pink accent,
  star specks and drifting petals as quiet atmosphere.
- Everything must pass the contrast gate. Disabled controls use the
  `--text-disabled` token rather than opacity.
- (2026-08-28) The former "pink-white dream" light theme is retired; see the
  note under Colors before reinstating it.

### Decor layers (all fixed, pointer-events: none, aria-hidden)

- `body` background: 1px dot grid (24px cell, derived from `--border-strong`)
  plus two character-color light orbs that float on artistic pages.
- `.kana-watermark`: vertical kana signature ("あとりえ / ATELIER ARCHIVE") on
  the right mid-edge; hidden on the director, training, and narrow screens.
- `.starfield`: sparse pink-violet star specks drifting slowly; must never
  compete with reading contrast.
- Sakura petals fall as a foreground layer on artistic pages.
- New floating decorations must be token-colored, reduced-motion safe, and
  either hidden or severely dimmed on content-dense pages.

### Sticker & polaroid rules

- Chibi/polaroid cards may tilt alternately (±2deg), wear a sticker caption
  and a rotated character-color stamp (NENE violet / NATSUME amber).
- Polaroid frames (padding + bottom caption) are for unpacked game material
  only; ordinary UI cards stay flat and token-driven.
- Seals (red "綾季" stamp) are reserved for the footer signature; do not
  scatter seal-like badges elsewhere.

### Gradient text

- `background-clip: text` is allowed only on `.hero-title`, `.page-header`,
  and `.title-gradient` (enforced by test-style-debt.js).
- Everywhere else, color stays flat and token-based.

### Q-version assets

- Source: `scripts/maintenance/chibi-import.py` converts unpacked SD event CGs
  into 480/960px webp pairs under `assets/chibi/`.
- Selection standard: medium-shot composition with the full head and ahoge,
  clean background, no English sticker/panel overlays.
- Usage: home chibi strip with dialog lightbox, 404 companion, chat-stage
  expression switcher. Do not reuse a character's chibi in more than one
  context per page.

## Components

### Navigation

Keep the primary navigation short and stable. The current page is visible, but
navigation does not compete with the artwork. Mobile navigation opens as a clear
menu with text labels.

Shared atelier chrome lives in `src/assets/css/design-system.css`: `.nav-back`,
`.page-kicker` (aliases `.pb-kicker` / `.gallery-kicker`), `.page-title`,
`.page-subtitle`, `.page-intro`, `.atelier-shell`, `.sticky-toolbar`,
`.filter-pill`, and `.empty-state`. Prefer these over page-local copies.
Director-only layout lives in `css/director.css`.

### Buttons

Each region has at most one visually dominant action. Primary means “continue or
generate,” secondary means “adjust or inspect,” and danger is reserved for
destructive or interrupting actions. Related buttons share height, radius, icon
style, and baseline. Never make a critical action icon-only.

### Cards

Cards express grouping or selection, not decoration. Avoid a card inside a card
inside another card unless each boundary represents a real interaction layer.
Selectable scene cards prioritize title, character, story cue, and preview;
technical tags are supporting metadata.

Scene cards lead with the real reviewed sample, not a decorative gradient: the
card band loads `/scene-showcase/thumbs/<scene-id>.jpg` and silently falls back
to the gradient band when the thumbnail is missing, so the page still works on a
plain static server. Adult-rated thumbnails stay blurred until hover or keyboard
focus. A small mono archive code (`SC-XXX`) sits on the artwork as provenance,
and signature or curated marks appear as one quiet corner badge at most.
Internal audit labels such as `official_cg` or `visual_audited` never render as
visible tags.

### Inputs and filters

Inputs show a persistent label when their meaning is not obvious. Search remains
recognizable as search. Selected filters are visually distinct and removable.
Advanced parameters are collapsed by default for first-time users and retain
their previous state for experienced users.

Maintenance pages use plain language and staged saving. A person who does not
write code must be able to add, duplicate, edit, retire, and validate a Scene or
replace its reviewed sample without opening JSON or a terminal. Destructive
changes remain pending until an explicit project save creates a backup and
passes validation.

### Director stage

The stage is the visual anchor. Before generation it presents one obvious next
step and a quiet character cue. During generation it shows progress without
covering the composition. After generation the artwork receives maximum useful
space; save, regenerate, vary, voice, and review actions sit near it without
forming a second competing dashboard.

### Status and errors

Connection, generation, voice, and sharing states use a short label plus a
specific recovery action. Color reinforces the state but is never the only
signal. Raw logs stay behind a disclosure unless troubleshooting is active.

### Character styling

Nene context may use silver-violet accents; Natsume context may use amber-coffee
accents. Character art is meaningful identity content, not a watermark. Keep it
subtle behind controls and fully legible on character or result-focused pages.

## Do's and Don'ts

### Do

- Make the first useful click obvious to a friend seeing the site for the first
  time.
- Let artwork occupy the largest meaningful area in creation and review flows.
- Reuse variables and shared components from `src/assets/css/design-system.css`.
- Use progressive disclosure for expert controls.
- Keep current selection, progress, empty, error, and success states explicit.
- Test desktop, narrow desktop, and mobile layouts after structural UI changes.
- Preserve keyboard focus, readable contrast, reduced-motion support, and
  minimum target sizes.
- Prefer one calm hierarchy over many equally loud cards and buttons.

### Don't

- Do not imitate Apple, Figma, Notion, or a generic anime site as an end goal.
  Borrow useful interaction principles while preserving this project's identity.
- Do not add decorative whitespace, glow, blur, gradients, or floating shapes
  without a hierarchy or storytelling purpose.
- Do not hide the generated image behind parameters, logs, or prompt text.
- Do not introduce page-local colors, shadows, or radii when a shared token fits.
- Do not use emoji-only controls for navigation or important actions.
- Do not duplicate Scene titles or character data in page markup.
- Do not show every advanced option merely because space is available.
- Do not redesign one page in isolation without checking navigation, director,
  scene library, showcase, character pages, and control panel as one family.
