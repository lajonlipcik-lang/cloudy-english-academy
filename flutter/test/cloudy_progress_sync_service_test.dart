import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloudy_english/data/cloudy_mobile_api.dart';
import 'package:cloudy_english/domain/cloudy_exercise.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';
import 'package:cloudy_english/domain/cloudy_progress_engine.dart';
import 'package:cloudy_english/progress/cloudy_local_progress_store.dart';
import 'package:cloudy_english/services/cloudy_progress_sync_service.dart';

class _FakeCloudyApi extends CloudyMobileApi {
  _FakeCloudyApi({
    required this.remote,
    required this.saveResponses,
  }) : super(
          baseUrl: 'https://cloudy.example',
          accessToken: () async => 'test-token',
        );

  final CloudyRemoteProgress remote;
  final List<Map<String, Object?>> saveResponses;
  int saveCalls = 0;
  bool throwOnLoad = false;
  Completer<void>? firstSaveGate;
  final List<num> submittedXp = [];
  int awardCalls = 0;
  int eventSyncCalls = 0;

  @override
  Future<CloudyRemoteProgress> loadProgress() async {
    if (throwOnLoad) throw Exception('network unavailable');
    return remote;
  }

  @override
  Future<Map<String, Object?>> saveProgress(
    CloudyState state, {
    String? expectedUpdatedAt,
  }) async {
    submittedXp.add(state.xp);
    final call = saveCalls++;
    if (call == 0 && firstSaveGate != null) {
      await firstSaveGate!.future;
    }
    return saveResponses[call];
  }

  @override
  Future<Map<String, Object?>> awardLesson({
    required int lessonIndex,
    required String level,
  }) async {
    awardCalls++;
    return {
      'awarded': 24,
      'total_xp': 124,
      'week_key': '2026w45',
      'week_xp': 24,
      'updated_at': '2026-11-09T12:30:00Z',
    };
  }

