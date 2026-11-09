import 'dart:math' as math;

import 'cloudy_state.dart';

typedef CloudyRand = double Function();

class CloudyPair {
  const CloudyPair(this.en, this.ru, {this.extra});
  final String en;
  final String ru;
  final String? extra;
}

class CloudyLesson {
  const CloudyLesson({required this.title, required this.words, required this.sentences});
  final String title;
  final List<CloudyPair> words;
  final List<CloudyPair> sentences;
}

enum CloudyExerciseKind { grammar, vocabulary, recall, choice, listening, builder, matching, pronunciation }

class CloudyExercise {
  const CloudyExercise({
    required this.kind,
    this.question = '',
    this.answer = '',
    this.english = '',
    this.speaks = false,
    this.options = const [],
    this.title = '',
    this.left = const [],
    this.right = const [],
    this.words = const [],
    this.examples = const [],
    this.body = '',
    this.tip = '',
    this.level = '',
    this.skillId = '',
  });
  final CloudyExerciseKind kind;
  final String question, answer, english, title, body, tip, level, skillId;
  final bool speaks;
  final List<String> options;
  final List<CloudyPair> left, right, words, examples;
}

class CloudySession {
  const CloudySession({
    required this.lesson,
    required this.exercises,
    this.review = false,
    this.index = 0,
    this.health = 5,
    this.combo = 0,
    this.correct = 0,
    this.total = 0,
    this.learnedMistakes = const [],
    this.retryPhase = false,
  });
  final bool review, retryPhase;
  final int lesson, index, health, combo, correct, total;
  final List<CloudyExercise> exercises;
  final List<String> learnedMistakes;

  CloudySession copyWith({
    int? lesson, List<CloudyExercise>? exercises, bool? review,
    int? index, int? health, int? combo, int? correct, int? total,
    List<String>? learnedMistakes, bool? retryPhase,
  }) => CloudySession(
    lesson: lesson ?? this.lesson,
    exercises: exercises ?? this.exercises,
    review: review ?? this.review,
    index: index ?? this.index,
    health: health ?? this.health,
    combo: combo ?? this.combo,
    correct: correct ?? this.correct,
    total: total ?? this.total,
    learnedMistakes: learnedMistakes ?? this.learnedMistakes,
    retryPhase: retryPhase ?? this.retryPhase,
  );
}

class CloudyAnswerResult {
  const CloudyAnswerResult({required this.state, required this.session});
  final CloudyState state;
  final CloudySession session;
}

class CloudyLessonResult {
  const CloudyLessonResult({required this.state, required this.gain, required this.stars, required this.accuracy});
  final CloudyState state;
  final int gain, stars, accuracy;
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

int _number(Object? value, [int fallback = 0]) =>
    value is num && value.isFinite ? value.toInt() : fallback;

int _clampInt(num value, int min, int max) =>
    (value.isFinite ? value.toInt() : min).clamp(min, max).toInt();

String cloudyDayKey(DateTime date) => '${date.year}-${date.month}-${date.day}';

String cloudyWeekKey(DateTime date) {
  final yearStart = DateTime(date.year);
  final elapsedDays = date.difference(yearStart).inMilliseconds / Duration.millisecondsPerDay;
  return '${date.year}w${((elapsedDays + yearStart.weekday % 7) / 7).floor()}';
}

String _jsDateString(DateTime date) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final local = date.toLocal();
  return '${weekdays[local.weekday - 1]} ${months[local.month - 1]} ${local.day} ${local.year}';
}

CloudyState rollCloudyDay(CloudyState state, DateTime now) {
  final today = _jsDateString(now);
  if (state.today.d == today) return state;
  return state.copyWith(today: CloudyToday(d: today));
}

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

