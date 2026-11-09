import 'dart:math' as math;

import 'cloudy_exercise.dart';
import 'cloudy_exercise_builder.dart';
import 'cloudy_state.dart';

class CloudySession {
  const CloudySession({
    required this.review, required this.lesson, required this.exercises,
    this.index = 0, this.health = 5, this.combo = 0, this.correct = 0,
    this.total = 0, this.mistakeWords = const [], this.retryPhase = false,
    this.matchingCorrect = 0,
  });

  final bool review;
  final int lesson;
  final List<CloudyExercise> exercises;
  final int index, health, combo, correct, total;
  final List<String> mistakeWords;
  final bool retryPhase;
  final int matchingCorrect;

  CloudySession copyWith({
    int? index, int? health, int? combo, int? correct, int? total,
    List<CloudyExercise>? exercises,
    List<String>? mistakeWords,
    bool? retryPhase,
    int? matchingCorrect,
  }) => CloudySession(
    review: review, lesson: lesson,
    exercises: exercises ?? this.exercises,
    index: index ?? this.index, health: health ?? this.health,
    combo: combo ?? this.combo, correct: correct ?? this.correct,
    total: total ?? this.total, mistakeWords: mistakeWords ?? this.mistakeWords,
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
  const CloudyLessonResult({
    required this.state, required this.gain, required this.stars,
    required this.accuracy,
  });
  final CloudyState state;
  final num gain;
  final int stars, accuracy;
}

String cloudyDayKey(DateTime value) =>
    '${value.year}-${value.month}-${value.day}';

String cloudyWeekKey([DateTime? value]) {
  final date = (value ?? DateTime.now()).toLocal();
  final firstDay = DateTime(date.year, 1, 1);
  final dayOffset = DateTime(date.year, date.month, date.day)
      .difference(firstDay).inDays;
  final jsWeekday = firstDay.weekday % 7; // JavaScript Sunday = 0.
  return '${date.year}w${((dayOffset + jsWeekday) / 7).floor()}';
}

String _dateString(DateTime value) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final d = value.toLocal();
  return '${weekdays[d.weekday - 1]} ${months[d.month - 1]} ${d.day.toString()} ${d.year}';
}

CloudyState rollCloudyDay(CloudyState state, DateTime now) {
  final today = _dateString(now);
  if (state.today.d == today) return state;
  return state.copyWith(today: CloudyToday(d: today));
}

CloudyState updateCloudyStreak(CloudyState state, DateTime now) {
  final today = _dateString(now);
  if (state.last == today) return state;
  final yesterday = _dateString(now.subtract(const Duration(days: 1)));
  return state.copyWith(
    streak: state.last == yesterday ? state.streak + 1 : 1,
    last: today,
  );
}

num cloudyLessonGain(num health) => 15 + (health < 0 ? 0 : health) * 3;
int cloudyLessonStars(num health) => health >= 5 ? 3 : health >= 3 ? 2 : 1;
int cloudyAccuracy(num correct, num total) =>
    (correct / (total <= 0 ? 1 : total) * 100).round();

CloudyAnswerResult applyCloudyAnswer(
  CloudyState state,
  CloudySession session, {
  required bool correct,
  String? englishWord,
}) {
  if (correct) {
    var nextState = state;
    if (session.review && englishWord != null && state.mistakes.containsKey(englishWord)) {
      final mistakes = Map<String, num>.from(state.mistakes);
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
        correct: session.correct + 1,
        total: session.total + 1,
        combo: session.combo + 1,
      ),
    );
  }

  final mistakes = Map<String, num>.from(state.mistakes);
  final words = List<String>.from(session.mistakeWords);
  if (englishWord != null && englishWord.isNotEmpty) {
    mistakes[englishWord] = (mistakes[englishWord] ?? 0) + 1;
    if (!words.contains(englishWord)) words.add(englishWord);
  }
  return CloudyAnswerResult(
    state: state.copyWith(mistakes: mistakes),
    session: session.copyWith(
      health: session.health - 1,
      combo: 0,
      total: session.total + 1,
      mistakeWords: words,
    ),
  );
}

