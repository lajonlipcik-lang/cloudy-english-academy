import 'package:supabase_flutter/supabase_flutter.dart';

class CloudyAuthException implements Exception {
  const CloudyAuthException(this.message);
  final String message;

  @override
  String toString() => message;
}

class CloudyAuthUser {
  const CloudyAuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.age,
  });

  final String id;
  final String email;
  final String name;
  final int? age;

  factory CloudyAuthUser.fromSupabase(User user) => CloudyAuthUser(
    id: user.id,
    email: user.email ?? '',
    name: user.userMetadata?['name'] is String
        ? user.userMetadata!['name'] as String
        : user.userMetadata?['display_name'] is String
            ? user.userMetadata!['display_name'] as String
            : '',
    age: CloudyAuthPolicy.ageFromMetadata(user.userMetadata?['age']),
  );
}

class CloudyAuthResult {
  const CloudyAuthResult({
    required this.user,
    required this.accessToken,
    this.needsConfirmation = false,
  });

  final CloudyAuthUser? user;
  final String? accessToken;
  final bool needsConfirmation;
}

class CloudyAuthPolicy {
  const CloudyAuthPolicy._();

  static int? ageFromMetadata(Object? value) {
    final age = value is num
        ? (value.isFinite && value == value.roundToDouble() ? value.toInt() : null)
        : value is String
            ? int.tryParse(value.trim())
            : null;
    return age != null && age >= 13 && age <= 120 ? age : null;
  }

  static bool isUnderMinimumAge(Object? value) {
    final age = value is num
        ? (value.isFinite && value == value.roundToDouble() ? value.toInt() : null)
        : value is String
            ? int.tryParse(value.trim())
            : null;
    return age != null && age < 13;
  }

  static Map<String, dynamic> profileUpdateData(
    Map<String, dynamic> current, {
    String? name,
    int? age,
  }) {
    if (age != null && (age < 13 || age > 120)) {
      throw const CloudyAuthException(
        'Возраст должен быть указан в полных годах и составлять не менее 13 лет.',
      );
    }

    final trimmedName = name?.trim();
    final newName = trimmedName == null || trimmedName.isEmpty
        ? null
        : trimmedName.substring(0, trimmedName.length > 40 ? 40 : trimmedName.length);
    final currentAge = ageFromMetadata(current['age']);
    final hasStoredAge = currentAge != null;

    if (age != null && hasStoredAge && currentAge != age && newName == null) {
      throw const CloudyAuthException(
        'Изменение возраста доступно только через поддержку @cloudysupportt_bot.',
      );
    }

    final newAge = age != null && !hasStoredAge ? age : null;
    if (newAge == null && newName == null) {
      throw const CloudyAuthException('Укажите корректное имя или возраст.');
    }

    final result = Map<String, dynamic>.of(current);
    if (hasStoredAge) {
      result['age'] = currentAge;
    } else if (newAge != null) {
      result['age'] = newAge;
    }
    if (newName != null) result['name'] = newName;
    return result;
  }
}

/// Native Supabase auth adapter. Only the public anon key is accepted here;
/// never ship a service-role key in the Flutter application.
class CloudyAuthRepository {
  CloudyAuthRepository(this._client);

  static Future<void>? _initialization;

  final SupabaseClient _client;

  static Future<void> initialize() =>
      _initialization ??= _initialize();

  static Future<void> _initialize() async {
    const url = String.fromEnvironment('SUPABASE_URL');
    const publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
    if (url.isEmpty || publishableKey.isEmpty) {
      throw StateError(
        'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be provided at build time.',
      );
    }
    try {
      await Supabase.initialize(url: url, anonKey: publishableKey);
    } catch (_) {
      _initialization = null;
      rethrow;
    }
  }

  static CloudyAuthRepository fromInitializedClient() =>
      CloudyAuthRepository(Supabase.instance.client);

  Stream<AuthState> get authChanges => _client.auth.onAuthStateChange;

  String? get currentAccessToken => _client.auth.currentSession?.accessToken;

  CloudyAuthUser? get currentUser {
    final user = _client.auth.currentUser;
    return user == null ? null : CloudyAuthUser.fromSupabase(user);
  }

  Future<CloudyAuthResult> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );
    final user = response.user;
    final session = response.session;
    if (user == null || session == null) {
      throw const CloudyAuthException('Не удалось загрузить аккаунт.');
    }

    if (CloudyAuthPolicy.isUnderMinimumAge(user.userMetadata?['age'])) {
      await _client.auth.signOut();
      throw const CloudyAuthException(
        'Регистрация в Cloudy English Academy доступна с 13 лет. Если возраст указан неверно, обратитесь в поддержку.',
      );
    }

    return CloudyAuthResult(
      user: CloudyAuthUser.fromSupabase(user),
      accessToken: session.accessToken,
    );
  }

  Future<CloudyAuthResult> signUp({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signUp(
      email: email.trim().toLowerCase(),
      password: password,
      data: const <String, dynamic>{},
    );
    final user = response.user;
    final session = response.session;
    if (session == null || user == null) {
      return const CloudyAuthResult(
        user: null,
        accessToken: null,
        needsConfirmation: true,
      );
    }
    return CloudyAuthResult(
      user: CloudyAuthUser.fromSupabase(user),
      accessToken: session.accessToken,
    );
  }

  Future<CloudyAuthUser> updateProfile({
    String? name,
    int? age,
  }) async {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw const CloudyAuthException('Сначала войдите в аккаунт.');
    }
    final metadata = CloudyAuthPolicy.profileUpdateData(
      Map<String, dynamic>.from(user.userMetadata ?? const {}),
      name: name,
      age: age,
    );
    final response = await _client.auth.updateUser(
      UserAttributes(data: metadata),
    );
    final updated = response.user;
    if (updated == null) {
      throw const CloudyAuthException('Не удалось обновить профиль.');
    }
    return CloudyAuthUser.fromSupabase(updated);
  }

  Future<void> resetPassword(String email, {String? redirectTo}) async {
    final normalized = email.trim().toLowerCase();
    if (normalized.isEmpty) {
      throw const CloudyAuthException('Укажите адрес электронной почты.');
    }
    await _client.auth.resetPasswordForEmail(
      normalized,
      redirectTo: redirectTo,
    );
  }

  Future<void> signOut() => _client.auth.signOut();
}
