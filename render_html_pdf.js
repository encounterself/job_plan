const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.goto('file:///home/sandbox-agent/workspace/databricks-rag-官方核验版.html', { waitUntil: 'networkidle' });
  await page.pdf({
    path: 'databricks-rag-官方核验版.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
})();
