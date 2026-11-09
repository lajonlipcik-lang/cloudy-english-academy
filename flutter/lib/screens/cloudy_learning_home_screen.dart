import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../domain/cloudy_catalog.dart';
import '../domain/cloudy_state.dart';

const _ice = Color(0xFFCFE9FF);
const _sky = Color(0xFF4DB3FF);
const _blue = Color(0xFF2D86F2);

/// Native counterpart of the existing Cloudy learning tab.
class CloudyLearningHomeScreen extends StatelessWidget {
  const CloudyLearningHomeScreen({
    super.key, required this.catalog, required this.state,
    required this.onOpenLesson, required this.onOpenSettings,
    required this.onOpenProfile, required this.onClaimReward,
  });
  final CloudyCatalog catalog;
  final CloudyState state;
  final ValueChanged<int> onOpenLesson;
  final VoidCallback onOpenSettings, onOpenProfile, onClaimReward;

  @override
  Widget build(BuildContext context) {
    final level = state.level?.code ?? 'A1';
    final sections = catalog.levels[level] ?? const <CloudySection>[];
    final goal = math.max(1, state.settings.goal.toInt());
    final progress = (state.today.xp / goal).clamp(0.0, 1.0).toDouble();
    final ready = state.today.xp >= goal && state.today.claim == 0;
    return Scaffold(
      backgroundColor: const Color(0xFF050D2B),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomRight,
            colors: [Color(0xFF050D2B), Color(0xFF0A2A73), Color(0xFF3AA0FF)],
            stops: [0, .48, 1],
          ),
        ),
        child: Stack(children: [
          const Positioned.fill(child: _Ambient()),
          SafeArea(
            bottom: false,
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _Hud(
                  level: level, streak: state.streak.toInt(), xp: state.xp.toInt(),
                  progress: progress, ready: ready, claimed: state.today.claim != 0,
                  onProfile: onOpenProfile, onSettings: onOpenSettings,
                  onClaim: onClaimReward,
                )),
                if (state.mistakes.isNotEmpty)
                  SliverToBoxAdapter(child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 4),
                    child: _ReviewHint(count: state.mistakes.length),
                  )),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 124),
                  sliver: SliverList.separated(
                    itemCount: sections.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      var offset = 0;
                      for (var i = 0; i < index; i++) {
                        offset += sections[i].lessonIndices.length;
                      }
                      return _Section(
                        index: index, section: sections[index], catalog: catalog,
                        completedBefore: offset,
                        completed: (state.completed[level] ?? 0).toInt(),
                        onOpen: onOpenLesson,
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _Hud extends StatelessWidget {
  const _Hud({required this.level, required this.streak, required this.xp,
    required this.progress, required this.ready, required this.claimed,
    required this.onProfile, required this.onSettings, required this.onClaim});
  final String level;
  final int streak, xp;
  final double progress;
  final bool ready, claimed;
  final VoidCallback onProfile, onSettings, onClaim;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
    child: Row(children: [
      InkWell(
        onTap: onProfile, borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 52, height: 52, alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(colors: [Colors.white, _ice]),
            boxShadow: const [BoxShadow(color: Color(0x332D86F2), blurRadius: 12, offset: Offset(0, 5))],
          ),
          child: Text(level, style: const TextStyle(color: Color(0xFF1F6FE0), fontSize: 19, fontWeight: FontWeight.w900)),
        ),
      ),
      const SizedBox(width: 12),
      _Stat(icon: '🔥', value: '$streak'),
      const SizedBox(width: 7),
      _Stat(icon: '⚡', value: '$xp'),
      const Spacer(),
      Semantics(
        button: true,
        label: claimed ? 'Дневная награда получена' : ready ? 'Забрать дневную награду' : 'Дневная цель',
        child: InkWell(
          onTap: ready ? onClaim : null,
          child: SizedBox(width: 48, height: 48, child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(width: 42, height: 42, child: CircularProgressIndicator(
                value: progress, strokeWidth: 3,
                backgroundColor: Colors.white.withValues(alpha: .22),
                valueColor: const AlwaysStoppedAnimation(Color(0xFFFFD35A)),
              )),
              Text(claimed ? '✓' : '🎁', style: const TextStyle(fontSize: 23)),
            ],
          )),
        ),
      ),
      const SizedBox(width: 8),
      IconButton(
        tooltip: 'Настройки', onPressed: onSettings,
        style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: .14), foregroundColor: Colors.white, fixedSize: const Size(44, 44)),
        icon: const Icon(Icons.settings_rounded, size: 21),
      ),
    ]),
  );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value});
  final String icon, value;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(99)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text(icon, style: const TextStyle(fontSize: 18)),
      const SizedBox(width: 5),
      Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
    ]),
  );
}

