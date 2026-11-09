import 'package:flutter/material.dart';

import '../domain/cloudy_exercise.dart';
import '../domain/cloudy_progress_engine.dart';

const _lessonNavy = Color(0xFF071333);
const _lessonBlue = Color(0xFF2D86F2);
const _lessonCyan = Color(0xFF63C1FF);

/// Native lesson runner. Progress mutations remain owned by the session
/// controller so the existing local/server progress policy stays authoritative.
class CloudyLessonScreen extends StatefulWidget {
  const CloudyLessonScreen({
    super.key,
    required this.title,
    required this.session,
    required this.onAnswer,
    required this.onMatchingAttempt,
    required this.onAdvance,
    required this.onComplete,
    required this.onPronunciationRequested,
    required this.onSpeak,
    required this.onSkipPronunciation,
    this.onExit,
    this.allowAdvanceOnLast = false,
  });

  final String title;
  final CloudySession session;
  final void Function(bool correct, String? englishWord) onAnswer;
  final void Function(String englishWord, bool correct, int totalPairs)
      onMatchingAttempt;
  final VoidCallback onAdvance;
  final VoidCallback onComplete;
  final void Function(String word, ValueChanged<bool> onResult) onPronunciationRequested;
  final ValueChanged<String> onSpeak;
  final VoidCallback onSkipPronunciation;
  final VoidCallback? onExit;
  final bool allowAdvanceOnLast;

  @override
  State<CloudyLessonScreen> createState() => _CloudyLessonScreenState();
}

class _CloudyLessonScreenState extends State<CloudyLessonScreen> {
  String? _selected;
  String? _feedback;
  bool? _wasCorrect;
  final List<String> _assembled = [];
  final List<String> _assembledKeys = [];
  final Set<String> _usedTokens = {};
  final Set<String> _matchedLeft = {};
  final Set<String> _matchedRight = {};
  String? _pendingLeft;
  final TextEditingController _recall = TextEditingController();

  CloudyExercise get _exercise =>
      widget.session.exercises[widget.session.index];
  bool get _last =>
      widget.session.index >= widget.session.exercises.length - 1;

