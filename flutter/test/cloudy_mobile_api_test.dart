import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cloudy_english/data/cloudy_mobile_api.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';

void main() {
  group('Cloudy mobile API client', () {
    test('normalizes the base URL and endpoint path', () {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example/',
        accessToken: () async => 'token',
      );
      expect(api.endpointForTesting, 'https://cloudy.example/api/cloudy/mobile');
      api.close();
    });

    test('sends the existing mobile API action and payload envelope', () async {
      late http.Request captured;
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => 'access-token',
        client: MockClient((request) async {
          captured = request;
          return http.Response(
            jsonEncode({'ok': true, 'result': {'acceptedEventIds': ['a', 'b']}}),
            200,
          );
        }),
      );

      final accepted = await api.syncLearningEvents([
        {'eventId': 'a'},
        {'eventId': 'b'},
      ]);

      expect(accepted, ['a', 'b']);
      expect(captured.headers['authorization'], 'Bearer access-token');
      expect(jsonDecode(captured.body), {
        'action': 'learning-events',
        'payload': {
          'events': [
            {'eventId': 'a'},
            {'eventId': 'b'},
          ],
        },
      });
      api.close();
    });

    test('loads the current remote progress response shape', () async {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => 'access-token',
        client: MockClient((_) async => http.Response(
          jsonEncode({
            'ok': true,
            'result': {
              'progress': {
                'state': {'xp': 75, 'lv': 'A1', 'dn': {'A1': 2}},
                'updated_at': '2026-11-09T10:00:00.000Z',
              },
              'learnerProfile': {
                'english_level': 'A1',
                'placement_test_completed': true,
              },
            },
          }),
          200,
        )),
      );

      final loaded = await api.loadProgress();
      expect(loaded.hasProgressRow, isTrue);
      expect(loaded.state.xp, 75);
      expect(loaded.state.level?.code, 'A1');
      expect(loaded.updatedAt, '2026-11-09T10:00:00.000Z');
      expect(loaded.learnerProfile?['placement_test_completed'], isTrue);
      api.close();
    });

    test('loads server-authoritative active subscription and entitlements', () async {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => 'access-token',
        client: MockClient((request) async {
          expect(jsonDecode(request.body), {
            'action': 'subscription-status',
            'payload': {},
          });
          return http.Response(
            jsonEncode({
              'ok': true,
              'result': {
                'hasAccess': true,
                'status': 'active',
                'subscription': {
                  'id': 'sub-1',
                  'currentPeriodEnd': '2026-12-10T00:00:00.000Z',
                  'cancelAtPeriodEnd': false,
                },
                'plan': {
                  'code': 'premium_monthly',
                  'name': 'Премиум',
                  'entitlements': {'ai_tutor': true},
                },
                'entitlements': [
                  {'feature_key': 'ai_tutor', 'enabled': true, 'usage_limit': 100},
                ],
              },
            }),
            200,
          );
        }),
      );

      final access = await api.loadSubscriptionAccess();
      expect(access.hasAccess, isTrue);
      expect(access.status, 'active');
      expect(access.planCode, 'premium_monthly');
      expect(access.planName, 'Премиум');
      expect(access.planEntitlements['ai_tutor'], isTrue);
      expect(access.featureEntitlements.single['feature_key'], 'ai_tutor');
      api.close();
    });

    test('represents users without a subscription as inactive', () async {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => 'access-token',
        client: MockClient((_) async => http.Response(
          jsonEncode({
            'ok': true,
            'result': {
              'hasAccess': false,
              'status': 'inactive',
              'subscription': null,
              'plan': null,
              'entitlements': [],
            },
          }),
          200,
        )),
      );

      final access = await api.loadSubscriptionAccess();
      expect(access.hasAccess, isFalse);
      expect(access.status, 'inactive');
      expect(access.planCode, isNull);
      api.close();
    });

    test('rejects oversized learning event batches before sending', () async {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => 'token',
      );
      expect(
        () => api.syncLearningEvents(
          List.generate(51, (index) => {'eventId': '$index'}),
        ),
        throwsA(isA<CloudyMobileApiException>()),
      );
      api.close();
    });

    test('requires an authenticated access token', () async {
      final api = CloudyMobileApi(
        baseUrl: 'https://cloudy.example',
        accessToken: () async => null,
        client: MockClient((_) async => http.Response('{}', 200)),
      );
      expect(
        () => api.loadProgress(),
        throwsA(isA<CloudyMobileApiException>()),
      );
      api.close();
    });
  });
}
