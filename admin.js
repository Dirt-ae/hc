const $ = (id) => document.getElementById(id);

const adminForm = $("admin-form");
const lockAdminBtn = $("lock-admin");
const adminBadge = $("admin-badge");
const adminStatus = $("admin-status");
const adminPasscode = $("admin-passcode");
const roundStatus = $("round-status");
const scheduleBtn = $("admin-schedule");
const startNowBtn = $("admin-start-now");
const lockVotesBtn = $("admin-lock-votes");
const resetBtn = $("admin-reset");
const queueOpensAt = $("queue-opens-at");
const editStartsAt = $("edit-starts-at");
const editMinutes = $("edit-minutes");
const songUrl = $("song-url");

const controls = [scheduleBtn, startNowBtn, lockVotesBtn, resetBtn].filter(Boolean);
let adminPassword = sessionStorage.getItem("hc-admin-password") || "";
let adminUnlocked = false;

if (!scheduleBtn || !startNowBtn || !lockVotesBtn || !resetBtn) {
  adminStatus.textContent = "Admin page is out of date. Refresh after the latest deploy finishes.";
}

async function api(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned a non-JSON response`);
  }
  if (!response.ok) throw new Error(data.error || `${path} failed with status ${response.status}`);
  return data;
}

function localInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(input) {
  return input ? new Date(input).toISOString() : null;
}

function renderAdmin() {
  adminBadge.textContent = adminUnlocked ? "Unlocked" : "Locked";
  adminBadge.className = adminUnlocked ? "state-chip live" : "state-chip locked";
  adminStatus.textContent = adminUnlocked ? "Ready." : "Locked.";
  controls.forEach((button) => {
    button.disabled = !adminUnlocked;
  });
}

function fillForm(round) {
  if (round?.queue_opens_at) queueOpensAt.value = localInputValue(new Date(round.queue_opens_at));
  if (round?.edit_starts_at) editStartsAt.value = localInputValue(new Date(round.edit_starts_at));
  if (round?.edit_starts_at && round?.edit_ends_at) {
    editMinutes.value = Math.max(1, Math.round((Date.parse(round.edit_ends_at) - Date.parse(round.edit_starts_at)) / 60000));
  }
  if (round?.song_url) songUrl.value = round.song_url;
}

function renderRound(round) {
  const live = round?.active ? "Active" : "Idle";
  const queue = round?.queue_opens_at ? new Date(round.queue_opens_at).toLocaleString() : "not set";
  const starts = round?.edit_starts_at ? new Date(round.edit_starts_at).toLocaleString() : "not set";
  const ends = round?.edit_ends_at ? new Date(round.edit_ends_at).toLocaleString() : "not set";
  roundStatus.textContent = `${live} | Queue: ${queue} | Edit: ${starts} -> ${ends}`;
}

async function loadRound() {
  try {
    const { round } = await api("round");
    fillForm(round);
    renderRound(round);
  } catch (error) {
    roundStatus.textContent = error.message.includes("404") ? "Backend functions are not deployed." : error.message;
  }
}

async function saveRound(patch) {
  const { round } = await api("round", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": adminPassword,
    },
    body: JSON.stringify(patch),
  });
  renderRound(round);
  adminStatus.textContent = "Saved.";
}

async function resetRound() {
  const confirmed = window.confirm("Delete this HC round and start fresh? This clears participants, submissions, and votes.");
  if (!confirmed) return;

  const { round } = await api("reset-round", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": adminPassword,
    },
  });
  localStorage.removeItem("hc-participant-id");
  renderRound(round);
  adminStatus.textContent = "Round cleared. Ready for a new HC.";
}

function schedulePatch(startNow = false) {
  const now = new Date();
  const queueDate = startNow ? now : new Date(queueOpensAt.value);
  const editStartDate = startNow ? now : new Date(editStartsAt.value);
  const minutes = Math.max(1, Number(editMinutes.value) || 60);
  const editEndDate = new Date(editStartDate.getTime() + minutes * 60000);

  return {
    active: true,
    submissionsOpen: true,
    votingLocked: false,
    queueOpensAt: queueDate.toISOString(),
    editStartsAt: editStartDate.toISOString(),
    editEndsAt: editEndDate.toISOString(),
    songUrl: songUrl.value.trim() || null,
    startedAt: editStartDate.toISOString(),
  };
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminStatus.textContent = "Checking...";

  try {
    const result = await api("verify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPasscode.value }),
    });
    adminUnlocked = Boolean(result.ok);
    adminPassword = adminUnlocked ? adminPasscode.value : "";
    sessionStorage.setItem("hc-admin-password", adminPassword);
    renderAdmin();
    if (!adminUnlocked) adminStatus.textContent = "Wrong password.";
  } catch (error) {
    adminUnlocked = false;
    adminPassword = "";
    sessionStorage.removeItem("hc-admin-password");
    renderAdmin();
    adminStatus.textContent = error.message.includes("404") ? "Backend functions are not deployed." : error.message;
  }
});

lockAdminBtn.addEventListener("click", () => {
  adminUnlocked = false;
  adminPassword = "";
  sessionStorage.removeItem("hc-admin-password");
  renderAdmin();
});

scheduleBtn?.addEventListener("click", () => saveRound(schedulePatch(false)));
startNowBtn?.addEventListener("click", () => saveRound(schedulePatch(true)));
lockVotesBtn?.addEventListener("click", () => saveRound({ ...schedulePatch(false), submissionsOpen: false, votingLocked: true }));
resetBtn?.addEventListener("click", () => resetRound());

const now = new Date();
queueOpensAt.value = localInputValue(now);
editStartsAt.value = localInputValue(new Date(now.getTime() + 5 * 60 * 60000));
renderAdmin();
loadRound();
setInterval(loadRound, 15000);
