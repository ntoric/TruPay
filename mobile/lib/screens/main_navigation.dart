import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import 'dashboard/dashboard_screen.dart';
import 'customers/customers_screen.dart';
import 'products/products_screen.dart';
import 'plans/plans_screen.dart';
import 'subscriptions/subscriptions_screen.dart';
import 'invoices/invoices_screen.dart';
import 'payments/payments_screen.dart';
import 'reports/reports_screen.dart';
import 'alerts/alerts_screen.dart';
import 'settings/settings_screen.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;

  final _screens = [
    const DashboardScreen(),
    const CustomersScreen(),
    const SubscriptionsScreen(),
    const InvoicesScreen(),
    const ProductsScreen(),
    const PlansScreen(),
    const PaymentsScreen(),
    const ReportsScreen(),
    const AlertsScreen(),
    const SettingsScreen(),
  ];

  final _titles = ['Dashboard', 'Customers', 'Subscriptions', 'Invoices', 'Products', 'Plans', 'Payments', 'Reports', 'Alerts', 'Settings'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_currentIndex])),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)), child: const Center(child: Text('S', style: TextStyle(color: Colors.indigo, fontSize: 20, fontWeight: FontWeight.bold)))),
                  const SizedBox(height: 8),
                  const Text('SubHub', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  Text(context.watch<AuthProvider>().email ?? '', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
            ),
            for (int i = 0; i < _titles.length; i++)
              ListTile(
                leading: Icon(_iconFor(i)),
                title: Text(_titles[i]),
                selected: _currentIndex == i,
                onTap: () { setState(() => _currentIndex = i); Navigator.pop(context); },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Sign out', style: TextStyle(color: Colors.red)),
              onTap: () => context.read<AuthProvider>().logout(),
            ),
          ],
        ),
      ),
      body: _screens[_currentIndex],
    );
  }

  IconData _iconFor(int i) => [
    Icons.dashboard, Icons.people, Icons.credit_card, Icons.receipt_long,
    Icons.inventory_2, Icons.layers, Icons.payments, Icons.bar_chart,
    Icons.notifications, Icons.settings,
  ][i];
}
