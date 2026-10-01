import 'package:flutter/widgets.dart';

import 'api.dart';
import 'models.dart';

bool userNeedsProfile(Map<String, dynamic>? user) =>
    (user?['role'] == 'user' || user?['role'] == 'employer') &&
    user?['profileComplete'] != true;

class AppState extends ChangeNotifier {
  AppState(this.api) {
    api.onUnauthorized = () {
      user = null;
      notifyListeners();
    };
  }

  final ApiClient api;
  Map<String, dynamic>? user;
  JobMeta? meta;
  Map<String, dynamic>? adConfig;

  String get userId => (user?['id'] ?? '').toString();
  bool get needsProfile => userNeedsProfile(user);
  Map<String, dynamic>? get admob =>
      adConfig?['admob'] as Map<String, dynamic>?;

  Future<void> restore() async {
    await api.loadToken();
    adConfig = await api
        .get('/adsense/config')
        .catchError((_) => <String, dynamic>{});
    if (!api.hasToken) return;
    try {
      user = (await api.get('/auth/me'))['user'] as Map<String, dynamic>;
      await loadMeta();
    } on ApiException {
      await api.setToken(null);
      user = null;
    }
  }

  Future<void> loadMeta() async =>
      meta = JobMeta.fromJson(await api.get('/jobs/meta'));

  Future<void> signIn(Map<String, dynamic> data) async {
    await api.setToken(data['token'] as String);
    user = data['user'] as Map<String, dynamic>;
    await loadMeta();
    notifyListeners();
  }

  Future<void> saveProfile(Map<String, dynamic> profile) async {
    user =
        (await api.put('/auth/profile', profile))['user']
            as Map<String, dynamic>;
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.setToken(null);
    user = null;
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
