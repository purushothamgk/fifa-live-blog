# FIFA Live Blog

A dependency-free Node web app that discovers live FIFA matches and displays
their official event timelines.

## Run

```bash
npm start
```

Open `http://localhost:3000`.

The server reads FIFA's public match APIs and caches responses briefly. The UI
pulls fresh match and timeline data every five minutes. The match supplied during setup is retained as a
recent match so the interface remains populated when no match is currently live.

## API Documentation

See [API.md](./API.md) for the UI-facing endpoint contracts, response examples,
refresh guidance, and upstream FIFA API details.

## Free Hosting on Render

This repository includes a `render.yaml` deployment blueprint.

1. Create a GitHub repository and push this project to it.
2. Sign in at [Render](https://dashboard.render.com/).
3. Select **New**, then **Blueprint**.
4. Connect the GitHub repository containing this project.
5. Confirm the free web service and deploy it.

Render provides a free URL similar to:

```text
https://fifa-live-blog.onrender.com
```

The free service can spin down after 15 minutes without traffic. Its first
request after spinning down can take about one minute. No database or persistent
disk is required by this application.
