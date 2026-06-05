const crypto = require("node:crypto");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

function clientIp(event) {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"] ||
    "unknown"
  ).split(",")[0].trim();
}

function ipHash(event) {
  return crypto
    .createHash("sha256")
    .update(`${clientIp(event)}:${process.env.ADMIN || "hc"}`)
    .digest("hex");
}

async function supabase(path, options = {}) {
  const base = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(body?.message || "Supabase request failed");
    error.statusCode = response.status;
    error.detail = body;
    throw error;
  }

  return body;
}

async function requireAdmin(event) {
  const password = event.headers["x-admin-password"] || "";
  return Boolean(process.env.ADMIN && password === process.env.ADMIN);
}

module.exports = {
  ipHash,
  json,
  requireAdmin,
  supabase,
};
