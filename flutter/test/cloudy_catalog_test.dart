import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_catalog.dart';

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

      expect(firstSentence.ru, 'Привет, меня зовут Анна.');
      expect(firstSentence.en, 'Hello, my name is Anna.');
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

      expect(sequence.first.kind, CloudyExerciseKind.grammar);
      expect(sequence[1].kind, CloudyExerciseKind.vocabulary);
      expect(sequence.first.examples, isNotEmpty);
      expect(sequence[1].words, hasLength(10));
      expect(sequence.where((item) => item.kind == CloudyExerciseKind.builder).length, greaterThanOrEqualTo(2));
      expect(sequence.where((item) => item.kind == CloudyExerciseKind.recall), hasLength(3));
      expect(sequence.where((item) => item.kind == CloudyExerciseKind.pronunciation), hasLength(1));
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
      expect(sequence.where((item) => item.kind == CloudyExerciseKind.pronunciation), isEmpty);
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
