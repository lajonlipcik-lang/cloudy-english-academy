export const CLOUDY_LESSON_XP = 24;
export const CLOUDY_MAX_DAILY_LESSON_AWARDS = 5;

const LESSONS_BY_LEVEL: Record<string, readonly number[]> = {
  A1: [0, 1, 2, 3, 4, 5],
  A2: [6, 7, 8, 15, 16, 17],
  B1: [9, 10, 11, 18, 19, 20],
  B2: [12, 13, 14, 21, 22, 23],
};

export function isLessonInLevel(lessonIndex: number, level: string): boolean {
  return Number.isInteger(lessonIndex) && (LESSONS_BY_LEVEL[level]?.includes(lessonIndex) ?? false);
}
