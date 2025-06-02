import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'models/camera_model.dart';

void main() {
  // 确保 Flutter 绑定初始化
  WidgetsFlutterBinding.ensureInitialized();
  
  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => CameraModel()),
    ],
    child: const MyApp(),
  ));
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '模具監視器',
      theme: ThemeData(
        // 使用深色主题，与PWA版本保持一致
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF2E8B57), // 适合模具监视的绿色
        canvasColor: const Color(0xFF111111), // 深灰背景
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF222222),
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.white),
          bodyMedium: TextStyle(color: Colors.white),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF444444),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
      ),
      home: const HomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
