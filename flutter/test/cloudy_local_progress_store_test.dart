import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';
import 'package:cloudy_english/progress/cloudy_local_progress_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy local progress compatibility', () {
    late CloudyLocalProgressStore store;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      store = await CloudyLocalProgressStore.create();
    });

    test('uses the same guest and account storage keys as the current app', () async {
      final state = CloudyState.defaults().copyWith(xp: 42);
      await store.saveGuest(state);
      expect(store.loadGuest().xp, 42);
      await store.activateAccount('Learner@Example.com');
      await store.saveActive(state.copyWith(xp: 99));
      expect(store.loadAccount('learner@example.com').xp, 99);
      expect(store.loadGuest().xp, 42);
      expect(store.activeAccountEmail, 'learner@example.com');
    });

    test('keeps guest progress separate when switching back to guest mode', () async {
      await store.saveGuest(CloudyState.defaults().copyWith(xp: 17));
      await store.activateAccount('learner@example.com');
      await store.saveActive(CloudyState.defaults().copyWith(xp: 80));
      await store.enterGuestMode();
      expect(store.loadActive().xp, 17);
    });

    test('prefers a newer clean remote snapshot', () async {
      await store.saveAccount('learner@example.com', CloudyState.defaults().copyWith(xp: 40));
      await store.markSynced('learner@example.com', now: DateTime(2026, 11, 8), noPendingChanges: true);
      final activation = store.activateCloudAccount(
        email: 'learner@example.com',
        remoteState: CloudyState.defaults().copyWith(xp: 90).toJson(),
        remoteUpdatedAt: '2026-11-09T12:00:00Z',
        progressLoadFailed: false,
      );
      expect(activation.state.xp, 90);
      expect(activation.shouldSync, false);
    });

    test('preserves local unsynced progress when the server snapshot is older', () async {
      await store.saveAccount('learner@example.com', CloudyState.defaults().copyWith(xp: 80));
      await store.markDirty('learner@example.com', now: DateTime(2026, 11, 9, 12));
      final activation = store.activateCloudAccount(
        email: 'learner@example.com',
        remoteState: CloudyState.defaults().copyWith(xp: 40).toJson(),
        remoteUpdatedAt: '2026-11-09T11:00:00Z',
        progressLoadFailed: false,
      );
      expect(activation.state.xp, 80);
      expect(activation.shouldSync, true);
    });

    test('pauses sync and retains local data when cloud loading fails', () async {
      await store.saveAccount('learner@example.com', CloudyState.defaults().copyWith(xp: 55));
      final activation = store.activateCloudAccount(
        email: 'learner@example.com',
        remoteState: null,
        remoteUpdatedAt: null,
        progressLoadFailed: true,
      );
      expect(activation.state.xp, 55);
      expect(activation.syncPaused, true);
      expect(activation.shouldSync, false);
    });
    test('sanitizes local progress before persisting the cl2 snapshot', () async {
      final unsafe = CloudyState.fromJson({
        'xp': 40,
        'streak': 9000,
        'dn': {'A1': 999, 'A2': 999, 'B1': 99, 'B2': 99},
        'acc': [9999999, 9999999],
      });

      await store.saveGuest(unsafe);
      final restored = store.loadGuest();
      expect(restored.xp, 40);
      expect(restored.streak, 3650);
      expect(restored.completed, {'A1': 24, 'A2': 24, 'B1': 6, 'B2': 6});
      expect(restored.accuracy, [1000000, 1000000]);
    });

  });
}
