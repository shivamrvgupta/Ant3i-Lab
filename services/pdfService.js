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

  // On macOS, puppeteer's bundled Chromium can crash (kern failure 5).
  // Prefer system Chrome/Chromium when available.
  const CHROME_PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const executablePath = process.platform === 'darwin'
    ? CHROME_PATHS.find(p => fs.existsSync(p))
    : undefined;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Emulate print media BEFORE rendering so @media print CSS is applied
    // from the start — charts draw at compact print sizes (140px, 80px)
    await page.emulateMediaType('print');

    // A4 width at 96 dpi ≈ 794px
    await page.setViewport({ width: 794, height: 1200, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for all canvas charts to finish drawing at compact sizes
    await page.waitForFunction('window.chartDrawn === true', { timeout: 8000 }).catch(() => {});

    // Measure the compact content height — becomes the single-page height
    // No PDF margins so the full height is available as printable area
    const contentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );

    const pdfBuffer = await page.pdf({
      width:           '210mm',
      height:          `${contentHeight}px`,  // always 1 page
      printBackground: true,
      margin:          { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderReportToPDF };
