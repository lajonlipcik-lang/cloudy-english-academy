import 'dart:async';

import 'package:flutter/material.dart';

import '../domain/cloudy_exercise.dart';
import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';
import '../services/cloudy_sound_service.dart';
import '../session/cloudy_session_controller.dart';
import 'cloudy_lesson_screen.dart';

/// Connects the native lesson UI to Cloudy's canonical progress, learning
/// events, sound, TTS and speech-recognition services.
class CloudyLessonFlow extends StatefulWidget {
  const CloudyLessonFlow({
    super.key,
    required this.title,
    required this.initialSession,
    required this.controller,
    this.levelLessonIndices = const {},
    this.onFinished,
    this.onExit,
  }) : assert(initialSession.exercises.length > 0);

  final String title;
  final CloudySession initialSession;
  final CloudySessionController controller;
  final Map<String, List<int>> levelLessonIndices;
  final ValueChanged<CloudyState>? onFinished;
  final VoidCallback? onExit;

  @override
  State<CloudyLessonFlow> createState() => _CloudyLessonFlowState();
}

class _CloudyLessonFlowState extends State<CloudyLessonFlow> {
  late CloudySession _session;
  late CloudyState _progress;
  late final Future<void> _learningSessionReady;
  Future<void> _progressQueue = Future<void>.value();
  Future<void> _learningQueue = Future<void>.value();
  bool _finishing = false;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _session = widget.initialSession;
    _progress = widget.controller.progress;
    _learningSessionReady = _beginLearningSession();
  }

  Future<void> _beginLearningSession() async {
    try {
      final store = await widget.controller.learningStore;
      final level = widget.controller.progress.level?.code;
      await store.beginSession(
        level: level,
        lessonIndex: _session.lesson,
        review: _session.review,
      );
      await store.track(
        'question_opened',
        exercise: _session.exercises[_session.index],
        questionIndex: _session.index,
      );
    } catch (_) {
      // Learning analytics are supplementary. A local lesson remains usable
      // if analytics storage is temporarily unavailable.
    }
  }

  void _queueProgressSave(CloudyState next) {
    _progress = next;
    _progressQueue = _progressQueue.then((_) async {
      await widget.controller.saveProgress(next);
    }).catchError((Object error, StackTrace stackTrace) {
      if (mounted) _showMessage('Не удалось сохранить прогресс. Повторим позже.');
    });
  }

  void _queueLearningAnswer(
    CloudyExercise exercise, {
    required bool correct,
    String? selectedAnswer,
  }) {
    _learningQueue = _learningQueue.then((_) async {
      await _learningSessionReady;
      await widget.controller.recordLearningAnswer(
        exercise,
        correct: correct,
        questionIndex: _session.index,
        selectedAnswer: selectedAnswer,
      );
      await widget.controller.syncLearningEvents();
    }).catchError((Object error, StackTrace stackTrace) {
      // The local learning-event outbox can be synchronized on a later launch.
    });
  }

  void _onAnswer(bool correct, String? englishWord) {
    if (_finished || _finishing) return;
    final exercise = _session.exercises[_session.index];
    final result = applyCloudyAnswer(
      _progress,
      _session,
      correct: correct,
      englishWord: englishWord,
    );
    _session = result.session;
    _queueProgressSave(result.state);
    _queueLearningAnswer(exercise, correct: correct);
    unawaited(widget.controller.playSound(
      correct ? CloudySound.ok : CloudySound.bad,
      combo: _session.combo,
    ));
    if (mounted) setState(() {});
  }

  void _onMatchingAttempt(
    String englishWord,
    bool correct,
    int totalPairs,
  ) {
    if (_finished || _finishing) return;
    final exercise = _session.exercises[_session.index];
    final result = applyCloudyAnswer(
      _progress,
      _session,
      correct: correct,
      englishWord: englishWord,
    );
    _session = result.session.copyWith(
      matchingCorrect: correct
          ? _session.matchingCorrect + 1
          : _session.matchingCorrect,
    );
    _queueProgressSave(result.state);
    _queueLearningAnswer(exercise, correct: correct);
    unawaited(widget.controller.playSound(
      correct ? CloudySound.match : CloudySound.bad,
      combo: _session.combo,
    ));
    if (mounted) setState(() {});
  }

  void _onAdvance() {
    if (_finished || _finishing) return;
    if (_session.index >= _session.exercises.length - 1) {
      unawaited(_completeLesson());
      return;
    }
    setState(() {
      _session = _session.copyWith(index: _session.index + 1);
    });
    unawaited(widget.controller.playSound(CloudySound.go));
    unawaited(_trackOpenedQuestion());
  }

  Future<void> _trackOpenedQuestion() async {
    try {
      final store = await widget.controller.learningStore;
      await store.track(
        'question_opened',
        exercise: _session.exercises[_session.index],
        questionIndex: _session.index,
      );
    } catch (_) {}
  }

  void _skipPronunciation() {
    if (_finished || _finishing) return;
    _session = skipCloudyAnswer(_session);
    unawaited(_trackSkippedQuestion());
  }

  Future<void> _trackSkippedQuestion() async {
    try {
      final store = await widget.controller.learningStore;
      await store.track(
        'question_skipped',
        exercise: _session.exercises[_session.index],
        questionIndex: _session.index,
      );
    } catch (_) {}
  }

  void _requestPronunciation(
    String word,
    ValueChanged<bool> onResult,
  ) {
    unawaited(_recognizePronunciation(word, onResult));
  }

  Future<void> _recognizePronunciation(
    String word,
    ValueChanged<bool> onResult,
  ) async {
    try {
      final result = await widget.controller.recognizeAnswer(word);
      if (!mounted) return;
      if (result.error != null || result.cancelled) {
        _showMessage(
          result.error == 'speech_unavailable'
              ? 'Распознавание речи недоступно на этом устройстве. Проверь разрешение на микрофон.'
              : 'Не удалось распознать речь. Попробуй ещё раз.',
        );
        return;
      }
      onResult(result.accepted);
    } catch (_) {
      if (mounted) {
        _showMessage('Не удалось запустить микрофон. Проверь разрешение на запись речи.');
      }
    }
  }

  Future<void> _completeLesson() async {
    if (_finished || _finishing) return;
    setState(() => _finishing = true);
    try {
      await _progressQueue;
      await _learningQueue;
      await _learningSessionReady;

      CloudyState completed;
      if (widget.controller.isAuthenticated) {
        completed = await widget.controller.awardLesson(_session);
      } else {
        final result = finishCloudyLesson(
          _progress,
          _session,
          now: DateTime.now(),
          levelLessonIndices: widget.levelLessonIndices,
        );
        completed = result.state;
        await widget.controller.saveProgress(completed);
      }

      try {
        final store = await widget.controller.learningStore;
        await store.endSession(outcome: 'lesson_completed');
        await widget.controller.syncLearningEvents();
      } catch (_) {
        // Progress and XP must not be rolled back because analytics failed.
      }

      if (!mounted) return;
      _progress = completed;
      _finished = true;
      widget.onFinished?.call(completed);
      unawaited(widget.controller.playSound(CloudySound.win));
      setState(() => _finishing = false);
    } catch (error) {
      if (!mounted) return;
      setState(() => _finishing = false);
      _showMessage(
        widget.controller.isAuthenticated
            ? 'Не удалось подтвердить награду на сервере. Проверь подключение и повтори.'
            : 'Не удалось сохранить результат урока. Попробуй ещё раз.',
      );
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return Scaffold(
        backgroundColor: const Color(0xFF071333),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.celebration_rounded,
                    color: Color(0xFF63C1FF), size: 64),
                const SizedBox(height: 18),
                const Text(
                  'Урок завершён!',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Текущий опыт: ${_progress.xp}',
                  style: const TextStyle(color: Colors.white70, fontSize: 16),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: widget.onExit,
                  child: const Text('Продолжить'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Stack(
      children: [
        CloudyLessonScreen(
          title: widget.title,
          session: _session,
          onAnswer: _onAnswer,
          onMatchingAttempt: _onMatchingAttempt,
          onAdvance: _onAdvance,
          onComplete: _completeLesson,
          onPronunciationRequested: _requestPronunciation,
          onSpeak: (word) => unawaited(widget.controller.speak(word)),
          onSkipPronunciation: _skipPronunciation,
          onExit: widget.onExit,
        ),
        if (_finishing)
          Positioned.fill(
            child: ColoredBox(
              color: Colors.black.withValues(alpha: .28),
              child: const Center(child: CircularProgressIndicator()),
            ),
          ),
      ],
    );
  }
}
