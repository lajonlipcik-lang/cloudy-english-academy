import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

import 'cloudy_exercise.dart';

const _learningVersion = 2;
const _maxLearningEvents = 1000;
const _dayMs = 86400000;

class CloudyLearningStore {
  CloudyLearningStore(this._preferences, {required this.scope});

  final SharedPreferences _preferences;
  final String scope;

  String get _key => 'cl2:learning-intelligence:${scope.isEmpty ? 'guest' : scope}'.substring(
    0,
    min('cl2:learning-intelligence:${scope.isEmpty ? 'guest' : scope}'.length, 210),
  );

  static Future<CloudyLearningStore> create({String scope = 'guest'}) async =>
      CloudyLearningStore(await SharedPreferences.getInstance(), scope: scope);

  Map<String, Object?> _read() {
    try {
      final decoded = jsonDecode(_preferences.getString(_key) ?? 'null');
      if (decoded is! Map) return _empty();
      final rawEvents = decoded['events'];
      final rawSkills = decoded['skills'];
      final version = decoded['version'];
      if (rawEvents is! List || rawSkills is! Map || (version != 1 && version != _learningVersion)) {
        return _empty();
      }
      final events = <Map<String, Object?>>[];
      for (final raw in rawEvents) {
        if (raw is! Map) continue;
        final event = _map(raw);
        if (event['eventId'] is String && (event['eventId'] as String).isNotEmpty) {
          events.add(event);
        } else {
          events.add({
            ...event,
            'eventId': _makeId(),
            'eventType': 'answer_submitted',
            'sessionId': null,
            'synced': true,
          });
        }
      }
      return {
        'version': _learningVersion,
        'events': events,
        'skills': _map(rawSkills),
        'activeSession': decoded['activeSession'] is Map ? _map(decoded['activeSession']) : null,
      };
    } catch (_) {
      return _empty();
    }
  }

  Map<String, Object?> _empty() => {
    'version': _learningVersion,
    'events': <Map<String, Object?>>[],
    'skills': <String, Object?>{},
    'activeSession': null,
  };

  Future<void> _save(Map<String, Object?> data) async {
    final events = (data['events'] as List).cast<Map<String, Object?>>();
    if (events.length > _maxLearningEvents) {
      final overflow = events.length - _maxLearningEvents;
      final acknowledged = events.where((event) => event['synced'] == true).take(overflow);
      final remove = acknowledged.map((event) => event['eventId']).whereType<String>().toSet();
      data['events'] = events.where((event) => !remove.contains(event['eventId'])).toList();
      final remaining = (data['events'] as List).cast<Map<String, Object?>>();
      if (remaining.length > _maxLearningEvents) {
        remaining.removeRange(0, remaining.length - _maxLearningEvents);
      }
    }
    await _preferences.setString(_key, jsonEncode(data));
  }

  Future<Map<String, Object?>> _append(
    Map<String, Object?> data,
    Map<String, Object?> event,
  ) async {
    (data['events'] as List).add(event);
    await _save(data);
    return event;
  }

  Future<Map<String, Object?>?> track(
    String eventType, {
    CloudyExercise? exercise,
    String? skillId,
    int? questionIndex,
    String? exerciseType,
    DateTime? now,
  }) async {
    if (!const {'question_opened', 'question_skipped', 'hint_used'}.contains(eventType)) {
      return null;
    }
    final data = _read();
    final session = _map(data['activeSession']);
    final event = <String, Object?>{
      'eventId': _makeId(),
      'eventType': eventType,
      'at': (now ?? DateTime.now()).millisecondsSinceEpoch,
      'sessionId': session['sessionId'],
      'level': session['level'],
      'lessonIndex': session['lessonIndex'],
      'exerciseType': _cleanText(exerciseType ?? exercise?.kind, 24),
      'skillId': _cleanText(skillId ?? (exercise == null ? '' : _skillFor(exercise)), 90),
      'questionIndex': questionIndex == null ? null : questionIndex.clamp(0, 1000),
      'correct': null,
      'retry': false,
      'responseSeconds': null,
      'selectedAnswer': null,
      'correctAnswer': null,
      'synced': false,
    };
    return _append(data, event);
  }

