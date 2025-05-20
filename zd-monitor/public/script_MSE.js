let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let statusText = document.getElementById('status');

let sampleClosed = null;
let sampleOpenGood = null;

function onOpenCvReady() {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
  });

  document.getElementById('captureClosed').onclick = () => {
    sampleClosed = captureFrameMat();
    statusText.innerText = "已儲存關模具樣本";
  };

  document.getElementById('captureOpenGood').onclick = () => {
    sampleOpenGood = captureFrameMat();
    statusText.innerText = "已儲存開模具（合格）樣本";
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

    let label = "未定義";

    if (scoreClosed < 500) {
      label = "關模具";
    } else if (scoreOpen < 500) {
      label = "開模具（合格）";
    } else {
      label = "開模具（不合格）";
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.font = "20px Arial";
    ctx.fillStyle = "red";
    ctx.fillText(label, 10, 30);
    statusText.innerText = "狀態：" + label;

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
