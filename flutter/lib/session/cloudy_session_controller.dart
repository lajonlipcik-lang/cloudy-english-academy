import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/cloudy_auth_repository.dart';
import '../data/cloudy_mobile_api.dart';
import '../domain/cloudy_state.dart';
import '../progress/cloudy_local_progress_store.dart';

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
  })  : _auth = auth,
        _localProgress = localProgress,
        _mobileApi = mobileApi;

  final CloudyAuthRepository _auth;
  final CloudyLocalProgressStore _localProgress;
  final CloudyMobileApi _mobileApi;

  StreamSubscription<AuthState>? _authSubscription;
  CloudySessionStatus _status = CloudySessionStatus.starting;
  CloudyAuthUser? _user;
  CloudyState _progress = CloudyState.defaults();
  String? _errorMessage;
  String? _loadedUserId;
  bool _disposed = false;
  Future<void> _eventQueue = Future<void>.value();

  CloudySessionStatus get status => _status;
  CloudyAuthUser? get user => _user;
  CloudyState get progress => _progress;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _user != null;
  bool get cloudSyncPaused => _status == CloudySessionStatus.offline;

  /// Call once after Supabase.initialize and local preferences are ready.
  Future<void> start() async {
    if (_authSubscription != null) return;
    _progress = _localProgress.loadActive();
    _publish(CloudySessionStatus.starting);
    _authSubscription = _auth.authChanges.listen(
      (event) {
        // Serialize auth events so an older activation cannot win a race
        // against a newer sign-in/sign-out event.
        _eventQueue = _eventQueue.then((_) => _handleAuthEvent(event));
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
      await _localProgress.enterGuestMode();
      _progress = _localProgress.loadGuest();
      _errorMessage = null;
      _publish(CloudySessionStatus.guest);
      return;
    }

    final identity = session.user;
    final nextUser = CloudyAuthUser.fromSupabase(identity);
    if (_loadedUserId == identity.id && _user?.email == nextUser.email) {
      _user = nextUser;
      if (_status != CloudySessionStatus.offline) {
        _publish(CloudySessionStatus.signedIn);
      }
      return;
    }

    _user = nextUser;
    _publish(CloudySessionStatus.loadingAccount);
    await _activateAccount(nextUser, identity.id);
  }

  Future<void> _activateAccount(CloudyAuthUser user, String userId) async {
    CloudyRemoteProgress? remote;
    Object? loadError;
    try {
      remote = await _mobileApi.loadProgress();
    } catch (error) {
      loadError = error;
    }
    if (_disposed || _user?.id != user.id) return;

    final activation = _localProgress.activateCloudAccount(
      email: user.email,
      remoteState: remote?.hasProgressRow == true ? remote!.state.toJson() : null,
      remoteUpdatedAt: remote?.updatedAt,
      progressLoadFailed: loadError != null,
      profileLevel: remote?.learnerProfile?['english_level'] as String?,
      placementTestCompleted:
          remote?.learnerProfile?['placement_test_completed'] == true,
    );
    await _localProgress.persistActivation(user.email, activation);
    if (_disposed || _user?.id != user.id) return;

    _progress = activation.state;
    _loadedUserId = userId;
    if (activation.syncPaused) {
      _setError(
        'Аккаунт открыт, но прогресс пока не синхронизирован. '
        'Локальные данные сохранены; повторная синхронизация безопасно продолжится позже.',
        status: CloudySessionStatus.offline,
      );
      return;
    }

    _errorMessage = null;
    _publish(CloudySessionStatus.signedIn);
    if (activation.shouldSync) {
      await _syncActivatedProgress(user.email, activation);
    }
  }

  Future<void> _syncActivatedProgress(
    String email,
    CloudyAccountActivation activation,
  ) async {
    await _localProgress.markDirty(email);
    try {
      final result = await _mobileApi.saveProgress(
        activation.state,
        expectedUpdatedAt: activation.updatedAt,
      );
      if (result['conflict'] == true) {
        _setError(
          'Прогресс изменился на другом устройстве. '
          'Синхронизация приостановлена, чтобы не потерять данные.',
          status: CloudySessionStatus.offline,
        );
        return;
      }
      final updatedAt = result['updated_at'];
      await _localProgress.markSynced(
        email,
        noPendingChanges: true,
      );
      if (updatedAt is String && updatedAt.isNotEmpty) {
        // The next activation obtains the authoritative timestamp from the API.
      }
    } catch (_) {
      _setError(
        'Прогресс сохранён на устройстве, но не отправлен на сервер. '
        'Повторите синхронизацию при подключении к интернету.',
        status: CloudySessionStatus.offline,
      );
    }
  }

  /// Persists the latest in-memory state before attempting any cloud write.
  Future<void> saveProgress(CloudyState next) async {
    _progress = next;
    final email = _user?.email;
    if (email == null) {
      await _localProgress.saveGuest(next);
      _publish(_status);
      return;
    }
    await _localProgress.saveAccount(email, next);
    await _localProgress.markDirty(email);
    _publish(_status);
  }

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
    super.dispose();
  }
}