  Future<String> beginSession({
    String? level,
    int? lessonIndex,
    bool review = false,
    DateTime? now,
  }) async {
    var data = _read();
    final active = _map(data['activeSession']);
    if (active['sessionId'] is String) {
      await endSession('lesson_abandoned', now: now);
      data = _read();
    }
    final startedAt = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final sessionId = _makeId();
    final session = <String, Object?>{
      'sessionId': sessionId,
      'startedAt': startedAt,
      'level': const {'A1', 'A2', 'B1', 'B2'}.contains(level) ? level : null,
      'lessonIndex': lessonIndex == null ? null : lessonIndex.clamp(-1, 1000),
      'sessionType': review ? 'review' : 'lesson',
    };
    data['activeSession'] = session;
    await _save(data);
    await _append(data, {
      'eventId': _makeId(),
      'eventType': 'session_started',
      'at': startedAt,
      'sessionId': sessionId,
      'level': session['level'],
      'lessonIndex': session['lessonIndex'],
      'exerciseType': null,
      'skillId': null,
      'correct': null,
      'retry': false,
      'responseSeconds': null,
      'selectedAnswer': null,
      'correctAnswer': null,
      'sessionType': session['sessionType'],
      'synced': false,
    });
    return sessionId;
  }

  Future<Map<String, Object?>?> endSession([
    String outcome = 'lesson_completed', {
    DateTime? now,
  }]) async {
    final data = _read();
    final session = _map(data['activeSession']);
    final sessionId = session['sessionId'];
    if (sessionId is! String || sessionId.isEmpty) return null;
    final eventType = const {'lesson_completed', 'lesson_failed', 'lesson_abandoned'}.contains(outcome)
        ? outcome
        : 'lesson_abandoned';
    data['activeSession'] = null;
    return _append(data, {
      'eventId': _makeId(),
      'eventType': eventType,
      'at': (now ?? DateTime.now()).millisecondsSinceEpoch,
      'sessionId': sessionId,
      'level': session['level'],
      'lessonIndex': session['lessonIndex'],
      'exerciseType': null,
      'skillId': null,
      'correct': null,
      'retry': false,
      'responseSeconds': null,
      'selectedAnswer': null,
      'correctAnswer': null,
      'sessionType': session['sessionType'],
      'synced': false,
    });
  }

  Future<Map<String, Object?>?> record(
    CloudyExercise exercise, {
    required bool correct,
    bool retry = false,
    bool skipped = false,
    int? questionIndex,
    num? responseSeconds,
    String? selectedAnswer,
    String? correctAnswer,
    DateTime? now,
  }) async {
    if (skipped) return null;
    final data = _read();
    final timestamp = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final skillId = _skillFor(exercise);
    final skills = _map(data['skills']);
    final prior = _map(skills[skillId]);
    final masteryBefore = _number(prior['mastery'], 0.5);
    final evidenceBefore = _number(prior['evidence']);
    final weight = retry ? 0.35 : 1.0;
    final outcome = correct ? 1.0 : 0.0;
    final mastery = _clamp(masteryBefore + (outcome - masteryBefore) * (0.22 * weight), 0.05, 0.98);
    final evidence = min(1000.0, evidenceBefore + weight);
    final nextSkill = <String, Object?>{
      'mastery': mastery,
      'evidence': evidence,
      'correct': _number(prior['correct']) + (correct ? 1 : 0),
      'incorrect': _number(prior['incorrect']) + (correct ? 0 : 1),
      'lastPracticed': timestamp,
      'dueAt': timestamp + _scheduleDays(mastery, evidence) * _dayMs,
    };
    skills[skillId] = nextSkill;
    data['skills'] = skills;
    final session = _map(data['activeSession']);
    await _append(data, {
      'eventId': _makeId(),
      'eventType': 'answer_submitted',
      'at': timestamp,
      'sessionId': session['sessionId'],
      'level': session['level'],
      'lessonIndex': session['lessonIndex'],
      'skillId': skillId,
      'exerciseType': _cleanText(exercise.kind, 24),
      'questionIndex': questionIndex == null ? null : questionIndex.clamp(0, 1000),
      'correct': correct,
      'retry': retry,
      'responseSeconds': responseSeconds == null ? null : _clamp(responseSeconds.round(), 0, 3600),
      'selectedAnswer': _cleanText(selectedAnswer, 160),
      'correctAnswer': _cleanText(correctAnswer ?? _defaultAnswer(exercise), 160),
      'synced': false,
    });
    return {'skillId': skillId, ...nextSkill};
  }

  Map<String, Object?> profile({DateTime? now}) {
    final data = _read();
    final timestamp = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final skills = <Map<String, Object?>>[];
    for (final entry in _map(data['skills']).entries) {
      final skill = _map(entry.value);
      skills.add({
        'id': entry.key,
        ...skill,
        'due': _number(skill['dueAt']) <= timestamp,
      });
    }
    skills.sort((a, b) => _number(a['mastery']).compareTo(_number(b['mastery'])));
    final answers = (data['events'] as List).cast<Map<String, Object?>>()
        .where((event) => event['eventType'] == 'answer_submitted').toList();
    final recent = answers.reversed.take(20).toList().reversed.map((event) => {
      'at': event['at'],
      'skillId': event['skillId'],
      'exerciseType': event['exerciseType'],
      'correct': event['correct'],
      'retry': event['retry'],
    }).toList(growable: false);
    return {
      'version': _learningVersion,
      'attempts': answers.length,
      'skills': skills,
      'dueCount': skills.where((skill) => skill['due'] == true).length,
      'recentEvents': recent,
    };
  }

  List<Map<String, Object?>> pending({int limit = 50}) {
    final events = (_read()['events'] as List).cast<Map<String, Object?>>();
    final safeLimit = _clamp(limit <= 0 ? 50 : limit, 1, 50);
    return events.where((event) => event['synced'] != true && event['eventId'] != null)
        .take(safeLimit)
        .map((event) => Map<String, Object?>.from(event)..remove('synced'))
        .toList(growable: false);
  }

  Future<int> acknowledge(Iterable<String> eventIds) async {
    final accepted = eventIds.toSet();
    if (accepted.isEmpty) return 0;
    final data = _read();
    var count = 0;
    final events = (data['events'] as List).cast<Map<String, Object?>>();
    data['events'] = events.map((event) {
      if (event['synced'] != true && accepted.contains(event['eventId'])) {
        count++;
        return {...event, 'synced': true};
      }
      return event;
    }).toList();
    await _save(data);
    return count;
  }

  List<CloudyExercise> prioritize(
    List<CloudyExercise> exercises, {
    DateTime? now,
  }) {
    final data = _read();
    final timestamp = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final skills = _map(data['skills']);
    final ranked = <({CloudyExercise exercise, int index, num score})>[];
    for (var index = 0; index < exercises.length; index++) {
      final exercise = exercises[index];
      final skill = _map(skills[_skillFor(exercise)]);
      final hasSkill = skill.isNotEmpty;
      final due = hasSkill && _number(skill['dueAt']) <= timestamp;
      final weakness = hasSkill ? 1 - _number(skill['mastery'], 0.5) : 0.25;
      ranked.add((exercise: exercise, index: index, score: (due ? 2 : 0) + weakness));
    }
    ranked.sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      return byScore != 0 ? byScore : a.index.compareTo(b.index);
    });
    return ranked.map((item) => item.exercise).toList(growable: false);
  }

  static String _skillFor(CloudyExercise exercise) {
    final json = exercise.toJson();
    final skillId = json['skillId'];
    if (skillId is String && skillId.isNotEmpty) return _cleanText(skillId, 90);
    final english = json['en'];
    if (english is String && english.isNotEmpty) return 'vocabulary:${english.toLowerCase().trim()}';
    if (exercise.kind == 'b') return 'grammar:sentence-building';
    if (exercise.kind == 'm') return 'vocabulary:matching';
    if (exercise.kind == 'p') return 'pronunciation:${(english ?? '').toString().toLowerCase().trim()}';
    return 'grammar:${exercise.kind.isEmpty ? 'unknown' : exercise.kind}';
  }

  static String _defaultAnswer(CloudyExercise exercise) {
    final json = exercise.toJson();
    return (json['a'] ?? json['en'] ?? '').toString();
  }

  static int _scheduleDays(num mastery, num evidence) =>
      evidence < 2 || mastery < 0.55 ? 1 :
      mastery < 0.7 ? 2 :
      mastery < 0.82 ? 4 :
      mastery < 0.92 ? 7 : 14;

  static num _clamp(num value, num low, num high) =>
      value < low ? low : value > high ? high : value;

  static num _number(Object? value, [num fallback = 0]) =>
      value is num && value.isFinite ? value : fallback;

  static String _cleanText(Object? value, int max) => (value ?? '')
      .toString()
      .replaceAll(RegExp(r'[ -]'), ' ')
      .replaceAll(RegExp(r's+'), ' ')
      .trim()
      .substring(0, min((value ?? '').toString().replaceAll(RegExp(r'[ -]'), ' ').replaceAll(RegExp(r's+'), ' ').trim().length, max));

  static Map<String, Object?> _map(Object? value) {
    if (value is Map<String, Object?>) return value;
    if (value is Map) return value.map((key, value) => MapEntry(key.toString(), value));
    return <String, Object?>{};
  }

  static String _makeId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
