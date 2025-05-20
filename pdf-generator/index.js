const generator = require('@pdfme/generator');
const fs = require('fs');
const path = require('path');
const templateSchemas = require('./templates/schemas.json');
const inputs = require('./templates/input.json');

const FONT_PATH = path.join(
  __dirname,
  'fonts/genshingothic-20150607/GenShinGothic-Normal.ttf'
);
const font = {
  sans: {
    data: fs.readFileSync(FONT_PATH),
    fallback: true,
  },
};

const templatePdfPath = path.join(__dirname, 'templates/template.pdf');
const templatePDF = fs.readFileSync(templatePdfPath);

const template = {
  basePdf: templatePDF,
  schemas: templateSchemas,
};

generator
  .generate({
    template,
    inputs,
    options: { font },
  })
  .then((pdf) => {
    fs.writeFileSync(path.join(__dirname, `test.pdf`), pdf);
  });
