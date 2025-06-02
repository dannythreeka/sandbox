package com.example.zdmonitor;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Bundle;
import android.util.Log;
import android.view.SurfaceView;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.opencv.android.BaseLoaderCallback;
import org.opencv.android.CameraBridgeViewBase;
import org.opencv.android.JavaCameraView;
import org.opencv.android.LoaderCallbackInterface;
import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.Core;
import org.opencv.core.Mat;
import org.opencv.core.Scalar;
import org.opencv.imgproc.Imgproc;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class MainActivity extends AppCompatActivity implements CameraBridgeViewBase.CvCameraViewListener2 {
    private static final String TAG = "MainActivity";
    private static final int CAMERA_PERMISSION_REQUEST = 100;
    
    // UI 组件
    private JavaCameraView cameraView;
    private Button captureClosedButton;
    private Button captureOpenGoodButton;
    private Button refreshButton;
    private TextView statusText;
    private Spinner cameraSpinner;
    
    // OpenCV 相关
    private Mat sampleClosed = null;
    private Mat sampleOpenGood = null;
    private Mat latestFrame = null;
    
    // 摄像头列表
    private List<CameraInfo> cameraList = new ArrayList<>();
    private int currentCameraId = 0;
    
    // USB 管理器
    private UsbManager usbManager;
    
    // OpenCV 加载回调
    private BaseLoaderCallback loaderCallback = new BaseLoaderCallback(this) {
        @Override
        public void onManagerConnected(int status) {
            if (status == LoaderCallbackInterface.SUCCESS) {
                Log.i(TAG, "OpenCV loaded successfully");
                cameraView.enableView();
                refreshCameraList();
            } else {
                super.onManagerConnected(status);
            }
        }
    };
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // 初始化 UI 组件
        cameraView = findViewById(R.id.cameraView);
        captureClosedButton = findViewById(R.id.captureClosedButton);
        captureOpenGoodButton = findViewById(R.id.captureOpenGoodButton);
        refreshButton = findViewById(R.id.refreshButton);
        statusText = findViewById(R.id.statusText);
        cameraSpinner = findViewById(R.id.cameraSpinner);
        
        // 设置摄像头视图
        cameraView.setVisibility(SurfaceView.VISIBLE);
        cameraView.setCvCameraViewListener(this);
        
        // 获取 USB 管理器
        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        
        // 设置按钮点击事件
        captureClosedButton.setOnClickListener(v -> {
            if (latestFrame != null) {
                sampleClosed = latestFrame.clone();
                statusText.setText(R.string.status_sample_closed_saved);
            }
        });
        
        captureOpenGoodButton.setOnClickListener(v -> {
            if (latestFrame != null) {
                sampleOpenGood = latestFrame.clone();
                statusText.setText(R.string.status_sample_open_good_saved);
            }
        });
        
        refreshButton.setOnClickListener(v -> {
            refreshCameraList();
        });
        
        // 设置摄像头选择器事件
        cameraSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position < cameraList.size()) {
                    switchCamera(cameraList.get(position).id);
                }
            }
            
            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                // 不做任何事
            }
        });
        
        // 检查和请求相机权限
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) 
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, 
                    new String[]{Manifest.permission.CAMERA}, 
                    CAMERA_PERMISSION_REQUEST);
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        if (!OpenCVLoader.initDebug()) {
            Log.d(TAG, "Internal OpenCV library not found. Using OpenCV Manager for initialization");
            OpenCVLoader.initAsync(OpenCVLoader.OPENCV_VERSION_3_4_0, this, loaderCallback);
        } else {
            Log.d(TAG, "OpenCV library found inside package. Using it!");
            loaderCallback.onManagerConnected(LoaderCallbackInterface.SUCCESS);
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        if (cameraView != null) {
            cameraView.disableView();
        }
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (cameraView != null) {
            cameraView.disableView();
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                cameraView.setCameraPermissionGranted();
            } else {
                Toast.makeText(this, "相机权限被拒绝，应用无法正常工作", Toast.LENGTH_LONG).show();
            }
        }
    }
    
    // 刷新摄像头列表
    private void refreshCameraList() {
        statusText.setText(R.string.status_searching);
        
        cameraList.clear();
        List<String> cameraNames = new ArrayList<>();
        
        // 添加内置摄像头
        cameraList.add(new CameraInfo(0, getString(R.string.default_camera), false));
        
        if (cameraView.getNumberOfCameras() > 1) {
            cameraList.add(new CameraInfo(1, getString(R.string.camera_format, 2), false));
        }
        
        // 检查USB摄像头
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        for (UsbDevice device : deviceList.values()) {
            if (isUsbCamera(device)) {
                // 这是一个摄像头设备，添加到列表
                // 注意：在实际应用中，您需要更复杂的逻辑来处理USB摄像头
                // 这里我们只是作为示例添加到列表中
                cameraList.add(new CameraInfo(
                        cameraList.size(), 
                        getString(R.string.usb_camera) + " (" + device.getDeviceName() + ")",
                        true));
            }
        }
        
        // 构建显示名称列表
        for (CameraInfo camera : cameraList) {
            cameraNames.add(camera.name);
        }
        
        // 更新spinner
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this, 
                android.R.layout.simple_spinner_dropdown_item, 
                cameraNames);
        cameraSpinner.setAdapter(adapter);
        
        statusText.setText(getString(R.string.status_camera_found, cameraList.size()));
    }
    
    // 检查设备是否是USB摄像头
    private boolean isUsbCamera(UsbDevice device) {
        // USB Video Class: 0x0E (Video)
        // USB Video SubClass: 0x01 (Video Control), 0x02 (Video Streaming)
        return device.getDeviceClass() == 0x0E || 
               device.getDeviceClass() == 0xFF && 
               (device.getInterface(0).getInterfaceClass() == 0x0E || 
                device.getInterface(0).getInterfaceSubclass() == 0x01 || 
                device.getInterface(0).getInterfaceSubclass() == 0x02);
    }
    
    // 切换摄像头
    private void switchCamera(int cameraId) {
        if (currentCameraId != cameraId) {
            currentCameraId = cameraId;
            
            // 重置样本
            if (sampleClosed != null || sampleOpenGood != null) {
                sampleClosed = null;
                sampleOpenGood = null;
                statusText.setText(R.string.status_switch_camera);
            } else {
                statusText.setText(R.string.status_ready);
            }
            
            cameraView.disableView();
            cameraView.setCameraIndex(cameraId);
            cameraView.enableView();
        }
    }
    
    // CvCameraViewListener2 接口实现
    @Override
    public void onCameraViewStarted(int width, int height) {
        Log.d(TAG, "onCameraViewStarted: " + width + "x" + height);
    }
    
    @Override
    public void onCameraViewStopped() {
        Log.d(TAG, "onCameraViewStopped");
    }
    
    @Override
    public Mat onCameraFrame(CameraBridgeViewBase.CvCameraViewFrame inputFrame) {
        Mat frame = inputFrame.rgba();
        
        // 保存最新帧用于拍照
        if (latestFrame == null) {
            latestFrame = new Mat();
        }
        frame.copyTo(latestFrame);
        
        // 如果有样本，进行对比分析
        if (sampleClosed != null && sampleOpenGood != null) {
            // 转换为灰度图像
            Mat grayCurrent = new Mat();
            Mat graySampleClosed = new Mat();
            Mat graySampleOpen = new Mat();
            
            Imgproc.cvtColor(frame, grayCurrent, Imgproc.COLOR_RGBA2GRAY);
            Imgproc.cvtColor(sampleClosed, graySampleClosed, Imgproc.COLOR_RGBA2GRAY);
            Imgproc.cvtColor(sampleOpenGood, graySampleOpen, Imgproc.COLOR_RGBA2GRAY);
            
            // 计算MSE
            double scoreClosed = mse(grayCurrent, graySampleClosed);
            double scoreOpen = mse(grayCurrent, graySampleOpen);
            
            // 判断状态
            final String label;
            
            if (scoreClosed < 500) {
                label = getString(R.string.label_closed);
            } else if (scoreOpen < 500) {
                label = getString(R.string.label_open_good);
            } else {
                label = getString(R.string.label_open_bad);
            }
            
            // 在图像上添加标签
            Imgproc.putText(frame, label, new org.opencv.core.Point(50, 100),
                    Core.FONT_HERSHEY_SIMPLEX, 2, new Scalar(255, 0, 0), 4);
            
            // 更新状态文本
            runOnUiThread(() -> {
                statusText.setText(getString(R.string.status_label, label));
            });
            
            // 清理Mat
            grayCurrent.release();
            graySampleClosed.release();
            graySampleOpen.release();
        }
        
        return frame;
    }
    
    // 计算均方误差
    private double mse(Mat img1, Mat img2) {
        if (img1.rows() != img2.rows() || img1.cols() != img2.cols()) {
            // 如果尺寸不同，调整大小
            Mat resized = new Mat();
            Imgproc.resize(img2, resized, img1.size());
            img2 = resized;
        }
        
        Mat diff = new Mat();
        Core.absdiff(img1, img2, diff);
        Core.multiply(diff, diff, diff);
        
        Scalar sumScalar = Core.sumElems(diff);
        double sum = sumScalar.val[0];
        
        diff.release();
        
        return sum / (img1.rows() * img1.cols());
    }
    
    // 摄像头信息类
    private static class CameraInfo {
        public int id;
        public String name;
        public boolean isUsb;
        
        public CameraInfo(int id, String name, boolean isUsb) {
            this.id = id;
            this.name = name;
            this.isUsb = isUsb;
        }
    }
}
