import 'dart:io';
import 'dart:typed_data';
import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

import '../platform/usb_camera_manager.dart';

/// 摄像头信息类
class CameraDevice {
  final String id;
  final String name;
  final bool isUSB;
  final CameraDescription? cameraDescription;
  
  CameraDevice({
    required this.id,
    required this.name,
    this.isUSB = false,
    this.cameraDescription,
  });
}

/// 模具样本类型
enum SampleType {
  closed,      // 关模具
  openGood,    // 开模具（合格）
}

/// 模具状态
enum MoldStatus {
  undefined,   // 未定义
  closed,      // 关模具
  openGood,    // 开模具（合格）
  openBad,     // 开模具（不合格）
}

/// 摄像头与图像处理模型
class CameraModel extends ChangeNotifier {
  // 摄像头相关
  CameraController? _controller;
  List<CameraDevice> _availableCameras = [];
  CameraDevice? _selectedCamera;
  bool _isInitialized = false;
  bool _isProcessing = false;
  
  // 图像相关
  Uint8List? _closedSample;  // 关模具样本
  Uint8List? _openGoodSample; // 开模具（合格）样本
  MoldStatus _currentStatus = MoldStatus.undefined;
  
  // MSE 分数阈值
  final double _threshold = 500;
  
  // Getters
  CameraController? get controller => _controller;
  List<CameraDevice> get availableCameras => _availableCameras;
  CameraDevice? get selectedCamera => _selectedCamera;
  bool get isInitialized => _isInitialized;
  bool get isProcessing => _isProcessing;
  bool get hasClosedSample => _closedSample != null;
  bool get hasOpenGoodSample => _openGoodSample != null;
  bool get canStartMonitoring => hasClosedSample && hasOpenGoodSample;
  MoldStatus get currentStatus => _currentStatus;
  
  // USB摄像头管理器
  final UsbCameraManager _usbManager = UsbCameraManager();
  
  // 初始化相机
  Future<void> initCameras() async {
    _availableCameras = [];
    _isInitialized = false;
    notifyListeners();
    
    try {
      // 获取内置摄像头
      final cameras = await availableCameras();
      
      // 添加相机到列表
      for (int i = 0; i < cameras.length; i++) {
        final camera = cameras[i];
        String name;
        
        // 根据摄像头朝向设置名称
        if (camera.lensDirection == CameraLensDirection.back) {
          name = '后置摄像头';
        } else if (camera.lensDirection == CameraLensDirection.front) {
          name = '前置摄像头';
        } else {
          name = '摄像头 ${i + 1}';
        }
        
        _availableCameras.add(CameraDevice(
          id: camera.name,
          name: name,
          cameraDescription: camera,
        ));
      }
      
      // 在Android平台上检测USB摄像头
      if (Platform.isAndroid) {
        try {
          // 获取USB摄像头列表
          final usbCameras = await _usbManager.getUsbCameras();
          
          // 添加到摄像头列表
          for (final usbCamera in usbCameras) {
            _availableCameras.add(CameraDevice(
              id: usbCamera.id,
              name: usbCamera.name,
              isUSB: true,
            ));
          }
        } catch (e) {
          print('USB摄像头检测失败: $e');
        }
      }
      
      notifyListeners();
      
      // 如果有摄像头，选择第一个
      if (_availableCameras.isNotEmpty) {
        await selectCamera(_availableCameras[0]);
      }
    } catch (e) {
      print('初始化相机失败: $e');
    }
  }
  