CloudyExercise cloudyChoiceQuestion(
  String english, String russian, int mode, List<CloudyPair> pool, {CloudyRand? random}
) {
  final rand = random ?? math.Random().nextDouble;
  final distractors = cloudyShuffle(
    pool.where((pair) => pair.en != english).toList(), random: rand,
  ).take(3);
  final options = cloudyShuffle<CloudyPair>(
    [CloudyPair(english, russian), ...distractors], random: rand,
  );
  const listeningTitles = [
    'Что вы услышали?', 'Прослушайте и выберите слово', 'Какое слово произнесено?',
  ];
  const englishTitles = [
    'Что это значит?', 'Выберите перевод слова', 'Как переводится это слово?',
  ];
  const russianTitles = [
    'Переведите на английский', 'Как сказать это по-английски?', 'Выберите английский перевод',
  ];
  String chooseTitle(List<String> titles) => titles[(rand() * titles.length).floor()];
  if (mode == 2) {
    return CloudyExercise(
      kind: CloudyExerciseKind.listening, answer: english, english: english,
      options: options.map((pair) => pair.en).toList(),
      title: chooseTitle(listeningTitles),
    );
  }
  return CloudyExercise(
    kind: CloudyExerciseKind.choice,
    question: mode != 0 ? english : russian,
    answer: mode != 0 ? russian : english,
    english: english,
    speaks: mode != 0,
    options: options.map((pair) => mode != 0 ? pair.ru : pair.en).toList(),
    title: chooseTitle(mode != 0 ? englishTitles : russianTitles),
  );
}

String _normalizeToken(String token) => token.toLowerCase().replaceAll(
  RegExp(r"^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$", unicode: true), '',
);

