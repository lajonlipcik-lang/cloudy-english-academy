import 'dart:async';

import 'package:speech_to_text/speech_to_text.dart';

import '../domain/cloudy_speech_matcher.dart';

class CloudySpeechRecognitionResult {
  const CloudySpeechRecognitionResult({
    required this.transcript,
    required this.accepted,
    this.confidence,
    this.alternatives = const [],
    this.error,
    this.cancelled = false,
  });

  final String transcript;
  final bool accepted;
  final double? confidence;
  final List<String> alternatives;
  final String? error;
  final bool cancelled;
}

/// One app-wide recognizer for short English answers, not continuous dictation.
class CloudySpeechRecognitionService {
  CloudySpeechRecognitionService({SpeechToText? speech})
      : _speech = speech ?? _sharedSpeech;

  static final SpeechToText _sharedSpeech = SpeechToText();

  final SpeechToText _speech;
  bool _initialized = false;
  bool _available = false;
  String _localeId = 'en_US';
  String? _target;
  Completer<CloudySpeechRecognitionResult>? _active;
  Timer? _watchdog;
  List<dynamic> _lastAlternatives = const [];

  void Function(String status)? onStatusChanged;
  void Function(double level)? onSoundLevelChanged;
  void Function(String message)? onError;

  bool get isAvailable => _available;
  bool get isListening => _speech.isListening;
  String get localeId => _localeId;

  Future<bool> initialize() async {
    if (_initialized) return _available;
    _initialized = true;
    try {
      _available = await _speech.initialize(
        onStatus: _handleStatus,
        onError: _handleError,
      );
    } catch (error) {
      _initialized = false;
      _available = false;
      onError?.call(error.toString());
      return false;
    }
    if (!_available) return false;

    final locales = await _speech.locales();
    for (final locale in locales) {
      final normalized = locale.localeId.toLowerCase().replaceAll('-', '_');
      if (normalized == 'en_us') {
        _localeId = locale.localeId;
        break;
      }
    }
    if (_localeId == 'en_US') {
      final systemLocale = await _speech.systemLocale();
      if (systemLocale != null &&
          systemLocale.localeId.toLowerCase().startsWith('en')) {
        _localeId = systemLocale.localeId;
      }
    }
    return true;
  }

  Future<CloudySpeechRecognitionResult> listenFor(
    String target, {
    Duration listenFor = const Duration(seconds: 8),
    Duration pauseFor = const Duration(seconds: 2),
  }) async {
    final available = await initialize();
    if (!available) {
      return const CloudySpeechRecognitionResult(
        transcript: '',
        accepted: false,
        error: 'speech_unavailable',
      );
    }
    if (_active != null || _speech.isListening) {
      await cancel();
    }

    final completer = Completer<CloudySpeechRecognitionResult>();
    _active = completer;
    _target = target;
    _lastAlternatives = const [];
    _watchdog = Timer(listenFor + const Duration(seconds: 4), () async {
      if (_active != completer) return;
      await _speech.stop();
      _finishFromLastResult(error: 'recognition_timeout');
    });

    try {
      await _speech.listen(
        onResult: _handleResult,
        onSoundLevelChange: (level) => onSoundLevelChanged?.call(level),
        listenOptions: SpeechListenOptions(
          cancelOnError: true,
          partialResults: false,
          onDevice: false,
          listenMode: ListenMode.confirmation,
          listenFor: listenFor,
          pauseFor: pauseFor,
          localeId: _localeId,
          autoPunctuation: false,
          enableHapticFeedback: false,
        ),
      );
    } catch (error) {
      _finish(
        CloudySpeechRecognitionResult(
          transcript: '',
          accepted: false,
          error: error.toString(),
        ),
      );
    }
    return completer.future;
  }

  Future<void> stop() async {
    if (_active == null) return;
    await _speech.stop();
  }

  Future<void> cancel() async {
    final completer = _active;
    _watchdog?.cancel();
    _watchdog = null;
    _active = null;
    _target = null;
    _lastAlternatives = const [];
    await _speech.cancel();
    if (completer != null && !completer.isCompleted) {
      completer.complete(const CloudySpeechRecognitionResult(
        transcript: '',
        accepted: false,
        cancelled: true,
      ));
    }
  }

  Future<void> dispose() => cancel();

  void _handleResult(dynamic result) {
    _lastAlternatives = result.alternates;
    if (!result.finalResult) return;
    _finishFromLastResult();
  }

  void _handleStatus(String status) {
    onStatusChanged?.call(status);
    if (status == SpeechToText.doneStatus ||
        status == SpeechToText.notListeningStatus) {
      if (_active != null) _finishFromLastResult();
    }
  }

  void _handleError(dynamic error) {
    onError?.call(error.errorMsg);
    _finishFromLastResult(error: error.errorMsg);
  }

  void _finishFromLastResult({String? error}) {
    final target = _target ?? '';
    final alternatives = _lastAlternatives.toList()
      ..sort((a, b) => b.confidence.compareTo(a.confidence));
    final matching = alternatives.where(
      (item) => cloudySpeechMatches(item.recognizedWords, target),
    );
    final selected = matching.isNotEmpty
        ? matching.first
        : alternatives.isNotEmpty
            ? alternatives.first
            : null;
    final transcript = selected?.recognizedWords ?? _speech.lastRecognizedWords ?? '';
    final accepted = transcript.isNotEmpty &&
        cloudySpeechMatches(transcript, target);
    _finish(CloudySpeechRecognitionResult(
      transcript: transcript,
      accepted: accepted,
      confidence: selected?.confidence,
      alternatives: alternatives.map((item) => item.recognizedWords.toString()).toList(growable: false),
      error: error,
    ));
  }

  void _finish(CloudySpeechRecognitionResult result) {
    final completer = _active;
    if (completer == null || completer.isCompleted) return;
    _watchdog?.cancel();
    _watchdog = null;
    _active = null;
    _target = null;
    _lastAlternatives = const [];
    completer.complete(result);
  }
}
