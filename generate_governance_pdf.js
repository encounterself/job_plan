const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'databricks-dev-asset-governance-design.pdf');
const FONT = path.join(ROOT, 'assets', 'NotoSansSC-Regular.otf');

const PAGE = {
  width: 595.28,
  height: 841.89,
  left: 44,
  right: 44,
  top: 55,
  bottom: 58,
};
PAGE.contentWidth = PAGE.width - PAGE.left - PAGE.right;

const C = {
  ink: '#1f2937',
  muted: '#64748b',
  navy: '#123b5d',
  teal: '#176b87',
  blue: '#2563eb',
  cyan: '#0f766e',
  line: '#cbd5e1',
  light: '#f8fafc',
  paleBlue: '#eef7fa',
  paleTeal: '#ecfdf5',
  paleAmber: '#fff8e6',
  amber: '#b45309',
  paleRed: '#fff1f2',
  red: '#b91c1c',
  white: '#ffffff',
};

const doc = new PDFDocument({
  size: 'A4',
  margin: 0,
  bufferPages: true,
  info: {
    Title: 'Databricks 开发环境资产治理与企业微信告警',
    Author: 'OpenAI',
    Subject: '当前设计、实施步骤与已知限制',
    Keywords: 'Databricks, 企业微信, 资产治理, 告警, Job, App, Agent',
  },
});
doc.pipe(fs.createWriteStream(OUT));
doc.registerFont('cjk', FONT);
doc.font('cjk');

let currentPage = 1;
let headerTitle = 'Databricks 开发资产治理设计';

function setFont(size = 10, color = C.ink) {
  doc.font('cjk').fontSize(size).fillColor(color);
}

function addHeader() {
  doc.save();
  doc.strokeColor('#dbeafe').lineWidth(0.7);
  doc.moveTo(PAGE.left, 35).lineTo(PAGE.width - PAGE.right, 35).stroke();
  setFont(8, C.muted);
  doc.text(headerTitle, PAGE.left, 22, { width: 300, lineBreak: false });
  doc.text('设计说明 · 2026-09-29', PAGE.width - PAGE.right - 150, 22, {
    width: 150,
    align: 'right',
    lineBreak: false,
  });
  doc.restore();
}

function newPage() {
  doc.addPage();
  currentPage += 1;
  addHeader();
  doc.y = PAGE.top;
}

function ensureSpace(height) {
  if (doc.y + height <= PAGE.height - PAGE.bottom) return;
  newPage();
}

function title(text, size = 20) {
  ensureSpace(size + 26);
  setFont(size, C.navy);
  doc.text(text, PAGE.left, doc.y, { width: PAGE.contentWidth, lineGap: 2 });
  doc.y += 8;
}

function section(text, kicker = '') {
  ensureSpace(44);
  const y = doc.y;
  doc.save();
  doc.roundedRect(PAGE.left, y + 2, 5, 24, 2).fill(C.teal);
  doc.restore();
  setFont(15, C.navy);
  doc.text(text, PAGE.left + 14, y, { width: PAGE.contentWidth - 14, lineGap: 1 });
  doc.y += 8;
  if (kicker) {
    setFont(8.5, C.muted);
    doc.text(kicker, PAGE.left + 14, doc.y, { width: PAGE.contentWidth - 14 });
    doc.y += 6;
  }
}

function paragraph(text, options = {}) {
  const size = options.size || 9.5;
  const width = options.width || PAGE.contentWidth;
  const x = options.x || PAGE.left;
  const lineGap = options.lineGap === undefined ? 3 : options.lineGap;
  setFont(size, options.color || C.ink);
  const h = doc.heightOfString(text, { width, lineGap });
  ensureSpace(h + (options.gap === undefined ? 8 : options.gap));
  doc.text(text, x, doc.y, { width, lineGap, align: options.align || 'left' });
  doc.y += options.gap === undefined ? 8 : options.gap;
}

function bullet(text, options = {}) {
  const size = options.size || 9.2;
  const width = options.width || PAGE.contentWidth - 18;
  const x = options.x || PAGE.left + 16;
  setFont(size, options.color || C.ink);
  const h = doc.heightOfString(text, { width, lineGap: 2 });
  ensureSpace(h + 4);
  doc.circle(x - 8, doc.y + 6, 2.1).fill(options.bulletColor || C.teal);
  doc.text(text, x, doc.y, { width, lineGap: 2 });
  doc.y += options.gap === undefined ? 4 : options.gap;
}

function callout(text, options = {}) {
  const fill = options.fill || C.paleBlue;
  const border = options.border || C.teal;
  const size = options.size || 9.2;
  const padding = 11;
  const width = options.width || PAGE.contentWidth;
  const x = options.x || PAGE.left;
  setFont(size, options.color || C.ink);
  const h = doc.heightOfString(text, { width: width - 2 * padding, lineGap: 3 });
  const boxH = h + padding * 2;
  ensureSpace(boxH + 8);
  const y = doc.y;
  doc.save();
  doc.roundedRect(x, y, width, boxH, 5).fillAndStroke(fill, border);
  doc.rect(x, y, 5, boxH).fill(border);
  doc.restore();
  doc.text(text, x + padding + 2, y + padding - 1, {
    width: width - 2 * padding - 2,
    lineGap: 3,
  });
  doc.y = y + boxH + 8;
}

function drawPill(text, x, y, width, fill, color = C.white, size = 8.5) {
  doc.save();
  doc.roundedRect(x, y, width, 22, 11).fill(fill);
  setFont(size, color);
  doc.text(text, x, y + 6, { width, align: 'center', lineBreak: false });
  doc.restore();
}

