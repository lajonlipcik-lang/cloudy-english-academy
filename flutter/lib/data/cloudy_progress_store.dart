import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/cloudy_logic.dart';
import '../domain/cloudy_state.dart';

/// Local progress storage compatible with the browser app's cl2 key layout.
/// Guest progress stays under cl2; authenticated scopes use cl2:<scope>.
class CloudyProgressStore {
  CloudyProgressStore(this._preferences);

  final SharedPreferences _preferences;

  static Future<CloudyProgressStore> create() async =>
      CloudyProgressStore(await SharedPreferences.getInstance());

  static const String guestKey = 'cl2';
  static const String scopeKey = 'cl2s';

  static String keyForScope(String? scope) {
    if (scope == null || scope.isEmpty) return guestKey;
    return 'cl2:$scope';
  }

  String? get currentScope {
    final value = _preferences.getString(scopeKey);
    return value == null || value.isEmpty ? null : value;
  }

  String get currentKey => keyForScope(currentScope);

  Future<void> setCurrentScope(String? scope) async {
    if (scope == null || scope.isEmpty) {
      await _preferences.setString(scopeKey, '');
    } else {
      await _preferences.setString(scopeKey, scope);
    }
  }

  CloudyState loadGuest() => _read(guestKey);

  CloudyState loadCurrent() => _read(currentKey);

  CloudyState loadScope(String? scope) => _read(keyForScope(scope));

  Future<void> saveGuest(CloudyState state) => _write(guestKey, state);

  Future<void> saveCurrent(CloudyState state) => _write(currentKey, state);

  Future<void> saveScope(String? scope, CloudyState state) =>
      _write(keyForScope(scope), state);

  CloudyState mergeGuestIntoScope(String scope) {
    if (scope.isEmpty) {
      throw ArgumentError.value(scope, 'scope', 'Account scope must not be empty.');
    }
    final account = _read(keyForScope(scope));
    final guest = _read(guestKey);
    return mergeCloudyProgress(guest, account);
  }

  Future<CloudyState> mergeAndSaveGuestIntoScope(String scope) async {
    final merged = mergeGuestIntoScope(scope);
    await _write(keyForScope(scope), merged);
    return merged;
  }

  /// Call only after the server confirms that the merged account progress is saved.
  Future<bool> clearGuestAfterSuccessfulSync({required bool serverConfirmed}) async {
    if (!serverConfirmed) return false;
    return _preferences.remove(guestKey);
  }

  Future<void> _write(String key, CloudyState state) async {
    final normalized = sanitizeCloudyProgress(state);
    await _preferences.setString(key, jsonEncode(normalized.toJson()));
  }

  CloudyState _read(String key) {
    try {
      final raw = _preferences.getString(key);
      if (raw == null || raw.isEmpty) return CloudyState.defaults();
      return sanitizeCloudyProgress(CloudyState.fromJson(jsonDecode(raw)));
    } catch (_) {
      return CloudyState.defaults();
    }
  }
}
