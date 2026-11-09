import 'package:supabase_flutter/supabase_flutter.dart';

import 'cloudy_profile_policy.dart';

class CloudyAuthUser {
  const CloudyAuthUser({
    required this.id, required this.email, required this.name,
    required this.age, required this.isAdmin,
  });
  final String id, email, name;
  final int? age;
  final bool isAdmin;

  factory CloudyAuthUser.fromSupabase(User user) {
    final metadata = user.userMetadata ?? const <String, dynamic>{};
    return CloudyAuthUser(
      id: user.id,
      email: user.email ?? '',
      name: (metadata['name'] ?? metadata['display_name'] ?? '').toString(),
      age: CloudyProfilePolicy.validAge(metadata['age']),
      isAdmin: user.appMetadata['role'] == 'admin',
    );
  }
}

class CloudySignUpResult {
  const CloudySignUpResult({required this.needsConfirmation, this.user});
  final bool needsConfirmation;
  final CloudyAuthUser? user;
}

class CloudySessionSnapshot {
  const CloudySessionSnapshot({
    required this.user, this.progress, this.progressUpdatedAt,
    this.englishLevel, this.placementTestCompleted = false,
    this.progressLoadFailed = false,
  });
  final CloudyAuthUser? user;
  final Map<String, dynamic>? progress;
  final String? progressUpdatedAt;
  final String? englishLevel;
  final bool placementTestCompleted;
  final bool progressLoadFailed;
}

class CloudyAuthRepository {
  CloudyAuthRepository(this._client);

  static bool _initialized = false;
  final SupabaseClient _client;

  Stream<AuthState> get authChanges => _client.auth.onAuthStateChange;
  String? get currentAccessToken => _client.auth.currentSession?.accessToken;

  CloudyAuthUser? get currentUser {
    final user = _client.auth.currentUser;
    return user == null ? null : CloudyAuthUser.fromSupabase(user);
  }

  static Future<void> initialize() async {
    if (_initialized) return;
    const url = String.fromEnvironment('SUPABASE_URL');
    const publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
    if (url.isEmpty || publishableKey.isEmpty) {
      throw StateError(
        'Не заданы SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY. '
        'Передайте их через --dart-define при сборке Flutter.',
      );
    }
    await Supabase.initialize(url: url, anonKey: publishableKey);
    _initialized = true;
  }

  factory CloudyAuthRepository.configured() =>
      CloudyAuthRepository(Supabase.instance.client);

  Future<CloudySignUpResult> signUp(String email, String password) async {
    final response = await _client.auth.signUp(
      email: email.trim().toLowerCase(),
      password: password,
      data: <String, dynamic>{},
    );
    final user = response.user;
    final session = response.session;
    if (user == null || session == null) {
      return const CloudySignUpResult(needsConfirmation: true);
    }
    return CloudySignUpResult(
      needsConfirmation: false,
      user: CloudyAuthUser.fromSupabase(user),
    );
  }

  Future<CloudySessionSnapshot> signIn(String email, String password) async {
    final response = await _client.auth.signInWithPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );
    final user = response.user;
    final session = response.session;
    if (user == null || session == null) {
      throw AuthException('Не удалось загрузить аккаунт.');
    }

    if (CloudyProfilePolicy.isUnderMinimumAge(user.userMetadata?['age'])) {
      await _client.auth.signOut();
      throw const AuthException(
        'Регистрация в Cloudy English Academy доступна с 13 лет. '
        'Если возраст указан неверно, обратитесь в поддержку.',
      );
    }
    return loadSession();
  }

  Future<CloudyAuthUser> updateProfile({String? name, Object? age}) async {
    final user = _client.auth.currentUser;
    if (user == null) throw const AuthException('Сначала войдите в аккаунт.');

    final update = CloudyProfilePolicy.buildUpdate(
      currentMetadata: Map<String, Object?>.from(user.userMetadata ?? const {}),
      name: name,
      age: age,
    );
    final response = await _client.auth.updateUser(
      UserAttributes(data: <String, dynamic>{...update.metadata}),
    );
    final updatedUser = response.user;
    if (updatedUser == null) {
      throw const AuthException('Не удалось обновить профиль.');
    }

    if (update.displayName != null) {
      await _client.from('profiles').update({
        'display_name': update.displayName,
      }).eq('id', updatedUser.id);
    }
    return CloudyAuthUser.fromSupabase(updatedUser);
  }

  Future<void> signOut() => _client.auth.signOut();

  Future<CloudySessionSnapshot> loadSession() async {
    final user = _client.auth.currentUser;
    if (user == null) return const CloudySessionSnapshot(user: null);

    Map<String, dynamic>? progress;
    String? progressUpdatedAt;
    String? englishLevel;
    var placementTestCompleted = false;
    var failed = false;

    try {
      final saved = await _client
          .from('user_progress')
          .select('state, updated_at')
          .eq('user_id', user.id)
          .maybeSingle();
      if (saved != null) {
        final rawState = saved['state'];
        if (rawState is Map) {
          progress = rawState.map((key, value) => MapEntry(key.toString(), value));
        }
        progressUpdatedAt = saved['updated_at']?.toString();
      }
    } catch (_) {
      failed = true;
    }

    try {
      final profile = await _client
          .from('profiles')
          .select('english_level, placement_test_completed')
          .eq('id', user.id)
          .maybeSingle();
      englishLevel = profile?['english_level']?.toString();
      placementTestCompleted = profile?['placement_test_completed'] == true;
    } catch (_) {
      failed = true;
    }

    return CloudySessionSnapshot(
      user: CloudyAuthUser.fromSupabase(user),
      progress: progress,
      progressUpdatedAt: progressUpdatedAt,
      englishLevel: englishLevel,
      placementTestCompleted: placementTestCompleted,
      progressLoadFailed: failed,
    );
  }
}
