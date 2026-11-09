import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';

enum CloudySound {
  tap,
  pick,
  tab,
  sheet,
  go,
  ok,
  match,
  bad,
  win,
  chest,
  star,
}

enum CloudyWaveform { sine, triangle, sawtooth }

class CloudyTone {
  const CloudyTone({
    required this.frequency,
    required this.delay,
    required this.duration,
    this.waveform = CloudyWaveform.sine,
    this.endFrequency,
    this.peak = 0.22,
  });

  final double frequency;
  final double delay;
  final double duration;
  final CloudyWaveform waveform;
  final double? endFrequency;
  final double peak;
}

/// Generates short PCM/WAV effects from the same oscillator envelopes as
/// src/lib/cloudy/audio.ts. No remote audio files or paid audio services.
class CloudyToneGenerator {
  static const int sampleRate = 44100;
  static const int channels = 1;
  static const int bitsPerSample = 16;
  static const double _attackSeconds = 0.02;
  static const double _releaseSeconds = 0.05;
  static const double _silenceTailSeconds = 0.1;

  static Uint8List encode(CloudySound sound, {int combo = 0}) {
    final tones = tonesFor(sound, combo: combo);
    final totalSeconds = tones
        .map((tone) => tone.delay + tone.duration + _silenceTailSeconds)
        .reduce((left, right) => left > right ? left : right);
    final sampleCount = (totalSeconds * sampleRate).ceil();
    final mix = Float64List(sampleCount);

    for (final tone in tones) {
      final start = (tone.delay * sampleRate).round();
      final activeSamples =
          ((tone.duration + _releaseSeconds) * sampleRate).ceil();
      var phase = 0.0;
      for (var offset = 0; offset < activeSamples; offset++) {
        final elapsed = offset / sampleRate;
        final index = start + offset;
        if (index >= sampleCount) break;

        final progress = (elapsed / tone.duration).clamp(0.0, 1.0);
        final frequency = tone.endFrequency == null
            ? tone.frequency
            : tone.frequency *
                math.pow(tone.endFrequency! / tone.frequency, progress).toDouble();
        phase += 2 * math.pi * frequency / sampleRate;

        final envelope = _envelope(elapsed, tone.duration, tone.peak);
        mix[index] += _wave(phase, tone.waveform) * envelope;
      }
    }

    return _encodePcm(mix);
  }

  static List<CloudyTone> tonesFor(CloudySound sound, {int combo = 0}) {
    final boost = 1.0 + math.min(combo, 7).toDouble() * 0.07;
    return switch (sound) {
      CloudySound.tap => const [
          CloudyTone(frequency: 560, delay: 0, duration: 0.07, waveform: CloudyWaveform.triangle),
        ],
      CloudySound.pick => const [
          CloudyTone(frequency: 420, delay: 0, duration: 0.08, endFrequency: 640),
          CloudyTone(frequency: 640, delay: 0.05, duration: 0.08),
        ],
      CloudySound.tab => const [
          CloudyTone(frequency: 760, delay: 0, duration: 0.07, endFrequency: 520),
        ],
      CloudySound.sheet => const [
          CloudyTone(frequency: 300, delay: 0, duration: 0.25, endFrequency: 700),
        ],
      CloudySound.go => const [
          CloudyTone(frequency: 330, delay: 0, duration: 0.3, endFrequency: 990),
        ],
      CloudySound.ok => [
          CloudyTone(frequency: 523.0 * boost, delay: 0, duration: 0.18),
          CloudyTone(frequency: 784.0 * boost, delay: 0.09, duration: 0.26),
        ],
      CloudySound.match => const [
          CloudyTone(frequency: 880, delay: 0, duration: 0.12),
          CloudyTone(frequency: 1175, delay: 0.07, duration: 0.2),
        ],
      CloudySound.bad => const [
          CloudyTone(frequency: 220, delay: 0, duration: 0.18, waveform: CloudyWaveform.sawtooth, endFrequency: 140, peak: 0.12),
          CloudyTone(frequency: 150, delay: 0.14, duration: 0.22, waveform: CloudyWaveform.sawtooth, endFrequency: 100, peak: 0.12),
        ],
      CloudySound.win => const [
          CloudyTone(frequency: 523, delay: 0, duration: 0.2),
          CloudyTone(frequency: 659, delay: 0.12, duration: 0.2),
          CloudyTone(frequency: 784, delay: 0.24, duration: 0.2),
          CloudyTone(frequency: 1047, delay: 0.36, duration: 0.5),
        ],
      CloudySound.chest => const [
          CloudyTone(frequency: 392, delay: 0, duration: 0.15),
          CloudyTone(frequency: 523, delay: 0.09, duration: 0.15),
          CloudyTone(frequency: 659, delay: 0.18, duration: 0.15),
          CloudyTone(frequency: 784, delay: 0.27, duration: 0.15),
          CloudyTone(frequency: 1047, delay: 0.36, duration: 0.15),
          CloudyTone(frequency: 1319, delay: 0.5, duration: 0.6),
        ],
      CloudySound.star => const [
          CloudyTone(frequency: 1200, delay: 0, duration: 0.15),
          CloudyTone(frequency: 1600, delay: 0.07, duration: 0.25),
        ],
    };
  }

