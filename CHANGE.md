# Changelog

## 2026-07-05 — Contract Creation journey: agent visibility, fewer clicks, production polish

All changes below are since the last commit (`a83c8fb`, "Add Configure section: Systems, Data
Foundation, Context & Journey, Agents", 2026-07-04) and are currently uncommitted on `main`.
Touches `js/pages.js`, `js/renderer.js`, `css/main.css`, `index.html`.

### AI Contract Assistant intro page
- Reworked into a side-by-side layout: assistant prompt/simulate buttons on the left, live search
  result on the right (with an idle placeholder before a search runs), instead of the result
  stacking below the prompt. Cuts the page scroll that appeared once a search ran.
- The "Searching ADT employee records…" state now shows a shimmer/skeleton placeholder card
  (avatar + line blocks) instead of a plain spinner-and-text row.

### Journey progress bar
- Added a short label under every step circle (e.g. "Deal Created", "Proposal Sent",
  "Onboarding"), color-coded by state (gray pending / navy done / bold green current).
- Added a summary row above the bar showing "Step X of Y", the full current step name, its
  chips, and — new — the responsible agent's name.
- The whole bar + page now fades/slides in on every stage change instead of popping in instantly.

### Agent mapping (Configure > Agents surfaced in the journey)
- Every journey step already recorded which agent (`AI Contract Assistant`, `AI + Docuseal`,
  `AI Onboarding Engine`, etc.) or human role handles it, but this was never shown anywhere in
  the flow. Added a "✨ Handled by <Agent>" badge — on the progress bar and on each stage page —
  that's clickable and opens that agent's existing skill.md viewer (same one used in
  Configure > Agents) without leaving the journey.

### Fewer clicks
- The AI-assisted contract form (Basic/Job/Other Details, previously 2 "Next" clicks + 1 submit)
  now renders as a single scrollable review page with every AI-prefilled field visible at once
  and one "Create Proposal" button — only when arriving via the AI assistant; the plain manual
  contract-creation stepper is unchanged.
- Fixed a data-capture bug this surfaced: field capture was gated to whichever step was "current,"
  which would have silently dropped edits from the other two sections once the stepper was
  removed (and, as a pre-existing bug, already dropped edits on the PEO flow specifically).
- The two stages tagged "AI Automated" in the journey data (`Proposal Sent`, `Contract Sent`) no
  longer wait on a manual "Send for Approval" click — they show their content briefly, then
  auto-advance through the existing loader/transition. The two human-approval stages keep their
  manual "Simulate: X Approves" buttons, unchanged.

### Less scroll / visual consistency
- The generated contract document's spacing is tightened (~25% shorter) without removing any
  clause text or sections.
- All downstream journey pages (employee created, proposal, approvals, contract document,
  onboarding, journey complete) are now a consistent 680px wide, so the page no longer changes
  width as the user progresses.

### Production-feel polish
- Loader spinner recolored to the brand orange accent; its caption pulses gently while "processing".
- Added a small toast-notification system (bottom-right, auto-dismissing) that fires at background
  events: proposal sent, proposal approved, contract sent for signature, contract approved.
