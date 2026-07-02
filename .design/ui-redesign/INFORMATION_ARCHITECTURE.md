# Information Architecture: 基金即時估值

Single-view application. The IA is not about pages — it is about the priority stack within one screen and the states that screen moves through.

## Site Map

- App `/` — the only view
  - (client state) Fund loaded — hero + holdings
  - (client state) Empty — no fund chosen yet
  - (client state) Loading — skeleton
  - (client state) Error — invalid code / fetch failure
  - Static asset `/api/fund/:code` — data (existing, unchanged)
  - Static asset `/api/search?q=` — suggestions (existing, unchanged)

No routing, no deep links. State lives in the client + localStorage.

## Navigation Model

- **Primary navigation**: None in the traditional sense. The **search field** is the primary navigation — it is how the user moves between funds. It sits in a sticky header so it is always reachable.
- **Secondary navigation**: A **hamburger button** (top-left of the header, with a favorites-count badge) opens a **left slide-in drawer** listing the user's saved funds. Tapping one loads it and closes the drawer. This keeps lateral movement one tap away without letting favorites compete with the hero for header space.
- **Utility navigation**: **Theme toggle** in the header (top-right). That is the only utility control.
- **Mobile navigation**: Identical to desktop — this is a mobile-first tool. Sticky header (hamburger + brand + search + theme) with the favorites drawer as the lateral-nav surface. No tabs.

## Content Hierarchy

### App view (single screen), top to bottom

1. **Search field** — Always at top. The entry point for any fund; the app is useless without choosing one, so it leads.
2. **Favorites (in drawer)** — Reached via the header hamburger. For a returning daily user this is the *fastest* path (open drawer, one tap), and moving it off the main column keeps the hero unobstructed. The count badge signals saved funds exist without occupying vertical space.
3. **Estimated move (hero)** — The single most prominent element on the screen. This is the answer to "buy today?". Large Space Grotesk numeral, semantic color, centered.
4. **Trust strip** — Directly under the hero: fund name, data month, coverage %, last-updated time, any 未取價 gaps. Small but legible — it is what makes the hero believable.
5. **Holdings breakdown** — Below the fold-ish. Present for the curious, visually recessive (muted, smaller, table). Each row: name + code, weight, live price, change %, contribution micro-bar.
6. **Disclaimer** — Caption at the very bottom. Legally/ethically necessary, never prominent.

## User Flows

### Daily check (returning user — the 80% path)
1. User opens the app.
2. Last-viewed fund auto-loads → skeleton → hero settles to the estimate.
3. User reads the hero number + color.
   - If they want to switch → tap the **hamburger** → tap a fund in the **favorites drawer** → new fund loads, drawer closes.
   - If satisfied → closes app. Total time: ~2 seconds.

### Find a new fund (first-time or exploring)
1. User taps the **search field**.
2. Types a name or code → debounced suggestions appear.
3. User picks a result (tap or ↑/↓ + Enter).
   - If a real fund with TW-listed holdings → hero + holdings render.
   - If a fund we cannot price (overseas/bond) → hero shows partial/blank, trust strip shows low/zero coverage and 未取價 list (honest failure, not an error).
4. User taps **★** to save it → chip appears in favorites for next time.

### Trust check (skeptical user)
1. User sees the hero number.
2. Eye drops to the **trust strip**: "資料 2026/05 · 涵蓋 54.6% · 更新 09:41".
3. User scrolls to **holdings** to see which stocks drive it and each contribution.
4. User forms a judgment about whether to act.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Estimated intraday change | 今日估算漲跌 | "估算" is load-bearing — signals it's a proxy, not official NAV. |
| Disclosed-weight coverage | 涵蓋 (估算涵蓋淨值) | How much of the fund the estimate reflects. |
| Holdings data month | 資料月份 | The month the holdings snapshot is from. |
| Last refresh time | 更新 | Time of the latest price pull. |
| Unpriced holdings | 未取價 | Stocks we couldn't map/price. Honest gap, not "error". |
| Per-stock share of fund move | 貢獻 | Weight × change, in percentage points. |
| Saved funds | 常用 | The favorites concept. |
| Fund identifier | 代碼 | MoneyDJ fund code (e.g. ACDD04). |

## Component Reuse Map

| Component | Used on | Behavior differences |
| --- | --- | --- |
| App shell (header + main + max-width) | All states | Constant frame; only `<main>` content swaps by state. |
| Search field | All states | Always present; the only always-interactive control besides theme. |
| Favorites drawer | All states (opened on demand) | Off-canvas; hamburger badge shows saved count. Shows an empty message when no funds saved. |
| Hero block | Loaded / Loading (skeleton) / Error | Renders number, skeleton shimmer, or error message in the same slot. |
| Holdings table | Loaded only | Hidden in empty/loading/error. |
| Theme toggle | All states | Global; never changes behavior. |

## Content Growth Plan

The only element that grows is the **favorites row**, driven by the user. It is a horizontally scrolling strip, so N favorites never break layout. The **search index** (~4,400 funds) grows server-side but is unbounded from the UI's view — search results are already capped at 20 and ranked, so UI growth is a non-issue. Holdings are fixed at the fund's disclosed top-10.

## URL Strategy

- Single route `/`. No client routing.
- **No fund code in the URL** currently. Optional future enhancement (out of scope now): reflect the loaded fund as `?fund=ACDD04` to enable shareable/bookmarkable links and browser back between funds. Noted, not built.
- Existing API URL patterns unchanged: `/api/fund/:code`, `/api/search?q=`.
