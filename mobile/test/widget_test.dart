// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility that comes with flutter_test. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:subhub_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build the app and trigger a frame. The app initializes asynchronously
    // (AuthProvider reads the stored token) so we pump a few frames.
    await tester.pumpWidget(const SubHubApp());
    await tester.pump();

    // The app should render without throwing.
    expect(find.byType(SubHubApp), findsOneWidget);
  });
}