  @override
  Future<List<String>> syncLearningEvents(List<Map<String, Object?>> events) async {
    eventSyncCalls++;
    return events.map((event) => event['eventId']).whereType<String>().toList();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy progress sync service', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('migrates guest progress only when no remote account progress exists', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      await local.saveGuest(CloudyState.fromJson({
        'xp': 90,
        'lv': 'A1',
        'dn': {'A1': 4},
      }));
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: CloudyState.defaults(),
          hasProgressRow: false,
          updatedAt: null,
          learnerProfile: null,
        ),
        saveResponses: [
          {'ok': true, 'state': {'xp': 90, 'lv': 'A1', 'dn': {'A1': 4}}, 'updated_at': '2026-11-09T12:00:00Z'},
        ],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);

      final result = await service.activateAccount(email: 'Learner@example.com');
      expect(result.syncPaused, isFalse);
      expect(result.uploaded, isTrue);
      expect(result.state.xp, 90);
      expect(service.activeEmail, 'learner@example.com');
      expect(api.saveCalls, 1);
    });

    test('does not overwrite an existing remote account with guest data', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      await local.saveGuest(CloudyState.fromJson({'xp': 90, 'lv': 'A1'}));
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: CloudyState.fromJson({'xp': 500, 'lv': 'A2'}),
          hasProgressRow: true,
          updatedAt: '2026-11-09T10:00:00Z',
          learnerProfile: null,
        ),
        saveResponses: const [],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);

      final result = await service.activateAccount(email: 'learner@example.com');
      expect(result.state.xp, 500);
      expect(result.uploaded, isFalse);
      expect(api.saveCalls, 0);
    });

    test('merges a stale local update against the server base and retries once', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      final base = CloudyState.fromJson({
        'xp': 100,
        'lv': 'A1',
        'dn': {'A1': 2},
        'mis': {'son': 1},
        'acc': [10, 12],
      });
      await local.saveAccount('learner@example.com', base.copyWith(
        xp: 999,
        mistakes: {'son': 2},
        accuracy: [12, 14],
        settings: const CloudySettings(vol: 0.4),
      ));
      await local.markDirty('learner@example.com', now: DateTime(2026, 11, 9, 12));

      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: base,
          hasProgressRow: true,
          updatedAt: '2026-11-09T10:00:00Z',
          learnerProfile: null,
        ),
        saveResponses: [
          {
            'ok': false,
            'conflict': true,
            'state': {
              'xp': 120,
              'lv': 'A1',
              'dn': {'A1': 3},
              'mis': {'son': 2},
              'acc': [11, 13],
            },
            'updated_at': '2026-11-09T12:01:00Z',
          },
          {
            'ok': true,
            'state': {
              'xp': 120,
              'lv': 'A1',
              'dn': {'A1': 3},
              'mis': {'son': 3},
              'acc': [13, 15],
              'set': {'vol': 0.4},
            },
            'updated_at': '2026-11-09T12:02:00Z',
          },
        ],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);
      final result = await service.activateAccount(email: 'learner@example.com');

      expect(api.saveCalls, 2);
      expect(result.uploaded, isTrue);
      expect(result.state.xp, 120);
      expect(result.state.completed['A1'], 3);
      expect(result.state.mistakes['son'], 3);
      expect(result.state.accuracy, [13, 15]);
      expect(result.state.settings.vol, 0.4);
    });

    test('serializes rapid local saves so an older response cannot overwrite newer progress', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: CloudyState.defaults(),
          hasProgressRow: true,
          updatedAt: '2026-11-09T10:00:00Z',
          learnerProfile: null,
        ),
        saveResponses: [
          {'ok': true, 'state': {'xp': 10}, 'updated_at': '2026-11-09T10:01:00Z'},
          {'ok': true, 'state': {'xp': 20}, 'updated_at': '2026-11-09T10:02:00Z'},
        ],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);
      await service.activateAccount(email: 'learner@example.com');
      api.firstSaveGate = Completer<void>();

      final first = service.saveLocal(CloudyState.defaults().copyWith(xp: 10));
      final second = service.saveLocal(CloudyState.defaults().copyWith(xp: 20));
      await Future<void>.delayed(Duration.zero);

      expect(api.submittedXp, [10]);
      api.firstSaveGate!.complete();
      final results = await Future.wait([first, second]);

      expect(results.last.state.xp, 20);
      expect(api.submittedXp, [10, 20]);
      expect(local.loadAccount('learner@example.com').xp, 20);
    });

    test('applies server-authoritative XP after a lesson and skips review awards', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      final remoteState = CloudyState.fromJson({'xp': 100, 'lv': 'A1'});
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: remoteState,
          hasProgressRow: true,
          updatedAt: '2026-11-09T10:00:00Z',
          learnerProfile: null,
        ),
        saveResponses: const [],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);
      await service.activateAccount(email: 'learner@example.com');

      final lesson = newCloudySession(0, const []).copyWith(correct: 5, total: 5);
      final awarded = await service.awardLesson(
        remoteState,
        lesson,
        now: DateTime(2026, 11, 9, 12),
      );
      expect(api.awardCalls, 1);
      expect(awarded.xp, 124);
      expect(awarded.week['xp'], 24);
      expect(awarded.today.xp, 24);
      expect(awarded.perfectLessons, 1);

      final review = newCloudySession(-1, const [], review: true);
      final unchanged = await service.awardLesson(awarded, review);
      expect(api.awardCalls, 1);
      expect(unchanged.toJson(), awarded.toJson());
    });

    test('acknowledges only server-confirmed learning events', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: CloudyState.fromJson({'xp': 100, 'lv': 'A1'}),
          hasProgressRow: true,
          updatedAt: '2026-11-09T10:00:00Z',
          learnerProfile: null,
        ),
        saveResponses: const [],
      );
      final service = CloudyProgressSyncService(localStore: local, api: api);
      await service.activateAccount(email: 'learner@example.com');
      final exercise = const CloudyChoiceExercise(
        question: 'сын',
        answer: 'son',
        english: 'son',
        speak: false,
        options: ['son', 'sun'],
        title: 'Переведите на английский',
      );
      await service.recordLearningAnswer(
        exercise,
        correct: false,
        selectedAnswer: 'sun',
        correctAnswer: 'son',
        now: DateTime(2026, 11, 9, 12),
      );
      final store = await service.learningStore;
      expect(store.pending(), hasLength(1));

      final acknowledged = await service.syncLearningEvents();
      expect(api.eventSyncCalls, 1);
      expect(acknowledged, 1);
      expect(store.pending(), isEmpty);
    });

    test('pauses sync when the initial server progress load fails', () async {
      final preferences = await SharedPreferences.getInstance();
      final local = CloudyLocalProgressStore(preferences);
      await local.saveAccount('learner@example.com', CloudyState.fromJson({'xp': 40, 'lv': 'A1'}));
      final api = _FakeCloudyApi(
        remote: CloudyRemoteProgress(
          state: CloudyState.defaults(),
          hasProgressRow: false,
          updatedAt: null,
          learnerProfile: null,
        ),
        saveResponses: const [],
      );
      api.throwOnLoad = true;
      final service = CloudyProgressSyncService(localStore: local, api: api);
      final result = await service.activateAccount(email: 'learner@example.com');
      expect(result.syncPaused, isTrue);
      expect(result.state.xp, 40);
      expect(api.saveCalls, 0);
    });
  });
}
