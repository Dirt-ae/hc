import * as tus from "https://esm.sh/tus-js-client@4.3.1";

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
const dropzones = [...document.querySelectorAll(".dropzone")];

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
    const open = Boolean(round?.submissions_open);
    roundStatus.textContent = round?.active ? "Live" : "Waiting";
    roundStatus.classList.toggle("live", Boolean(round?.active));
    roundDetail.textContent = open
      ? "Submissions are open."
      : "No active HC right now. You can still join the queue or upload early.";
    return round;
  } catch {
    roundStatus.textContent = "Offline";
    roundDetail.textContent = "Could not load the current round.";
    return null;
  }
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
  if (!participantId()) return (uploadStatus.textContent = "Join the queue first.");
  if (!title || !edit || !proof) return (uploadStatus.textContent = "Add title, edit, and proof.");

  const maxBytes = 250 * 1024 * 1024;
  if (edit.size > maxBytes || proof.size > maxBytes) {
    return (uploadStatus.textContent = "Files must be 250 MB or smaller.");
  }

  uploadButton.disabled = true;
  uploadProgress.style.width = "0%";
  uploadStatus.textContent = "Uploading edit...";

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
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    uploadButton.disabled = false;
  }
});

deviceId();
loadRound();
setInterval(loadRound, 15000);
