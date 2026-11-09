import '../domain/cloudy_speech_matcher.dart';
import '../domain/cloudy_state.dart';
import 'cloudy_sound_service.dart';
import 'cloudy_speech_recognition_service.dart';
import 'cloudy_tts_service.dart';

/// Coordinates TTS, microphone recognition, and sound effects so they never
/// compete for the same device audio session.
class CloudyMediaService {
  CloudyMediaService({
    CloudyTtsService? tts,
    CloudySpeechRecognitionService? speech,
    CloudySoundService? sound,
  })  : tts = tts ?? CloudyTtsService(),
        speech = speech ?? CloudySpeechRecognitionService(),
        sound = sound ?? CloudySoundService();

  final CloudyTtsService tts;
  final CloudySpeechRecognitionService speech;
  final CloudySoundService sound;

  Future<void> applySettings(CloudySettings settings) async {
    await Future.wait([
      tts.setEnabled(settings.voice != 0),
      tts.setVolume(settings.vol.toDouble()),
      sound.setEnabled(settings.snd != 0),
      sound.setVolume(settings.vol.toDouble()),
    ]);
  }

  Future<void> speak(String text, {bool force = false}) async {
    await speech.cancel();
    await tts.speak(text, force: force);
  }

  Future<CloudySpeechRecognitionResult> recognizeAnswer(
    String target, {
    Duration listenFor = const Duration(seconds: 8),
    Duration pauseFor = const Duration(seconds: 2),
  }) async {
    await tts.stop();
    await sound.stopAll();
    return speech.listenFor(
      target,
      listenFor: listenFor,
      pauseFor: pauseFor,
    );
  }

  bool matchesAnswer(String transcript, String target) =>
      cloudySpeechMatches(transcript, target);

  Future<void> play(CloudySound effect, {int combo = 0}) =>
      sound.play(effect, combo: combo);

  Future<void> stop() async {
    await Future.wait([
      tts.stop(),
      speech.cancel(),
      sound.stopAll(),
    ]);
  }

  Future<void> dispose() async {
    await Future.wait([
      tts.dispose(),
      speech.dispose(),
      sound.dispose(),
    ]);
  }
}
