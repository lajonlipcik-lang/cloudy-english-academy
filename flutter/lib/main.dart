import 'package:flutter/material.dart';

void main() => runApp(const CloudyEnglishApp());

const navy = Color(0xFF06143A);
const deepBlue = Color(0xFF0A2A73);
const sky = Color(0xFF4DB3FF);
const ice = Color(0xFFCFE9FF);

class CloudyEnglishApp extends StatelessWidget {
  const CloudyEnglishApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Cloudy English',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: navy,
      colorScheme: ColorScheme.fromSeed(seedColor: sky, brightness: Brightness.dark),
    ),
    home: const CloudyHomePage(),
  );
}

class CloudyHomePage extends StatefulWidget {
  const CloudyHomePage({super.key});

  @override
  State<CloudyHomePage> createState() => _CloudyHomePageState();
}

class _CloudyHomePageState extends State<CloudyHomePage> {
  int tab = 0;
  int completed = 0;
  int xp = 120;
  int streak = 3;

  static const labels = ['Учёба', 'Задания', 'Лига', 'Профиль'];
  static const icons = [
    Icons.school_rounded,
    Icons.flag_rounded,
    Icons.emoji_events_rounded,
    Icons.person_rounded,
  ];

  void message(String value) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(value),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF174A9B),
      ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    extendBody: true,
    body: Stack(children: [
      const _Background(),
      SafeArea(
        bottom: false,
        child: IndexedStack(index: tab, children: [
          _learning(),
          _tasks(),
          _league(),
          _profile(),
        ]),
      ),
    ]),
    bottomNavigationBar: SafeArea(
      top: false,
      child: Container(
        color: const Color(0xE606143A),
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 7),
        child: Row(children: List.generate(labels.length, (i) => Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => tab = i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              padding: const EdgeInsets.symmetric(vertical: 7),
              decoration: BoxDecoration(
                color: tab == i ? Colors.white.withOpacity(.15) : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(icons[i], color: Colors.white.withOpacity(tab == i ? 1 : .6)),
                const SizedBox(height: 3),
                Text(labels[i], style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white.withOpacity(tab == i ? 1 : .6))),
              ]),
            ),
          ),
        ))),
      ),
    ),
  );

  Widget _learning() => ListView(
    physics: const BouncingScrollPhysics(),
    padding: const EdgeInsets.fromLTRB(18, 14, 18, 120),
    children: [
      Row(children: [
        InkWell(onTap: () => setState(() => tab = 3), child: const CircleAvatar(backgroundColor: Color(0x33FFFFFF), child: Icon(Icons.person))),
        const SizedBox(width: 9),
        const _Pill(child: Text('A1', style: TextStyle(fontWeight: FontWeight.w900))),
        const Spacer(),
        _Pill(child: Text('🔥  $streak', style: const TextStyle(fontWeight: FontWeight.w800))),
        const SizedBox(width: 7),
        _Pill(child: Text('⚡  $xp', style: const TextStyle(fontWeight: FontWeight.w800))),
      ]),
      const SizedBox(height: 22),
      _DailyCard(progress: (xp % 100) / 100, onTap: () => setState(() => tab = 1)),
      const SizedBox(height: 22),
      const _SectionTitle(eyebrow: 'РАЗДЕЛ 1', title: 'Основы английского'),
      const SizedBox(height: 10),
      ...List.generate(5, (i) {
        final done = i < completed;
        final current = i == completed;
        final titles = ['Приветствие', 'Знакомство', 'Моя семья', 'Числа', 'Цвета'];
        return Transform.translate(
          offset: Offset(i.isEven ? 32 : -32, 0),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 9),
            child: Column(children: [
              if (current) Container(
                margin: const EdgeInsets.only(bottom: 7),
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                child: const Text('НАЧАТЬ', style: TextStyle(color: deepBlue, fontWeight: FontWeight.w900, fontSize: 11)),
              ),
              Material(
                color: done ? ice : current ? sky : Colors.white.withOpacity(.2),
                shape: const CircleBorder(),
                elevation: current || done ? 7 : 0,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {
                    if (i > completed) {
                      message('Сначала пройди предыдущий урок');
                    } else {
                      Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => _LessonPage(number: i + 1, onComplete: () {
                          setState(() { completed = (completed + 1).clamp(0, 5); xp += 15; });
                          Navigator.of(context).pop();
                          message('Урок завершён! +15 XP');
                        }),
                      ));
                    }
                  },
                  child: SizedBox(width: 78, height: 78, child: Icon(
                    done ? Icons.check_rounded : current ? Icons.star_rounded : Icons.lock_rounded,
                    color: done ? const Color(0xFF1F6FE0) : Colors.white,
                    size: 35,
                  )),
                ),
              ),
              const SizedBox(height: 7),
              Text(titles[i], style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
          ),
        );
      }),
      const SizedBox(height: 18),
      const _SectionTitle(eyebrow: 'ТВОЙ AI-ПОМОЩНИК', title: 'Практика с Клауди'),
      const SizedBox(height: 10),
      _GlassCard(child: Row(children: [
        const CloudyMascot(size: 62),
        const SizedBox(width: 12),
        const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Поговори с Клауди', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          Text('Практикуй английский в диалоге', style: TextStyle(color: Colors.white70, fontSize: 12)),
        ])),
        const Icon(Icons.arrow_forward_ios_rounded, size: 16),
      ]), onTap: () => message('Подключение Cloudy AI будет следующим этапом')),
    ],
  );

  Widget _tasks() => _Page(title: 'Задания дня', subtitle: 'Маленькие шаги каждый день', children: [
    _Task(icon: Icons.bolt_rounded, title: 'Набери 100 XP', detail: 'Твоя цель на сегодня', progress: (xp % 100) / 100, amount: (xp % 100).toString() + '/100 XP'),
    _Task(icon: Icons.school_rounded, title: 'Пройди 2 урока', detail: 'Закрепи новые слова', progress: (completed / 2).clamp(0, 1).toDouble(), amount: '$completed/2'),
    const _Task(icon: Icons.check_circle_rounded, title: 'Дай 12 верных ответов', detail: 'Точность приходит с практикой', progress: .5, amount: '6/12'),
    const _Info(icon: Icons.card_giftcard_rounded, title: 'Сундук дня', detail: 'Выполни дневную цель и забери награду на главном экране.'),
  ]);

  Widget _league() => const _Page(title: 'Лига', subtitle: 'Соревнуйся с другими учениками', children: [
    _Info(icon: Icons.emoji_events_rounded, title: 'Лига скоро откроется', detail: 'Здесь будут отображаться реальные участники. Мы не показываем вымышленных игроков.'),
  ]);

  Widget _profile() => _Page(title: 'Профиль', subtitle: 'Твой путь в Cloudy English', children: [
    const Center(child: CloudyMascot(size: 100)),
    const Center(child: Text('Ученик Cloudy', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
    Row(children: [
      Expanded(child: _Metric(icon: Icons.local_fire_department_rounded, value: '$streak', label: 'дней подряд')),
      const SizedBox(width: 10),
      Expanded(child: _Metric(icon: Icons.bolt_rounded, value: '$xp', label: 'XP всего')),
    ]),
    Row(children: [
      Expanded(child: _Metric(icon: Icons.check_rounded, value: '$completed', label: 'уроков')),
      const SizedBox(width: 10),
      const Expanded(child: _Metric(icon: Icons.track_changes_rounded, value: '—', label: 'точность')),
    ]),
    const _Info(icon: Icons.settings_rounded, title: 'Настройки', detail: 'Здесь будут настройки звука, озвучки, напоминаний и темы.'),
  ]);
}

class _Background extends StatelessWidget {
  const _Background();
  @override
  Widget build(BuildContext context) => const Positioned.fill(child: DecoratedBox(
    decoration: BoxDecoration(gradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color(0xFF050D2B), Color(0xFF0A2A73), Color(0xFF237FD0)],
      stops: [0, .52, 1],
    )),
    child: Stack(children: [
      _Orb(size: 310, alignment: Alignment(-1.3, -.7)),
      _Orb(size: 270, alignment: Alignment(1.3, .2)),
      _Orb(size: 360, alignment: Alignment(.1, 1.3)),
    ]),
  ));
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.alignment});
  final double size;
  final Alignment alignment;
  @override
  Widget build(BuildContext context) => Align(alignment: alignment, child: Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(
      colors: [ice.withOpacity(.2), Colors.transparent],
    )),
  ));
}

