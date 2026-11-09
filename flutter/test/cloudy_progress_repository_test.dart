import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';
import 'package:cloudy_english/network/cloudy_backend_client.dart';
import 'package:cloudy_english/progress/cloudy_progress_repository.dart';

void main() {
  group('Cloudy progress repository', () {
    test('parses authoritative server XP and week awards', () async {
      final backend = CloudyBackendClient(
        baseUrl: 'https://cloudy.example',
        client: MockClient((_) async => http.Response(
          jsonEncode({'ok': true, 'result': {
            'awarded': 24, 'total_xp': 124, 'week_key': '2026w45',
            'week_xp': 72, 'daily_lessons': 2, 'updated_at': '2026-11-09T12:00:00Z',
          }}),
          200,
        )),
      );
      final repository = CloudyProgressRepository(backend);
      final award = await repository.awardLesson(
        accessToken: 'header.payload.signature',
        lessonIndex: 24,
        level: 'A1',
      );
      expect(award.awarded, 24);
      expect(award.totalXp, 124);
      expect(award.weekKey, '2026w45');
      expect(award.weekXp, 72);
    });

    test('returns the conflict state and server timestamp for a safe merge', () async {
      final backend = CloudyBackendClient(
        baseUrl: 'https://cloudy.example',
        client: MockClient((_) async => http.Response(
          jsonEncode({'ok': true, 'result': {
            'ok': false, 'conflict': true,
            'state': {'xp': 90, 'lv': 'A1', 'dn': {'A1': 2}},
            'updated_at': '2026-11-09T12:00:00Z',
          }}),
          200,
        )),
      );
      final repository = CloudyProgressRepository(backend);
      final result = await repository.save(
        accessToken: 'header.payload.signature',
        state: CloudyState.defaults(),
        expectedUpdatedAt: '2026-11-09T11:00:00Z',
      );
      expect(result.conflict, true);
      expect(result.state.xp, 90);
      expect(result.updatedAt, '2026-11-09T12:00:00Z');
    });
  });
}
