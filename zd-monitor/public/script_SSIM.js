let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let statusText = document.getElementById('status');

let sampleClosed = null;
let sampleOpenGood = null;

function onOpenCvReady() {
  navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
  });

  document.getElementById('captureClosed').onclick = () => {
    sampleClosed = captureProcessedROI();
    statusText.innerText = '已儲存關模具樣本';
  };

  document.getElementById('captureOpenGood').onclick = () => {
    sampleOpenGood = captureProcessedROI();
    statusText.innerText = '已儲存開模具（合格）樣本';
  };

  setInterval(() => {
    if (!sampleClosed || !sampleOpenGood) return;

    let currentROI = captureProcessedROI();

    let ssimClosed = compareSSIM(currentROI, sampleClosed);
    let ssimOpen = compareSSIM(currentROI, sampleOpenGood);

    let label = '未定義';

    if (ssimClosed > 0.9) {
      label = '關模具';
    } else if (ssimOpen > 0.9) {
      label = '開模具（合格）';
    } else {
      label = '開模具（不合格）';
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.font = '20px Arial';
    ctx.fillStyle = 'red';
    ctx.fillText(label, 10, 30);

    statusText.innerText = '狀態：' + label;

    currentROI.delete();
  }, 1000);
}

function captureProcessedROI() {
  let frame = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  frame.data.set(imageData.data);

  let gray = new cv.Mat();
  cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

  let x = (gray.cols - 160) / 2;
  let y = (gray.rows - 120) / 2;
  let roi = gray.roi(new cv.Rect(x, y, 160, 120));

  gray.delete();
  frame.delete();
  return roi;
}

function compareSSIM(img1, img2) {
  let mu1 = new cv.Mat(),
    mu2 = new cv.Mat();
  let sigma1 = new cv.Mat(),
    sigma2 = new cv.Mat(),
    sigma12 = new cv.Mat();

  let kernel = new cv.Size(11, 11);
  let sigma = 1.5;

  cv.GaussianBlur(img1, mu1, kernel, sigma);
  cv.GaussianBlur(img2, mu2, kernel, sigma);

  let mu1_sq = new cv.Mat(),
    mu2_sq = new cv.Mat(),
    mu1_mu2 = new cv.Mat();
  cv.multiply(mu1, mu1, mu1_sq);
  cv.multiply(mu2, mu2, mu2_sq);
  cv.multiply(mu1, mu2, mu1_mu2);

  let img1_sq = new cv.Mat(),
    img2_sq = new cv.Mat(),
    img1_img2 = new cv.Mat();
  cv.multiply(img1, img1, img1_sq);
  cv.multiply(img2, img2, img2_sq);
  cv.multiply(img1, img2, img1_img2);

  cv.GaussianBlur(img1_sq, sigma1, kernel, sigma);
  cv.GaussianBlur(img2_sq, sigma2, kernel, sigma);
  cv.GaussianBlur(img1_img2, sigma12, kernel, sigma);

  let C1 = 6.5025,
    C2 = 58.5225;

  let t1 = new cv.Mat(),
    t2 = new cv.Mat(),
    t3 = new cv.Mat(),
    t4 = new cv.Mat();
  cv.subtract(sigma1, mu1_sq, sigma1);
  cv.subtract(sigma2, mu2_sq, sigma2);
  cv.subtract(sigma12, mu1_mu2, sigma12);

  cv.addWeighted(mu1_mu2, 2, new cv.Mat(), 0, C1, t1);
  cv.addWeighted(sigma12, 2, new cv.Mat(), 0, C2, t2);
  cv.multiply(t1, t2, t3);

  cv.add(mu1_sq, mu2_sq, t1);
  cv.add(
    t1,
    new cv.Mat(img1.rows, img1.cols, img1.type(), new cv.Scalar(C1)),
    t1
  );
  cv.add(sigma1, sigma2, t2);
  cv.add(
    t2,
    new cv.Mat(img1.rows, img1.cols, img1.type(), new cv.Scalar(C2)),
    t2
  );
  cv.multiply(t1, t2, t4);

  let ssimMap = new cv.Mat();
  cv.divide(t3, t4, ssimMap);
  let mean = cv.mean(ssimMap)[0];

  [
    mu1,
    mu2,
    sigma1,
    sigma2,
    sigma12,
    mu1_sq,
    mu2_sq,
    mu1_mu2,
    img1_sq,
    img2_sq,
    img1_img2,
    t1,
    t2,
    t3,
    t4,
    ssimMap,
  ].forEach((m) => m.delete());

  return mean;
}
