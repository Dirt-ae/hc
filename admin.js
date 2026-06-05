const $ = (id) => document.getElementById(id);

const adminForm = $("admin-form");
const lockAdminBtn = $("lock-admin");
const adminBadge = $("admin-badge");
const adminStatus = $("admin-status");
const adminPasscode = $("admin-passcode");
const roundStatus = $("round-status");

const controls = {
  start: $("admin-start"),
  open: $("admin-open"),
  close: $("admin-close"),
  lockVotes: $("admin-lock-votes"),
  reset: $("admin-reset"),
};

let adminPassword = sessionStorage.getItem("hc-admin-password") || "";
let adminUnlocked = false;

async function api(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned a non-JSON response`);
  }
  if (!response.ok) {
    throw new Error(data.error || `${path} failed with status ${response.status}`);
  }
  return data;
}

function renderAdmin() {
  adminBadge.textContent = adminUnlocked ? "Unlocked" : "Locked";
  adminBadge.className = adminUnlocked ? "state-chip live" : "state-chip locked";
  adminStatus.textContent = adminUnlocked ? "Ready." : "Locked.";
  Object.values(controls).forEach((button) => {
    button.disabled = !adminUnlocked;
  });
}

function renderRound(round) {
  const live = round?.active ? "Live" : "Idle";
  const submissions = round?.submissions_open ? "submits open" : "submits closed";
  const votes = round?.voting_locked ? "votes locked" : "votes open";
  roundStatus.textContent = `${live} / ${submissions} / ${votes}`;
}

async function loadRound() {
  try {
    const { round } = await api("round");
    renderRound(round);
  } catch (error) {
    roundStatus.textContent = error.message;
    if (error.message.includes("404")) {
      roundStatus.textContent = "Backend functions are not deployed.";
    }
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
    adminStatus.textContent = error.message.includes("404")
      ? "Backend functions are not deployed."
      : error.message;
  }
});

lockAdminBtn.addEventListener("click", () => {
  adminUnlocked = false;
  adminPassword = "";
  sessionStorage.removeItem("hc-admin-password");
  renderAdmin();
});

controls.start.addEventListener("click", () => {
  saveRound({
    active: true,
    submissionsOpen: true,
    votingLocked: false,
    startedAt: new Date().toISOString(),
  });
});

controls.open.addEventListener("click", () => {
  saveRound({ active: true, submissionsOpen: true, votingLocked: false, startedAt: new Date().toISOString() });
});

controls.close.addEventListener("click", () => {
  saveRound({ active: true, submissionsOpen: false, votingLocked: false, startedAt: new Date().toISOString() });
});

controls.lockVotes.addEventListener("click", () => {
  saveRound({ active: true, submissionsOpen: false, votingLocked: true, startedAt: new Date().toISOString() });
});

controls.reset.addEventListener("click", () => {
  saveRound({ active: false, submissionsOpen: false, votingLocked: false, startedAt: null });
});

renderAdmin();
loadRound();
setInterval(loadRound, 15000);
