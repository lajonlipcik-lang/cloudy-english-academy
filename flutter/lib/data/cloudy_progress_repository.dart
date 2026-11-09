import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/cloudy_logic.dart';
import '../domain/cloudy_state.dart';

/// Persists Cloudy's existing cl2 progress contract on the device.
///
/// Storage names intentionally match the browser runtime:
/// - "cl2" for guest progress
/// - "cl2:<email>" for an account
/// - "cl2s" for the active account email
///
/// This repository does not silently merge or delete guest data.
class CloudyProgressRepository {
  CloudyProgressRepository(this._preferences);

  final SharedPreferences _preferences;

  static const guestKey = 'cl2';
  static const activeAccountKey = 'cl2s';
  static const _accountPrefix = 'cl2:';

  static Future<CloudyProgressRepository> create() async =>
      CloudyProgressRepository(await SharedPreferences.getInstance());

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

  Future<CloudyState> saveGuest(CloudyState state) =>
      _save(guestKey, state);

  Future<CloudyState> loadAccount(String email) =>
      _load(accountStorageKey(email));

  Future<CloudyState> saveAccount(String email, CloudyState state) =>
      _save(accountStorageKey(email), state);

  /// Activates the existing account-specific progress namespace.
  /// A missing account save is returned as a clean default state.
  Future<CloudyState> activateAccount(String email) async {
    final key = accountStorageKey(email);
    final normalized = _normalizeEmail(email);
    await _preferences.setString(activeAccountKey, normalized);
    return _load(key);
  }

  /// Returns to the guest namespace without deleting either account or guest data.
  Future<CloudyState> activateGuest() async {
    await _preferences.remove(activeAccountKey);
    return loadGuest();
  }

  Future<CloudyState> loadActive() {
    final email = activeAccountEmail;
    return email == null ? loadGuest() : loadAccount(email);
  }

  Future<CloudyState> mergeGuestIntoAccount(String email) async {
    final guest = await loadGuest();
    final account = await loadAccount(email);
    final merged = sanitizeCloudyProgress(mergeCloudyProgress(guest, account));
    await saveAccount(email, merged);
    return merged;
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