  @override
  void didUpdateWidget(covariant CloudyLessonScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.index != widget.session.index ||
        oldWidget.session.exercises.length != widget.session.exercises.length) {
      _resetExercise();
    }
  }

  void _resetExercise() {
    _selected = null;
    _feedback = null;
    _wasCorrect = null;
    _assembled.clear();
    _assembledKeys.clear();
    _usedTokens.clear();
    _matchedLeft.clear();
    _matchedRight.clear();
    _pendingLeft = null;
    _recall.clear();
  }

  @override
  void dispose() {
    _recall.dispose();
    super.dispose();
  }

  void _submit(bool correct, String? word) {
    if (_wasCorrect != null) return;
    setState(() {
      _wasCorrect = correct;
      _feedback = correct ? 'Отлично! Всё верно.' : 'Пока не совсем. Попробуй ещё раз.';
    });
    widget.onAnswer(correct, word);
  }

  void _advance() {
    if (_last && !widget.allowAdvanceOnLast) {
      widget.onComplete();
    } else {
      // The owner advances the canonical CloudySession and supplies it back.
      widget.onAdvance();
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.session.exercises.length;
    final current = widget.session.index + 1;
    return Scaffold(
      backgroundColor: _lessonNavy,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_lessonNavy, Color(0xFF0B2D70), Color(0xFF2589D8)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _topBar(context, current, total),
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                  child: _exerciseBody(_exercise),
                ),
              ),
              if (_feedback != null) _feedbackPanel(),
              _bottomAction(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context, int current, int total) {
    final progress = total == 0 ? 0.0 : current / total;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 18, 12),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: widget.onExit,
                icon: const Icon(Icons.close_rounded, color: Colors.white),
              ),
              Expanded(
                child: Text(
                  widget.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 17,
                  ),
                ),
              ),
              const SizedBox(width: 44),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 7,
                    backgroundColor: Colors.white.withValues(alpha: .18),
                    valueColor: const AlwaysStoppedAnimation(_lessonCyan),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '$current/$total',
                style: const TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _exerciseBody(CloudyExercise exercise) {
    if (exercise is CloudyTheoryExercise) return _theory(exercise);
    if (exercise is CloudyVocabularyExercise) return _vocabulary(exercise);
    if (exercise is CloudyChoiceExercise) return _choice(exercise);
    if (exercise is CloudyListeningExercise) return _listening(exercise);
    if (exercise is CloudyBuilderExercise) return _builder(exercise);
    if (exercise is CloudyMatchingExercise) return _matching(exercise);
    if (exercise is CloudyRecallExercise) return _recallExercise(exercise);
    if (exercise is CloudyPronunciationExercise) return _pronunciation(exercise);
    return const Center(
      child: Text('Неизвестный тип задания', style: TextStyle(color: Colors.white)),
    );
  }

  Widget _heading(String eyebrow, String title, String subtitle) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(eyebrow.toUpperCase(), style: const TextStyle(
        color: _lessonCyan, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2,
      )),
      const SizedBox(height: 9),
      Text(title, style: const TextStyle(
        color: Colors.white, fontSize: 25, height: 1.18, fontWeight: FontWeight.w900,
      )),
      const SizedBox(height: 10),
      Text(subtitle, style: const TextStyle(
        color: Color(0xFFC9DDF7), fontSize: 15, height: 1.45,
      )),
      const SizedBox(height: 24),
    ],
  );

  Widget _panel(Widget child) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .10),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: Colors.white.withValues(alpha: .12)),
    ),
    child: child,
  );

  Widget _theory(CloudyTheoryExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading('Грамматика ${e.level ?? ''}', e.title, e.body),
      _panel(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ПРИМЕРЫ', style: TextStyle(color: _lessonCyan, fontWeight: FontWeight.w900, fontSize: 11)),
          const SizedBox(height: 12),
          ...e.examples.map((p) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.first, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(p.second, style: const TextStyle(color: Color(0xFFC9DDF7), fontSize: 14)),
            ]),
          )),
          if (e.tip.isNotEmpty) ...[
            const Divider(color: Colors.white24, height: 24),
            Text('Подсказка: ${e.tip}', style: const TextStyle(color: Colors.white, height: 1.4)),
          ],
        ],
      )),
    ],
  );

  Widget _vocabulary(CloudyVocabularyExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading('Новые слова', 'Запомни слова урока', 'Посмотри на английские слова и их перевод.'),
      ...e.words.map((p) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _panel(Row(children: [
          Expanded(child: Text(p.first, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17))),
          const SizedBox(width: 12),
          Expanded(child: Text(p.second, textAlign: TextAlign.end, style: const TextStyle(color: Color(0xFFC9DDF7), fontSize: 15))),
        ])),
      )),
    ],
  );

  Widget _choice(CloudyChoiceExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(e.title, e.question, 'Выбери один правильный ответ.'),
      if (e.speak) Align(alignment: Alignment.centerLeft, child: TextButton.icon(
        onPressed: () => widget.onSpeak(e.english),
        icon: const Icon(Icons.volume_up_rounded), label: const Text('Прослушать слово'),
      )),
      ...e.options.map((option) => _option(
        option,
        selected: _selected == option,
        enabled: _wasCorrect == null,
        onTap: () {
          setState(() => _selected = option);
          _submit(option == e.answer, e.english);
        },
      )),
    ],
  );

  Widget _listening(CloudyListeningExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(e.title, 'Что ты слышишь?', 'Прослушай слово и выбери правильный вариант.'),
      _panel(Column(children: [
        const Icon(Icons.headphones_rounded, color: _lessonCyan, size: 34),
        const SizedBox(height: 10),
        const Text('Нажми, чтобы прослушать', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => widget.onSpeak(e.english),
          icon: const Icon(Icons.volume_up_rounded),
          label: const Text('Прослушать'),
          style: FilledButton.styleFrom(backgroundColor: _lessonBlue, foregroundColor: Colors.white),
        ),
      ])),
      const SizedBox(height: 18),
      ...e.options.map((option) => _option(
        option,
        selected: _selected == option,
        enabled: _wasCorrect == null,
        onTap: () {
          setState(() => _selected = option);
          _submit(option == e.answer, e.english);
        },
      )),
    ],
  );

  Widget _builder(CloudyBuilderExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(e.title, e.question, 'Нажимай на слова по порядку, чтобы собрать предложение.'),
      _panel(Wrap(
        spacing: 8, runSpacing: 8,
        children: _assembled.isEmpty
            ? [Text('Твоё предложение появится здесь', style: TextStyle(color: Colors.white.withValues(alpha: .6)))]
            : _assembled.asMap().entries.map((entry) => GestureDetector(
                onTap: _wasCorrect == null ? () => setState(() {
                  _assembled.removeAt(entry.key);
                  _usedTokens.remove(_assembledKeys.removeAt(entry.key));
                }) : null,
                child: _token(entry.value, selected: true),
              )).toList(),
      )),
      const SizedBox(height: 18),
      Wrap(
        spacing: 8, runSpacing: 10,
        children: e.options.asMap().entries.where((entry) => !_usedTokens.contains('${entry.key}:${entry.value}')).map((entry) =>
          GestureDetector(
            onTap: _wasCorrect == null ? () => setState(() {
              final key = '${entry.key}:${entry.value}';
              _usedTokens.add(key);
              _assembledKeys.add(key);
              _assembled.add(entry.value);
            }) : null,
            child: _token(entry.value),
          ),
        ).toList(),
      ),
      const SizedBox(height: 16),
      OutlinedButton(
        onPressed: _assembled.isEmpty || _wasCorrect != null ? null : () => setState(() {
          _assembled.clear(); _assembledKeys.clear(); _usedTokens.clear();
        }),
        child: const Text('Очистить ответ'),
      ),
      if (_assembled.isNotEmpty && _wasCorrect == null)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: TextButton(
            onPressed: () => _submit(
              _assembled.join(' ') == e.answer,
              e.answer.split(' ').first,
            ),
            child: const Text('Проверить ответ'),
          ),
        ),
    ],
  );

  Widget _matching(CloudyMatchingExercise e) {
    final pairs = e.left.length < e.right.length ? e.left.length : e.right.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _heading(e.title ?? 'Найдите пары', 'Соедини слова и перевод', 'Сначала выбери слово слева, затем его перевод справа.'),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(children: e.left.asMap().entries.map((entry) => _matchTile(
            entry.value.first,
            key: ValueKey('cloudy-match-left-${entry.key}'),
            active: _pendingLeft == p.first,
            done: _matchedLeft.contains(p.first),
            onTap: () => setState(() => _pendingLeft = p.first),
          )).toList())),
          const SizedBox(width: 12),
          Expanded(child: Column(children: e.right.asMap().entries.map((entry) => _matchTile(
            entry.value.first,
            key: ValueKey('cloudy-match-right-${entry.key}'),
            active: false,
            done: _matchedRight.contains(p.first),
            onTap: _pendingLeft == null || _matchedRight.contains(p.first) ? null : () {
              final left = e.left.firstWhere((item) => item.first == _pendingLeft);
              final correct = left.second == p.second;
              widget.onMatchingAttempt(left.first, correct, pairs);
              setState(() {
                if (correct) {
                  _matchedLeft.add(left.first);
                  _matchedRight.add(p.first);
                }
                _pendingLeft = null;
                if (correct && _matchedLeft.length == pairs) {
                  _feedback = 'Все пары найдены!';
                  _wasCorrect = true;
                } else if (!correct) {
                  _feedback = 'Эта пара не подходит. Попробуй ещё.';
                  _wasCorrect = null;
                }
              });
            },
          )).toList())),
        ]),
      ],
    );
  }

  Widget _recallExercise(CloudyRecallExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(e.title, e.question, 'Введи английское слово по памяти.'),
      TextField(
        controller: _recall,
        enabled: _wasCorrect == null,
        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
        decoration: InputDecoration(
          hintText: 'Напиши ответ на английском',
          hintStyle: const TextStyle(color: Colors.white54),
          filled: true,
          fillColor: Colors.white.withValues(alpha: .10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        ),
        onSubmitted: (_) => _checkRecall(e),
      ),
      const SizedBox(height: 12),
      Align(alignment: Alignment.centerRight, child: TextButton(
        onPressed: _wasCorrect == null ? () => _checkRecall(e) : null,
        child: const Text('Проверить'),
      )),
    ],
  );

  void _checkRecall(CloudyRecallExercise e) {
    final input = _recall.text.trim();
    final normalized = input.toLowerCase().replaceAll(RegExp(r'[.!?]+$'), '').replaceAll(RegExp(r'\s+'), ' ');
    _submit(normalized == e.answer.toLowerCase(), e.english);
  }

  Widget _pronunciation(CloudyPronunciationExercise e) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading('Произношение', 'Произнеси слово вслух', 'Нажми кнопку, чтобы запустить проверку произношения на устройстве.'),
      _panel(Column(children: [
        Text(e.english, style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => widget.onPronunciationRequested(
            e.english, (correct) => _submit(correct, e.english),
          ),
          icon: const Icon(Icons.mic_rounded),
          label: const Text('Начать произношение'),
          style: FilledButton.styleFrom(backgroundColor: _lessonBlue, foregroundColor: Colors.white),
        ),
      ])),
      const SizedBox(height: 10),
      TextButton(
        onPressed: () {
          widget.onSkipPronunciation();
          _advance();
        },
        child: const Text('Пропустить это задание'),
      ),
    ],
  );

  Widget _option(String value, {required bool selected, required bool enabled, required VoidCallback onTap}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: selected ? _lessonBlue : Colors.white.withValues(alpha: .10),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: enabled ? onTap : null,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 17),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: selected ? _lessonCyan : Colors.white.withValues(alpha: .12)),
              ),
              child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            ),
          ),
        ),
      );

  Widget _token(String value, {bool selected = false}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: selected ? _lessonBlue : Colors.white.withValues(alpha: .14),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: Colors.white.withValues(alpha: .2)),
    ),
    child: Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
  );

  Widget _matchTile(String value, {Key? key, required bool active, required bool done, VoidCallback? onTap}) =>
      Padding(
        key: key,
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: done ? const Color(0xFF1C9A83).withValues(alpha: .55) : active ? _lessonBlue : Colors.white.withValues(alpha: .10),
          borderRadius: BorderRadius.circular(13),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(13),
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(minHeight: 52),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
              child: Text(value, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ),
          ),
        ),
      );

  Widget _feedbackPanel() => Padding(
    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: (_wasCorrect == true ? const Color(0xFF1C9A83) : const Color(0xFFB45B55)).withValues(alpha: .22),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(_feedback!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
    ),
  );

  Widget _bottomAction() {
    final exercise = _exercise;
    final canContinue = exercise is CloudyTheoryExercise ||
        exercise is CloudyVocabularyExercise ||
        _wasCorrect != null;
    if (!canContinue) return const SizedBox(height: 16);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 18),
      child: SizedBox(
        width: double.infinity,
        height: 54,
        child: FilledButton(
          onPressed: _advance,
          style: FilledButton.styleFrom(
            backgroundColor: _lessonCyan,
            foregroundColor: _lessonNavy,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: Text(
            _last && !widget.allowAdvanceOnLast ? 'Завершить урок' : 'Продолжить',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
        ),
      ),
    );
  }
}
