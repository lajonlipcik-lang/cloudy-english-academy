import 'dart:convert';

import 'package:http/http.dart' as http;

import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';

class CloudySubscriptionAccess {
  const CloudySubscriptionAccess({
    required this.hasAccess,
    required this.status,
    this.planCode,
    this.planName,
    this.currentPeriodEnd,
    this.cancelAtPeriodEnd = false,
    this.planEntitlements = const {},
    this.featureEntitlements = const [],
  });

  final bool hasAccess;
  final String status;
  final String? planCode;
  final String? planName;
  final String? currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final Map<String, Object?> planEntitlements;
  final List<Map<String, Object?>> featureEntitlements;

  factory CloudySubscriptionAccess.fromJson(Map<String, Object?> json) {
    final subscription = json['subscription'] is Map
        ? (json['subscription'] as Map).map((key, value) => MapEntry(key.toString(), value))
        : const <String, Object?>{};
    final plan = json['plan'] is Map
        ? (json['plan'] as Map).map((key, value) => MapEntry(key.toString(), value))
        : const <String, Object?>{};
    final rawPlanEntitlements = plan['entitlements'];
    final rawFeatureEntitlements = json['entitlements'];
    return CloudySubscriptionAccess(
      hasAccess: json['hasAccess'] == true,
      status: json['status'] is String ? json['status'] as String : 'inactive',
      planCode: plan['code'] is String ? plan['code'] as String : null,
      planName: plan['name'] is String ? plan['name'] as String : null,
      currentPeriodEnd: subscription['currentPeriodEnd'] is String
          ? subscription['currentPeriodEnd'] as String
          : null,
      cancelAtPeriodEnd: subscription['cancelAtPeriodEnd'] == true,
      planEntitlements: rawPlanEntitlements is Map
          ? rawPlanEntitlements.map((key, value) => MapEntry(key.toString(), value))
          : const {},
      featureEntitlements: rawFeatureEntitlements is List
          ? rawFeatureEntitlements
              .whereType<Map>()
              .map((row) => row.map((key, value) => MapEntry(key.toString(), value)))
              .toList(growable: false)
          : const [],
    );
  }

  bool canUseFeature(String featureKey) {
    if (!hasAccess) return false;
    for (final entitlement in featureEntitlements) {
      if (entitlement['feature_key'] == featureKey) {
        return entitlement['enabled'] == true;
      }
    }
    final planValue = planEntitlements[featureKey];
    if (planValue is bool) return planValue;
    if (planValue is Map) return planValue['enabled'] == true;
    return false;
  }

  factory CloudySubscriptionAccess.inactive() =>
      const CloudySubscriptionAccess(hasAccess: false, status: 'inactive');
}

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
    required this.hasProgressRow,
    required this.updatedAt,
    required this.learnerProfile,
  });
  final CloudyState state;
  final bool hasProgressRow;
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
      hasProgressRow: progress != null,
      updatedAt: progress?['updated_at'] is String
          ? progress!['updated_at'] as String
          : null,
      learnerProfile: profile is Map
          ? profile.map((key, value) => MapEntry(key.toString(), value))
          : null,
    );
  }

  Future<CloudySubscriptionAccess> loadSubscriptionAccess() async {
    final result = await _post('subscription-status', const {});
    return CloudySubscriptionAccess.fromJson(result);
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

  Future<List<String>> syncLearningEvents(List<Map<String, Object?>> events) async {
    if (events.isEmpty) return const [];
    if (events.length > 50) {
      throw const CloudyMobileApiException('Слишком много событий в одном запросе.');
    }
    final result = await _post('learning-events', {'events': events});
    final acceptedIds = result['acceptedEventIds'];
    if (acceptedIds is List) return acceptedIds.whereType<String>().toList(growable: false);
    return const [];
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
