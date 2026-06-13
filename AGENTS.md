# Repository Guidelines

## Project Structure & Module Organization

This is a dependency-free Node.js 18+ web application.

- `server.js` serves static files, calls FIFA's public APIs, caches responses, and normalizes data for the UI.
- `public/index.html`, `public/app.js`, and `public/styles.css` contain the browser UI, client-side state, rendering, and styling.
- `API.md` documents the UI-facing JSON endpoints and expected response shapes.
- `calendar_matches.json` is a large fixture/reference snapshot; avoid editing it unless the task explicitly requires refreshed data.
- `render.yaml` defines the Render deployment and health check.

Keep server-side normalization in `server.js` and presentation logic in `public/app.js`. Update `API.md` whenever an endpoint contract changes.

## Build, Test, and Development Commands

```bash
npm start
```

Starts the app at `http://localhost:3000` using `node server.js`.

```bash
npm run check
```

Runs Node syntax checks for `server.js` and `public/app.js`. There is no compilation step or dependency installation requirement.

For a quick runtime check, start the server and request `http://localhost:3000/api/health`.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and trailing commas in multiline JavaScript structures. Follow the existing CommonJS style (`require`) on the server and plain browser JavaScript in the client. Use `camelCase` for variables/functions and `UPPER_SNAKE_CASE` for constants such as `REFRESH_INTERVAL_MS`.

Prefer small normalization and rendering helpers over duplicating FIFA response handling. Escape any upstream text inserted into HTML with `escapeHtml`. Use kebab-case for CSS classes and HTML IDs.

## Testing Guidelines

No automated test framework is configured. Before submitting changes:

1. Run `npm run check`.
2. Start the app and verify `/api/health`, `/api/matches`, and any changed endpoint.
3. Manually exercise affected UI states, including empty/error responses and narrow-screen layouts.

If adding tests, use Node's built-in test runner and name files `*.test.js`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subjects such as `Add competition filter` and `Show venues and coaches for upcoming matches`. Keep each commit focused and avoid unrelated formatting changes.

Pull requests should explain the user-visible behavior, identify API contract changes, list verification performed, and include screenshots for UI changes. Link the relevant issue when one exists.
