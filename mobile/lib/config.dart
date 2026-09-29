import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Build-time settings. Override with `--dart-define=API_BASE_URL=https://your-server/api`.
class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
  );

  /// Origin of the API server, used for server-hosted media such as the demo video ad.
  static String get serverOrigin =>
      apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');

  static const _testBanner = {
    'android': 'ca-app-pub-3940256099942544/6300978111',
    'ios': 'ca-app-pub-3940256099942544/2934735716',
  };

  static String get platformKey => Platform.isIOS ? 'ios' : 'android';

  /// AdMob banner unit from the server, or Google's test unit in debug builds.
  static String? bannerUnit(Map<String, dynamic>? admob) {
    final configured = (admob?[platformKey] as Map?)?['banner'] as String?;
    if (configured != null && configured.isNotEmpty) return configured;
    return kDebugMode ? _testBanner[platformKey] : null;
  }

  static String? rewardedUnit(Map<String, dynamic>? admob) {
    final configured = (admob?[platformKey] as Map?)?['rewarded'] as String?;
    return configured != null && configured.isNotEmpty ? configured : null;
  }
}
