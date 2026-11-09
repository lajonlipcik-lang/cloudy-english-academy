import '../data/cloudy_mobile_api.dart';
import '../domain/cloudy_exercise.dart';
import '../domain/cloudy_learning_store.dart';
import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';
import 'cloudy_local_progress_store.dart';

class CloudyProgressSyncResult {
  const CloudyProgressSyncResult({
    required this.state,
    required this.syncPaused,
    required this.uploaded,
    this.updatedAt,
    this.error,
  });

  final CloudyState state;
  final bool syncPaused;
  final bool uploaded;
  final String? updatedAt;
  final String? error;
}

/// Coordinates the existing cl2 local store with the authenticated mobile API.
/// Server XP remains authoritative for account lessons; guest XP stays local.
class CloudyProgressSyncService {
  CloudyProgressSyncService({
    required this.localStore,
    required this.api,
  });

  final CloudyLocalProgressStore localStore;
  final CloudyMobileApi api;

  String? _activeEmail;
  String? _updatedAt;
  CloudyState _baseState = CloudyState.defaults();
  CloudyLearningStore? _learningStore;
  bool _syncPaused = false;
  Future<void> _operationQueue = Future<void>.value();

  Future<T> _serialize<T>(Future<T> Function() operation) {
    final result = _operationQueue.then((_) => operation());
    _operationQueue = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  String? get activeEmail => _activeEmail;

  Future<CloudyLearningStore> get learningStore async {
    _learningStore ??= await CloudyLearningStore.create(
      scope: _activeEmail == null ? 'cl2' : 'cl2:$_activeEmail',
    );
    return _learningStore!;
  }

  Future<CloudyState> activateGuest() => _serialize(() async {
    await localStore.enterGuestMode();
    _activeEmail = null;
    _updatedAt = null;
    _baseState = CloudyState.defaults();
    _syncPaused = false;
    _learningStore = await CloudyLearningStore.create(scope: 'cl2');
    return localStore.loadGuest();
  });

  Future<CloudyProgressSyncResult> activateAccount({
    required String email,
  }) => _serialize(() async {
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty) {
      throw ArgumentError.value(email, 'email', 'Account email must not be empty.');
    }

    CloudyRemoteProgress remote;
    try {
      remote = await api.loadProgress();
    } catch (error) {
      final activation = localStore.activateCloudAccount(
        email: normalizedEmail,
        remoteState: null,
        remoteUpdatedAt: null,
        progressLoadFailed: true,
      );
      await localStore.persistActivation(normalizedEmail, activation);
      _activeEmail = normalizedEmail;
      _updatedAt = activation.updatedAt;
      _baseState = activation.baseState;
      _syncPaused = true;
      _learningStore = await CloudyLearningStore.create(
        scope: 'cl2:$normalizedEmail',
      );
      return CloudyProgressSyncResult(
        state: activation.state,
        syncPaused: true,
        uploaded: false,
        updatedAt: activation.updatedAt,
        error: error.toString(),
      );
    }

    final profile = remote.learnerProfile;
    final profileLevel = profile?['english_level'] is String
        ? profile!['english_level'] as String
        : null;
    final placementCompleted = profile?['placement_test_completed'] == true;
    final activation = localStore.activateCloudAccount(
      email: normalizedEmail,
      remoteState: remote.hasProgressRow ? remote.state.toJson() : null,
      remoteUpdatedAt: remote.updatedAt,
      progressLoadFailed: false,
      profileLevel: profileLevel,
      placementTestCompleted: placementCompleted,
    );
    await localStore.persistActivation(normalizedEmail, activation);
    _activeEmail = normalizedEmail;
    _updatedAt = activation.updatedAt;
    _baseState = activation.baseState;
    _syncPaused = activation.syncPaused;
    _learningStore = await CloudyLearningStore.create(
      scope: 'cl2:$normalizedEmail',
    );

    if (activation.syncPaused) {
      return CloudyProgressSyncResult(
        state: activation.state,
        syncPaused: true,
        uploaded: false,
        updatedAt: activation.updatedAt,
      );
    }
    if (activation.shouldSync) {
      return _saveWithConflict(
        normalizedEmail,
        activation.state,
        activation.baseState,
        activation.updatedAt,
      );
    }

    await localStore.markSynced(
      normalizedEmail,
      noPendingChanges: true,
    );
    return CloudyProgressSyncResult(
      state: activation.state,
      syncPaused: false,
      uploaded: false,
      updatedAt: activation.updatedAt,
    );
  });

  Future<CloudyProgressSyncResult> saveLocal(CloudyState state) =>
      _serialize(() async {
    await localStore.saveActive(state);
    final email = _activeEmail ?? localStore.activeAccountEmail;
    if (email == null) {
      return CloudyProgressSyncResult(
        state: state,
        syncPaused: false,
        uploaded: false,
      );
    }
    if (_syncPaused) {
      await localStore.markDirty(email);
      return CloudyProgressSyncResult(
        state: state,
        syncPaused: true,
        uploaded: false,
        updatedAt: _updatedAt,
        error: 'Синхронизация приостановлена до повторной загрузки серверного прогресса.',
      );
    }
    return _syncCurrent();
  });

