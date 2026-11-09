import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_curriculum.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_exercise_factory.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy exercise generation parity', () {
    late CloudyCurriculum curriculum;

    setUpAll(() async {
      curriculum = await CloudyCurriculum.load();
    });

    test('keeps the existing A1 intro, vocabulary, guided tasks, recall and practice order', () {
      final levelWords = curriculum.lessonIndicesForLevel('A1')
          .expand((index) => curriculum.lesson(index)!.vocabulary)
          .toList(growable: false);
      final exercises = CloudyExerciseFactory.buildLessonSequence(
        curriculum: curriculum,
        lessonIndex: 24,
        levelVocabulary: levelWords,
        microphoneEnabled: false,
        speechRecognitionSupported: false,
        random: Random(7),
      );

      expect(exercises.first, isA<CloudyTheoryExercise>());
      expect(exercises[1], isA<CloudyVocabularyExercise>());
      expect(exercises.whereType<CloudyBuilderExercise>().where((e) => e.skillId != null), hasLength(2));
      expect(exercises.whereType<CloudyRecallExercise>(), hasLength(3));
      expect(exercises.whereType<CloudyMatchingExercise>(), hasLength(1));
    });

    test('adds pronunciation only when both the setting and platform support it', () {
      final words = curriculum.lessonIndicesForLevel('A1')
          .expand((index) => curriculum.lesson(index)!.vocabulary)
          .toList(growable: false);
      final enabled = CloudyExerciseFactory.buildLessonSequence(
        curriculum: curriculum, lessonIndex: 0, levelVocabulary: words,
        microphoneEnabled: true, speechRecognitionSupported: true,
        random: Random(11),
      );
      final disabled = CloudyExerciseFactory.buildLessonSequence(
        curriculum: curriculum, lessonIndex: 0, levelVocabulary: words,
        microphoneEnabled: false, speechRecognitionSupported: true,
        random: Random(11),
      );
      expect(enabled.whereType<CloudyPronunciationExercise>(), hasLength(1));
      expect(disabled.whereType<CloudyPronunciationExercise>(), isEmpty);
    });

    test('keeps all original sentence tokens in sentence-builder answer options', () {
      final words = curriculum.lessonIndicesForLevel('A2')
          .expand((index) => curriculum.lesson(index)!.vocabulary)
          .toList(growable: false);
      final exercises = CloudyExerciseFactory.buildLessonSequence(
        curriculum: curriculum, lessonIndex: 57, levelVocabulary: words,
        microphoneEnabled: false, speechRecognitionSupported: false,
        random: Random(3),
      );
      for (final builder in exercises.whereType<CloudyBuilderExercise>()) {
        for (final token in builder.answer.split(' ')) {
          expect(builder.options, contains(token));
        }
      }
    });
  });
}
