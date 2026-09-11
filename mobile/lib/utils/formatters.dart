import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Currency symbol for a currency code.
String currencySymbol(String c) =>
    {'INR': '₹', 'USD': '\$', 'EUR': '€', 'GBP': '£'}[c] ?? c;

/// Parse a dynamic value to double safely.
double numParse(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

/// Format a number to a fixed string (no trailing decimals for ints).
String fmtNum(dynamic v, {int decimals = 0}) {
  if (v == null) return '0';
  if (v is num) return v.toStringAsFixed(v is int ? 0 : decimals);
  return v.toString();
}

/// Format a value as currency, e.g. "₹1,200".
String formatCurrency(dynamic value, [String currency = 'INR']) {
  final n = numParse(value);
  final symbol = currencySymbol(currency);
  final formatted = NumberFormat.decimalPatternDigits(
    locale: 'en_US',
    decimalDigits: (n == n.roundToDouble()) ? 0 : 2,
  ).format(n);
  return '$symbol$formatted';
}

/// Format an ISO date string to "MMM d, yyyy", or '—' if null/empty.
String formatDate(String? dateString) {
  if (dateString == null || dateString.isEmpty) return '—';
  try {
    return DateFormat('MMM d, yyyy').format(DateTime.parse(dateString));
  } catch (_) {
    return dateString;
  }
}

/// Format an ISO date string to "MMM d, yyyy h:mm a".
String formatDateTime(String? dateString) {
  if (dateString == null || dateString.isEmpty) return '—';
  try {
    return DateFormat('MMM d, yyyy h:mm a').format(DateTime.parse(dateString));
  } catch (_) {
    return dateString;
  }
}

/// Title-case a status string, e.g. "ACTIVE" -> "Active".
String titleCase(String s) {
  if (s.isEmpty) return s;
  return s[0].toUpperCase() + s.substring(1).toLowerCase().replaceAll('_', ' ');
}

/// Color for a subscription status.
Color statusColor(String? s) {
  switch (s) {
    case 'ACTIVE':
    case 'PAID':
    case 'COMPLETED':
      return Colors.green;
    case 'EXPIRED':
    case 'CANCELLED':
    case 'FAILED':
    case 'REFUNDED':
      return Colors.red;
    case 'PENDING':
    case 'DRAFT':
    case 'TRIALING':
      return Colors.blue;
    case 'PAST_DUE':
    case 'OVERDUE':
      return Colors.deepOrange;
    case 'PARTIAL':
    case 'SENT':
      return Colors.orange;
    default:
      return Colors.indigo;
  }
}

/// A small status badge widget.
Widget statusBadge(String? status) {
  final s = status ?? '';
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: statusColor(status),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(
      titleCase(s),
      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
    ),
  );
}
