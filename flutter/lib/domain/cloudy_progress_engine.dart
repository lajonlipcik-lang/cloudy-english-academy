import 'cloudy_exercise.dart';
import 'cloudy_state.dart';

class CloudySession {
  const CloudySession({
    required this.review, required this.lesson, required this.exercises,
    this.index = 0, this.health = 5, this.combo = 0, this.correct = 0,
    this.total = 0, this.mistakeWords = const [], this.retryPhase = false,
  });

  final bool review;
  final int lesson;
  final List<CloudyExercise> exercises;
  final int index, health, combo, correct, total;
  final List<String> mistakeWords;
  final bool retryPhase;

  CloudySession copyWith({
    int? index, int? health, int? combo, int? correct, int? total,
    List<String>? mistakeWords, bool? retryPhase,
  }) => CloudySession(
    review: review, lesson: lesson, exercises: exercises,
    index: index ?? this.index, health: health ?? this.health,
    combo: combo ?? this.combo, correct: correct ?? this.correct,
    total: total ?? this.total, mistakeWords: mistakeWords ?? this.mistakeWords,
    retryPhase: retryPhase ?? this.retryPhase,
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
  Map<String, List<int>> levelLessonIndices = const {},
}) {
  var state = updateCloudyStreak(rollCloudyDay(original, now), now);
  final gain = cloudyLessonGain(session.health);
  final day = cloudyDayKey(now);
  final days = state.days.contains(day)
      ? List<String>.from(state.days)
      : [...state.days, day].take(60).toList(growable: false);
  final weekCode = cloudyWeekKey(now);
  final week = state.week['k'] != weekCode
      ? <String, Object?>{'k': weekCode, 'xp': 0}
      : Map<String, Object?>.from(state.week);
  week['xp'] = (week['xp'] as num? ?? 0) + gain;

  final today = state.today;
  state = state.copyWith(
    xp: state.xp + gain,
    days: days,
    week: week,
    perfectLessons: state.perfectLessons + (session.health >= 5 && !session.review ? 1 : 0),
    today: CloudyToday(
      d: today.d, xp: today.xp + gain,
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

  final numeric = RegExp(r'^(\\d{4})-(\\d{1,2})-(\\d{1,2})$').firstMatch(value);
  if (numeric != null) {
    return DateTime(
      int.parse(numeric.group(1)!),
      int.parse(numeric.group(2)!),
      int.parse(numeric.group(3)!),
    );
  }

  final match = RegExp(r'^[A-Za-z]{3} ([A-Za-z]{3}) (\\d{1,2}) (\\d{4})$').firstMatch(value);
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
    days: [...{...account.days, ...guest.days}].take(60).toList(growable: false),
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
