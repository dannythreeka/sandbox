package com.example.zd_monitor_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.app.PendingIntent
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.util.Log

import java.util.HashMap

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.example.zd_monitor_flutter/usb_camera"
    private lateinit var channel: MethodChannel
    private lateinit var usbManager: UsbManager
    
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // 初始化 USB 管理器
        usbManager = getSystemService(Context.USB_SERVICE) as UsbManager
        
        // 设置方法通道
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "getUsbCameras" -> {
                    result.success(getUsbCameras())
                }
                "requestUsbPermission" -> {
                    val deviceId = call.argument<String>("deviceId")
                    if (deviceId != null) {
                        requestUsbPermission(deviceId, result)
                    } else {
                        result.error("INVALID_ARGUMENT", "Device ID is required", null)
                    }
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
    
    // 获取所有 USB 摄像头设备
    private fun getUsbCameras(): List<Map<String, Any>> {
        val deviceList = usbManager.deviceList
        val results = mutableListOf<Map<String, Any>>()
        
        for ((deviceName, device) in deviceList) {
            // 检查是否是摄像头设备
            if (isUsbCamera(device)) {
                val deviceMap = HashMap<String, Any>()
                deviceMap["id"] = deviceName
                deviceMap["name"] = getDeviceName(device)
                deviceMap["deviceName"] = deviceName
                deviceMap["vendorId"] = device.vendorId
                deviceMap["productId"] = device.productId
                
                results.add(deviceMap)
            }
        }
        
        return results
    }
    
    // 判断设备是否是摄像头
    private fun isUsbCamera(device: UsbDevice): Boolean {
        // USB Video Class (UVC) 设备通常在类或接口类别中包含 "CC_VIDEO"
        if (device.deviceClass == UsbConstants.USB_CLASS_VIDEO) {
            return true
        }
        
        // 检查接口类别
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == UsbConstants.USB_CLASS_VIDEO) {
                return true
            }
        }
        
        // 根据已知的摄像头厂商和产品 ID 列表来检测
        // 这里可以添加更多已知的摄像头设备
        val knownCameraVendors = listOf(
            0x046d,  // Logitech
            0x05a9,  // OmniVision
            0x041e,  // Creative
            0x0458,  // Genius/KYE Systems
            0x0ac8   // Z-Star Microelectronics
        )
        
        return knownCameraVendors.contains(device.vendorId)
    }
    
    // 获取设备友好名称
    private fun getDeviceName(device: UsbDevice): String {
        // 尝试获取设备名称
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val productName = device.productName
            if (!productName.isNullOrEmpty()) {
                return productName
            }
        }
        
        // 根据厂商 ID 推测厂商名称
        val vendorName = when (device.vendorId) {
            0x046d -> "罗技"
            0x05a9 -> "OmniVision"
            0x041e -> "Creative"
            0x0458 -> "Genius"
            0x0ac8 -> "Z-Star"
            else -> "USB"
        }
        
        return "$vendorName 攝像頭"
    }
    
    // 请求 USB 设备权限
    private fun requestUsbPermission(deviceId: String, result: MethodChannel.Result) {
        val device = usbManager.deviceList[deviceId]
        if (device != null) {
            val permissionIntent = PendingIntent.getBroadcast(
                this,
                0,
                Intent(ACTION_USB_PERMISSION),
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
            )
            
            // 注册权限广播接收器
            val permissionReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    val action = intent.action
                    if (ACTION_USB_PERMISSION == action) {
                        synchronized(this) {
                            val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                            if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                                if (device != null) {
                                    // 权限被授予
                                    result.success(true)
                                }
                            } else {
                                // 权限被拒绝
                                result.success(false)
                            }
                            unregisterReceiver(this)
                        }
                    }
                }
            }
            
            val filter = IntentFilter(ACTION_USB_PERMISSION)
            registerReceiver(permissionReceiver, filter)
            
            // 请求权限
            usbManager.requestPermission(device, permissionIntent)
        } else {
            // 找不到设备
            result.success(false)
        }
    }
    
    companion object {
        private const val ACTION_USB_PERMISSION = "com.example.zd_monitor_flutter.USB_PERMISSION"
    }
}

// USB 常量类
object UsbConstants {
    const val USB_CLASS_VIDEO = 0x0E
}
