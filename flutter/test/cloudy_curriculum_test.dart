import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_curriculum.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy curriculum parity', () {
    late CloudyCurriculum curriculum;

    setUpAll(() async {
      curriculum = await CloudyCurriculum.load();
    });

    test('loads the complete existing catalog without dropping lessons', () {
      expect(curriculum.lessons, hasLength(60));
      expect(curriculum.lesson(0)?.title, 'Привет');
      expect(curriculum.lesson(59)?.title, 'Если случится...');
      expect(curriculum.foundations, hasLength(27));
    });

    test('preserves the exact CEFR lesson paths', () {
      expect(curriculum.lessonIndicesForLevel('A1'), hasLength(24));
      expect(curriculum.lessonIndicesForLevel('A2'), hasLength(24));
      expect(curriculum.lessonIndicesForLevel('B1'), hasLength(6));
      expect(curriculum.lessonIndicesForLevel('B2'), hasLength(6));
      expect(curriculum.lessonIndicesForLevel('A1').take(3), [0, 1, 2]);
      expect(curriculum.lessonIndicesForLevel('A1').skip(6).take(3), [24, 25, 26]);
      expect(curriculum.lessonIndicesForLevel('A2').take(3), [6, 7, 8]);
      expect(curriculum.lessonIndicesForLevel('A2').skip(21).take(3), [57, 58, 59]);
    });

    test('keeps original vocabulary and bilingual sentence content', () {
      final first = curriculum.lesson(0)!;
      expect(first.vocabulary.first.first, 'hello');
      expect(first.vocabulary.first.second, 'привет');
      expect(first.sentences.first.russian, 'Привет, меня зовут Анна.');
      expect(first.sentences.first.english, 'Hello, my name is Anna.');
      expect(first.vocabulary.length, greaterThanOrEqualTo(10));
      expect(first.sentences.length, greaterThanOrEqualTo(6));
    });

    test('preserves section names and grammar foundation examples', () {
      expect(curriculum.sectionsForLevel('A1').first.name, 'Знакомство');
      expect(curriculum.foundation(54)?.title, 'Wh-вопросы: узнаём важную информацию');
      expect(
        curriculum.foundation(54)?.examples.any((pair) => pair.first == 'Where do you live?'),
        isTrue,
      );
      expect(curriculum.foundation(57)?.level, 'A2');
    });
  });
}