List<CloudyExercise> buildCloudyExercises(
  CloudyLesson lesson, List<CloudyPair> pool, {
  required bool microphoneEnabled, CloudyRand? random,
}) {
  final rand = random ?? math.Random().nextDouble;
  final output = <CloudyExercise>[];
  for (var index = 0; index < lesson.words.length; index++) {
    final pair = lesson.words[index];
    output.add(cloudyChoiceQuestion(pair.en, pair.ru, index % 3, pool, random: rand));
  }

  final matching = cloudyShuffle(lesson.words, random: rand).take(4).toList();
  if (matching.isNotEmpty) {
    output.add(CloudyExercise(
      kind: CloudyExerciseKind.matching,
      left: cloudyShuffle(matching.map((p) => CloudyPair(p.en, p.en)).toList(), random: rand),
      right: cloudyShuffle(matching.map((p) => CloudyPair(p.ru, p.en)).toList(), random: rand),
      title: 'Найдите пары',
    ));
  }

  for (var sentenceIndex = 0; sentenceIndex < lesson.sentences.length; sentenceIndex++) {
    final sentence = lesson.sentences[sentenceIndex];
    final correctTokens = sentence.en.split(' ');
    final used = correctTokens.map(_normalizeToken).where((token) => token.isNotEmpty).toSet();
    final candidates = <String>[
      ...lesson.words.map((p) => p.en).where((word) => !word.contains(RegExp(r'\s'))),
      ...lesson.sentences.asMap().entries
          .where((entry) => entry.key != sentenceIndex)
          .expand((entry) => entry.value.en.split(' ')),
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
    output.add(CloudyExercise(
      kind: CloudyExerciseKind.builder,
      question: sentence.ru,
      answer: sentence.en,
      options: cloudyShuffle([...correctTokens, ...unique.take(2)], random: rand),
      title: ['Составьте предложение на английском', 'Переведите фразу на английский', 'Соберите правильный перевод'][(rand() * 3).floor()],
    ));
  }

  if (microphoneEnabled && lesson.words.isNotEmpty) {
    final pronunciation = cloudyShuffle(lesson.words, random: rand).first;
    output.add(CloudyExercise(kind: CloudyExerciseKind.pronunciation, english: pronunciation.en));
  }
  return cloudyShuffle(output, random: rand);
}


const Map<int, List<CloudyExercise>> _guidedVerbPath = {
  24: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Я хочу воды.', answer: 'I want water.', options: ['I', 'want', 'water.', 'We', 'go', 'home'], title: 'Собери предложение', skillId: 'grammar:verbs:action'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Мы идём домой.', answer: 'We go home.', options: ['We', 'go', 'home.', 'I', 'want', 'water.'], title: 'Собери предложение', skillId: 'grammar:verbs:action'),
  ],
  25: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Я просыпаюсь рано.', answer: 'I wake up early.', options: ['I', 'wake', 'up', 'early.', 'She', 'wakes'], title: 'Собери предложение', skillId: 'grammar:present-simple:base'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Они изучают английский.', answer: 'They study English.', options: ['They', 'study', 'English.', 'He', 'studies', 'I'], title: 'Собери предложение', skillId: 'grammar:present-simple:base'),
  ],
  26: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Она любит чай.', answer: 'She likes tea.', options: ['She', 'likes', 'tea.', 'I', 'like', 'coffee.'], title: 'Собери предложение', skillId: 'grammar:present-simple:third-person'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Он работает каждый день.', answer: 'He works every day.', options: ['He', 'works', 'every', 'day.', 'They', 'work'], title: 'Собери предложение', skillId: 'grammar:present-simple:third-person'),
  ],
  27: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Ты говоришь по-английски?', answer: 'Do you speak English?', options: ['Do', 'you', 'speak', 'English?', 'Does', 'she', 'speaks'], title: 'Собери предложение', skillId: 'grammar:present-simple:questions'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Она работает здесь?', answer: 'Does she work here?', options: ['Does', 'she', 'work', 'here?', 'Do', 'works', 'they'], title: 'Собери предложение', skillId: 'grammar:present-simple:questions'),
  ],
  28: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Я не знаю.', answer: "I don't know.", options: ['I', "don't", 'know.', 'He', "doesn't", 'knows'], title: 'Собери предложение', skillId: 'grammar:present-simple:negatives'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Он не любит кофе.', answer: "He doesn't like coffee.", options: ['He', "doesn't", 'like', 'coffee.', 'I', "don't", 'likes'], title: 'Собери предложение', skillId: 'grammar:present-simple:negatives'),
  ],
  29: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Она читает книгу дома.', answer: 'She reads a book at home.', options: ['She', 'reads', 'a', 'book', 'at', 'home.', 'I', 'read'], title: 'Собери предложение', skillId: 'grammar:sentence-order'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Мы изучаем английский каждый день.', answer: 'We study English every day.', options: ['We', 'study', 'English', 'every', 'day.', 'She', 'studies'], title: 'Собери предложение', skillId: 'grammar:sentence-order'),
  ],
  54: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Где ты живёшь?', answer: 'Where do you live?', options: ['Where', 'do', 'you', 'live?', 'I', 'am', 'home.'], title: 'Собери предложение', skillId: 'grammar:wh-questions'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Когда начинается урок?', answer: 'When does the lesson start?', options: ['When', 'does', 'the', 'lesson', 'start?', 'Where', 'do', 'you'], title: 'Собери предложение', skillId: 'grammar:wh-questions'),
  ],
  55: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Это сумка Анны.', answer: "This is Anna's bag.", options: ['This', 'is', "Anna's", 'bag.', 'That', 'are', 'mine'], title: 'Собери предложение', skillId: 'grammar:possessive-pronouns'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Этот зонт мой.', answer: 'This umbrella is mine.', options: ['This', 'umbrella', 'is', 'mine.', 'That', 'are', 'yours'], title: 'Собери предложение', skillId: 'grammar:possessive-pronouns'),
  ],
  56: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Закрой дверь, пожалуйста.', answer: 'Close the door, please.', options: ['Close', 'the', 'door,', 'please.', "Don't", 'closes', 'it'], title: 'Собери предложение', skillId: 'grammar:imperatives'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Давай начнём урок.', answer: "Let's start the lesson.", options: ["Let's", 'start', 'the', 'lesson.', 'We', 'starts', 'home.'], title: 'Собери предложение', skillId: 'grammar:imperatives'),
  ],
  57: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Вчера я нашёл ключи.', answer: 'I found my keys yesterday.', options: ['I', 'found', 'my', 'keys', 'yesterday.', 'find', 'did', 'tomorrow'], title: 'Собери предложение', skillId: 'grammar:past-simple-irregular'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Она поехала домой на автобусе.', answer: 'She went home by bus.', options: ['She', 'went', 'home', 'by', 'bus.', 'go', 'goes', 'yesterday'], title: 'Собери предложение', skillId: 'grammar:past-simple-irregular'),
  ],
  58: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Тебе нельзя здесь парковаться.', answer: "You mustn't park here.", options: ['You', "mustn't", 'park', 'here.', 'must', "don't", 'parking'], title: 'Собери предложение', skillId: 'grammar:modals-obligation'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Нам не нужно работать в воскресенье.', answer: "We don't have to work on Sunday.", options: ['We', "don't", 'have', 'to', 'work', 'on', 'Sunday.', 'must', 'has', 'working'], title: 'Собери предложение', skillId: 'grammar:modals-obligation'),
  ],
  59: [
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Если пойдёт дождь, мы останемся дома.', answer: "If it rains, we'll stay home.", options: ['If', 'it', 'rains,', "we'll", 'stay', 'home.', 'will', 'stays', 'tomorrow'], title: 'Собери предложение', skillId: 'grammar:first-conditional'),
    CloudyExercise(kind: CloudyExerciseKind.builder, question: 'Если поторопишься, успеешь на автобус.', answer: "If you hurry, you'll catch the bus.", options: ['If', 'you', 'hurry,', "you'll", 'catch', 'the', 'bus.', 'will', 'catches', 'late'], title: 'Собери предложение', skillId: 'grammar:first-conditional'),
  ],
};

