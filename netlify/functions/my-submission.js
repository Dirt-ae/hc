const { json, supabase } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const participantId = String(event.queryStringParameters?.participantId || "");
    if (!participantId) return json(200, { submission: null });

    const rows = await supabase(
      `submissions?participant_id=eq.${encodeURIComponent(participantId)}&select=id,title,edit_video_id,proof_video_id,created_at`,
      { method: "GET" }
    );

    return json(200, { submission: rows[0] || null });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message });
  }
};
