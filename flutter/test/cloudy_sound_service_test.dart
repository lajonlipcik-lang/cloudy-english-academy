import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/services/cloudy_sound_service.dart';

void main() {
  group('Cloudy sound effects', () {
    test('encodes valid mono 16-bit PCM WAV data', () {
      final wav = CloudyToneGenerator.encode(CloudySound.tap);
      expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
      expect(String.fromCharCodes(wav.sublist(8, 12)), 'WAVE');
      expect(String.fromCharCodes(wav.sublist(12, 16)), 'fmt ');
      expect(String.fromCharCodes(wav.sublist(36, 40)), 'data');

      final data = ByteData.sublistView(wav);
      expect(data.getUint16(22, Endian.little), 1);
      expect(data.getUint32(24, Endian.little), 44100);
      expect(data.getUint16(34, Endian.little), 16);
      expect(data.getUint32(40, Endian.little), wav.length - 44);
    });

    test('preserves every sound preset from the existing browser audio engine', () {
      for (final sound in CloudySound.values) {
        expect(CloudyToneGenerator.tonesFor(sound), isNotEmpty);
        expect(CloudyToneGenerator.encode(sound).length, greaterThan(44));
      }
    });

    test('applies the existing combo pitch boost only to the correct sound', () {
      final normal = CloudyToneGenerator.encode(CloudySound.ok);
      final combo = CloudyToneGenerator.encode(CloudySound.ok, combo: 7);
      final otherNormal = CloudyToneGenerator.encode(CloudySound.match);
      final otherCombo = CloudyToneGenerator.encode(CloudySound.match, combo: 7);
      expect(normal, isNot(equals(combo)));
      expect(otherNormal, equals(otherCombo));
    });
  });
}
