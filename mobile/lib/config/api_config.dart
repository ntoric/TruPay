class ApiConfig {
  // For Android emulator, use 10.0.2.2 to reach host localhost.
  // For physical device, set this to your computer's LAN IP or tunnel URL.
  static const String baseUrl = 'http://10.0.2.2:6001';
  static const String apiPrefix = '/api/mobile';
  static String get apiUrl => '$baseUrl$apiPrefix';
}
