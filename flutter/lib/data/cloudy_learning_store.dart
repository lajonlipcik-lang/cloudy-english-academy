import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/cloudy_learning.dart';
import '../domain/cloudy_logic.dart';

const int _learningVersion = 2;
const int _maxLearningEvents = 1000;

class CloudyLearningState {
  const CloudyLearningState({
    this.version = _learningVersion,
    this.events = const [],
    this.skills = const {},
    this.activeSession,
  });

  final int version;
  final List<Map<String, Object?>> events;
  final Map<String, CloudySkillEvidence> skills;
  final Map<String, Object?>? activeSession;

  factory CloudyLearningState.empty() => const CloudyLearningState();

  factory CloudyLearningState.fromJson(Object? raw) {
    final root = _map(raw);
    final version = root['version'];
    final rawEvents = root['events'];
    final rawSkills = root['skills'];
    if ((version != 1 && version != _learningVersion) ||
        rawEvents is! List ||
        rawSkills is! Map) {
      return CloudyLearningState.empty();
    }

    final events = <Map<String, Object?>>[];
    for (final rawEvent in rawEvents) {
      if (rawEvent is! Map) continue;
      final event = _map(rawEvent);
      final eventId = event['eventId'];
      if (eventId is String && eventId.isNotEmpty) {
        events.add(event);
      } else {
        events.add({
          ...event,
          'eventId': _newId(),
          'eventType': 'answer_submitted',
          'sessionId': null,
          'synced': true,
        });
      }
    }

    final skills = <String, CloudySkillEvidence>{};
    for (final entry in rawSkills.entries) {
      skills[entry.key.toString()] = CloudySkillEvidence.fromJson(entry.value);
    }

    final active = root['activeSession'];
    return CloudyLearningState(
      version: _learningVersion,
      events: List.unmodifiable(events),
      skills: Map.unmodifiable(skills),
      activeSession: active is Map ? Map.unmodifiable(_map(active)) : null,
    );
  }

  Map<String, Object?> toJson() => {
    'version': _learningVersion,
    'events': events,
    'skills': skills.map((key, value) => MapEntry(key, value.toJson())),
    'activeSession': activeSession,
  };

  CloudyLearningState copyWith({
    List<Map<String, Object?>>? events,
    Map<String, CloudySkillEvidence>? skills,
    Map<String, Object?>? activeSession,
    bool clearActiveSession = false,
  }) => CloudyLearningState(
    version: _learningVersion,
    events: events ?? this.events,
    skills: skills ?? this.skills,
    activeSession: clearActiveSession ? null : (activeSession ?? this.activeSession),
  );
}

class CloudyLearningRepository {
  CloudyLearningRepository({SharedPreferences? preferences})
      : _preferences = preferences;

  final SharedPreferences? _preferences;

  Future<SharedPreferences> get _store async =>
      _preferences ?? SharedPreferences.getInstance();

  static String storageKey(String scope) =>
      'cl2:learning-intelligence:${(scope.isEmpty ? 'guest' : scope).substring(0, (scope.isEmpty ? 'guest' : scope).length.clamp(0, 180))}';

  Future<CloudyLearningState> load(String scope) async {
    final preferences = await _store;
    try {
      final raw = preferences.getString(storageKey(scope));
      if (raw == null || raw.isEmpty) return CloudyLearningState.empty();
      return CloudyLearningState.fromJson(jsonDecode(raw));
    } catch (_) {
      return CloudyLearningState.empty();
    }
  }

  Future<void> save(String scope, CloudyLearningState state) async {
    final preferences = await _store;
    final events = List<Map<String, Object?>>.of(state.events);
    if (events.length > _maxLearningEvents) {
      final overflow = events.length - _maxLearningEvents;
      final acknowledged = events
          .where((event) => event['synced'] == true)
          .take(overflow)
          .map((event) => event['eventId'])
          .whereType<String>()
          .toSet();
      events.removeWhere((event) => acknowledged.contains(event['eventId']));
      if (events.length > _maxLearningEvents) {
        events.removeRange(0, events.length - _maxLearningEvents);
      }
    }
    final safe = state.copyWith(events: List.unmodifiable(events));
    await preferences.setString(storageKey(scope), jsonEncode(safe.toJson()));
  }

  Future<String> beginSession(
    String scope, {
    required String level,
    required int lessonIndex,
    String sessionType = 'lesson',
    int? nowMillis,
  }) async {
    var state = await load(scope);
    if (state.activeSession?['sessionId'] is String) {
      await endSession(scope, outcome: 'lesson_abandoned', nowMillis: nowMillis);
      state = await load(scope);
    }

    final startedAt = nowMillis ?? DateTime.now().millisecondsSinceEpoch;
    final sessionId = _newId();
    final session = <String, Object?>{
      'sessionId': sessionId,
      'startedAt': startedAt,
      'level': const ['A1', 'A2', 'B1', 'B2'].contains(level) ? level : null,
      'lessonIndex': lessonIndex.clamp(-1, 1000).toInt(),
      'sessionType': sessionType == 'review' ? 'review' : 'lesson',
    };
    final event = _event(
      eventType: 'session_started',
      at: startedAt,
      sessionId: sessionId,
      level: session['level'] as String?,
      lessonIndex: session['lessonIndex'] as int,
      sessionType: session['sessionType'] as String,
    );
    await save(scope, state.copyWith(
      activeSession: session,
      events: [...state.events, event],
    ));
    return sessionId;
  }

  Future<void> endSession(
    String scope, {
    String outcome = 'lesson_completed',
    int? nowMillis,
  }) async {
    final state = await load(scope);
    final session = state.activeSession;
    final sessionId = session?['sessionId'];
    if (sessionId is! String || sessionId.isEmpty) return;
    final allowed = const ['lesson_completed', 'lesson_failed', 'lesson_abandoned'];
    final eventType = allowed.contains(outcome) ? outcome : 'lesson_abandoned';
    final event = _event(
      eventType: eventType,
      at: nowMillis ?? DateTime.now().millisecondsSinceEpoch,
      sessionId: sessionId,
      level: session?['level'] as String?,
      lessonIndex: session?['lessonIndex'] is int ? session?['lessonIndex'] as int : null,
      sessionType: session?['sessionType'] as String?,
    );
    await save(scope, state.copyWith(
      clearActiveSession: true,
      events: [...state.events, event],
    ));
  }

  Future<void> track(
    String scope,
    String eventType, {
    CloudyExercise? exercise,
    String? skillId,
    int? questionIndex,
    int? nowMillis,
  }) async {
    if (!const ['question_opened', 'question_skipped', 'hint_used'].contains(eventType)) return;
    final state = await load(scope);
    final session = state.activeSession;
    final event = _event(
      eventType: eventType,
      at: nowMillis ?? DateTime.now().millisecondsSinceEpoch,
      sessionId: session?['sessionId'] as String?,
      level: session?['level'] as String?,
      lessonIndex: session?['lessonIndex'] is int ? session?['lessonIndex'] as int : null,
      exerciseType: exercise == null ? null : _exerciseCode(exercise.kind),
      skillId: skillId ?? (exercise == null ? null : cloudySkillFor(exercise)),
      questionIndex: questionIndex == null ? null : questionIndex.clamp(0, 1000).toInt(),
    );
    await save(scope, state.copyWith(events: [...state.events, event]));
  }

  Future<CloudySkillEvidence> record(
    String scope,
    CloudyExercise exercise,
    bool correct, {
    bool retry = false,
    int? responseSeconds,
    int? questionIndex,
    String? selectedAnswer,
    String? correctAnswer,
    int? nowMillis,
  }) async {
    final state = await load(scope);
    final now = nowMillis ?? DateTime.now().millisecondsSinceEpoch;
    final update = recordCloudyAnswer(
      state.skills,
      exercise,
      correct,
      nowMillis: now,
      retry: retry,
    );
    final session = state.activeSession;
    final event = _event(
      eventType: 'answer_submitted',
      at: now,
      sessionId: session?['sessionId'] as String?,
      level: session?['level'] as String?,
      lessonIndex: session?['lessonIndex'] is int ? session?['lessonIndex'] as int : null,
      exerciseType: _exerciseCode(exercise.kind),
      skillId: update.skillId,
      questionIndex: questionIndex == null ? null : questionIndex.clamp(0, 1000).toInt(),
      correct: correct,
      retry: retry,
      responseSeconds: responseSeconds == null ? null : responseSeconds.clamp(0, 3600).toInt(),
      selectedAnswer: selectedAnswer,
      correctAnswer: correctAnswer ?? (exercise.answer.isNotEmpty ? exercise.answer : exercise.english),
    );
    await save(scope, state.copyWith(
      skills: update.skills,
      events: [...state.events, event],
    ));
    return update.evidence;
  }