/// Skipping pronunciation is neutral: it does not add an attempt or a correct answer.
CloudySession skipCloudyAnswer(CloudySession session) => session.copyWith(combo: 0);

CloudyLessonResult finishCloudyLesson(
  CloudyState original,
  CloudySession session, {
  required DateTime now,
  bool authenticated = false,
  Map<String, List<int>> levelLessonIndices = const {},
}) {
  var state = updateCloudyStreak(rollCloudyDay(original, now), now);
  final gain = authenticated ? 24 : cloudyLessonGain(session.health);
  final day = cloudyDayKey(now);
  final allDays = authenticated || state.days.contains(day)
      ? List<String>.from(state.days)
      : [...state.days, day];
  final days = allDays.length > 60
      ? allDays.sublist(allDays.length - 60)
      : allDays;
  final weekCode = cloudyWeekKey(now);
  final week = authenticated
      ? Map<String, Object?>.from(state.week)
      : state.week['k'] != weekCode
          ? <String, Object?>{'k': weekCode, 'xp': 0}
          : Map<String, Object?>.from(state.week);
  if (!authenticated) week['xp'] = (week['xp'] as num? ?? 0) + gain;

  final today = state.today;
  state = state.copyWith(
    xp: authenticated ? state.xp : state.xp + gain,
    days: days,
    week: week,
    perfectLessons: state.perfectLessons + (!authenticated && session.health >= 5 && !session.review ? 1 : 0),
    today: CloudyToday(
      d: today.d, xp: authenticated ? today.xp : today.xp + gain,
      les: today.les + (session.review ? 0 : 1),
      ok: today.ok + session.correct, claim: today.claim,
    ),
    accuracy: [state.accuracy[0] + session.correct, state.accuracy[1] + session.total],
  );

  final level = state.level;
  if (!session.review && level != null) {
    final code = level.code;
    final orderedLessons = levelLessonIndices[code] ?? const <int>[];
    final completed = Map<String, num>.from(state.completed);
    final count = completed[code] ?? 0;
    if (orderedLessons.indexOf(session.lesson) == count && count < orderedLessons.length) {
      completed[code] = count + 1;
      state = state.copyWith(completed: completed);
    }
  }

  return CloudyLessonResult(
    state: state, gain: gain,
    stars: cloudyLessonStars(session.health),
    accuracy: cloudyAccuracy(session.correct, session.total),
  );
}

CloudyState? claimCloudyChest(CloudyState state) {
  if (state.today.xp < state.settings.goal || state.today.claim != 0) return null;
  return state.copyWith(
    xp: state.xp + 25,
    today: CloudyToday(
      d: state.today.d, xp: state.today.xp, les: state.today.les,
      ok: state.today.ok, claim: 1,
    ),
  );
}

DateTime? _parseCloudyDate(String value) {
  final iso = DateTime.tryParse(value);
  if (iso != null) return iso;

  final numeric = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})$').firstMatch(value);
  if (numeric != null) {
    return DateTime(
      int.parse(numeric.group(1)!),
      int.parse(numeric.group(2)!),
      int.parse(numeric.group(3)!),
    );
  }

  final match = RegExp(r'^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})$').firstMatch(value);
  if (match == null) return null;
  const months = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
  };
  final month = months[match.group(1)];
  if (month == null) return null;
  return DateTime(int.parse(match.group(3)!), month, int.parse(match.group(2)!));
}

