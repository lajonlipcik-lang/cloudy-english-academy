import 'dart:math';

import 'cloudy_curriculum.dart';
import 'cloudy_exercise.dart';

class CloudyExerciseFactory {
  const CloudyExerciseFactory._();

  static const _russianTitles = [
    'Переведите на английский',
    'Как сказать это по-английски?',
    'Выберите английский перевод',
  ];
  static const _englishTitles = [
    'Что это значит?',
    'Выберите перевод слова',
    'Как переводится это слово?',
  ];
  static const _listeningTitles = [
    'Что вы услышали?',
    'Прослушайте и выберите слово',
    'Какое слово произнесено?',
  ];
  static const _builderTitles = [
    'Составьте предложение на английском',
    'Переведите фразу на английский',
    'Соберите правильный перевод',
  ];

  static List<T> _shuffle<T>(Iterable<T> source, Random random) {
    final result = source.toList();
    for (var i = result.length - 1; i > 0; i--) {
      final j = random.nextInt(i + 1);
      final current = result[i];
      result[i] = result[j];
      result[j] = current;
    }
    return result;
  }

  static String _pick(List<String> values, Random random) =>
      values[random.nextInt(values.length)];

  static CloudyChoiceExercise _choice(
    String english,
    String russian,
    int mode,
    List<CloudyPair> pool,
    Random random,
  ) {
    final options = _shuffle<CloudyPair>([
      CloudyPair(english, russian),
      ..._shuffle(
        pool.where((pair) => pair.first != english),
        random,
      ).take(3),
    ], random);

    if (mode == 2) {
      return CloudyChoiceExercise(
        question: '', answer: english, english: english, speak: false,
        options: options.map((pair) => pair.first).toList(growable: false),
        title: _pick(_listeningTitles, random),
      );
    }

    return CloudyChoiceExercise(
      question: mode == 1 ? english : russian,
      answer: mode == 1 ? russian : english,
      english: english,
      speak: mode == 1,
      options: options.map((pair) => mode == 1 ? pair.second : pair.first).toList(growable: false),
      title: _pick(mode == 1 ? _englishTitles : _russianTitles, random),
    );
  }

  static String _normalizeToken(String value) => value.toLowerCase().replaceAll(
    RegExp(r"^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$", unicode: true),
    '',
  );

  static List<CloudyExercise> _practice(
    CloudyLesson lesson,
    List<CloudyPair> pool, {
    required bool microphoneEnabled,
    required bool speechRecognitionSupported,
    required Random random,
  }) {
    final result = <CloudyExercise>[];
    for (var index = 0; index < lesson.vocabulary.length; index++) {
      final pair = lesson.vocabulary[index];
      result.add(_choice(pair.first, pair.second, index % 3, pool, random));
    }

    final matchingPairs = _shuffle(lesson.vocabulary, random).take(4).toList();
    result.add(CloudyMatchingExercise(
      left: _shuffle(
        matchingPairs.map((pair) => CloudyPair(pair.first, pair.first)),
        random,
      ),
      right: _shuffle(
        matchingPairs.map((pair) => CloudyPair(pair.second, pair.first)),
        random,
      ),
      title: 'Найдите пары',
    ));

    for (var sentenceIndex = 0; sentenceIndex < lesson.sentences.length; sentenceIndex++) {
      final sentence = lesson.sentences[sentenceIndex];
      final correctTokens = sentence.english.split(' ');
      final used = correctTokens.map(_normalizeToken).where((token) => token.isNotEmpty).toSet();
      final candidates = <String>[
        ...lesson.vocabulary.map((pair) => pair.first).where((word) => !word.contains(RegExp(r'\s'))),
        for (var otherIndex = 0; otherIndex < lesson.sentences.length; otherIndex++)
          if (otherIndex != sentenceIndex)
            ...lesson.sentences[otherIndex].english.split(' '),
      ];

      final unique = <String, String>{};
      for (final token in candidates) {
        final normalized = _normalizeToken(token);
        final unpunctuated = token.replaceAll(
          RegExp(r"^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$", unicode: true),
          '',
        );
        if (token.isNotEmpty &&
            normalized.isNotEmpty &&
            token == unpunctuated &&
            !used.contains(normalized) &&
            !RegExp(r'[.,!?]').hasMatch(token)) {
          unique.putIfAbsent(normalized, () => token);
        }
      }
      final distractors = unique.values.take(2);
      result.add(CloudyBuilderExercise(
        question: sentence.russian,
        answer: sentence.english,
        options: _shuffle([...correctTokens, ...distractors], random),
        title: _pick(_builderTitles, random),
      ));
    }

    if (lesson.vocabulary.isNotEmpty && microphoneEnabled && speechRecognitionSupported) {
      final word = _shuffle(lesson.vocabulary, random).first.first;
      result.add(CloudyPronunciationExercise(english: word));
    }
    return _shuffle(result, random);
  }

  static List<CloudyExercise> buildLessonSequence({
    required CloudyCurriculum curriculum,
    required int lessonIndex,
    required List<CloudyPair> levelVocabulary,
    required bool microphoneEnabled,
    required bool speechRecognitionSupported,
    Random? random,
  }) {
    final rng = random ?? Random();
    final lesson = curriculum.lesson(lessonIndex);
    if (lesson == null) throw RangeError.index(lessonIndex, curriculum.lessons);

    final result = <CloudyExercise>[];
    final theory = curriculum.foundation(lessonIndex);
    if (theory != null) {
      result.add(CloudyTheoryExercise(
        title: theory.title, body: theory.body, examples: theory.examples,
        tip: theory.tip, level: theory.level,
      ));
    }
    result.add(CloudyVocabularyExercise(words: lesson.vocabulary));
    result.addAll(_guided(lessonIndex, rng));

    for (final pair in _shuffle(lesson.vocabulary, rng).take(min(3, lesson.vocabulary.length))) {
      result.add(CloudyRecallExercise(
        question: pair.second, answer: pair.first, english: pair.first,
        title: 'Вспомни слово без подсказок',
      ));
    }

    result.addAll(_practice(
      lesson, levelVocabulary,
      microphoneEnabled: microphoneEnabled,
      speechRecognitionSupported: speechRecognitionSupported,
      random: rng,
    ));
    return result;
  }

  static List<CloudyExercise> _guided(int lessonIndex, Random random) {
    const source = <int, List<(String, String, List<String>, String)>>{
      24: [
        ('Я хочу воды.', 'I want water.', ['I', 'want', 'water.', 'We', 'go', 'home'], 'grammar:verbs:action'),
        ('Мы идём домой.', 'We go home.', ['We', 'go', 'home.', 'I', 'want', 'water.'], 'grammar:verbs:action'),
      ],
      25: [
        ('Я просыпаюсь рано.', 'I wake up early.', ['I', 'wake', 'up', 'early.', 'She', 'wakes'], 'grammar:present-simple:base'),
        ('Они изучают английский.', 'They study English.', ['They', 'study', 'English.', 'He', 'studies', 'I'], 'grammar:present-simple:base'),
      ],
      26: [
        ('Она любит чай.', 'She likes tea.', ['She', 'likes', 'tea.', 'I', 'like', 'coffee.'], 'grammar:present-simple:third-person'),
        ('Он работает каждый день.', 'He works every day.', ['He', 'works', 'every', 'day.', 'They', 'work'], 'grammar:present-simple:third-person'),
      ],
      27: [
        ('Ты говоришь по-английски?', 'Do you speak English?', ['Do', 'you', 'speak', 'English?', 'Does', 'she', 'speaks'], 'grammar:present-simple:questions'),
        ('Она работает здесь?', 'Does she work here?', ['Does', 'she', 'work', 'here?', 'Do', 'works', 'they'], 'grammar:present-simple:questions'),
      ],
      28: [
        ('Я не знаю.', "I don't know.", ['I', "don't", 'know.', 'He', "doesn't", 'knows'], 'grammar:present-simple:negatives'),
        ('Он не любит кофе.', "He doesn't like coffee.", ['He', "doesn't", 'like', 'coffee.', 'I', "don't", 'likes'], 'grammar:present-simple:negatives'),
      ],
      29: [
        ('Она читает книгу дома.', 'She reads a book at home.', ['She', 'reads', 'a', 'book', 'at', 'home.', 'I', 'read'], 'grammar:sentence-order'),
        ('Мы изучаем английский каждый день.', 'We study English every day.', ['We', 'study', 'English', 'every', 'day.', 'She', 'studies'], 'grammar:sentence-order'),
      ],
      54: [
        ('Где ты живёшь?', 'Where do you live?', ['Where', 'do', 'you', 'live?', 'I', 'am', 'home.'], 'grammar:wh-questions'),
        ('Когда начинается урок?', 'When does the lesson start?', ['When', 'does', 'the', 'lesson', 'start?', 'Where', 'do', 'you'], 'grammar:wh-questions'),
      ],
      55: [
        ('Это сумка Анны.', "This is Anna's bag.", ['This', 'is', "Anna's", 'bag.', 'That', 'are', 'mine'], 'grammar:possessive-pronouns'),
        ('Этот зонт мой.', 'This umbrella is mine.', ['This', 'umbrella', 'is', 'mine.', 'That', 'are', 'yours'], 'grammar:possessive-pronouns'),
      ],
      56: [
        ('Закрой дверь, пожалуйста.', 'Close the door, please.', ['Close', 'the', 'door,', 'please.', "Don't", 'closes', 'it'], 'grammar:imperatives'),
        ('Давай начнём урок.', "Let's start the lesson.", ["Let's", 'start', 'the', 'lesson.', 'We', 'starts', 'home.'], 'grammar:imperatives'),
      ],
      57: [
        ('Вчера я нашёл ключи.', 'I found my keys yesterday.', ['I', 'found', 'my', 'keys', 'yesterday.', 'find', 'did', 'tomorrow'], 'grammar:past-simple-irregular'),
        ('Она поехала домой на автобусе.', 'She went home by bus.', ['She', 'went', 'home', 'by', 'bus.', 'go', 'goes', 'yesterday'], 'grammar:past-simple-irregular'),
      ],
      58: [
        ('Тебе нельзя здесь парковаться.', "You mustn't park here.", ['You', "mustn't", 'park', 'here.', 'must', "don't", 'parking'], 'grammar:modals-obligation'),
        ('Нам не нужно работать в воскресенье.', "We don't have to work on Sunday.", ['We', "don't", 'have', 'to', 'work', 'on', 'Sunday.', 'must', 'has', 'working'], 'grammar:modals-obligation'),
      ],
      59: [
        ('Если пойдёт дождь, мы останемся дома.', "If it rains, we'll stay home.", ['If', 'it', 'rains,', "we'll", 'stay', 'home.', 'will', 'stays', 'tomorrow'], 'grammar:first-conditional'),
        ('Если поторопишься, успеешь на автобус.', "If you hurry, you'll catch the bus.", ['If', 'you', 'hurry,', "you'll", 'catch', 'the', 'bus.', 'will', 'catches', 'late'], 'grammar:first-conditional'),
      ],
    };
    return (source[lessonIndex] ?? const <(String, String, List<String>, String)>[])
        .map((item) => CloudyBuilderExercise(
          question: item.$1, answer: item.$2,
          options: _shuffle(item.$3, random),
          title: 'Собери предложение', skillId: item.$4,
        )).toList(growable: false);
  }
}