List<CloudyExercise> guidedCloudyExercises(int lessonIndex, {CloudyRand? random}) {
  final rand = random ?? math.Random().nextDouble;
  return cloudyShuffle(List<CloudyExercise>.of(_guidedVerbPath[lessonIndex] ?? const []), random: rand);
}

List<CloudyExercise> buildCloudyLessonSequence({
  required int lessonIndex,
  required CloudyLesson lesson,
  required String level,
  required List<CloudyPair> vocabularyPool,
  required bool microphoneEnabled,
  required bool speechRecognitionAvailable,
  CloudyExercise? grammarIntro,
  CloudyRand? random,
}) {
  final rand = random ?? math.Random().nextDouble;
  final result = <CloudyExercise>[];
  if (grammarIntro != null) {
    result.add(CloudyExercise(
      kind: CloudyExerciseKind.grammar,
      title: grammarIntro.title,
      body: grammarIntro.body,
      examples: grammarIntro.examples,
      tip: grammarIntro.tip,
      level: grammarIntro.level.isEmpty ? level : grammarIntro.level,
    ));
  }
  result.add(CloudyExercise(
    kind: CloudyExerciseKind.vocabulary,
    title: 'Познакомься со словами',
    words: lesson.words,
  ));
  result.addAll(guidedCloudyExercises(lessonIndex, random: rand));
  final recall = cloudyShuffle(lesson.words, random: rand)
      .take(lesson.words.length < 3 ? lesson.words.length : 3)
      .map((pair) => CloudyExercise(
        kind: CloudyExerciseKind.recall,
        question: pair.ru,
        answer: pair.en,
        english: pair.en,
        title: 'Вспомни слово без подсказок',
      ));
  result.addAll(recall);
  result.addAll(buildCloudyExercises(
    lesson,
    vocabularyPool,
    microphoneEnabled: microphoneEnabled && speechRecognitionAvailable,
    random: rand,
  ));
  return result;
}

bool checkCloudyRecallAnswer(String input, String expected) {
  final normalized = input.trim().toLowerCase()
      .replaceAll(RegExp(r'[.!?]+$'), '')
      .replaceAll(RegExp(r'\s+'), ' ');
  return normalized == expected.toLowerCase();
}

CloudySession newCloudySession(int lesson, List<CloudyExercise> exercises, {bool review = false}) =>
    CloudySession(lesson: lesson, exercises: exercises, review: review, retryPhase: review);

CloudySession? startCloudyReview(
  CloudyState state, List<CloudyPair> vocabularyPool, {
  required bool microphoneEnabled, CloudyRand? random,
}) {
  final reviewWords = <CloudyPair>[];
  for (final word in state.mistakes.keys.take(8)) {
    for (final pair in vocabularyPool) {
      if (pair.en == word && pair.ru.isNotEmpty) {
        reviewWords.add(pair);
        break;
      }
    }
  }
  if (reviewWords.isEmpty) return null;
  return newCloudySession(
    -1,
    buildCloudyExercises(
      CloudyLesson(title: '', words: reviewWords, sentences: const []),
      vocabularyPool, microphoneEnabled: microphoneEnabled, random: random,
    ),
    review: true,
  );
}