function drawBox(x, y, width, height, label, detail = '', options = {}) {
  const fill = options.fill || C.white;
  const stroke = options.stroke || C.line;
  const labelSize = options.labelSize || 9.5;
  const detailSize = options.detailSize || 7.8;
  doc.save();
  doc.roundedRect(x, y, width, height, 6).fillAndStroke(fill, stroke);
  if (options.accent) doc.rect(x, y, 5, height).fill(options.accent);
  doc.restore();
  setFont(labelSize, options.labelColor || C.navy);
  const labelX = x + (options.accent ? 12 : 9);
  doc.text(label, labelX, y + 9, { width: width - (labelX - x) - 9, align: options.align || 'center' });
  if (detail) {
    setFont(detailSize, options.detailColor || C.muted);
    doc.text(detail, labelX, y + 29, {
      width: width - (labelX - x) - 9,
      align: options.align || 'center',
      lineGap: 2,
    });
  }
}

function arrow(x1, y1, x2, y2, color = C.teal, width = 1.4) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 6;
  doc.save();
  doc.strokeColor(color).fillColor(color).lineWidth(width);
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.moveTo(x2, y2).lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  doc.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  doc.closePath().fill();
  doc.restore();
}

function table(headers, rows, widths, options = {}) {
  const fontSize = options.fontSize || 8.2;
  const headerSize = options.headerSize || fontSize;
  const padding = options.padding || 6;
  const total = widths.reduce((a, b) => a + b, 0);
  if (Math.abs(total - PAGE.contentWidth) > 3 && !options.x) {
    throw new Error(`Table widths must sum to ${PAGE.contentWidth}, got ${total}`);
  }
  const x0 = options.x || PAGE.left;
  let y = doc.y;

  function rowHeight(cells, size) {
    let max = 22;
    cells.forEach((cell, i) => {
      setFont(size, C.ink);
      const h = doc.heightOfString(String(cell), { width: widths[i] - padding * 2, lineGap: 2 });
      max = Math.max(max, h + padding * 2);
    });
    return max;
  }

  function drawRow(cells, h, isHeader) {
    let x = x0;
    cells.forEach((cell, i) => {
      doc.save();
      doc.rect(x, y, widths[i], h).fillAndStroke(isHeader ? C.paleBlue : (i % 2 ? C.white : '#fbfdff'), C.line);
      doc.restore();
      setFont(isHeader ? headerSize : fontSize, isHeader ? C.navy : C.ink);
      doc.text(String(cell), x + padding, y + padding - 1, {
        width: widths[i] - padding * 2,
        lineGap: 2,
        align: options.align && options.align[i] ? options.align[i] : 'left',
      });
      x += widths[i];
    });
    y += h;
  }

  let headerH = rowHeight(headers, headerSize);
  let bodyIndex = 0;
  const drawHeader = () => {
    if (y + headerH > PAGE.height - PAGE.bottom) {
      newPage();
      y = doc.y;
    }
    drawRow(headers, headerH, true);
  };

  drawHeader();
  while (bodyIndex < rows.length) {
    const h = rowHeight(rows[bodyIndex], fontSize);
    if (y + h > PAGE.height - PAGE.bottom) {
      doc.y = y;
      newPage();
      y = doc.y;
      drawHeader();
    }
    drawRow(rows[bodyIndex], h, false);
    bodyIndex += 1;
  }
  doc.y = y + (options.gap === undefined ? 10 : options.gap);
}

function codeBlock(lines, options = {}) {
  const text = Array.isArray(lines) ? lines.join('\n') : lines;
  const size = options.size || 7.4;
  const padding = 9;
  setFont(size, C.ink);
  const h = doc.heightOfString(text, { width: PAGE.contentWidth - padding * 2, lineGap: 1.5 });
  const boxH = h + padding * 2;
  ensureSpace(boxH + 8);
  const y = doc.y;
  doc.save();
  doc.roundedRect(PAGE.left, y, PAGE.contentWidth, boxH, 5).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.restore();
  doc.text(text, PAGE.left + padding, y + padding, {
    width: PAGE.contentWidth - padding * 2,
    lineGap: 1.5,
  });
  doc.y = y + boxH + 8;
}

function twoColumnCards(cards, options = {}) {
  const gap = options.gap || 10;
  const colW = (PAGE.contentWidth - gap) / 2;
  const startY = doc.y;
  let maxBottom = startY;
  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAGE.left + col * (colW + gap);
    const y = startY + row * (options.rowHeight || 98);
    const height = options.height || 86;
    doc.save();
    doc.roundedRect(x, y, colW, height, 6).fillAndStroke(card.fill || C.light, card.stroke || C.line);
    doc.restore();
    setFont(10, card.titleColor || C.navy);
    doc.text(card.title, x + 10, y + 10, { width: colW - 20 });
    setFont(8.2, C.ink);
    doc.text(card.body, x + 10, y + 32, { width: colW - 20, lineGap: 2 });
    maxBottom = Math.max(maxBottom, y + height);
  });
  doc.y = maxBottom + 12;
}

