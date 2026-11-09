import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';

void main() {
  group('Cloudy exercise JSON compatibility', () {
    final examples = <Map<String, Object?>>[
      {'k': 'c', 'q': 'привет', 'a': 'hello', 'en': 'hello', 'spk': false, 'o': ['hello', 'goodbye'], 'title': 'Переведите на английский'},
      {'k': 'l', 'a': 'hello', 'en': 'hello', 'o': ['hello', 'goodbye'], 'title': 'Что вы слышите?'},
      {'k': 'b', 'q': 'Привет, мир', 'a': 'Hello world', 'o': ['Hello', 'world'], 'title': 'Переведите на английский'},
      {'k': 'm', 'L': [['hello', 'hello'], ['world', 'world']], 'R': [['мир', 'world'], ['привет', 'hello']]},
      {'k': 'p', 'en': 'hello'},
      {'k': 'r', 'q': 'привет', 'a': 'hello', 'en': 'hello', 'title': 'Вспомни слово без подсказок'},
    ];

    test('round-trips all exercise types without changing their wire keys', () {
      for (final source in examples) {
        final exercise = CloudyExercise.fromJson(source);
        expect(exercise.toJson(), source);
      }
    });

    test('retains the distinction between spoken and non-spoken choice tasks', () {
      final spoken = CloudyExercise.fromJson(examples.first) as CloudyChoiceExercise;
      expect(spoken.speak, isFalse);
      final listening = CloudyExercise.fromJson(examples[1]) as CloudyListeningExercise;
      expect(listening.kind, 'l');
      expect(listening.english, 'hello');
    });

    test('rejects unknown exercise variants instead of silently dropping them', () {
      expect(
        () => CloudyExercise.fromJson({'k': 'unknown'}),
        throwsFormatException,
      );
    });
  });
}
