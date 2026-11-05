import { describe, expect, it } from "vitest";
import { normalizeCloudyLearningEvents } from "./cloudy-learning-events";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const eventId = "123e4567-e89b-42d3-a456-426614174001";
const sessionId = "123e4567-e89b-42d3-a456-426614174002";
const now = Date.now();

describe("Cloudy learning event validation", () => {
  it("binds the authenticated user ID on the server-side row", () => {
    const [row] = normalizeCloudyLearningEvents([{
      eventId, sessionId, eventType: "answer_submitted", at: now, level: "A1",
      lessonIndex: 3, questionIndex: 0, exerciseType: "c", skillId: "vocabulary:apple", correct: false,
      retry: true, responseSeconds: 12, selectedAnswer: "apples", correctAnswer: "apple",
    }], userId, now);
    expect(row.user_id).toBe(userId);
    expect(row.event_id).toBe(eventId);
    expect(row.session_id).toBe(sessionId);
    expect(row.is_correct).toBe(false);
    expect(row.response_seconds).toBe(12);
    expect(row.question_index).toBe(0);
  });

  it("rejects client-supplied duplicate IDs and malformed session IDs", () => {
    expect(() => normalizeCloudyLearningEvents([
      { eventId, eventType: "session_started", at: now },
      { eventId, eventType: "session_started", at: now },
    ], userId, now)).toThrow(/duplicate/i);
    expect(() => normalizeCloudyLearningEvents([
      { eventId, sessionId: "not-a-uuid", eventType: "session_started", at: now },
    ], userId, now)).toThrow(/session ID/i);
  });

  it("rejects unsupported event types, levels, and untrusted timestamps", () => {
    expect(() => normalizeCloudyLearningEvents([{ eventId, eventType: "account_deleted", at: now }], userId, now)).toThrow(/Unsupported/i);
    expect(() => normalizeCloudyLearningEvents([{ eventId, eventType: "session_started", at: now, level: "C2" }], userId, now)).toThrow(/level/i);
    expect(() => normalizeCloudyLearningEvents([{ eventId, eventType: "session_started", at: now + 3600000 }], userId, now)).toThrow(/timestamp/i);
  });

  it("requires answer outcomes and caps answer payload fields", () => {
    expect(() => normalizeCloudyLearningEvents([{ eventId, eventType: "answer_submitted", at: now }], userId, now)).toThrow(/boolean outcome/i);
    const [row] = normalizeCloudyLearningEvents([{
      eventId, eventType: "answer_submitted", at: now, correct: true,
      selectedAnswer: "x".repeat(300), correctAnswer: "y".repeat(300),
    }], userId, now);
    expect(row.selected_answer).toHaveLength(160);
    expect(row.correct_answer).toHaveLength(160);
  });

  it("limits batches to fifty events", () => {
    expect(() => normalizeCloudyLearningEvents([], userId, now)).toThrow(/batch/i);
    expect(() => normalizeCloudyLearningEvents(Array.from({ length: 51 }, (_, index) => ({
      eventId: `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
      eventType: "session_started", at: now,
    })), userId, now)).toThrow(/batch/i);
  });
});
