const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid request" });
  }

  const expected = process.env.ADMIN;
  const entered = String(payload.password || "");

  if (!expected) {
    return json(500, { ok: false, error: "ADMIN environment variable is missing" });
  }

  return json(200, { ok: entered === expected });
};
