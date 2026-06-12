const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const FIFA_API = "https://api.fifa.com/api/v3";
const PUBLIC_DIR = path.join(__dirname, "public");
const SEED_MATCHES = [
  {
    competitionId: "17",
    seasonId: "285023",
    stageId: "289273",
    matchId: "400021441",
  },
];
const ACTIVE_PERIODS = new Set([3, 4, 5, 6, 7, 8, 9, 11]);
const cache = new Map();
const TOURNAMENT = SEED_MATCHES[0];

function localized(value, fallback = "") {
  if (!Array.isArray(value)) return fallback;
  return (
    value.find((item) => item.Locale?.toLowerCase().startsWith("en"))
      ?.Description ||
    value[0]?.Description ||
    fallback
  );
}

async function fifa(pathname, maxAgeMs = 15_000) {
  const cached = cache.get(pathname);
  if (cached && Date.now() - cached.time < maxAgeMs) return cached.data;

  const response = await fetch(`${FIFA_API}${pathname}`, {
    headers: { Accept: "application/json", "User-Agent": "fifa-live-blog/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`FIFA API ${response.status}: ${pathname}`);
  const data = await response.json();
  cache.set(pathname, { data, time: Date.now() });
  return data;
}

function normalizeMatch(match, source = "calendar") {
  const home = match.HomeTeam || match.Home || {};
  const away = match.AwayTeam || match.Away || {};
  const period = Number(match.Period || 0);

  return {
    id: String(match.IdMatch),
    competitionId: String(match.IdCompetition),
    seasonId: String(match.IdSeason),
    stageId: String(match.IdStage),
    competition: localized(match.CompetitionName, "FIFA match"),
    stage: localized(match.StageName),
    group: localized(match.GroupName),
    date: match.Date,
    localDate: match.LocalDate,
    minute: match.MatchTime || "",
    period,
    status: Number(match.MatchStatus),
    isLive: ACTIVE_PERIODS.has(period),
    source,
    stadium: localized(match.Stadium?.Name),
    city: localized(match.Stadium?.CityName),
    home: {
      id: String(home.IdTeam || ""),
      name: localized(home.TeamName, home.Abbreviation || "Home"),
      abbreviation: home.Abbreviation || "",
      score: home.Score,
      flag: home.PictureUrl || "",
    },
    away: {
      id: String(away.IdTeam || ""),
      name: localized(away.TeamName, away.Abbreviation || "Away"),
      abbreviation: away.Abbreviation || "",
      score: away.Score,
      flag: away.PictureUrl || "",
    },
  };
}

function normalizeEvent(event) {
  const title = localized(event.TypeLocalized, "Match update");
  const description = localized(event.EventDescription);
  const isGoal = Number(event.Type) === 0 || /^goal!?$/i.test(title);
  const scorerMatch = isGoal
    ? description.match(/^(.+?)\s+\([^)]*\)\s+scores/i)
    : null;

  return {
    id: String(event.EventId || `${event.Timestamp}-${event.Type}`),
    teamId: event.IdTeam ? String(event.IdTeam) : null,
    playerId: event.IdPlayer ? String(event.IdPlayer) : null,
    timestamp: event.Timestamp,
    minute: event.MatchMinute || "",
    period: event.Period,
    type: event.Type,
    title,
    description,
    isGoal,
    scorer: scorerMatch?.[1] || null,
    homeGoals: event.HomeGoals,
    awayGoals: event.AwayGoals,
  };
}

async function matchDetails(ref) {
  const pathname = `/live/football/${ref.competitionId}/${ref.seasonId}/${ref.stageId}/${ref.matchId}?language=en`;
  return fifa(pathname);
}

async function discoverMatches() {
  const from = new Date(Date.now() - 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const calendar = await fifa(
    `/calendar/matches?language=en&count=500&from=${from}`,
    30_000,
  );
  const now = Date.now();
  const refs = (calendar.Results || [])
    .filter((match) => {
      const kickoff = Date.parse(match.Date);
      return (
        match.MatchStatus !== 1 ||
        (kickoff > now - 6 * 60 * 60 * 1000 &&
          kickoff < now + 20 * 60 * 1000)
      );
    })
    .map((match) => ({
      competitionId: String(match.IdCompetition),
      seasonId: String(match.IdSeason),
      stageId: String(match.IdStage),
      matchId: String(match.IdMatch),
    }));

  for (const seed of SEED_MATCHES) {
    if (!refs.some((ref) => ref.matchId === seed.matchId)) refs.push(seed);
  }

  const details = [];
  for (let index = 0; index < refs.length; index += 8) {
    const batch = refs.slice(index, index + 8);
    const results = await Promise.allSettled(batch.map(matchDetails));
    details.push(
      ...results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value),
    );
  }

  return details
    .map((match) => normalizeMatch(match, "live"))
    .filter((match) => match.isLive || SEED_MATCHES.some((s) => s.matchId === match.id))
    .sort((a, b) => Number(b.isLive) - Number(a.isLive) || Date.parse(b.date) - Date.parse(a.date));
}

async function upcomingMatches() {
  const from = new Date().toISOString().slice(0, 10);
  const calendar = await fifa(
    `/calendar/matches?language=en&count=500&from=${from}`,
    60_000,
  );

  return (calendar.Results || [])
    .filter(
      (match) =>
        String(match.IdCompetition) === TOURNAMENT.competitionId &&
        Number(match.MatchStatus) === 1 &&
        Date.parse(match.Date) > Date.now(),
    )
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date))
    .slice(0, 8)
    .map((match) => normalizeMatch(match, "upcoming"));
}

