import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_state.dart';
import '../network/cloudy_backend_client.dart';

class CloudyProgressSaveResult {
  const CloudyProgressSaveResult({
    required this.ok, required this.conflict, required this.state,
    required this.updatedAt,
  });
  final bool ok, conflict;
  final CloudyState state;
  final String? updatedAt;
}

class CloudyLessonAward {
  static int _int(Object? value) => value is num ? value.toInt() : 0;
  const CloudyLessonAward({
    required this.awarded, required this.totalXp, required this.weekKey,
    required this.weekXp, required this.dailyLessons, required this.updatedAt,
  });
  final int awarded, totalXp, weekXp, dailyLessons;
  final String weekKey;
  final String? updatedAt;

  factory CloudyLessonAward.fromJson(Map<String, dynamic> json) => CloudyLessonAward(
    awarded: _int(json['awarded']),
    totalXp: _int(json['total_xp']),
    weekKey: json['week_key']?.toString() ?? '',
    weekXp: _int(json['week_xp']),
    dailyLessons: _int(json['daily_lessons']),
    updatedAt: json['updated_at']?.toString(),
  );
}

class CloudyProgressRepository {
  const CloudyProgressRepository(this._backend);
  final CloudyBackendClient _backend;

  Future<CloudyProgressSaveResult> save({
    required String accessToken,
    required CloudyState state,
    String? expectedUpdatedAt,
  }) async {
    final result = await _backend.saveProgress(
      accessToken: accessToken,
      state: state.toJson(),
      expectedUpdatedAt: expectedUpdatedAt,
    );
    final rawState = result['state'];
    final nextState = rawState is Map ? CloudyState.fromJson(rawState) : state;
    return CloudyProgressSaveResult(
      ok: result['ok'] == true,
      conflict: result['conflict'] == true,
      state: nextState,
      updatedAt: result['updated_at']?.toString(),
    );
  }

  Future<CloudyLessonAward> awardLesson({
    required String accessToken,
    required int lessonIndex,
    required String level,
  }) async {
    final result = await _backend.awardLesson(
      accessToken: accessToken,
      lessonIndex: lessonIndex,
      level: level,
    );
    return CloudyLessonAward.fromJson(result);
  }

  Future<CloudyProgressSaveResult> saveWithConflictRecovery({
    required String accessToken,
    required CloudyState localState,
    required CloudyState baseState,
    required String? expectedUpdatedAt,
    int maxAttempts = 3,
  }) async {
    var candidate = localState;
    var base = baseState;
    var version = expectedUpdatedAt;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      final result = await save(
        accessToken: accessToken,
        state: candidate,
        expectedUpdatedAt: version,
      );
      if (!result.conflict) return result;

      final merged = mergeCloudyConflictProgress(
        result.state,
        candidate,
        base,
      );
      base = result.state;
      candidate = merged;
      version = result.updatedAt;
    }
    return CloudyProgressSaveResult(
      ok: false,
      conflict: true,
      state: candidate,
      updatedAt: version,
    );
  }

}
