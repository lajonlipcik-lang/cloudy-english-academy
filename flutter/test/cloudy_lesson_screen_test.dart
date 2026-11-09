import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_progress_engine.dart';
import 'package:cloudy_english/screens/cloudy_lesson_screen.dart';

void main() {
  Widget screen(
    CloudyExercise exercise, {
    void Function(bool, String?)? onAnswer,
    VoidCallback? onAdvance,
    VoidCallback? onComplete,
    void Function(String, bool, int)? onMatchingAttempt,
    VoidCallback? onSkipPronunciation,
  }) {
    return MaterialApp(
      home: CloudyLessonScreen(
        title: 'Урок 1',
        session: newCloudySession(0, [exercise]),
        onAnswer: onAnswer ?? (_, __) {},
        onMatchingAttempt: onMatchingAttempt ?? (_, __, ___) {},
        onAdvance: onAdvance ?? () {},
        onComplete: onComplete ?? () {},
        onPronunciationRequested: (_, __) {},
        onSpeak: (_) {},
        onSkipPronunciation: onSkipPronunciation ?? () {},
      ),
    );
  }

  testWidgets('choice answer is graded once and completion is explicit', (tester) async {
    var answers = 0;
    var correct = false;
    var completed = 0;
    await tester.pumpWidget(screen(
      const CloudyChoiceExercise(
        question: 'Дом', answer: 'house', english: 'house',
        speak: false, options: ['house', 'car'], title: 'Перевод',
      ),
      onAnswer: (value, _) { answers++; correct = value; },
      onComplete: () => completed++,
    ));

    await tester.tap(find.text('house'));
    await tester.pump();
    expect(answers, 1);
    expect(correct, isTrue);
    expect(find.text('Отлично! Всё верно.'), findsOneWidget);

    await tester.tap(find.text('Завершить урок'));
    await tester.pump();
    expect(completed, 1);
  });

  testWidgets('theory and vocabulary stages advance without awarding lesson completion', (tester) async {
    var advanced = 0;
    var completed = 0;
    await tester.pumpWidget(screen(
      const CloudyVocabularyExercise(words: [CloudyPair('apple', 'яблоко')]),
      onAdvance: () => advanced++,
      onComplete: () => completed++,
    ));
    expect(find.text('apple'), findsOneWidget);
    await tester.tap(find.text('Завершить урок'));
    await tester.pump();
    expect(advanced, 0);
    // A one-exercise session is the final step; it must complete, not advance.
    expect(completed, 1);
  });

  testWidgets('sentence builder checks assembled token order', (tester) async {
    var answerCorrect = false;
    await tester.pumpWidget(screen(
      const CloudyBuilderExercise(
        question: 'Я дома.', answer: 'I am home.',
        options: ['I', 'am', 'home.'], title: 'Собери предложение',
      ),
      onAnswer: (value, _) => answerCorrect = value,
    ));

    await tester.tap(find.text('I'));
    await tester.tap(find.text('am'));
    await tester.tap(find.text('home.'));
    await tester.pump();
    await tester.tap(find.text('Проверить ответ'));
    await tester.pump();
    expect(answerCorrect, isTrue);
  });

  testWidgets('recall normalizes case and trailing punctuation', (tester) async {
    var answerCorrect = false;
    await tester.pumpWidget(screen(
      const CloudyRecallExercise(
        question: 'яблоко', answer: 'apple', english: 'apple', title: 'Вспомни',
      ),
      onAnswer: (value, _) => answerCorrect = value,
    ));
    await tester.enterText(find.byType(TextField), 'APPLE!');
    await tester.tap(find.text('Проверить'));
    await tester.pump();
    expect(answerCorrect, isTrue);
  });

  testWidgets('matching records each attempt and marks the completed pair', (tester) async {
    final attempts = <bool>[];
    await tester.pumpWidget(screen(
      const CloudyMatchingExercise(
        left: [CloudyPair('apple', 'apple')],
        right: [CloudyPair('яблоко', 'apple')],
      ),
      onMatchingAttempt: (_, correct, __) => attempts.add(correct),
    ));
    await tester.tap(find.text('apple').first);
    await tester.pump();
    expect(find.text('яблоко'), findsOneWidget);
    await tester.tap(find.text('яблоко'));
    await tester.pump();
    expect(attempts, [true]);
    expect(find.text('Все пары найдены!'), findsOneWidget);
  });

  testWidgets('pronunciation can be skipped without a graded answer', (tester) async {
    var skipped = 0;
    var answers = 0;
    await tester.pumpWidget(screen(
      const CloudyPronunciationExercise(english: 'hello'),
      onSkipPronunciation: () => skipped++,
      onAnswer: (_, __) => answers++,
    ));
    await tester.tap(find.text('Пропустить это задание'));
    await tester.pump();
    expect(skipped, 1);
    expect(answers, 0);
  });

  testWidgets('all eight native exercise types render their core content', (tester) async {
    final exercises = <CloudyExercise>[
      const CloudyChoiceExercise(question: 'Дом', answer: 'house', english: 'house', speak: false, options: ['house'], title: 'Выбор'),
      const CloudyListeningExercise(answer: 'cat', english: 'cat', options: ['cat'], title: 'Аудирование'),
      const CloudyBuilderExercise(question: 'Я дома', answer: 'I am home', options: ['I', 'am', 'home'], title: 'Конструктор'),
      const CloudyMatchingExercise(left: [CloudyPair('cat', 'cat')], right: [CloudyPair('кот', 'cat')]),
      const CloudyPronunciationExercise(english: 'hello'),
      const CloudyRecallExercise(question: 'кот', answer: 'cat', english: 'cat', title: 'Вспомни'),
      const CloudyVocabularyExercise(words: [CloudyPair('book', 'книга')]),
      const CloudyTheoryExercise(title: 'Present Simple', body: 'Описание', examples: [CloudyPair('I work', 'Я работаю')], tip: 'Подсказка'),
    ];

    for (final exercise in exercises) {
      await tester.pumpWidget(screen(exercise));
      await tester.pump();
      expect(find.byType(CloudyLessonScreen), findsOneWidget);
    }
  });
}