  Future<CloudyProgressSyncResult> syncCurrent() =>
      _serialize(_syncCurrent);

  Future<CloudyProgressSyncResult> _syncCurrent() async {
    final email = _activeEmail ?? localStore.activeAccountEmail;
    if (email == null) {
      return CloudyProgressSyncResult(
        state: localStore.loadGuest(),
        syncPaused: false,
        uploaded: false,
      );
    }
    if (_syncPaused) {
      return CloudyProgressSyncResult(
        state: localStore.loadAccount(email),
        syncPaused: true,
        uploaded: false,
        updatedAt: _updatedAt,
        error: 'Синхронизация приостановлена до повторной загрузки серверного прогресса.',
      );
    }
    return _saveWithConflict(
      email,
      localStore.loadAccount(email),
      _baseState,
      _updatedAt,
    );
  }

  Future<CloudyProgressSyncResult> _saveWithConflict(
    String email,
    CloudyState initialState,
    CloudyState initialBase,
    String? initialUpdatedAt,
  ) async {
    var state = initialState;
    var base = initialBase;
    var expectedUpdatedAt = initialUpdatedAt;

    try {
      await localStore.markDirty(email);
      for (var attempt = 0; attempt < 3; attempt++) {
        final result = await api.saveProgress(
          state,
          expectedUpdatedAt: expectedUpdatedAt,
        );

        if (result['conflict'] == true) {
          final rawRemote = result['state'];
          if (rawRemote is! Map) {
            _syncPaused = true;
            return CloudyProgressSyncResult(
              state: state,
              syncPaused: true,
              uploaded: false,
              updatedAt: expectedUpdatedAt,
              error: 'Сервер сообщил о конфликте, но не вернул актуальный прогресс.',
            );
          }
          final remote = CloudyState.fromJson(rawRemote);
          state = mergeCloudyConflictProgress(remote, state, base);
          base = remote;
          _baseState = remote;
          expectedUpdatedAt = result['updated_at'] is String
              ? result['updated_at'] as String
              : expectedUpdatedAt;
          _updatedAt = expectedUpdatedAt;
          await localStore.saveAccount(email, state);
          continue;
        }

        if (result['ok'] != true) {
          _syncPaused = true;
          final message = result['error'];
          return CloudyProgressSyncResult(
            state: state,
            syncPaused: true,
            uploaded: false,
            updatedAt: expectedUpdatedAt,
            error: message is String ? message : 'Не удалось сохранить прогресс.',
          );
        }

        final rawSaved = result['state'];
        final savedState = rawSaved is Map
            ? CloudyState.fromJson(rawSaved)
            : state;
        _updatedAt = result['updated_at'] is String
            ? result['updated_at'] as String
            : expectedUpdatedAt;
        _baseState = savedState;
        _syncPaused = false;
        await localStore.saveAccount(email, savedState);
        await localStore.markSynced(email, noPendingChanges: true);
        return CloudyProgressSyncResult(
          state: savedState,
          syncPaused: false,
          uploaded: true,
          updatedAt: _updatedAt,
        );
      }
      _syncPaused = true;
      return CloudyProgressSyncResult(
        state: state,
        syncPaused: true,
        uploaded: false,
        updatedAt: expectedUpdatedAt,
        error: 'Прогресс менялся одновременно на нескольких устройствах. Повтори синхронизацию.',
      );
    } catch (error) {
      _syncPaused = true;
      return CloudyProgressSyncResult(
        state: state,
        syncPaused: true,
        uploaded: false,
        updatedAt: expectedUpdatedAt,
        error: error.toString(),
      );
    }
  }

  Future<CloudyState> awardLesson(
    CloudyState state,
    CloudySession session, {
    DateTime? now,
  }) => _serialize(() async {
    if (session.review) return state;
    final email = _activeEmail ?? localStore.activeAccountEmail;
    if (_syncPaused) {
      throw const CloudyMobileApiException(
        'Синхронизация прогресса приостановлена. Повторите загрузку аккаунта.',
      );
    }
    if (email == null) {
      throw const CloudyMobileApiException(
        'Начисление серверного опыта доступно только в аккаунте.',
        statusCode: 401,
      );
    }
    final level = state.level?.code;
    if (level == null) {
      throw const CloudyMobileApiException('Сначала пройди определение уровня.');
    }
    final award = await api.awardLesson(
      lessonIndex: session.lesson,
      level: level,
    );
    final updated = applyCloudyServerAward(
      state,
      session,
      award,
      now: now ?? DateTime.now(),
    );
    await localStore.saveAccount(email, updated);
    _baseState = updated;
    if (award['updated_at'] is String) {
      _updatedAt = award['updated_at'] as String;
    }
    await localStore.markSynced(email, noPendingChanges: true);
    return updated;
  });

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
  }) => _serialize(() async {
    final store = await learningStore;
    return store.record(
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
  });

  Future<int> syncLearningEvents() => _serialize(() async {
    if (_activeEmail == null || _syncPaused) return 0;
    final store = await learningStore;
    final events = store.pending(limit: 50);
    if (events.isEmpty) return 0;
    final acceptedIds = await api.syncLearningEvents(events);
    return store.acknowledge(acceptedIds);
  });
}
