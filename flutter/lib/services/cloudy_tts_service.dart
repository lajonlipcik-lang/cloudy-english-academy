import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Uses the device's installed English voices; no external TTS API or key.
class CloudyTtsService {
  CloudyTtsService({FlutterTts? engine}) : _engine = engine ?? FlutterTts();

  final FlutterTts _engine;
  bool _initialized = false;
  bool _enabled = true;
  double _volume = 0.7;
  int _generation = 0;
  Future<void> _queue = Future<void>.value();

  bool get enabled => _enabled;
  double get volume => _volume;

  Future<void> initialize() async {
    if (_initialized) return;

    await _engine.setLanguage('en-US');
    await _engine.setSpeechRate(0.48);
    await _engine.setPitch(1.0);
    await _engine.setVolume(_volume);
    await _engine.awaitSpeakCompletion(true);

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      await _engine.setSharedInstance(true);
      await _engine.setIosAudioCategory(
        IosTextToSpeechAudioCategory.ambient,
        [IosTextToSpeechAudioCategoryOptions.mixWithOthers],
        IosTextToSpeechAudioMode.voicePrompt,
      );
    }

    final voice = await _selectMaleAmericanVoice();
    if (voice != null) {
      await _engine.setVoice(voice);
    }
    _initialized = true;
  }

  Future<void> speak(String text, {bool force = false}) {
    final value = text.trim();
    if (value.isEmpty || (!force && !_enabled)) return Future<void>.value();

    final request = ++_generation;
    final operation = _queue.then((_) async {
      if (request != _generation || (!force && !_enabled)) return;
      await initialize();
      if (request != _generation) return;
      await _engine.stop();
      await _engine.setVolume(_volume);
      if (request != _generation) return;
      await _engine.speak(value);
    });
    _queue = operation.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return operation;
  }

  Future<void> stop() async {
    _generation++;
    await _engine.stop();
  }

  Future<void> setEnabled(bool enabled) async {
    _enabled = enabled;
    if (!enabled) await stop();
  }

  Future<void> setVolume(double value) async {
    _volume = value.clamp(0.0, 1.0).toDouble();
    if (_initialized) await _engine.setVolume(_volume);
  }

  Future<void> dispose() => stop();

  Future<Map<String, String>?> _selectMaleAmericanVoice() async {
    final rawVoices = await _engine.getVoices;
    if (rawVoices is! List) return null;

    final candidates = <Map<String, dynamic>>[];
    for (final raw in rawVoices) {
      if (raw is! Map) continue;
      final voice = Map<String, dynamic>.from(raw);
      final locale = (voice['locale'] ?? '').toString().toLowerCase().replaceAll('_', '-');
      if (locale == 'en-us') candidates.add(voice);
    }

    const knownMaleNames = {
      'alex', 'aaron', 'fred', 'eddy', 'reed', 'tom', 'bruce',
      'daniel', 'arthur', 'ralph',
    };
    for (final voice in candidates) {
      final name = (voice['name'] ?? '').toString().toLowerCase();
      final gender = (voice['gender'] ?? '').toString().toLowerCase();
      final firstName = name.split(RegExp(r'[\s,()]')).first;
      if (gender == 'male' ||
          knownMaleNames.contains(firstName) ||
          RegExp(r'\b(male|masculine)\b').hasMatch(name)) {
        final voiceName = (voice['name'] ?? '').toString();
        final locale = (voice['locale'] ?? '').toString();
        if (voiceName.isNotEmpty && locale.isNotEmpty) {
          return {'name': voiceName, 'locale': locale};
        }
      }
    }
    // Match the browser implementation: leave the OS default voice selected
    // when the device does not expose a suitable American male voice.
    return null;
  }
}
