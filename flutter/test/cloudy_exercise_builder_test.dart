import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_exercise_builder.dart';

void main() {
  group('Cloudy exercise builder parity', () {
    test('uses the exact A1 and A2 lesson index lists', () {
      expect(cloudyLevelLessons('A1'), [
        0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29,
        30, 31, 32, 33, 34, 35, 36, 37, 38, 54, 55, 56,
      ]);
      expect(cloudyLevelLessons('A2'), [
        6, 7, 8, 15, 16, 17, 39, 40, 41, 42, 43, 44,
        45, 46, 47, 48, 49, 50, 51, 52, 53, 57, 58, 59,
      ]);
      expect(isCloudyLessonInLevel(56, 'A1'), isTrue);
      expect(isCloudyLessonInLevel(6, 'A1'), isFalse);
    });

    test('generates choice, listening, matching, builder and pronunciation cards', () {
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

      final builder = withMic.whereType<CloudyBuilderExercise>().single;
      expect(builder.question, 'Я пью воду');
      expect(builder.answer, 'I drink water');
      expect(builder.options, containsAll(['I', 'drink', 'water']));
      final correctIndices = ['I', 'drink', 'water']
          .map(builder.options.indexOf)
          .toList(growable: false);
      expect(correctIndices.every((index) => index >= 0), isTrue);
      expect(isCloudyAnswerCorrect(builder, builtOptionIndices: correctIndices), isTrue);
    });

    test('uses the exact fixed labels of the current browser runtime', () {
      final listening = cloudyChoiceQuestion(
        'son', 'сын', 2,
        const [CloudyPair('son', 'сын'), CloudyPair('sun', 'солнце')],
        random: () => 0.25,
      ) as CloudyListeningExercise;
      final russianToEnglish = cloudyChoiceQuestion(
        'son', 'сын', 0,
        const [CloudyPair('son', 'сын'), CloudyPair('sun', 'солнце')],
        random: () => 0.25,
      ) as CloudyChoiceExercise;
      final englishToRussian = cloudyChoiceQuestion(
        'son', 'сын', 1,
        const [CloudyPair('son', 'сын'), CloudyPair('sun', 'солнце')],
        random: () => 0.25,
      ) as CloudyChoiceExercise;

      expect(listening.title, 'Что вы слышите?');
      expect(russianToEnglish.title, 'Переведите на английский');
      expect(englishToRussian.title, 'Что это значит?');
      expect(
        isCloudyAnswerCorrect(
          listening,
          selectedOption: listening.options.indexOf('son'),
        ),
        isTrue,
      );
      expect(
        isCloudyAnswerCorrect(
          russianToEnglish,
          selectedOption: russianToEnglish.options.indexOf('sun'),
        ),
        isFalse,
      );
    });

    test('normalizes typed recall answers like the current app', () {
      expect(checkCloudyRecallAnswer('  HELLO!!  ', 'hello'), isTrue);
      expect(checkCloudyRecallAnswer('hello   world', 'hello world'), isTrue);
      expect(checkCloudyRecallAnswer('hello there', 'hello'), isFalse);
    });

    test('preserves grammar, vocabulary, guided tasks and recall stage order', () {
      final sequence = buildCloudyLessonSequence(
        lessonIndex: 24,
        lesson: const CloudyLesson(
          title: 'Глаголы',
          words: [CloudyPair('want', 'хотеть'), CloudyPair('go', 'идти')],
          sentences: [CloudyPair('I want water.', 'Я хочу воды.')],
        ),
        level: 'A1',
        vocabularyPool: const [
          CloudyPair('want', 'хотеть'),
          CloudyPair('go', 'идти'),
          CloudyPair('water', 'вода'),
        ],
        microphoneEnabled: false,
        speechRecognitionAvailable: false,
        grammarIntro: const CloudyTheoryExercise(
          title: 'Глаголы действия',
          body: 'Правило',
          examples: [CloudyPair('I want water.', 'Я хочу воды.')],
          tip: 'Запомни',
          level: 'A1',
        ),
        random: () => 0.25,
      );

      expect(sequence.first.kind, 't');
      expect(sequence[1].kind, 'v');
      expect(sequence[2].kind, 'b');
      expect(sequence[3].kind, 'b');
      expect(sequence[4].kind, 'r');
      expect(sequence[5].kind, 'r');
    });

    test('returns no matching card for an empty vocabulary lesson', () {
      final exercises = buildCloudyExercises(
        const CloudyLesson(title: 'Пусто', words: [], sentences: []),
        const [],
        microphoneEnabled: false,
        random: () => 0.25,
      );
      expect(exercises, isEmpty);
    });
  });
}