CloudyState mergeCloudyProgress(CloudyState guest, CloudyState? account) {
  if (account == null) return guest;
  final completed = <String, num>{};
  for (final level in ['A1', 'A2', 'B1', 'B2']) {
    final a = account.completed[level] ?? 0;
    final g = guest.completed[level] ?? 0;
    completed[level] = a > g ? a : g;
  }

  final mistakes = Map<String, num>.from(account.mistakes);
  for (final entry in guest.mistakes.entries) {
    mistakes[entry.key] = (mistakes[entry.key] ?? 0) + entry.value;
  }

  final guestDate = _parseCloudyDate(guest.last) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final accountDate = _parseCloudyDate(account.last) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final guestIsNewer = guestDate.isAfter(accountDate);
  final sameWeek = account.week['k'] == guest.week['k'];
  final week = sameWeek
      ? <String, Object?>{
          'k': account.week['k'],
          'xp': (account.week['xp'] as num? ?? 0) + (guest.week['xp'] as num? ?? 0),
        }
      : Map<String, Object?>.from(guestIsNewer ? guest.week : account.week);

  return account.copyWith(
    xp: account.xp + guest.xp,
    streak: account.streak > guest.streak ? account.streak : guest.streak,
    last: guestIsNewer ? guest.last : account.last,
    level: account.level ?? guest.level,
    completed: completed,
    mistakes: mistakes,
    week: week,
    accuracy: [account.accuracy[0] + guest.accuracy[0], account.accuracy[1] + guest.accuracy[1]],
    days: (() {
      final mergedDays = [...{...account.days, ...guest.days}];
      return mergedDays.length > 60
          ? mergedDays.sublist(mergedDays.length - 60)
          : mergedDays;
    })(),
    achievements: [...{...account.achievements, ...guest.achievements}],
    perfectLessons: account.perfectLessons + guest.perfectLessons,
    tested: account.tested > guest.tested ? account.tested : guest.tested,
  );
}
).firstMatch(value);
  if (match == null) return null;
  const months = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12};
  final month = months[match.group(1)];
  if (month == null) return null;
  return DateTime(int.parse(match.group(3)!), month, int.parse(match.group(2)!));
}

CloudyState mergeCloudyProgress(CloudyState guest, CloudyState? account) {
  if (account == null) return guest;
  final completed = <String, num>{};
  for (final level in ['A1', 'A2', 'B1', 'B2']) {
    final a = account.completed[level] ?? 0;
    final g = guest.completed[level] ?? 0;
    completed[level] = a > g ? a : g;
  }

  final mistakes = Map<String, num>.from(account.mistakes);
  for (final entry in guest.mistakes.entries) {
    mistakes[entry.key] = (mistakes[entry.key] ?? 0) + entry.value;
  }

  final guestDate = _parseCloudyDate(guest.last) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final accountDate = _parseCloudyDate(account.last) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final guestIsNewer = guestDate.isAfter(accountDate);
  final sameWeek = account.week['k'] == guest.week['k'];
  final week = sameWeek
      ? <String, Object?>{
          'k': account.week['k'],
          'xp': (account.week['xp'] as num? ?? 0) + (guest.week['xp'] as num? ?? 0),
        }
      : Map<String, Object?>.from(guestIsNewer ? guest.week : account.week);

  return account.copyWith(
    xp: account.xp + guest.xp,
    streak: account.streak > guest.streak ? account.streak : guest.streak,
    last: guestIsNewer ? guest.last : account.last,
    level: account.level ?? guest.level,
    completed: completed,
    mistakes: mistakes,
    week: week,
    accuracy: [account.accuracy[0] + guest.accuracy[0], account.accuracy[1] + guest.accuracy[1]],
    days: [...{...account.days, ...guest.days}].take(60).toList(growable: false),
    achievements: [...{...account.achievements, ...guest.achievements}],
    perfectLessons: account.perfectLessons + guest.perfectLessons,
    tested: account.tested > guest.tested ? account.tested : guest.tested,
  );
}


