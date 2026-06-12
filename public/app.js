const state = {
  matches: [],
  selectedId: null,
  timeline: [],
  upcoming: [],
  groups: [],
  competitions: [],
  competitionId: localStorage.getItem("competitionId") || "17",
  timer: null,
  countdownTimer: null,
  blogExpanded: false,
};
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const COUNTDOWN_INTERVAL_MS = 60 * 1000;

const elements = {
  matches: document.querySelector("#matches"),
  matchCount: document.querySelector("#match-count"),
  matchView: document.querySelector("#match-view"),
  scoreboard: document.querySelector("#scoreboard"),
  timeline: document.querySelector("#timeline"),
  eventCount: document.querySelector("#event-count"),
  empty: document.querySelector("#empty"),
  refreshLabel: document.querySelector("#refresh-label"),
  feedError: document.querySelector("#feed-error"),
  fifaLink: document.querySelector("#fifa-link"),
  upcoming: document.querySelector("#upcoming"),
  groups: document.querySelector("#groups"),
  feedLayout: document.querySelector("#feed-layout"),
  timelineToggle: document.querySelector("#timeline-toggle"),
  competitionSelect: document.querySelector("#competition-select"),
  squadModal: document.querySelector("#squad-modal"),
  squadModalTitle: document.querySelector("#squad-modal-title"),
  squadModalContent: document.querySelector("#squad-modal-content"),
  squadModalClose: document.querySelector("#squad-modal-close"),
};

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char],
  );
}

function teamImage(team) {
  if (!team.flag) return "";
  return `<img src="${escapeHtml(team.flag.replace("{format}", "sq").replace("{size}", "2"))}" alt="" />`;
}

function coachCard(team) {
  const teamLabel = `<span class="coach-team">${teamImage(team)} ${escapeHtml(team.abbreviation || team.name)}</span>`;
  if (!team.coach) return `<span class="coach-card coach-missing">${teamLabel}<strong>Coach TBC</strong></span>`;
  const portrait = team.coach.picture
    ? `${team.coach.picture}?io=transform:fill,width:160,height:160`
    : "";
  return `<span class="coach-card">
    ${portrait ? `<img src="${escapeHtml(portrait)}" alt="${escapeHtml(team.coach.name)}" />` : ""}
    ${portrait ? `<img class="coach-preview" src="${escapeHtml(portrait)}" alt="${escapeHtml(team.coach.name)}" />` : ""}
    ${teamLabel}
    <strong>${escapeHtml(team.coach.name)}</strong>
  </span>`;
}

function statusText(match) {
  if (match.isLive) return `<span class="live-label">● Live ${escapeHtml(match.minute)}</span>`;
  return "Full time";
}

