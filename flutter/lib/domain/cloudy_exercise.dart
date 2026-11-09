class CloudyPair {
  const CloudyPair(this.first, this.second);
  final String first;
  final String second;

  factory CloudyPair.fromJson(Object? value) {
    if (value is List && value.length >= 2) {
      return CloudyPair(value[0]?.toString() ?? '', value[1]?.toString() ?? '');
    }
    return const CloudyPair('', '');
  }

  List<String> toJson() => [first, second];
}

/// Mirrors the six exercise variants used by the current Cloudy exercise engine.
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
        );
      case 'm':
        return CloudyMatchingExercise(
          left: _pairs(map['L']), right: _pairs(map['R']),
        );
      case 'p':
        return CloudyPronunciationExercise(english: _string(map['en']));
      case 'r':
        return CloudyRecallExercise(
          question: _string(map['q']), answer: _string(map['a']),
          english: _string(map['en']), title: _string(map['title']),
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
    required this.options, required this.title,
  });
  final String question, answer, title;
  final List<String> options;
  @override
  String get kind => 'b';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'q': question, 'a': answer, 'o': options, 'title': title,
  };
}

class CloudyMatchingExercise extends CloudyExercise {
  const CloudyMatchingExercise({required this.left, required this.right});
  final List<CloudyPair> left, right;
  @override
  String get kind => 'm';
  @override
  Map<String, Object?> toJson() => {
    'k': kind, 'L': left.map((pair) => pair.toJson()).toList(),
    'R': right.map((pair) => pair.toJson()).toList(),
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
