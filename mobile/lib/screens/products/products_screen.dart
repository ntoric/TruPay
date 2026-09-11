import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  List<dynamic> _products = [];
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
      final (data, status) = await ApiService.get('/products');
      if (status == 200 && data is List) {
        _products = data;
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
        title: const Text('Delete product?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    final (data, status) = await ApiService.delete('/products/$id');
    if (!mounted) return;
    if (status == 200) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product deleted')));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data is Map ? data['error'] ?? 'Delete failed' : 'Delete failed'),
        backgroundColor: Colors.red,
      ));
    }
  }

  void _openForm([Map<String, dynamic>? product]) {
    final isEdit = product != null;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ProductForm(
        product: product,
        onSubmit: (body) async {
          final (data, status) = isEdit
              ? await ApiService.put('/products/${product['id']}', body: body)
              : await ApiService.post('/products', body: body);
          if (status == 200 || status == 201) {
            if (mounted) Navigator.pop(context);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(isEdit ? 'Product updated' : 'Product added')),
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
    if (_products.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('No products yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('Add product'),
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
          itemCount: _products.length,
          itemBuilder: (_, i) {
            final p = _products[i] as Map<String, dynamic>;
            final active = p['isActive'] == true;
            final subCount = p['_count']?['subscriptions'] ?? p['subscriptionCount'];
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: active ? Colors.green : Colors.grey,
                  child: Icon(active ? Icons.check : Icons.block, color: Colors.white),
                ),
                title: Text(p['name'] ?? ''),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (p['sku'] != null && p['sku'].toString().isNotEmpty)
                      Text('SKU: ${p['sku']}', style: const TextStyle(fontSize: 12)),
                    if (p['category'] != null && p['category'].toString().isNotEmpty)
                      Text('Category: ${p['category']}', style: const TextStyle(fontSize: 12)),
                    Row(
                      children: [
                        Text(formatCurrency(p['price']),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 12),
                        if (subCount != null) Text('$subCount subs', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        const SizedBox(width: 12),
                        Text(active ? 'Active' : 'Inactive',
                            style: TextStyle(fontSize: 12, color: active ? Colors.green : Colors.grey)),
                      ],
                    ),
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

class _ProductForm extends StatefulWidget {
  final Map<String, dynamic>? product;
  final Future<String?> Function(Map<String, dynamic> body) onSubmit;

  const _ProductForm({this.product, required this.onSubmit});

  @override
  State<_ProductForm> createState() => _ProductFormState();
}

class _ProductFormState extends State<_ProductForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.product?['name'] ?? '');
  late final _desc = TextEditingController(text: widget.product?['description'] ?? '');
  late final _sku = TextEditingController(text: widget.product?['sku'] ?? '');
  late final _category = TextEditingController(text: widget.product?['category'] ?? '');
  late final _price = TextEditingController(
      text: widget.product?['price'] != null ? numParse(widget.product!['price']).toString() : '');
  late bool _isActive = widget.product?['isActive'] ?? true;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _sku.dispose();
    _category.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final error = await widget.onSubmit({
      'name': _name.text.trim(),
      if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
      if (_sku.text.trim().isNotEmpty) 'sku': _sku.text.trim(),
      if (_category.text.trim().isNotEmpty) 'category': _category.text.trim(),
      'price': numParse(_price.text.isEmpty ? '0' : _price.text),
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
    final isEdit = widget.product != null;
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
              Text(isEdit ? 'Edit product' : 'Add product',
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
                controller: _sku,
                decoration: const InputDecoration(labelText: 'SKU', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _category,
                decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _price,
                decoration: const InputDecoration(labelText: 'Price *', border: OutlineInputBorder(), prefixText: '₹'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) => v == null || numParse(v) < 0 ? 'Enter a valid price' : null,
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
