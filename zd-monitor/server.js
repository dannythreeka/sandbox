const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// 靜態資源資料夾 (改成你的專案資料夾名稱)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`HTTP server running at http://localhost:${port}`);
});
