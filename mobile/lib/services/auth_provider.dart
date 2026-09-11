import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  String? _token;
  String? _email;
  String? _name;
  bool _loading = true;

  String? get token => _token;
  String? get email => _email;
  String? get name => _name;
  bool get isAuthenticated => _token != null;
  bool get loading => _loading;

  AuthProvider() {
    _init();
  }

  Future<void> _init() async {
    _token = await ApiService.getToken();
    if (_token != null) {
      final (data, status) = await ApiService.get('/auth/me');
      if (status == 200 && data is Map<String, dynamic>) {
        _email = data['email'];
      } else {
        await ApiService.clearToken();
        _token = null;
      }
    }
    _loading = false;
    notifyListeners();
  }

  Future<String?> login(String email, String password) async {
    final (data, status) = await ApiService.post('/auth/login',
        body: {'email': email, 'password': password}, sendToken: false);
    if (status == 200 && data is Map<String, dynamic>) {
      _token = data['token'];
      _email = data['user']['email'];
      _name = data['user']['name'];
      await ApiService.saveToken(_token!);
      notifyListeners();
      return null;
    }
    return data is Map ? data['error'] ?? 'Login failed' : 'Login failed';
  }

  Future<String?> register(String email, String password, String? name) async {
    final (data, status) = await ApiService.post('/auth/register',
        body: {'email': email, 'password': password, if (name != null) 'name': name}, sendToken: false);
    if (status == 201 && data is Map<String, dynamic>) {
      _token = data['token'];
      _email = data['user']['email'];
      _name = data['user']['name'];
      await ApiService.saveToken(_token!);
      notifyListeners();
      return null;
    }
    return data is Map ? data['error'] ?? 'Registration failed' : 'Registration failed';
  }

  Future<void> logout() async {
    await ApiService.clearToken();
    _token = null;
    _email = null;
    _name = null;
    notifyListeners();
  }
}
