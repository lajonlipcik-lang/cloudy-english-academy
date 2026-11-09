import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloudy_english/domain/cloudy_catalog.dart';
import 'package:cloudy_english/domain/cloudy_state.dart';
import 'package:cloudy_english/screens/cloudy_learning_home_screen.dart';

void main() {
  const catalog = CloudyCatalog(
    lessons: [
      CloudyLesson(title: 'Привет', words: [], sentences: []),
      CloudyLesson(title: 'Семья', words: [], sentences: []),
      CloudyLesson(title: 'Числа', words: [], sentences: []),
    ],
    levels: {
      'A1': [
        CloudySection(name: 'Знакомство', lessonIndices: [0, 1, 2]),
      ],
    },
    foundations: {},
  );

  testWidgets('renders Cloudy learning path and opens only the current lesson', (tester) async {
    var openedLesson = -1;
    await tester.pumpWidget(MaterialApp(
      home: CloudyLearningHomeScreen(
        catalog: catalog,
        state: CloudyState.defaults(),
        onOpenLesson: (index) => openedLesson = index,
        onOpenSettings: () {},
        onOpenProfile: () {},
        onClaimReward: () {},
      ),
    ));

    expect(find.text('Знакомство'), findsOneWidget);
    expect(find.text('Привет'), findsOneWidget);
    expect(find.text('Семья'), findsOneWidget);
    expect(find.text('НАЧАТЬ'), findsOneWidget);
    expect(find.byIcon(Icons.star_rounded), findsOneWidget);
    expect(find.byIcon(Icons.lock_rounded), findsNWidgets(2));

    await tester.tap(find.byIcon(Icons.lock_rounded).first);
    await tester.pump();
    expect(openedLesson, -1);

    await tester.tap(find.byIcon(Icons.star_rounded));
    await tester.pump();
    expect(openedLesson, 0);
  });

  testWidgets('completed lessons are marked done and next lesson becomes current', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: CloudyLearningHomeScreen(
        catalog: catalog,
        state: CloudyState.fromJson({
          'lv': 'A1',
          'dn': {'A1': 1},
        }),
        onOpenLesson: (_) {},
        onOpenSettings: () {},
        onOpenProfile: () {},
        onClaimReward: () {},
      ),
    ));

    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    expect(find.byIcon(Icons.star_rounded), findsOneWidget);
    expect(find.byIcon(Icons.lock_rounded), findsOneWidget);
  });

  testWidgets('daily reward callback is available only after the goal is reached', (tester) async {
    var claims = 0;
    await tester.pumpWidget(MaterialApp(
      home: CloudyLearningHomeScreen(
        catalog: catalog,
        state: CloudyState.fromJson({
          'lv': 'A1',
          'xp': 50,
          'set': {'goal': 30},
          'td': {'xp': 30, 'claim': 0},
        }),
        onOpenLesson: (_) {},
        onOpenSettings: () {},
        onOpenProfile: () {},
        onClaimReward: () => claims++,
      ),
    ));

    await tester.tap(find.text('🎁'));
    await tester.pump();
    expect(claims, 1);
  });
}