  Future<List<CloudyExercise>> prioritize(
    String scope,
    List<CloudyExercise> exercises, {
    int? nowMillis,
  }) async {
    final state = await load(scope);
    return prioritizeCloudyExercises(
      exercises,
      state.skills,
      nowMillis: nowMillis ?? DateTime.now().millisecondsSinceEpoch,
    );
  }

  Future<CloudyLearningProfile> profile(String scope, {int? nowMillis}) async {
    final state = await load(scope);
    return buildCloudyLearningProfile(
      state.skills,
      nowMillis: nowMillis ?? DateTime.now().millisecondsSinceEpoch,
    );
  }

  Future<List<Map<String, Object?>>> pending(String scope, {int limit = 50}) async {
    final state = await load(scope);
    final bounded = limit.clamp(1, 50).toInt();
    return state.events
        .where((event) => event['synced'] != true && event['eventId'] is String)
        .take(bounded)
        .map((event) => Map<String, Object?>.of(event)..remove('synced'))
        .toList(growable: false);
  }

  Future<int> acknowledge(String scope, List<String> eventIds) async {
    if (eventIds.isEmpty) return 0;
    final state = await load(scope);
    final accepted = eventIds.toSet();
    var count = 0;
    final events = state.events.map((event) {
      if (event['synced'] != true && accepted.contains(event['eventId'])) {
        count++;
        return {...event, 'synced': true};
      }
      return event;
    }).toList(growable: false);
    if (count > 0) await save(scope, state.copyWith(events: events));
    return count;
  }

  Map<String, Object?> _event({
    required String eventType,
    required int at,
    String? sessionId,
    String? level,
    int? lessonIndex,
    String? exerciseType,
    String? skillId,
    int? questionIndex,
    bool? correct,
    bool retry = false,
    int? responseSeconds,
    String? selectedAnswer,
    String? correctAnswer,
    String? sessionType,
  }) => {
    'eventId': _newId(),
    'eventType': eventType,
    'at': at,
    'sessionId': sessionId,
    'level': level,
    'lessonIndex': lessonIndex,
    'exerciseType': _clean(selectedAnswer == null ? (exerciseType ?? '') : (exerciseType ?? ''), 24).isEmpty ? null : exerciseType,
    'skillId': _clean(skillId ?? '', 90).isEmpty ? null : _clean(skillId ?? '', 90),
    'questionIndex': questionIndex,
    'correct': correct,
    'retry': retry,
    'responseSeconds': responseSeconds,
    'selectedAnswer': _clean(selectedAnswer ?? '', 160).isEmpty ? null : _clean(selectedAnswer ?? '', 160),
    'correctAnswer': _clean(correctAnswer ?? '', 160).isEmpty ? null : _clean(correctAnswer ?? '', 160),
    if (sessionType != null) 'sessionType': sessionType,
    'synced': false,
  };

  static String _exerciseCode(CloudyExerciseKind kind) => switch (kind) {
    CloudyExerciseKind.grammar => 't',
    CloudyExerciseKind.vocabulary => 'v',
    CloudyExerciseKind.recall => 'r',
    CloudyExerciseKind.choice => 'c',
    CloudyExerciseKind.listening => 'l',
    CloudyExerciseKind.builder => 'b',
    CloudyExerciseKind.matching => 'm',
    CloudyExerciseKind.pronunciation => 'p',
  };
}

String _clean(String value, int max) {
  final normalized = value
      .replaceAll(RegExp(r'[\u0000-\u001f\u007f]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return normalized.substring(0, normalized.length.clamp(0, max).toInt());
}

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.map((key, item) => MapEntry(key.toString(), item));
  return const {};
}

String _newId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
