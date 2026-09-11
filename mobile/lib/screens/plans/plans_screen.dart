import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

const _billingCycles = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'];

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  List<dynamic> _plans = [];
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
      final (data, status) = await ApiService.get('/plans');
      if (status == 200 && data is List) {
        _plans = data;
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
        title: const Text('Delete plan?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/plans/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Plan deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? plan]) {
    final isEdit = plan != null;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PlanForm(
        plan: plan,
        onSubmit: (body) async {
          final (data, status) = isEdit
              ? await ApiService.put('/plans/${plan['id']}', body: body)
              : await ApiService.post('/plans', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(isEdit ? 'Plan updated' : 'Plan added')),
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
    if (_plans.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.layers_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No plans yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('Add plan'),
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
          itemCount: _plans.length,
          itemBuilder: (_, i) {
            final p = _plans[i] as Map<String, dynamic>;
            final active = p['isActive'] == true;
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: active ? Colors.indigo : Colors.grey,
                  child: const Icon(Icons.layers, color: Colors.white),
                ),
                title: Text(p['name'] ?? ''),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(formatCurrency(p['price']),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 12),
                        Text(titleCase(p['billingCycle'] ?? ''),
                            style: const TextStyle(fontSize: 12)),
                        const SizedBox(width: 12),
                        Text('${p['durationDays'] ?? 0} days',
                            style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                    Text(active ? 'Active' : 'Inactive',
                        style: TextStyle(fontSize: 12, color: active ? Colors.green : Colors.grey)),
                  ],
                ),
                isThreeLine: true,
                onTap: () => _openForm(p),
                onLongPress: () => _delete(p['id']),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PlanForm extends StatefulWidget {
  final Map<String, dynamic>? plan;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _PlanForm({this.plan, required this.onSubmit});

  @override
  State<_PlanForm> createState() => _PlanFormState();
}

class _PlanFormState extends State<_PlanForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.plan?['name'] ?? '');
  late final _desc = TextEditingController(text: widget.plan?['description'] ?? '');
  late final _price = TextEditingController(
      text: widget.plan?['price'] != null ? numParse(widget.plan!['price']).toString() : '');
  late final _duration = TextEditingController(
      text: widget.plan?['durationDays']?.toString() ?? '30');
  late String _billingCycle = widget.plan?['billingCycle'] ?? 'MONTHLY';
  late bool _isActive = widget.plan?['isActive'] ?? true;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _price.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final error = await widget.onSubmit({
      'name': _name.text.trim(),
      if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
      'price': numParse(_price.text.isEmpty ? '0' : _price.text),
      'billingCycle': _billingCycle,
      'durationDays': int.tryParse(_duration.text) ?? 30,
      'isActive': _isActive,
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
    final isEdit = widget.plan != null;
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
              Text(isEdit ? 'Edit plan' : 'Add plan',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _desc,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _price,
                decoration: const InputDecoration(labelText: 'Price *', border: OutlineInputBorder(), prefixText: '₹'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) => v == null || numParse(v) < 0 ? 'Enter a valid price' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _billingCycle,
                decoration: const InputDecoration(labelText: 'Billing cycle', border: OutlineInputBorder()),
                items: _billingCycles
                    .map((c) => DropdownMenuItem(value: c, child: Text(titleCase(c))))
                    .toList(),
                onChanged: (v) => setState(() => _billingCycle = v ?? 'MONTHLY'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _duration,
                decoration: const InputDecoration(labelText: 'Duration (days) *', border: OutlineInputBorder()),
                keyboardType: TextInputType.number,
                validator: (v) => v == null || int.tryParse(v) == null || int.parse(v) < 1 ? 'Min 1' : null,
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Active'),
                value: _isActive,
                onChanged: (v) => setState(() => _isActive = v),
              ),
              const SizedBox(height: 12),
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