  // 选择摄像头
  Future<void> selectCamera(CameraDevice camera) async {
    if (_controller != null) {
      await _controller!.dispose();
      _controller = null;
      _isInitialized = false;
    }
    
    _selectedCamera = camera;
    
    // 重置样本状态
    if (hasClosedSample || hasOpenGoodSample) {
      _closedSample = null;
      _openGoodSample = null;
      _currentStatus = MoldStatus.undefined;
    }
    
    // 如果是标准摄像头
    if (camera.cameraDescription != null) {
      _controller = CameraController(
        camera.cameraDescription!,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      
      try {
        await _controller!.initialize();
        _isInitialized = true;
        notifyListeners();
      } catch (e) {
        print('初始化相机控制器失败: $e');
      }
    } 
    // 如果是USB摄像头
    else if (camera.isUSB && Platform.isAndroid) {
      try {
        // 请求USB摄像头权限
        final hasPermission = await _usbManager.requestUsbCameraPermission(camera.id);
        
        if (hasPermission) {
          // 在实际应用中，这里需要实现USB摄像头的初始化
          // 这可能需要使用原生代码或其他插件来实现
          // 为了演示，我们假设初始化成功
          _isInitialized = true;
          
          // 提示用户USB摄像头已连接
          print('USB摄像头已连接: ${camera.name}');
        } else {
          print('无法获取USB摄像头权限');
        }
      } catch (e) {
        print('USB摄像头初始化失败: $e');
      }
      
      notifyListeners();
    }
  }
  
  // 捕获样本图像
  Future<void> captureSample(SampleType type) async {
    if (_controller == null || !_isInitialized) {
      return;
    }
    
    try {
      final image = await _controller!.takePicture();
      final bytes = await image.readAsBytes();
      
      if (type == SampleType.closed) {
        _closedSample = bytes;
      } else {
        _openGoodSample = bytes;
      }
      
      notifyListeners();
    } catch (e) {
      print('捕获样本失败: $e');
    }
  }
  
  // 开始监控模具状态
  Future<void> startMonitoring() async {
    if (!canStartMonitoring || _isProcessing) {
      return;
    }
    
    _isProcessing = true;
    
    try {
      final image = await _controller!.takePicture();
      final bytes = await image.readAsBytes();
      
      // 使用计算隔离区处理图像以避免UI卡顿
      final result = await compute(_processImage, {
        'current': bytes,
        'closed': _closedSample!,
        'openGood': _openGoodSample!,
        'threshold': _threshold,
      });
      
      _currentStatus = MoldStatus.values[result];
      
    } catch (e) {
      print('处理图像失败: $e');
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }
}

// 在隔离区中处理图像
int _processImage(Map<String, dynamic> params) {
  final Uint8List current = params['current'];
  final Uint8List closed = params['closed'];
  final Uint8List openGood = params['openGood'];
  final double threshold = params['threshold'];
  
  // 转换为图像
  final img.Image? imgCurrent = img.decodeImage(current);
  final img.Image? imgClosed = img.decodeImage(closed);
  final img.Image? imgOpenGood = img.decodeImage(openGood);
  
  if (imgCurrent == null || imgClosed == null || imgOpenGood == null) {
    return MoldStatus.undefined.index;
  }
  
  // 转换为灰度图
  final img.Image grayCurrent = img.grayscale(imgCurrent);
  final img.Image grayClosed = img.grayscale(imgClosed);
  final img.Image grayOpenGood = img.grayscale(imgOpenGood);
  
  // 计算MSE
  double scoreClosed = _calculateMSE(grayCurrent, grayClosed);
  double scoreOpenGood = _calculateMSE(grayCurrent, grayOpenGood);
  
  // 确定状态
  if (scoreClosed < threshold) {
    return MoldStatus.closed.index;
  } else if (scoreOpenGood < threshold) {
    return MoldStatus.openGood.index;
  } else {
    return MoldStatus.openBad.index;
  }
}

// 计算均方误差 (MSE)
double _calculateMSE(img.Image img1, img.Image img2) {
  // 确保图像大小一致
  img.Image image1 = img1;
  img.Image image2 = img2;
  
  if (img1.width != img2.width || img1.height != img2.height) {
    image2 = img.copyResize(img2, width: img1.width, height: img1.height);
  }
  
  double sum = 0;
  int pixels = 0;
  
  for (int y = 0; y < image1.height; y++) {
    for (int x = 0; x < image1.width; x++) {
      int pixel1 = image1.getPixel(x, y);
      int pixel2 = image2.getPixel(x, y);
      
      // 只比较亮度值
      int val1 = img.getLuminance(pixel1);
      int val2 = img.getLuminance(pixel2);
      
      int diff = val1 - val2;
      sum += (diff * diff);
      pixels++;
    }
  }
  
  return pixels > 0 ? sum / pixels : double.infinity;
}
