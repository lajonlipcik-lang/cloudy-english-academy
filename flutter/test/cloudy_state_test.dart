import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';

void main() {
  group('CloudyState compatibility', () {
    test('matches the current web app default progress contract', () {
      final state = CloudyState.defaults();
      expect(state.toJson(), {
        'xp': 0, 'streak': 0, 'last': '', 'lv': '',
        'dn': {'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0},
        'acc': [0, 0], 'mis': <String, num>{}, 'days': <String>[], 'ach': <String>[],
        'wk': {'k': '', 'xp': 0}, 'perf': 0, 'tested': 0,
        'set': {'snd': 1, 'vol': 0.7, 'voice': 1, 'goal': 30, 'mic': 1, 'th': 'dark', 'rem': 0, 'remT': '19:00'},
        'td': {'d': '', 'xp': 0, 'les': 0, 'ok': 0, 'claim': 0},
      });
    });

    test('round-trips progress, mistakes, achievements and settings', () {
      final original = CloudyState.fromJson({
        'xp': 845, 'streak': 12, 'last': 'Mon Nov 09 2026', 'lv': 'A2',
        'dn': {'A1': 24, 'A2': 7, 'B1': 0, 'B2': 0}, 'acc': [81, 96],
        'mis': {'son': 2, 'daughter': 1}, 'days': ['2026-11-08', '2026-11-09'],
        'ach': ['first', 's7'], 'wk': {'k': '2026w45', 'xp': 120},
        'perf': 3, 'tested': 1,
        'set': {'snd': 0, 'vol': 0.4, 'voice': 0, 'goal': 45, 'mic': 1, 'th': 'light', 'rem': 1, 'remT': '20:30'},
        'td': {'d': 'Mon Nov 09 2026', 'xp': 35, 'les': 2, 'ok': 14, 'claim': 1},
      });
      final restored = CloudyState.fromJson(original.toJson());
      expect(restored.toJson(), original.toJson());
      expect(restored.level, CloudyLevel.a2);
      expect(restored.completed['A1'], 24);
      expect(restored.settings.vol, 0.4);
      expect(restored.today.claim, 1);
    });

    test('normalizes malformed and partial saves safely', () {
      final state = CloudyState.fromJson({
        'xp': 'broken', 'streak': 4, 'acc': [3],
        'mis': {'hello': 2, 'bad': -1, 'wrong': '2'}, 'set': {'th': 'unexpected'},
      });
      expect(state.xp, 0);
      expect(state.streak, 4);
      expect(state.accuracy, [0, 0]);
      expect(state.mistakes, {'hello': 2});
      expect(state.settings.th, 'dark');
    });

    test('migrates the old completed lesson counter', () {
      final state = CloudyState.fromJson({'done': 6, 'xp': 100});
      expect(state.level, CloudyLevel.a1);
      expect(state.completed['A1'], 6);
    });

    test('does not invent progress for empty or invalid data', () {
      expect(CloudyState.fromJson(null).hasProgress, isFalse);
      expect(CloudyState.fromJson({'lv': 'C9', 'dn': {}}).level, isNull);
    });
  });
}
