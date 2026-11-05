export type CloudyGrammarExamPair = { skillId: string; lessonIndex: number; en: string; ru: string };

const A1_GRAMMAR_SKILLS: Record<number, string> = {
  24: "grammar:verbs:action",
  25: "grammar:present-simple:base",
  26: "grammar:present-simple:third-person",
  27: "grammar:present-simple:questions",
  28: "grammar:present-simple:negatives",
  29: "grammar:sentence-order",
};

export function buildKnownGrammar(
  completedLessonIds: number[],
  foundations: Record<number, { examples: [string, string][] }>,
): CloudyGrammarExamPair[] {
  const completed = new Set(completedLessonIds);
  const seen = new Set<string>();
  const pairs: CloudyGrammarExamPair[] = [];
  for (const [lessonText, skillId] of Object.entries(A1_GRAMMAR_SKILLS)) {
    const lessonIndex = Number(lessonText);
    if (!completed.has(lessonIndex)) continue;
    const note = foundations[lessonIndex];
    for (const [enValue, ruValue] of note?.examples ?? []) {
      const en = String(enValue ?? "").trim();
      const ru = String(ruValue ?? "").trim();
      const key = skillId + ":" + en.toLowerCase();
      if (!en || !ru || seen.has(key)) continue;
      seen.add(key);
      pairs.push({ skillId, lessonIndex, en, ru });
    }
  }
  return pairs;
}
