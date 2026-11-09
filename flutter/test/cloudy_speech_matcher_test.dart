import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_speech_matcher.dart';

void main() {
  group('Cloudy speech matching parity', () {
    test('normalizes case, punctuation, whitespace, and apostrophes', () {
      expect(normalizeCloudySpeechText("  DON’T  stop!  "), 'dont stop');
      expect(normalizeCloudySpeechText('café'), 'cafe');
    });

    test('keeps short minimal-pair words exact', () {
      expect(cloudySpeechMatches('son', 'son'), isTrue);
      expect(cloudySpeechMatches('sun', 'son'), isFalse);
      expect(cloudySpeechMatches('ship', 'sheep'), isFalse);
      expect(cloudySpeechMatches('cat', 'cut'), isFalse);
    });

    test('allows only a one-edit tolerance for longer single words', () {
      expect(cloudySpeechMatches('beautiful', 'beautifull'), isTrue);
      expect(cloudySpeechMatches('beautiful', 'beautifool'), isTrue);
      expect(cloudySpeechMatches('beautiful', 'beautifoooo'), isFalse);
      expect(cloudySpeechMatches('something', 'somethink'), isTrue);
    });

    test('requires exact matches for multi-word phrases', () {
      expect(cloudySpeechMatches('I am fine', 'I am fine'), isTrue);
      expect(cloudySpeechMatches('I am fin', 'I am fine'), isFalse);
    });

    test('checks all speech-recognition alternatives', () {
      expect(
        anyCloudySpeechAlternativeMatches(['sun', 'son'], 'son'),
        isTrue,
      );
      expect(
        anyCloudySpeechAlternativeMatches(['sun', 'sung'], 'son'),
        isFalse,
      );
    });

    test('computes Levenshtein distance correctly', () {
      expect(cloudySpeechDistance('kitten', 'sitting'), 3);
      expect(cloudySpeechDistance('son', 'sun'), 1);
      expect(cloudySpeechDistance('', 'cloud'), 5);
    });
  });
}
