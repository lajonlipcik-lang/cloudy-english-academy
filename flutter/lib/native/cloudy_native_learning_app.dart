import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../data/cloudy_auth_repository.dart';
import '../data/cloudy_mobile_api.dart';
import '../domain/cloudy_catalog.dart';
import '../domain/cloudy_exercise_builder.dart';
import '../domain/cloudy_progress_engine.dart';
import '../domain/cloudy_progress_engine.dart' show claimCloudyChest;
import '../progress/cloudy_local_progress_store.dart';
import '../screens/cloudy_learning_home_screen.dart';
import '../screens/cloudy_lesson_flow.dart';
import '../session/cloudy_session_controller.dart';

const _navy = Color(0xFF050D2B);

class _CloudyNativeServices {
  const _CloudyNativeServices({
    required this.catalog,
    required this.controller,
    required this.baseUri,
  });

  final CloudyCatalog catalog;
  final CloudySessionController controller;
  final Uri baseUri;
}

class CloudyNativeLearningApp extends StatefulWidget {
  const CloudyNativeLearningApp({super.key});

  @override
  State<CloudyNativeLearningApp> createState() => _CloudyNativeLearningAppState();
}

class _CloudyNativeLearningAppState extends State<CloudyNativeLearningApp> {
  late Future<_CloudyNativeServices> _initialization;
  _CloudyNativeServices? _services;

  @override
  void initState() {
    super.initState();
    _initialization = _initialize();
  }

  Future<_CloudyNativeServices> _initialize() async {
    const apiBaseUrl = String.fromEnvironment('CLOUDY_API_BASE_URL');
    final baseUri = Uri.tryParse(apiBaseUrl);
    if (baseUri == null ||
        !baseUri.hasScheme ||
        !baseUri.hasAuthority ||
        (baseUri.scheme != 'https' && baseUri.host != 'localhost')) {
      throw StateError('Укажите корректный CLOUDY_API_BASE_URL при сборке приложения.');
    }

    await CloudyAuthRepository.initialize();
    final auth = CloudyAuthRepository.configured();
    final localProgress = await CloudyLocalProgressStore.create();
    final mobileApi = CloudyMobileApi(
      baseUrl: apiBaseUrl,
      accessToken: () async => auth.currentAccessToken,
    );
    final controller = CloudySessionController(
      auth: auth,
      localProgress: localProgress,
      mobileApi: mobileApi,
    );

    try {
      final catalog = await CloudyCatalog.load();
      await controller.start();
      return _CloudyNativeServices(
        catalog: catalog,
        controller: controller,
        baseUri: baseUri,
      );
    } catch (_) {
      controller.dispose();
      rethrow;
    }
  }

  @override
  void dispose() {
    _services?.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<_CloudyNativeServices>(
        future: _initialization,
        builder: (context, snapshot) {
          if (snapshot.hasData) {
            _services ??= snapshot.data!;
            return _CloudyNativeHome(services: _services!);
          }
          if (snapshot.hasError) {
            return _NativeInitializationError(
              message: snapshot.error.toString(),
              onRetry: () => setState(() {
                _initialization = _initialize();
              }),
            );
          }
          return const _NativeLoadingScreen();
        },
      );
}

class _NativeLoadingScreen extends StatelessWidget {
  const _NativeLoadingScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: _navy,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CloudyMascot(size: 94),
              SizedBox(height: 22),
              CircularProgressIndicator(color: Color(0xFF63C1FF)),
              SizedBox(height: 14),
              Text(
                'Загружаем твой прогресс…',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      );
}

class _NativeInitializationError extends StatelessWidget {
  const _NativeInitializationError({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _navy,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CloudyMascot(size: 82),
                const SizedBox(height: 18),
                const Text(
                  'Не удалось запустить нативное обучение',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, height: 1.4),
                ),
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: onRetry,
                  child: const Text('Повторить'),
                ),
              ],
            ),
          ),
        ),
      );
}

class _CloudyNativeHome extends StatefulWidget {
  const _CloudyNativeHome({required this.services});

  final _CloudyNativeServices services;

  @override
  State<_CloudyNativeHome> createState() => _CloudyNativeHomeState();
}

class _CloudyNativeHomeState extends State<_CloudyNativeHome> {
  bool _openingLesson = false;

  CloudySessionController get _controller => widget.services.controller;

