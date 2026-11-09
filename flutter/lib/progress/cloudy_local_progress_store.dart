import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/cloudy_state.dart';

class CloudyAccountActivation {
  const CloudyAccountActivation({
    required this.state, required this.baseState, required this.updatedAt,
    required this.shouldSync, required this.syncPaused,
  });
  final CloudyState state, baseState;
  final String? updatedAt;
  final bool shouldSync, syncPaused;
}

/// Device-side progress storage using the same cl2 and cl2:<email> key scheme
/// as the current app. Account and guest progress remain separate.
class CloudyLocalProgressStore {
  CloudyLocalProgressStore(this._preferences);
  final SharedPreferences _preferences;

  static const activeAccountKey = 'cl2s';
  static const guestKey = 'cl2';

  static Future<CloudyLocalProgressStore> create() async =>
      CloudyLocalProgressStore(await SharedPreferences.getInstance());

  String accountKey(String email) => 'cl2:${email.trim().toLowerCase()}';
  String dirtyKey(String email) => 'cl2dirty:${email.trim().toLowerCase()}';
  String syncedKey(String email) => 'cl2sync:${email.trim().toLowerCase()}';

  String? get activeAccountEmail {
    final value = _preferences.getString(activeAccountKey)?.trim();
    return value == null || value.isEmpty ? null : value;
  }

  bool hasAccountSave(String email) => _preferences.containsKey(accountKey(email));

  CloudyState loadGuest() => _load(guestKey);
  CloudyState loadAccount(String email) => _load(accountKey(email));

  CloudyState loadActive() {
    final email = activeAccountEmail;
    return email == null ? loadGuest() : loadAccount(email);
  }

  CloudyState _load(String key) {
    try {
      final source = _preferences.getString(key);
      if (source == null || source.isEmpty) return CloudyState.defaults();
      return CloudyState.fromJson(jsonDecode(source));
    } catch (_) {
      return CloudyState.defaults();
    }
  }

  Future<void> saveGuest(CloudyState state) =>
      _preferences.setString(guestKey, jsonEncode(state.toJson()));

  Future<void> saveAccount(String email, CloudyState state) =>
      _preferences.setString(accountKey(email), jsonEncode(state.toJson()));

  Future<void> saveActive(CloudyState state) async {
    final email = activeAccountEmail;
    if (email == null) {
      await saveGuest(state);
    } else {
      await saveAccount(email, state);
    }
  }

  Future<void> enterGuestMode() async {
    await _preferences.setString(activeAccountKey, '');
  }

  Future<void> activateAccount(String email) async {
    await _preferences.setString(activeAccountKey, email.trim().toLowerCase());
  }

  Future<void> markDirty(String email, {DateTime? now}) async {
    await _preferences.setString(
      dirtyKey(email),
      (now ?? DateTime.now()).millisecondsSinceEpoch.toString(),
    );
  }

  Future<void> markSynced(
    String email, {
    DateTime? now,
    required bool noPendingChanges,
  }) async {
    await _preferences.setString(
      syncedKey(email),
      (now ?? DateTime.now()).millisecondsSinceEpoch.toString(),
    );
    if (noPendingChanges) await _preferences.remove(dirtyKey(email));
  }

  CloudyAccountActivation activateCloudAccount({
    required String email,
    required Map<String, Object?>? remoteState,
    required String? remoteUpdatedAt,
    required bool progressLoadFailed,
    String? profileLevel,
    bool placementTestCompleted = false,
  }) {
    final normalizedEmail = email.trim().toLowerCase();
    final localExists = hasAccountSave(normalizedEmail);
    final localState = loadAccount(normalizedEmail);
    final guestState = loadGuest();
    final localAt = int.tryParse(_preferences.getString(syncedKey(normalizedEmail)) ?? '') ?? 0;
    final dirtyAt = int.tryParse(_preferences.getString(dirtyKey(normalizedEmail)) ?? '') ?? 0;
    final remoteAt = DateTime.tryParse(remoteUpdatedAt ?? '')?.millisecondsSinceEpoch ?? 0;

    if (progressLoadFailed) {
      return CloudyAccountActivation(
        state: localState,
        baseState: CloudyState.defaults(),
        updatedAt: remoteUpdatedAt,
        shouldSync: false,
        syncPaused: true,
      );
    }

    CloudyState? cloud;
    if (remoteState != null) {
      cloud = CloudyState.fromJson(remoteState);
    } else if (CloudyProfileLevel.isValid(profileLevel)) {
      cloud = CloudyState.defaults().copyWith(
        level: CloudyLevelCode.fromCode(profileLevel),
        tested: placementTestCompleted ? 1 : 0,
      );
    }
    if (cloud != null && CloudyProfileLevel.isValid(profileLevel)) {
      cloud = cloud.copyWith(
        level: CloudyLevelCode.fromCode(profileLevel),
        tested: placementTestCompleted || cloud.tested != 0 ? 1 : 0,
      );
    }

    final shouldUseRemote = cloud != null &&
        (!localExists ||
            (dirtyAt <= 0 && remoteAt > localAt) ||
            (dirtyAt > 0 && remoteAt >= dirtyAt));

    if (shouldUseRemote) {
      return CloudyAccountActivation(
        state: cloud,
        baseState: cloud,
        updatedAt: remoteUpdatedAt,
        shouldSync: false,
        syncPaused: false,
      );
    }

    if (!localExists && cloud == null && guestState.level != null) {
      final migratedGuest = profileLevel != null && CloudyProfileLevel.isValid(profileLevel)
          ? guestState.copyWith(
              level: CloudyLevelCode.fromCode(profileLevel),
              tested: placementTestCompleted || guestState.tested != 0 ? 1 : 0,
            )
          : guestState;
      return CloudyAccountActivation(
        state: migratedGuest,
        baseState: cloud ?? CloudyState.defaults(),
        updatedAt: remoteUpdatedAt,
        shouldSync: true,
        syncPaused: false,
      );
    }

    return CloudyAccountActivation(
      state: localExists ? localState : (cloud ?? guestState),
      baseState: cloud ?? CloudyState.defaults(),
      updatedAt: remoteUpdatedAt,
      shouldSync: cloud == null || localExists,
      syncPaused: false,
    );
  }

  Future<void> persistActivation(String email, CloudyAccountActivation activation) async {
    await activateAccount(email);
    await saveAccount(email, activation.state);
  }
}

class CloudyProfileLevel {
  const CloudyProfileLevel._();
  static bool isValid(String? value) =>
      const {'A1', 'A2', 'B1', 'B2'}.contains(value);
}
