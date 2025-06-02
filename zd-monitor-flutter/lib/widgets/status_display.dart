import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/camera_model.dart';

class StatusDisplay extends StatelessWidget {
  const StatusDisplay({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<CameraModel>(
      builder: (context, cameraModel, child) {
        String statusText = '尚未開始';
        
        if (!cameraModel.isInitialized) {
          statusText = '正在初始化攝像頭...';
        } else if (!cameraModel.hasClosedSample && !cameraModel.hasOpenGoodSample) {
          statusText = '請拍攝樣本';
        } else if (!cameraModel.hasClosedSample) {
          statusText = '已儲存開模具樣本，請拍攝關模具樣本';
        } else if (!cameraModel.hasOpenGoodSample) {
          statusText = '已儲存關模具樣本，請拍攝開模具樣本';
        } else {
          switch (cameraModel.currentStatus) {
            case MoldStatus.closed:
              statusText = '狀態：關模具';
              break;
            case MoldStatus.openGood:
              statusText = '狀態：開模具（合格）';
              break;
            case MoldStatus.openBad:
              statusText = '狀態：開模具（不合格）';
              break;
            case MoldStatus.undefined:
              statusText = '正在監測...';
              break;
          }
        }
        
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF333333),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '关模具样本:',
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 14,
                    ),
                  ),
                  _buildStatusIndicator(cameraModel.hasClosedSample),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '开模具样本:',
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 14,
                    ),
                  ),
                  _buildStatusIndicator(cameraModel.hasOpenGoodSample),
                ],
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  statusText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildStatusIndicator(bool isActive) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isActive ? Colors.green : Colors.red,
      ),
    );
  }
}