class _ReviewHint extends StatelessWidget {
  const _ReviewHint({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .14), borderRadius: BorderRadius.circular(15)),
    child: Row(children: [
      const Icon(Icons.refresh_rounded, color: Color(0xFFFFD35A)),
      const SizedBox(width: 10),
      Text('Повторение ошибок · $count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
    ]),
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.index, required this.section, required this.catalog,
    required this.completedBefore, required this.completed, required this.onOpen});
  final int index, completedBefore, completed;
  final CloudySection section;
  final CloudyCatalog catalog;
  final ValueChanged<int> onOpen;

  @override
  Widget build(BuildContext context) {
    final count = (completed - completedBefore).clamp(0, section.lessonIndices.length);
    final fraction = section.lessonIndices.isEmpty ? 0.0 : count / section.lessonIndices.length;
    return Column(children: [
      Container(
        width: double.infinity, padding: const EdgeInsets.fromLTRB(17, 13, 17, 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF63C1FF), Color(0xFF2C7BEF)]),
          boxShadow: const [
            BoxShadow(color: Color(0x551A58B5), offset: Offset(0, 5), blurRadius: 0),
            BoxShadow(color: Color(0x33000000), offset: Offset(0, 9), blurRadius: 15),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('РАЗДЕЛ ' + (index + 1).toString(), style: TextStyle(color: Colors.white.withValues(alpha: .8), fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(section.name, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: fraction, minHeight: 5, backgroundColor: Colors.white.withValues(alpha: .25), valueColor: const AlwaysStoppedAnimation(Colors.white))),
        ]),
      ),
      const SizedBox(height: 18),
      ...List.generate(section.lessonIndices.length, (i) {
        final lesson = section.lessonIndices[i];
        final position = completedBefore + i;
        final done = position < completed;
        final current = position == completed;
        return Padding(
          padding: const EdgeInsets.only(bottom: 22),
          child: _Node(
            title: catalog.titleAt(lesson), done: done, current: current,
            offset: math.sin(position * 1.05) * 68,
            onTap: done || current ? () => onOpen(lesson) : null,
          ),
        );
      }),
    ]);
  }
}

class _Node extends StatelessWidget {
  const _Node({required this.title, required this.done, required this.current, required this.offset, required this.onTap});
  final String title;
  final bool done, current;
  final double offset;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final gradient = done
      ? const LinearGradient(colors: [Colors.white, _ice])
      : current ? const LinearGradient(colors: [_sky, _blue])
      : LinearGradient(colors: [const Color(0xFF788CB9).withValues(alpha: .62), const Color(0xFF53678F).withValues(alpha: .62)]);
    final foreground = done ? const Color(0xFF1F6FE0) : current ? Colors.white : Colors.white.withValues(alpha: .58);
    return Transform.translate(
      offset: Offset(offset, 0),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(width: 100, height: 100, child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
          if (current) const SizedBox(width: 100, height: 100, child: CircularProgressIndicator(value: .38, strokeWidth: 4, strokeCap: StrokeCap.round, backgroundColor: Colors.transparent, valueColor: AlwaysStoppedAnimation(Colors.white))),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap, customBorder: const CircleBorder(),
              child: Ink(
                width: 80, height: 80,
                decoration: BoxDecoration(shape: BoxShape.circle, gradient: gradient, boxShadow: [
                  BoxShadow(color: done ? const Color(0x558FBFE8) : const Color(0x661A58B5), offset: const Offset(0, 7), blurRadius: 0),
                  const BoxShadow(color: Color(0x33000000), offset: Offset(0, 13), blurRadius: 17),
                ]),
                child: Icon(done ? Icons.check_rounded : current ? Icons.star_rounded : Icons.lock_rounded, color: foreground, size: 35),
              ),
            ),
          ),
          if (current) const Positioned(top: -8, child: _StartLabel()),
        ])),
        const SizedBox(height: 10),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
        if (current) const Padding(padding: EdgeInsets.only(top: 3), child: CloudyMascot(size: 53)),
      ]),
    );
  }
}

