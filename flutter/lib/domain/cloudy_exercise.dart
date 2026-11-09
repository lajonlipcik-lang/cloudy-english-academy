class CloudyPair {
  const CloudyPair(this.first, this.second);
  final String first, second;

  factory CloudyPair.fromJson(Object? value) {
    if (value is List && value.length >= 2) {
      return CloudyPair(value[0]?.toString() ?? '', value[1]?.toString() ?? '');
    }
    return const CloudyPair('', '');
  }

  List<String> toJson() => [first, second];
}

/// Mirrors every exercise/study card emitted by the current browser runtime:
/// choice, listening, sentence builder, matching, pronunciation, recall,
/// vocabulary introduction, and grammar/theory introduction.
sealed class CloudyExercise {
  const CloudyExercise();
  String get kind;
  Map<String, Object?> toJson();

  factory CloudyExercise.fromJson(Object? raw) {
    final map = _asMap(raw);
    switch (map['k']) {
      case 'c':
        return CloudyChoiceExercise(
          question: _string(map['q']), answer: _string(map['a']),
          english: _string(map['en']), speak: map['spk'] == true,
          options: _strings(map['o']), title: _string(map['title']),
        );
      case 'l':
        return CloudyListeningExercise(
          answer: _string(map['a']), english: _string(map['en']),
          options: _strings(map['o']), title: _string(map['title']),
        );
      case 'b':
        return CloudyBuilderExercise(
          question: _string(map['q']), answer: _string(map['a']),
          options: _strings(map['o']), title: _string(map['title']),
          skillId: map['skillId'] is String ? map['skillId'] as String : null,
        );
      case 'm':
        return CloudyMatchingExercise(
          left: _pairs(map['L']), right: _pairs(map['R']),
          title: map['title'] is String ? map['title'] as String : null,
        );
      case 'p':
        return CloudyPronunciationExercise(english: _string(map['en']));
      case 'r':
        return CloudyRecallExercise(
          question: _string(map['q']), answer: _string(map['a']),
          english: _string(map['en']), title: _string(map['title']),
        );
      case 'v':
        return CloudyVocabularyExercise(words: _pairs(map['words']));
      case 't':
        return CloudyTheoryExercise(
          title: _string(map['title']), body: _string(map['body']),
          examples: _pairs(map['examples']), tip: _string(map['tip']),
          level: map['level'] is String ? map['level'] as String : null,
        );
      default:
        throw FormatException('Unknown Cloudy exercise type: ${map['k']}');
    }
  }
}

class CloudyChoiceExercise extends CloudyExercise {
  const CloudyChoiceExercise({
    required this.question, required this.answer, required this.english,
    required this.speak, required this.options, required this.title,
  });
  final String question, answer, english, title;
  final bool speak;
  final List<String> options;
  @override
  String get kind => 'c';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'q': question, 'a': answer, 'en': english,
    'spk': speak, 'o': options, 'title': title,
  };
}

class CloudyListeningExercise extends CloudyExercise {
  const CloudyListeningExercise({
    required this.answer, required this.english,
    required this.options, required this.title,
  });
  final String answer, english, title;
  final List<String> options;
  @override
  String get kind => 'l';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'a': answer, 'en': english, 'o': options, 'title': title,
  };
}

class CloudyBuilderExercise extends CloudyExercise {
  const CloudyBuilderExercise({
    required this.question, required this.answer,
    required this.options, required this.title, this.skillId,
  });
  final String question, answer, title;
  final List<String> options;
  final String? skillId;
  @override
  String get kind => 'b';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'q': question, 'a': answer, 'o': options, 'title': title,
    if (skillId != null) 'skillId': skillId,
  };
}

class CloudyMatchingExercise extends CloudyExercise {
  const CloudyMatchingExercise({required this.left, required this.right, this.title});
  final List<CloudyPair> left, right;
  final String? title;
  @override
  String get kind => 'm';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'L': left.map((pair) => pair.toJson()).toList(),
    'R': right.map((pair) => pair.toJson()).toList(),
    if (title != null) 'title': title,
  };
}

class CloudyPronunciationExercise extends CloudyExercise {
  const CloudyPronunciationExercise({required this.english});
  final String english;
  @override
  String get kind => 'p';
  @override
  Map<String, Object?> toJson() => {'k': kind, 'en': english};
}

class CloudyRecallExercise extends CloudyExercise {
  const CloudyRecallExercise({
    required this.question, required this.answer,
    required this.english, required this.title,
  });
  final String question, answer, english, title;
  @override
  String get kind => 'r';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'q': question, 'a': answer, 'en': english, 'title': title,
  };
}

class CloudyVocabularyExercise extends CloudyExercise {
  const CloudyVocabularyExercise({required this.words});
  final List<CloudyPair> words;
  @override
  String get kind => 'v';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'words': words.map((pair) => pair.toJson()).toList(),
  };
}

class CloudyTheoryExercise extends CloudyExercise {
  const CloudyTheoryExercise({
    required this.title, required this.body, required this.examples,
    required this.tip, this.level,
  });
  final String title, body, tip;
  final String? level;
  final List<CloudyPair> examples;
  @override
  String get kind => 't';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'title': title, 'body': body,
    'examples': examples.map((pair) => pair.toJson()).toList(),
    'tip': tip, if (level != null) 'level': level,
  };
}

Map<String, Object?> _asMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.map((key, value) => MapEntry(key.toString(), value));
  return <String, Object?>{};
}

String _string(Object? value) => value is String ? value : '';
List<String> _strings(Object? value) =>
    value is List ? value.whereType<String>().toList(growable: false) : const [];
List<CloudyPair> _pairs(Object? value) => value is List
    ? value.map(CloudyPair.fromJson).toList(growable: false)
    : const [];