class CloudyMascot extends StatefulWidget {
  const CloudyMascot({super.key, this.size = 72});
  final double size;
  @override
  State<CloudyMascot> createState() => _CloudyMascotState();
}

class _CloudyMascotState extends State<CloudyMascot> with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);
  @override
  void dispose() { controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => Transform.translate(
      offset: Offset(0, -3.5 * controller.value),
      child: CustomPaint(size: Size.square(widget.size), painter: _CloudPainter(blink: controller.value > .93)),
    ),
  );
}

class _CloudPainter extends CustomPainter {
  const _CloudPainter({required this.blink});
  final bool blink;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100);
    final path = Path()
      ..moveTo(17, 69)..cubicTo(5, 69, 2, 57, 8, 47)
      ..cubicTo(12, 39, 20, 36, 29, 39)..cubicTo(32, 22, 45, 14, 58, 19)
      ..cubicTo(68, 22, 72, 31, 73, 39)..cubicTo(89, 34, 99, 45, 97, 58)
      ..cubicTo(96, 66, 89, 71, 79, 71)..close();
    canvas.drawPath(path.shift(const Offset(0, 4)), Paint()..color = navy.withOpacity(.25)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5));
    canvas.drawPath(path, Paint()..shader = const LinearGradient(colors: [Colors.white, ice], begin: Alignment.topCenter, end: Alignment.bottomCenter).createShader(const Rect.fromLTWH(0, 12, 100, 62)));
    final eyes = Paint()..color = const Color(0xFF174A9B)..strokeWidth = 3..strokeCap = StrokeCap.round;
    if (blink) {
      canvas.drawLine(const Offset(36, 49), const Offset(41, 49), eyes);
      canvas.drawLine(const Offset(63, 49), const Offset(68, 49), eyes);
    } else {
      canvas.drawCircle(const Offset(39, 48), 2.2, eyes);
      canvas.drawCircle(const Offset(65, 48), 2.2, eyes);
    }
    canvas.drawPath(Path()..moveTo(46, 57)..quadraticBezierTo(52, 63, 59, 57), Paint()..color = const Color(0xFF174A9B)..style = PaintingStyle.stroke..strokeWidth = 2..strokeCap = StrokeCap.round);
    final cheeks = Paint()..color = const Color(0xFFFF9FB4).withOpacity(.65);
    canvas.drawOval(const Rect.fromLTWH(25, 54, 10, 5), cheeks);
    canvas.drawOval(const Rect.fromLTWH(69, 54, 10, 5), cheeks);
    canvas.restore();
  }
  @override
  bool shouldRepaint(covariant _CloudPainter old) => old.blink != blink;
}

