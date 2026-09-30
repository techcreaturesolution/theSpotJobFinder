import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  @override
  String toString() => message;
}

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String? token);
}

class SecureTokenStore implements TokenStore {
  static const _key = 'spotjobs_token';
  final _storage = const FlutterSecureStorage();

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String? token) => token == null
      ? _storage.delete(key: _key)
      : _storage.write(key: _key, value: token);
}

String errorMessage(Map<String, dynamic> data, int status) {
  final details = data['details'];
  if (data['error'] == 'Validation failed' &&
      details is List &&
      details.isNotEmpty &&
      details.first is Map &&
      (details.first as Map)['message'] != null) {
    return (details.first as Map)['message'].toString();
  }
  return (data['error'] ?? 'Request failed ($status)').toString();
}

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl, TokenStore? tokens})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _tokens = tokens ?? SecureTokenStore();

  final http.Client _client;
  final String baseUrl;
  final TokenStore _tokens;
  String? _token;
  void Function()? onUnauthorized;

  bool get hasToken => _token != null;

  Future<void> loadToken() async => _token = await _tokens.read();

  Future<void> setToken(String? token) async {
    _token = token;
    await _tokens.write(token);
  }

  Future<Map<String, dynamic>> get(String path) => _send('GET', path);

  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic>? body,
  ]) => _send('POST', path, body);

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _send('PUT', path, body);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers['Content-Type'] = 'application/json';
    if (_token != null) req.headers['Authorization'] = 'Bearer $_token';
    if (body != null) req.body = jsonEncode(body);
    final http.Response res;
    try {
      res = await http.Response.fromStream(
        await _client.send(req).timeout(const Duration(seconds: 30)),
      );
    } on TimeoutException {
      throw ApiException(
        0,
        'The server did not respond. Check your connection and try again.',
      );
    } on http.ClientException {
      throw ApiException(
        0,
        'Could not reach the server. Check your connection and try again.',
      );
    }
    Map<String, dynamic> data = {};
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(res.body) as Map<String, dynamic>;
      } on FormatException {
        data = {};
      }
    }
    if (res.statusCode == 401 && _token != null) {
      await setToken(null);
      onUnauthorized?.call();
    }
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, errorMessage(data, res.statusCode));
    }
    return data;
  }
}
