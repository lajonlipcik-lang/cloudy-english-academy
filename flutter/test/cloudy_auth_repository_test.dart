import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/data/cloudy_auth_repository.dart';

void main() {
  group('CloudyAuthPolicy', () {
    test('parses valid ages and rejects underage metadata', () {
      expect(CloudyAuthPolicy.ageFromMetadata('18'), 18);
      expect(CloudyAuthPolicy.ageFromMetadata(18), 18);
      expect(CloudyAuthPolicy.ageFromMetadata('12'), isNull);
      expect(CloudyAuthPolicy.isUnderMinimumAge('12'), isTrue);
      expect(CloudyAuthPolicy.isUnderMinimumAge(' 12 '), isTrue);
      expect(CloudyAuthPolicy.isUnderMinimumAge(13), isFalse);
    });

    test('keeps an existing age when only the name is updated', () {
      final updated = CloudyAuthPolicy.profileUpdateData(
        {'name': 'Старое имя', 'age': 18, 'other': 'preserved'},
        name: 'Новое имя',
        age: 20,
      );

      expect(updated['name'], 'Новое имя');
      expect(updated['age'], 18);
      expect(updated['other'], 'preserved');
    });

    test('does not allow changing a stored age without support', () {
      expect(
        () => CloudyAuthPolicy.profileUpdateData(
          {'name': 'Ученик', 'age': 18},
          age: 19,
        ),
        throwsA(isA<CloudyAuthException>()),
      );
    });

    test('allows first-time age setup after registration', () {
      final updated = CloudyAuthPolicy.profileUpdateData(
        {'name': 'Ученик'},
        age: 16,
      );

      expect(updated['age'], 16);
      expect(updated['name'], 'Ученик');
    });

    test('rejects invalid ages and empty profile updates', () {
      expect(
        () => CloudyAuthPolicy.profileUpdateData({}, age: 12),
        throwsA(isA<CloudyAuthException>()),
      );
      expect(
        () => CloudyAuthPolicy.profileUpdateData({'name': 'Ученик', 'age': 18}),
        throwsA(isA<CloudyAuthException>()),
      );
    });
  });
}