function architectureDiagram() {
  ensureSpace(510);
  const x = PAGE.left;
  const w = PAGE.contentWidth;
  const center = x + w / 2;
  let y = doc.y + 4;

  drawPill('每日固定时间', center - 60, y, 120, C.navy);
  y += 34;
  drawBox(center - 124, y, 248, 50, 'Databricks Scheduled Job', 'scan_id · 时区 · 超时 · 重试', {
    fill: '#eff6ff', stroke: '#93c5fd', accent: C.blue,
  });
  arrow(center, y + 50, center, y + 70);
  y += 82;

  const scannerY = y;
  const sw = 150;
  const gap = 18;
  const sx = x + 4;
  drawBox(sx, scannerY, sw, 70, 'Job Scanner', 'Jobs API · 运行记录 · owner', { fill: C.white, accent: C.teal });
  drawBox(sx + sw + gap, scannerY, sw, 70, 'App Scanner', '状态 · 路径 · 资源引用', { fill: C.white, accent: C.teal });
  drawBox(sx + 2 * (sw + gap), scannerY, sw, 70, 'Agent / Workspace', 'Agent 适配器 · 代码 hash', { fill: C.white, accent: C.teal });
  arrow(center, y - 12, sx + sw / 2, scannerY, C.teal);
  arrow(center, y - 12, sx + sw + gap + sw / 2, scannerY, C.teal);
  arrow(center, y - 12, sx + 2 * (sw + gap) + sw / 2, scannerY, C.teal);
  y += 90;

  drawBox(center - 140, y, 280, 54, 'asset_inventory', '统一资产事实层 · 分页入库 · content_hash', {
    fill: C.paleTeal, stroke: '#86efac', accent: C.cyan,
  });
  arrow(sx + sw / 2, scannerY + 70, center - 80, y, C.cyan);
  arrow(sx + sw + gap + sw / 2, scannerY + 70, center, y, C.cyan);
  arrow(sx + 2 * (sw + gap) + sw / 2, scannerY + 70, center + 80, y, C.cyan);
  y += 80;

  drawBox(x + 28, y, 210, 62, 'Rule Engine', '阈值 · 正则 / AST · 白名单 · owner', {
    fill: '#fefce8', stroke: '#fde68a', accent: C.amber,
  });
  drawBox(x + 269, y, 210, 62, 'governance_findings', '状态 · 证据 · 处理人 · 升级', {
    fill: C.paleRed, stroke: '#fecdd3', accent: C.red,
  });
  arrow(center, y - 26, x + 133, y, C.amber);
  arrow(x + 238, y + 31, x + 269, y + 31, C.red);
  y += 88;

  drawBox(x + 28, y, 210, 62, 'notification_outbox', 'message_hash · retry · sent_at', {
    fill: '#f5f3ff', stroke: '#ddd6fe', accent: '#7c3aed',
  });
  drawBox(x + 269, y, 210, 62, 'WeCom Dispatcher', '路由 · 限流 · 错误分类 · 日志', {
    fill: '#f0fdfa', stroke: '#99f6e4', accent: C.teal,
  });
  arrow(x + 133, y - 26, x + 133, y, '#7c3aed');
  arrow(x + 238, y + 31, x + 269, y + 31, C.teal);
  y += 88;

  drawBox(x + 28, y, 210, 62, '负责人应用消息', 'P1/P2 · 逐人 · 需要 userid 映射', {
    fill: '#eff6ff', stroke: '#bfdbfe', accent: C.blue,
  });
  drawBox(x + 269, y, 210, 62, '治理群 Webhook', '日报 / 汇总 / 兜底 · 固定群', {
    fill: '#ecfeff', stroke: '#a5f3fc', accent: C.cyan,
  });
  arrow(x + 374, y - 26, x + 133, y, C.blue);
  arrow(x + 374, y - 26, x + 374, y, C.cyan);
  y += 80;

  doc.save();
  doc.roundedRect(x + 28, y, 451, 31, 5).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.restore();
  setFont(8.2, C.muted);
  doc.text('横向配置：Service Principal 最小权限 · 规则配置 · owner 映射 · Secret Scope / Key Vault', x + 39, y + 9, {
    width: 429,
    align: 'center',
  });
  doc.y = y + 43;
}

function scanFlowDiagram() {
  ensureSpace(365);
  const x = PAGE.left;
  const y = doc.y + 4;
  const w = 91;
  const gap = 10;
  const steps = [
    ['1', '生成批次', 'scan_id'],
    ['2', '扫描资产', '分页 + 重试'],
    ['3', '规则判断', '阈值 + 证据'],
    ['4', '记录告警', 'finding 状态'],
    ['5', '发送通知', '幂等 + 重试'],
  ];
  steps.forEach((step, i) => {
    const bx = x + i * (w + gap);
    drawPill(step[0], bx + 32, y, 27, i < 3 ? C.teal : i === 3 ? C.amber : C.blue);
    drawBox(bx, y + 38, w, 83, step[1], step[2], {
      fill: i === 3 ? C.paleAmber : C.white,
      stroke: i === 3 ? '#fde68a' : C.line,
      labelSize: 8.7,
      detailSize: 7.5,
    });
    if (i < steps.length - 1) arrow(bx + w, y + 80, bx + w + gap - 2, y + 80, C.teal);
  });
  const sy = y + 157;
  setFont(9.5, C.navy);
  doc.text('finding 生命周期', x, sy, { width: PAGE.contentWidth });
  const stateY = sy + 28;
  const states = [
    ['OPEN', C.paleRed, C.red],
    ['PENDING_NOTIFICATION', '#f5f3ff', '#7c3aed'],
    ['SENT / RETRYING', '#eff6ff', C.blue],
    ['ACKNOWLEDGED', C.paleAmber, C.amber],
    ['RESOLVED', C.paleTeal, C.cyan],
  ];
  const sw = 90;
  states.forEach((state, i) => {
    const bx = x + i * (sw + 10);
    drawBox(bx, stateY, sw, 38, state[0], '', { fill: state[1], stroke: state[2], labelSize: 7.2 });
    if (i < states.length - 1) arrow(bx + sw, stateY + 19, bx + sw + 8, stateY + 19, C.muted, 1);
  });
  paragraph('发送失败与限流进入 RETRYING；无效用户、权限错误等不可重试错误进入人工处理队列。问题消失后保留历史并自动关闭。', {
    size: 8.6,
    color: C.muted,
    gap: 0,
  });
}