CloudyAnswerResult applyCloudyAnswer(
  CloudyState state, CloudySession session, bool correct, {String? englishWord}
) {
  if (correct) {
    var nextState = state;
    if (session.review && englishWord != null && (state.mistakes[englishWord] ?? 0) > 0) {
      final mistakes = Map<String, num>.of(state.mistakes);
      final remaining = (mistakes[englishWord] ?? 0) - 1;
      if (remaining <= 0) {
        mistakes.remove(englishWord);
      } else {
        mistakes[englishWord] = remaining;
      }
      nextState = state.copyWith(mistakes: mistakes);
    }
    return CloudyAnswerResult(
      state: nextState,
      session: session.copyWith(
        correct: session.correct + 1, total: session.total + 1, combo: session.combo + 1,
      ),
    );
  }

  var nextState = state;
  var nextSession = session;
  if (englishWord != null && englishWord.isNotEmpty) {
    final mistakes = Map<String, num>.of(state.mistakes);
    mistakes[englishWord] = (mistakes[englishWord] ?? 0) + 1;
    nextState = state.copyWith(mistakes: mistakes);
    if (!session.learnedMistakes.contains(englishWord)) {
      nextSession = session.copyWith(learnedMistakes: [...session.learnedMistakes, englishWord]);
    }
  }
  return CloudyAnswerResult(
    state: nextState,
    session: nextSession.copyWith(
      health: nextSession.health - 1, combo: 0, total: nextSession.total + 1,
    ),
  );
}

CloudySession skipCloudyAnswer(CloudySession session) => session.copyWith(combo: 0);

CloudySession? advanceCloudySession(
  CloudySession session, List<CloudyPair> pool, {CloudyRand? random}
) {
  var next = session.copyWith(index: session.index + 1);
  if (next.index >= next.exercises.length && !next.retryPhase && next.learnedMistakes.isNotEmpty) {
    final retry = <CloudyExercise>[];
    for (final word in next.learnedMistakes.take(3)) {
      final match = pool.where((pair) => pair.en == word).firstOrNull;
      if (match == null) continue;
      final rand = random ?? math.Random().nextDouble;
      retry.add(cloudyChoiceQuestion(match.en, match.ru, (rand() * 2).floor(), pool, random: rand));
    }
    next = next.copyWith(retryPhase: true, exercises: [...next.exercises, ...retry]);
  }
  return next.index >= next.exercises.length ? null : next;
}

int cloudyLessonGain(int health) => 15 + math.max(health, 0).toInt() * 3;
int cloudyLessonStars(int health) => health >= 5 ? 3 : health >= 3 ? 2 : 1;
int cloudyAccuracy(int correct, int total) => ((correct / math.max(total, 1)) * 100).round();

CloudyState updateCloudyStreak(CloudyState state, DateTime now) {
  final today = _jsDateString(now);
  final yesterday = _jsDateString(now.subtract(const Duration(days: 1)));
  if (state.last == today) return state;
  return state.copyWith(streak: state.last == yesterday ? state.streak + 1 : 1, last: today);
}

DateTime _parseJsDate(String value) {
  final match = RegExp(r'^[A-Za-z]{3} ([A-Za-z]{3}) ([0-9]{1,2}) ([0-9]{4})$').firstMatch(value);
  if (match == null) return DateTime.fromMillisecondsSinceEpoch(0);
  const months = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12};
  return DateTime(
    int.parse(match.group(3)!), months[match.group(1)] ?? 1, int.parse(match.group(2)!),
  );
}

