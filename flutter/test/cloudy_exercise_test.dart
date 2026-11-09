import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';

void main() {
  group('Cloudy exercise JSON compatibility', () {
    final examples = <Map<String, Object?>>[
      {'k': 'c', 'q': 'привет', 'a': 'hello', 'en': 'hello', 'spk': false, 'o': ['hello', 'goodbye'], 'title': 'Переведите на английский'},
      {'k': 'l', 'a': 'hello', 'en': 'hello', 'o': ['hello', 'goodbye'], 'title': 'Что вы слышите?'},
      {'k': 'b', 'q': 'Привет, мир', 'a': 'Hello world', 'o': ['Hello', 'world'], 'title': 'Переведите на английский', 'skillId': 'grammar:sentence-order'},
      {'k': 'm', 'L': [['hello', 'hello'], ['world', 'world']], 'R': [['мир', 'world'], ['привет', 'hello']], 'title': 'Найдите пары'},
      {'k': 'p', 'en': 'hello'},
      {'k': 'r', 'q': 'привет', 'a': 'hello', 'en': 'hello', 'title': 'Вспомни слово без подсказок'},
      {'k': 'v', 'words': [['hello', 'привет'], ['friend', 'друг']]},
      {'k': 't', 'title': 'Глагол to be', 'body': 'Используй am, is или are.', 'examples': [['I am Anna.', 'Я Анна.']], 'tip': 'I am · she is · they are', 'level': 'A1'},
    ];

    test('round-trips all eight exercise and study-card types', () {
      for (final source in examples) {
        final exercise = CloudyExercise.fromJson(source);
        expect(exercise.toJson(), source);
      }
    });

    test('retains the distinction between choice and listening tasks', () {
      final choice = CloudyExercise.fromJson(examples.first) as CloudyChoiceExercise;
      expect(choice.speak, isFalse);
      final listening = CloudyExercise.fromJson(examples[1]) as CloudyListeningExercise;
      expect(listening.kind, 'l');
      expect(listening.english, 'hello');
    });

    test('retains guided grammar skill identifiers', () {
      final guided = CloudyExercise.fromJson(examples[2]) as CloudyBuilderExercise;
      expect(guided.skillId, 'grammar:sentence-order');
    });

    test('rejects unknown exercise variants instead of silently dropping them', () {
      expect(() => CloudyExercise.fromJson({'k': 'unknown'}), throwsFormatException);
    });
  });
}
