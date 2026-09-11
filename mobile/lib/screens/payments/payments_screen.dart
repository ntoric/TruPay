import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  List<dynamic> _payments = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (data, status) = await ApiService.get('/payments');
      if (status == 200 && data is List) {
        _payments = data;
      } else {
        _error = data is Map ? data['error'] ?? 'Failed to load' : 'Failed to load';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }
    setState(() => _loading = false);
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
    if (_payments.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.payments_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No payments yet', style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _payments.length,
        itemBuilder: (_, i) {
          final p = _payments[i] as Map<String, dynamic>;
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.payment)),
              title: Text(formatCurrency(p['amount']),
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Invoice: ${p['invoiceNumber'] ?? ''}', style: const TextStyle(fontSize: 12)),
                  Text('${titleCase(p['method'] ?? '')} • ${formatDate(p['paidAt'])}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              trailing: statusBadge(p['status']),
              isThreeLine: true,
            ),
          );
        },
      ),
    );
  }
}
