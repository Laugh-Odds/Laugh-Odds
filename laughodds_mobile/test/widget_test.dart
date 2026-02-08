import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:viralforge_mobile/main.dart';
import 'package:viralforge_mobile/providers/app_provider.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppProvider(),
        child: const ViralForgeApp(),
      ),
    );
    expect(find.text('Explore Memes'), findsOneWidget);
  });
}
