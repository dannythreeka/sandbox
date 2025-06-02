import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:camera/camera.dart';

import '../models/camera_model.dart';

class CameraPreviewWidget extends StatelessWidget {
  const CameraPreviewWidget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<CameraModel>(
      builder: (context, cameraModel, child) {
        if (cameraModel.controller == null) {
          return const Center(
            child: Text('未选择摄像头'),
          );
        }
        
        if (!cameraModel.isInitialized) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }
        
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: Colors.grey[700]!,
                width: 2,
              ),
            ),
            child: AspectRatio(
              aspectRatio: cameraModel.controller!.value.aspectRatio,
              child: Stack(
                children: [
                  // 相机预览
                  CameraPreview(cameraModel.controller!),
                  
                  // 状态叠加
                  if (cameraModel.currentStatus != MoldStatus.undefined)
                    Positioned(
                      left: 20,
                      top: 20,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: _getStatusColor(cameraModel.currentStatus),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _getStatusText(cameraModel.currentStatus),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
  
  // 获取状态文本
  String _getStatusText(MoldStatus status) {
    switch (status) {
      case MoldStatus.closed:
        return '關模具';
      case MoldStatus.openGood:
        return '開模具（合格）';
      case MoldStatus.openBad:
        return '開模具（不合格）';
      default:
        return '未定義';
    }
  }
  
  // 获取状态颜色
  Color _getStatusColor(MoldStatus status) {
    switch (status) {
      case MoldStatus.closed:
        return Colors.blue;
      case MoldStatus.openGood:
        return Colors.green;
      case MoldStatus.openBad:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
