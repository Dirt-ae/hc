const { json, supabase } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const participantId = String(body.participantId || "");
    const title = String(body.title || "").trim().slice(0, 100);

    if (!participantId || !title || !body.editVideoId || !body.proofVideoId) {
      return json(400, { error: "Submission is missing required fields" });
    }

    const rows = await supabase("submissions", {
      method: "POST",
      body: JSON.stringify({
        participant_id: participantId,
        title,
        edit_video_id: String(body.editVideoId),
        proof_video_id: String(body.proofVideoId),
      }),
    });

    return json(200, { submission: rows[0] });
  } catch (error) {
    if (error.statusCode === 409) return json(409, { error: "You already submitted for this HC." });
    return json(error.statusCode || 500, { error: error.message });
  }
};
