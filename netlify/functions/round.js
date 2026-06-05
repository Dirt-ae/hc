const { json, requireAdmin, supabase } = require("./shared");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const rows = await supabase("round_state?id=eq.1&select=*", { method: "GET" });
      return json(200, { round: rows[0] });
    }

    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    if (!(await requireAdmin(event))) return json(401, { error: "Admin password required" });

    const body = JSON.parse(event.body || "{}");
    const patch = {
      active: Boolean(body.active),
      submissions_open: Boolean(body.submissionsOpen),
      voting_locked: Boolean(body.votingLocked),
      queue_opens_at: body.queueOpensAt || null,
      edit_starts_at: body.editStartsAt || null,
      edit_ends_at: body.editEndsAt || null,
      song_url: body.songUrl || null,
      started_at: body.startedAt || null,
      updated_at: new Date().toISOString(),
    };

    const rows = await supabase("round_state?id=eq.1", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return json(200, { round: rows[0] });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message });
  }
};
