import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart' show MobileAds;

import 'api.dart';
import 'app_state.dart';
import 'screens/login_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/search_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MobileAds.instance.initialize();
  final state = AppState(ApiClient());
  await state.restore();
  runApp(SpotJobsApp(state: state));
}

class SpotJobsApp extends StatelessWidget {
  const SpotJobsApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
        title: 'TheSpot JobFinder',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF1D4ED8),
          useMaterial3: true,
        ),
        home: const _Home(),
      ),
    );
  }
}

class _Home extends StatelessWidget {
  const _Home();

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    if (app.user == null) return const LoginScreen();
    if (app.needsProfile) return const ProfileScreen();
    return const SearchScreen();
  }
}
