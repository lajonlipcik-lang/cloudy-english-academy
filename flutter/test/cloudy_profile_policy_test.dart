import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_profile_policy.dart';

void main() {
  group('Cloudy profile compatibility', () {
    test('accepts only whole-number ages from 13 through 120', () {
      expect(CloudyProfilePolicy.validAge(13), 13);
      expect(CloudyProfilePolicy.validAge('120'), 120);
      expect(CloudyProfilePolicy.validAge(12), isNull);
      expect(CloudyProfilePolicy.validAge(121), isNull);
      expect(CloudyProfilePolicy.validAge(18.5), isNull);
      expect(CloudyProfilePolicy.isUnderMinimumAge(12), isTrue);
    });

    test('preserves an already stored age when only the name changes', () {
      final update = CloudyProfilePolicy.buildUpdate(
        currentMetadata: const {'name': 'Old name', 'age': 19, 'other': 'keep'},
        name: ' New name ',
        age: 25,
      );
      expect(update.metadata, {'name': 'New name', 'age': 19, 'other': 'keep'});
      expect(update.displayName, 'New name');
    });

    test('allows the first profile completion to save name and age', () {
      final update = CloudyProfilePolicy.buildUpdate(
        currentMetadata: const {'provider': 'email'},
        name: 'Learner',
        age: 18,
      );
      expect(update.metadata, {'provider': 'email', 'age': 18, 'name': 'Learner'});
    });

    test('requires support for age-only changes after age was saved', () {
      expect(
        () => CloudyProfilePolicy.buildUpdate(
          currentMetadata: const {'age': 18},
          age: 19,
        ),
        throwsA(isA<CloudyProfileValidationException>()),
      );
    });

    test('limits the display name to forty characters', () {
      final update = CloudyProfilePolicy.buildUpdate(
        currentMetadata: const {},
        name: 'A' * 50,
      );
      expect((update.metadata['name'] as String).length, 40);
    });
  });
}
