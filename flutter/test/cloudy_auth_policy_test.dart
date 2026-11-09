import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/data/cloudy_auth_repository.dart';

void main() {
  group('Cloudy auth policy', () {
    test('accepts only valid full-year ages from 13 through 120', () {
      expect(CloudyAuthPolicy.ageFromMetadata(13), 13);
      expect(CloudyAuthPolicy.ageFromMetadata('18'), 18);
      expect(CloudyAuthPolicy.ageFromMetadata(120), 120);
      expect(CloudyAuthPolicy.ageFromMetadata(12), isNull);
      expect(CloudyAuthPolicy.ageFromMetadata(121), isNull);
      expect(CloudyAuthPolicy.ageFromMetadata(18.5), isNull);
      expect(CloudyAuthPolicy.ageFromMetadata('not a number'), isNull);
    });

    test('blocks an existing account whose stored age is below 13', () {
      expect(CloudyAuthPolicy.isUnderMinimumAge(12), isTrue);
      expect(CloudyAuthPolicy.isUnderMinimumAge('10'), isTrue);
      expect(CloudyAuthPolicy.isUnderMinimumAge(13), isFalse);
      expect(CloudyAuthPolicy.isUnderMinimumAge(null), isFalse);
    });

    test('allows a first profile save with name and age', () {
      final updated = CloudyAuthPolicy.profileUpdateData(
        {'locale': 'ru'},
        name: '  Anna  ',
        age: 18,
      );
      expect(updated, {'locale': 'ru', 'name': 'Anna', 'age': 18});
    });

    test('never changes an already stored age while saving a new name', () {
      final updated = CloudyAuthPolicy.profileUpdateData(
        {'name': 'Old name', 'age': 20, 'other': true},
        name: 'New name',
        age: 25,
      );
      expect(updated['name'], 'New name');
      expect(updated['age'], 20);
      expect(updated['other'], isTrue);
    });

    test('rejects changing age alone after it has been saved', () {
      expect(
        () => CloudyAuthPolicy.profileUpdateData({'age': 20}, age: 25),
        throwsA(isA<CloudyAuthException>()),
      );
    });

    test('limits profile names to 40 characters and rejects empty updates', () {
      final updated = CloudyAuthPolicy.profileUpdateData(
        const {},
        name: List.filled(50, 'A').join(),
      );
      expect((updated['name'] as String).length, 40);
      expect(
        () => CloudyAuthPolicy.profileUpdateData({'age': 20}),
        throwsA(isA<CloudyAuthException>()),
      );
    });

    test('rejects invalid ages before sending metadata updates', () {
      expect(
        () => CloudyAuthPolicy.profileUpdateData(const {}, age: 12),
        throwsA(isA<CloudyAuthException>()),
      );
      expect(
        () => CloudyAuthPolicy.profileUpdateData(const {}, age: 121),
        throwsA(isA<CloudyAuthException>()),
      );
    });
  });
}