CloudyLessonResult finishCloudyLesson(CloudyState original, CloudySession session, {DateTime? now}) {
  final date = (now ?? DateTime.now()).toLocal();
  var state = updateCloudyStreak(rollCloudyDay(original, date), date);
  final gain = cloudyLessonGain(session.health);
  final day = cloudyDayKey(date);
  final days = state.days.contains(day) ? [...state.days] : [...state.days, day].takeLast(60);
  final week = cloudyWeekKey(date);
  final weekly = state.week['k'] != week
      ? <String, Object?>{'k': week, 'xp': 0}
      : Map<String, Object?>.of(state.week);
  weekly['xp'] = _number(weekly['xp']) + gain;

  final today = state.today;
  state = state.copyWith(
    xp: state.xp + gain,
    days: days,
    week: weekly,
    perfectLessons: session.health >= 5 && !session.review
        ? state.perfectLessons + 1 : state.perfectLessons,
    today: CloudyToday(
      d: today.d, xp: today.xp + gain,
      les: today.les + (session.review ? 0 : 1),
      ok: today.ok + session.correct, claim: today.claim,
    ),
    accuracy: [state.accuracy[0] + session.correct, state.accuracy[1] + session.total],
  );

  if (!session.review && state.level != null) {
    final code = state.level!.code;
    final lessons = cloudyLevelLessons(code);
    final position = lessons.indexOf(session.lesson);
    final completed = Map<String, num>.of(state.completed);
    final current = _number(completed[code]);
    if (position == current && current < lessons.length) {
      completed[code] = current + 1;
      state = state.copyWith(completed: completed);
    }
  }

  return CloudyLessonResult(
    state: state, gain: gain, stars: cloudyLessonStars(session.health),
    accuracy: cloudyAccuracy(session.correct, session.total),
  );
}

CloudyState? claimCloudyChest(CloudyState state) {
  if (state.today.xp >= state.settings.goal && state.today.claim == 0) {
    return state.copyWith(
      xp: state.xp + 25,
      today: CloudyToday(
        d: state.today.d, xp: state.today.xp, les: state.today.les,
        ok: state.today.ok, claim: 1,
      ),
    );
  }
  return null;
}

class CloudyAchievement {
  const CloudyAchievement({
    required this.id, required this.title, required this.description,
    required this.icon, required this.unlocked,
  });
  final String id, title, description, icon;
  final bool unlocked;
}

List<CloudyAchievement> cloudyAchievements(CloudyState state) => [
  CloudyAchievement(id: 'first', title: 'Первый шаг', description: 'Набрать XP', icon: 'bolt', unlocked: state.xp > 0),
  CloudyAchievement(id: 's3', title: 'Серия 3', description: '3 дня подряд', icon: 'flame', unlocked: state.streak >= 3),
  CloudyAchievement(id: 's7', title: 'Серия 7', description: '7 дней подряд', icon: 'flame', unlocked: state.streak >= 7),
  CloudyAchievement(id: 'perf', title: 'Без ошибок', description: 'Урок без потерь', icon: 'heart', unlocked: state.perfectLessons > 0),
  CloudyAchievement(id: 'x1', title: '100 XP', description: 'Набрать 100 XP', icon: 'star', unlocked: state.xp >= 100),
  CloudyAchievement(id: 'x5', title: '500 XP', description: 'Набрать 500 XP', icon: 'star', unlocked: state.xp >= 500),
  CloudyAchievement(id: 'a1', title: 'Уровень A1', description: 'Пройти A1', icon: 'check', unlocked: (state.completed['A1'] ?? 0) >= 21),
  CloudyAchievement(id: 'tst', title: 'Знаток', description: 'Пройти тест', icon: 'target', unlocked: state.tested > 0),
];

List<CloudyAchievement> newCloudyAchievements(CloudyState state) =>
    cloudyAchievements(state).where((item) => item.unlocked && !state.achievements.contains(item.id)).toList();

bool hasCloudyProgress(CloudyState state) => state.hasProgress;

