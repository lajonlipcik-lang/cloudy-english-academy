import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloudy_english/domain/cloudy_catalog.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_learning_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy catalog', () {
    test('loads the complete bundled curriculum without losing source data', () async {
      final catalog = await CloudyCatalog.load();

      expect(catalog.lessons, hasLength(60));
      expect(catalog.vocabularyPool, hasLength(553));
      expect(catalog.lessons.fold<int>(0, (sum, lesson) => sum + lesson.sentences.length), 383);
      expect(catalog.foundations, hasLength(27));
      expect(catalog.levels.keys, containsAll(['A1', 'A2', 'B1', 'B2']));
      expect(catalog.titleAt(0), 'Привет');
      expect(catalog.titleAt(59), 'Если случится...');
    });

    test('keeps the third sentence source field while preserving exercise inputs', () async {
      final catalog = await CloudyCatalog.load();
      final firstSentence = catalog.lessonAt(0)!.sentences.first;

      expect(firstSentence.second, 'Привет, меня зовут Анна.');
      expect(firstSentence.first, 'Hello, my name is Anna.');
      expect(firstSentence.extra, 'you the');
    });

    test('builds the same lesson stages in the same order', () async {
      final catalog = await CloudyCatalog.load();
      final sequence = catalog.buildLessonSequence(
        24,
        level: 'A1',
        microphoneEnabled: true,
        speechRecognitionAvailable: true,
        random: () => 0.25,
      );

      expect(sequence.first.kind, 't');
      expect(sequence[1].kind, 'v');
      expect((sequence.first as CloudyTheoryExercise).examples, isNotEmpty);
      expect((sequence[1] as CloudyVocabularyExercise).words, hasLength(10));
      expect(sequence.where((item) => item.kind == 'b').length, greaterThanOrEqualTo(2));
      expect(sequence.where((item) => item.kind == 'r'), hasLength(3));
      expect(sequence.where((item) => item.kind == 'p'), hasLength(1));
    });

    test('moves due weak vocabulary into the front of the practice block', () async {
      SharedPreferences.setMockInitialValues({});
      final learningStore = await CloudyLearningStore.create(scope: 'catalog-test');
      await learningStore.record(
        const CloudyChoiceExercise(
          question: 'друг',
          answer: 'friend',
          english: 'friend',
          speak: false,
          options: ['friend'],
          title: 'Переведите',
        ),
        correct: false,
        now: DateTime(2026, 11, 1),
      );

      final catalog = await CloudyCatalog.load();
      final sequence = await catalog.buildAdaptiveLessonSequence(
        24,
        level: 'A1',
        microphoneEnabled: false,
        speechRecognitionAvailable: false,
        learningStore: learningStore,
        now: DateTime(2026, 11, 9),
        random: () => 0.25,
      );
      final practiceStart = sequence.indexWhere(
        (item) => item.kind == 'c' || item.kind == 'l',
      );
      expect((sequence[practiceStart] as CloudyChoiceExercise).english, 'friend');
    });

    test('does not add microphone exercises when recognition is unavailable', () async {
      final catalog = await CloudyCatalog.load();
      final sequence = catalog.buildLessonSequence(
        24,
        level: 'A1',
        microphoneEnabled: true,
        speechRecognitionAvailable: false,
        random: () => 0.25,
      );
      expect(sequence.where((item) => item.kind == 'p'), isEmpty);
    });

    test('maps level sections to the exact lesson indices', () async {
      final catalog = await CloudyCatalog.load();

      expect(catalog.lessonsForLevel('A1').length, 24);
      expect(catalog.lessonsForLevel('A2').length, 24);
      expect(catalog.lessonsForLevel('B1').length, 6);
      expect(catalog.lessonsForLevel('B2').length, 6);
      expect(catalog.lessonAt(-1), isNull);
      expect(catalog.lessonAt(60), isNull);
    });
  });
}