/// Three-way conflict merge used by the current Cloudy multi-device sync.
/// The remote XP ledger remains authoritative; local-only changes are merged
/// against the last acknowledged base snapshot instead of overwriting peers.
CloudyState mergeCloudyConflictProgress(
  CloudyState remote,
  CloudyState local,
  CloudyState base,
) {
  num counter(num remoteValue, num localValue, num baseValue) {
    final value = remoteValue + localValue - baseValue;
    return value < 0 ? 0 : value;
  }

  final remoteSettings = remote.settings;
  final localSettings = local.settings;
  final baseSettings = base.settings;
  Object? setting(Object? remoteValue, Object? localValue, Object? baseValue) {
    final localChanged = localValue != baseValue;
    return localChanged && localValue != null
        ? localValue
        : (remoteValue ?? localValue);
  }

  final settings = CloudySettings(
    snd: setting(remoteSettings.snd, localSettings.snd, baseSettings.snd) as num,
    vol: setting(remoteSettings.vol, localSettings.vol, baseSettings.vol) as num,
    voice: setting(remoteSettings.voice, localSettings.voice, baseSettings.voice) as num,
    goal: setting(remoteSettings.goal, localSettings.goal, baseSettings.goal) as num,
    mic: setting(remoteSettings.mic, localSettings.mic, baseSettings.mic) as num,
    th: 'dark',
    rem: setting(remoteSettings.rem, localSettings.rem, baseSettings.rem) as num,
    remT: setting(remoteSettings.remT, localSettings.remT, baseSettings.remT) as String,
  );

  final completed = <String, num>{};
  for (final level in ['A1', 'A2', 'B1', 'B2']) {
    final r = remote.completed[level] ?? 0;
    final l = local.completed[level] ?? 0;
    completed[level] = r > l ? r : l;
  }

  final achievementSet = <String>{...remote.achievements, ...local.achievements};
  final daySet = <String>{...remote.days, ...local.days};
  final days = daySet.toList()
    ..sort((a, b) {
      final left = _parseCloudyDate(a)?.millisecondsSinceEpoch ?? 0;
      final right = _parseCloudyDate(b)?.millisecondsSinceEpoch ?? 0;
      return left.compareTo(right);
    });

  final words = <String>{
    ...remote.mistakes.keys, ...local.mistakes.keys, ...base.mistakes.keys,
  };
  final mistakes = <String, num>{};
  for (final word in words) {
    final count = counter(
      remote.mistakes[word] ?? 0,
      local.mistakes[word] ?? 0,
      base.mistakes[word] ?? 0,
    );
    if (count > 0) mistakes[word] = count;
  }

  final accuracy = <num>[
    counter(remote.accuracy[0], local.accuracy[0], base.accuracy[0]),
    counter(remote.accuracy[1], local.accuracy[1], base.accuracy[1]),
  ];

  CloudyToday today;
  if (remote.today.d == local.today.d && remote.today.d == base.today.d) {
    today = CloudyToday(
      d: local.today.d,
      xp: counter(remote.today.xp, local.today.xp, base.today.xp),
      les: counter(remote.today.les, local.today.les, base.today.les),
      ok: counter(remote.today.ok, local.today.ok, base.today.ok),
      claim: remote.today.claim != 0 || local.today.claim != 0 ? 1 : 0,
    );
  } else if (remote.today.d == local.today.d) {
    today = CloudyToday(
      d: remote.today.d,
      xp: remote.today.xp > local.today.xp ? remote.today.xp : local.today.xp,
      les: remote.today.les > local.today.les ? remote.today.les : local.today.les,
      ok: remote.today.ok > local.today.ok ? remote.today.ok : local.today.ok,
      claim: remote.today.claim != 0 || local.today.claim != 0 ? 1 : 0,
    );
  } else {
    final localDay = _parseCloudyDate(local.today.d)?.millisecondsSinceEpoch ?? 0;
    final remoteDay = _parseCloudyDate(remote.today.d)?.millisecondsSinceEpoch ?? 0;
    today = localDay > remoteDay ? local.today : remote.today;
  }

  final localLast = _parseCloudyDate(local.last)?.millisecondsSinceEpoch ?? 0;
  final remoteLast = _parseCloudyDate(remote.last)?.millisecondsSinceEpoch ?? 0;
  final localIsNewer = localLast > remoteLast;
  final remoteIsNewer = remoteLast > localLast;
  final level = local.level ?? remote.level;

  return remote.copyWith(
    xp: remote.xp,
    streak: localIsNewer
        ? local.streak
        : remoteIsNewer
            ? remote.streak
            : (remote.streak > local.streak ? remote.streak : local.streak),
    last: localIsNewer ? local.last : remoteIsNewer ? remote.last : local.last,
    level: level,
    clearLevel: level == null,
    completed: completed,
    accuracy: accuracy,
    mistakes: mistakes,
    days: days.length > 60 ? days.sublist(days.length - 60) : days,
    achievements: achievementSet.toList(growable: false),
    week: remote.week.isNotEmpty ? remote.week : local.week,
    perfectLessons: counter(remote.perfectLessons, local.perfectLessons, base.perfectLessons),
    tested: remote.tested != 0 || local.tested != 0 ? 1 : 0,
    settings: settings,
    today: today,
  );
}


