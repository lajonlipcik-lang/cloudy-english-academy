import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cloudy_english/network/cloudy_backend_client.dart';

void main() {
  group('Cloudy mobile backend client', () {
    test('sends the access token and exact progress payload to the mobile route', () async {
      http.Request? captured;
      final client = CloudyBackendClient(
        baseUrl: 'https://cloudy.example',
        client: MockClient((request) async {
          captured = request;
          return http.Response(
            jsonEncode({'ok': true, 'result': {'ok': true, 'conflict': false, 'updated_at': '2026-11-09T12:00:00Z'}}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final result = await client.saveProgress(
        accessToken: 'header.payload.signature',
        state: const {'xp': 10, 'lv': 'A1'},
        expectedUpdatedAt: '2026-11-09T11:00:00Z',
      );

      expect(captured?.url.path, '/api/cloudy/mobile');
      expect(captured?.headers['authorization'], 'Bearer header.payload.signature');
      expect(jsonDecode(captured!.body), {
        'action': 'progress-save',
        'payload': {
          'state': {'xp': 10, 'lv': 'A1'},
          'expectedUpdatedAt': '2026-11-09T11:00:00Z',
        },
      });
      expect(result['conflict'], false);
    });

    test('returns the server conflict snapshot without hiding it', () async {
      final client = CloudyBackendClient(
        baseUrl: 'https://cloudy.example',
        client: MockClient((_) async => http.Response(
          jsonEncode({'ok': true, 'result': {'ok': false, 'conflict': true, 'state': {'xp': 25}}}),
          200,
        )),
      );
      final result = await client.saveProgress(
        accessToken: 'header.payload.signature',
        state: const {'xp': 10},
      );
      expect(result['conflict'], true);
      expect(result['state'], {'xp': 25});
    });

    test('preserves safe server errors and status codes', () async {
      final client = CloudyBackendClient(
        baseUrl: 'https://cloudy.example',
        client: MockClient((_) async => http.Response.bytes(
          utf8.encode(jsonEncode({'ok': false, 'error': 'Сначала войдите в аккаунт.'})),
          401,
          headers: {'content-type': 'application/json; charset=utf-8'},
        )),
      );
      await expectLater(
        client.awardLesson(accessToken: 'header.payload.signature', lessonIndex: 0, level: 'A1'),
        throwsA(isA<CloudyBackendException>().having((e) => e.statusCode, 'statusCode', 401)),
      );
    });
  });
}
