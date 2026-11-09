import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

const _background = Color(0xFF050D2B);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: _background,
    systemNavigationBarIconBrightness: Brightness.light,
    systemNavigationBarDividerColor: Colors.transparent,
  ));
  runApp(const CloudyEnglishApp());
}

/// Compatibility shell: displays the current Cloudy web runtime unchanged
/// while the native Dart screens are ported and checked for feature parity.
class CloudyEnglishApp extends StatefulWidget {
  const CloudyEnglishApp({super.key});

  @override
  State<CloudyEnglishApp> createState() => _CloudyEnglishAppState();
}

class _CloudyEnglishAppState extends State<CloudyEnglishApp> {
  late final WebViewController _webView;
  late final Uri _baseUri;
  String? _configurationError;

  @override
  void initState() {
    super.initState();
    const baseUrl = String.fromEnvironment('CLOUDY_API_BASE_URL');
    final uri = Uri.tryParse(baseUrl);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority ||
        (uri.scheme != 'https' && uri.host != 'localhost')) {
      _configurationError =
          'Не задан корректный CLOUDY_API_BASE_URL. Укажите адрес текущего Cloudy сайта при сборке приложения.';
      return;
    }

    _baseUri = uri;
    _webView = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_background)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (request) {
          final target = Uri.tryParse(request.url);
          if (target == null) return NavigationDecision.prevent;
          final trustedHost = target.host == _baseUri.host ||
              target.host.endsWith('.supabase.co') || target.host.endsWith('.supabase.in');
          if (trustedHost && (target.scheme == 'https' || target.scheme == 'http')) {
            return NavigationDecision.navigate;
          }
          if (target.scheme == 'https' || target.scheme == 'http' ||
              target.scheme == 'mailto' || target.scheme == 'tel') {
            unawaited(launchUrl(target, mode: LaunchMode.externalApplication));
          }
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(uri.replace(
        path: '/',
        queryParameters: {...uri.queryParameters, 'cloudyNative': '1'},
      ));
  }

  Future<bool> _handleBack() async {
    if (await _webView.canGoBack()) {
      await _webView.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cloudy English',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: _background,
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF4DB3FF),
          surface: _background,
        ),
      ),
      home: _configurationError != null
          ? _ConfigurationError(message: _configurationError!)
          : PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, result) async {
                if (!didPop && await _handleBack() && context.mounted) {
                  await SystemNavigator.pop();
                }
              },
              child: const Scaffold(
                backgroundColor: _background,
                body: SafeArea(
                  top: false,
                  bottom: false,
                  child: WebViewWidget(controller: _webView),
                ),
              ),
            ),
    );
  }
}

class _ConfigurationError extends StatelessWidget {
  const _ConfigurationError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _background,
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, height: 1.5),
        ),
      ),
    ),
  );
}
