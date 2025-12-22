# Repository Guidelines

## Project Structure & Module Organization
- React + Vite app in `src/`: UI components under `components/` (Controls, Panels, Globe), hooks in `hooks/`, shared logic in `lib/` (TLE fetching, conjunction search, orbit math, sun/lighting), types in `types/`.
- Embedded TLE seeds live in `src/lib/embedded/` and are auto-loaded via `src/lib/embeddedTles.ts`.
- Entry points: `src/main.tsx` and `src/App.tsx`. Styles in `src/index.css` (Tailwind ready). Public assets in `public/`.
- Tests (lightweight) reside in `src/lib/*.test.ts`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start Vite dev server.
- `npm run build` — type-check (`tsc -b`) then produce production bundle.
- `npm test` — run TypeScript tests (Oracle/orbit math checks).

## Coding Style & Naming Conventions
- Language: TypeScript + React; prefer functional components and hooks.
- Indentation: 2 spaces; keep files ASCII. Use clear, descriptive names (`useX`, `getY`, `Panel`, `Selector`).
- Favor small, composable utilities in `lib/`. Keep side effects isolated (e.g., cache/localStorage helpers in `celestrak.ts`).
- UI labels should be human-friendly (avoid raw TLE lines in dropdowns).

## Testing Guidelines
- Tests use `vitest`/ts-node style (see `src/lib/oracle.test.ts`, `src/lib/orbit.test.ts`).
- Add new tests alongside the module under test with `.test.ts` suffix.
- Run `npm test` before submitting; ensure deterministic results (no network).

## Commit & Pull Request Guidelines
- Use conventional-style messages where possible (e.g., `feat:`, `fix:`, `chore:`). Initial history uses `chore: initial commit`.
- Keep commits focused and include context in the body when non-obvious.
- PRs should describe changes, testing performed, and any UI impact (screenshots/GIFs for visual tweaks).

## Agent-Specific Notes
- When loading or comparing TLEs, prefer existing helpers (`useTLE`, `applyEmbeddedTLEs`, `useConjunctions`) instead of re-implementing propagation logic.
- Avoid clearing unrelated localStorage keys; use provided cache helpers (`clearTLECache`, `clearAllCache`).
