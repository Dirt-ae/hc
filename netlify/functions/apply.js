const { ipHash, json, supabase } = require("./shared");

function canJoin(round) {
  const now = Date.now();
  const opensAt = round?.queue_opens_at ? Date.parse(round.queue_opens_at) : null;
  const endsAt = round?.edit_ends_at ? Date.parse(round.edit_ends_at) : null;

  if (!round?.active || !opensAt || !endsAt) return false;
  return now >= opensAt && now <= endsAt;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const name = String(body.name || "").trim().slice(0, 40);
    const deviceId = String(body.deviceId || "").trim().slice(0, 120);

    if (!name || !deviceId) return json(400, { error: "Name and device are required" });

    const roundRows = await supabase("round_state?id=eq.1&select=*", { method: "GET" });
    if (!canJoin(roundRows[0])) {
      return json(403, { error: "Queue is not open right now." });
    }

    const rows = await supabase("participants", {
      method: "POST",
      body: JSON.stringify({
        name,
        device_id: deviceId,
        ip_hash: ipHash(event),
      }),
    });

    return json(200, { participant: rows[0] });
  } catch (error) {
    if (error.statusCode === 409) {
      return json(409, { error: "You already joined this HC." });
    }
    return json(error.statusCode || 500, { error: error.message });
  }
};
