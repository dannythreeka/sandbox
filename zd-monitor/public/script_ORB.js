let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

let closedSample = null;
let openGoodSample = null;

let cap;
let src;
let dst;
let orb;
let bfMatcher;

function onOpenCvReady() {
  document.getElementById('opencv-status').innerText = '✅ OpenCV 已載入';
  startCamera();
}

function startCamera() {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      video.onloadedmetadata = () => {
        setTimeout(onCameraReady, 500); // 等待 video 寬高準備好
      };
    })
    .catch((err) => {
      alert('無法開啟相機：' + err);
    });
}

function onCameraReady() {
  video.width = video.videoWidth;
  video.height = video.videoHeight;
  canvas.width = video.width;
  canvas.height = video.height;

  cap = new cv.VideoCapture(video);
  src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
  dst = new cv.Mat();

  orb = new cv.ORB();
  bfMatcher = new cv.BFMatcher();

  document.getElementById('captureClosed').onclick = () => {
    closedSample = captureAndExtractFeatures();
    document.getElementById('status').innerText = '✅ 已拍攝關模樣本';
  };

  document.getElementById('captureOpenGood').onclick = () => {
    openGoodSample = captureAndExtractFeatures();
    document.getElementById('status').innerText = '✅ 已拍攝開模合格樣本';
  };

  requestAnimationFrame(processVideo);
}

function captureAndExtractFeatures() {
  cap.read(src);
  cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
  let keypoints = new cv.KeyPointVector();
  let descriptors = new cv.Mat();
  orb.detectAndCompute(dst, new cv.Mat(), keypoints, descriptors);
  return { keypoints, descriptors };
}

function matchFeatures(des1, des2) {
  if (!des1 || !des2 || des1.empty() || des2.empty()) return 0;

  let matches = new cv.DMatchVectorVector();
  bfMatcher.knnMatch(des1, des2, matches, 2);

  let goodMatches = 0;
  for (let i = 0; i < matches.size(); i++) {
    let m = matches.get(i).get(0);
    let n = matches.get(i).get(1);
    if (m.distance < 0.75 * n.distance) goodMatches++;
  }
  matches.delete();
  return goodMatches;
}

function processVideo() {
  cap.read(src);
  src.copyTo(dst);
  cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY);

  let liveKeypoints = new cv.KeyPointVector();
  let liveDescriptors = new cv.Mat();
  orb.detectAndCompute(dst, new cv.Mat(), liveKeypoints, liveDescriptors);

  let closedScore = closedSample
    ? matchFeatures(liveDescriptors, closedSample.descriptors)
    : 0;
  let openScore = openGoodSample
    ? matchFeatures(liveDescriptors, openGoodSample.descriptors)
    : 0;

  let statusText = '無樣本';
  if (closedSample && openGoodSample) {
    if (closedScore > openScore && closedScore > 8) {
      statusText = '關模具';
    } else if (openScore > closedScore && openScore > 8) {
      statusText = '開模（合格）';
    } else {
      statusText = '開模（不合格）';
    }
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, 30);
  ctx.fillStyle = 'lime';
  ctx.font = '20px sans-serif';
  ctx.fillText(statusText, 10, 22);
  document.getElementById('status').innerText = statusText;

  liveKeypoints.delete();
  liveDescriptors.delete();

  requestAnimationFrame(processVideo);
}
