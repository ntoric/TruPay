import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

const _alertTypes = ['REMINDER', 'ALERT', 'NOTIFICATION'];
const _triggerTypes = [
  'BEFORE_RENEWAL', 'ON_RENEWAL', 'AFTER_RENEWAL', 'PAYMENT_DUE',
  'PAYMENT_OVERDUE', 'SUBSCRIPTION_EXPIRED', 'INVOICE_CREATED',
  'INVOICE_PAID', 'CUSTOM',
];
const _channels = ['EMAIL', 'SMS', 'TELEGRAM'];

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<dynamic> _rules = [];
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
      final (data, status) = await ApiService.get('/alerts');
      if (status == 200 && data is List) {
        _rules = data;
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
        title: const Text('Delete alert rule?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/alerts/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Rule deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? rule]) {
    final isEdit = rule != null;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AlertForm(
        rule: rule,
        onSubmit: (body) async {
          final (data, status) = isEdit
              ? await ApiService.put('/alerts/${rule['id']}', body: body)
              : await ApiService.post('/alerts', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(isEdit ? 'Rule updated' : 'Rule added')),
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
    if (_rules.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.notifications_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No alert rules', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('Add rule'),
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
          itemCount: _rules.length,
          itemBuilder: (_, i) {
            final r = _rules[i] as Map<String, dynamic>;
            final active = r['isActive'] == true;
            final channels = (r['channels'] as List?) ?? [];
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: active ? Colors.amber : Colors.grey,
                  child: Icon(active ? Icons.notifications_active : Icons.notifications_off, color: Colors.white),
                ),
                title: Text(r['name'] ?? ''),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${titleCase(r['type'] ?? '')} • ${titleCase(r['triggerType'] ?? '')}',
                        style: const TextStyle(fontSize: 12)),
                    if (channels.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        children: channels.map((c) => Chip(
                              label: Text(c.toString(),
                                  style: const TextStyle(fontSize: 10)),
                              padding: EdgeInsets.zero,
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                            )).toList(),
                      ),
                    Text(active ? 'Active' : 'Inactive',
                        style: TextStyle(fontSize: 12, color: active ? Colors.green : Colors.grey)),
                  ],
                ),
                isThreeLine: true,
                onTap: () => _openForm(r),
                onLongPress: () => _delete(r['id']),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AlertForm extends StatefulWidget {
  final Map<String, dynamic>? rule;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _AlertForm({this.rule, required this.onSubmit});

  @override
  State<_AlertForm> createState() => _AlertFormState();
}

class _AlertFormState extends State<_AlertForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.rule?['name'] ?? '');
  late final _subject = TextEditingController(text: widget.rule?['subjectTemplate'] ?? '');
  late final _message = TextEditingController(text: widget.rule?['messageTemplate'] ?? '');
  late final _daysOffset = TextEditingController(
      text: widget.rule?['daysOffset']?.toString() ?? '0');
  late String _type = widget.rule?['type'] ?? 'REMINDER';
  late String _triggerType = widget.rule?['triggerType'] ?? 'BEFORE_RENEWAL';
  late final Set<String> _selectedChannels = Set<String>.from(
      ((widget.rule?['channels'] as List?) ?? []).map((e) => e.toString()));
  late bool _isActive = widget.rule?['isActive'] ?? true;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _subject.dispose();
    _message.dispose();
    _daysOffset.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedChannels.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one channel'), backgroundColor: Colors.red),
      );
      return;
    }
    setState(() => _saving = true);
    final error = await widget.onSubmit({
      'name': _name.text.trim(),
      'type': _type,
      'triggerType': _triggerType,
      'daysOffset': int.tryParse(_daysOffset.text) ?? 0,
      'channels': _selectedChannels.toList(),
      if (_subject.text.trim().isNotEmpty) 'subjectTemplate': _subject.text.trim(),
      'messageTemplate': _message.text.trim(),
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
    final isEdit = widget.rule != null;
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
              Text(isEdit ? 'Edit alert rule' : 'Add alert rule',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _type,
                decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
                items: _alertTypes.map((t) => DropdownMenuItem(value: t, child: Text(titleCase(t)))).toList(),
                onChanged: (v) => setState(() => _type = v ?? 'REMINDER'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _triggerType,
                decoration: const InputDecoration(labelText: 'Trigger type', border: OutlineInputBorder()),
                items: _triggerTypes.map((t) => DropdownMenuItem(value: t, child: Text(titleCase(t)))).toList(),
                onChanged: (v) => setState(() => _triggerType = v ?? 'BEFORE_RENEWAL'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _daysOffset,
                decoration: const InputDecoration(labelText: 'Days offset', border: OutlineInputBorder()),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              const Text('Channels'),
              Wrap(
                spacing: 4,
                children: _channels.map((c) {
                  return FilterChip(
                    label: Text(c),
                    selected: _selectedChannels.contains(c),
                    onSelected: (sel) => setState(() {
                      if (sel) {
                        _selectedChannels.add(c);
                      } else {
                        _selectedChannels.remove(c);
                      }
                    }),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _subject,
                decoration: const InputDecoration(labelText: 'Subject template', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _message,
                decoration: const InputDecoration(labelText: 'Message template *', border: OutlineInputBorder()),
                maxLines: 3,
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
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