class _Pill extends StatelessWidget {
  const _Pill({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(color: Colors.white.withOpacity(.14), borderRadius: BorderRadius.circular(30)),
    child: child,
  );
}

class _DailyCard extends StatelessWidget {
  const _DailyCard({required this.progress, required this.onTap});
  final double progress;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(21),
      child: Ink(
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFF63C1FF), Color(0xFF2C7BEF)]),
          borderRadius: BorderRadius.circular(21),
          boxShadow: const [BoxShadow(color: Color(0x661A58B5), offset: Offset(0, 6), blurRadius: 16)],
        ),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('ТВОЯ ЦЕЛЬ НА СЕГОДНЯ', style: TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w900)),
            const SizedBox(height: 5),
            const Text('Вперёд к новым знаниям!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 11),
            ClipRRect(borderRadius: BorderRadius.circular(9), child: LinearProgressIndicator(value: progress, minHeight: 7, backgroundColor: Colors.white30, color: Colors.white)),
          ])),
          const SizedBox(width: 12),
          const Icon(Icons.rocket_launch_rounded, size: 42),
        ]),
      ),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.eyebrow, required this.title});
  final String eyebrow;
  final String title;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(eyebrow, style: TextStyle(fontSize: 10, letterSpacing: 1.2, fontWeight: FontWeight.w900, color: ice.withOpacity(.75))),
    const SizedBox(height: 3),
    Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
  ]);
}

