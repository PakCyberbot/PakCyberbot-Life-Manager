# Life Management Framework

This is your personal operating manual — the values, priorities, and decision rules that LIFE Manager (the app) is built to serve, not the other way round. **[structure.md](structure.md)** is the app's technical blueprint; this file is the *why* behind the choices the app helps you make. Update it whenever your priorities shift — it's meant to change as you do.

Where a section is marked **🤖 used by AI**, its content is read directly by a Gemini-powered feature (see [structure.md §6](structure.md)) as grounding context — write those sections concretely, with real examples, since a vague rule produces a vague verdict.

Sections are seeded with placeholders/examples — replace them with your real answers whenever you're ready. Nothing here needs to be finished before we start building; the app should work with this file half-empty and get smarter as you fill it in.

---

## 1. Core Values & Priorities

Rank what matters most right now — this is allowed to change over time, that's what §10 is for.

1. *(e.g. Health & energy)*
2. *(e.g. Skill growth / career capital)*
3. *(e.g. Financial stability)*
4. *(e.g. Relationships)*
5. *(e.g. Rest & enjoyment)*

## 2. Time Philosophy

- How you think about where your hours go — what's "invested" vs "spent."
- Rules of thumb, e.g.: *"Deep work happens mornings; admin/shallow tasks in the afternoon."*
- Any hard caps, e.g.: *"No more than X hours/week of pure leisure, no guilt below that line."*

## 3. Goal-Setting Framework

- Methodology: *(OKRs / SMART goals / theme-of-the-quarter / other)*
- Review cadence: *(weekly check-in, monthly review, quarterly reset — pick what you'll actually do)*
- How goals map to life areas (Health, Career, Money, Relationships, Skills, ...)

## 4. Money Framework

- Budgeting method: *(50/30/20, zero-based, envelope, other)*
- Savings target / rule
- Rule for big purchases, e.g.: *"Wait 7 days before any purchase over $X"* — feeds the future Shopping/Wishlist module
- What "worth it" means for a purchase (ties into Asset Management later)

## 5. Skill & Learning Framework

- How you decide what's worth learning right now
- What makes a course/book/certification "worth the time" — feeds the Learning & Reading and Skills modules
- Minimum viable progress: how you avoid starting things and never finishing them

## 6. Entertainment & Leisure Rules 🤖 used by AI

This section directly grounds the **Entertainment module's** "worth your time" verdicts (see [structure.md](structure.md)). Be concrete — the more real examples you give, the better Gemini's judgment will match yours instead of guessing.

**What makes entertainment "worth it" to you?** (edit freely — starting placeholders below)
- Builds a skill or knowledge I actually want *(e.g. a documentary, a game with real strategic depth, a language-learning show)*
- Genuine rest/recharge, not just numbing out *(be honest about the difference — this counts as "worth it" too, guilt-free)*
- Shared with people I care about *(social value counts)*
- Low value / red flags: *(e.g. "mindless mobile games," "content I don't remember a day later," "background scrolling")*

**Guilt-free leisure allowance**: *(e.g. "up to 10 hours/month of pure escapism, no justification needed")*

**Scheduling preference**: entertainment blocks default to week(s) *(e.g. 1 and 2)* of the month — set via `entertainmentWeeksOfMonth` in app Settings.

**How strict should verdicts be?** *(e.g. "informative only, never block me from adding something" — recommended default, matches the app's advisory-not-restrictive design)*

## 7. Habit & Routine Principles

- Morning/evening routine philosophy
- Habit-stacking rules (attach new habits to existing ones)
- How you handle missed days without spiraling

## 8. Review Rituals

| Cadence | Questions to ask yourself |
|---|---|
| Daily | *(e.g. What's the one thing that matters today?)* |
| Weekly | *(e.g. What moved my goals forward? What didn't?)* |
| Monthly | *(e.g. Net worth check-in, entertainment time review)* |
| Quarterly | *(e.g. Are my top-5 priorities in §1 still right?)* |
| Yearly | *(e.g. Full framework rewrite)* |

## 9. Asset & Purchase Philosophy

- Minimalism rules / how much you own vs need
- Checklist before buying a new device: *(does it replace something failing? does it unlock a real capability?)*
- How long you expect assets to last before replacing

## 11. Suggestions to Consider Adopting

Ideas — mine and, over time, Gemini's — that aren't part of your framework yet. Mark each **Considering / Adopted / Skip**; anything you mark Adopted becomes a real feature request against the matching module in [structure.md](structure.md), not just a note here.

| Idea | What it is | Fits which module | Status |
|---|---|---|---|
| Eisenhower Matrix | Sort tasks by urgent × important, not just due date | Tasks | *(not set)* |
| Ikigai | Find the overlap of what you love / are good at / can be paid for / the world needs — useful for goal & career direction | Goals, Earning Ways | *(not set)* |
| Getting Things Done (GTD) | Capture everything → clarify → organize → reflect → engage; an "inbox zero" for tasks | Tasks | *(not set)* |
| Pomodoro Technique | Timeboxed focus sessions (25 min work / 5 min break) | Tasks, future Focus Timer | *(not set)* |
| Atomic Habits (habit stacking, identity-based habits) | Attach new habits to existing ones; habits as identity, not willpower | Habit Tracker | *(not set)* |
| Kakeibo | Japanese mindful-budgeting journal — reflect on spending, not just categorize it | Money | *(not set)* |
| Zero-based budgeting | Every dollar assigned a job before the month starts | Money | *(not set)* |
| Talent Stack | Combine several ordinary skills into one rare, valuable combination, instead of chasing one "best" skill | Skills, Earning Ways | *(not set)* |
| Pareto Review (80/20) | Quarterly: which 20% of effort produced 80% of the results — cut or double down accordingly | Reviews | *(not set)* |
| Digital Minimalism | Deliberate, values-driven media/tech use instead of default consumption | Entertainment/Leisure | *(not set)* |
| Second Brain / Zettelkasten | Networked notes that link ideas across books/courses, so learning compounds instead of evaporating | Learning & Reading | *(not set)* |
| Personal Kanban | To-Do / Doing / Done board, visualize work-in-progress limits | Tasks | *(not set)* |
| FIRE milestones | Long-horizon net-worth targets (e.g. 25x annual expenses) as a Money north star | Money | *(not set)* |

### 🤖 Gemini-Suggested (auto-appended by the app)

Once the AI module is live, Gemini appends new suggestions here on its own — based on your Goals, Habits, spending patterns, and this framework — with a short rationale for each. This subsection is the *only* part of the file the app writes to; everything above stays yours.

*(none yet — populates once `packages/ai` ships)*

## 12. Change Log

Track revisions here so the framework's evolution is visible over time — this doubles as a mini journal of how your priorities have shifted.

| Date | What changed | Why |
|---|---|---|
| 2026-08-29 | Framework created | Starting point alongside structure.md, before development begins |
| 2026-08-29 | Added §11 Suggestions to Consider Adopting (+ Gemini auto-suggestions subsection) | Give the framework a way to grow over time instead of being a one-time form |
