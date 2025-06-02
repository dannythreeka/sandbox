import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:camera/camera.dart';
import 'package:permission_handler/permission_handler.dart';

import '../models/camera_model.dart';
import '../widgets/camera_preview_widget.dart';
import '../widgets/status_display.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  Timer? _monitoringTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _requestPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _monitoringTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // 处理应用程序生命周期变化，以正确管理摄像头资源
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    
    if (cameraModel.controller == null || !cameraModel.controller!.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      // 停止摄像头预览
      cameraModel.controller!.dispose();
      _monitoringTimer?.cancel();
    } else if (state == AppLifecycleState.resumed) {
      // 重新初始化摄像头
      _initializeCameras();
    }
  }

  // 请求应用权限
  Future<void> _requestPermissions() async {
    // 请求相机权限
    final camera = await Permission.camera.request();
    if (camera.isGranted) {
      _initializeCameras();
    } else {
      // 显示请求权限失败的消息
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('需要相机权限才能使用此应用')),
        );
      }
    }
  }

  // 初始化摄像头
  Future<void> _initializeCameras() async {
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    await cameraModel.initCameras();
    
    // 设置定时器进行模具状态监控
    _monitoringTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) {
        if (cameraModel.canStartMonitoring && !cameraModel.isProcessing) {
          cameraModel.startMonitoring();
        }
      },
    );
  }

  // 刷新摄像头列表
  void _refreshCameras() async {
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    await cameraModel.initCameras();
  }

  // 选择摄像头
  void _selectCamera(CameraDevice device) async {
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    await cameraModel.selectCamera(device);
  }

  // 拍摄关模具样本
  void _captureClosedSample() async {
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    await cameraModel.captureSample(SampleType.closed);
  }

  // 拍摄开模具（合格）样本
  void _captureOpenGoodSample() async {
    final cameraModel = Provider.of<CameraModel>(context, listen: false);
    await cameraModel.captureSample(SampleType.openGood);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('模具監視器'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 摄像头选择器
            Consumer<CameraModel>(
              builder: (context, cameraModel, child) {
                return Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<CameraDevice>(
                        decoration: const InputDecoration(
                          labelText: '選擇攝像頭',
                          border: OutlineInputBorder(),
                          filled: true,
                          fillColor: Color(0xFF333333),
                        ),
                        value: cameraModel.selectedCamera,
                        onChanged: cameraModel.availableCameras.isEmpty
                            ? null
                            : (CameraDevice? device) {
                                if (device != null) {
                                  _selectCamera(device);
                                }
                              },
                        items: cameraModel.availableCameras.map((CameraDevice device) {
                          return DropdownMenuItem<CameraDevice>(
                            value: device,
                            child: Text(device.name),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: _refreshCameras,
                      tooltip: '重新掃描攝像頭設備',
                    ),
                  ],
                );
              },
            ),
            
            const SizedBox(height: 16),
            
            // 摄像头预览
            const Expanded(
              child: CameraPreviewWidget(),
            ),
            
            const SizedBox(height: 16),
            
            // 拍摄按钮
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _captureClosedSample,
                    child: const Text('拍攝關模具樣本'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _captureOpenGoodSample,
                    child: const Text('拍攝開模具（合格）樣本'),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // 状态显示
            const StatusDisplay(),
          ],
        ),
      ),
    );
  }
}
