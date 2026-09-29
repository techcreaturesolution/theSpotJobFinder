import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api.dart';
import '../app_state.dart';
import '../widgets/banner_ad.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static bool _googleReady = false;
  Map<String, dynamic>? _config;
  final _email = TextEditingController();
  String _error = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    try {
      final c = await AppScope.of(context).api.get('/auth/config');
      if (mounted) setState(() => _config = c);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() login) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    final app = AppScope.of(context);
    try {
      await app.signIn(await login());
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled && mounted) {
        setState(
          () =>
              _error = 'Google sign-in failed: ${e.description ?? e.code.name}',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<Map<String, dynamic>> _google() async {
    final api = AppScope.of(context).api;
    final clientId = _config?['googleClientId'] as String?;
    if (clientId == null || clientId.isEmpty) {
      throw ApiException(
        500,
        'Google sign-in is not configured on the server.',
      );
    }
    final google = GoogleSignIn.instance;
    if (!_googleReady) {
      await google.initialize(serverClientId: clientId);
      _googleReady = true;
    }
    final account = await google.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw ApiException(401, 'Google did not return an ID token.');
    }
    return api.post('/auth/google', {'credential': idToken});
  }

  @override
  Widget build(BuildContext context) {
    final devLogin = _config?['devLoginEnabled'] == true;
    return Scaffold(
      bottomNavigationBar: const BannerAdBox(),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.work_outline,
                  size: 56,
                  color: Color(0xFF1D4ED8),
                ),
                const SizedBox(height: 12),
                Text(
                  'TheSpot JobFinder',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Verified, current jobs across India from Google Jobs, company websites, Apna, Indeed, LinkedIn, WorkIndia and more.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                FilledButton.icon(
                  onPressed: _busy || _config == null
                      ? null
                      : () => _run(_google),
                  icon: const Icon(Icons.login),
                  label: const Text('Continue with Google'),
                ),
                if (devLogin) ...[
                  const SizedBox(height: 24),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Developer login email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () => _run(
                            () => AppScope.of(context).api.post('/auth/dev', {
                              'email': _email.text.trim(),
                            }),
                          ),
                    child: const Text('Developer login'),
                  ),
                ],
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      _error,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
