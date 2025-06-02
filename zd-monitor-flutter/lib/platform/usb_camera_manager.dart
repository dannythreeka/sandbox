import 'package:flutter/services.dart';
import 'dart:io';
import 'dart:async';
import 'dart:convert';

// USB 摄像头设备信息
class UsbCameraDevice {
  final String id;
  final String name;
  final String deviceName;
  final int vendorId;
  final int productId;

  UsbCameraDevice({
    required this.id,
    required this.name,
    required this.deviceName,
    required this.vendorId,
    required this.productId,
  });

  factory UsbCameraDevice.fromMap(Map<String, dynamic> map) {
    return UsbCameraDevice(
      id: map['id'] ?? '',
      name: map['name'] ?? 'USB 摄像头',
      deviceName: map['deviceName'] ?? '',
      vendorId: map['vendorId'] ?? 0,
      productId: map['productId'] ?? 0,
    );
  }
}

// USB 摄像头管理器
class UsbCameraManager {
  static const MethodChannel _channel = MethodChannel('com.example.zd_monitor_flutter/usb_camera');
  static final UsbCameraManager _instance = UsbCameraManager._internal();

  factory UsbCameraManager() {
    return _instance;
  }

  UsbCameraManager._internal();

  // 获取可用的 USB 摄像头设备列表
  Future<List<UsbCameraDevice>> getUsbCameras() async {
    // 只在 Android 平台上实现
    if (!Platform.isAndroid) {
      return [];
    }

    try {
      final List<dynamic>? deviceMaps = await _channel.invokeMethod('getUsbCameras');
      
      if (deviceMaps == null) {
        return [];
      }
      
      return deviceMaps
          .map((dynamic map) => UsbCameraDevice.fromMap(Map<String, dynamic>.from(map)))
          .toList();
    } on PlatformException catch (e) {
      print('获取USB摄像头失败: ${e.message}');
      return [];
    }
  }

  // 请求 USB 摄像头权限
  Future<bool> requestUsbCameraPermission(String deviceId) async {
    if (!Platform.isAndroid) {
      return false;
    }

    try {
      final bool? result = await _channel.invokeMethod('requestUsbPermission', {
        'deviceId': deviceId,
      });
      return result ?? false;
    } on PlatformException catch (e) {
      print('请求USB摄像头权限失败: ${e.message}');
      return false;
    }
  }
}