/// Applies the authoritative XP-ledger response after an authenticated lesson.
/// The lesson result itself is saved first; only the server can award account XP.
CloudyState applyCloudyServerAward(
  CloudyState state,
  CloudySession session,
  Map<String, Object?> award, {
  required DateTime now,
}) {
  final awarded = _number(award['awarded']);
  final day = cloudyDayKey(now);
  final allDays = awarded > 0 && !state.days.contains(day)
      ? [...state.days, day]
      : List<String>.from(state.days);
  final days = allDays.length > 60
      ? allDays.sublist(allDays.length - 60)
      : allDays;
  final today = state.today;
  return state.copyWith(
    xp: _number(award['total_xp'], state.xp),
    days: days,
    week: {
      'k': award['week_key']?.toString() ?? '',
      'xp': _number(award['week_xp']),
    },
    perfectLessons: state.perfectLessons +
        (awarded > 0 && session.health >= 5 && !session.review ? 1 : 0),
    today: CloudyToday(
      d: today.d,
      xp: today.xp + awarded,
      les: today.les,
      ok: today.ok,
      claim: today.claim,
    ),
  );
}



CloudySession newCloudySession(
  int lesson,
  List<CloudyExercise> exercises, {
  bool review = false,
}) => CloudySession(
  review: review,
  lesson: lesson,
  exercises: exercises,
  retryPhase: review,
);

CloudySession? startCloudyReview(
  CloudyState state,
  List<CloudyPair> vocabularyPool, {
  required bool microphoneEnabled,
  CloudyRand? random,
}) {
  final words = <CloudyPair>[];
  for (final english in state.mistakes.keys.take(8)) {
    for (final pair in vocabularyPool) {
      if (pair.first == english && pair.second.isNotEmpty) {
        words.add(pair);
        break;
      }
    }
  }
  if (words.isEmpty) return null;
  return newCloudySession(
    -1,
    buildCloudyExercises(
      CloudyLesson(title: '', words: words, sentences: const []),
      vocabularyPool,
      microphoneEnabled: microphoneEnabled,
      random: random,
    ),
    review: true,
  );
}

CloudySession? advanceCloudySession(
  CloudySession session,
  List<CloudyPair> vocabularyPool, {
  CloudyRand? random,
}) {
  var next = session.copyWith(
    index: session.index + 1,
    matchingCorrect: 0,
  );
  if (next.index >= next.exercises.length &&
      !next.retryPhase &&
      next.mistakeWords.isNotEmpty) {
    final retry = <CloudyExercise>[];
    final rand = random ?? math.Random().nextDouble;
    for (final english in next.mistakeWords.take(3)) {
      CloudyPair? pair;
      for (final candidate in vocabularyPool) {
        if (candidate.first == english) {
          pair = candidate;
          break;
        }
      }
      if (pair == null) continue;
      retry.add(cloudyChoiceQuestion(
        pair.first,
        pair.second,
        (rand() * 2).floor(),
        vocabularyPool,
        random: rand,
      ));
    }
    next = next.copyWith(
      retryPhase: true,
      exercises: [...next.exercises, ...retry],
    );
  }
  return next.index >= next.exercises.length ? null : next;
}

