import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_learning_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy adaptive learning evidence', () {
    late CloudyLearningStore store;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      store = await CloudyLearningStore.create(scope: 'learner@example.com');
    });

    test('records answer evidence and creates an offline sync event', () async {
      final exercise = const CloudyChoiceExercise(
        question: 'привет', answer: 'hello', english: 'hello',
        speak: false, options: ['hello', 'goodbye'], title: 'Переведите на английский',
      );
      final result = await store.record(
        exercise, correct: true, questionIndex: 2,
        selectedAnswer: 'hello', now: DateTime(2026, 11, 9, 12),
      );
      expect(result?['skillId'], 'vocabulary:hello');
      expect(result?['correct'], 1);
      expect(store.profile(now: DateTime(2026, 11, 9, 12))['attempts'], 1);
      expect(store.pending(), hasLength(1));
    });

    test('weights retry evidence less than a first attempt', () async {
      const exercise = CloudyBuilderExercise(
        question: 'Я иду домой.', answer: 'I go home.',
        options: ['I', 'go', 'home.'], title: 'Собери предложение',
        skillId: 'grammar:sentence-order',
      );
      final result = await store.record(
        exercise, correct: false, retry: true,
        now: DateTime(2026, 11, 9, 12),
      );
      expect(result?['evidence'], closeTo(0.35, 0.0001));
      expect(result?['incorrect'], 1);
    });

    test('starts and closes sessions with matching session identifiers', () async {
      final started = await store.beginSession(
        level: 'A1', lessonIndex: 24, now: DateTime(2026, 11, 9, 12),
      );
      final event = await store.endSession(
        outcome: 'lesson_completed', now: DateTime(2026, 11, 9, 12, 5),
      );
      expect(event?['eventType'], 'lesson_completed');
      expect(event?['sessionId'], started);
      expect(store.pending(), hasLength(2));
    });

    test('prioritizes overdue weak skills while preserving original order on ties', () async {
      const weak = CloudyChoiceExercise(
        question: 'привет', answer: 'hello', english: 'hello',
        speak: false, options: ['hello'], title: 'Переведите',
      );
      const other = CloudyChoiceExercise(
        question: 'пока', answer: 'goodbye', english: 'goodbye',
        speak: false, options: ['goodbye'], title: 'Переведите',
      );
      await store.record(weak, correct: false, now: DateTime(2026, 11, 1));
      final order = store.prioritize([other, weak], now: DateTime(2026, 11, 9));
      expect(order.first, weak);
    });

    test('acknowledges only accepted outbox events', () async {
      const exercise = CloudyPronunciationExercise(english: 'hello');
      await store.record(exercise, correct: true, now: DateTime(2026, 11, 9));
      final pending = store.pending();
      expect(await store.acknowledge([pending.first['eventId'] as String]), 1);
      expect(store.pending(), isEmpty);
    });
  });
}
