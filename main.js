import * as tus from "tus-js-client";

const $ = (id) => document.getElementById(id);

const applyForm = $("apply-form");
const uploadForm = $("upload-form");
const uploadButton = $("upload-button");
const roundStatus = $("round-status");
const roundDetail = $("round-detail");
const applyStatus = $("apply-status");
const uploadStatus = $("upload-status");
const uploadProgress = $("upload-progress");
const editFileName = $("edit-file-name");
const proofFileName = $("proof-file-name");
const countdown = $("countdown");
const songLink = $("song-link");
const reviewStatus = $("review-status");
const submissionsList = $("submissions-list");
const dropzones = [...document.querySelectorAll(".dropzone")];
let currentRound = null;
let mySubmission = null;
let loadedSubmissionKey = "";

function deviceId() {
  let id = localStorage.getItem("hc-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("hc-device-id", id);
  }
  return id;
}

function participantId() {
  return localStorage.getItem("hc-participant-id") || "";
}

function prettySize(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
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
  if (!response.ok) {
    throw new Error(data.error || `${path} failed with status ${response.status}`);
  }
  return data;
}

async function loadRound() {
  try {
    const { round } = await api("round");
    currentRound = round;
    renderRound();
    return round;
  } catch {
    roundStatus.textContent = "Offline";
    roundDetail.textContent = "Could not load the current round.";
    return null;
  }
}

async function loadMySubmission() {
  const id = participantId();
  if (!id) {
    mySubmission = null;
    uploadButton.disabled = false;
    return null;
  }
  const { submission } = await api(`my-submission?participantId=${encodeURIComponent(id)}`);
  mySubmission = submission;
  if (mySubmission) {
    uploadButton.disabled = true;
    uploadStatus.textContent = "You already submitted for this HC.";
  } else {
    uploadButton.disabled = false;
    if (uploadStatus.textContent === "You already submitted for this HC.") {
      uploadStatus.textContent = "";
    }
  }
  return submission;
}

async function loadSubmissions() {
  if (phase(currentRound) !== "ended") {
    reviewStatus.textContent = "Edits show here after the timer ends.";
    submissionsList.innerHTML = "";
    loadedSubmissionKey = "";
    return;
  }

  const submissionKey = `${currentRound?.edit_ends_at || ""}:${currentRound?.updated_at || ""}`;
  if (loadedSubmissionKey === submissionKey) return;

  try {
    const { submissions } = await api("submissions");
    loadedSubmissionKey = submissionKey;
    if (!submissions.length) {
      reviewStatus.textContent = "No edits submitted yet.";
      submissionsList.innerHTML = "";
      return;
    }
    reviewStatus.textContent = "Rate each edit from 1 to 10.";
    submissionsList.innerHTML = submissions.map(renderSubmission).join("");
    wireVoteForms();
  } catch (error) {
    reviewStatus.textContent = error.message;
  }
}

function phase(round) {
  if (!round?.active) return "idle";
  const now = Date.now();
  const queueOpens = round.queue_opens_at ? Date.parse(round.queue_opens_at) : null;
  const editStarts = round.edit_starts_at ? Date.parse(round.edit_starts_at) : null;
  const editEnds = round.edit_ends_at ? Date.parse(round.edit_ends_at) : null;
  if (!queueOpens || !editStarts || !editEnds) return "unscheduled";
  if (now < queueOpens) return "scheduled";
  if (now < editStarts) return "queue";
  if (now <= editEnds) return "edit";
  return "ended";
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function renderRound() {
  const round = currentRound;
  const state = phase(round);
  const now = Date.now();
  roundStatus.classList.toggle("live", state === "edit");
  songLink.hidden = !round?.song_url;
  if (round?.song_url) songLink.href = round.song_url;

  if (state === "scheduled") {
    roundStatus.textContent = "Scheduled";
    countdown.textContent = formatDuration(Date.parse(round.queue_opens_at) - now);
    roundDetail.textContent = "Queue opens when the countdown hits zero.";
  } else if (state === "queue") {
    roundStatus.textContent = "Queue";
    countdown.textContent = formatDuration(Date.parse(round.edit_starts_at) - now);
    roundDetail.textContent = "Join now. Editing starts when this timer ends.";
  } else if (state === "edit") {
    roundStatus.textContent = "Live";
    countdown.textContent = formatDuration(Date.parse(round.edit_ends_at) - now);
    roundDetail.textContent = "Edit window is live. Late joins are allowed, but uploads close when time ends.";
  } else if (state === "ended") {
    roundStatus.textContent = "Ended";
    countdown.textContent = "00:00:00";
    roundDetail.textContent = "This HC has ended. Uploads and queue are closed.";
    loadSubmissions();
  } else {
    roundStatus.textContent = "Waiting";
    countdown.textContent = "--:--:--";
    roundDetail.textContent = "No HC is scheduled yet.";
  }
}

function bunnyEmbed(videoId) {
  const libraryId = currentRound?.bunny_library_id || "";
  return videoId && libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}` : "";
}

function renderSubmission(submission) {
  const author = submission.participants?.name || "Unknown";
  const src = bunnyEmbed(submission.edit_video_id);
  const video = src
    ? `<iframe class="submission-video" src="${src}" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen></iframe>`
    : `<div class="submission-video empty-video">Video processing</div>`;

  return `
    <article class="submission-card" data-submission-id="${submission.id}">
      <div>
        <strong>${escapeHtml(submission.title)}</strong>
        <span>by ${escapeHtml(author)}</span>
      </div>
      ${video}
      <form class="vote-form">
        ${["concept", "individuality", "styleApplication", "execution", "overall"].map((field) => `
          <label>
            ${fieldLabel(field)}
            <input name="${field}" type="range" min="1" max="10" value="5" />
          </label>
        `).join("")}
        <button type="submit">Submit rating</button>
        <div class="status"></div>
      </form>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function fieldLabel(field) {
  return {
    concept: "Concept",
    individuality: "Individuality",
    styleApplication: "Style",
    execution: "Execution",
    overall: "Overall",
  }[field];
}

function wireVoteForms() {
  document.querySelectorAll(".submission-card").forEach((card) => {
    const form = card.querySelector(".vote-form");
    const status = form.querySelector(".status");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      status.textContent = "Submitting rating...";
      try {
        await api("vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: card.dataset.submissionId,
            participantId: participantId(),
            deviceId: deviceId(),
            concept: data.get("concept"),
            individuality: data.get("individuality"),
            styleApplication: data.get("styleApplication"),
            execution: data.get("execution"),
            overall: data.get("overall"),
          }),
        });
        status.textContent = "Rating submitted.";
        form.querySelector("button").disabled = true;
      } catch (error) {
        status.textContent = error.message;
      }
    });
  });
}

