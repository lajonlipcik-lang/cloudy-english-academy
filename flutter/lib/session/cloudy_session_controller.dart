import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/cloudy_auth_repository.dart';
import '../data/cloudy_mobile_api.dart';
import '../domain/cloudy_exercise.dart';
import '../domain/cloudy_learning_store.dart';
import '../domain/cloudy_state.dart';
import '../domain/cloudy_progress_engine.dart';
import '../progress/cloudy_local_progress_store.dart';
import '../services/cloudy_progress_sync_service.dart';
import '../services/cloudy_media_service.dart';
import '../services/cloudy_sound_service.dart';
import '../services/cloudy_speech_recognition_service.dart';

enum CloudySessionStatus {
  starting,
  guest,
  loadingAccount,
  signedIn,
  offline,
}

/// Coordinates Supabase identity with the existing guest/account progress keys.
/// It deliberately pauses cloud writes if the initial remote read fails: a
/// temporary network error must never overwrite a user's server-side progress.
class CloudySessionController extends ChangeNotifier {
  CloudySessionController({
    required CloudyAuthRepository auth,
    required CloudyLocalProgressStore localProgress,
    required CloudyMobileApi mobileApi,
    CloudyMediaService? media,
  })  : _auth = auth,
        _localProgress = localProgress,
        _mobileApi = mobileApi,
        _progressSync = CloudyProgressSyncService(
          localStore: localProgress,
          api: mobileApi,
        ),
        _media = media ?? CloudyMediaService();

  final CloudyAuthRepository _auth;
  final CloudyLocalProgressStore _localProgress;
  final CloudyMobileApi _mobileApi;
  final CloudyProgressSyncService _progressSync;
  final CloudyMediaService _media;

  StreamSubscription<AuthState>? _authSubscription;
  CloudySessionStatus _status = CloudySessionStatus.starting;
  CloudyAuthUser? _user;
  CloudyState _progress = CloudyState.defaults();
  CloudySubscriptionAccess _subscriptionAccess = CloudySubscriptionAccess.inactive();
  String? _errorMessage;
  String? _loadedUserId;
  String? _pendingGuestError;
  bool _disposed = false;
  Future<void> _eventQueue = Future<void>.value();

  CloudySessionStatus get status => _status;
  CloudyAuthUser? get user => _user;
  CloudyState get progress => _progress;
  CloudySubscriptionAccess get subscriptionAccess => _subscriptionAccess;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _user != null;
  bool get cloudSyncPaused => _status == CloudySessionStatus.offline;

  /// Call once after Supabase.initialize and local preferences are ready.
  Future<void> start() async {
    if (_authSubscription != null) return;
    _progress = _localProgress.loadActive();
    await _media.applySettings(_progress.settings);
    _publish(CloudySessionStatus.starting);
    _authSubscription = _auth.authChanges.listen(
      (event) {
        // Serialize auth events so an older activation cannot win a race
        // against a newer sign-in/sign-out event.
        _eventQueue = _eventQueue
            .then((_) => _handleAuthEvent(event))
            .catchError((Object error, StackTrace stackTrace) {
          _setError('Не удалось обработать изменение аккаунта. Повторите вход.');
        });
      },
      onError: (Object error, StackTrace stackTrace) {
        _setError('Не удалось обновить сессию. Проверьте подключение к интернету.');
      },
    );
  }

  Future<void> _handleAuthEvent(AuthState event) async {
    if (_disposed) return;
    final session = event.session;
    if (session == null || event.event == AuthChangeEvent.signedOut) {
      _loadedUserId = null;
      _user = null;
      _subscriptionAccess = CloudySubscriptionAccess.inactive();
      _progress = await _progressSync.activateGuest();
      await _media.applySettings(_progress.settings);
      _errorMessage = _pendingGuestError;
      _pendingGuestError = null;
      _publish(CloudySessionStatus.guest);
      return;
    }

    final identity = session.user;
    if (CloudyAuthPolicy.isUnderMinimumAge(identity.userMetadata?['age'])) {
      _pendingGuestError =
          'Регистрация в Cloudy English Academy доступна с 13 лет. '
          'Если возраст указан неверно, обратитесь в поддержку.';
      await _auth.signOut();
      return;
    }
    final nextUser = CloudyAuthUser.fromSupabase(identity);
    if (_loadedUserId == identity.id && _user?.email == nextUser.email) {
      _user = nextUser;
      if (_status != CloudySessionStatus.offline) {
        _publish(CloudySessionStatus.signedIn);
      }
      return;
    }

    _pendingGuestError = null;
    _user = nextUser;
    _publish(CloudySessionStatus.loadingAccount);
    await _activateAccount(nextUser, identity.id);
  }

