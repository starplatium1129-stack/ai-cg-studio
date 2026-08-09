# Round 4 State Language

## State Matrix

| State | `ArchiveStatePanel` kind | Meaning | Focus/announcement |
| --- | --- | --- | --- |
| Reading | `loading` | Data is still being read | `role="status"` |
| Empty | `empty` | Data read successfully, with zero records | Passive semantic section |
| Filtered | `filtered` | Records exist, but the active search/filter has no match | Passive semantic section |
| Failed | `error` | Reading or archive access failed | `role="alert"` |

## Changes

- Added `filtered` with the search icon, `NO FILTER MATCH` default code, and `data-kind` exposure.
- Kept loading and error announcement roles; empty and filtered states do not claim live-region focus.
- Updated SceneExplorer, Gallery, and Showcase filter misses to `filtered`.
- Updated Showcase manifest loading to `loading`.
- Added a real empty state for a successfully loaded character list with zero entries, without rendering a tablist.
- Replaced Home recent-work bespoke empty markup with the shared compact archive panel, preserving the grid span and drawing action.

## Tests

- `node scripts/tests/test-archive-state-panel.js`
- `node scripts/tests/test-page-architecture.js`
- `node scripts/tests/test-gallery.js`
- `node scripts/tests/test-showcase.js`
- `node scripts/tests/test-scene-ux.js`
- `node scripts/tests/test-character-profiles.js`
- `node scripts/tests/test-quality-gates.js`
- `npm run typecheck:app`

Full validate was intentionally not run. A scoped `npm run build` was run after the compact visual fix so the browser server served the current bundle.

## Browser Sign-off

Checked against the existing `node server.js` web server with Playwright and Edge headless. No production API or E2E file was changed.

| Page/state | Viewport | Result | Evidence |
| --- | --- | --- | --- |
| Home recent-work empty, compact | 1440x960 | PASS; document/body width `1440`, panel height `245.6px`, action remains inside panel | `.review-shots/round4-state-language/home-desktop.png`, `home-desktop-compact.png` |
| Home recent-work empty, compact | 390x844 | PASS; document/body width `390`, panel height `232.8px`, action remains inside panel | `.review-shots/round4-state-language/home-phone.png`, `home-phone-compact.png` |
| SceneExplorer no filter match | 1440x960 | PASS; `data-kind="filtered"`, `NO FILTER MATCH`, visible reset action | `.review-shots/round4-state-language/scene-filtered.png` |
| Showcase manifest loading | 1440x960 | PASS; `data-kind="loading"`, `READING LOCAL ARCHIVE`, visible loading copy | `.review-shots/round4-state-language/showcase-loading.png` |
| Showcase no filter match | 1440x960 | PASS; `data-kind="filtered"`, `NO FILTER MATCH`, visible reset action | `.review-shots/round4-state-language/showcase-filtered.png` |
| Character normal data path | 1440x960 | PASS; 2 character tabs and 宁宁 profile rendered | `.review-shots/round4-state-language/character-normal.png` |

Character empty-data rendering was not browser-mocked; it remains covered by the deterministic contract test because creating an empty profile source would require replacing the existing data path.

## Remaining Risk / SOL Review

- No new E2E was added: the deterministic source contract covers the stable state branches without changing test fixtures or page data loading.
- SOL should recheck visual spacing for the compact Home panel and confirm passive empty/filtered states remain readable at narrow widths.
- Browser sign-off confirms the compact panel no longer inherits the full empty-state wall height; remaining SOL review is limited to the unmocked Character empty-data visual path.