function mentionDiagram() {
  ensureSpace(280);
  const x = PAGE.left;
  const y = doc.y + 4;
  drawBox(x, y, 155, 70, 'Databricks owner', 'owner_email / username', { fill: '#eff6ff', stroke: '#bfdbfe', accent: C.blue });
  drawBox(x + 176, y, 155, 70, '负责人映射表', '邮箱 · 工号 · userid · 手机号', { fill: C.paleTeal, stroke: '#99f6e4', accent: C.cyan });
  drawBox(x + 352, y, 155, 70, '发送策略', 'P1/P2/P3 路由', { fill: C.paleAmber, stroke: '#fde68a', accent: C.amber });
  arrow(x + 155, y + 35, x + 176, y + 35, C.teal);
  arrow(x + 331, y + 35, x + 352, y + 35, C.teal);
  const yy = y + 105;
  drawBox(x + 72, yy, 185, 63, '群 Webhook', '已知用户标识 → @ 负责人', { fill: '#ecfeff', stroke: '#a5f3fc', accent: C.cyan });
  drawBox(x + 296, yy, 185, 63, '自建应用', 'touser → 逐人详细通知', { fill: '#eff6ff', stroke: '#bfdbfe', accent: C.blue });
  arrow(x + 429, y + 70, x + 164, yy, C.cyan);
  arrow(x + 429, y + 70, x + 388, yy, C.blue);
  paragraph('不要用 AI Bot 最近会话列表推断完整群成员；它只能证明机器人最近接触过哪些会话。', {
    size: 8.8,
    color: C.muted,
    gap: 0,
  });
}

function checklist(items, options = {}) {
  items.forEach((item) => bullet(`${options.prefix || '□'} ${item}`, { size: options.size || 9, bulletColor: options.bulletColor || C.teal }));
}

// Cover page
doc.rect(0, 0, PAGE.width, PAGE.height).fill('#f8fafc');
doc.rect(0, 0, PAGE.width, 185).fill(C.navy);
doc.rect(0, 175, PAGE.width, 10).fill(C.teal);
setFont(11, '#bfdbfe');
doc.text('DAT A BRICKS  ·  GOVERNANCE DESIGN', PAGE.left, 52, { width: PAGE.contentWidth, characterSpacing: 1.1 });
setFont(29, C.white);
doc.text('Databricks 开发环境\n资产治理与企业微信告警', PAGE.left, 92, {
  width: PAGE.contentWidth,
  lineGap: 6,
});
setFont(14, '#dbeafe');
doc.text('当前设计、实施步骤与已知限制', PAGE.left, 184 + 32, { width: PAGE.contentWidth });

drawPill('每日扫描', PAGE.left, 283, 90, C.teal);
drawPill('配置化规则', PAGE.left + 102, 283, 104, C.blue);
drawPill('企业微信通知', PAGE.left + 218, 283, 116, C.amber);
drawPill('只读优先', PAGE.left + 346, 283, 93, '#475569');

callout('目标：每天扫描开发环境资产，识别超过 5 天未迁移、引用 test/tmp 数据、缺少负责人或生产关联等问题，通过可追踪的 finding 和通知队列完成闭环。', {
  x: PAGE.left,
  width: PAGE.contentWidth,
  fill: '#eef7fa',
  border: C.teal,
  size: 10,
});

const coverY = 390;
drawBox(PAGE.left, coverY, 244, 103, '当前验证状态', 'AI Bot 已向 job test 成功发送 Markdown\nCLI 版本 1.3.4 · 受控测试通过', {
  fill: C.white,
  stroke: '#bfdbfe',
  accent: C.blue,
  align: 'left',
  labelSize: 11,
  detailSize: 8.4,
});
drawBox(PAGE.left + 263, coverY, 244, 103, '生产建议', '群 Webhook 做汇总和 @\n自建应用做逐人告警\nSecret 放入 Secret Scope / Key Vault', {
  fill: C.white,
  stroke: '#99f6e4',
  accent: C.cyan,
  align: 'left',
  labelSize: 11,
  detailSize: 8.4,
});

setFont(9, C.muted);
doc.text('版本 1.0  ·  2026 年 9 月 29 日  ·  基于当前工作区方案和企业微信受控测试整理', PAGE.left, 757, {
  width: PAGE.contentWidth,
  align: 'center',
});
setFont(8.3, C.muted);
doc.text('本文不包含任何真实企业微信密钥；已暴露的测试 Secret 应在测试后旋转。', PAGE.left, 782, {
  width: PAGE.contentWidth,
  align: 'center',
});

