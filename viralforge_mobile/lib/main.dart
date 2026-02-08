import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'providers/app_provider.dart';
import 'screens/gallery_screen.dart';
import 'screens/vote_screen.dart';
import 'screens/create_screen.dart';
import 'screens/settlements_screen.dart';
import 'screens/wallet_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppProvider(),
      child: const ViralForgeApp(),
    ),
  );
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final _router = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/gallery',
  routes: [
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) => ScaffoldWithNav(child: child),
      routes: [
        GoRoute(path: '/gallery', builder: (_, __) => const GalleryScreen()),
        GoRoute(path: '/vote', builder: (_, __) => const VoteScreen()),
        GoRoute(path: '/create', builder: (_, __) => const CreateScreen()),
        GoRoute(path: '/settlements', builder: (_, __) => const SettlementsScreen()),
        GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
      ],
    ),
  ],
);

class ViralForgeApp extends StatelessWidget {
  const ViralForgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'ViralForge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF111827),
        colorScheme: ColorScheme.dark(
          primary: Colors.blue[500]!,
          surface: const Color(0xFF1F2937),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF111827),
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1F2937),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1F2937),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: const Color(0xFF111827),
          indicatorColor: Colors.blue[500]!.withValues(alpha: 0.2),
        ),
      ),
      routerConfig: _router,
    );
  }
}

class ScaffoldWithNav extends StatelessWidget {
  final Widget child;
  const ScaffoldWithNav({super.key, required this.child});

  static const _tabs = ['/gallery', '/vote', '/create', '/settlements', '/wallet'];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final idx = _tabs.indexWhere((t) => location.startsWith(t));
    return idx >= 0 ? idx : 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i]),
        height: 65,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.swipe), label: 'Vote'),
          NavigationDestination(icon: Icon(Icons.add_circle_outline), label: 'Create'),
          NavigationDestination(icon: Icon(Icons.history), label: 'Settle'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet), label: 'Wallet'),
        ],
      ),
    );
  }
}