  static double _envelope(double elapsed, double duration, double peak) {
    if (elapsed <= _attackSeconds) {
      final progress = (elapsed / _attackSeconds).clamp(0.0, 1.0);
      return (0.0001 * math.pow(peak / 0.0001, progress)).toDouble();
    }
    final releaseDuration = duration + _releaseSeconds - _attackSeconds;
    final progress = ((elapsed - _attackSeconds) / releaseDuration)
        .clamp(0.0, 1.0);
    return (peak * math.pow(0.0001 / peak, progress)).toDouble();
  }

  static double _wave(double phase, CloudyWaveform waveform) {
    switch (waveform) {
      case CloudyWaveform.sine:
        return math.sin(phase);
      case CloudyWaveform.triangle:
        return 2 / math.pi * math.asin(math.sin(phase));
      case CloudyWaveform.sawtooth:
        final cycle = phase / (2 * math.pi);
        return 2 * (cycle - (cycle + 0.5).floor());
    }
  }

  static Uint8List _encodePcm(Float64List samples) {
    final dataLength = samples.length * channels * (bitsPerSample ~/ 8);
    final bytes = Uint8List(44 + dataLength);
    bytes.setRange(0, 4, ascii.encode('RIFF'));
    bytes.setRange(8, 12, ascii.encode('WAVE'));
    bytes.setRange(12, 16, ascii.encode('fmt '));
    bytes.setRange(36, 40, ascii.encode('data'));

    final data = ByteData.sublistView(bytes);
    data.setUint32(4, 36 + dataLength, Endian.little);
    data.setUint32(16, 16, Endian.little);
    data.setUint16(20, 1, Endian.little);
    data.setUint16(22, channels, Endian.little);
    data.setUint32(24, sampleRate, Endian.little);
    data.setUint32(28, sampleRate * channels * (bitsPerSample ~/ 8), Endian.little);
    data.setUint16(32, channels * (bitsPerSample ~/ 8), Endian.little);
    data.setUint16(34, bitsPerSample, Endian.little);
    data.setUint32(40, dataLength, Endian.little);

    for (var i = 0; i < samples.length; i++) {
      final clipped = samples[i].clamp(-1.0, 1.0);
      data.setInt16(44 + i * 2, (clipped * 32767).round(), Endian.little);
    }
    return bytes;
  }
}

class CloudySoundService {
  CloudySoundService({int playerCount = 4})
      : _players = List.generate(playerCount.clamp(1, 8).toInt(), (_) => AudioPlayer());

  final List<AudioPlayer> _players;
  final Map<String, Uint8List> _cache = {};
  int _nextPlayer = 0;
  bool _enabled = true;
  bool _initialized = false;
  double _volume = 0.7;

  bool get enabled => _enabled;
  double get volume => _volume;

  Future<void> initialize() async {
    if (_initialized) return;
    await Future.wait(
      _players.map((player) => player.setReleaseMode(ReleaseMode.stop)),
    );
    _initialized = true;
  }

  Future<void> play(CloudySound sound, {int combo = 0}) async {
    if (!_enabled || _volume <= 0) return;
    try {
      await initialize();
      final safeCombo = combo.clamp(0, 7).toInt();
      final key = '$sound:$safeCombo';
      final bytes = _cache.putIfAbsent(
        key,
        () => CloudyToneGenerator.encode(sound, combo: safeCombo),
      );
      final player = _players[_nextPlayer];
      _nextPlayer = (_nextPlayer + 1) % _players.length;
      await player.play(
        BytesSource(bytes, mimeType: 'audio/wav'),
        volume: _volume,
      );
    } catch (_) {
      // Sound effects must never interrupt lesson flow on unsupported devices.
    }
  }

  Future<void> stopAll() async {
    await Future.wait(_players.map((player) => player.stop()));
  }

  Future<void> setEnabled(bool enabled) async {
    _enabled = enabled;
    if (!enabled) await stopAll();
  }

  Future<void> setVolume(double value) async {
    _volume = value.clamp(0.0, 1.0).toDouble();
  }

  Future<void> dispose() async {
    await Future.wait(_players.map((player) => player.dispose()));
    _players.clear();
    _cache.clear();
    _initialized = false;
  }
}
