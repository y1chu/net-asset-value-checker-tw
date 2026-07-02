# Build Tasks: 基金即時估值 UI Redesign

Generated from: .design/ui-redesign/DESIGN_BRIEF.md
Date: 2026-07-02
Philosophy: **Calm Instrument** (Dieter Rams × fintech restraint). Establish it in the first build task.

The app is a single-page vanilla HTML/CSS/JS frontend in `public/` (`index.html`, `app.js`, `styles.css`). Backend (`/api/fund/:code`, `/api/search`) is unchanged and reused as-is. All styling moves onto the token system.

## Foundation
- [x] **Design tokens**: `public/tokens.css` with light + dark palettes, 8px spacing scale, Space Grotesk + Noto Sans TC type ramp, radii, shadows, motion. _New file._
- [ ] **Load fonts + tokens, no-flash theme**: Add Google Fonts (Space Grotesk, Noto Sans TC) and `tokens.css` to `index.html`; add an inline pre-paint script that resolves saved/system theme onto `<html data-theme>` before first paint. _Modifies: index.html._ Establishes the aesthetic immediately.
- [ ] **App shell**: `<header>` (search + theme toggle) / `<main>` (max-width centered column) / footer disclaimer, all on tokens. Sticky header with blur. _Modifies: index.html, styles.css._

## Core UI
- [ ] **Hero / estimated move** (highest visual priority — build early to validate the direction): The centerpiece. Space Grotesk numeral at `--font-size-4xl`, tabular figures, semantic up/down color, `+/−` sign and label 今日估算漲跌. Fund name above, trust strip below. `aria-live="polite"`. _Modifies: index.html, app.js render(), styles.css._
- [ ] **Trust strip**: fund name(code), 資料月份, 涵蓋 %, 更新 time, 未取價 list — as a calm, legible metadata row/grid under the hero. Coverage rendered as a subtle proportion cue. _Modifies: app.js, styles.css._
- [ ] **Holdings table**: Restyle to recede — muted header, hairline row dividers, tabular numerals, right-aligned numbers. Name+code, 權重, 現價, 漲跌, 貢獻 with a refined contribution micro-bar. No horizontal scroll at 375px. _Modifies: styles.css, app.js render()._
- [ ] **Search field**: Restyle on tokens; ≥44px target; clear focus ring; clear (×) button; 16px input to avoid iOS zoom. _Modifies: index.html, styles.css._
- [ ] **Autocomplete suggestions**: Restyle dropdown to `--color-bg-elevated` + `--shadow-lg`; keep name / company / code columns; token-based `.active` keyboard highlight. _Modifies: styles.css._
- [ ] **Favorites chips**: Restyle to pill tokens; `current` state uses accent ring; horizontal scroll strip; star toggle fill/color. _Modifies: styles.css._

## Interactions & States
- [ ] **Theme toggle**: Sun/moon button in header; toggles `[data-theme]`, persists to localStorage, updates `color-scheme`. Keyboard + `aria-label`. _New small component. Modifies: index.html, app.js, styles.css._
- [ ] **Loading / empty / error states**: Hero skeleton shimmer + 2–3 ghost table rows on load; inviting empty state (prompt to search) when no fund; calm error (invalid code / fetch fail) in the hero slot. _Modifies: app.js, styles.css._
- [ ] **Motion pass**: Single soft settle on hero update/refresh (`--easing-settle`), gentle chip/star transitions, no layout shift; wrap all in `prefers-reduced-motion: reduce` guard. _Modifies: styles.css._

## Responsive & Polish
- [ ] **Responsive**: Mobile-first (375px baseline, `min-width` queries). At ≥768px: max-width column stays centered, hero + rhythm scale up slightly. Verify no overflow, tabular alignment holds. Breakpoints: 375, 768, 1280. _Modifies: styles.css._
- [ ] **Accessibility pass**: Contrast AA in both themes (esp. up-red / down-green on both bgs); `<h1>` present; table `<th scope>`; focus rings on all controls; icon buttons labelled; hero `aria-live`; reduced-motion honored. _Modifies: index.html, styles.css._

## Review
- [ ] **Design review**: Run /design-review against the brief — screenshots at 375/768/1280 in both themes, saved to `.design/ui-redesign/screenshots/`, findings in `DESIGN_REVIEW.md`.