function fifaMatchUrl(match) {
  return `https://www.fifa.com/en/match-centre/match/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;
}

function renderMatches() {
  const liveCount = state.matches.filter((match) => match.isLive).length;
  elements.matchCount.textContent = `${liveCount} live · ${state.matches.length} shown`;
  elements.matches.innerHTML = state.matches
    .map(
      (match) => `
        <button class="match-card ${match.id === state.selectedId ? "selected" : ""}" data-id="${escapeHtml(match.id)}">
          <div class="match-meta">
            <span>${escapeHtml(match.competition)}</span>
            <span>${statusText(match)}</span>
          </div>
          <div class="mini-team">${teamImage(match.home)}<span>${escapeHtml(match.home.name)}</span><strong>${match.home.score ?? "–"}</strong></div>
          <div class="mini-team">${teamImage(match.away)}<span>${escapeHtml(match.away.name)}</span><strong>${match.away.score ?? "–"}</strong></div>
          ${match.isLive ? `<span class="live-show" data-live-url="${escapeHtml(fifaMatchUrl(match))}">▶ Open live show</span>` : ""}
        </button>`,
    )
    .join("");

  elements.matches.querySelectorAll(".match-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const liveShow = event.target.closest(".live-show");
      if (liveShow) {
        window.open(liveShow.dataset.liveUrl, "_blank", "noopener,noreferrer");
        return;
      }
      selectMatch(card.dataset.id);
    });
  });
}

function renderScoreboard(match) {
  const location = [match.stadium, match.city].filter(Boolean).join(" · ");
  const goals = state.timeline.filter((event) => event.isGoal).slice().reverse();
  const homeGoals = goals.filter((goal) => goal.teamId === match.home.id);
  const awayGoals = goals.filter((goal) => goal.teamId === match.away.id);
  const goalRows = (teamGoals) => teamGoals.length
    ? teamGoals.map((goal) => `<span>⚽ ${escapeHtml(goal.scorer || "Goal")} <b>${escapeHtml(goal.minute)}</b></span>`).join("")
    : "<span class=\"no-goals\">No goals</span>";
  elements.scoreboard.innerHTML = `
    <div class="score-meta">${escapeHtml(match.competition)} · ${escapeHtml(match.stage || match.group)}${location ? ` · ${escapeHtml(location)}` : ""}</div>
    <div class="team">
      ${teamImage(match.home)}<h3>${escapeHtml(match.home.name)}</h3>
      <div class="team-goals">${goalRows(homeGoals)}</div>
    </div>
    <div class="score-centre">
      <div class="big-score">${match.home.score ?? "–"}:${match.away.score ?? "–"}<small>${statusText(match)}</small></div>
    </div>
    <div class="team">
      ${teamImage(match.away)}<h3>${escapeHtml(match.away.name)}</h3>
      <div class="team-goals">${goalRows(awayGoals)}</div>
    </div>`;
  elements.fifaLink.href = fifaMatchUrl(match);
  elements.fifaLink.textContent = match.isLive ? "Open live show ↗" : "Open on FIFA ↗";
}

function eventClass(event) {
  return event.isGoal ? "goal" : "";
}

function renderTimeline() {
  elements.eventCount.textContent = `${state.timeline.length} official updates`;
  elements.timeline.innerHTML = state.timeline
    .map(
      (event) => `
        <li class="event ${eventClass(event)}">
          <time class="event-time">${escapeHtml(event.minute || "—")}</time>
          <article>
            <h3>${event.isGoal
              ? `GOAL · ${escapeHtml(event.minute || "—")}${event.scorer ? ` · ${escapeHtml(event.scorer)}` : ""}`
              : escapeHtml(event.title)}</h3>
            <p>${escapeHtml(event.description)}</p>
            ${event.isGoal ? `<span class="event-score">${event.homeGoals}:${event.awayGoals}</span>` : ""}
          </article>
        </li>`,
    )
    .join("");
}

function renderOverview() {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const todaysMatches = state.upcoming.filter(
    (match) => (match.localDate || match.date || "").slice(0, 10) === today,
  );

  elements.upcoming.innerHTML = todaysMatches.length
    ? todaysMatches
    .map((match) => `
      <article class="upcoming-card">
        <div><span>${escapeHtml(match.group || match.stage)}</span><time>${new Date(match.date).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
        <p class="venue">⌖ ${escapeHtml([match.stadium, match.city].filter(Boolean).join(", ") || "Venue TBC")}</p>
        <div class="upcoming-teams">
          <span>${teamImage(match.home)} ${escapeHtml(match.home.name)}</span>
          <b>vs</b>
          <span>${teamImage(match.away)} ${escapeHtml(match.away.name)}</span>
        </div>
        <div class="upcoming-coaches">
          ${coachCard(match.home)}
          ${coachCard(match.away)}
        </div>
        <button class="squad-toggle" data-match-id="${escapeHtml(match.id)}" type="button">View team members ↓</button>
        <p class="kickoff-countdown" data-kickoff="${escapeHtml(match.date)}"></p>
      </article>`)
    .join("")
    : `<p class="notice">No more matches scheduled today.</p>`;

  elements.groups.innerHTML = state.groups
    .length
    ? state.groups
    .map((group) => `
      <article class="group-table">
        <h3>${escapeHtml(group.name)}</h3>
        <div class="table-head"><span>Team</span><span>P</span><span>GD</span><span>Pts</span></div>
        ${group.teams.map((team) => `
          <div class="table-row">
            <span>${teamImage(team)} ${escapeHtml(team.abbreviation || team.team)}</span>
            <span>${team.played}</span><span>${team.difference}</span><strong>${team.points}</strong>
          </div>`).join("")}
      </article>`)
    .join("")
    : `<p class="notice">Standings are not available for this league.</p>`;
  elements.upcoming.querySelectorAll(".squad-toggle").forEach((button) => {
    button.addEventListener("click", () => toggleSquads(button));
  });
  updateCountdowns();
}

function renderSquad(team, squad) {
  return `<section class="squad-team">
    <h4>${teamImage(team)} ${escapeHtml(team.name)}</h4>
    <div class="player-grid">${squad.players.length
      ? squad.players.map((player) => {
          const portrait = player.picture
            ? `${player.picture}?io=transform:fill,width:120,height:120`
            : "";
          return `<span class="player-card">
            ${portrait ? `<img src="${escapeHtml(portrait)}" alt="${escapeHtml(player.name)}" />` : `<i>${escapeHtml(player.shirtNumber ?? "–")}</i>`}
            <small>${escapeHtml(player.position)}</small>
            <strong>${escapeHtml(player.name)}</strong>
          </span>`;
        }).join("")
      : `<p>Squad not announced.</p>`}</div>
  </section>`;
}

async function toggleSquads(button) {
  const match = state.upcoming.find((item) => item.id === button.dataset.matchId);
  if (!match) return;
  elements.squadModalTitle.textContent = `${match.home.name} vs ${match.away.name}`;
  elements.squadModalContent.textContent = "Loading team members...";
  elements.squadModal.showModal();
  try {
    const query = `competitionId=${encodeURIComponent(match.competitionId)}&seasonId=${encodeURIComponent(match.seasonId)}`;
    const responses = await Promise.all([
      fetch(`/api/squad/${encodeURIComponent(match.home.id)}?${query}`),
      fetch(`/api/squad/${encodeURIComponent(match.away.id)}?${query}`),
    ]);
    const squads = await Promise.all(responses.map((response) => {
      if (!response.ok) throw new Error("Squad unavailable");
      return response.json();
    }));
    elements.squadModalContent.innerHTML =
      renderSquad(match.home, squads[0]) + renderSquad(match.away, squads[1]);
  } catch (error) {
    elements.squadModalContent.textContent = error.message;
  }
}

function renderCompetitionSelect() {
  elements.competitionSelect.innerHTML = state.competitions
    .map((competition) => `<option value="${escapeHtml(competition.id)}" ${competition.id === state.competitionId ? "selected" : ""}>${escapeHtml(competition.name)}</option>`)
    .join("");
}

function updateCountdowns() {
  document.querySelectorAll(".kickoff-countdown").forEach((countdown) => {
    const remaining = Date.parse(countdown.dataset.kickoff) - Date.now();
    if (remaining <= 0) {
      countdown.textContent = "Starting now";
      return;
    }
    const totalMinutes = Math.ceil(remaining / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    countdown.textContent = `Starts in ${hours}h ${minutes}m`;
  });
}

function renderBlogToggle() {
  elements.feedLayout.classList.toggle("hidden", !state.blogExpanded);
  elements.timelineToggle.setAttribute("aria-expanded", String(state.blogExpanded));
  elements.timelineToggle.querySelector("span").textContent = state.blogExpanded
    ? "Hide live blog"
    : "Show live blog";
  elements.timelineToggle.querySelector("b").textContent = state.blogExpanded ? "↑" : "↓";
}

async function selectMatch(id, silent = false) {
  state.selectedId = id;
  const match = state.matches.find((item) => item.id === id);
  if (!match) return;

  renderMatches();
  renderScoreboard(match);
  elements.matchView.classList.remove("hidden");
  elements.empty.classList.add("hidden");
  elements.feedError.classList.add("hidden");

  try {
    const response = await fetch(`/api/timeline/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("Timeline unavailable");
    const data = await response.json();
    state.timeline = data.events;
    renderScoreboard(match);
    renderTimeline();
    if (!silent) elements.matchView.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    elements.feedError.textContent = error.message;
    elements.feedError.classList.remove("hidden");
  }
}

