import 'package:unorm_dart/unorm_dart.dart' as unorm;

/// Mirrors src/server-assets/cloudy-speech.js.
/// Short words stay exact-match only so son/sun and ship/sheep are not
/// incorrectly accepted as the same pronunciation.
String normalizeCloudySpeechText(String value) {
  final decomposed = unorm.nfkd(value.toLowerCase())
      .replaceAll('’', '')
      .replaceAll("'", '');
  return decomposed
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

int cloudySpeechDistance(String first, String second) {
  final a = first.runes.toList(growable: false);
  final b = second.runes.toList(growable: false);
  var previous = List<int>.generate(b.length + 1, (index) => index);

  for (var i = 1; i <= a.length; i++) {
    var diagonal = previous[0];
    previous[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final above = previous[j];
      final substitutionCost = a[i - 1] == b[j - 1] ? 0 : 1;
      previous[j] = [
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + substitutionCost,
      ].reduce((left, right) => left < right ? left : right);
      diagonal = above;
    }
  }
  return previous[b.length];
}

bool cloudySpeechMatches(String transcript, String target) {
  final heard = normalizeCloudySpeechText(transcript);
  final expected = normalizeCloudySpeechText(target);
  if (heard.isEmpty || expected.isEmpty) return false;
  if (heard == expected) return true;
  if (expected.contains(' ')) return false;
  if (expected.length < 5) return false;
  return (heard.length - expected.length).abs() <= 1 &&
      cloudySpeechDistance(heard, expected) <= 1;
}

bool anyCloudySpeechAlternativeMatches(
  Iterable<String> alternatives,
  String target,
) => alternatives.any((alternative) => cloudySpeechMatches(alternative, target));