// Page 2
newPage();
section('1. 执行摘要', '这是一套面向开发环境的“发现—判断—通知—闭环”治理链路。');
paragraph('平台上的 Job、App、Agent、Notebook 等资产通常由实名用户创建，但长期留在开发环境会造成资源浪费、生产迁移不及时、测试数据引用混乱以及负责人不清晰等问题。方案第一阶段只做只读扫描和告警，不自动删除、停止、部署或修改资产。');
callout('推荐决策：用 Databricks Scheduled Job 承担每日调度；扫描结果和告警落到 Unity Catalog Delta 表；扫描与企业微信发送通过 notification_outbox 解耦；生产通知使用“群 Webhook + 自建应用”的组合。', { fill: C.paleTeal, border: C.cyan });
section('当前已验证', '下列结果来自本次受控测试，不等于所有企业微信租户的通用能力。');
checklist([
  '`@wecom/cli` 1.3.4 已安装并完成扫码授权。',
  '测试群 `job test` 已成功收到 Markdown 消息。',
  '当前 AI Bot 发送 schema 没有显式 `@` 字段，也没有群成员列表接口。',
  'AI Bot 最近会话列表只能作为可发送会话范围，不能替代企业通讯录。',
  '当前扫码授权适合开发验证；生产无人值守应使用专用 Webhook / 自建应用凭据。',
]);
section('设计边界');
twoColumnCards([
  { title: '第一阶段做什么', body: '每日扫描、规则判断、finding 去重、通知路由、失败重试、状态留痕。', fill: C.paleBlue, stroke: '#bfdbfe' },
  { title: '第一阶段不做什么', body: '不自动删除资产、不自动停止 Job、不自动发布生产、不自动改代码或表。', fill: C.paleRed, stroke: '#fecdd3' },
  { title: '最关键的三点', body: '定时任务稳定；扫描结果可追溯；企业微信发送有明确通道和重试。', fill: C.paleAmber, stroke: '#fde68a' },
  { title: '扩展方向', body: '多 Workspace、Agent 适配器、工单、确认/豁免、事件驱动和治理看板。', fill: C.paleTeal, stroke: '#99f6e4' },
], { height: 92, rowHeight: 104 });

// Page 3
newPage();
section('2. 总体架构', '扫描器、规则引擎和通知分发器分层，避免一个环节故障拖垮全链路。');
architectureDiagram();
callout('为什么要有 notification_outbox：扫描成功不应依赖企业微信实时可用。扫描任务先落事实和告警，再由通知任务独立重试、去重、限流和升级。', { fill: C.paleAmber, border: C.amber });
section('推荐实现组合');
table(
  ['模块', '推荐实现', '设计要点'],
  [
    ['调度', 'Databricks Lakeflow Job', '固定时区、超时、重试、手动补跑'],
    ['扫描', 'Python Wheel + SDK / REST', '适配器、分页、限流、部分失败隔离'],
    ['存储', 'Unity Catalog Delta', '资产、规则、finding、outbox 独立建表'],
    ['部署', 'DAB', '代码、Job、权限和配置可审计'],
    ['身份', 'Service Principal', '扫描只读；通知密钥独立注入'],
  ],
  [82, 168, 257],
);

// Page 4
newPage();
section('3. 扫描与告警流程', '每一批扫描都必须有唯一批次、可重跑、可追溯和幂等通知。');
scanFlowDiagram();
section('扫描顺序');
table(
  ['步骤', '动作', '输出 / 失败处理'],
  [
    ['1', '创建 scan_id，记录 Workspace、时区和开始时间。', '批次记录；失败可手动补跑'],
    ['2', '分页读取 Job、App、Agent、Workspace File。', 'API 原始结果；按资产类型隔离失败'],
    ['3', '统一资产字段并写入 inventory。', '事实快照；记录 content_hash'],
    ['4', '读取规则、白名单和豁免期限。', '规则版本；可审计'],
    ['5', '生成或更新 finding。', '同一问题更新 last_seen，不重复新建'],
    ['6', '创建 outbox，按优先级路由。', '稳定 message_hash；可重试'],
    ['7', '发送、记录回执并做升级。', 'SENT / RETRYING / RESOLVED'],
  ],
  [38, 248, 221],
);
section('推荐状态');
paragraph('OPEN → PENDING_NOTIFICATION → SENT → ACKNOWLEDGED → RESOLVED；发送失败进入 RETRYING。无效用户、权限错误和配置错误进入人工处理队列，不应无限重试。');

// Page 5
newPage();
section('4. 扫描范围与规则', '先实现可解释、可验收的规则，再逐步提升代码解析精度。');
table(
  ['资产类型', '首期扫描内容', '优先级', '主要限制'],
  [
    ['Job', '元数据、任务定义、运行记录、owner、Git / Bundle、生产关联', 'P0', '需要分页、运行记录和生产目标判定'],
    ['App', '状态、创建者、代码路径、资源引用、更新时间', 'P0', '不同 App 形态的可读字段可能不同'],
    ['Notebook / File', '路径、创建者、更新时间、源代码或 hash', 'P0', '受 Workspace 权限、类型和路径影响'],
    ['Agent', '类型、创建者、更新时间、数据源、权限元数据', 'P1', 'Knowledge Assistant / Genie / Agent Bricks 需分别适配'],
    ['Pipeline / Endpoint', '负责人、环境、更新时间、运行或调用状态', 'P1/P2', '建议在 MVP 稳定后接入'],
  ],
  [104, 194, 55, 154],
  { fontSize: 7.8, headerSize: 8.0 },
);
section('Job 规则口径');
table(
  ['规则 ID', '判断条件', '级别', '处理建议'],
  [
    ['JOB_ASSET_AGE_GT_5D', '资产创建 / 登记超过 5 天，且无生产目标', 'P2', '提醒迁移或补充生产关联'],
    ['JOB_ACTIVE_RUN_GT_5D', '同一运行实例持续超过 5 天', 'P1', '立即确认是否异常运行'],
    ['JOB_NO_PROD_TARGET', '没有生产 Job、DAB target、release 或链接', 'P2', '补充发布关联'],
    ['JOB_NO_OWNER', 'owner 无法解析或已离职', 'P1', '进入人工认领'],
    ['JOB_STALE_30D', '30 天未运行或未更新', 'P3', '低频提醒或清理评估'],
  ],
  [135, 190, 48, 134],
  { fontSize: 7.9, headerSize: 8.0 },
);
callout('“运行大于 5 天”必须拆成资产年龄和单次运行时长两个规则。否则会把“创建很久但没有运行”和“当前运行卡住”混成一个告警。', { fill: C.paleAmber, border: C.amber });

