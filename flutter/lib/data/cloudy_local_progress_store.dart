import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';

/// Device-local storage for the original Cloudy cl2 progress namespaces.
///
/// The guest key, account key format and active-account pointer intentionally
/// match the current browser runtime. Switching identities never deletes data.
class CloudyLocalProgressStore {
  CloudyLocalProgressStore(this._preferences);

  final SharedPreferences _preferences;

  static const guestKey = 'cl2';
  static const activeAccountKey = 'cl2s';
  static const _accountPrefix = 'cl2:';

  static Future<CloudyLocalProgressStore> create() async =>
      CloudyLocalProgressStore(await SharedPreferences.getInstance());

  static String accountStorageKey(String email) {
    final normalized = _normalizeEmail(email);
    if (normalized.isEmpty) {
      throw ArgumentError.value(email, 'email', 'Account email must not be empty.');
    }
    return '$_accountPrefix$normalized';
  }

  static String _normalizeEmail(String email) => email.trim().toLowerCase();

  String? get activeAccountEmail {
    final stored = _preferences.getString(activeAccountKey);
    if (stored == null) return null;
    final normalized = _normalizeEmail(stored);
    return normalized.isEmpty ? null : normalized;
  }

  Future<CloudyState> loadGuest() => _load(guestKey);

  Future<CloudyState> saveGuest(CloudyState state) => _save(guestKey, state);

  Future<CloudyState> loadAccount(String email) =>
      _load(accountStorageKey(email));

  Future<CloudyState> saveAccount(String email, CloudyState state) =>
      _save(accountStorageKey(email), state);

  Future<CloudyState> activateAccount(String email) async {
    final key = accountStorageKey(email);
    await _preferences.setString(activeAccountKey, _normalizeEmail(email));
    return _load(key);
  }

  Future<CloudyState> activateGuest() async {
    await _preferences.remove(activeAccountKey);
    return loadGuest();
  }

  Future<CloudyState> loadActive() {
    final email = activeAccountEmail;
    return email == null ? loadGuest() : loadAccount(email);
  }

  Future<CloudyState> _load(String key) async {
    final raw = _preferences.getString(key);
    if (raw == null || raw.isEmpty) return CloudyState.defaults();
    try {
      return CloudyState.fromJson(jsonDecode(raw));
    } on FormatException {
      return CloudyState.defaults();
    } on TypeError {
      return CloudyState.defaults();
    }
  }

  Future<CloudyState> _save(String key, CloudyState state) async {
    final safeState = sanitizeCloudyProgress(state);
    await _preferences.setString(key, jsonEncode(safeState.toJson()));
    return safeState;
  }
}
