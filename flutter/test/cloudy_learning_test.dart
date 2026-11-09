import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_learning.dart';
import 'package:cloudy_english/domain/cloudy_logic.dart';

void main() {
  group('Cloudy adaptive learning', () {
    test('uses the same skill identity rules as the browser runtime', () {
      const word = CloudyExercise(kind: CloudyExerciseKind.choice, english: '  Son ');
      const guided = CloudyExercise(
        kind: CloudyExerciseKind.builder,
        skillId: 'grammar:present-simple:third-person',
      );
      const matching = CloudyExercise(kind: CloudyExerciseKind.matching);

      expect(cloudySkillFor(word), 'vocabulary:son');
      expect(cloudySkillFor(guided), 'grammar:present-simple:third-person');
      expect(cloudySkillFor(matching), 'vocabulary:matching');
    });

    test('updates mastery, evidence and review schedule after a normal answer', () {
      const exercise = CloudyExercise(kind: CloudyExerciseKind.choice, english: 'son');
      final update = recordCloudyAnswer(
        const {}, exercise, true, nowMillis: 1000000,
      );

      expect(update.skillId, 'vocabulary:son');
      expect(update.evidence.mastery, closeTo(0.61, 0.000001));
      expect(update.evidence.evidence, 1);
      expect(update.evidence.correct, 1);
      expect(update.evidence.incorrect, 0);
      expect(update.evidence.dueAt, 1000000 + Duration.millisecondsPerDay);
    });

    test('weights retry answers less than first attempts', () {
      const exercise = CloudyExercise(kind: CloudyExerciseKind.choice, english: 'son');
      final update = recordCloudyAnswer(
        const {}, exercise, false, nowMillis: 5000, retry: true,
      );

      expect(update.evidence.mastery, closeTo(0.4615, 0.000001));
      expect(update.evidence.evidence, closeTo(0.35, 0.000001));
      expect(update.evidence.incorrect, 1);
    });

    test('uses the exact spaced-review thresholds', () {
      expect(cloudyReviewIntervalDays(0.9, 1), 1);
      expect(cloudyReviewIntervalDays(0.54, 20), 1);
      expect(cloudyReviewIntervalDays(0.6, 2), 2);
      expect(cloudyReviewIntervalDays(0.75, 3), 4);
      expect(cloudyReviewIntervalDays(0.9, 3), 7);
      expect(cloudyReviewIntervalDays(0.95, 3), 14);
    });

    test('prioritizes due and weak skills while preserving stable tie order', () {
      const weak = CloudyExercise(kind: CloudyExerciseKind.choice, english: 'son');
      const strong = CloudyExercise(kind: CloudyExerciseKind.choice, english: 'mother');
      const unknown = CloudyExercise(kind: CloudyExerciseKind.choice, english: 'water');
      final skills = {
        'vocabulary:son': const CloudySkillEvidence(mastery: 0.9, evidence: 4, dueAt: 5000),
        'vocabulary:mother': const CloudySkillEvidence(mastery: 0.95, evidence: 5, dueAt: 9000),
      };
      final result = prioritizeCloudyExercises(
        [strong, unknown, weak], skills, nowMillis: 10000,
      );

      expect(result, [weak, strong, unknown]);
    });

    test('builds a profile from persisted mastery records', () {
      final profile = buildCloudyLearningProfile({
        'a': const CloudySkillEvidence(mastery: 0.4, correct: 1, incorrect: 2, dueAt: 1),
        'b': const CloudySkillEvidence(mastery: 0.8, correct: 3, dueAt: 20000),
      }, nowMillis: 10000);

      expect(profile.attempts, 6);
      expect(profile.dueCount, 1);
      expect(profile.weakestSkills.first.key, 'a');
    });
  });
}
