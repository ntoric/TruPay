import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/api_service.dart';
import '../../utils/formatters.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? _data;
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
      final (data, status) = await ApiService.get('/reports');
      if (status == 200 && data is Map<String, dynamic>) {
        _data = data;
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
    if (_data == null) return const Center(child: Text('No data'));

    final d = _data!;
    final monthlyRev = (d['monthlyRevenue'] as List?) ?? [];
    final planPopularity = (d['planPopularity'] as List?) ?? [];
    final topCustomers = (d['topCustomers'] as List?) ?? [];
    final statusBreakdown = (d['statusBreakdown'] as List?) ?? [];
    final maxCount = planPopularity.isEmpty
        ? 1.0
        : planPopularity.map((p) => numParse((p as Map)['count'])).fold<double>(0, (a, b) => a > b ? a : b);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Key metrics
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.6,
            children: [
              _metricCard('MRR', formatCurrency(d['mrr']), Icons.trending_up, Colors.indigo),
              _metricCard('ARR', formatCurrency(d['arr']), Icons.show_chart, Colors.teal),
              _metricCard('Churn rate', '${fmtNum(d['churnRate'])}%', Icons.trending_down, Colors.red),
              _metricCard('Outstanding', formatCurrency(d['outstanding']), Icons.warning, Colors.orange),
            ],
          ),
          const SizedBox(height: 24),
          // Monthly revenue chart
          if (monthlyRev.isNotEmpty) ...[
            Text('Monthly revenue', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
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
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (val, _) {
                          final idx = val.toInt();
                          if (idx < 0 || idx >= monthlyRev.length) return const SizedBox();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text((monthlyRev[idx] as Map)['label'] ?? '',
                                style: const TextStyle(fontSize: 10)),
                          );
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: List.generate(monthlyRev.length,
                          (i) => FlSpot(i.toDouble(), numParse((monthlyRev[i] as Map)['value']))),
                      isCurved: true,
                      color: Theme.of(context).colorScheme.primary,
                      barWidth: 3,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
          // Plan popularity
          if (planPopularity.isNotEmpty) ...[
            Text('Plan popularity', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...planPopularity.map((p) {
              final m = p as Map;
              final count = numParse(m['count']);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(m['name'] ?? ''),
                        Text('${fmtNum(count)} subs • ${formatCurrency(m['revenue'])}',
                            style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: maxCount == 0 ? 0 : count / maxCount,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 24),
          ],
          // Top customers
          if (topCustomers.isNotEmpty) ...[
            Text('Top customers', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...topCustomers.map((c) {
              final m = c as Map;
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(m['name'] ?? ''),
                  trailing: Text(formatCurrency(m['total']),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              );
            }),
            const SizedBox(height: 24),
          ],
          // Status breakdown
          if (statusBreakdown.isNotEmpty) ...[
            Text('Subscription status', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...statusBreakdown.map((s) {
              final m = s as Map;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: statusColor(_reverseTitleCase(m['name'])),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(m['name'] ?? ''),
                    const Spacer(),
                    Text('${m['count']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 12),
                    Text(formatCurrency(m['value']), style: const TextStyle(color: Colors.grey)),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  String _reverseTitleCase(String? s) {
    if (s == null) return '';
    return s.toUpperCase().replaceAll(' ', '_');
  }

  Widget _metricCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(children: [Icon(icon, size: 20, color: color), const SizedBox(width: 8), Expanded(child: Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[600])))]),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }
}
