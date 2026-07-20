# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server only (http://localhost:8080), browser-only, no Electron/DB access (`window.electronAPI` is undefined, so `dbQuery` calls resolve to `[]` and login is disabled).
- `npm run electron:dev` — runs Vite and Electron together (`concurrently` + `wait-on`); this is the real way to run the app locally since all data access requires the Electron main process.
- `npm run build` — `vite build` (renderer bundle only, into `dist/`).
- `npm run build:dev` — same build in development mode.
- `npm run electron:build` — builds the renderer then packages the desktop app via `electron-builder` into `release/` (NSIS installer on Windows, code signing disabled).
- `npm run lint` — ESLint over the whole repo (flat config in `eslint.config.js`).
- `npm run preview` — preview the built `dist/` output via Vite.
- There is no test runner configured in this repo (no test script, no test files).

## Architecture

This is an **Electron desktop app** (product name "Mso Connect", formerly "Hilal Connect" — some strings/IDs mid-rename, see below) wrapping a Vite + React 18 + TypeScript SPA. It manages a savings/microfinance organization's members, budgets, loans, reserve fund, meetings, and profit distribution.

### Two-process split and the data layer

All application data lives in a **local PostgreSQL database** (`mso-db`), accessed *only* from the Electron main process via `pg.Pool` — never directly from the renderer. The renderer talks to it through a generic IPC bridge:

- `electron/main.cjs` — main process: owns the `pg.Pool`, registers `ipcMain.handle('db-query', ...)` (runs arbitrary parameterized SQL) plus auth handlers (`auth-login`, `auth-verify`, `auth-change-password`).
- `electron/preload.cjs` — exposes `window.electronAPI` (`dbQuery`, `login`, `verifyToken`, `changePassword`) via `contextBridge`, with `contextIsolation: true` / `nodeIntegration: false`.
- `src/lib/db.ts` — renderer-side `dbQuery(sql, params)` helper that calls `window.electronAPI.dbQuery` and throws on `{error}`.
- Feature hooks in `src/hooks/` (`useMembers`, `useLoans`, `useContributions`, `useAttendance`, `useMeetings`, `useReserveTransactions`) each own one table's CRUD by writing raw SQL through `dbQuery`, plus local `useState` + toast notifications. There is no ORM and no query-caching layer for this data (React Query is installed and provided at the app root, but these hooks manage their own state directly).
- `src/contexts/OrganizationContext.tsx` composes all of the above hooks into one provider (member budgets, loans, contributions, attendance, meetings, reserve transactions, profit distribution) and is the primary state surface most pages consume.

**Duplicate main-process files**: `electron/main.js` / `electron/preload.js` are a parallel, *not currently wired up* pair (`package.json` `"main"` points at `main.cjs`). The `.js` versions additionally implement `auth-signup` and `open-external` IPC handlers that don't exist in the `.cjs` versions actually loaded at runtime. When adding/changing IPC handlers, edit `main.cjs`/`preload.cjs` (the live pair) and decide deliberately whether `main.js`/`preload.js` need the same change or should be removed.

### Auth model

Auth is custom, not Supabase Auth: `auth-login` looks up `public.users`/`public.user_roles`, checks the password with bcrypt, and **only allows role `admin`** to log in (`src/contexts/AuthContext.tsx` also re-checks `res.user.role !== 'admin'` client-side). A JWT is issued (`JWT_SECRET` hardcoded in `main.cjs` — placeholder, meant to be changed for production) and cached in `localStorage` (`Mso_connect_token`); `auth-verify` validates it on app load. Self-service signup/member self-registration has been removed from this flow (see migration `20260120000000_simplify_admin_only_auth.sql`) — `src/pages/Signup.tsx` and the `/signup` route still exist in the tree but the router immediately redirects `/signup` to `/login`/`/`, and `AuthContext` has no `signup` method, so that page is effectively dead code.

### Supabase — legacy, mostly retired

This project originated as a Lovable-generated Supabase app (`supabase/migrations/`, `src/integrations/supabase/`, `VITE_SUPABASE_*` in `.env`). It has since been migrated to the local Postgres/Electron-IPC model above. The **only remaining live Supabase usage** is Supabase Storage for profile-picture uploads in `src/pages/Members.tsx` (`supabase.storage.from("profile-pictures")`). Don't assume `supabase.from(...)` table queries are wired to anything live — check `src/integrations/supabase/client.ts` usage before relying on it for data reads/writes.

### Frontend structure

- `src/App.tsx` — provider stack (`QueryClientProvider` → `TooltipProvider` → `AuthProvider` → `SettingsProvider` → `ThemeApplier` → `OrganizationProvider`) and `HashRouter` routes (hash routing because this is a packaged file:// Electron app, not served from a domain). Authenticated routes are wrapped in `Layout` + `ProtectedRoute`; unauthenticated users only ever see `/login`.
- `src/components/Layout.tsx` — sidebar shell; nav items differ by role (`isAdmin` from `AuthContext`) — admins get the full nav (Members, Budget, Loans, Reserve, Meetings, PDFs, Profit Distribution, Settings), non-admin/member view is a reduced subset. In practice only `admin` can log in at all currently (see Auth model above), so the member nav path is largely unreachable under the current auth rules.
- `src/pages/*` — one page per route/nav item; most are large (10-30KB) single-file feature screens that call into the `OrganizationContext` hooks directly rather than sub-composing many components.
- `src/components/ui/` — shadcn/ui primitives (Radix-based), configured via `components.json`; treat as generated/vendored, prefer composing them over editing them directly.
- `src/config/organization.ts` — static organization-wide constants (loan interest rate, pagination sizes, PK phone-number regex patterns, date/currency formats). `src/contexts/SettingsContext.tsx` seeds its runtime `Settings` (persisted to `localStorage` under `hc_settings_v1`) from these defaults and lets the UI override them (e.g. theme, items-per-page) — check `SettingsContext` for the value actually in effect, not just the static config.
- `src/utils/pdfReports.ts` — PDF generation (via `jspdf`/`html2canvas`) backing the PDFs page.
- Path alias `@` → `src/` (configured in both `vite.config.ts` and `tsconfig`).

### Build/packaging notes

- `vite.config.ts` sets `base: './'` in production so the built `index.html` in `dist/` resolves assets correctly when loaded via `loadFile` from Electron's `file://` context (dev mode instead loads `http://localhost:8080`).
- `electron-builder` config lives inline in `package.json` (`"build"` key): Windows NSIS target, output to `release/` (gitignored), icon at `public/favicon.ico`, code signing disabled.
