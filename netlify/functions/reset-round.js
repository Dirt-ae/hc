const { json, requireAdmin, supabase } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    if (!(await requireAdmin(event))) return json(401, { error: "Admin password required" });

    await supabase("votes?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await supabase("submissions?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await supabase("participants?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });

    const rows = await supabase("round_state?id=eq.1", {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        submissions_open: false,
        voting_locked: false,
        queue_opens_at: null,
        edit_starts_at: null,
        edit_ends_at: null,
        song_url: null,
        started_at: null,
        updated_at: new Date().toISOString(),
      }),
    });

    return json(200, { round: rows[0] });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message });
  }
};