class _StartLabel extends StatelessWidget {
  const _StartLabel();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
    child: const Text('НАЧАТЬ', style: TextStyle(color: Color(0xFF1F6FE0), fontWeight: FontWeight.w900, fontSize: 12)),
  );
}

/// Original Cloudy cloud silhouette with a lightweight periodic blink.
class CloudyMascot extends StatefulWidget {
  const CloudyMascot({super.key, this.size = 80});
  final double size;
  @override
  State<CloudyMascot> createState() => _CloudyMascotState();
}
class _CloudyMascotState extends State<CloudyMascot> with SingleTickerProviderStateMixin {
  late final AnimationController blink = AnimationController(vsync: this, duration: const Duration(milliseconds: 140), reverseDuration: const Duration(milliseconds: 140));
  @override
  void initState() { super.initState(); _loop(); }
  Future<void> _loop() async {
    while (mounted) {
      await Future<void>.delayed(const Duration(milliseconds: 3600));
      if (!mounted) return;
      await blink.forward();
      if (!mounted) return;
      await blink.reverse();
    }
  }
  @override
  void dispose() { blink.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => SizedBox(
    width: widget.size, height: widget.size * .8,
    child: AnimatedBuilder(animation: blink, builder: (context, _) => CustomPaint(painter: _MascotPainter(blink.value))),
  );
}
class _MascotPainter extends CustomPainter {
  const _MascotPainter(this.blink);
  final double blink;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save(); canvas.scale(size.width / 100, size.height / 80);
    final path = Path()..moveTo(26, 68)..cubicTo(8, 68, 4, 48, 12, 38)..cubicTo(15, 33, 20, 31, 24, 31)..cubicTo(27, 10, 57, 3, 70, 25)..cubicTo(88, 25, 96, 43, 86, 58)..cubicTo(82, 65, 76, 68, 70, 68)..close();
    canvas.drawPath(path, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFBFE0FF)]).createShader(const Rect.fromLTWH(8, 6, 84, 65)));
    final eye = Paint()..color = const Color(0xFF06143A);
    for (final x in [40.0, 62.0]) {
      canvas.drawOval(Rect.fromCenter(center: Offset(x, 45), width: 9, height: 5 * (1 - blink * .94)), eye);
      if (blink < .35) canvas.drawCircle(Offset(x + 1.7, 43), 1.5, Paint()..color = Colors.white);
    }
    final mouth = Path()..moveTo(44, 54)..quadraticBezierTo(51, 62, 58, 54);
    canvas.drawPath(mouth, Paint()..color = const Color(0xFF06143A)..style = PaintingStyle.stroke..strokeWidth = 3..strokeCap = StrokeCap.round);
    final cheek = Paint()..color = const Color(0x88FF9FB0);
    canvas.drawCircle(const Offset(31, 55), 4, cheek); canvas.drawCircle(const Offset(71, 55), 4, cheek);
    canvas.restore();
  }
  @override
  bool shouldRepaint(covariant _MascotPainter old) => old.blink != blink;
}

class _Ambient extends StatelessWidget {
  const _Ambient();
  @override
  Widget build(BuildContext context) => IgnorePointer(child: Stack(children: [
    Positioned(left: -130, top: MediaQuery.sizeOf(context).height * .12, child: const _Glow(size: 340)),
    Positioned(right: -115, top: MediaQuery.sizeOf(context).height * .46, child: const _Glow(size: 300)),
    Positioned(left: MediaQuery.sizeOf(context).width * .2, bottom: -180, child: const _Glow(size: 420)),
  ]));
}
class _Glow extends StatelessWidget {
  const _Glow({required this.size});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [_ice.withValues(alpha: .18), _ice.withValues(alpha: .025), Colors.transparent])),
  );
}
