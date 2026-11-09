import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/cloudy_auth_repository.dart';
import '../domain/cloudy_exercise.dart';
import '../domain/cloudy_learning_store.dart';
import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';
import '../network/cloudy_backend_client.dart';
import 'cloudy_learning_sync_repository.dart';
import 'cloudy_local_progress_store.dart';
import 'cloudy_progress_repository.dart';

/// Coordinates auth, local progress, the server XP ledger, and adaptive
/// learning evidence. UI widgets observe this controller; they do not own data.
class CloudyAppController extends ChangeNotifier {
  CloudyAppController({
    required CloudyAuthRepository auth,
    required CloudyLocalProgressStore localProgress,
    required CloudyBackendClient backend,
  })  : _auth = auth,
        _local = localProgress,
        _backend = backend,
        _progress = CloudyProgressRepository(backend);

  final CloudyAuthRepository _auth;
  final CloudyLocalProgressStore _local;
  final CloudyBackendClient _backend;
  final CloudyProgressRepository _progress;

  late CloudyLearningStore _learning;
  late CloudyLearningSyncRepository _learningSync;
  StreamSubscription<AuthState>? _authSubscription;
  Timer? _saveTimer;
  Timer? _retryTimer;

  CloudyState state = CloudyState.defaults();
  CloudyState _baseState = CloudyState.defaults();
  CloudyAuthUser? user;
  bool guestMode = false;
  bool isBusy = false;
  bool syncPaused = false;
  String? updatedAt;
  String? lastError;

  CloudyState? _pendingState;
  int _revision = 0;
  int _syncAttempts = 0;
  bool _saving = false;
  bool _ignoreAuthEvents = false;
  bool _disposed = false;

  bool get isAuthenticated => user != null;
  bool get onboardingRequired => user != null &&
      (user!.name.trim().isEmpty || user!.name == 'Ученик' || user!.age == null);

  static Future<CloudyAppController> create() async {
    await CloudyAuthRepository.initialize();
    final backend = CloudyBackendClient(
      baseUrl: CloudyBackendClient.configuredBaseUrl(),
    );
    final controller = CloudyAppController(
      auth: CloudyAuthRepository.configured(),
      localProgress: await CloudyLocalProgressStore.create(),
      backend: backend,
    );
    await controller.initialize();
    return controller;
  }

  Future<void> initialize() async {
    state = _local.loadGuest();
    await _setLearningScope('cl2');

    final existing = _auth.currentUser;
    if (existing != null) {
      await _activate(await _auth.loadSession());
    }

    _authSubscription = _auth.authChanges.listen((authState) {
      if (_disposed || _ignoreAuthEvents) return;
      final session = authState.session;
      if (session == null) {
        if (user != null) unawaited(_clearAccountState());
      } else if (session.user.id != user?.id) {
        unawaited(_refreshAccount());
      }
    });
    notifyListeners();
  }

  Future<void> _setLearningScope(String scope) async {
    _learning = await CloudyLearningStore.create(scope: scope);
    _learningSync = CloudyLearningSyncRepository(_learning, _backend);
  }

  Future<void> _refreshAccount() async {
    try {
      await _activate(await _auth.loadSession());
    } catch (error) {
      lastError = error.toString();
      notifyListeners();
    }
  }

  Future<void> _activate(CloudySessionSnapshot snapshot) async {
    final account = snapshot.user;
    if (account == null) return;
    final activation = _local.activateCloudAccount(
      email: account.email,
      remoteState: snapshot.progress == null
          ? null
          : Map<String, Object?>.from(snapshot.progress!),
      remoteUpdatedAt: snapshot.progressUpdatedAt,
      progressLoadFailed: snapshot.progressLoadFailed,
      profileLevel: snapshot.englishLevel,
      placementTestCompleted: snapshot.placementTestCompleted,
    );
    await _local.persistActivation(account.email, activation);
    user = account;
    guestMode = false;
    state = activation.state;
    _baseState = activation.baseState;
    updatedAt = activation.updatedAt;
    syncPaused = activation.syncPaused;
    _pendingState = null;
    _syncAttempts = 0;
    await _setLearningScope('cl2:${account.email.trim().toLowerCase()}');
    if (activation.shouldSync) _queueProgressSave();
    if (!syncPaused) unawaited(_syncLearningEvents());
    notifyListeners();
  }

