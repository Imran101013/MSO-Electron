# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a single organization admin (treasurer/secretary role) for "Mogh Students Organisation," working in focused desktop sessions rather than keeping the app open continuously. They log in, record recent activity (contributions, loan payments, meeting notes), check balances, and log out — not a high-frequency, always-on workflow. Only the `admin` role can currently log in (member self-service login was removed); a reduced "member" nav exists in code but is not reachable under current auth rules.

## Product Purpose

MSO is an offline desktop record-keeping system for a small savings/microfinance student organization. It tracks members, member budget contributions, loans issued/repaid, a reserve fund, meetings/attendance, profit distribution among members, and generates PDF reports — replacing manual ledgers/spreadsheets for these workflows.

## Positioning

Purpose-built, offline-only microfinance/savings-circle ledger for one small organization — not a general accounting tool and not cloud/multi-tenant SaaS. Everything (data, auth) lives on one local machine via a local PostgreSQL database.

## Operating Context

- Desktop-only, packaged Electron app (Windows NSIS installer); not a web app in production use.
- **Must remain fully offline** — no network-dependent features unless explicitly requested (existing project-level constraint).
- Data scale is small: tens of members, a handful of active loans/meetings at a time — lists do not need heavy virtualization, but should stay comfortable if an org grows into the low hundreds.
- Currency is PKR; dates default to `dd/MM/yyyy`; phone numbers follow Pakistani formats (`+92...` / `0...`).
- Core entities/workflows: Members, Budget (contributions), Loans (issue/repay/interest), Reserve Fund (transactions), Meetings (schedule + attendance), Profit Distribution, PDF report generation, Audit Log, Settings.
- One remaining live third-party dependency: Supabase Storage, used only for member profile-picture uploads on the Members page — not for any data reads/writes.

## Capabilities and Constraints

- Local Postgres via Electron main-process `pg.Pool`; renderer never talks to the DB directly, only through an IPC bridge (`window.electronAPI.dbQuery`).
- Custom bcrypt + JWT auth, admin-only login; no self-service signup in the live flow.
- No test runner/test suite exists in this repo.
- Redesign scope: visuals, layout, navigation chrome, and color scheme across the Dashboard and all inside pages. **All existing functionality, data flows, and IPC/DB behavior must remain intact** — this is a visual/UX redesign, not a feature or architecture change.

## Brand Commitments

- Keep the product name **"MSO"** and the organization name **"Mogh Students Organisation"** as-is — confirmed, not open for renaming.
- A logo mark is referenced in code (`Layout.tsx` → `./MSO-Logo.png`) but the actual image file does not exist anywhere in the repo (`public/` only has `favicon.ico`, `placeholder.svg`, `robots.txt`) — this is currently a broken image reference, not a real asset to preserve pixel-for-pixel. Treat the mark as available for a fresh typographic/icon treatment rather than as a fixed image to keep.

## Evidence on Hand

- Existing token-based theme (`src/index.css`, `tailwind.config.ts`): blue/teal palette, "Plus Jakarta Sans" font, 1rem base radius, custom shadow/gradient tokens, dark mode via `.dark` class — this is prior visual work, being replaced by this redesign, not preserved.
- Existing page inventory to redesign: Dashboard, Members, Budget, Loans, Reserve, Meetings, PDFs, ProfitDistribution, AuditLog, Settings, Login, ChangePassword, ForgetPassword (Signup is dead code, do not invest in it).
- No real customer testimonials/case studies/press — internal single-org tool, none needed.

## Product Principles

1. Offline-first, single-machine trust boundary — never introduce a design pattern that implies live sync, multi-device presence, or network status.
2. Optimized for short, focused admin sessions — favor clear at-a-glance summaries and fast task completion over dense always-on dashboards.
3. Financial data (PKR amounts, loan/reserve balances) is the product's core content — legibility and correctness of numbers takes priority over decorative visual flourish.
4. Small-scale data by design — comfortable, generous layouts are appropriate; do not over-engineer for enterprise-scale tables.
5. Preserve all existing functionality and data flows exactly; this redesign changes how the app looks and is navigated, not what it does.

## Accessibility & Inclusion

No project-specific accessibility requirement has been established beyond standard practice.
