import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

const _invoiceStatuses = ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'];
const _paymentMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE', 'OTHER'];

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  List<dynamic> _invoices = [];
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
      final (data, status) = await ApiService.get('/invoices');
      if (status == 200 && data is List) {
        _invoices = data;
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
        title: const Text('Delete invoice?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/invoices/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invoice deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? invoice]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _InvoiceForm(
        invoice: invoice,
        onSubmit: (body) async {
          final (data, status) = invoice == null
              ? await ApiService.post('/invoices', body: body)
              : await ApiService.put('/invoices/${invoice['id']}', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(invoice == null ? 'Invoice created' : 'Invoice updated')),
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

  void _openDetail(Map<String, dynamic> invoice) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _InvoiceDetailScreen(invoiceId: invoice['id'])),
    ).then((_) => _load());
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
    if (_invoices.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No invoices yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('Add invoice'),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          itemCount: _invoices.length,
          itemBuilder: (_, i) {
            final inv = _invoices[i] as Map<String, dynamic>;
            final customer = inv['customer'] as Map<String, dynamic>?;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                title: Text(inv['invoiceNumber'] ?? ''),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(customer?['name'] ?? '', style: const TextStyle(fontSize: 12)),
                    Text(
                      'Issued ${formatDate(inv['issueDate'])} • Due ${formatDate(inv['dueDate'])}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(formatCurrency(inv['total'], inv['currency'] ?? 'INR'),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    statusBadge(inv['status']),
                  ],
                ),
                isThreeLine: true,
                onTap: () => _openDetail(inv),
                onLongPress: () => _delete(inv['id']),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _InvoiceForm extends StatefulWidget {
  final Map<String, dynamic>? invoice;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _InvoiceForm({this.invoice, required this.onSubmit});

  @override
  State<_InvoiceForm> createState() => _InvoiceFormState();
}

class _InvoiceFormState extends State<_InvoiceForm> {
  final _formKey = GlobalKey<FormState>();
  final _notesCtrl = TextEditingController();
  final _subtotalCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController();
  final _discountCtrl = TextEditingController();
  List<dynamic> _customers = [];
  List<dynamic> _subscriptions = [];
  String? _customerId;
  String? _subscriptionId;
  String _status = 'DRAFT';
  DateTime _issueDate = DateTime.now();
  DateTime _dueDate = DateTime.now().add(const Duration(days: 30));
  final List<Map<String, TextEditingController>> _items = [];
  bool _saving = false;
  bool _loadingOpts = true;

  @override
  void initState() {
    super.initState();
    final inv = widget.invoice;
    if (inv != null) {
      _customerId = inv['customerId'];
      _subscriptionId = inv['subscriptionId'];
      _status = inv['status'] ?? 'DRAFT';
      if (inv['issueDate'] != null) _issueDate = DateTime.tryParse(inv['issueDate'].toString()) ?? _issueDate;
      if (inv['dueDate'] != null) _dueDate = DateTime.tryParse(inv['dueDate'].toString()) ?? _dueDate;
      _subtotalCtrl.text = inv['subtotal']?.toString() ?? '';
      _taxRateCtrl.text = inv['taxRate']?.toString() ?? '';
      _discountCtrl.text = inv['discount']?.toString() ?? '';
      _notesCtrl.text = inv['notes'] ?? '';
      final items = inv['items'] as List? ?? [];
      for (final it in items) {
        _items.add({
          'description': TextEditingController(text: it['description'] ?? ''),
          'quantity': TextEditingController(text: it['quantity']?.toString() ?? '1'),
          'unitPrice': TextEditingController(text: it['unitPrice']?.toString() ?? ''),
          'total': TextEditingController(text: it['total']?.toString() ?? ''),
        });
      }
    }
    if (_items.isEmpty) {
      _addItem();
    }
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    final results = await Future.wait([
      ApiService.get('/customers'),
      ApiService.get('/subscriptions'),
    ]);
    final (cData, cStatus) = results[0];
    final (sData, sStatus) = results[1];
    if (cStatus == 200 && cData is List) _customers = cData;
    if (sStatus == 200 && sData is List) _subscriptions = sData;
    setState(() => _loadingOpts = false);
  }

  void _addItem() {
    setState(() {
      _items.add({
        'description': TextEditingController(),
        'quantity': TextEditingController(text: '1'),
        'unitPrice': TextEditingController(),
        'total': TextEditingController(),
      });
    });
  }

  void _removeItem(int i) {
    setState(() {
      for (final c in _items[i].values) {
        c.dispose();
      }
      _items.removeAt(i);
    });
  }

  void _recalcTotal(int i) {
    final qty = numParse(_items[i]['quantity']!.text);
    final price = numParse(_items[i]['unitPrice']!.text);
    _items[i]['total']!.text = (qty * price).toString();
  }

  Future<void> _pickDate(bool isIssue) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isIssue ? _issueDate : _dueDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => isIssue ? _issueDate = picked : _dueDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_customerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a customer'), backgroundColor: Colors.red),
      );
      return;
    }
    final items = _items
        .where((m) => m['description']!.text.trim().isNotEmpty)
        .map((m) => <String, dynamic>{
          'description': m['description']!.text.trim(),
          'quantity': numParse(m['quantity']!.text),
          'unitPrice': numParse(m['unitPrice']!.text),
          'total': numParse(m['total']!.text.isEmpty ? m['unitPrice']!.text : m['total']!.text),
        }).toList();
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one line item'), backgroundColor: Colors.red),
      );
      return;
    }
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'customerId': _customerId,
      if (_subscriptionId != null) 'subscriptionId': _subscriptionId,
      'issueDate': _issueDate.toIso8601String(),
      'dueDate': _dueDate.toIso8601String(),
      'status': _status,
      'subtotal': numParse(_subtotalCtrl.text.isEmpty ? _subtotalCtrl.text : _subtotalCtrl.text),
      'taxRate': numParse(_taxRateCtrl.text),
      'discount': numParse(_discountCtrl.text),
      'items': items,
      if (_notesCtrl.text.trim().isNotEmpty) 'notes': _notesCtrl.text.trim(),
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
    _notesCtrl.dispose();
    _subtotalCtrl.dispose();
    _taxRateCtrl.dispose();
    _discountCtrl.dispose();
    for (final m in _items) {
      for (final c in m.values) {
        c.dispose();
      }
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.invoice != null;
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
              Text(isEdit ? 'Edit invoice' : 'Add invoice',
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
                value: _subscriptionId,
                decoration: const InputDecoration(labelText: 'Subscription (optional)', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ..._subscriptions.map((s) {
                    final c = s['customer'] as Map<String, dynamic>?;
                    final p = s['plan'] as Map<String, dynamic>?;
                    return DropdownMenuItem(
                      value: s['id'] as String,
                      child: Text('${c?['name'] ?? ''} - ${p?['name'] ?? ''}'),
                    );
                  }),
                ],
                onChanged: (v) => setState(() => _subscriptionId = v),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(true),
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Issue date', border: OutlineInputBorder()),
                        child: Text(formatDate(_issueDate.toIso8601String())),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(false),
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Due date', border: OutlineInputBorder()),
                        child: Text(formatDate(_dueDate.toIso8601String())),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(labelText: 'Status', border: OutlineInputBorder()),
                items: _invoiceStatuses.map((s) => DropdownMenuItem(value: s, child: Text(titleCase(s)))).toList(),
                onChanged: (v) => setState(() => _status = v ?? 'DRAFT'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _subtotalCtrl,
                      decoration: const InputDecoration(labelText: 'Subtotal', border: OutlineInputBorder()),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      controller: _taxRateCtrl,
                      decoration: const InputDecoration(labelText: 'Tax %', border: OutlineInputBorder()),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      controller: _discountCtrl,
                      decoration: const InputDecoration(labelText: 'Discount', border: OutlineInputBorder()),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Line items', style: Theme.of(context).textTheme.titleMedium),
                  IconButton(onPressed: _addItem, icon: const Icon(Icons.add_circle)),
                ],
              ),
              ...List.generate(_items.length, (i) {
                final m = _items[i];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: m['description'],
                          decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder(), isDense: true),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: m['quantity'],
                                decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), isDense: true),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => _recalcTotal(i),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: m['unitPrice'],
                                decoration: const InputDecoration(labelText: 'Unit price', border: OutlineInputBorder(), isDense: true),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => _recalcTotal(i),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: m['total'],
                                decoration: const InputDecoration(labelText: 'Total', border: OutlineInputBorder(), isDense: true),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: _items.length > 1 ? () => _removeItem(i) : null,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
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
                    : Text(isEdit ? 'Save' : 'Create'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InvoiceDetailScreen extends StatefulWidget {
  final String invoiceId;
  const _InvoiceDetailScreen({required this.invoiceId});

  @override
  State<_InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<_InvoiceDetailScreen> {
  Map<String, dynamic>? _invoice;
  bool _loading = true;
  String? _error;
  bool _cashfreeEnabled = false;

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
      final results = await Future.wait([
        ApiService.get('/invoices/${widget.invoiceId}'),
        ApiService.get('/settings'),
      ]);
      final (invData, invStatus) = results[0];
      final (setData, setStatus) = results[1];
      if (invStatus == 200 && invData is Map<String, dynamic>) {
        _invoice = invData;
      } else {
        _error = invData is Map ? invData['error'] ?? 'Failed to load' : 'Failed to load';
      }
      if (setStatus == 200 && setData is Map<String, dynamic>) {
        _cashfreeEnabled = setData['cashfreeEnabled'] == true;
      }
    } catch (e) {
      _error = 'Network error: $e';
    }
    setState(() => _loading = false);
  }

  void _recordPayment() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentForm(
        onSubmit: (body) async {
          final (data, status) =
              await ApiService.post('/invoices/${widget.invoiceId}/payments', body: body);
          if (status == 201 || status == 200) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment recorded')));
            }
            _load();
            return null;
          }
          return data is Map ? data['error'] ?? 'Failed' : 'Failed';
        },
      ),
    );
  }

  bool _cashfreeLoading = false;

  Future<void> _payWithCashfree() async {
    final inv = _invoice;
    if (inv == null) return;
    final total = numParse(inv['total']);
    final payments = (inv['payments'] as List?) ?? [];
    final paid = payments
        .where((p) => p['status'] == 'COMPLETED')
        .fold<double>(0, (s, p) => s + numParse(p['amount']));
    final due = total - paid;
    if (due <= 0) return;

    setState(() => _cashfreeLoading = true);
    try {
      // 1. Create Cashfree order via mobile API
      final (orderData, orderStatus) = await ApiService.post(
        '/payments/cashfree/create-order',
        body: {'invoiceId': widget.invoiceId},
      );
      if (orderStatus != 200 || orderData is! Map<String, dynamic>) {
        final msg = orderData is Map ? orderData['error'] ?? 'Failed to create order' : 'Failed to create order';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: Colors.red),
          );
        }
        return;
      }

      final sessionId = orderData['paymentSessionId'] as String?;
      final orderId = orderData['orderId'] as String?;
      final env = orderData['orderCurrency'] != null ? 'sandbox' : 'sandbox';
      if (sessionId == null || orderId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invalid order response'), backgroundColor: Colors.red),
          );
        }
        return;
      }

      // 2. Open Cashfree checkout in browser
      final checkoutUrl = env == 'production'
          ? 'https://api.cashfree.com/pg/checkout?payment-session-id=$sessionId'
          : 'https://sandbox.cashfree.com/pg/checkout?payment-session-id=$sessionId';
      await launchUrl(Uri.parse(checkoutUrl), mode: LaunchMode.externalApplication);

      // 3. Show a dialog to verify payment after returning
      if (mounted) {
        final shouldVerify = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Payment Complete?'),
            content: const Text('If you completed the payment, tap Verify to confirm. Otherwise, tap Not Yet.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not Yet')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Verify')),
            ],
          ),
        );
        if (shouldVerify != true) return;

        // 4. Verify payment via mobile API
        final (verifyData, verifyStatus) = await ApiService.post(
          '/payments/cashfree/verify',
          body: {'orderId': orderId, 'invoiceId': widget.invoiceId},
        );
        if (verifyStatus == 200 && verifyData is Map<String, dynamic>) {
          if (verifyData['verified'] == true) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Payment verified successfully!')),
              );
            }
            _load();
          } else {
            final status = verifyData['paymentStatus'] ?? 'PENDING';
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Payment status: $status. It may take a moment to process.')),
              );
            }
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Verification failed. Please check the invoice later.')),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _cashfreeLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Invoice detail')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _invoice == null
                  ? const Center(child: Text('Invoice not found'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(_invoice!['invoiceNumber'] ?? '',
                                          style: Theme.of(context).textTheme.titleLarge),
                                      statusBadge(_invoice!['status']),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text('Customer: ${_invoice!['customer']?['name'] ?? ''}'),
                                  Text('Issued: ${formatDate(_invoice!['issueDate'])}'),
                                  Text('Due: ${formatDate(_invoice!['dueDate'])}'),
                                  const Divider(),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [const Text('Subtotal'), Text(formatCurrency(_invoice!['subtotal'], _invoice!['currency'] ?? 'INR'))],
                                  ),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [const Text('Tax'), Text(formatCurrency(_invoice!['taxAmount'], _invoice!['currency'] ?? 'INR'))],
                                  ),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [const Text('Discount'), Text(formatCurrency(_invoice!['discount'], _invoice!['currency'] ?? 'INR'))],
                                  ),
                                  const Divider(),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Total', style: TextStyle(fontWeight: FontWeight.bold)),
                                      Text(formatCurrency(_invoice!['total'], _invoice!['currency'] ?? 'INR'),
                                          style: const TextStyle(fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text('Line items', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          ...((_invoice!['items'] as List?) ?? []).map((it) => Card(
                                child: ListTile(
                                  title: Text(it['description'] ?? ''),
                                  subtitle: Text('${it['quantity']} x ${formatCurrency(it['unitPrice'], _invoice!['currency'] ?? 'INR')}'),
                                  trailing: Text(formatCurrency(it['total'], _invoice!['currency'] ?? 'INR'),
                                      style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              )),
                          const SizedBox(height: 16),
                          Text('Payments', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          if ((_invoice!['payments'] as List?)?.isEmpty ?? true)
                            const Card(child: ListTile(title: Text('No payments recorded'))),
                          ...((_invoice!['payments'] as List?) ?? []).map((p) => Card(
                                child: ListTile(
                                  title: Text(formatCurrency(p['amount'], _invoice!['currency'] ?? 'INR'),
                                      style: const TextStyle(fontWeight: FontWeight.bold)),
                                  subtitle: Text('${titleCase(p['method'] ?? '')} • ${formatDate(p['paidAt'])}'),
                                  trailing: statusBadge(p['status']),
                                ),
                              )),
                          const SizedBox(height: 24),
                          // Cashfree online payment button (only if enabled in settings)
                          if (_cashfreeEnabled)
                            Builder(builder: (_) {
                              final total = numParse(_invoice!['total']);
                              final payments = (_invoice!['payments'] as List?) ?? [];
                              final paid = payments
                                  .where((p) => p['status'] == 'COMPLETED')
                                  .fold<double>(0, (s, p) => s + numParse(p['amount']));
                              final due = total - paid;
                              final status = _invoice!['status'] as String?;
                              if (due <= 0 || status == 'CANCELLED' || status == 'PAID') {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: OutlinedButton.icon(
                                  onPressed: _cashfreeLoading ? null : _payWithCashfree,
                                  icon: _cashfreeLoading
                                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Icon(Icons.credit_card),
                                  label: Text(_cashfreeLoading
                                      ? 'Processing...'
                                      : 'Pay ${formatCurrency(due, _invoice!['currency'] ?? 'INR')} with Cashfree'),
                                ),
                              );
                            }),
                          FilledButton.icon(
                            onPressed: _recordPayment,
                            icon: const Icon(Icons.payments),
                            label: const Text('Record payment'),
                          ),
                        ],
                      ),
                    ),
    );
  }
}

class _PaymentForm extends StatefulWidget {
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;
  const _PaymentForm({required this.onSubmit});

  @override
  State<_PaymentForm> createState() => _PaymentFormState();
}

class _PaymentFormState extends State<_PaymentForm> {
  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _method = 'CASH';
  bool _saving = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final error = await widget.onSubmit({
      'amount': numParse(_amountCtrl.text),
      'method': _method,
      if (_notesCtrl.text.trim().isNotEmpty) 'notes': _notesCtrl.text.trim(),
    });
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
  Widget build(BuildContext context) {
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
              Text('Record payment', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _amountCtrl,
                decoration: const InputDecoration(labelText: 'Amount *', border: OutlineInputBorder(), prefixText: '₹'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) => v == null || numParse(v) <= 0 ? 'Enter amount' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _method,
                decoration: const InputDecoration(labelText: 'Method', border: OutlineInputBorder()),
                items: _paymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(titleCase(m)))).toList(),
                onChanged: (v) => setState(() => _method = v ?? 'CASH'),
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
                    : const Text('Record'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
