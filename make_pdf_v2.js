const fs = require('fs');
const PDFDocument = require('pdfkit');

const html = fs.readFileSync('databricks-rag-官方核验版.html', 'utf8');
const font = 'assets/NotoSansSC-Regular.otf';
const out = 'databricks-rag-官方核验版.pdf';

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const blocks = [];
const re = /<(h1|h2|h3|p|li|pre)[^>]*>([\s\S]*?)<\/\1>/gi;
let match;
while ((match = re.exec(html))) {
  const kind = match[1].toLowerCase();
  let text = decode(match[2].replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim());
  if (text) blocks.push({ kind, text });
}

const doc = new PDFDocument({ size: 'A4', margins: { top: 54, bottom: 54, left: 54, right: 54 }, bufferPages: true });
doc.pipe(fs.createWriteStream(out));
doc.registerFont('cjk', font);
doc.font('cjk');

function footer() {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#64748b').text(`Databricks 新一代 RAG 实施指南  |  ${i + 1}`, 54, 790, { width: 487, align: 'center' });
  }
}

for (const block of blocks) {
  if (block.kind === 'h1') {
    doc.fontSize(25).fillColor('#123b5d').text(block.text, { align: 'left', paragraphGap: 12 });
  } else if (block.kind === 'h2') {
    doc.moveDown(0.6).fontSize(16).fillColor('#176b87').text(block.text, { paragraphGap: 8 });
  } else if (block.kind === 'h3') {
    doc.moveDown(0.35).fontSize(12).fillColor('#315f73').text(block.text, { paragraphGap: 5 });
  } else if (block.kind === 'pre') {
    doc.fontSize(7.6).fillColor('#111827').text(block.text, { indent: 8, width: 475, lineGap: 1, paragraphGap: 7 });
  } else if (block.kind === 'li') {
    doc.fontSize(9.5).fillColor('#1f2937').text(`• ${block.text}`, { indent: 8, width: 475, lineGap: 2, paragraphGap: 2 });
  } else {
    doc.fontSize(9.5).fillColor('#1f2937').text(block.text, { width: 487, lineGap: 2, paragraphGap: 6 });
  }
}

footer();
doc.end();