elements.timelineToggle.addEventListener("click", () => {
  state.blogExpanded = !state.blogExpanded;
  renderBlogToggle();
  if (state.blogExpanded) {
    elements.feedLayout.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

elements.competitionSelect.addEventListener("change", () => {
  state.competitionId = elements.competitionSelect.value;
  localStorage.setItem("competitionId", state.competitionId);
  state.selectedId = null;
  state.timeline = [];
  refresh();
});

elements.squadModalClose.addEventListener("click", () => elements.squadModal.close());
elements.squadModal.addEventListener("click", (event) => {
  if (event.target === elements.squadModal) elements.squadModal.close();
});

async function refresh() {
  elements.refreshLabel.textContent = "Refreshing FIFA data";
  try {
    const query = `?competitionId=${encodeURIComponent(state.competitionId)}`;
    const [matchResponse, overviewResponse] = await Promise.all([
      fetch(`/api/matches${query}`),
      fetch(`/api/overview${query}`),
    ]);
    if (!matchResponse.ok || !overviewResponse.ok) throw new Error("Match feed unavailable");
    const [data, overview] = await Promise.all([matchResponse.json(), overviewResponse.json()]);
    state.matches = data.matches;
    state.upcoming = overview.upcoming;
    state.groups = overview.groups;
    state.competitions = overview.competitions;
    if (!state.competitions.some((competition) => competition.id === state.competitionId)) {
      state.competitionId = "17";
      localStorage.setItem("competitionId", state.competitionId);
    }
    renderCompetitionSelect();
    renderOverview();
    elements.refreshLabel.textContent = `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · every 5 min`;

    if (!state.matches.length) {
      elements.empty.classList.remove("hidden");
      elements.matchView.classList.add("hidden");
    } else {
      const selectedExists = state.matches.some((match) => match.id === state.selectedId);
      const nextId = selectedExists ? state.selectedId : state.matches[0].id;
      renderMatches();
      await selectMatch(nextId, true);
    }
  } catch (error) {
    elements.refreshLabel.textContent = error.message;
    elements.empty.classList.remove("hidden");
  }
}

refresh();
renderBlogToggle();
state.timer = setInterval(refresh, REFRESH_INTERVAL_MS);
state.countdownTimer = setInterval(updateCountdowns, COUNTDOWN_INTERVAL_MS);
