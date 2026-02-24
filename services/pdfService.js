const puppeteer = require('puppeteer');
const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');

async function renderReportToPDF(reportData) {
  // Read local assets so they can be inlined (Puppeteer has no Express server to fetch from)
  const publicDir = path.join(__dirname, '..', 'public');
  const inlineCSS = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
  const inlineJS  = fs.readFileSync(path.join(publicDir, 'chart.js'),   'utf8');

  const templatePath = path.join(__dirname, '..', 'views', 'report-view.ejs');
  const html = await ejs.renderFile(templatePath, {
    ...reportData,
    forPDF: true,
    inlineCSS,
    inlineJS,
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // A4 width at 96 dpi ≈ 794px; give a tall initial height for layout
    await page.setViewport({ width: 794, height: 1200, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for all canvas charts to finish drawing
    await page.waitForFunction('window.chartDrawn === true', { timeout: 8000 }).catch(() => {});

    // Measure the full rendered height — this becomes the single-page height
    const contentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );

    const pdfBuffer = await page.pdf({
      width:           '210mm',
      height:          `${contentHeight}px`,   // dynamic → always 1 page
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderReportToPDF };
