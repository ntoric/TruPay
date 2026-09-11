import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static const String _tokenKey = 'auth_token';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  static Future<Map<String, String>> _headers({bool? sendToken}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (sendToken ?? true) {
      final token = await getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static Future<(dynamic, int)> get(String path, {Map<String, dynamic>? query, bool? sendToken}) async {
    final uri = Uri.parse('${ApiConfig.apiUrl}$path');
    final finalUri = query != null
        ? uri.replace(queryParameters: query.map((k, v) => MapEntry(k, v.toString())))
        : uri;
    final res = await http.get(finalUri, headers: await _headers(sendToken: sendToken));
    return (_parseBody(res.body), res.statusCode);
  }

  static Future<(dynamic, int)> post(String path, {dynamic body, bool? sendToken}) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.apiUrl}$path'),
      headers: await _headers(sendToken: sendToken),
      body: body != null ? jsonEncode(body) : null,
    );
    return (_parseBody(res.body), res.statusCode);
  }

  static Future<(dynamic, int)> put(String path, {dynamic body, bool? sendToken}) async {
    final res = await http.put(
      Uri.parse('${ApiConfig.apiUrl}$path'),
      headers: await _headers(sendToken: sendToken),
      body: body != null ? jsonEncode(body) : null,
    );
    return (_parseBody(res.body), res.statusCode);
  }

  static Future<(dynamic, int)> delete(String path, {bool? sendToken}) async {
    final res = await http.delete(
      Uri.parse('${ApiConfig.apiUrl}$path'),
      headers: await _headers(sendToken: sendToken),
    );
    return (_parseBody(res.body), res.statusCode);
  }

  static Future<http.Response> downloadZip(String path, {bool? sendToken}) async {
    return http.get(
      Uri.parse('${ApiConfig.apiUrl}$path'),
      headers: await _headers(sendToken: sendToken),
    );
  }

  static dynamic _parseBody(String body) {
    if (body.isEmpty) return null;
    try {
      return jsonDecode(body);
    } catch (_) {
      return body;
    }
  }
}