  Future<void> _activateAccount(CloudyAuthUser user, String userId) async {
    _subscriptionAccess = CloudySubscriptionAccess.inactive();
    final result = await _progressSync.activateAccount(email: user.email);
    if (_disposed || _user?.id != user.id) return;

    _progress = result.state;
    await _media.applySettings(_progress.settings);
    _loadedUserId = userId;
    if (result.syncPaused) {
      _setError(
        result.error ??
            'Аккаунт открыт, но прогресс пока не синхронизирован. '
                'Локальные данные сохранены; повторная синхронизация безопасно продолжится позже.',
        status: CloudySessionStatus.offline,
      );
      return;
    }

    _errorMessage = null;
    _publish(CloudySessionStatus.signedIn);
    try {
      await _progressSync.syncLearningEvents();
    } catch (_) {
      // The event outbox remains on-device and can be retried later.
    }
    try {
      await refreshSubscriptionAccess();
    } catch (_) {
      // Subscription lookup must never block access to the free learning path.
      // A later retry can refresh this independently after a network failure.
    }
  }

  /// Refreshes the server-authoritative subscription state after login or a
  /// verified purchase callback. The app never grants paid access from a
  /// client-side purchase flag.
  Future<void> refreshSubscriptionAccess() async {
    final userId = _user?.id;
    if (userId == null) {
      _subscriptionAccess = CloudySubscriptionAccess.inactive();
      _notify();
      return;
    }
    final access = await _mobileApi.loadSubscriptionAccess();
    if (_disposed || _user?.id != userId) return;
    _subscriptionAccess = access;
    _notify();
  }

  /// Retries the account progress handshake after a network interruption.
  /// The remote snapshot is fetched again before any write is attempted.
  Future<void> retryAccountSync() async {
    final currentUser = _user;
    if (currentUser == null) return;
    _publish(CloudySessionStatus.loadingAccount);
    await _activateAccount(currentUser, currentUser.id);
  }

  /// Saves locally first, then syncs with the server using revision checks.
  Future<void> saveProgress(CloudyState next) async {
    final result = await _progressSync.saveLocal(next);
    _progress = result.state;
    await _media.applySettings(_progress.settings);
    if (result.syncPaused && _user != null) {
      _setError(
        result.error ??
            'Прогресс сохранён на устройстве, но пока не отправлен на сервер.',
        status: CloudySessionStatus.offline,
      );
      return;
    }
    _errorMessage = null;
    _publish(_user == null ? CloudySessionStatus.guest : CloudySessionStatus.signedIn);
  }

  Future<void> syncProgress() async {
    if (_user == null) return;
    final result = await _progressSync.syncCurrent();
    _progress = result.state;
    if (result.syncPaused) {
      _setError(
        result.error ?? 'Не удалось синхронизировать прогресс.',
        status: CloudySessionStatus.offline,
      );
    } else {
      _errorMessage = null;
      _publish(CloudySessionStatus.signedIn);
    }
  }

  Future<CloudyState> awardLesson(CloudySession session, {DateTime? now}) async {
    final updated = await _progressSync.awardLesson(_progress, session, now: now);
    _progress = updated;
    await _media.applySettings(_progress.settings);
    _publish(_status);
    return updated;
  }

  Future<Map<String, Object?>?> recordLearningAnswer(
    CloudyExercise exercise, {
    required bool correct,
    bool retry = false,
    bool skipped = false,
    int? questionIndex,
    num? responseSeconds,
    String? selectedAnswer,
    String? correctAnswer,
    DateTime? now,
  }) => _progressSync.recordLearningAnswer(
    exercise,
    correct: correct,
    retry: retry,
    skipped: skipped,
    questionIndex: questionIndex,
    responseSeconds: responseSeconds,
    selectedAnswer: selectedAnswer,
    correctAnswer: correctAnswer,
    now: now,
  );

  Future<int> syncLearningEvents() => _progressSync.syncLearningEvents();

  Future<CloudyLearningStore> get learningStore => _progressSync.learningStore;

  Future<void> speak(String text, {bool force = false}) =>
      _media.speak(text, force: force);

  Future<CloudySpeechRecognitionResult> recognizeAnswer(
    String target, {
    Duration listenFor = const Duration(seconds: 8),
    Duration pauseFor = const Duration(seconds: 2),
  }) => _media.recognizeAnswer(
    target,
    listenFor: listenFor,
    pauseFor: pauseFor,
  );

  Future<void> playSound(CloudySound effect, {int combo = 0}) =>
      _media.play(effect, combo: combo);

  Future<void> stopMedia() => _media.stop();

  Future<void> enterGuestMode() async {
    await _auth.signOut();
    // signedOut auth event performs the account/guest transition.
  }

  void _setError(String message, {CloudySessionStatus? status}) {
    _errorMessage = message;
    if (status != null) _status = status;
    _notify();
  }

  void _publish(CloudySessionStatus status) {
    _status = status;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_authSubscription?.cancel());
    _mobileApi.close();
    unawaited(_media.dispose());
    super.dispose();
  }
}