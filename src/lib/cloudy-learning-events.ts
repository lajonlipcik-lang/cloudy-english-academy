const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set(["session_started", "answer_submitted", "question_skipped", "hint_used", "lesson_completed", "lesson_failed", "lesson_abandoned"]);
const LEVELS = new Set(["A1", "A2", "B1", "B2"]);

function cleanText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || null;
}

export function normalizeCloudyLearningEvents(value: unknown, userId: string, now = Date.now()) {
  if (!UUID_PATTERN.test(userId)) throw new Error("Invalid authenticated learner.");
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("Invalid learning event batch.");
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid learning event.");
    const event = raw as Record<string, unknown>;
    const eventId = String(event.eventId ?? "");
    const sessionId = event.sessionId == null ? null : String(event.sessionId);
    const eventType = String(event.eventType ?? "");
    if (!UUID_PATTERN.test(eventId) || seen.has(eventId)) throw new Error("Invalid or duplicate learning event ID.");
    if (sessionId !== null && !UUID_PATTERN.test(sessionId)) throw new Error("Invalid learning session ID.");
    if (!EVENT_TYPES.has(eventType)) throw new Error("Unsupported learning event type.");
    seen.add(eventId);
    const timestamp = Number(event.at);
    if (!Number.isFinite(timestamp) || timestamp < now - 365 * 86400000 || timestamp > now + 5 * 60000) throw new Error("Learning event timestamp is outside the accepted range.");
    const level = event.level == null ? null : String(event.level);
    if (level !== null && !LEVELS.has(level)) throw new Error("Invalid learning level.");
    const lessonIndex = event.lessonIndex == null ? null : Number(event.lessonIndex);
    if (lessonIndex !== null && (!Number.isInteger(lessonIndex) || lessonIndex < -1 || lessonIndex > 1000)) throw new Error("Invalid lesson index.");
    const questionIndex = event.questionIndex == null ? null : Number(event.questionIndex);
    if (questionIndex !== null && (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 1000)) throw new Error("Invalid question index.");
    const responseSeconds = event.responseSeconds == null ? null : Number(event.responseSeconds);
    if (responseSeconds !== null && (!Number.isInteger(responseSeconds) || responseSeconds < 0 || responseSeconds > 3600)) throw new Error("Invalid response duration.");
    const correct = event.correct == null ? null : event.correct;
    if (correct !== null && typeof correct !== "boolean") throw new Error("Invalid answer outcome.");
    if (eventType === "answer_submitted" && typeof correct !== "boolean") throw new Error("Answer events require a boolean outcome.");
    const sessionType = event.sessionType == null ? null : String(event.sessionType);
    if (sessionType !== null && !["lesson", "review"].includes(sessionType)) throw new Error("Invalid session type.");
    return {
      user_id: userId,
      event_id: eventId,
      session_id: sessionId,
      event_type: eventType,
      occurred_at: new Date(timestamp).toISOString(),
      level,
      lesson_index: lessonIndex,
      question_index: questionIndex,
      session_type: sessionType,
      exercise_type: cleanText(event.exerciseType, 24),
      skill_id: cleanText(event.skillId, 90),
      is_correct: correct,
      retry: Boolean(event.retry),
      response_seconds: responseSeconds,
      selected_answer: cleanText(event.selectedAnswer, 160),
      correct_answer: cleanText(event.correctAnswer, 160),
    };
  });
}