function canUpload(round) {
  return phase(round) === "edit";
}

async function getUpload(title) {
  return api("create-bunny-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

function uploadToStorage(file, title, offset, share) {
  return new Promise(async (resolve, reject) => {
    let credentials;
    try {
      credentials = await getUpload(title);
    } catch (error) {
      reject(error);
      return;
    }

    const upload = new tus.Upload(file, {
      endpoint: credentials.endpoint,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: String(credentials.expirationTime),
        VideoId: credentials.videoId,
        LibraryId: String(credentials.libraryId),
      },
      metadata: { filetype: file.type || "video/mp4", title },
      onError: reject,
      onProgress(done, total) {
        const ratio = total ? done / total : 0;
        uploadProgress.style.width = `${Math.round(offset + ratio * share)}%`;
      },
      onSuccess() {
        resolve(credentials);
      },
    });

    upload.start();
  });
}

function updateFileLabel(input, target) {
  const file = input.files?.[0];
  target.textContent = file ? `${file.name} - ${prettySize(file.size)}` : "No file selected";
}

for (const zone of dropzones) {
  const input = zone.querySelector('input[type="file"]');
  const label = zone.dataset.target === "edit-video" ? editFileName : proofFileName;

  input.addEventListener("change", () => updateFileLabel(input, label));
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    updateFileLabel(input, label);
  });
}

applyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("applicant-name").value.trim();
  applyStatus.textContent = "Joining...";

  try {
    const { participant } = await api("apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, deviceId: deviceId() }),
    });
    localStorage.setItem("hc-participant-id", participant.id);
    mySubmission = null;
    uploadButton.disabled = false;
    applyStatus.textContent = "You are in.";
  } catch (error) {
    if (error.message.includes("404")) {
      applyStatus.textContent = "Backend is not deployed yet. The page is live, but joining needs Netlify Functions.";
      return;
    }
    applyStatus.textContent = error.message;
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = $("submission-title").value.trim();
  const edit = $("edit-video").files[0];
  const proof = $("proof-video").files[0];
  currentRound = await loadRound();
  if (!participantId()) return (uploadStatus.textContent = "Join the queue first.");
  if (await loadMySubmission()) return (uploadStatus.textContent = "You already submitted for this HC.");
  if (!canUpload(currentRound)) return (uploadStatus.textContent = "Uploads open when the edit timer starts.");
  if (!title || !edit || !proof) return (uploadStatus.textContent = "Add title, edit, and proof.");

  const maxBytes = 250 * 1024 * 1024;
  if (edit.size > maxBytes || proof.size > maxBytes) {
    return (uploadStatus.textContent = "Files must be 250 MB or smaller.");
  }

  uploadButton.disabled = true;
  uploadProgress.style.width = "0%";
  uploadStatus.textContent = "Uploading edit...";
  let submitted = false;

  try {
    const editUpload = await uploadToStorage(edit, `${title} - edit`, 0, 50);
    uploadStatus.textContent = "Uploading proof...";
    const proofUpload = await uploadToStorage(proof, `${title} - proof`, 50, 50);
    await api("submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: participantId(),
        title,
        editVideoId: editUpload.videoId,
        proofVideoId: proofUpload.videoId,
      }),
    });
    uploadProgress.style.width = "100%";
    uploadStatus.textContent = "Submission uploaded.";
    submitted = true;
    await loadMySubmission();
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    uploadButton.disabled = submitted || Boolean(mySubmission);
  }
});

deviceId();
loadRound();
loadMySubmission().catch(() => {});
setInterval(renderRound, 1000);
setInterval(loadRound, 15000);
