# Design Brief: 基金即時估值 UI Redesign

## Problem

Every morning, before the fund company publishes its official NAV, the user wants to know one thing: **"Is this fund up or down today, and should I buy?"** The current app already computes that answer, but it looks like a debugging readout — a flat dark page, a generic blue accent, system fonts, an undifferentiated table. The information is right, but nothing guides the eye to the one number that matters, and it doesn't feel trustworthy enough to act on money.

## Solution

A single, calm screen that answers the buy question at a glance. The estimated day move is the hero — large, precise, confidently typeset — with just enough supporting context (data freshness, how much of the fund is covered) to trust it. The holdings breakdown is present for the curious but visually recedes. Opening the app should feel like checking a well-made instrument: you look, you know, you're done in two seconds.

## Experience Principles

1. **One answer, unmistakable** — The estimated move dominates every other element combined. Coverage and freshness sit right under it as trust signals. Everything else is secondary by construction.
2. **Calm over live-wire** — This is a decision aid, not a trading terminal. Motion is gentle and purposeful (a soft settle on refresh), never anxious flashing. Confidence comes from stillness and precision.
3. **Honest about its own certainty** — The estimate is a proxy (top-10 holdings only). The design surfaces coverage % and "未取價" gaps plainly rather than implying false precision. Trust is earned by disclosure.

## Aesthetic Direction

- **Philosophy**: "Calm Instrument" — Dieter Rams functionalism crossed with modern fintech restraint. Less but better: every element earns its place, structure over decoration, one functional accent. Numbers are treated as the primary typographic material.
- **Tone**: Calm confidence. Quiet, steady, reassuring. You trust the number.
- **Reference points**: Premium banking apps (Cathay Richart, Revolut's calm balance screens), the composure of a Braun product, tabular financial readouts done tastefully.
- **Anti-references**: Bloomberg terminal density; flashing red/green tickers; casual crypto-app gradients; generic AI look (Inter font, purple-on-white, evenly-weighted card grids).

## Existing Patterns

The current app (single-page vanilla HTML/CSS/JS, no framework) establishes vocabulary the redesign extends:

- **Typography**: System stack (`PingFang TC`, `Microsoft JhengHei`). No display font. → **Replace** with a real pairing: Space Grotesk (Latin/numerals, tabular figures) + Noto Sans TC (Chinese).
- **Colors**: Dark-only. `--bg #0b0f14`, `--panel #131a22`, `--line #223040`, `--text #e7eef5`, `--dim #8496a8`, `--up #ff4d4d`, `--down #22c55e`, `--accent #3b82f6`. → **Keep the semantic model** (Taiwan convention red = up / green = down is fixed), extend into a full token system with a light palette and a refined accent.
- **Spacing**: Ad-hoc px values. → **Replace** with an 8px-based scale.
- **Components**: Sticky top bar with search input, autocomplete dropdown (`.suggest`), favorites chip row (`.fav-bar`), hero (`.hero` with `.est-move`), meta row, holdings `<table>`, disclaimer. All reused, restyled to tokens.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Design tokens (`tokens.css`) | New | Light + dark, both intentional (not inverted). Foundation for all else. |
| App shell / layout container | Modify | Add max-width, safe-area, theme attribute, header/main structure. |
| Theme toggle | New | System-default + manual override, persisted. Small, in header. |
| Search field | Modify | Restyle to token system; larger touch target; clearer focus ring. |
| Autocomplete suggestions | Modify | Restyle; keep name/company/code layout; add keyboard-active styling. |
| Favorites drawer | New | Left slide-in drawer opened from a header hamburger (with count badge); lists saved funds (name + code), current highlighted, per-item remove, empty message. Replaces the earlier top chip row so the hero owns the main column. |
| Hero / estimated move | Modify | The centerpiece. Space Grotesk, large, semantic color, trust sub-line. |
| Coverage / freshness meta | Modify | Turn the text meta into a legible trust strip (data month, coverage, updated). |
| Holdings table | Modify | Recede visually; tabular numerals; contribution as a refined micro-bar. |
| Empty / loading / error states | Modify | Distinct, calm treatments (skeleton for load, quiet error, inviting empty). |
| Disclaimer | Reuse | Restyle to caption token. |

## Key Interactions

- **Search**: Typing (debounced) opens the suggestion list; ↑/↓ moves an `.active` highlight, Enter selects, Esc/outside-click dismisses. Selecting loads the fund and clears the field.
- **Load**: Show a calm skeleton for the hero + a few table rows; on data, the hero number does a single soft fade/settle (200–250ms), not a flash. Respect `prefers-reduced-motion`.
- **Refresh (30s)**: The hero and changed cells update with a brief, low-opacity settle — perceptible but not distracting. No layout shift.
- **Favorite**: Star toggles fill + color; the fund is added/removed from the favorites drawer and the hamburger count badge updates.
- **Favorites drawer**: Hamburger opens a left slide-in panel over a dimming overlay (`--easing-settle`); tapping a fund loads it and closes the drawer; overlay-click / close-button / Esc dismiss; focus moves to the close button on open and returns to the hamburger on close.
- **Theme toggle**: Instant swap via `[data-theme]`; no color flash on load (resolve theme before first paint).

## Responsive Behavior

- **Mobile (default, 375px)**: Single column. Header (search + theme toggle) sticky. Hero centered. Holdings as a table that fits without horizontal scroll (compact columns, tabular numerals keep alignment).
- **Tablet/Desktop (≥768px)**: Content max-width ~560–640px, centered — this is a phone-shaped tool that stays composed on big screens rather than stretching. Slightly larger hero and more generous vertical rhythm. Holdings table gains breathing room but keeps the same structure (no reorganization needed).

## Accessibility Requirements

- Contrast: body text ≥ 4.5:1, large hero ≥ 3:1, in **both** themes. Verify the up/green and down/red against both backgrounds; never rely on color alone — pair with sign (+/−) and arrow/position.
- Keyboard: search, suggestions (arrow/enter/esc), favorites, star, theme toggle all reachable and operable; visible focus ring (`--color-border-focus`).
- Semantics: `<header>`/`<main>`, one `<h1>` (fund name or app title), the holdings table uses real `<th>`/scope. Icon-only buttons (star, theme, clear) have `aria-label`. Live-updating hero uses `aria-live="polite"` so refreshes are announced without spam.
- Motion: `prefers-reduced-motion` disables the settle/pulse transitions.

## Out of Scope

- No new data or analytics (sparklines, intraday estimate history, contribution ranking) — user chose glance-first, not richer analysis.
- No backend/API changes — this is purely the presentation layer (`public/`), reusing existing `/api/fund/:code` and `/api/search`.
- No multi-page navigation, accounts, or persistence beyond existing localStorage (favorites, last fund, theme).
- No i18n toggle — interface stays Traditional Chinese.
