# 模具監視器 Flutter 应用

这是使用 Flutter 框架开发的模具監視器应用，支持 Android 和 iOS 平台，特别是在 Android 上支持 USB 外接摄像头功能。

## 功能特点

- **跨平台支持**：使用 Flutter 开发，可在 Android 和 iOS 上运行
- **摄像头支持**：
  - 支持设备内置摄像头
  - Android 设备上支持 USB 外接摄像头
  - 提供摄像头切换界面
- **模具状态监控**：
  - 关模具（关闭状态）
  - 开模具（合格）
  - 开模具（不合格）
- **图像处理**：使用 OpenCV 和 Flutter 图像处理库进行图像比较和分析

## 系统要求

- Flutter SDK 2.10.0 或更高版本
- Android 5.0+ (API level 21+)
- iOS 10.0+
- 对于 USB 摄像头功能：需要支持 USB OTG 的 Android 设备

## 安装和使用

### 从源代码构建

1. 确保已安装 Flutter SDK 并配置好环境
2. 克隆此仓库
3. 运行 `flutter pub get` 安装依赖
4. 使用 `flutter run` 在连接的设备上运行应用

### 直接安装

1. 下载最新的 APK 文件（适用于 Android）或 IPA 文件（适用于 iOS）
2. 在设备上安装应用

## 使用方法

1. 启动应用并授予摄像头权限
2. 如需使用 USB 摄像头（仅 Android），请连接摄像头并允许应用访问 USB 设备
3. 从下拉菜单选择要使用的摄像头
4. 按照以下步骤进行模具状态监控：
   - 拍摄"关模具样本"
   - 拍摄"开模具（合格）样本"
   - 应用会自动比较当前画面与样本，并实时显示模具状态

## USB 摄像头支持说明

USB 摄像头支持仅在 Android 设备上可用，并且需要：

1. 支持 USB OTG 功能的设备
2. 兼容的 USB 摄像头（大多数标准 UVC 摄像头应该可以工作）
3. 可能需要适当的 USB OTG 适配器

## 常见问题解答

- **应用无法识别我的 USB 摄像头**

  - 确保设备支持 USB OTG
  - 尝试重新连接摄像头
  - 检查摄像头是否为标准 UVC 设备

- **图像比较不准确**
  - 确保拍摄样本时光线条件稳定
  - 保持摄像头位置固定
  - 可能需要调整阈值参数（目前固定为 500）

## 技术说明

- **平台通道**：使用 Flutter 平台通道与原生 Android 代码通信，实现 USB 摄像头访问
- **图像处理**：使用 Flutter 的 Compute 隔离区进行图像处理，避免 UI 卡顿
- **状态管理**：使用 Provider 包实现应用状态管理

## 开发者说明

如需进一步开发或定制此应用，请参考以下文件：

- `lib/models/camera_model.dart`：摄像头和图像处理逻辑
- `lib/platform/usb_camera_manager.dart`：USB 摄像头管理器
- `android/.../MainActivity.kt`：Android 平台实现
