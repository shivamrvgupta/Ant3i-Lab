const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs  = require('fs');
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

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for chart canvas to finish drawing
    await page.waitForFunction('window.chartDrawn === true', { timeout: 5000 }).catch(() => {});

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderReportToPDF };
