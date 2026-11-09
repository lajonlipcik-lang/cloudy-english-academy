import 'dart:math' as math;

import 'cloudy_exercise.dart';

typedef CloudyRand = double Function();

class CloudyLesson {
  const CloudyLesson({required this.title, required this.words, required this.sentences});
  final String title;
  final List<CloudyPair> words;
  final List<CloudyPair> sentences;
}

const Map<String, List<int>> cloudyLessonsByLevel = {
  'A1': [0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 54, 55, 56],
  'A2': [6, 7, 8, 15, 16, 17, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 57, 58, 59],
  'B1': [9, 10, 11, 18, 19, 20],
  'B2': [12, 13, 14, 21, 22, 23],
};

bool isCloudyLessonInLevel(int index, String level) =>
    index >= 0 && (cloudyLessonsByLevel[level]?.contains(index) ?? false);

List<int> cloudyLevelLessons(String level) =>
    List.unmodifiable(cloudyLessonsByLevel[level] ?? const <int>[]);

int _clampInt(num value, int min, int max) =>
    (value.isFinite ? value.toInt() : min).clamp(min, max).toInt();

List<T> cloudyShuffle<T>(List<T> input, {CloudyRand? random}) {
  final result = List<T>.of(input);
  final rand = random ?? math.Random().nextDouble;
  for (var i = result.length - 1; i > 0; i--) {
    final j = (rand() * (i + 1)).floor();
    final value = result[i];
    result[i] = result[j];
    result[j] = value;
  }
  return result;
}

String _randomTitle(List<String> titles, CloudyRand random) =>
    titles[(random() * titles.length).floor()];

CloudyExercise cloudyChoiceQuestion(
  String english, String russian, int mode, List<CloudyPair> pool, {CloudyRand? random}
) {
  final rand = random ?? math.Random().nextDouble;
  final distractors = cloudyShuffle(
    pool.where((pair) => pair.first != english).toList(), random: rand,
  ).take(3);
  final options = cloudyShuffle<CloudyPair>(
    [CloudyPair(english, russian), ...distractors], random: rand,
  );

  if (mode == 2) {
    return CloudyListeningExercise(
      answer: english,
      english: english,
      options: options.map((pair) => pair.first).toList(),
      title: 'Что вы слышите?',
    );
  }
  return CloudyChoiceExercise(
    question: mode != 0 ? english : russian,
    answer: mode != 0 ? russian : english,
    english: english,
    speak: mode != 0,
    options: options.map((pair) => mode != 0 ? pair.second : pair.first).toList(),
    title: mode != 0 ? 'Что это значит?' : 'Переведите на английский',
  );
}

String _normalizeToken(String token) => token.toLowerCase().replaceAll(
  RegExp(r"^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$", unicode: true), '',
);

CloudyExercise _cloudyPracticeChoiceQuestion(
  String english,
  String russian,
  int mode,
  List<CloudyPair> pool,
  CloudyRand random,
) {
  const listeningTitles = [
    'Что вы услышали?',
    'Прослушайте и выберите слово',
    'Какое слово произнесено?',
  ];
  const englishTitles = [
    'Что это значит?',
    'Выберите перевод слова',
    'Как переводится это слово?',
  ];
  const russianTitles = [
    'Переведите на английский',
    'Как сказать это по-английски?',
    'Выберите английский перевод',
  ];

  final exercise = cloudyChoiceQuestion(
    english, russian, mode, pool, random: random,
  );
  if (exercise is CloudyListeningExercise) {
    return CloudyListeningExercise(
      answer: exercise.answer,
      english: exercise.english,
      options: exercise.options,
      title: _randomTitle(listeningTitles, random),
    );
  }
  final choice = exercise as CloudyChoiceExercise;
  return CloudyChoiceExercise(
    question: choice.question,
    answer: choice.answer,
    english: choice.english,
    speak: choice.speak,
    options: choice.options,
    title: _randomTitle(
      mode == 0 ? russianTitles : englishTitles,
      random,
    ),
  );
}

List<CloudyExercise> buildCloudyExercises(
  CloudyLesson lesson, List<CloudyPair> pool, {
  required bool microphoneEnabled, CloudyRand? random,
}) {
  final rand = random ?? math.Random().nextDouble;
  final output = <CloudyExercise>[];

  for (var index = 0; index < lesson.words.length; index++) {
    final pair = lesson.words[index];
    output.add(_cloudyPracticeChoiceQuestion(pair.first, pair.second, index % 3, pool, rand));
  }

  final matching = cloudyShuffle(lesson.words, random: rand).take(4).toList();
  if (matching.isNotEmpty) {
    output.add(CloudyMatchingExercise(
      left: cloudyShuffle(matching.map((pair) => CloudyPair(pair.first, pair.first)).toList(), random: rand),
      right: cloudyShuffle(matching.map((pair) => CloudyPair(pair.second, pair.first)).toList(), random: rand),
      title: 'Найдите пары',
    ));
  }

  const bankTitles = [
    'Составьте предложение на английском',
    'Переведите фразу на английский',
    'Соберите правильный перевод',
  ];
  for (var sentenceIndex = 0; sentenceIndex < lesson.sentences.length; sentenceIndex++) {
    final sentence = lesson.sentences[sentenceIndex];
    final correctTokens = sentence.first.split(' ');
    final used = correctTokens.map(_normalizeToken).where((token) => token.isNotEmpty).toSet();
    final candidates = <String>[
      ...lesson.words.map((pair) => pair.first).where((word) => !word.contains(RegExp(r'\s'))),
      ...lesson.sentences.asMap().entries
          .where((entry) => entry.key != sentenceIndex)
          .expand((entry) => entry.value.first.split(' ')),
    ].where((token) {
      final normalized = _normalizeToken(token);
      final clean = token.replaceAll(
        RegExp(r"^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$", unicode: true), '',
      );
      return token.isNotEmpty && normalized.isNotEmpty && token == clean &&
          !used.contains(normalized) && !RegExp(r'[.,!?]').hasMatch(token);
    }).toList();

    final unique = <String>[];
    final seen = <String>{};
    for (final token in candidates) {
      if (seen.add(_normalizeToken(token))) unique.add(token);
    }
    output.add(CloudyBuilderExercise(
      question: sentence.second,
      answer: sentence.first,
      options: cloudyShuffle([...correctTokens, ...unique.take(2)], random: rand),
      title: _randomTitle(bankTitles, rand),
    ));
  }

  if (microphoneEnabled && lesson.words.isNotEmpty) {
    final pronunciation = cloudyShuffle(lesson.words, random: rand).first;
    output.add(CloudyPronunciationExercise(english: pronunciation.first));
  }
  return cloudyShuffle(output, random: rand);
}

const Map<int, List<CloudyBuilderExercise>> _guidedVerbPath = {
  24: [
    CloudyBuilderExercise(question: 'Я хочу воды.', answer: 'I want water.', options: ['I', 'want', 'water.', 'We', 'go', 'home'], title: 'Собери предложение', skillId: 'grammar:verbs:action'),
    CloudyBuilderExercise(question: 'Мы идём домой.', answer: 'We go home.', options: ['We', 'go', 'home.', 'I', 'want', 'water.'], title: 'Собери предложение', skillId: 'grammar:verbs:action'),
  ],
  25: [
    CloudyBuilderExercise(question: 'Я просыпаюсь рано.', answer: 'I wake up early.', options: ['I', 'wake', 'up', 'early.', 'She', 'wakes'], title: 'Собери предложение', skillId: 'grammar:present-simple:base'),
    CloudyBuilderExercise(question: 'Они изучают английский.', answer: 'They study English.', options: ['They', 'study', 'English.', 'He', 'studies', 'I'], title: 'Собери предложение', skillId: 'grammar:present-simple:base'),
  ],
  26: [
    CloudyBuilderExercise(question: 'Она любит чай.', answer: 'She likes tea.', options: ['She', 'likes', 'tea.', 'I', 'like', 'coffee.'], title: 'Собери предложение', skillId: 'grammar:present-simple:third-person'),
    CloudyBuilderExercise(question: 'Он работает каждый день.', answer: 'He works every day.', options: ['He', 'works', 'every', 'day.', 'They', 'work'], title: 'Собери предложение', skillId: 'grammar:present-simple:third-person'),
  ],
  27: [
    CloudyBuilderExercise(question: 'Ты говоришь по-английски?', answer: 'Do you speak English?', options: ['Do', 'you', 'speak', 'English?', 'Does', 'she', 'speaks'], title: 'Собери предложение', skillId: 'grammar:present-simple:questions'),
    CloudyBuilderExercise(question: 'Она работает здесь?', answer: 'Does she work here?', options: ['Does', 'she', 'work', 'here?', 'Do', 'works', 'they'], title: 'Собери предложение', skillId: 'grammar:present-simple:questions'),
  ],
  28: [
    CloudyBuilderExercise(question: 'Я не знаю.', answer: "I don't know.", options: ['I', "don't", 'know.', 'He', "doesn't", 'knows'], title: 'Собери предложение', skillId: 'grammar:present-simple:negatives'),
    CloudyBuilderExercise(question: 'Он не любит кофе.', answer: "He doesn't like coffee.", options: ['He', "doesn't", 'like', 'coffee.', 'I', "don't", 'likes'], title: 'Собери предложение', skillId: 'grammar:present-simple:negatives'),
  ],
  29: [
    CloudyBuilderExercise(question: 'Она читает книгу дома.', answer: 'She reads a book at home.', options: ['She', 'reads', 'a', 'book', 'at', 'home.', 'I', 'read'], title: 'Собери предложение', skillId: 'grammar:sentence-order'),
    CloudyBuilderExercise(question: 'Мы изучаем английский каждый день.', answer: 'We study English every day.', options: ['We', 'study', 'English', 'every', 'day.', 'She', 'studies'], title: 'Собери предложение', skillId: 'grammar:sentence-order'),
  ],
  54: [
    CloudyBuilderExercise(question: 'Где ты живёшь?', answer: 'Where do you live?', options: ['Where', 'do', 'you', 'live?', 'I', 'am', 'home.'], title: 'Собери предложение', skillId: 'grammar:wh-questions'),
    CloudyBuilderExercise(question: 'Когда начинается урок?', answer: 'When does the lesson start?', options: ['When', 'does', 'the', 'lesson', 'start?', 'Where', 'do', 'you'], title: 'Собери предложение', skillId: 'grammar:wh-questions'),
  ],
  55: [
    CloudyBuilderExercise(question: 'Это сумка Анны.', answer: "This is Anna's bag.", options: ['This', 'is', "Anna's", 'bag.', 'That', 'are', 'mine'], title: 'Собери предложение', skillId: 'grammar:possessive-pronouns'),
    CloudyBuilderExercise(question: 'Этот зонт мой.', answer: 'This umbrella is mine.', options: ['This', 'umbrella', 'is', 'mine.', 'That', 'are', 'yours'], title: 'Собери предложение', skillId: 'grammar:possessive-pronouns'),
  ],
  56: [
    CloudyBuilderExercise(question: 'Закрой дверь, пожалуйста.', answer: 'Close the door, please.', options: ['Close', 'the', 'door,', 'please.', "Don't", 'closes', 'it'], title: 'Собери предложение', skillId: 'grammar:imperatives'),
    CloudyBuilderExercise(question: 'Давай начнём урок.', answer: "Let's start the lesson.", options: ["Let's", 'start', 'the', 'lesson.', 'We', 'starts', 'home.'], title: 'Собери предложение', skillId: 'grammar:imperatives'),
  ],
  57: [
    CloudyBuilderExercise(question: 'Вчера я нашёл ключи.', answer: 'I found my keys yesterday.', options: ['I', 'found', 'my', 'keys', 'yesterday.', 'find', 'did', 'tomorrow'], title: 'Собери предложение', skillId: 'grammar:past-simple-irregular'),
    CloudyBuilderExercise(question: 'Она поехала домой на автобусе.', answer: 'She went home by bus.', options: ['She', 'went', 'home', 'by', 'bus.', 'go', 'goes', 'yesterday'], title: 'Собери предложение', skillId: 'grammar:past-simple-irregular'),
  ],
  58: [
    CloudyBuilderExercise(question: 'Тебе нельзя здесь парковаться.', answer: "You mustn't park here.", options: ['You', "mustn't", 'park', 'here.', 'must', "don't", 'parking'], title: 'Собери предложение', skillId: 'grammar:modals-obligation'),
    CloudyBuilderExercise(question: 'Нам не нужно работать в воскресенье.', answer: "We don't have to work on Sunday.", options: ['We', "don't", 'have', 'to', 'work', 'on', 'Sunday.', 'must', 'has', 'working'], title: 'Собери предложение', skillId: 'grammar:modals-obligation'),
  ],
  59: [
    CloudyBuilderExercise(question: 'Если пойдёт дождь, мы останемся дома.', answer: "If it rains, we'll stay home.", options: ['If', 'it', 'rains,', "we'll", 'stay', 'home.', 'will', 'stays', 'tomorrow'], title: 'Собери предложение', skillId: 'grammar:first-conditional'),
    CloudyBuilderExercise(question: 'Если поторопишься, успеешь на автобус.', answer: "If you hurry, you'll catch the bus.", options: ['If', 'you', 'hurry,', "you'll", 'catch', 'the', 'bus.', 'will', 'catches', 'late'], title: 'Собери предложение', skillId: 'grammar:first-conditional'),
  ],
};

List<CloudyExercise> guidedCloudyExercises(int lessonIndex, {CloudyRand? random}) {
  final rand = random ?? math.Random().nextDouble;
  return (_guidedVerbPath[lessonIndex] ?? const <CloudyBuilderExercise>[])
      .map((exercise) => CloudyBuilderExercise(
        question: exercise.question,
        answer: exercise.answer,
        options: cloudyShuffle(exercise.options, random: rand),
        title: exercise.title,
        skillId: exercise.skillId,
      ))
      .toList(growable: false);
}

List<CloudyExercise> buildCloudyLessonSequence({
  required int lessonIndex,
  required CloudyLesson lesson,
  required String level,
  required List<CloudyPair> vocabularyPool,
  required bool microphoneEnabled,
  required bool speechRecognitionAvailable,
  CloudyTheoryExercise? grammarIntro,
  CloudyRand? random,
}) {
  final rand = random ?? math.Random().nextDouble;
  final result = <CloudyExercise>[];
  if (grammarIntro != null) result.add(grammarIntro);
  result.add(CloudyVocabularyExercise(words: lesson.words));
  result.addAll(guidedCloudyExercises(lessonIndex, random: rand));
  final recall = cloudyShuffle(lesson.words, random: rand)
      .take(lesson.words.length < 3 ? lesson.words.length : 3)
      .map((pair) => CloudyRecallExercise(
        question: pair.second,
        answer: pair.first,
        english: pair.first,
        title: 'Вспомни слово без подсказок',
      ));
  result.addAll(recall);
  final practice = buildCloudyExercises(
    lesson,
    vocabularyPool,
    microphoneEnabled: microphoneEnabled && speechRecognitionAvailable,
    random: rand,
  );
  result.addAll(practice);
  return result;
}

bool checkCloudyRecallAnswer(String input, String expected) {
  final normalized = input.trim().toLowerCase()
      .replaceAll(RegExp(r'[.!?]+$'), '')
      .replaceAll(RegExp(r'\s+'), ' ');
  return normalized == expected.toLowerCase();
}
