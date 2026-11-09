import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';
import 'package:cloudy_english/domain/cloudy_progress_engine.dart';

void main() {
  group('Cloudy progress engine parity', () {
    test('awards the existing lesson XP formula and increments the streak', () {
      final state = CloudyState.defaults().copyWith(level: CloudyLevel.a1);
      const session = CloudySession(review: false, lesson: 0, exercises: []);
      final result = finishCloudyLesson(
        state, session,
        now: DateTime(2026, 11, 3, 12),
        levelLessonIndices: const {'A1': [0, 1, 2]},
      );
      expect(result.gain, 30);
      expect(result.stars, 3);
      expect(result.state.xp, 30);
      expect(result.state.streak, 1);
      expect(result.state.completed['A1'], 1);
    });

    test('does not unlock an out-of-order lesson', () {
      final state = CloudyState.defaults().copyWith(
        level: CloudyLevel.a1,
        completed: const {'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0},
      );
      const session = CloudySession(review: false, lesson: 2, exercises: []);
      final result = finishCloudyLesson(
        state, session, now: DateTime(2026, 11, 3, 12),
        levelLessonIndices: const {'A1': [0, 2, 4]},
      );
      expect(result.state.completed['A1'], 0);
    });

    test('tracks incorrect answers immutably and clears mistakes in review', () {
      const normal = CloudySession(review: false, lesson: 0, exercises: []);
      final wrong = applyCloudyAnswer(
        CloudyState.defaults(), normal, correct: false, englishWord: 'son',
      );
      expect(wrong.state.mistakes['son'], 1);
      expect(wrong.session.health, 4);
      expect(wrong.session.total, 1);
      expect(wrong.session.combo, 0);

      const review = CloudySession(
        review: true, lesson: -1, exercises: [], mistakeWords: ['son'],
      );
      final right = applyCloudyAnswer(
        wrong.state, review, correct: true, englishWord: 'son',
      );
      expect(right.state.mistakes.containsKey('son'), isFalse);
      expect(right.session.correct, 1);
    });

    test('skipping a pronunciation prompt does not count as an answer', () {
      const session = CloudySession(review: false, lesson: 0, exercises: [], combo: 3);
      final skipped = skipCloudyAnswer(session);
      expect(skipped.combo, 0);
      expect(skipped.total, 0);
      expect(skipped.correct, 0);
    });

    test('claims the daily chest only once after the configured goal', () {
      final state = CloudyState.defaults().copyWith(
        xp: 120,
        today: const CloudyToday(d: 'Mon Nov 09 2026', xp: 30),
      );
      final claimed = claimCloudyChest(state);
      expect(claimed?.xp, 145);
      expect(claimCloudyChest(claimed!), isNull);
    });

    test('merges guest and account progress without losing either side', () {
      final guest = CloudyState.fromJson({
        'xp': 20, 'streak': 4, 'last': 'Mon Nov 09 2026', 'lv': 'A1',
        'dn': {'A1': 3, 'A2': 0, 'B1': 0, 'B2': 0},
        'mis': {'hello': 2}, 'days': ['2026-11-09'], 'ach': ['first'],
        'acc': [2, 3], 'wk': {'k': '2026w45', 'xp': 20},
      });
      final account = CloudyState.fromJson({
        'xp': 100, 'streak': 2, 'last': 'Sun Nov 08 2026', 'lv': 'A1',
        'dn': {'A1': 2, 'A2': 0, 'B1': 0, 'B2': 0},
        'mis': {'hello': 1, 'world': 1}, 'days': ['2026-11-08'], 'ach': ['s3'],
        'acc': [4, 5], 'wk': {'k': '2026w45', 'xp': 80},
      });
      final merged = mergeCloudyProgress(guest, account);
      expect(merged.xp, 120);
      expect(merged.completed['A1'], 3);
      expect(merged.mistakes, {'hello': 3, 'world': 1});
      expect(merged.days, ['2026-11-08', '2026-11-09']);
      expect(merged.achievements.toSet(), {'first', 's3'});
      expect(merged.week['xp'], 100);
      expect(merged.last, 'Mon Nov 09 2026');
    });
  });
}