  Future<void> _openLesson(int lessonIndex) async {
    if (_openingLesson) return;
    setState(() => _openingLesson = true);
    try {
      final progress = _controller.progress;
      final level = progress.level?.code ?? 'A1';
      final learningStore = await _controller.learningStore;
      final exercises = widget.services.catalog.buildAdaptiveLessonSequence(
        lessonIndex,
        level: level,
        microphoneEnabled: true,
        speechRecognitionAvailable: true,
        learningStore: learningStore,
      );
      if (exercises.isEmpty) {
        _showMessage('Для этого урока пока нет доступных заданий.');
        return;
      }
      if (!mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (routeContext) => CloudyLessonFlow(
            title: widget.services.catalog.titleAt(lessonIndex),
            initialSession: newCloudySession(lessonIndex, exercises),
            controller: _controller,
            levelLessonIndices: cloudyLessonsByLevel,
            vocabularyPool: widget.services.catalog.vocabularyPool,
            onExit: () => Navigator.of(routeContext).pop(),
          ),
        ),
      );
    } catch (error) {
      if (mounted) _showMessage('Не удалось открыть урок. $error');
    } finally {
      if (mounted) setState(() => _openingLesson = false);
    }
  }

  Future<void> _claimReward() async {
    final reward = claimCloudyChest(_controller.progress);
    if (reward == null) {
      _showMessage('Сначала выполни дневную цель.');
      return;
    }
    try {
      await _controller.saveProgress(reward);
      if (mounted) _showMessage('Награда получена: +25 XP!');
    } catch (_) {
      if (mounted) _showMessage('Не удалось сохранить награду. Попробуй ещё раз.');
    }
  }

  Future<void> _openExistingApp() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _ExistingCloudyAppPage(baseUri: widget.services.baseUri),
      ),
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final status = _controller.status;
          if (status == CloudySessionStatus.starting ||
              status == CloudySessionStatus.loadingAccount) {
            return const _NativeLoadingScreen();
          }
          return Scaffold(
            backgroundColor: _navy,
            body: Column(
              children: [
                if (_controller.errorMessage != null)
                  Material(
                    color: const Color(0xFF6E351B),
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                        child: Row(
                          children: [
                            const Icon(Icons.cloud_off_rounded, color: Colors.white),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                _controller.errorMessage!,
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ),
                            if (_controller.isAuthenticated)
                              IconButton(
                                tooltip: 'Повторить синхронизацию',
                                onPressed: _controller.retryAccountSync,
                                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: Stack(
                    children: [
                      CloudyLearningHomeScreen(
                        catalog: widget.services.catalog,
                        state: _controller.progress,
                        onOpenLesson: _openLesson,
                        onOpenSettings: _openExistingApp,
                        onOpenProfile: _openExistingApp,
                        onClaimReward: _claimReward,
                      ),
                      if (_openingLesson)
                        const Positioned.fill(
                          child: ColoredBox(
                            color: Color(0x44000000),
                            child: Center(
                              child: CircularProgressIndicator(
                                color: Color(0xFF63C1FF),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      );
}

/// Keeps profile/settings and all not-yet-ported areas reachable while the
/// native lesson path is being migrated. It uses the same Cloudy web runtime.
class _ExistingCloudyAppPage extends StatefulWidget {
  const _ExistingCloudyAppPage({required this.baseUri});

  final Uri baseUri;

  @override
  State<_ExistingCloudyAppPage> createState() => _ExistingCloudyAppPageState();
}

class _ExistingCloudyAppPageState extends State<_ExistingCloudyAppPage> {
  late final WebViewController _webView;

  @override
  void initState() {
    super.initState();
    _webView = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_navy)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (request) {
          final target = Uri.tryParse(request.url);
          if (target == null) return NavigationDecision.prevent;
          final trusted = target.host == widget.baseUri.host ||
              target.host.endsWith('.supabase.co') ||
              target.host.endsWith('.supabase.in');
          return trusted &&
                  (target.scheme == 'https' || target.scheme == 'http')
              ? NavigationDecision.navigate
              : NavigationDecision.prevent;
        },
      ))
      ..loadRequest(widget.baseUri.replace(
        path: '/',
        queryParameters: {
          ...widget.baseUri.queryParameters,
          'cloudyNative': '1',
        },
      ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _navy,
        appBar: AppBar(
          backgroundColor: _navy,
          foregroundColor: Colors.white,
          title: const Text('Cloudy English'),
          leading: IconButton(
            tooltip: 'Вернуться к урокам',
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: WebViewWidget(controller: _webView),
      );
}
