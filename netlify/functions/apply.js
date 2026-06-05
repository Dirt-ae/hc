const { ipHash, json, supabase } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const name = String(body.name || "").trim().slice(0, 40);
    const deviceId = String(body.deviceId || "").trim().slice(0, 120);

    if (!name || !deviceId) return json(400, { error: "Name and device are required" });

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
