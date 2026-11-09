import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_logic.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';

void main() {
  group('Cloudy progress rules', () {
    test('keeps the exact current lesson whitelist', () {
      expect(cloudyLevelLessons('A1').length, 24);
      expect(cloudyLevelLessons('A2').length, 24);
      expect(cloudyLevelLessons('B1').length, 6);
      expect(cloudyLevelLessons('B2').length, 6);
      expect(isCloudyLessonInLevel(56, 'A1'), isTrue);
      expect(isCloudyLessonInLevel(57, 'A2'), isTrue);
      expect(isCloudyLessonInLevel(6, 'A1'), isFalse);
    });

    test('normalizes typed recall answers like the current app', () {
      expect(checkCloudyRecallAnswer('  HELLO!!  ', 'hello'), isTrue);
      expect(checkCloudyRecallAnswer('hello   world', 'hello world'), isTrue);
      expect(checkCloudyRecallAnswer('hello there', 'hello'), isFalse);
    });

    test('validates all answer formats without changing their exact rules', () {
      const choice = CloudyChoiceExercise(
        question: 'привет', answer: 'hello', english: 'hello',
        speak: false, options: ['goodbye', 'hello'], title: 'Переведите',
      );
      const listening = CloudyListeningExercise(
        answer: 'son', english: 'son', options: ['sun', 'son'], title: 'Что услышали?',
      );
      const builder = CloudyBuilderExercise(
        question: 'Я иду домой.', answer: 'I go home.',
        options: ['I', 'go', 'home.'], title: 'Собери предложение',
      );
      const recall = CloudyRecallExercise(
        question: 'привет', answer: 'hello', english: 'hello', title: 'Вспомни',
      );

      expect(isCloudyAnswerCorrect(choice, selectedOption: 1), isTrue);
      expect(isCloudyAnswerCorrect(choice, selectedOption: 0), isFalse);
      expect(isCloudyAnswerCorrect(listening, selectedOption: 1), isTrue);
      expect(isCloudyAnswerCorrect(builder, builtOptionIndices: [0, 1, 2]), isTrue);
      expect(isCloudyAnswerCorrect(builder, builtOptionIndices: [2, 1, 0]), isFalse);
      expect(isCloudyAnswerCorrect(recall, typedAnswer: ' HELLO!! '), isTrue);
    });

    test('scores a matching exercise only after the final pair is found', () {
      const session = CloudySession(lesson: 0, exercises: []);
      final first = applyCloudyMatchingAttempt(
        CloudyState.defaults(), session,
        englishWord: 'son', correct: true, totalPairs: 2,
      );
      expect(first.session.matchingCorrect, 1);
      expect(first.session.correct, 0);
      expect(first.session.total, 0);

      final second = applyCloudyMatchingAttempt(
        first.state, first.session,
        englishWord: 'mother', correct: true, totalPairs: 2,
      );
      expect(second.session.matchingCorrect, 2);
      expect(second.session.correct, 1);
      expect(second.session.total, 1);
      expect(second.session.combo, 1);

      final wrong = applyCloudyMatchingAttempt(
        second.state, second.session,
        englishWord: 'father', correct: false, totalPairs: 2,
      );
      expect(wrong.state.mistakes['father'], 1);
      expect(wrong.session.health, 4);
      expect(wrong.session.total, 2);
      expect(wrong.session.combo, 0);
    });

    test('uses the same XP, star and accuracy formulas', () {
      expect(cloudyLessonGain(5), 30);
      expect(cloudyLessonGain(0), 15);
      expect(cloudyLessonGain(-1), 15);
      expect(cloudyLessonStars(5), 3);
      expect(cloudyLessonStars(4), 2);
      expect(cloudyLessonStars(2), 1);
      expect(cloudyAccuracy(2, 3), 67);
      expect(cloudyAccuracy(0, 0), 0);
    });

    test('grades correct and incorrect answers consistently', () {
      const session = CloudySession(lesson: 0, exercises: [], combo: 2, correct: 1, total: 2);
      final good = applyCloudyAnswer(CloudyState.defaults(), session, true);
      expect(good.session.correct, 2);
      expect(good.session.total, 3);
      expect(good.session.combo, 3);

      final bad = applyCloudyAnswer(
        CloudyState.defaults(), session, false, englishWord: 'son',
      );
      expect(bad.state.mistakes['son'], 1);
      expect(bad.session.health, 4);
      expect(bad.session.combo, 0);
      expect(bad.session.learnedMistakes, ['son']);
      expect(bad.session.total, 3);
    });

    test('skipping pronunciation is neutral apart from combo reset', () {
      const session = CloudySession(lesson: 0, exercises: [], combo: 3);
      final skipped = skipCloudyAnswer(session);
      expect(skipped.combo, 0);
      expect(skipped.total, 0);
      expect(skipped.correct, 0);
      expect(skipped.health, 5);
    });

    test('review success decrements the saved mistake counter', () {
      final state = CloudyState.fromJson({'mis': {'son': 2}});
      const session = CloudySession(lesson: -1, exercises: [], review: true);
      final result = applyCloudyAnswer(state, session, true, englishWord: 'son');
      expect(result.state.mistakes['son'], 1);
    });

    test('finishing a lesson awards XP and unlock progress in sequence', () {
      final state = CloudyState.fromJson({'lv': 'A1', 'dn': {'A1': 0}});
      const session = CloudySession(
        lesson: 0, exercises: [], health: 5, correct: 4, total: 5,
      );
      final result = finishCloudyLesson(state, session, now: DateTime(2026, 11, 9, 12));
      expect(result.gain, 30);
      expect(result.stars, 3);
      expect(result.accuracy, 80);
      expect(result.state.xp, 30);
      expect(result.state.completed['A1'], 1);
      expect(result.state.today.les, 1);
      expect(result.state.today.ok, 4);
    });

    test('does not advance the curriculum for review sessions', () {
      final state = CloudyState.fromJson({'lv': 'A1'});
      const session = CloudySession(lesson: -1, exercises: [], review: true);
      final result = finishCloudyLesson(state, session, now: DateTime(2026, 11, 9, 12));
      expect(result.state.completed['A1'], 0);
      expect(result.state.today.les, 0);
    });

    test('daily chest can be claimed once after reaching the goal', () {
      final state = CloudyState.fromJson({
        'xp': 100, 'set': {'goal': 30},
        'td': {'d': 'Mon Nov 9 2026', 'xp': 30, 'les': 1, 'ok': 5, 'claim': 0},
      });
      final claimed = claimCloudyChest(state)!;
      expect(claimed.xp, 125);
      expect(claimed.today.claim, 1);
      expect(claimCloudyChest(claimed), isNull);
    });

    test('guest progress merges without losing account or guest counters', () {
      final account = CloudyState.fromJson({
        'xp': 100, 'dn': {'A1': 2}, 'mis': {'son': 1},
        'days': ['2026-11-08'], 'ach': ['first'], 'acc': [4, 5],
      });
      final guest = CloudyState.fromJson({
        'xp': 50, 'dn': {'A1': 3}, 'mis': {'son': 2, 'cat': 1},
        'days': ['2026-11-09'], 'ach': ['s3'], 'acc': [2, 3],
      });
      final merged = mergeCloudyProgress(guest, account);
      expect(merged.xp, 150);
      expect(merged.completed['A1'], 3);
      expect(merged.mistakes, {'son': 3, 'cat': 1});
      expect(merged.days, ['2026-11-08', '2026-11-09']);
      expect(merged.achievements, ['first', 's3']);
      expect(merged.accuracy, [6, 8]);
    });

    test('sanitizes client progress with the same server limits', () {
      final input = CloudyState.fromJson({
        'streak': 9000,
        'dn': {'A1': 999, 'A2': 999, 'B1': 99, 'B2': 99},
        'acc': [9999999, 9999999],
        'set': {'vol': 2, 'goal': 1, 'remT': '25:61'},
        'td': {'xp': 999999, 'les': 9999, 'ok': 999999, 'claim': 9},
      });
      final safe = sanitizeCloudyProgress(input);
      expect(safe.streak, 3650);
      expect(safe.completed, {'A1': 24, 'A2': 24, 'B1': 6, 'B2': 6});
      expect(safe.accuracy, [1000000, 1000000]);
      expect(safe.settings.vol, 1);
      expect(safe.settings.goal, 5);
      expect(safe.settings.remT, '19:00');
      expect(safe.today.xp, 100000);
      expect(safe.today.les, 1000);
      expect(safe.today.claim, 1);
    });

    test('generates the expected exercise mix and gates pronunciation on microphone access', () {
      const words = [
        CloudyPair('apple', 'яблоко'),
        CloudyPair('water', 'вода'),
        CloudyPair('bread', 'хлеб'),
      ];
      const lesson = CloudyLesson(
        title: 'Еда',
        words: words,
        sentences: [CloudyPair('I drink water', 'Я пью воду')],
      );
      final pool = [...words, const CloudyPair('milk', 'молоко')];

      final withMic = buildCloudyExercises(
        lesson, pool, microphoneEnabled: true, random: () => 0.25,
      );
      final withoutMic = buildCloudyExercises(
        lesson, pool, microphoneEnabled: false, random: () => 0.25,
      );

      expect(withMic.where((item) => item.kind == 'c'), hasLength(2));
      expect(withMic.where((item) => item.kind == 'l'), hasLength(1));
      expect(withMic.where((item) => item.kind == 'm'), hasLength(1));
      expect(withMic.where((item) => item.kind == 'b'), hasLength(1));
      expect(withMic.where((item) => item.kind == 'p'), hasLength(1));
      expect(withoutMic.where((item) => item.kind == 'p'), isEmpty);
      final builder = withMic.firstWhere((item) => item.kind == 'b') as CloudyBuilderExercise;
      expect(builder.question, 'Я пью воду');
      expect(builder.answer, 'I drink water');
      expect(builder.options, containsAll(['I', 'drink', 'water']));
    });

    test('adds one retry phase for mistakes and then ends the session', () {
      final pool = [
        const CloudyPair('son', 'сын'),
        const CloudyPair('mother', 'мама'),
      ];
      const initial = CloudySession(
        lesson: 0,
        exercises: [CloudyChoiceExercise(question: '', answer: '', english: '', speak: false, options: [], title: '')],
        learnedMistakes: ['son'],
      );

      final retry = advanceCloudySession(initial, pool, random: () => 0.2);
      expect(retry, isNotNull);
      expect(retry!.retryPhase, isTrue);
      expect(retry.exercises, hasLength(2));
      expect((retry.exercises.last as CloudyChoiceExercise).english, 'son');
      expect(advanceCloudySession(retry, pool), isNull);
    });

  });
}
