import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloudy_english/data/cloudy_progress_store.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cloudy progress storage', () {
    late SharedPreferences preferences;
    late CloudyProgressStore store;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      preferences = await SharedPreferences.getInstance();
      store = CloudyProgressStore(preferences);
    });

    test('uses the same guest and account-scoped keys as the web runtime', () async {
      expect(CloudyProgressStore.keyForScope(null), 'cl2');
      expect(CloudyProgressStore.keyForScope(''), 'cl2');
      expect(CloudyProgressStore.keyForScope('user-123'), 'cl2:user-123');

      await store.setCurrentScope('user-123');
      expect(store.currentScope, 'user-123');
      expect(store.currentKey, 'cl2:user-123');

      await store.setCurrentScope(null);
      expect(store.currentScope, isNull);
      expect(store.currentKey, 'cl2');
    });

    test('round-trips saved progress without changing the cl2 JSON shape', () async {
      final state = CloudyState.fromJson({
        'xp': 240,
        'streak': 4,
        'lv': 'A1',
        'dn': {'A1': 8, 'A2': 0, 'B1': 0, 'B2': 0},
        'mis': {'son': 2},
        'acc': [16, 20],
      });
      await store.saveGuest(state);

      final restored = store.loadGuest();
      expect(restored.xp, 240);
      expect(restored.streak, 4);
      expect(restored.level, CloudyLevel.a1);
      expect(restored.completed['A1'], 8);
      expect(restored.mistakes['son'], 2);

      final saved = jsonDecode(preferences.getString('cl2')!) as Map<String, dynamic>;
      expect(saved.keys, containsAll(['xp', 'streak', 'lv', 'dn', 'mis', 'acc', 'set', 'td']));
    });

    test('merges guest and account progress but retains guest data until server confirmation', () async {
      await store.saveGuest(CloudyState.fromJson({
        'xp': 50,
        'dn': {'A1': 3},
        'mis': {'son': 2},
        'days': ['2026-11-08'],
      }));
      await store.saveScope('user-123', CloudyState.fromJson({
        'xp': 100,
        'dn': {'A1': 2},
        'mis': {'cat': 1},
        'days': ['2026-11-07'],
      }));

      final merged = await store.mergeAndSaveGuestIntoScope('user-123');
      expect(merged.xp, 150);
      expect(merged.completed['A1'], 3);
      expect(merged.mistakes, {'son': 2, 'cat': 1});
      expect(merged.days, ['2026-11-07', '2026-11-08']);
      expect(store.loadGuest().xp, 50);

      expect(await store.clearGuestAfterSuccessfulSync(serverConfirmed: false), isFalse);
      expect(store.loadGuest().xp, 50);
      expect(await store.clearGuestAfterSuccessfulSync(serverConfirmed: true), isTrue);
      expect(store.loadGuest().xp, 0);
      expect(store.loadScope('user-123').xp, 150);
    });

    test('does not merge into an empty account scope', () {
      expect(() => store.mergeGuestIntoScope(''), throwsArgumentError);
    });

    test('recovers from corrupt local JSON without crashing the app', () async {
      await preferences.setString('cl2', '{invalid json');
      expect(store.loadGuest().xp, 0);
      expect(store.loadGuest().completed['A1'], 0);
    });
  });
}