// Page 6
newPage();
section('5. test / tmp 检测与数据模型', '规则先保证可解释，再通过结构化解析降低误报。');
table(
  ['检测层', '示例', 'MVP 做法', '后续增强'],
  [
    ['名称 / 路径', '`test_job`、`/tmp/etl/`、`dev_test_project`', '大小写不敏感正则', '白名单、环境标签'],
    ['代码文本', '`test_catalog.test_schema.table_a`、`tmp_sales`', '保留路径和脱敏命中片段', '注释排除、字符串识别'],
    ['结构化引用', 'SQL 表引用、Python 配置、实际访问表', '列入后续阶段', 'SQL Parser、Python AST、运行历史联合'],
  ],
  [100, 165, 135, 107],
  { fontSize: 7.9, headerSize: 8.0 },
);
section('统一数据模型');
table(
  ['表', '职责', '关键字段'],
  [
    ['asset_inventory', '资产事实快照', 'scan_id、workspace、asset、owner、environment、production_target、content_hash'],
    ['governance_rules', '规则和阈值配置', 'rule_id、severity、enabled、threshold、expression、豁免策略'],
    ['governance_findings', '可追踪治理问题', 'finding_id、rule_id、asset_id、evidence、status、resolved_at'],
    ['notification_outbox', '可靠通知队列', 'channel、receiver、message_hash、status、retry_count、last_error'],
  ],
  [130, 148, 229],
  { fontSize: 7.9, headerSize: 8.0 },
);
codeBlock([
  'finding_key = hash(workspace_id + asset_id + rule_id)',
  'message_hash = hash(finding_key + severity + template_version + evidence_hash)',
  '同一 finding：更新 last_seen_at，不重复生成新问题；同一消息：按策略每日最多发送一次。',
], { size: 7.8 });
callout('告警中不要保存完整源代码或密钥，只保存资产路径、规则、脱敏证据片段和 hash；消息中只展示必要摘要。', { fill: C.paleRed, border: C.red });

// Page 7
newPage();
section('6. 企业微信通道与 @ 设计', '当前 AI Bot 可用于验证；生产应按“群汇总”和“逐人告警”拆分通道。');
table(
  ['通道', '当前能力 / 适用场景', '配置要求', '限制'],
  [
    ['AI Bot（当前）', '已验证向 `job test` 发送 Markdown；适合开发测试、普通群消息', 'Bot ID / Secret 或扫码授权', '当前 schema 无显式 @ 字段；会话列表不是群成员目录'],
    ['群 Webhook', '固定治理群日报、汇总、失败兜底；可按已知标识尝试 @', 'Webhook URL / key、固定群', '固定群；不能替代通讯录；@ 依赖已知用户标识'],
    ['自建应用', '负责人级详细告警、升级、部门或标签路由', 'corp_id、agent_id、corp_secret、可见范围、userid 映射', '需要管理 Token、权限、无效用户和应用可见范围'],
  ],
  [96, 168, 141, 102],
  { fontSize: 7.6, headerSize: 7.9 },
);
section('可靠 @ 的推荐路径');
mentionDiagram();
callout('不要每天从 AI Bot 最近会话列表推断完整群成员。对于实名资产，应维护“Databricks owner → 企业微信用户”的映射，并对离职、改名、无映射和重复用户做单独状态处理。', { fill: C.paleAmber, border: C.amber });
section('通知路由');
table(
  ['级别', '负责人', '治理群', '说明'],
  [
    ['P1', '自建应用立即发送', '同时发摘要', '当前运行超过 5 天、无 owner、生产数据风险'],
    ['P2', '自建应用发送', '日报汇总', '资产年龄、无生产目标、test/tmp 引用'],
    ['P3', '可选', '每日摘要', '长期未运行、低风险治理项'],
  ],
  [60, 145, 115, 187],
  { fontSize: 8.0, headerSize: 8.1 },
);

