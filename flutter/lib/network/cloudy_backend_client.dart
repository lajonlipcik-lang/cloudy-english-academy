import 'dart:convert';

import 'package:http/http.dart' as http;

class CloudyBackendException implements Exception {
  const CloudyBackendException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

/// Calls the authenticated Cloudy server bridge. The Supabase service-role key
/// never leaves the server; the mobile client sends only the user's access token.
class CloudyBackendClient {
  CloudyBackendClient({
    required this.baseUrl,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  static String configuredBaseUrl() {
    const value = String.fromEnvironment('CLOUDY_API_BASE_URL');
    if (value.isEmpty) {
      throw StateError(
        'Не задан CLOUDY_API_BASE_URL. Укажите адрес сервера Cloudy при сборке Flutter.',
      );
    }
    return value;
  }

  Future<Map<String, dynamic>> call({
    required String action,
    required String accessToken,
    Map<String, Object?> payload = const {},
  }) async {
    if (accessToken.isEmpty) {
      throw const CloudyBackendException('Сначала войдите в аккаунт.', statusCode: 401);
    }
    final uri = Uri.parse(baseUrl).resolve('/api/cloudy/mobile');
    late final http.Response response;
    try {
      response = await _client.post(
        uri,
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer $accessToken',
          'accept': 'application/json',
        },
        body: jsonEncode({'action': action, 'payload': payload}),
      );
    } catch (_) {
      throw const CloudyBackendException('Не удалось подключиться к Cloudy. Проверьте интернет.');
    }

    Map<String, dynamic> decoded;
    try {
      final raw = jsonDecode(response.body);
      if (raw is! Map) throw const FormatException();
      decoded = raw.map((key, value) => MapEntry(key.toString(), value));
    } catch (_) {
      throw CloudyBackendException(
        'Сервер Cloudy вернул некорректный ответ.',
        statusCode: response.statusCode,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300 || decoded['ok'] != true) {
      throw CloudyBackendException(
        decoded['error']?.toString() ?? 'Не удалось выполнить действие.',
        statusCode: response.statusCode,
      );
    }
    final result = decoded['result'];
    if (result is Map) {
      return result.map((key, value) => MapEntry(key.toString(), value));
    }
    return {'value': result};
  }

  Future<Map<String, dynamic>> saveProgress({
    required String accessToken,
    required Map<String, Object?> state,
    String? expectedUpdatedAt,
  }) => call(
    action: 'progress-save',
    accessToken: accessToken,
    payload: {
      'state': state,
      'expectedUpdatedAt': expectedUpdatedAt,
    },
  );

  Future<Map<String, dynamic>> awardLesson({
    required String accessToken,
    required int lessonIndex,
    required String level,
  }) => call(
    action: 'lesson-complete',
    accessToken: accessToken,
    payload: {'lessonIndex': lessonIndex, 'level': level},
  );

  Future<Map<String, dynamic>> syncLearningEvents({
    required String accessToken,
    required List<Map<String, Object?>> events,
  }) => call(
    action: 'learning-events',
    accessToken: accessToken,
    payload: {'events': events},
  );

  void close() => _client.close();
}
