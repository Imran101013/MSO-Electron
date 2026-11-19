# MSO

Desktop record-keeping for Mogh Students Organisation: members, monthly savings, loans, the reserve fund, meetings and attendance, the yearly profit distribution, and PDF reports. It runs offline on one Windows computer and keeps its data in a local PostgreSQL database.

Built with Electron, React, TypeScript, Vite, Tailwind and shadcn/ui.

## Development

Needs Node.js and PostgreSQL (localhost:5432, user `postgres`, password `postgres`).

```sh
npm install
npm run electron:dev     # the app, with the Vite dev server on http://localhost:8080
npm run lint
npm run seed:sample      # dummy records for an empty database
```

On first start the app creates the `mso-db` database, its tables (`electron/schema.sql`) and a starting login, `admin` / `admin123`, if they are missing.

## Installer

```sh
npm run electron:build   # release/MSO Setup <version>.exe
```

On the client's computer: install PostgreSQL (port 5432, password `postgres` for the `postgres` user), run the installer, sign in with `admin` / `admin123`, then change the login with the key button at the top right.

More detail for developers is in `CLAUDE.md`; the visual design is described in `DESIGN.md`.