CloudyState mergeCloudyProgress(CloudyState guest, CloudyState? account) {
  if (account == null) return guest;
  final completed = <String, num>{};
  for (final level in ['A1', 'A2', 'B1', 'B2']) {
    completed[level] = math.max(account.completed[level] ?? 0, guest.completed[level] ?? 0);
  }
  final mistakes = Map<String, num>.of(account.mistakes);
  for (final entry in guest.mistakes.entries) {
    mistakes[entry.key] = (mistakes[entry.key] ?? 0) + entry.value;
  }

  final guestDate = _parseJsDate(guest.last);
  final accountDate = _parseJsDate(account.last);
  final guestIsNewer = guestDate.isAfter(accountDate);
  final Map<String, Object?> weekly;
  if (account.week['k'] == guest.week['k']) {
    weekly = {
      'k': account.week['k'],
      'xp': _number(account.week['xp']) + _number(guest.week['xp']),
    };
  } else {
    weekly = guestIsNewer ? guest.week : account.week;
  }

  final days = <String>{...account.days, ...guest.days}.toList();
  final achievements = <String>{...account.achievements, ...guest.achievements}.toList();
  return account.copyWith(
    xp: account.xp + guest.xp,
    streak: math.max(account.streak, guest.streak),
    last: guestIsNewer ? guest.last : account.last,
    level: account.level ?? guest.level,
    completed: completed,
    mistakes: mistakes,
    week: weekly,
    accuracy: [
      account.accuracy[0] + guest.accuracy[0],
      account.accuracy[1] + guest.accuracy[1],
    ],
    days: days.length > 60 ? days.sublist(days.length - 60) : days,
    achievements: achievements,
    perfectLessons: account.perfectLessons + guest.perfectLessons,
    tested: math.max(account.tested, guest.tested),
  );
}

CloudyState sanitizeCloudyProgress(CloudyState input) {
  final completed = <String, num>{
    'A1': _clampInt(input.completed['A1'] ?? 0, 0, 24),
    'A2': _clampInt(input.completed['A2'] ?? 0, 0, 24),
    'B1': _clampInt(input.completed['B1'] ?? 0, 0, 6),
    'B2': _clampInt(input.completed['B2'] ?? 0, 0, 6),
  };

  final mistakes = <String, num>{};
  for (final entry in input.mistakes.entries.take(200)) {
    if (entry.key.isNotEmpty && entry.key.length <= 80 && entry.value > 0) {
      mistakes[entry.key] = _clampInt(entry.value, 0, 10000);
    }
  }

  final days = input.days
      .takeLast(60)
      .where((day) => RegExp(r'^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}
  final boundedDays = days.length > 60 ? days.sublist(days.length - 60) : days;
  final achievements = input.achievements
      .where((id) => RegExp(r'^[a-z0-9_-]{1,24}

  final settings = input.settings;
  final weekKey = input.week['k'] is String ? input.week['k'] as String : '';
  final validTime = RegExp(r'^([01][0-9]|2[0-3]):[0-5][0-9]$').hasMatch(settings.remT);

  return input.copyWith(
    streak: _clampInt(input.streak, 0, 3650),
    last: input.last.substring(0, math.min(40, input.last.length)),
    completed: completed,
    accuracy: [
      _clampInt(input.accuracy[0], 0, 1000000),
      _clampInt(input.accuracy[1], 0, 1000000),
    ],
    mistakes: mistakes,
    days: boundedDays,
    achievements: achievements,
    week: {
      'k': weekKey.substring(0, math.min(16, weekKey.length)),
      'xp': _clampInt(_number(input.week['xp']), 0, 1000000),
    },
    perfectLessons: _clampInt(input.perfectLessons, 0, 100000),
    tested: input.tested == 0 ? 0 : 1,
    settings: CloudySettings(
      snd: settings.snd == 0 ? 0 : 1,
      vol: settings.vol.clamp(0, 1),
      voice: settings.voice == 0 ? 0 : 1,
      goal: _clampInt(settings.goal, 5, 240),
      mic: settings.mic == 0 ? 0 : 1,
      th: settings.th,
      rem: settings.rem == 0 ? 0 : 1,
      remT: validTime ? settings.remT : '19:00',
    ),
    today: CloudyToday(
      d: input.today.d.substring(0, math.min(40, input.today.d.length)),
      xp: _clampInt(input.today.xp, 0, 100000),
      les: _clampInt(input.today.les, 0, 1000),
      ok: _clampInt(input.today.ok, 0, 100000),
      claim: input.today.claim == 0 ? 0 : 1,
    ),
  );
}

String cloudyLessonTitle(int index, List<CloudyLesson> lessons) =>
    index >= 0 && index < lessons.length ? lessons[index].title : '';

extension _TakeLast<T> on Iterable<T> {
  List<T> takeLast(int count) {
    final values = toList();
    return values.length <= count ? values : values.sublist(values.length - count);
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}