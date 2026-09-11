import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

const _subStatuses = ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED', 'PAST_DUE', 'TRIALING'];

class SubscriptionsScreen extends StatefulWidget {
  const SubscriptionsScreen({super.key});

  @override
  State<SubscriptionsScreen> createState() => _SubscriptionsScreenState();
}

class _SubscriptionsScreenState extends State<SubscriptionsScreen> {
  List<dynamic> _subs = [];
  List<dynamic> _products = [];
  bool _loading = true;
  String? _error;
  String? _filterProduct;
  String? _filterStatus;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _load();
  }

  Future<void> _loadProducts() async {
    final (data, status) = await ApiService.get('/products');
    if (status == 200 && data is List) {
      _products = data;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final query = <String, dynamic>{};
      if (_filterProduct != null) query['productId'] = _filterProduct;
      if (_filterStatus != null) query['status'] = _filterStatus;
      final (data, status) = await ApiService.get('/subscriptions', query: query.isEmpty ? null : query);
      if (status == 200 && data is List) {
        _subs = data;
      } else {
        _error = data is Map ? data['error'] ?? 'Failed to load' : 'Failed to load';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }
    setState(() => _loading = false);
  }

  Future<void> _delete(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete subscription?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/subscriptions/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Subscription deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? sub]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SubscriptionForm(
        subscription: sub,
        onSubmit: (body) async {
          final (data, status) = sub == null
              ? await ApiService.post('/subscriptions', body: body)
              : await ApiService.put('/subscriptions/${sub['id']}', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(sub == null ? 'Subscription added' : 'Subscription updated')),
              );
            }
            _load();
            return null;
          }
          return data is Map ? data['error'] ?? 'Failed' : 'Failed';
        },
      ),
    );
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
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _filterProduct,
                    decoration: const InputDecoration(
                      labelText: 'Product',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All products')),
                      ..._products.map((p) => DropdownMenuItem(
                            value: p['id'] as String,
                            child: Text(p['name'] ?? ''),
                          )),
                    ],
                    onChanged: (v) {
                      setState(() => _filterProduct = v);
                      _load();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _filterStatus,
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All')),
                      ..._subStatuses.map((s) =>
                          DropdownMenuItem(value: s, child: Text(titleCase(s)))),
                    ],
                    onChanged: (v) {
                      setState(() => _filterStatus = v);
                      _load();
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _subs.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.credit_card_outlined, size: 64, color: Colors.grey),
                        const SizedBox(height: 16),
                        Text('No subscriptions', style: Theme.of(context).textTheme.titleMedium),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.builder(
                      itemCount: _subs.length,
                      itemBuilder: (_, i) {
                        final s = _subs[i] as Map<String, dynamic>;
                        final customer = s['customer'] as Map<String, dynamic>?;
                        final plan = s['plan'] as Map<String, dynamic>?;
                        final product = s['product'] as Map<String, dynamic>?;
                        return Card(
                          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          child: ListTile(
                            title: Text(customer?['name'] ?? ''),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(plan?['name'] ?? '', style: const TextStyle(fontSize: 12)),
                                    const SizedBox(width: 8),
                                    if (product != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.indigo,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(product['name'] ?? '',
                                            style: const TextStyle(color: Colors.white, fontSize: 10)),
                                      ),
                                  ],
                                ),
                                Text(
                                  '${formatDate(s['startDate'])} - ${formatDate(s['endDate'])}',
                                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                                Row(
                                  children: [
                                    Text(formatCurrency(s['price']),
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                    const SizedBox(width: 8),
                                    statusBadge(s['status']),
                                  ],
                                ),
                              ],
                            ),
                            isThreeLine: true,
                            onTap: () => _openForm(s),
                            onLongPress: () => _delete(s['id']),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _SubscriptionForm extends StatefulWidget {
  final Map<String, dynamic>? subscription;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _SubscriptionForm({this.subscription, required this.onSubmit});

  @override
  State<_SubscriptionForm> createState() => _SubscriptionFormState();
}

class _SubscriptionFormState extends State<_SubscriptionForm> {
  final _formKey = GlobalKey<FormState>();
  final _priceCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  List<dynamic> _customers = [];
  List<dynamic> _plans = [];
  List<dynamic> _products = [];
  String? _customerId;
  String? _planId;
  String? _productId;
  String _status = 'ACTIVE';
  DateTime _startDate = DateTime.now();
  bool _autoRenew = false;
  bool _createInvoice = false;
  bool _saving = false;
  bool _loadingOpts = true;

  @override
  void initState() {
    super.initState();
    final s = widget.subscription;
    if (s != null) {
      _customerId = s['customerId'];
      _planId = s['planId'];
      _productId = s['productId'];
      _status = s['status'] ?? 'ACTIVE';
      if (s['startDate'] != null) {
        _startDate = DateTime.tryParse(s['startDate'].toString()) ?? DateTime.now();
      }
      _autoRenew = s['autoRenew'] == true;
      _priceCtrl.text = s['price'] != null ? numParse(s['price']).toString() : '';
      _notesCtrl.text = s['notes'] ?? '';
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    final results = await Future.wait([
      ApiService.get('/customers'),
      ApiService.get('/plans'),
      ApiService.get('/products'),
    ]);
    final (cData, cStatus) = results[0];
    final (pData, pStatus) = results[1];
    final (prData, prStatus) = results[2];
    if (cStatus == 200 && cData is List) _customers = cData;
    if (pStatus == 200 && pData is List) _plans = pData;
    if (prStatus == 200 && prData is List) _products = prData;
    setState(() => _loadingOpts = false);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_customerId == null || _planId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select customer and plan'), backgroundColor: Colors.red),
      );
      return;
    }
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'customerId': _customerId,
      'planId': _planId,
      if (_productId != null) 'productId': _productId,
      'status': _status,
      'startDate': _startDate.toIso8601String(),
      if (_priceCtrl.text.isNotEmpty) 'price': numParse(_priceCtrl.text),
      'autoRenew': _autoRenew,
      if (_notesCtrl.text.trim().isNotEmpty) 'notes': _notesCtrl.text.trim(),
      if (widget.subscription == null) 'createInvoice': _createInvoice,
    };
    final error = await widget.onSubmit(body);
    if (mounted) {
      if (error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error), backgroundColor: Colors.red),
        );
      }
      setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.subscription != null;
    if (_loadingOpts) {
      return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    }
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(isEdit ? 'Edit subscription' : 'Add subscription',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _customerId,
                decoration: const InputDecoration(labelText: 'Customer *', border: OutlineInputBorder()),
                items: _customers
                    .map((c) => DropdownMenuItem(value: c['id'] as String, child: Text(c['name'] ?? '')))
                    .toList(),
                onChanged: (v) => setState(() => _customerId = v),
                validator: (v) => v == null ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _planId,
                decoration: const InputDecoration(labelText: 'Plan *', border: OutlineInputBorder()),
                items: _plans
                    .map((p) => DropdownMenuItem(
                          value: p['id'] as String,
                          child: Text('${p['name']} (${formatCurrency(p['price'])})'),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _planId = v),
                validator: (v) => v == null ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _productId,
                decoration: const InputDecoration(labelText: 'Product', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ..._products.map((p) => DropdownMenuItem(value: p['id'] as String, child: Text(p['name'] ?? ''))),
                ],
                onChanged: (v) => setState(() => _productId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(labelText: 'Status', border: OutlineInputBorder()),
                items: _subStatuses.map((s) => DropdownMenuItem(value: s, child: Text(titleCase(s)))).toList(),
                onChanged: (v) => setState(() => _status = v ?? 'ACTIVE'),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: _pickDate,
                child: InputDecorator(
                  decoration: const InputDecoration(labelText: 'Start date', border: OutlineInputBorder()),
                  child: Text(formatDate(_startDate.toIso8601String())),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _priceCtrl,
                decoration: const InputDecoration(labelText: 'Price (optional)', border: OutlineInputBorder(), prefixText: '₹'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Auto renew'),
                value: _autoRenew,
                onChanged: (v) => setState(() => _autoRenew = v),
              ),
              if (!isEdit)
                CheckboxListTile(
                  title: const Text('Create invoice'),
                  value: _createInvoice,
                  onChanged: (v) => setState(() => _createInvoice = v ?? false),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notesCtrl,
                decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save' : 'Add'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
