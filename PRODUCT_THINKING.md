# Product Thinking — Design Approach & Agent Architecture

## 1. Design approach

Three separate portals, one for each job-to-be-done, not one app with a permission toggle:

- **Platform Console** (Super Admin) — builds and governs the platform: connects systems, defines the master journey/agent catalog, approves what entities request.
- **Entity Console** (Entity Admin) — governs one tenant inside what the platform allows: activates pre-approved defaults, requests anything else.
- **AI Executive workspace** (Entity User) — runs the work: opens straight into their unlocked journeys, no setup or admin surface at all.

Each is scoped by what that person needs to *decide*, not just what they're allowed to *see* — Super Admin decides what's possible platform-wide, Entity Admin decides what their tenant is allowed to use, Entity User decides nothing administrative, only runs what's already approved.

## 2. Product thinking framework: Build → Govern → Run, with progressive disclosure

The framework is a three-stage pipeline mapped one-to-one onto the three portals:

**Build** (platform-wide, Super Admin) → **Govern** (per-tenant, Entity Admin) → **Run** (per-user, Entity User)

Within each portal, **progressive disclosure** decides what's visible:
- Platform *authoring* never surfaces below Super Admin — bringing an object or agent into being (a new data model, skill.md) is a Build-stage act. Reading what already exists is not: Entity Admin sees Data Foundation, because the objects a journey reads and writes are exactly the context needed to govern that journey. The filter is relevance, not permission, and it cuts between *define* and *inspect* rather than around a whole page.
- The journey *catalog* is shown one layer further down than the *capability to change it* — Entity Admin sees every journey, locked or not, because it's the product menu; Entity User sees only what's already unlocked, because by the time work reaches them, governance is already resolved.

This is why requests flow *up* (Entity Admin → Super Admin's approval queue) and unlocks flow *down* (approval → Entity Admin's tenant → Entity User's workspace) — the framework is directional, not just tiered access.

## 3. Implementation with AI agents

Each journey (e.g. *Contract Creation*, *Payroll Creation*, *H2R Lifecycle*) is not one monolithic automation — it's an **ordered chain of steps, each owned by exactly one actor**: AI agent, human role, system action, or client action. This is the orchestration unit the whole product is built around.

- **Agent = a discrete, reusable unit of work**, not a chatbot. Each agent (`AI Prompt Parser`, `AI Contract Assistant`, `AI + Docuseal`, `AI Onboarding Engine`, `AI Payroll Engine`, …) does one job and is wired into whichever journeys need it — `AI Prompt Parser` alone is reused across Contract Creation, Payroll Creation, and H2R Lifecycle rather than being rebuilt per journey.
- **`skill.md` is the agent's operating contract** — role, the fields it reads, the validation it runs, and what happens on failure, scoped per journey it's used in. This is authored once by Super Admin and never touched by entities; it's how agent behavior stays centrally governed while still being consumed by every tenant.
- **Guardrail = the autonomy setting per agent**: `Fully automated`, `Human approves next step`, or `Human approves on deviation`. This is the actual human-in-the-loop mechanism — not a UI convention, it's a per-agent field that determines whether a journey auto-advances or pauses for a person.
- **The journey engine walks the step chain in order**, invoking the mapped agent (or waiting on the mapped human/system/client action), advancing the timeline and updating status as each step resolves — approve/reject on a gated step is the only manual intervention point; everything else executes unattended.
- **Every agent action is logged** (timestamp, data source, outcome) for audit — compliance is a property of the orchestration layer, not bolted on per journey.

In short: journeys are workflows assembled from a shared library of narrowly-scoped agents, each with its own contract and autonomy level, orchestrated step-by-step with human approval only where the guardrail requires it.
