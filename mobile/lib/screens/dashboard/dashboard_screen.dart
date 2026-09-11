import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/api_service.dart';
import '../../widgets/stat_card.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final (data, status) = await ApiService.get('/dashboard');
      if (status == 200 && data is Map<String, dynamic>) {
        _data = data;
      } else {
        _error = data is Map ? data['error'] ?? 'Failed to load' : 'Failed to load';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }
    setState(() { _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(_error!, style: const TextStyle(color: Colors.red)), const SizedBox(height: 16), FilledButton(onPressed: _load, child: const Text('Retry'))]));
    if (_data == null) return const Center(child: Text('No data'));

    final d = _data!;
    final currency = d['currency'] ?? 'INR';
    final currencySymbol = _currencySymbol(currency);
    final monthlyRev = (d['monthlyRevenue'] as List?) ?? [];
    final statusBreakdown = (d['statusBreakdown'] as List?) ?? [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stat cards
          GridView.count(
            crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.5,
            children: [
              StatCard(title: 'Customers', value: '${d['totalCustomers'] ?? 0}', icon: Icons.people, color: Colors.blue),
              StatCard(title: 'Active Subs', value: '${d['activeSubscriptions'] ?? 0}', icon: Icons.credit_card, color: Colors.green),
              StatCard(title: 'MRR', value: '$currencySymbol${_fmtNum(d['mrr'])}', icon: Icons.trending_up, color: Colors.indigo),
              StatCard(title: 'Revenue', value: '$currencySymbol${_fmtNum(d['totalRevenue'])}', icon: Icons.payments, color: Colors.teal),
              StatCard(title: 'Overdue', value: '${d['overdueInvoices'] ?? 0}', icon: Icons.warning, color: Colors.orange),
              StatCard(title: 'Expiring', value: '${d['expiringSubs'] ?? 0}', icon: Icons.schedule, color: Colors.red),
            ],
          ),
          const SizedBox(height: 24),
          // Revenue chart
          if (monthlyRev.isNotEmpty) ...[
            Text('Monthly Revenue', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  gridData: const FlGridData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (val, _) {
                      final idx = val.toInt();
                      if (idx < 0 || idx >= monthlyRev.length) return const SizedBox();
                      return Padding(padding: const EdgeInsets.only(top: 4), child: Text(monthlyRev[idx]['month'] ?? '', style: const TextStyle(fontSize: 10)));
                    })),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: List.generate(monthlyRev.length, (i) => FlSpot(i.toDouble(), _num(monthlyRev[i]['revenue']))),
                      isCurved: true, color: Theme.of(context).colorScheme.primary, barWidth: 3, dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(show: true, color: Theme.of(context).colorScheme.primary.withOpacity(0.1)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
          // Status breakdown
          if (statusBreakdown.isNotEmpty) ...[
            Text('Subscription Status', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...statusBreakdown.map((s) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Container(width: 12, height: 12, decoration: BoxDecoration(color: _statusColor(s['status']), borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 8),
                Text(_titleCase(s['status'])),
                const Spacer(),
                Text('${s['count']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ]),
            )),
          ],
          const SizedBox(height: 24),
          // Recent subscriptions
          Text('Recent Subscriptions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...((d['recentSubscriptions'] as List?) ?? []).map((s) => Card(
            child: ListTile(
              title: Text(s['customerName'] ?? ''),
              subtitle: Text('${s['planName'] ?? ''} • ${s['productName'] ?? 'No product'}'),
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: _statusColor(s['status']), borderRadius: BorderRadius.circular(12)), child: Text(_titleCase(s['status'] ?? ''), style: const TextStyle(color: Colors.white, fontSize: 12))),
            ),
          )),
        ],
      ),
    );
  }

  String _currencySymbol(String c) => {'INR': '₹', 'USD': '\$', 'EUR': '€', 'GBP': '£'}[c] ?? c;
  String _fmtNum(dynamic v) => v == null ? '0' : v is num ? v.toStringAsFixed(v is int ? 0 : 0) : v.toString();
  double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '0') ?? 0;
  String _titleCase(String s) => s.isEmpty ? s : s[0] + s.substring(1).toLowerCase();
  Color _statusColor(String? s) => {'ACTIVE': Colors.green, 'EXPIRED': Colors.grey, 'CANCELLED': Colors.red, 'PENDING': Colors.orange, 'PAST_DUE': Colors.deepOrange, 'TRIALING': Colors.blue}[s] ?? Colors.indigo;
}