  Future<CloudySignUpResult> signUp(String email, String password) async {
    isBusy = true;
    lastError = null;
    notifyListeners();
    _ignoreAuthEvents = true;
    try {
      final result = await _auth.signUp(email, password);
      if (!result.needsConfirmation && result.user != null) {
        final account = result.user!;
        await _local.activateAccount(account.email);
        user = account;
        guestMode = false;
        state = _local.loadAccount(account.email);
        _baseState = CloudyState.defaults();
        updatedAt = null;
        syncPaused = false;
        await _setLearningScope('cl2:${account.email.trim().toLowerCase()}');
        await _local.saveActive(state);
      }
      return result;
    } catch (error) {
      lastError = error.toString();
      rethrow;
    } finally {
      _ignoreAuthEvents = false;
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> signIn(String email, String password) async {
    isBusy = true;
    lastError = null;
    notifyListeners();
    _ignoreAuthEvents = true;
    try {
      final snapshot = await _auth.signIn(email, password);
      await _activate(snapshot);
    } catch (error) {
      lastError = error.toString();
      rethrow;
    } finally {
      _ignoreAuthEvents = false;
      isBusy = false;
      notifyListeners();
    }
  }

  Future<CloudyAuthUser> updateProfile({String? name, Object? age}) async {
    final updated = await _auth.updateProfile(name: name, age: age);
    user = updated;
    notifyListeners();
    return updated;
  }

  Future<void> continueAsGuest() async {
    _ignoreAuthEvents = true;
    try {
      if (_auth.currentUser != null) await _auth.signOut();
      await _local.enterGuestMode();
      user = null;
      guestMode = true;
      state = _local.loadGuest();
      _baseState = CloudyState.defaults();
      updatedAt = null;
      syncPaused = false;
      _pendingState = null;
      await _setLearningScope('cl2');
    } finally {
      _ignoreAuthEvents = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    _ignoreAuthEvents = true;
    try {
      await _auth.signOut();
      await _clearAccountState();
    } finally {
      _ignoreAuthEvents = false;
      notifyListeners();
    }
  }

  Future<void> _clearAccountState() async {
    _saveTimer?.cancel();
    _retryTimer?.cancel();
    _pendingState = null;
    user = null;
    guestMode = false;
    syncPaused = false;
    updatedAt = null;
    _baseState = CloudyState.defaults();
    await _local.enterGuestMode();
    state = _local.loadGuest();
    await _setLearningScope('cl2');
    notifyListeners();
  }

  Future<void> updateState(CloudyState next) async {
    state = next;
    await _persistLocalAndQueue();
  }

  Future<void> _persistLocalAndQueue() async {
    await _local.saveActive(state);
    final account = user;
    if (account == null) return;
    await _local.markDirty(account.email);
    _queueProgressSave();
  }

  void _queueProgressSave() {
    if (user == null || guestMode || syncPaused || _disposed) return;
    _pendingState = state;
    _revision++;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 650), () {
      unawaited(_flushProgress());
    });
  }

  Future<void> flushProgressNow() async {
    _saveTimer?.cancel();
    _retryTimer?.cancel();
    _retryTimer = null;
    await _flushProgress();
  }

  Future<void> _flushProgress() async {
    final account = user;
    final sent = _pendingState;
    if (account == null || guestMode || syncPaused || sent == null || _saving || _disposed) return;
    _saveTimer?.cancel();
    _saveTimer = null;
    _pendingState = null;
    final sentRevision = _revision;
    _saving = true;
    try {
      final result = await _progress.saveWithConflictRecovery(
        accessToken: _auth.currentUser == null
            ? ''
            : _backendToken(),
        localState: sent,
        baseState: _baseState,
        expectedUpdatedAt: updatedAt,
      );
      if (result.ok) {
        _baseState = result.state;
        updatedAt = result.updatedAt ?? updatedAt;
        _syncAttempts = 0;
        if (_revision == sentRevision && _pendingState == null) {
          state = result.state;
          await _local.saveAccount(account.email, state);
          await _local.markSynced(account.email, noPendingChanges: true);
        } else {
          _queueProgressSave();
        }
      } else {
        state = result.state;
        await _local.saveAccount(account.email, state);
        _pendingState ??= state;
        _scheduleRetry();
      }
    } catch (error) {
      lastError = error.toString();
      _pendingState ??= sent;
      _scheduleRetry();
    } finally {
      _saving = false;
      notifyListeners();
      if (_pendingState != null && _retryTimer == null && _saveTimer == null) {
        _queueProgressSave();
      }
    }
  }

  String _backendToken() => _auth.currentAccessToken ?? '';

  void _scheduleRetry() {
    if (_retryTimer != null || _pendingState == null || _disposed) return;
    final delayMs = (1000 * (1 << (_syncAttempts.clamp(0, 5)))).clamp(1000, 30000).toInt();
    _syncAttempts++;
    _retryTimer = Timer(Duration(milliseconds: delayMs), () {
      _retryTimer = null;
      unawaited(_flushProgress());
    });
  }

  Future<CloudyLessonResult> completeLesson(
    CloudySession session, {
    required Map<String, List<int>> levelLessonIndices,
    DateTime? now,
  }) async {
    final timestamp = now ?? DateTime.now();
    final result = finishCloudyLesson(
      state,
      session,
      now: timestamp,
      authenticated: user != null,
      levelLessonIndices: levelLessonIndices,
    );
    state = result.state;
    await _local.saveActive(state);
    if (user != null) {
      await _local.markDirty(user!.email);
      if (!session.review && session.lesson >= 0 && state.level != null) {
        try {
          final award = await _progress.awardLesson(
            accessToken: _backendToken(),
            lessonIndex: session.lesson,
            level: state.level!.code,
          );
          state = applyCloudyServerAward(state, session, {
            'awarded': award.awarded,
            'total_xp': award.totalXp,
            'week_key': award.weekKey,
            'week_xp': award.weekXp,
          }, now: timestamp);
          updatedAt = award.updatedAt ?? updatedAt;
          await _local.saveActive(state);
        } catch (error) {
          lastError = error.toString();
        }
      }
      _queueProgressSave();
    }
    notifyListeners();
    return CloudyLessonResult(
      state: state,
      gain: result.gain,
      stars: result.stars,
      accuracy: result.accuracy,
    );
  }

  Future<CloudyAnswerResult> answer({
    required CloudySession session,
    required CloudyExercise exercise,
    required bool correct,
    String? englishWord,
    String? selectedAnswer,
    String? correctAnswer,
    int? questionIndex,
    num? responseSeconds,
    bool skipped = false,
  }) async {
    if (skipped) {
      await _learning.track(
        'question_skipped',
        exercise: exercise,
        questionIndex: questionIndex,
      );
      return CloudyAnswerResult(state: state, session: skipCloudyAnswer(session));
    }
    final result = applyCloudyAnswer(
      state,
      session,
      correct: correct,
      englishWord: englishWord,
    );
    state = result.state;
    await _local.saveActive(state);
    await _learning.record(
      exercise,
      correct: correct,
      retry: session.retryPhase,
      questionIndex: questionIndex,
      responseSeconds: responseSeconds,
      selectedAnswer: selectedAnswer,
      correctAnswer: correctAnswer,
    );
    if (user != null) unawaited(_syncLearningEvents());
    if (user != null) {
      await _local.markDirty(user!.email);
      _queueProgressSave();
    }
    notifyListeners();
    return result;
  }

  Future<String> beginLearningSession(CloudySession session) =>
      _learning.beginSession(
        level: state.level?.code,
        lessonIndex: session.lesson,
        review: session.review,
      );

  Future<void> endLearningSession(String outcome) async {
    await _learning.endSession(outcome: outcome);
    if (user != null) await _syncLearningEvents();
  }

  Future<void> trackLearningEvent(
    String eventType, {
    CloudyExercise? exercise,
    int? questionIndex,
  }) async {
    await _learning.track(
      eventType,
      exercise: exercise,
      questionIndex: questionIndex,
    );
    if (user != null) await _syncLearningEvents();
  }

  Future<void> _syncLearningEvents() async {
    final account = user;
    if (account == null || guestMode || _disposed) return;
    try {
      await _learningSync.syncPending(_backendToken());
    } catch (_) {
      // The event outbox remains on-device and will retry on the next sync.
    }
  }

  Future<void> retryCloudSync() async {
    if (user == null) return;
    await flushProgressNow();
    await _syncLearningEvents();
  }

  @override
  void dispose() {
    _disposed = true;
    _saveTimer?.cancel();
    _retryTimer?.cancel();
    _authSubscription?.cancel();
    _backend.close();
    super.dispose();
  }
}