// Page 8
newPage();
section('7. 配置实施步骤', '从最小可用链路开始，每一步都有输入、动作和验收结果。');
table(
  ['步骤', '需要配置 / 输入', '动作', '完成标志'],
  [
    ['0', 'Workspace、生产边界、时区、扫描时间', '确定范围和“超过 5 天”的最终口径', '需求口径冻结'],
    ['1', 'UC catalog / schema', '创建治理表和权限', '四张表可写入'],
    ['2', 'Service Principal', '配置 Jobs、Apps、Workspace、Agent 最小只读权限', '能分页读取资产'],
    ['3', '扫描适配器', '实现分页、重试、统一字段、部分失败隔离', '资产快照可追溯'],
    ['4', '规则配置', '写入 5 天、test/tmp、owner、白名单和豁免', '规则可改不改代码'],
    ['5', '负责人映射', '邮箱 / 工号 → 企业微信 userid / 手机号', '唯一命中或人工兜底'],
    ['6', '企业微信通道', '测试群 Webhook + 受限可见范围自建应用', '固定测试消息可达'],
    ['7', 'Secret 管理', 'Webhook key、corp secret 放 Secret Scope / Key Vault', '代码和日志无明文密钥'],
    ['8', 'dry_run 测试', '生成预览，再向 `job test` 和测试用户发送', '内容、@、失败分支可验证'],
    ['9', '定时任务', '创建 DAB / Lakeflow Job，设置超时、重试、失败告警', '每日批次稳定执行'],
    ['10', '灰度上线', '观察一周，逐步增加资产和通知范围', '误报和失败率可接受'],
  ],
  [35, 135, 194, 143],
  { fontSize: 7.4, headerSize: 7.8 },
);
section('最小配置清单');
checklist([
  'Databricks：Workspace 地址、Service Principal、UC catalog/schema、扫描任务时区。',
  '规则：阈值、白名单、豁免期限、通知模板、升级天数。',
  '企业微信群：专用测试群、Webhook key、测试窗口。',
  '企业微信应用：corp_id、agent_id、corp_secret、可见范围和测试用户。',
  '映射：Databricks owner_email / username 与企业微信 userid / 手机号。',
  '安全：Secret Scope / Key Vault、dry_run、接收人白名单和发送上限。',
]);

// Page 9
newPage();
section('8. 安全、可靠性与运维', '告警系统本身也必须被治理：密钥、权限、重试和可观测性都要有边界。');
section('密钥与权限');
table(
  ['对象', '建议', '禁止'],
  [
    ['Databricks 扫描身份', 'Service Principal、最小只读权限、按 Workspace 隔离', '使用个人 Token 作为生产长期凭据'],
    ['企业微信密钥', 'Secret Scope / Key Vault 注入，按环境区分', '写入 Notebook、Git、Delta 表或聊天'],
    ['消息日志', '状态、错误码、finding_id、message_hash、时间', '记录 access_token、Secret、完整源代码'],
    ['源代码证据', '路径、行号范围、脱敏片段、hash', '把完整代码或敏感数据发到群里'],
  ],
  [116, 204, 187],
  { fontSize: 8.0, headerSize: 8.2 },
);
section('可靠发送策略');
twoColumnCards([
  { title: '幂等', body: 'finding_key 固定；message_hash 稳定；同一 finding 不重复新建。', fill: C.paleBlue, stroke: '#bfdbfe' },
  { title: '重试', body: '网络、超时和限流指数退避；无效用户、权限错误不无限重试。', fill: C.paleAmber, stroke: '#fde68a' },
  { title: '降级', body: '个人通知失败时保留群摘要；扫描成功不因通知失败而回滚。', fill: C.paleTeal, stroke: '#99f6e4' },
  { title: '观测', body: '记录扫描耗时、资产数、命中数、发送成功率和积压量。', fill: C.paleRed, stroke: '#fecdd3' },
], { height: 92, rowHeight: 104 });
section('建议指标');
table(
  ['指标', '用途', '告警建议'],
  [
    ['scan_success_rate', '判断每日扫描是否完整', '低于 99% 触发平台告警'],
    ['asset_scan_lag', '判断数据新鲜度', '超过 SLA 触发重跑'],
    ['finding_new / resolved', '判断治理趋势', '连续增长需检查误报或整改能力'],
    ['outbox_pending / retrying', '判断通知积压', '超过阈值切换兜底群或人工处理'],
    ['invalid_receiver_rate', '判断 owner 映射质量', '超过阈值推动通讯录修复'],
  ],
  [145, 204, 158],
  { fontSize: 8.0, headerSize: 8.2 },
);

// Page 10
newPage();
section('9. 已知限制与风险', '以下限制需要在设计、验收和运维手册中明确，避免把“可测试”误认为“可生产”。');
section('企业微信限制');
checklist([
  '当前 AI Bot CLI 没有可靠的群成员查询和显式 `@` 字段；不能直接承诺通过当前通道完成指定成员 @。',
  '扫码 / 长连接授权存在短期或续期运维特征；当前适合验证，不适合生产无人值守。',
  '群 Webhook 面向固定群；它不是企业通讯录，也不能自动发现 Databricks 资产负责人。',
  '自建应用需要可见范围、Token 管理和用户映射；无效用户、离职用户必须有人工兜底。',
  'Webhook、自建应用和 AI Bot 是不同能力边界，不能假设一组凭据覆盖所有场景。',
]);
section('Databricks 扫描限制');
checklist([
  'Job、App、Agent、Notebook 的 API 字段不完全一致，Agent 必须按产品类型写适配器。',
  'Workspace 源代码读取受权限、路径和文件类型影响；不建议全量无差别导出。',
  '多 Workspace 需要跨 Workspace 凭据、网络和权限；单 Workspace MVP 不能直接等同于多 Workspace 方案。',
  'API 分页、限流、临时错误和部分资产失败必须单独记录并支持重试。',
  '仅用名称判断已迁移生产会误判；应使用 DAB、release、CI/CD 或显式 production_target。',
]);
section('规则与运营限制');
checklist([
  '正则扫描会把注释、变量名和合法临时表误判为 test/tmp；需要白名单和 AST / SQL Parser 增强。',
  '创建者不一定是长期负责人；owner 解析应支持标签、run_as、Git CODEOWNERS、项目负责人和兜底团队。',
  '没有去重、确认、豁免和升级机制时，每日通知会造成通知疲劳。',
  '第一阶段只提醒，不自动修改、停止或删除；最终整改仍需要责任人和发布流程。',
]);
callout('安全事件提示：本轮测试中曾在对话里提交过凭据样式的字符串。无论测试是否成功，都应在测试后旋转 Secret，并检查审计日志和使用范围。', { fill: C.paleRed, border: C.red, color: C.red });