/// Matching attempts affect lives and mistakes immediately, but the pair
/// exercise contributes one accuracy attempt only after every pair is found.
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
    final completed = completedPairs == totalPairs;
    return CloudyAnswerResult(
      state: state,
      session: session.copyWith(
        matchingCorrect: completedPairs,
        correct: completed ? session.correct + 1 : session.correct,
        total: completed ? session.total + 1 : session.total,
        combo: completed ? session.combo + 1 : session.combo,
      ),
    );
  }

  final mistakes = Map<String, num>.of(state.mistakes);
  final words = List<String>.of(session.mistakeWords);
  if (englishWord.isNotEmpty) {
    mistakes[englishWord] = (mistakes[englishWord] ?? 0) + 1;
    if (!words.contains(englishWord)) words.add(englishWord);
  }
  return CloudyAnswerResult(
    state: englishWord.isEmpty ? state : state.copyWith(mistakes: mistakes),
    session: session.copyWith(
      health: session.health - 1,
      combo: 0,
      mistakeWords: words,
    ),
  );
}

class CloudyAchievement {
  const CloudyAchievement({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.unlocked,
  });
  final String id, title, description, icon;
  final bool unlocked;
}

List<CloudyAchievement> cloudyAchievements(CloudyState state) => [
  CloudyAchievement(
    id: 'first', title: 'Первый шаг', description: 'Набрать XP',
    icon: 'bolt', unlocked: state.xp > 0,
  ),
  CloudyAchievement(
    id: 's3', title: 'Серия 3', description: '3 дня подряд',
    icon: 'flame', unlocked: state.streak >= 3,
  ),
  CloudyAchievement(
    id: 's7', title: 'Серия 7', description: '7 дней подряд',
    icon: 'flame', unlocked: state.streak >= 7,
  ),
  CloudyAchievement(
    id: 'perf', title: 'Без ошибок', description: 'Урок без потерь',
    icon: 'heart', unlocked: state.perfectLessons > 0,
  ),
  CloudyAchievement(
    id: 'x1', title: '100 XP', description: 'Набрать 100 XP',
    icon: 'star', unlocked: state.xp >= 100,
  ),
  CloudyAchievement(
    id: 'x5', title: '500 XP', description: 'Набрать 500 XP',
    icon: 'star', unlocked: state.xp >= 500,
  ),
  CloudyAchievement(
    id: 'a1', title: 'Уровень A1', description: 'Пройти A1',
    icon: 'check', unlocked: (state.completed['A1'] ?? 0) >= 21,
  ),
  CloudyAchievement(
    id: 'tst', title: 'Знаток', description: 'Пройти тест',
    icon: 'target', unlocked: state.tested > 0,
  ),
];

List<CloudyAchievement> newCloudyAchievements(CloudyState state) =>
    cloudyAchievements(state)
        .where((item) => item.unlocked && !state.achievements.contains(item.id))
        .toList(growable: false);

bool hasCloudyProgress(CloudyState state) => state.hasProgress;

/// Mirrors the existing server-side whitelist before a client progress save.
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
  final days = validDays.toList().reversed.take(60).toList().reversed.toList();
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

num _number(Object? value, [num fallback = 0]) =>
    value is num && value.isFinite ? value : fallback;

int _clampInt(num value, int min, int max) =>
    (value.isFinite ? value.toInt() : min).clamp(min, max).toInt();

