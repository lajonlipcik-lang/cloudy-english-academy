import 'cloudy_logic.dart';

class CloudySkillEvidence {
  const CloudySkillEvidence({
    this.mastery = 0.5,
    this.evidence = 0,
    this.correct = 0,
    this.incorrect = 0,
    this.lastPracticed = 0,
    this.dueAt = 0,
  });

  final double mastery;
  final double evidence;
  final int correct;
  final int incorrect;
  final int lastPracticed;
  final int dueAt;

  factory CloudySkillEvidence.fromJson(Object? raw) {
    if (raw is! Map) return const CloudySkillEvidence();
    double number(Object? value, double fallback) =>
        value is num && value.isFinite ? value.toDouble() : fallback;
    int integer(Object? value) => value is num && value.isFinite ? value.toInt() : 0;
    return CloudySkillEvidence(
      mastery: number(raw['mastery'], 0.5).clamp(0.05, 0.98).toDouble(),
      evidence: number(raw['evidence'], 0).clamp(0, 1000).toDouble(),
      correct: integer(raw['correct']).clamp(0, 1000000),
      incorrect: integer(raw['incorrect']).clamp(0, 1000000),
      lastPracticed: integer(raw['lastPracticed']),
      dueAt: integer(raw['dueAt']),
    );
  }

  Map<String, Object?> toJson() => {
    'mastery': mastery,
    'evidence': evidence,
    'correct': correct,
    'incorrect': incorrect,
    'lastPracticed': lastPracticed,
    'dueAt': dueAt,
  };
}

class CloudyLearningUpdate {
  const CloudyLearningUpdate({
    required this.skills,
    required this.skillId,
    required this.evidence,
  });
  final Map<String, CloudySkillEvidence> skills;
  final String skillId;
  final CloudySkillEvidence evidence;
}

class CloudyLearningProfile {
  const CloudyLearningProfile({
    required this.attempts,
    required this.dueCount,
    required this.weakestSkills,
  });
  final int attempts;
  final int dueCount;
  final List<MapEntry<String, CloudySkillEvidence>> weakestSkills;
}

String cloudySkillFor(CloudyExercise exercise) {
  final explicit = _cleanLearningText(exercise.skillId, 90);
  if (explicit.isNotEmpty) return explicit;
  final english = exercise.english.toLowerCase().trim();
  if (english.isNotEmpty) return 'vocabulary:$english';
  return switch (exercise.kind) {
    CloudyExerciseKind.builder => 'grammar:sentence-building',
    CloudyExerciseKind.matching => 'vocabulary:matching',
    CloudyExerciseKind.pronunciation => 'pronunciation:${exercise.english.toLowerCase().trim()}',
    CloudyExerciseKind.grammar => 'grammar:t',
    CloudyExerciseKind.vocabulary => 'grammar:v',
    CloudyExerciseKind.recall => 'grammar:r',
    CloudyExerciseKind.choice => 'grammar:c',
    CloudyExerciseKind.listening => 'grammar:l',
  };
}

int cloudyReviewIntervalDays(double mastery, double evidence) {
  if (evidence < 2 || mastery < 0.55) return 1;
  if (mastery < 0.7) return 2;
  if (mastery < 0.82) return 4;
  if (mastery < 0.92) return 7;
  return 14;
}

List<CloudyExercise> prioritizeCloudyExercises(
  List<CloudyExercise> exercises,
  Map<String, CloudySkillEvidence> skills, {
  required int nowMillis,
}) {
  final scored = exercises.asMap().entries.map((entry) {
    final skill = skills[cloudySkillFor(entry.value)];
    final due = skill != null && skill.dueAt <= nowMillis;
    final weakness = skill == null ? 0.25 : 1 - skill.mastery;
    return (exercise: entry.value, index: entry.key, score: (due ? 2 : 0) + weakness);
  }).toList();
  scored.sort((a, b) {
    final byScore = b.score.compareTo(a.score);
    return byScore != 0 ? byScore : a.index.compareTo(b.index);
  });
  return scored.map((item) => item.exercise).toList(growable: false);
}

CloudyLearningUpdate recordCloudyAnswer(
  Map<String, CloudySkillEvidence> current,
  CloudyExercise exercise,
  bool correct, {
  required int nowMillis,
  bool retry = false,
}) {
  final skillId = cloudySkillFor(exercise);
  final previous = current[skillId] ?? const CloudySkillEvidence();
  final weight = retry ? 0.35 : 1.0;
  final outcome = correct ? 1.0 : 0.0;
  final mastery = (previous.mastery + (outcome - previous.mastery) * (0.22 * weight))
      .clamp(0.05, 0.98)
      .toDouble();
  final evidence = (previous.evidence + weight).clamp(0, 1000).toDouble();
  final updated = CloudySkillEvidence(
    mastery: mastery,
    evidence: evidence,
    correct: previous.correct + (correct ? 1 : 0),
    incorrect: previous.incorrect + (correct ? 0 : 1),
    lastPracticed: nowMillis,
    dueAt: nowMillis +
        cloudyReviewIntervalDays(mastery, evidence) * Duration.millisecondsPerDay,
  );
  return CloudyLearningUpdate(
    skills: Map.unmodifiable({...current, skillId: updated}),
    skillId: skillId,
    evidence: updated,
  );
}

CloudyLearningProfile buildCloudyLearningProfile(
  Map<String, CloudySkillEvidence> skills, {
  required int nowMillis,
}) {
  final sorted = skills.entries.toList()
    ..sort((a, b) => a.value.mastery.compareTo(b.value.mastery));
  return CloudyLearningProfile(
    attempts: skills.values.fold(0, (sum, skill) => sum + skill.correct + skill.incorrect),
    dueCount: skills.values.where((skill) => skill.dueAt <= nowMillis).length,
    weakestSkills: List.unmodifiable(sorted.take(20)),
  );
}

String _cleanLearningText(String value, int max) {
  final cleaned = value
      .replaceAll(RegExp(r'[\u0000-\u001f\u007f]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return cleaned.substring(0, cleaned.length.clamp(0, max));
}
