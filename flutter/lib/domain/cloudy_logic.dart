import 'dart:math' as math;

import 'cloudy_exercise.dart';
import 'cloudy_state.dart';

typedef CloudyRand = double Function();

class CloudyLesson {
  const CloudyLesson({required this.title, required this.words, required this.sentences});
  final String title;
  final List<CloudyPair> words;
  final List<CloudyPair> sentences;
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
    this.matchingCorrect = 0,
  });
  final bool review, retryPhase;
  final int lesson, index, health, combo, correct, total, matchingCorrect;
  final List<CloudyExercise> exercises;
  final List<String> learnedMistakes;

  CloudySession copyWith({
    int? lesson, List<CloudyExercise>? exercises, bool? review,
    int? index, int? health, int? combo, int? correct, int? total,
    List<String>? learnedMistakes, bool? retryPhase, int? matchingCorrect,
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
    matchingCorrect: matchingCorrect ?? this.matchingCorrect,
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

List<CloudyExercise> buildCloudyExercises(
  CloudyLesson lesson, List<CloudyPair> pool, {
  required bool microphoneEnabled, CloudyRand? random,
}) {
  final rand = random ?? math.Random().nextDouble;
  final output = <CloudyExercise>[];

  for (var index = 0; index < lesson.words.length; index++) {
    final pair = lesson.words[index];
    output.add(cloudyChoiceQuestion(pair.first, pair.second, index % 3, pool, random: rand));
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

CloudySession newCloudySession(int lesson, List<CloudyExercise> exercises, {bool review = false}) =>
    CloudySession(lesson: lesson, exercises: exercises, review: review, retryPhase: review);

CloudySession? startCloudyReview(
  CloudyState state, List<CloudyPair> vocabularyPool, {
  required bool microphoneEnabled, CloudyRand? random,
}) {
  final reviewWords = <CloudyPair>[];
  for (final word in state.mistakes.keys.take(8)) {
    for (final pair in vocabularyPool) {
      if (pair.first == word && pair.second.isNotEmpty) {
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
      vocabularyPool,
      microphoneEnabled: microphoneEnabled,
      random: random,
    ),
    review: true,
  );
}


bool isCloudyAnswerCorrect(
  CloudyExercise exercise, {
  int? selectedOption,
  List<int> builtOptionIndices = const [],
  String? typedAnswer,
}) {
  if (exercise is CloudyRecallExercise) {
    return checkCloudyRecallAnswer(typedAnswer ?? '', exercise.answer);
  }
  if (exercise is CloudyBuilderExercise) {
    if (builtOptionIndices.isEmpty) return false;
    final valid = builtOptionIndices.every(
      (index) => index >= 0 && index < exercise.options.length,
    );
    if (!valid) return false;
    final answer = builtOptionIndices.map((index) => exercise.options[index]).join(' ');
    return answer.toLowerCase() == exercise.answer.toLowerCase();
  }
  if (exercise is CloudyChoiceExercise) {
    return selectedOption != null &&
        selectedOption >= 0 &&
        selectedOption < exercise.options.length &&
        exercise.options[selectedOption] == exercise.answer;
  }
  if (exercise is CloudyListeningExercise) {
    return selectedOption != null &&
        selectedOption >= 0 &&
        selectedOption < exercise.options.length &&
        exercise.options[selectedOption] == exercise.answer;
  }
  return false;
}

CloudyAnswerResult applyCloudyMatchingAttempt(
  CloudyState state,
  CloudySession session, {
  required String englishWord,
  required bool correct,
  required int totalPairs,
}) {
  if (totalPairs <= 0 || session.matchingCorrect >= totalPairs) {
    return CloudyAnswerResult(state: state, session: session);
  }
  if (correct) {
    final completedPairs = session.matchingCorrect + 1;
    final isComplete = completedPairs == totalPairs;
    return CloudyAnswerResult(
      state: state,
      session: session.copyWith(
        matchingCorrect: completedPairs,
        correct: isComplete ? session.correct + 1 : session.correct,
        total: isComplete ? session.total + 1 : session.total,
        combo: isComplete ? session.combo + 1 : session.combo,
      ),
    );
  }

  final mistakes = Map<String, num>.of(state.mistakes);
  mistakes[englishWord] = (mistakes[englishWord] ?? 0) + 1;
  final learned = session.learnedMistakes.contains(englishWord)
      ? session.learnedMistakes
      : [...session.learnedMistakes, englishWord];
  return CloudyAnswerResult(
    state: state.copyWith(mistakes: mistakes),
    session: session.copyWith(
      health: session.health - 1,
      combo: 0,
      learnedMistakes: learned,
    ),
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
  var next = session.copyWith(index: session.index + 1, matchingCorrect: 0);
  if (next.index >= next.exercises.length && !next.retryPhase && next.learnedMistakes.isNotEmpty) {
    final retry = <CloudyExercise>[];
    for (final word in next.learnedMistakes.take(3)) {
      CloudyPair? match;
      for (final pair in pool) {
        if (pair.first == word) {
          match = pair;
          break;
        }
      }
      if (match == null) continue;
      final rand = random ?? math.Random().nextDouble;
      retry.add(cloudyChoiceQuestion(
        match.first, match.second, (rand() * 2).floor(), pool, random: rand,
      ));
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

  final validDays = input.days.where(
    (day) => RegExp(r'^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$').hasMatch(day),
  );
  final days = validDays.takeLast(60).toSet().toList();
  final validAchievements = input.achievements.where(
    (id) => RegExp(r'^[a-z0-9_-]{1,24}$', caseSensitive: false).hasMatch(id),
  );
  final achievements = validAchievements.take(32).toSet().toList();

  final settings = input.settings;
  final weekKey = input.week['k'] is String ? input.week['k'] as String : '';
  final validTime = RegExp(r'^([01][0-9]|2[0-3]):[0-5][0-9]$').hasMatch(settings.remT);

  return input.copyWith(
    streak: _clampInt(input.streak, 0, 3650),
    last: input.last.length > 40 ? input.last.substring(0, 40) : input.last,
    completed: completed,
    accuracy: [
      _clampInt(input.accuracy[0], 0, 1000000),
      _clampInt(input.accuracy[1], 0, 1000000),
    ],
    mistakes: mistakes,
    days: days,
    achievements: achievements,
    week: {
      'k': weekKey.length > 16 ? weekKey.substring(0, 16) : weekKey,
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
      d: input.today.d.length > 40 ? input.today.d.substring(0, 40) : input.today.d,
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

