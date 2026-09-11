import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  List<dynamic> _customers = [];
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
      final (data, status) = await ApiService.get('/customers');
      if (status == 200 && data is List) {
        _customers = data;
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
        title: const Text('Delete customer?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/customers/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? customer]) {
    final isEdit = customer != null;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CustomerForm(
        customer: customer,
        onSubmit: (body) async {
          final (data, status) = isEdit
              ? await ApiService.put('/customers/${customer['id']}', body: body)
              : await ApiService.post('/customers', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(isEdit ? 'Customer updated' : 'Customer added')),
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
    if (_customers.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.people_outline, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No customers yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('Add customer'),
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
          itemCount: _customers.length,
          itemBuilder: (_, i) {
            final c = _customers[i] as Map<String, dynamic>;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: CircleAvatar(
                  child: Text((c['name'] ?? '?')[0].toUpperCase()),
                ),
                title: Text(c['name'] ?? ''),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (c['email'] != null && c['email'].toString().isNotEmpty)
                      Text(c['email'], style: const TextStyle(fontSize: 12)),
                    if (c['phone'] != null && c['phone'].toString().isNotEmpty)
                      Text(c['phone'], style: const TextStyle(fontSize: 12)),
                    if (c['company'] != null && c['company'].toString().isNotEmpty)
                      Text(c['company'], style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                isThreeLine: true,
                onTap: () => _openForm(c),
                onLongPress: () => _delete(c['id']),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CustomerForm extends StatefulWidget {
  final Map<String, dynamic>? customer;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _CustomerForm({this.customer, required this.onSubmit});

  @override
  State<_CustomerForm> createState() => _CustomerFormState();
}

class _CustomerFormState extends State<_CustomerForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.customer?['name'] ?? '');
  late final _email = TextEditingController(text: widget.customer?['email'] ?? '');
  late final _phone = TextEditingController(text: widget.customer?['phone'] ?? '');
  late final _company = TextEditingController(text: widget.customer?['company'] ?? '');
  late final _address = TextEditingController(text: widget.customer?['address'] ?? '');
  late final _telegram = TextEditingController(text: widget.customer?['telegramChatId'] ?? '');
  late final _notes = TextEditingController(text: widget.customer?['notes'] ?? '');
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _company.dispose();
    _address.dispose();
    _telegram.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final error = await widget.onSubmit({
      'name': _name.text.trim(),
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      if (_company.text.trim().isNotEmpty) 'company': _company.text.trim(),
      if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
      if (_telegram.text.trim().isNotEmpty) 'telegramChatId': _telegram.text.trim(),
      if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
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
    final isEdit = widget.customer != null;
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
              Text(isEdit ? 'Edit customer' : 'Add customer',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _company,
                decoration: const InputDecoration(labelText: 'Company', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _address,
                decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _telegram,
                decoration: const InputDecoration(labelText: 'Telegram Chat ID', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notes,
                decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()),
                maxLines: 3,
              ),
              const SizedBox(height: 20),
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
