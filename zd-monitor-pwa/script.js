let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let statusText = document.getElementById('status');
let cameraSelect = document.getElementById('cameraSource');

let sampleClosed = null;
let sampleOpenGood = null;
let currentStream = null;
let availableCameras = [];

// 获取所有可用摄像头设备
async function getCameraDevices() {
  try {
    // 先请求一次摄像头权限，以确保获取到完整的设备信息
    const initialStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    // 获取完设备信息后停止这个流
    initialStream.getTracks().forEach((track) => track.stop());

    // 现在可以获取完整的设备信息了
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log('可用设备:', devices);
    return devices.filter((device) => device.kind === 'videoinput');
  } catch (error) {
    console.error('获取摄像头设备失败:', error);
    return [];
  }
}

// 刷新摄像头列表
async function refreshCameraList() {
  console.log('开始刷新摄像头列表');
  statusText.innerText = '正在搜索攝像頭設備...';

  try {
    const devices = await getCameraDevices();
    availableCameras = devices;

    console.log('找到摄像头数量:', devices.length);

    // 保存当前选择的值
    const currentSelected = cameraSelect.value;

    // 清空并重建选择器选项
    cameraSelect.innerHTML = '';

    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.text = '默認攝像頭';
    cameraSelect.appendChild(defaultOption);

    // 添加所有检测到的摄像头
    let hasSelectedDevice = false;

    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;

      // 使用设备标签（如果可用）
      if (device.label) {
        const isUsbCamera = device.label.toLowerCase().includes('usb');
        option.text = isUsbCamera
          ? `USB 外接攝像頭 (${device.label})`
          : `攝像頭 ${index + 1} (${device.label})`;
      } else {
        option.text = `攝像頭 ${index + 1}`;
      }

      // 如果是之前选择的摄像头，选中它
      if (device.deviceId === currentSelected) {
        option.selected = true;
        hasSelectedDevice = true;
      }

      cameraSelect.appendChild(option);
      console.log(`添加摄像头选项: ${option.text}, ID: ${device.deviceId}`);
    });

    // 如果之前选择的设备不再可用，使用默认摄像头
    if (!hasSelectedDevice && devices.length > 0) {
      switchCamera(devices.length > 0 ? devices[0].deviceId : 'default');
    } else if (currentStream === null) {
      // 如果当前没有激活的视频流，初始化一个
      switchCamera();
    }

    statusText.innerText =
      devices.length > 0
        ? `找到 ${devices.length} 個攝像頭設備`
        : '未找到可用的攝像頭設備';

    return devices;
  } catch (error) {
    console.error('刷新摄像头列表失败:', error);
    statusText.innerText = '搜索攝像頭失敗: ' + error.message;
    return [];
  }
}

// 根据选择切换摄像头
async function switchCamera(cameraId = '') {
  try {
    // 如果当前有流在运行，停止它
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    // 准备摄像头约束条件
    let constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    // 如果指定了有效的摄像头ID，使用它
    if (cameraId && cameraId !== 'default' && cameraId.trim() !== '') {
      console.log('使用指定的摄像头ID:', cameraId);
      constraints.video.deviceId = { exact: cameraId };
    } else {
      console.log('使用默认摄像头');
    }

    // 获取新的媒体流
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    currentStream = stream;

    // 记录当前使用的摄像头信息
    const videoTrack = stream.getVideoTracks()[0];
    console.log('当前使用的摄像头:', videoTrack.label);

    // 重置样本状态
    if (sampleClosed || sampleOpenGood) {
      sampleClosed = null;
      sampleOpenGood = null;
      statusText.innerText = '切換攝像頭後，請重新拍攝樣本';
    } else {
      statusText.innerText = '攝像頭已準備就緒';
    }

    return true;
  } catch (error) {
    console.error('切换摄像头失败:', error);
    // 如果指定的摄像头不可用，尝试使用默认摄像头
    if (cameraId && cameraId !== 'default') {
      console.log('指定的摄像头不可用，尝试使用默认摄像头');
      statusText.innerText = '指定的攝像頭不可用，嘗試使用默認攝像頭';
      return switchCamera('default');
    } else {
      statusText.innerText = '切換攝像頭失敗: ' + error.message;
      return false;
    }
  }
}

function onOpenCvReady() {
  // 初始化摄像头和设置刷新按钮
  refreshCameraList();

  // 设置摄像头选择器的变更事件
  cameraSelect.onchange = function () {
    const selectedId = this.value;
    console.log('用户选择了摄像头:', selectedId);
    switchCamera(selectedId);
  };

  // 设置刷新摄像头按钮
  document.getElementById('refreshCameras').onclick = refreshCameraList;

  document.getElementById('captureClosed').onclick = () => {
    sampleClosed = captureFrameMat();
    statusText.innerText = '已儲存關模具樣本';
  };

  document.getElementById('captureClosed').onclick = () => {
    sampleClosed = captureFrameMat();
    statusText.innerText = '已儲存關模具樣本';
  };

  document.getElementById('captureOpenGood').onclick = () => {
    sampleOpenGood = captureFrameMat();
    statusText.innerText = '已儲存開模具（合格）樣本';
  };

  setInterval(() => {
    if (!sampleClosed || !sampleOpenGood) return;

    let currentFrame = captureFrameMat();
    let grayCurrent = new cv.Mat();
    let graySampleClosed = new cv.Mat();
    let graySampleOpen = new cv.Mat();

    cv.cvtColor(currentFrame, grayCurrent, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(sampleClosed, graySampleClosed, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(sampleOpenGood, graySampleOpen, cv.COLOR_RGBA2GRAY);

    let scoreClosed = mse(grayCurrent, graySampleClosed);
    let scoreOpen = mse(grayCurrent, graySampleOpen);

    let label = '未定義';

    if (scoreClosed < 500) {
      label = '關模具';
    } else if (scoreOpen < 500) {
      label = '開模具（合格）';
    } else {
      label = '開模具（不合格）';
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.font = '72px Arial';
    ctx.fillStyle = 'red';
    ctx.fillText(label, 50, 100);
    statusText.innerText = '狀態：' + label;

    grayCurrent.delete();
    graySampleClosed.delete();
    graySampleOpen.delete();
    currentFrame.delete();
  }, 1000);
}

function captureFrameMat() {
  let mat = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  mat.data.set(imageData.data);
  return mat.clone(); // Return a clone so we can reuse the mat
}

function mse(img1, img2) {
  let err = 0;
  for (let i = 0; i < img1.data.length; i++) {
    let diff = img1.data[i] - img2.data[i];
    err += diff * diff;
  }
  return err / img1.data.length;
}
