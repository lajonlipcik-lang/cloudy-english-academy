class CloudyProfileValidationException implements Exception {
  const CloudyProfileValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}

class CloudyProfileUpdate {
  const CloudyProfileUpdate({required this.metadata, this.displayName});
  final Map<String, Object?> metadata;
  final String? displayName;
}

class CloudyProfilePolicy {
  const CloudyProfilePolicy._();

  static int? validAge(Object? value) {
    final number = value is num ? value : num.tryParse(value?.toString() ?? '');
    if (number == null || !number.isFinite || number % 1 != 0) return null;
    final age = number.toInt();
    return age >= 13 && age <= 120 ? age : null;
  }

  static bool isUnderMinimumAge(Object? value) {
    final number = value is num ? value : num.tryParse(value?.toString() ?? '');
    return number != null && number.isFinite && number % 1 == 0 && number < 13;
  }

  static CloudyProfileUpdate buildUpdate({
    required Map<String, Object?> currentMetadata,
    String? name,
    Object? age,
  }) {
    final hasAgeUpdate = age != null;
    final parsedAge = age is num ? age : num.tryParse(age?.toString() ?? '');
    if (hasAgeUpdate &&
        (parsedAge == null || !parsedAge.isFinite || parsedAge % 1 != 0 ||
            parsedAge < 13 || parsedAge > 120)) {
      throw const CloudyProfileValidationException(
        'Возраст должен быть указан в полных годах и составлять не менее 13 лет.',
      );
    }

    final currentAge = validAge(currentMetadata['age']);
    final newName = name != null && name.trim().isNotEmpty
        ? name.trim().substring(0, name.trim().length > 40 ? 40 : name.trim().length)
        : null;

    if (hasAgeUpdate && currentAge != null && currentAge != parsedAge && newName == null) {
      throw const CloudyProfileValidationException(
        'Изменение возраста доступно только через поддержку @cloudysupportt_bot.',
      );
    }

    final validAgeUpdate = hasAgeUpdate && currentAge == null ? parsedAge!.toInt() : null;
    if (validAgeUpdate == null && newName == null) {
      throw const CloudyProfileValidationException('Укажите корректное имя или возраст.');
    }

    final updated = Map<String, Object?>.from(currentMetadata);
    if (currentAge != null) {
      updated['age'] = currentAge;
    } else if (validAgeUpdate != null) {
      updated['age'] = validAgeUpdate;
    }
    if (newName != null) updated['name'] = newName;

    return CloudyProfileUpdate(metadata: updated, displayName: newName);
  }
}