async function groupStandings() {
  const data = await fifa(
    `/calendar/${TOURNAMENT.competitionId}/${TOURNAMENT.seasonId}/${TOURNAMENT.stageId}/standing?language=en&count=200`,
    5 * 60_000,
  );
  const groups = new Map();

  for (const row of data.Results || []) {
    const group = localized(row.Group, "Group");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({
      position: row.Position,
      team: localized(row.Team?.Name, row.Team?.Abbreviation || "Team"),
      abbreviation: row.Team?.Abbreviation || "",
      flag: row.Team?.PictureUrl || "",
      played: row.Played,
      won: row.Won,
      drawn: row.Drawn,
      lost: row.Lost,
      difference: row.GoalsDiference,
      points: row.Points,
    });
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teams]) => ({
      name,
      teams: teams.sort((a, b) => a.position - b.position),
    }));
}

async function apiMatches(res) {
  const matches = await discoverMatches();
  json(res, 200, { updatedAt: new Date().toISOString(), matches });
}

async function apiOverview(res) {
  const [upcoming, groups] = await Promise.all([upcomingMatches(), groupStandings()]);
  json(res, 200, { updatedAt: new Date().toISOString(), upcoming, groups });
}

async function apiTimeline(res, matchId) {
  if (!/^[a-zA-Z0-9-]+$/.test(matchId)) return json(res, 400, { error: "Invalid match id" });
  const timeline = await fifa(`/timelines/${matchId}?language=en`);
  const events = (timeline.Event || []).map(normalizeEvent).reverse();
  json(res, 200, { matchId, updatedAt: new Date().toISOString(), events });
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function staticFile(res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!fullPath.startsWith(PUBLIC_DIR)) return false;

  try {
    const body = await fs.readFile(fullPath);
    const extension = path.extname(fullPath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": types[extension] || "application/octet-stream" });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/health") {
      return json(res, 200, { status: "ok", time: new Date().toISOString() });
    }
    if (url.pathname === "/api/matches") return await apiMatches(res);
    if (url.pathname === "/api/overview") return await apiOverview(res);
    if (url.pathname.startsWith("/api/timeline/")) {
      return await apiTimeline(res, url.pathname.split("/").pop());
    }
    if (await staticFile(res, url.pathname)) return;
    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 502, { error: "Could not retrieve FIFA data", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`FIFA live blog running at http://localhost:${PORT}`);
});
