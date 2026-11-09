enum CloudyLevel { a1, a2, b1, b2 }

extension CloudyLevelCode on CloudyLevel {
  String get code => switch (this) {
    CloudyLevel.a1 => 'A1',
    CloudyLevel.a2 => 'A2',
    CloudyLevel.b1 => 'B1',
    CloudyLevel.b2 => 'B2',
  };

  static CloudyLevel? fromCode(Object? value) => switch (value) {
    'A1' => CloudyLevel.a1,
    'A2' => CloudyLevel.a2,
    'B1' => CloudyLevel.b1,
    'B2' => CloudyLevel.b2,
    _ => null,
  };
}

class CloudySettings {
  const CloudySettings({
    this.snd = 1, this.vol = 0.7, this.voice = 1, this.goal = 30,
    this.mic = 1, this.th = 'dark', this.rem = 0, this.remT = '19:00',
  });
  final num snd, vol, voice, goal, mic, rem;
  final String th, remT;

  factory CloudySettings.fromJson(Object? raw) {
    final map = _record(raw);
    return CloudySettings(
      snd: _number(map['snd'], 1), vol: _number(map['vol'], 0.7),
      voice: _number(map['voice'], 1), goal: _number(map['goal'], 30),
      mic: _number(map['mic'], 1), th: map['th'] == 'light' ? 'light' : 'dark',
      rem: _number(map['rem']), remT: map['remT'] is String ? map['remT'] as String : '19:00',
    );
  }

  Map<String, Object?> toJson() => {
    'snd': snd, 'vol': vol, 'voice': voice, 'goal': goal,
    'mic': mic, 'th': th, 'rem': rem, 'remT': remT,
  };
}

class CloudyToday {
  const CloudyToday({this.d = '', this.xp = 0, this.les = 0, this.ok = 0, this.claim = 0});
  final num xp, les, ok, claim;
  final String d;

  factory CloudyToday.fromJson(Object? raw) {
    final map = _record(raw);
    return CloudyToday(
      d: map['d'] is String ? map['d'] as String : '',
      xp: _number(map['xp']), les: _number(map['les']),
      ok: _number(map['ok']), claim: _number(map['claim']),
    );
  }

  Map<String, Object?> toJson() => {'d': d, 'xp': xp, 'les': les, 'ok': ok, 'claim': claim};
}

/// Dart representation of the existing Cloudy progress JSON contract.
/// Keys intentionally match the current web app and Supabase payload.
class CloudyState {
  const CloudyState({
    this.xp = 0, this.streak = 0, this.last = '', this.level,
    this.completed = const {'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0},
    this.accuracy = const [0, 0], this.mistakes = const {},
    this.days = const [], this.achievements = const [],
    this.week = const {'k': '', 'xp': 0}, this.perfectLessons = 0, this.tested = 0,
    this.settings = const CloudySettings(), this.today = const CloudyToday(),
  });

  final num xp, streak, perfectLessons, tested;
  final String last;
  final CloudyLevel? level;
  final Map<String, num> completed, mistakes;
  final List<num> accuracy;
  final List<String> days, achievements;
  final Map<String, Object?> week;
  final CloudySettings settings;
  final CloudyToday today;

  factory CloudyState.defaults() => const CloudyState();

  /// Mirrors normalizeState() in the current TypeScript learning engine,
  /// including legacy saves that used a single "done" counter.
  factory CloudyState.fromJson(Object? raw) {
    final map = _record(raw);
    if (map.isEmpty) return CloudyState.defaults();

    final savedDn = _record(map['dn']);
    final completed = <String, num>{
      'A1': _number(savedDn['A1']), 'A2': _number(savedDn['A2']),
      'B1': _number(savedDn['B1']), 'B2': _number(savedDn['B2']),
    };
    final rawAccuracy = map['acc'];
    final accuracy = rawAccuracy is List && rawAccuracy.length == 2
        ? <num>[_number(rawAccuracy[0]), _number(rawAccuracy[1])]
        : <num>[0, 0];

    final mistakes = <String, num>{};
    for (final entry in _record(map['mis']).entries) {
      final value = entry.value;
      if (value is num && value.isFinite && value > 0) mistakes[entry.key] = value;
    }

    final rawWeek = _record(map['wk']);
    final rawDays = map['days'];
    final rawAchievements = map['ach'];
    final state = CloudyState(
      xp: _number(map['xp']), streak: _number(map['streak']),
      last: map['last'] is String ? map['last'] as String : '',
      level: CloudyLevelCode.fromCode(map['lv']),
      completed: completed, accuracy: accuracy, mistakes: mistakes,
      days: rawDays is List ? rawDays.whereType<String>().toList(growable: false) : const [],
      achievements: rawAchievements is List ? rawAchievements.whereType<String>().toList(growable: false) : const [],
      week: {
        'k': rawWeek['k'] is String ? rawWeek['k'] : '',
        'xp': _number(rawWeek['xp']),
      },
      perfectLessons: _number(map['perf']), tested: _number(map['tested']),
      settings: CloudySettings.fromJson(map['set']),
      today: CloudyToday.fromJson(map['td']),
    );

    if (!map.containsKey('dn') && _number(map['done']) != 0 && !map.containsKey('lv')) {
      return CloudyState(
        xp: state.xp, streak: state.streak, last: state.last,
        level: CloudyLevel.a1,
        completed: {...state.completed, 'A1': _number(map['done'])},
        accuracy: state.accuracy, mistakes: state.mistakes,
        days: state.days, achievements: state.achievements, week: state.week,
        perfectLessons: state.perfectLessons, tested: state.tested,
        settings: state.settings, today: state.today,
      );
    }
    return state;
  }

  Map<String, Object?> toJson() => {
    'xp': xp, 'streak': streak, 'last': last, 'lv': level?.code ?? '',
    'dn': {'A1': completed['A1'] ?? 0, 'A2': completed['A2'] ?? 0, 'B1': completed['B1'] ?? 0, 'B2': completed['B2'] ?? 0},
    'acc': accuracy, 'mis': mistakes, 'days': days, 'ach': achievements,
    'wk': week, 'perf': perfectLessons, 'tested': tested,
    'set': settings.toJson(), 'td': today.toJson(),
  };

  bool get hasProgress => xp > 0 || tested > 0 || completed.values.any((v) => v > 0) || level != null;
}

Map<String, Object?> _record(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.map((key, value) => MapEntry(key.toString(), value));
  return <String, Object?>{};
}

num _number(Object? value, [num fallback = 0]) =>
    value is num && value.isFinite ? value : fallback;
