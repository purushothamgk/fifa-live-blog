# Matchwire API Handoff

This document describes the HTTP API exposed by the Matchwire Node server for
the UI. The server normalizes data from FIFA's public match APIs.

## Base URL

Local development:

```text
http://localhost:3000
```

No authentication is currently required. All endpoints use `GET`, return JSON,
and include:

```http
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
```

## Refresh Guidance

- Fetch `/api/matches` and `/api/overview` every five minutes.
- Fetch `/api/timeline/{matchId}` when a match is selected and on each refresh.
- Update kickoff countdown labels locally every minute.
- Use `updatedAt` to display the last successful server refresh.

## GET `/api/matches`

Returns active matches plus configured recent fallback matches. Active matches
are returned first.

### Response

```json
{
  "updatedAt": "2026-06-12T08:27:29.630Z",
  "matches": [
    {
      "id": "400021441",
      "competitionId": "17",
      "seasonId": "285023",
      "stageId": "289273",
      "competition": "FIFA World Cup™",
      "stage": "First Stage",
      "group": "Group A",
      "date": "2026-06-12T02:00:00Z",
      "localDate": "2026-06-11T20:00:00Z",
      "minute": "97'",
      "period": 10,
      "status": 0,
      "isLive": false,
      "source": "live",
      "stadium": "Guadalajara Stadium",
      "city": "Guadalajara",
      "home": {
        "id": "43822",
        "name": "Korea Republic",
        "abbreviation": "KOR",
        "score": 2,
        "flag": "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/KOR"
      },
      "away": {
        "id": "43995",
        "name": "Czechia",
        "abbreviation": "CZE",
        "score": 1,
        "flag": "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/CZE"
      }
    }
  ]
}
```

### UI Notes

- Use `isLive`, not `status`, to decide whether to show the live action.
- Build the FIFA match-centre URL using:

```text
https://www.fifa.com/en/match-centre/match/{competitionId}/{seasonId}/{stageId}/{id}
```

- FIFA flag URLs contain placeholders. Replace `{format}` with `sq` and
  `{size}` with `2`.
- Scores may be `null` before kickoff.

## GET `/api/timeline/{matchId}`

Returns the official event timeline for one match, newest event first.

Example:

```text
GET /api/timeline/400021441
```

### Response

```json
{
  "matchId": "400021441",
  "updatedAt": "2026-06-12T08:27:29.630Z",
  "events": [
    {
      "id": "1742937221",
      "teamId": null,
      "playerId": null,
      "timestamp": "2026-06-12T03:58:04.092Z",
      "minute": "97'",
      "period": 10,
      "type": 26,
      "title": "Match end",
      "description": "The final whistle sounds.",
      "isGoal": false,
      "scorer": null,
      "homeGoals": 2,
      "awayGoals": 1
    },
    {
      "id": "goal-event-id",
      "teamId": "43822",
      "playerId": "448586",
      "timestamp": "2026-06-12T03:41:00.000Z",
      "minute": "80'",
      "period": 5,
      "type": 0,
      "title": "Goal!",
      "description": "H G OH (Korea Republic) scores!!",
      "isGoal": true,
      "scorer": "H G OH",
      "homeGoals": 2,
      "awayGoals": 1
    }
  ]
}
```

### UI Notes

- Use `isGoal` to identify goals. Do not search the title for the word `Goal`,
  because FIFA also returns events named `Attempt at Goal`.
- For a goal summary, display `minute`, `scorer`, `homeGoals`, and `awayGoals`.
- `teamId`, `playerId`, and `scorer` can be `null`.

## GET `/api/overview`

Returns upcoming World Cup fixtures and all group tables.

### Response

```json
{
  "updatedAt": "2026-06-12T08:27:29.630Z",
  "upcoming": [
    {
      "id": "400021449",
      "competitionId": "17",
      "seasonId": "285023",
      "stageId": "289273",
      "competition": "FIFA World Cup™",
      "stage": "First Stage",
      "group": "Group B",
      "date": "2026-06-12T19:00:00Z",
      "localDate": "2026-06-12T15:00:00Z",
      "minute": "0'",
      "period": 0,
      "status": 1,
      "isLive": false,
      "source": "upcoming",
      "stadium": "",
      "city": "",
      "home": {
        "id": "team-id",
        "name": "Canada",
        "abbreviation": "CAN",
        "score": null,
        "flag": "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/CAN"
      },
      "away": {
        "id": "team-id",
        "name": "Bosnia and Herzegovina",
        "abbreviation": "BIH",
        "score": null,
        "flag": "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/BIH"
      }
    }
  ],
  "groups": [
    {
      "name": "Group A",
      "teams": [
        {
          "position": 1,
          "team": "Mexico",
          "abbreviation": "MEX",
          "flag": "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/MEX",
          "played": 1,
          "won": 1,
          "drawn": 0,
          "lost": 0,
          "difference": 2,
          "points": 3
        }
      ]
    }
  ]
}
```

### Today's Matches

Use FIFA's `localDate` date portion when filtering the tournament's match day:

```js
const today = "2026-06-12";
const todaysMatches = upcoming.filter(
  (match) => (match.localDate || match.date).slice(0, 10) === today,
);
```

Do not convert `date` to the viewer's local timezone for this filter. FIFA's
`date` is the UTC kickoff time, while `localDate` represents the tournament
match date. A late fixture may fall on the following calendar day for the
viewer.

### Countdown

Use `date`, not `localDate`, for kickoff countdown calculations:

```js
const remainingMs = Date.parse(match.date) - Date.now();
const totalMinutes = Math.ceil(remainingMs / 60000);
const hours = Math.floor(totalMinutes / 60);
const minutes = totalMinutes % 60;
```

## Errors

### Invalid Timeline Match ID

```http
HTTP/1.1 400
```

```json
{ "error": "Invalid match id" }
```

### FIFA Upstream Failure

```http
HTTP/1.1 502
```

```json
{
  "error": "Could not retrieve FIFA data",
  "detail": "FIFA API 500: /requested/path"
}
```

## FIFA Upstream APIs

The UI should call the Matchwire endpoints above rather than these upstream
endpoints directly. They are documented here for backend ownership and
troubleshooting.

Base URL:

```text
https://api.fifa.com/api/v3
```

Endpoints used:

```text
GET /calendar/matches?language=en&count=500&from={YYYY-MM-DD}
GET /live/football/{competitionId}/{seasonId}/{stageId}/{matchId}?language=en
GET /timelines/{matchId}?language=en
GET /calendar/{competitionId}/{seasonId}/{stageId}/standing?language=en&count=200
```

Current tournament identifiers:

```text
competitionId: 17
seasonId:      285023
stageId:       289273
```

Upstream responses are cached in memory:

- General live/timeline data: 15 seconds
- Match calendar discovery: 30 seconds
- Upcoming calendar: 60 seconds
- Group standings: 5 minutes

These FIFA endpoints are public but undocumented and may change without notice.
The normalization layer in `server.js` isolates the UI from most upstream field
changes.
