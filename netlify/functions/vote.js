const { ipHash, json, supabase } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const submissionId = String(body.submissionId || "");
    const deviceId = String(body.deviceId || "").trim();
    const participantId = String(body.participantId || "").trim();

    if (!submissionId || !deviceId) return json(400, { error: "Vote is missing required fields" });

    const submissions = await supabase(`submissions?id=eq.${encodeURIComponent(submissionId)}&select=participant_id`, {
      method: "GET",
    });
    const ownerId = submissions[0]?.participant_id;
    if (!ownerId) return json(404, { error: "Submission not found" });
    if (participantId && participantId === ownerId) {
      return json(403, { error: "You cannot vote on your own edit." });
    }

    const score = (value) => Math.max(1, Math.min(10, Number(value) || 1));
    const rows = await supabase("votes", {
      method: "POST",
      body: JSON.stringify({
        submission_id: submissionId,
        voter_device_id: deviceId,
        voter_ip_hash: ipHash(event),
        concept: score(body.concept),
        individuality: score(body.individuality),
        style_application: score(body.styleApplication),
        execution: score(body.execution),
        overall: score(body.overall),
      }),
    });

    return json(200, { vote: rows[0] });
  } catch (error) {
    if (error.statusCode === 409) return json(409, { error: "You already voted on this edit." });
    return json(error.statusCode || 500, { error: error.message });
  }
};
