import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/chat_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'services/chat_service.dart';
import 'services/media_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: AppConfig.firebaseApiKey,
      appId: AppConfig.firebaseAppId,
      messagingSenderId: AppConfig.firebaseMessagingSenderId,
      projectId: AppConfig.firebaseProjectId,
      storageBucket: AppConfig.firebaseStorageBucket,
      authDomain: AppConfig.firebaseAuthDomain,
    ),
  );
  runApp(const GitBridgeApp());
}

class GitBridgeApp extends StatefulWidget {
  const GitBridgeApp({super.key});

  @override
  State<GitBridgeApp> createState() => _GitBridgeAppState();
}

class _GitBridgeAppState extends State<GitBridgeApp> {
  final _auth = AuthService();
  late final _chat = ChatService();
  late final _media = MediaService(_auth);
  bool _loggedIn = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF075E54)),
        useMaterial3: true,
      ),
      home: _loggedIn && _auth.currentUser != null
          ? ChatScreen(
              auth: _auth,
              chat: _chat,
              media: _media,
              onLogout: () => setState(() => _loggedIn = false),
            )
          : LoginScreen(
              auth: _auth,
              onLoggedIn: () => setState(() => _loggedIn = true),
            ),
    );
  }
}
