# Design Review: 基金即時估值 UI Redesign

Reviewed against: `.design/ui-redesign/DESIGN_BRIEF.md`
Philosophy: **Calm Instrument** (Dieter Rams × fintech restraint)
Date: 2026-07-02

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-loaded-light-mobile-375.png` | Mobile (375×812) | Loaded fund, light |
| `screenshots/review-loaded-dark-mobile-375.png` | Mobile (375×812) | Loaded fund, dark |
| `screenshots/review-loaded-light-tablet-768.png` | Tablet (768×1024) | Loaded fund, light |
| `screenshots/review-loaded-dark-tablet-768.png` | Tablet (768×1024) | Loaded fund, dark |
| `screenshots/review-loaded-light-desktop-1280.png` | Desktop (1280×800) | Loaded fund, light |
| `screenshots/review-loaded-dark-desktop-1280.png` | Desktop (1280×800) | Loaded fund, dark |
| `screenshots/review-empty-light-mobile-375.png` | Mobile (375×812) | Empty state, light |
| `screenshots/review-empty-dark-mobile-375.png` | Mobile (375×812) | Empty state, dark |
| `screenshots/review-search-open-dark-mobile-375.png` | Mobile (375×812) | Search suggestions open, dark |
| `screenshots/review-drawer-light-mobile-375.png` | Mobile (375×812) | Favorites drawer open, light |
| `screenshots/review-drawer-dark-mobile-375.png` | Mobile (375×812) | Favorites drawer open, dark |

> All screenshots are in `.design/ui-redesign/screenshots/`. Captured with Playwright/Chromium at deviceScaleFactor 2.

## Post-Review Change: Favorites moved to a drawer

Per user feedback, the top favorites chip row was replaced with a **header hamburger (with count badge) → left slide-in drawer**. This removes lateral competition with the hero and frees the main column. The drawer lists saved funds (name + code), highlights the current one, allows per-item removal, shows an empty message, and is dismissible via overlay / close button / Esc with basic focus management. Verified in `screenshots/review-drawer-light-mobile-375.png` and `screenshots/review-drawer-dark-mobile-375.png`. The brief and IA were updated to match.

## Summary

The redesign lands the brief cleanly: the estimated move is unmistakably the hero (huge Space Grotesk numeral, semantic color, ▲/▼ arrow), the trust strip earns belief directly beneath it, and the holdings table recedes into a calm, tabular readout. Both light and dark palettes feel intentional, not inverted. The biggest issue found — down-green failing WCAG AA on the light background — was caught in the visual pass and **fixed** during review.

## Must Fix

1. **Down-green failed contrast in light mode** — `--color-down: #0e9f6a` on the light page background measured **3.17:1**, below AA's 4.5:1 for the small change/contribution numbers (red up passed at 4.5:1). See `screenshots/review-loaded-light-mobile-375.png`. _Fixed: darkened to `#0a7f54` (4.69:1 on page, 5.03:1 on card) in `tokens.css`; re-verified visually — negative numbers now read clearly while the red/green convention holds._

## Should Fix

1. **"Live" dot reuses green** — the update-time indicator (`.t-live::before`) is green, which in the Taiwan convention also means "down." It's spatially separate from directional numbers and is a filled status dot (not text), so the clash is mild, but a neutral or accent-blue dot would remove any ambiguity. See `screenshots/review-loaded-dark-mobile-375.png`. _Suggestion: switch the live dot to `--color-accent-primary` or `--color-text-tertiary`._

## Could Improve

1. **Desktop side margins** — at 1280px the content sits in a centered 600px column with large empty flanks (`screenshots/review-loaded-light-desktop-1280.png`). This is intentional per the brief ("a phone-shaped tool that stays composed on big screens"), but a very faint page texture or a slightly wider column (≤680px) could make the desktop view feel less sparse. Low priority.
2. **Hero arrow weight** — the ▲ glyph is fairly heavy directly above the number. A slightly smaller arrow or more gap would refine the vertical rhythm. Cosmetic.
3. **Empty-state vertical centering** — on tall viewports the empty prompt sits high with lots of space below. Could vertically center within the viewport for balance.

## What Works Well

- **Hierarchy is exactly right.** The hero dominates; eye goes number → trust strip → holdings in that order, every time. The brief's "one answer, unmistakable" principle is visibly achieved.
- **Type choice pays off.** Space Grotesk gives the numerals a confident, instrument-like character with true tabular alignment; Noto Sans TC keeps Chinese crisp. No generic-AI feel.
- **Trust strip** turns former debug text into a legible, scannable proof panel — the coverage meter is a nice, quiet touch that communicates "how much of the fund" without a sentence.
- **Both themes are considered.** Dark is a cool near-black slate with off-white ink (not #000/#fff); light is a warm neutral. Shadows and accent lightness are tuned per theme.
- **Holdings recede correctly** — muted header, hairline dividers, right-aligned tabular numbers, and the contribution micro-bar reads at a glance without shouting.
- **States are handled** — inviting empty state ("看今天該不該買"), skeleton loading, calm error, and honest 未取價 disclosure.

## Checklist Notes

- **Responsive**: Mobile-first with `min-width` queries; no horizontal scroll at 375px; tabular numerals keep columns aligned across all three widths. ✓
- **Accessibility**: `<h1>` present; table `<th scope="col">`; icon buttons have `aria-label`; suggestions are a `listbox`/`option`; hero card is `aria-live="polite"`; focus rings via `:focus-visible` + `--shadow-focus`; `prefers-reduced-motion` disables shimmer/settle/pulse. Contrast now AA in both themes after the green fix. ✓
- **Motion**: Single settle on load/refresh, gentle live pulse, star scale — all purposeful, none anxious; reduced-motion honored. ✓
- **Tokens**: Every component references `tokens.css`; no hardcoded hex remaining in `styles.css`. ✓
