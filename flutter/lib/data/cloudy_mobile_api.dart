import 'dart:convert';

import 'package:http/http.dart' as http;

import '../domain/cloudy_logic.dart';
import '../domain/cloudy_state.dart';

class CloudyMobileApiException implements Exception {
  const CloudyMobileApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class CloudyRemoteProgress {
  const CloudyRemoteProgress({
    required this.state,
    required this.updatedAt,
    required this.learnerProfile,
  });
  final CloudyState state;
  final String? updatedAt;
  final Map<String, Object?>? learnerProfile;
}

class CloudyMobileApi {
  CloudyMobileApi({
    required String baseUrl,
    required Future<String?> Function() accessToken,
    http.Client? client,
  })  : _baseUrl = baseUrl.replaceFirst(RegExp(r'/+$'), ''),
        _accessToken = accessToken,
        _client = client ?? http.Client();

  final String _baseUrl;
  final Future<String?> Function() _accessToken;
  final http.Client _client;

  Uri get _endpoint => Uri.parse('$_baseUrl/api/cloudy/mobile');
  String get endpointForTesting => _endpoint.toString();

  Future<CloudyRemoteProgress> loadProgress() async {
    final result = await _post('progress-load', const {});
    final rawProgress = result['progress'];
    final progress = rawProgress is Map ? rawProgress : null;
    final rawState = progress?['state'];
    final profile = result['learnerProfile'];
    return CloudyRemoteProgress(
      state: CloudyState.fromJson(rawState),
      updatedAt: progress?['updated_at'] is String
          ? progress!['updated_at'] as String
          : null,
      learnerProfile: profile is Map
          ? profile.map((key, value) => MapEntry(key.toString(), value))
          : null,
    );
  }

  Future<Map<String, Object?>> saveProgress(
    CloudyState state, {
    String? expectedUpdatedAt,
  }) => _post('progress-save', {
    'state': sanitizeCloudyProgress(state).toJson(),
    'expectedUpdatedAt': expectedUpdatedAt,
  });

  Future<Map<String, Object?>> awardLesson({
    required int lessonIndex,
    required String level,
  }) => _post('lesson-complete', {
    'lessonIndex': lessonIndex,
    'level': level,
  });

  Future<int> syncLearningEvents(List<Map<String, Object?>> events) async {
    if (events.isEmpty) return 0;
    if (events.length > 50) {
      throw const CloudyMobileApiException('Слишком много событий в одном запросе.');
    }
    final result = await _post('learning-events', {'events': events});
    final synced = result['synced'];
    final accepted = result['acceptedCount'];
    if (synced is num) return synced.toInt();
    if (accepted is num) return accepted.toInt();
    return events.length;
  }

  Future<Map<String, Object?>> _post(
    String action,
    Map<String, Object?> payload,
  ) async {
    final token = await _accessToken();
    if (token == null || token.isEmpty) {
      throw const CloudyMobileApiException(
        'Сессия истекла. Войдите снова.',
        statusCode: 401,
      );
    }
    final response = await _client
        .post(
          _endpoint,
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode({'action': action, 'payload': payload}),
        )
        .timeout(const Duration(seconds: 20));

    Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      throw CloudyMobileApiException(
        'Сервер вернул некорректный ответ.',
        statusCode: response.statusCode,
      );
    }
    if (decoded is! Map) {
      throw CloudyMobileApiException(
        'Сервер вернул некорректный ответ.',
        statusCode: response.statusCode,
      );
    }
    final envelope = decoded.map((key, value) => MapEntry(key.toString(), value));
    if (response.statusCode < 200 || response.statusCode >= 300 || envelope['ok'] != true) {
      final message = envelope['error'];
      throw CloudyMobileApiException(
        message is String ? message : 'Не удалось выполнить запрос Cloudy.',
        statusCode: response.statusCode,
      );
    }
    final result = envelope['result'];
    if (result is! Map) return const {};
    return result.map((key, value) => MapEntry(key.toString(), value));
  }

  void close() => _client.close();
}