// Page 11
newPage();
section('10. 分期计划与验收标准', '按单 Workspace、测试群、只读扫描的边界启动，逐步扩大。');
table(
  ['阶段', '范围', '产出'],
  [
    ['Phase 1 · MVP', 'Job、App、Notebook；每日调度；5 天和 test/tmp；群摘要；去重', '资产表、规则表、finding、outbox、日报'],
    ['Phase 2 · 正式治理', 'Agent 适配；自建应用；负责人映射；生产目标；确认 / 豁免 / 升级', '逐人告警、责任闭环、治理周报'],
    ['Phase 3 · 平台化', '多 Workspace、多环境、工单、事件驱动、治理看板', '统一治理服务和趋势指标'],
  ],
  [122, 233, 152],
  { fontSize: 8.0, headerSize: 8.2 },
);
section('第一阶段验收');
checklist([
  '每天固定时间自动执行，失败有重试和平台告警。',
  'Job、App、Notebook / Workspace File 可分页扫描并写入统一模型。',
  'Job 超过 5 天、单次运行超过 5 天和 test/tmp 命中均可追溯到证据。',
  '支持白名单、豁免期限和同一 finding 去重。',
  '测试群能收到日报；测试用户能收到应用消息或明确记录当前通道限制。',
  '消息失败可重试，invalid receiver 不无限重试，所有 Secret 不出现在日志和消息里。',
  '问题消失后能自动标记 RESOLVED，保留审计历史。',
]);
section('关键验收样例');
table(
  ['样例', '预期行为'],
  [
    ['Job 创建 8 天、无生产目标', '生成 P2 finding，负责人收到提醒，治理群日报计数 +1'],
    ['单次运行持续 6 天', '生成 P1 finding，负责人和治理群同时收到高优先级摘要'],
    ['代码引用 test/tmp 表', '保存规则、路径和脱敏证据，不发送完整代码'],
    ['owner 不存在或已离职', '生成 P1 finding，进入人工认领，不循环发送无效用户'],
    ['企业微信暂时失败', 'outbox 进入 RETRYING，扫描结果仍保留，达到上限后人工处理'],
  ],
  [210, 297],
  { fontSize: 8.2, headerSize: 8.3 },
);

// Page 12
newPage();
section('11. 待确认事项与推荐结论', '完成以下确认后即可进入 MVP 实现。');
section('必须先确认');
checklist([
  '“大于 5 天”最终按资产年龄还是单次运行时长；建议拆成两个规则同时支持。',
  '开发和生产是否为独立 Workspace；如果是，生产目标识别需要跨 Workspace 对比。',
  '当前使用 DAB、Git、CI/CD 还是其他发布体系；它决定 production_target 的可信来源。',
  'Agent 的具体类型；不同产品不能复用同一套扫描 API。',
  '是否允许读取 Notebook / Workspace File 源代码；如果不允许，只做元数据和运行访问表检查。',
  '企业微信是否必须逐人 @；如果必须，优先准备 Webhook + 用户映射和自建应用两条通道。',
  '是否需要主管升级、豁免、确认和工单闭环；建议在 Phase 2 开始前确定。',
]);
section('推荐结论');
callout('以单 Workspace、只读扫描、测试群为边界完成 MVP。扫描任务只负责采集和判断，通知通过 notification_outbox 解耦；普通群消息可继续用当前 AI Bot 做验证，生产通知采用群 Webhook + 自建应用组合。逐人 @ 不依赖 AI Bot 的群成员发现，而通过负责人映射表和专用企业微信通道实现。', { fill: C.paleTeal, border: C.cyan, size: 10 });
section('下一步执行清单');
table(
  ['顺序', '动作', '负责人 / 输入'],
  [
    ['1', '冻结 5 天规则口径、Workspace 范围和通知分级。', '平台负责人 + 业务代表'],
    ['2', '创建四张 Delta 表和只读 Service Principal。', 'Databricks 管理员'],
    ['3', '完成 Job Scanner、test/tmp 规则和 dry_run。', '开发实现'],
    ['4', '准备测试群 Webhook、自建应用和负责人映射。', '企业微信管理员'],
    ['5', '部署每日 Job，观察一周后评估误报和通知成功率。', '平台运维'],
  ],
  [48, 286, 173],
  { fontSize: 8.1, headerSize: 8.3 },
);
paragraph('参考工作区文件：`databricks-dev-asset-governance-plan.md`、`wecom/wecom-notification-research.md`、`wecom/wecom_notifier.py`。本文只记录设计和验证结论，不保存真实凭据。', { size: 8.3, color: C.muted, gap: 0 });

// Footer for every page.
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i += 1) {
  doc.switchToPage(i);
  doc.save();
  setFont(7.5, C.muted);
  doc.text(`Databricks 开发资产治理设计  |  ${i + 1} / ${range.count}`, PAGE.left, PAGE.height - 31, {
    width: PAGE.contentWidth,
    align: 'center',
    lineBreak: false,
  });
  doc.restore();
}

doc.end();
console.log(`Created ${OUT}`);
