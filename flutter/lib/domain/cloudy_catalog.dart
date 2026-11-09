import 'dart:convert';

import 'package:flutter/services.dart';

import 'cloudy_exercise.dart';
import 'cloudy_learning_store.dart';
import 'cloudy_logic.dart';

class CloudySection {
  const CloudySection({required this.name, required this.lessonIndices});
  final String name;
  final List<int> lessonIndices;
}

class CloudyFoundation {
  const CloudyFoundation({
    required this.title,
    required this.body,
    required this.examples,
    required this.tip,
  });
  final String title;
  final String body;
  final List<CloudyPair> examples;
  final String tip;
}

/// Immutable, typed view of the exact bilingual curriculum shipped with Cloudy.
class CloudyCatalog {
  const CloudyCatalog({
    required this.lessons,
    required this.levels,
    required this.foundations,
  });

  final List<CloudyLesson> lessons;
  final Map<String, List<CloudySection>> levels;
  final Map<int, CloudyFoundation> foundations;

  static Future<CloudyCatalog> load({
    String assetPath = 'assets/cloudy_catalog.json',
  }) async {
    final source = await rootBundle.loadString(assetPath);
    final decoded = jsonDecode(source);
    return CloudyCatalog.fromJson(decoded);
  }

  factory CloudyCatalog.fromJson(Object? source) {
    final root = _asMap(source);
    final rawLessons = _asList(root['lessons']);
    final lessons = rawLessons.map((rawLesson) {
      final lesson = _asMap(rawLesson);
      final words = _asList(lesson['w'])
          .map(_parseWordPair)
          .whereType<CloudyPair>()
          .toList(growable: false);
      final sentences = _asList(lesson['s'])
          .map(_parseSentence)
          .whereType<CloudyPair>()
          .toList(growable: false);
      return CloudyLesson(
        title: _asString(lesson['t']),
        words: List.unmodifiable(words),
        sentences: List.unmodifiable(sentences),
      );
    }).toList(growable: false);

    final levels = <String, List<CloudySection>>{};
    for (final entry in _asMap(root['levels']).entries) {
      final rawSections = _asList(_asMap(entry.value)['s']);
      levels[entry.key] = List.unmodifiable(rawSections.map((rawSection) {
        final section = _asMap(rawSection);
        final indices = _asList(section['l'])
            .whereType<num>()
            .map((value) => value.toInt())
            .toList(growable: false);
        return CloudySection(
          name: _asString(section['n']),
          lessonIndices: List.unmodifiable(indices),
        );
      }));
    }

    final foundations = <int, CloudyFoundation>{};
    for (final entry in _asMap(root['foundations']).entries) {
      final index = int.tryParse(entry.key);
      if (index == null) continue;
      final foundation = _asMap(entry.value);
      final examples = _asList(foundation['examples'])
          .map(_parseFoundationExample)
          .whereType<CloudyPair>()
          .toList(growable: false);
      foundations[index] = CloudyFoundation(
        title: _asString(foundation['title']),
        body: _asString(foundation['body']),
        examples: List.unmodifiable(examples),
        tip: _asString(foundation['tip']),
      );
    }

    return CloudyCatalog(
      lessons: List.unmodifiable(lessons),
      levels: Map.unmodifiable(levels),
      foundations: Map.unmodifiable(foundations),
    );
  }

  List<CloudyPair> get vocabularyPool => List.unmodifiable(
        lessons.expand((lesson) => lesson.words),
      );

  CloudyLesson? lessonAt(int index) =>
      index >= 0 && index < lessons.length ? lessons[index] : null;

  CloudyFoundation? foundationAt(int lessonIndex) => foundations[lessonIndex];

  CloudyTheoryExercise? grammarExerciseAt(int lessonIndex, {String? level}) {
    final foundation = foundationAt(lessonIndex);
    if (foundation == null) return null;
    return CloudyTheoryExercise(
      title: foundation.title,
      body: foundation.body,
      examples: foundation.examples,
      tip: foundation.tip,
      level: level,
    );
  }

  List<CloudyExercise> buildLessonSequence(
    int lessonIndex, {
    required String level,
    required bool microphoneEnabled,
    required bool speechRecognitionAvailable,
    CloudyRand? random,
  }) {
    final lesson = lessonAt(lessonIndex);
    if (lesson == null) return const [];
    return buildCloudyLessonSequence(
      lessonIndex: lessonIndex,
      lesson: lesson,
      level: level,
      vocabularyPool: vocabularyPool,
      microphoneEnabled: microphoneEnabled,
      speechRecognitionAvailable: speechRecognitionAvailable,
      grammarIntro: grammarExerciseAt(lessonIndex, level: level),
      random: random,
    );
  }

  List<CloudyExercise> buildAdaptiveLessonSequence(
    int lessonIndex, {
    required String level,
    required bool microphoneEnabled,
    required bool speechRecognitionAvailable,
    required CloudyLearningStore learningStore,
    DateTime? now,
    CloudyRand? random,
  }) {
    final lesson = lessonAt(lessonIndex);
    if (lesson == null) return const [];
    final sequence = buildLessonSequence(
      lessonIndex,
      level: level,
      microphoneEnabled: microphoneEnabled,
      speechRecognitionAvailable: speechRecognitionAvailable,
      random: random,
    );
    final studyStages = (foundationAt(lessonIndex) == null ? 0 : 1) +
        1 +
        guidedCloudyExercises(lessonIndex).length +
        (lesson.words.length < 3 ? lesson.words.length : 3);
    final prefix = sequence.take(studyStages).toList(growable: false);
    final practice = sequence.skip(studyStages).toList(growable: false);
    final prioritized = learningStore.prioritize(practice, now: now);
    return [...prefix, ...prioritized];
  }

  List<CloudyLesson> lessonsForLevel(String level) => List.unmodifiable(
        (levels[level] ?? const <CloudySection>[])
            .expand((section) => section.lessonIndices)
            .map(lessonAt)
            .whereType<CloudyLesson>(),
      );

  String titleAt(int index) => lessonAt(index)?.title ?? '';
}

CloudyPair? _parseWordPair(Object? raw) {
  final values = _asList(raw);
  if (values.length < 2) return null;
  return CloudyPair(_asString(values[0]), _asString(values[1]));
}

CloudyPair? _parseSentence(Object? raw) {
  final values = _asList(raw);
  if (values.length < 2) return null;
  return CloudyPair(
    _asString(values[1]),
    _asString(values[0]),
    extra: values.length > 2 ? _asString(values[2]) : null,
  );
}

CloudyPair? _parseFoundationExample(Object? raw) {
  final values = _asList(raw);
  if (values.length < 2) return null;
  return CloudyPair(_asString(values[0]), _asString(values[1]));
}

Map<String, Object?> _asMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const {};
}

List<Object?> _asList(Object? value) =>
    value is List ? value.cast<Object?>() : const [];

String _asString(Object? value) => value is String ? value : '';
