import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'cloudy_exercise.dart';

class CloudySentence {
  const CloudySentence({required this.russian, required this.english, required this.distractors});
  final String russian, english, distractors;

  factory CloudySentence.fromJson(Object? value) {
    if (value is List) {
      return CloudySentence(
        russian: value.isNotEmpty ? value[0].toString() : '',
        english: value.length > 1 ? value[1].toString() : '',
        distractors: value.length > 2 ? value[2].toString() : '',
      );
    }
    return const CloudySentence(russian: '', english: '', distractors: '');
  }
}

class CloudyLesson {
  const CloudyLesson({required this.title, required this.vocabulary, required this.sentences});
  final String title;
  final List<CloudyPair> vocabulary;
  final List<CloudySentence> sentences;

  factory CloudyLesson.fromJson(Object? value) {
    final map = _map(value);
    return CloudyLesson(
      title: map['t'] is String ? map['t'] as String : '',
      vocabulary: _list(map['w']).map(CloudyPair.fromJson).toList(growable: false),
      sentences: _list(map['s']).map(CloudySentence.fromJson).toList(growable: false),
    );
  }
}

class CloudySection {
  const CloudySection({required this.name, required this.lessonIndices});
  final String name;
  final List<int> lessonIndices;

  factory CloudySection.fromJson(Object? value) {
    final map = _map(value);
    return CloudySection(
      name: map['n'] is String ? map['n'] as String : '',
      lessonIndices: _list(map['l']).whereType<num>().map((v) => v.toInt()).toList(growable: false),
    );
  }
}

class CloudyFoundationTopic {
  const CloudyFoundationTopic({
    required this.title, required this.body, required this.examples,
    required this.tip, this.level,
  });
  final String title, body, tip;
  final String? level;
  final List<CloudyPair> examples;

  factory CloudyFoundationTopic.fromJson(Object? value) {
    final map = _map(value);
    return CloudyFoundationTopic(
      title: map['title'] is String ? map['title'] as String : '',
      body: map['body'] is String ? map['body'] as String : '',
      tip: map['tip'] is String ? map['tip'] as String : '',
      level: map['level'] is String ? map['level'] as String : null,
      examples: _list(map['examples']).map(CloudyPair.fromJson).toList(growable: false),
    );
  }
}

/// Immutable copy of the exact catalog currently used by Cloudy web runtime.
class CloudyCurriculum {
  const CloudyCurriculum({
    required this.lessons, required this.levels, required this.foundations,
  });

  final List<CloudyLesson> lessons;
  final Map<String, List<CloudySection>> levels;
  final Map<int, CloudyFoundationTopic> foundations;

  static Future<CloudyCurriculum> load() async {
    final source = await rootBundle.loadString('assets/cloudy_catalog.json');
    return CloudyCurriculum.fromJson(jsonDecode(source));
  }

  factory CloudyCurriculum.fromJson(Object? value) {
    final root = _map(value);
    final lessons = _list(root['lessons'])
        .map(CloudyLesson.fromJson).toList(growable: false);

    final levels = <String, List<CloudySection>>{};
    for (final entry in _map(root['levels']).entries) {
      levels[entry.key] = _list(_map(entry.value)['s'])
          .map(CloudySection.fromJson).toList(growable: false);
    }

    final foundations = <int, CloudyFoundationTopic>{};
    for (final entry in _map(root['foundations']).entries) {
      final index = int.tryParse(entry.key);
      if (index != null) foundations[index] = CloudyFoundationTopic.fromJson(entry.value);
    }

    return CloudyCurriculum(
      lessons: lessons,
      levels: Map.unmodifiable(levels),
      foundations: Map.unmodifiable(foundations),
    );
  }

  CloudyLesson? lesson(int index) =>
      index >= 0 && index < lessons.length ? lessons[index] : null;

  List<int> lessonIndicesForLevel(String level) => [
    for (final section in levels[level] ?? const <CloudySection>[])
      ...section.lessonIndices,
  ];

  List<CloudySection> sectionsForLevel(String level) =>
      levels[level] ?? const <CloudySection>[];

  CloudyFoundationTopic? foundation(int index) => foundations[index];
}

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.map((key, value) => MapEntry(key.toString(), value));
  return <String, Object?>{};
}

List<Object?> _list(Object? value) =>
    value is List ? value.cast<Object?>() : const <Object?>[];
