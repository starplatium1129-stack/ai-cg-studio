---
version: "alpha"
name: "Lingji Atelier"
description: "A quiet, image-first Galgame creation desk for Ayachi Nene and Shiki Natsume."
colors:
  primary: "#F4A6D7"
  on-primary: "#17171C"
  primary-hover: "#FFC1E8"
  secondary: "#BBA7FF"
  tertiary: "#90D9FF"
  neutral: "#171329"
  neutral-deep: "#100D1B"
  surface: "#251F3D"
  surface-elevated: "#3B315B"
  text-primary: "#E8E8F0"
  text-secondary: "#A8A8C0"
  success: "#66BB6A"
  warning: "#FFA726"
  danger: "#EF5350"
  info: "#42A5F5"
  light-background: "#F8F5FF"
  light-surface: "#FFFFFF"
  light-primary: "#AD467F"
  light-text-primary: "#2C2C3A"
  light-text-secondary: "#5A5A6E"
  nene: "#B895FF"
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
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
components:
  page-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-primary}"
  page-light:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-text-primary}"
  surface-dark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  surface-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text-primary}"
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
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  text-secondary-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-secondary}"
  text-secondary-light:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-text-secondary}"
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

AI CG Studio is a personal Galgame creation desk, not a generic dashboard and not
a public AI platform. Its visual character is quiet, intimate, precise, and
slightly romantic. It should feel like opening a private visual-novel art book
inside a capable creative tool.

The generated image, the chosen character, and the story moment are always the
visual protagonists. Interface decoration supports those three things and never
competes with them. Sakura pink is the primary interaction accent; silver violet
belongs to Ayachi Nene, while amber and coffee tones belong to Shiki Natsume.

This file is the single source of truth for website and control-panel design.
`css/design-system.css` is its runtime implementation. When the two disagree,
update the CSS to follow this document. `docs/art-direction.html` is intentionally
separate: it specifies the visual direction of generated CG artwork, not website
UI.

## Colors

The dark theme uses violet-black backgrounds instead of flat black. Surfaces are
slightly lighter and may use restrained translucency where it improves hierarchy.
The light theme uses warm lavender-white instead of clinical white.

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

Dark runtime surfaces may use the alpha values already defined in
`css/design-system.css`; the opaque colors in the front matter are their
validation fallbacks. The canonical light values are background `#F8F5FF`,
surface `#FFFFFF`, primary `#AD467F`, primary text `#2C2C3A`, and secondary text
`#5A5A6E`.

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

Responsive order is stage first, then story/scene, then detailed decisions. On
small screens, controls become a single column, primary actions stay reachable,
and tap targets should be at least `40px` high.

Scene discovery must expose search and the most useful filters near the results.
Do not require a friend who has never used the site to understand the taxonomy
before they can find a scene.

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

Use `4–8px` radii for inputs and compact controls, `12–16px` for cards and
sections, and pill shapes only for filters, small status badges, and segmented
controls. The artwork viewer or main stage may use a larger optical radius when
it reads as one continuous frame.

Do not mix sharp system-tool rectangles, soft consumer-app pills, and oversized
glass bubbles in the same control group. Icon geometry, border weight, radius,
and padding must make adjacent controls feel like one family.

## Components

### Navigation

Keep the primary navigation short and stable. The current page is visible, but
navigation does not compete with the artwork. Mobile navigation opens as a clear
menu with text labels.

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

### Inputs and filters

Inputs show a persistent label when their meaning is not obvious. Search remains
recognizable as search. Selected filters are visually distinct and removable.
Advanced parameters are collapsed by default for first-time users and retain
their previous state for experienced users.

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
- Reuse variables and shared components from `css/design-system.css`.
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