class _Page extends StatelessWidget {
  const _Page({required this.title, required this.subtitle, required this.children});
  final String title, subtitle;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => ListView(
    physics: const BouncingScrollPhysics(),
    padding: const EdgeInsets.fromLTRB(18, 24, 18, 120),
    children: [
      Text(title, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
      const SizedBox(height: 4),
      Text(subtitle, style: const TextStyle(color: Colors.white70)),
      const SizedBox(height: 22),
      ...children.map((child) => Padding(padding: const EdgeInsets.only(bottom: 12), child: child)),
    ],
  );
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white.withOpacity(.12), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white.withOpacity(.07))),
      child: child,
    );
    return onTap == null ? card : InkWell(onTap: onTap, borderRadius: BorderRadius.circular(20), child: card);
  }
}

class _Task extends StatelessWidget {
  const _Task({required this.icon, required this.title, required this.detail, required this.progress, required this.amount});
  final IconData icon;
  final String title, detail, amount;
  final double progress;
  @override
  Widget build(BuildContext context) => _GlassCard(child: Column(children: [
    Row(children: [
      Icon(icon, color: const Color(0xFFFFD36A), size: 27),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        Text(detail, style: const TextStyle(fontSize: 12, color: Colors.white70)),
      ])),
      Text(amount, style: const TextStyle(fontWeight: FontWeight.w800)),
    ]),
    const SizedBox(height: 12),
    ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: progress, minHeight: 7, backgroundColor: Colors.white12, color: sky)),
  ]));
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.title, required this.detail});
  final IconData icon;
  final String title, detail;
  @override
  Widget build(BuildContext context) => _GlassCard(child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Icon(icon, size: 30, color: const Color(0xFFFFD36A)),
    const SizedBox(width: 13),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
      const SizedBox(height: 5),
      Text(detail, style: const TextStyle(color: Colors.white70, height: 1.4)),
    ])),
  ]));
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value, label;
  @override
  Widget build(BuildContext context) => _GlassCard(child: Row(children: [
    Icon(icon, color: const Color(0xFFFFD36A)),
    const SizedBox(width: 9),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.white70)),
    ])),
  ]));
}

class _LessonPage extends StatelessWidget {
  const _LessonPage({required this.number, required this.onComplete});
  final int number;
  final VoidCallback onComplete;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(children: [
      const _Background(),
      SafeArea(child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Align(alignment: Alignment.centerLeft, child: IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close))),
          const Spacer(),
          const CloudyMascot(size: 110),
          const SizedBox(height: 20),
          Text('Урок $number', textAlign: TextAlign.center, style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          const Text('На этом этапе создаётся каркас Flutter. Далее сюда переносится полноценная система упражнений: слова, перевод, аудирование, произношение и составление фраз.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, height: 1.5)),
          const Spacer(),
          FilledButton(
            onPressed: onComplete,
            style: FilledButton.styleFrom(backgroundColor: sky, foregroundColor: navy, padding: const EdgeInsets.symmetric(vertical: 17)),
            child: const Text('ЗАВЕРШИТЬ ДЕМО-УРОК', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
          const SizedBox(height: 12),
        ]),
      )),
    ]),
  );
}
