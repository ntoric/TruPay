import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../utils/formatters.dart';

const _currencies = ['INR', 'USD', 'EUR', 'GBP'];
const _smsProviders = ['none', 'twilio', 'vonage'];

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _loading = true;
  bool _saving = false;
  bool _exporting = false;
  String? _error;

  // Company
  final _companyName = TextEditingController();
  final _companyEmail = TextEditingController();
  final _companyPhone = TextEditingController();
  final _companyAddress = TextEditingController();
  String _currency = 'INR';
  final _timezone = TextEditingController();

  // SMTP
  final _smtpHost = TextEditingController();
  final _smtpPort = TextEditingController();
  final _smtpUser = TextEditingController();
  final _smtpPass = TextEditingController();
  final _smtpFrom = TextEditingController();
  bool _smtpSecure = false;

  // SMS
  String _smsProvider = 'none';
  final _twilioSid = TextEditingController();
  final _twilioToken = TextEditingController();
  final _twilioFrom = TextEditingController();
  final _vonageKey = TextEditingController();
  final _vonageSecret = TextEditingController();
  final _vonageFrom = TextEditingController();

  // Telegram
  final _telegramToken = TextEditingController();

  // Cashfree
  final _cashfreeAppId = TextEditingController();
  final _cashfreeSecretKey = TextEditingController();
  final _cashfreeWebhookSecret = TextEditingController();
  String _cashfreeEnvironment = 'sandbox';
  bool _cashfreeEnabled = false;

  // Toggles
  bool _emailEnabled = false;
  bool _smsEnabled = false;
  bool _telegramEnabled = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _companyName.dispose();
    _companyEmail.dispose();
    _companyPhone.dispose();
    _companyAddress.dispose();
    _timezone.dispose();
    _smtpHost.dispose();
    _smtpPort.dispose();
    _smtpUser.dispose();
    _smtpPass.dispose();
    _smtpFrom.dispose();
    _twilioSid.dispose();
    _twilioToken.dispose();
    _twilioFrom.dispose();
    _vonageKey.dispose();
    _vonageSecret.dispose();
    _vonageFrom.dispose();
    _telegramToken.dispose();
    _cashfreeAppId.dispose();
    _cashfreeSecretKey.dispose();
    _cashfreeWebhookSecret.dispose();
    super.dispose();
  }

  void _fill(Map<String, dynamic> s) {
    _companyName.text = s['companyName'] ?? '';
    _companyEmail.text = s['companyEmail'] ?? '';
    _companyPhone.text = s['companyPhone'] ?? '';
    _companyAddress.text = s['companyAddress'] ?? '';
    _currency = s['currency'] ?? 'INR';
    _timezone.text = s['timezone'] ?? '';
    _smtpHost.text = s['smtpHost'] ?? '';
    _smtpPort.text = s['smtpPort']?.toString() ?? '';
    _smtpUser.text = s['smtpUser'] ?? '';
    _smtpPass.text = s['smtpPass'] ?? '';
    _smtpFrom.text = s['smtpFrom'] ?? '';
    _smtpSecure = s['smtpSecure'] == true;
    _smsProvider = s['smsProvider'] ?? 'none';
    _twilioSid.text = s['twilioAccountSid'] ?? '';
    _twilioToken.text = s['twilioAuthToken'] ?? '';
    _twilioFrom.text = s['twilioFromNumber'] ?? '';
    _vonageKey.text = s['vonageApiKey'] ?? '';
    _vonageSecret.text = s['vonageApiSecret'] ?? '';
    _vonageFrom.text = s['vonageFromNumber'] ?? '';
    _telegramToken.text = s['telegramBotToken'] ?? '';
    _cashfreeAppId.text = s['cashfreeAppId'] ?? '';
    _cashfreeSecretKey.text = s['cashfreeSecretKey'] ?? '';
    _cashfreeWebhookSecret.text = s['cashfreeWebhookSecret'] ?? '';
    _cashfreeEnvironment = s['cashfreeEnvironment'] ?? 'sandbox';
    _cashfreeEnabled = s['cashfreeEnabled'] == true;
    _emailEnabled = s['emailEnabled'] == true;
    _smsEnabled = s['smsEnabled'] == true;
    _telegramEnabled = s['telegramEnabled'] == true;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (data, status) = await ApiService.get('/settings');
      if (status == 200 && data is Map<String, dynamic>) {
        _fill(data);
      } else {
        _error = data is Map ? data['error'] ?? 'Failed to load' : 'Failed to load';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }
    setState(() => _loading = false);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'companyName': _companyName.text.trim().isEmpty ? null : _companyName.text.trim(),
      'companyEmail': _companyEmail.text.trim().isEmpty ? null : _companyEmail.text.trim(),
      'companyPhone': _companyPhone.text.trim().isEmpty ? null : _companyPhone.text.trim(),
      'companyAddress': _companyAddress.text.trim().isEmpty ? null : _companyAddress.text.trim(),
      'currency': _currency,
      'timezone': _timezone.text.trim(),
      'smtpHost': _smtpHost.text.trim().isEmpty ? null : _smtpHost.text.trim(),
      'smtpPort': _smtpPort.text.trim().isEmpty ? null : int.tryParse(_smtpPort.text),
      'smtpUser': _smtpUser.text.trim().isEmpty ? null : _smtpUser.text.trim(),
      'smtpPass': _smtpPass.text.trim().isEmpty ? null : _smtpPass.text.trim(),
      'smtpFrom': _smtpFrom.text.trim().isEmpty ? null : _smtpFrom.text.trim(),
      'smtpSecure': _smtpSecure,
      'smsProvider': _smsProvider,
      'twilioAccountSid': _twilioSid.text.trim().isEmpty ? null : _twilioSid.text.trim(),
      'twilioAuthToken': _twilioToken.text.trim().isEmpty ? null : _twilioToken.text.trim(),
      'twilioFromNumber': _twilioFrom.text.trim().isEmpty ? null : _twilioFrom.text.trim(),
      'vonageApiKey': _vonageKey.text.trim().isEmpty ? null : _vonageKey.text.trim(),
      'vonageApiSecret': _vonageSecret.text.trim().isEmpty ? null : _vonageSecret.text.trim(),
      'vonageFromNumber': _vonageFrom.text.trim().isEmpty ? null : _vonageFrom.text.trim(),
      'telegramBotToken': _telegramToken.text.trim().isEmpty ? null : _telegramToken.text.trim(),
      'cashfreeEnabled': _cashfreeEnabled,
      'cashfreeAppId': _cashfreeAppId.text.trim().isEmpty ? null : _cashfreeAppId.text.trim(),
      'cashfreeSecretKey': _cashfreeSecretKey.text.trim().isEmpty ? null : _cashfreeSecretKey.text.trim(),
      'cashfreeEnvironment': _cashfreeEnvironment,
      'cashfreeWebhookSecret': _cashfreeWebhookSecret.text.trim().isEmpty ? null : _cashfreeWebhookSecret.text.trim(),
      'emailEnabled': _emailEnabled,
      'smsEnabled': _smsEnabled,
      'telegramEnabled': _telegramEnabled,
    };
    final (data, status) = await ApiService.put('/settings', body: body);
    setState(() => _saving = false);
    if (status == 200) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Settings saved')));
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data is Map ? data['error'] ?? 'Save failed' : 'Save failed'),
          backgroundColor: Colors.red,
        ));
      }
    }
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final res = await ApiService.downloadZip('/export');
      if (res.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Export ready (${res.bodyBytes.length} bytes)')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Export failed (${res.statusCode})'),
            backgroundColor: Colors.red,
          ));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export error: $e'), backgroundColor: Colors.red),
        );
      }
    }
    setState(() => _exporting = false);
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will be returned to the login screen.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Company section
          _sectionTitle('Company'),
          TextFormField(
            controller: _companyName,
            decoration: const InputDecoration(labelText: 'Company name', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _companyEmail,
            decoration: const InputDecoration(labelText: 'Company email', border: OutlineInputBorder()),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _companyPhone,
            decoration: const InputDecoration(labelText: 'Company phone', border: OutlineInputBorder()),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _companyAddress,
            decoration: const InputDecoration(labelText: 'Company address', border: OutlineInputBorder()),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _currency,
            decoration: const InputDecoration(labelText: 'Currency', border: OutlineInputBorder()),
            items: _currencies.map((c) => DropdownMenuItem(value: c, child: Text('$c (${currencySymbol(c)})'))).toList(),
            onChanged: (v) => setState(() => _currency = v ?? 'INR'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _timezone,
            decoration: const InputDecoration(labelText: 'Timezone', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 24),

          // SMTP section
          _sectionTitle('Email (SMTP)'),
          TextFormField(
            controller: _smtpHost,
            decoration: const InputDecoration(labelText: 'SMTP host', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _smtpPort,
            decoration: const InputDecoration(labelText: 'SMTP port', border: OutlineInputBorder()),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _smtpUser,
            decoration: const InputDecoration(labelText: 'SMTP user', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _smtpPass,
            decoration: const InputDecoration(labelText: 'SMTP password', border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _smtpFrom,
            decoration: const InputDecoration(labelText: 'From email', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            title: const Text('Use secure (TLS)'),
            value: _smtpSecure,
            onChanged: (v) => setState(() => _smtpSecure = v),
          ),
          const SizedBox(height: 24),

          // SMS section
          _sectionTitle('SMS'),
          DropdownButtonFormField<String>(
            value: _smsProvider,
            decoration: const InputDecoration(labelText: 'SMS provider', border: OutlineInputBorder()),
            items: _smsProviders.map((p) => DropdownMenuItem(value: p, child: Text(titleCase(p)))).toList(),
            onChanged: (v) => setState(() => _smsProvider = v ?? 'none'),
          ),
          if (_smsProvider == 'twilio') ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: _twilioSid,
              decoration: const InputDecoration(labelText: 'Twilio Account SID', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _twilioToken,
              decoration: const InputDecoration(labelText: 'Twilio Auth Token', border: OutlineInputBorder()),
              obscureText: true,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _twilioFrom,
              decoration: const InputDecoration(labelText: 'Twilio From number', border: OutlineInputBorder()),
            ),
          ],
          if (_smsProvider == 'vonage') ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: _vonageKey,
              decoration: const InputDecoration(labelText: 'Vonage API Key', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _vonageSecret,
              decoration: const InputDecoration(labelText: 'Vonage API Secret', border: OutlineInputBorder()),
              obscureText: true,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _vonageFrom,
              decoration: const InputDecoration(labelText: 'Vonage From number', border: OutlineInputBorder()),
            ),
          ],
          const SizedBox(height: 24),

          // Telegram section
          _sectionTitle('Telegram'),
          TextFormField(
            controller: _telegramToken,
            decoration: const InputDecoration(labelText: 'Telegram bot token', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 24),

          // Cashfree section
          _sectionTitle('Cashfree Payments'),
          SwitchListTile(
            title: const Text('Enable Cashfree'),
            value: _cashfreeEnabled,
            onChanged: (v) => setState(() => _cashfreeEnabled = v),
          ),
          TextFormField(
            controller: _cashfreeAppId,
            decoration: const InputDecoration(labelText: 'App ID (Client ID)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _cashfreeSecretKey,
            decoration: const InputDecoration(labelText: 'Secret Key (Client Secret)', border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _cashfreeEnvironment,
            decoration: const InputDecoration(labelText: 'Environment', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'sandbox', child: Text('Sandbox (Test)')),
              DropdownMenuItem(value: 'production', child: Text('Production (Live)')),
            ],
            onChanged: (v) => setState(() => _cashfreeEnvironment = v ?? 'sandbox'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _cashfreeWebhookSecret,
            decoration: const InputDecoration(labelText: 'Webhook Secret', border: OutlineInputBorder()),
            obscureText: true,
          ),
          const SizedBox(height: 24),

          // Master toggles
          _sectionTitle('Notifications'),
          SwitchListTile(
            title: const Text('Email notifications'),
            value: _emailEnabled,
            onChanged: (v) => setState(() => _emailEnabled = v),
          ),
          SwitchListTile(
            title: const Text('SMS notifications'),
            value: _smsEnabled,
            onChanged: (v) => setState(() => _smsEnabled = v),
          ),
          SwitchListTile(
            title: const Text('Telegram notifications'),
            value: _telegramEnabled,
            onChanged: (v) => setState(() => _telegramEnabled = v),
          ),
          const SizedBox(height: 24),

          // Actions
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Save settings'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _exporting ? null : _export,
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.download),
            label: const Text('Export data'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text('Sign out', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
    );
  }
}
