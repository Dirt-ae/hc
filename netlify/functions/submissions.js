const { json, supabase } = require("./shared");

function phase(round) {
  if (!round?.active) return "idle";
  const endsAt = round.edit_ends_at ? Date.parse(round.edit_ends_at) : null;
  if (!endsAt) return "unscheduled";
  return Date.now() > endsAt ? "ended" : "hidden";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const roundRows = await supabase("round_state?id=eq.1&select=*", { method: "GET" });
    if (phase(roundRows[0]) !== "ended") return json(200, { submissions: [] });

    const rows = await supabase(
      "submissions?select=id,title,edit_video_id,proof_video_id,participant_id,created_at,participants(name)&order=created_at.asc",
      { method: "GET" }
    );

    return json(200, { submissions: rows });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message });
  }
};
