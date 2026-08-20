const fs = require('fs');
const path = require('path');

const outputDir = path.join(process.cwd(), 'output', 'pdf');
const outputPath = path.join(outputDir, 'AURE_security_audit_report_2026-08-17.pdf');

fs.mkdirSync(outputDir, { recursive: true });

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const contentWidth = pageWidth - margin * 2;
const baseFont = 'Helvetica';
const boldFont = 'Helvetica-Bold';
const monoFont = 'Courier';

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

const pages = [];
let currentPage = [];
let cursorY = pageHeight - margin;

function pushPage() {
  pages.push(currentPage);
  currentPage = [];
  cursorY = pageHeight - margin;
}

function ensureSpace(heightNeeded) {
  if (cursorY - heightNeeded < margin) {
    pushPage();
  }
}

function addTextLine(text, options = {}) {
  const size = options.size || 11;
  const leading = options.leading || Math.round(size * 1.35);
  const x = options.x || margin;
  const font = options.font || baseFont;
  currentPage.push({
    type: 'text',
    text,
    x,
    y: cursorY,
    size,
    font,
  });
  cursorY -= leading;
}

function addWrappedParagraph(text, options = {}) {
  const size = options.size || 11;
  const leading = options.leading || Math.round(size * 1.35);
  const x = options.x || margin;
  const font = options.font || baseFont;
  const maxChars = options.maxChars || Math.max(35, Math.floor((contentWidth - (x - margin)) / (size * 0.52)));
  const lines = wrapText(text, maxChars);
  ensureSpace(lines.length * leading + (options.after || 0));
  for (const line of lines) {
    addTextLine(line, { size, leading, x, font });
  }
  if (options.after) cursorY -= options.after;
}

function addSpacer(height) {
  ensureSpace(height);
  cursorY -= height;
}

function addRule() {
  ensureSpace(12);
  currentPage.push({
    type: 'line',
    x1: margin,
    y1: cursorY,
    x2: pageWidth - margin,
    y2: cursorY,
  });
  cursorY -= 12;
}

function addBullet(text, indent = 18) {
  const bulletX = margin + indent;
  ensureSpace(18);
  addTextLine('-', { x: bulletX, size: 11, font: boldFont, leading: 15 });
  const startY = cursorY + 15;
  cursorY = startY;
  addWrappedParagraph(text, {
    x: bulletX + 12,
    size: 11,
    leading: 15,
    maxChars: 88,
  });
}

function addTable(headers, rows, widths) {
  const rowHeight = 18;
  const tableX = margin;
  const headerHeight = 20;
  ensureSpace(headerHeight + rows.length * rowHeight + 20);
  const yTop = cursorY;

  currentPage.push({ type: 'rect', x: tableX, y: yTop - headerHeight, w: widths.reduce((a, b) => a + b, 0), h: headerHeight, fill: true });

  let x = tableX;
  headers.forEach((header, index) => {
    addCellText(header, x + 4, yTop - 14, widths[index] - 8, boldFont, 9);
    x += widths[index];
  });

  let currentY = yTop - headerHeight;
  rows.forEach((row) => {
    currentY -= rowHeight;
    let colX = tableX;
    row.forEach((cell, index) => {
      addCellText(cell, colX + 4, currentY + 5, widths[index] - 8, baseFont, 8);
      colX += widths[index];
    });
  });

  const totalHeight = headerHeight + rows.length * rowHeight;
  currentPage.push({ type: 'tableGrid', x: tableX, y: yTop, widths, rows: rows.length + 1, rowHeight: 18, totalHeight });
  cursorY = yTop - totalHeight - 12;
}

function addCellText(text, x, y, width, font, size) {
  const maxChars = Math.max(10, Math.floor(width / (size * 0.55)));
  const lines = wrapText(text, maxChars).slice(0, 2);
  lines.forEach((line, idx) => {
    currentPage.push({
      type: 'absoluteText',
      text: line,
      x,
      y: y - idx * 9,
      size,
      font,
    });
  });
}

function buildReport() {
  addTextLine('AURE Security Audit Report', { size: 20, font: boldFont, leading: 24 });
  addTextLine('Browser Extension Security Assessment', { size: 12, font: boldFont, leading: 16 });
  addTextLine('Assessment date: August 17, 2026', { size: 10, leading: 14 });
  addTextLine('Target: AURE_extension source repository', { size: 10, leading: 14 });
  addSpacer(6);
  addRule();

  addWrappedParagraph(
    'Executive summary: The reviewed Manifest V3 extension did not show confirmed remote code execution, direct DOM XSS, or a webpage-to-background postMessage bridge in the current source. The strongest confirmed weaknesses are around authentication token storage, trust of plaintext localhost services, and limited authorization checks around privileged internal messaging.',
    { size: 11, leading: 15, after: 4 }
  );

  addWrappedParagraph(
    'Finding totals: 0 Critical, 0 High, 2 Medium, 2 Low, 0 Informational. Backend-side issues such as IDOR, BOLA, JWT validation, password-reset abuse, and rate limiting could not be fully verified because the backend source was not included in the provided repository.',
    { size: 11, leading: 15, after: 8 }
  );

  addTextLine('Architecture and attack surface', { size: 14, font: boldFont, leading: 18 });
  addBullet('Manifest V3 extension with one service worker, one content script, popup UI, and side panel UI.');
  addBullet('Permissions: storage, activeTab, sidePanel, tabs.');
  addBullet('Host permissions include ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, Copilot, and localhost or 127.0.0.1 backend endpoints.');
  addBullet('Core trust boundaries: webpage DOM -> content script -> background worker -> localhost API -> user account data.');
  addSpacer(6);

  addTextLine('Vulnerability summary', { size: 14, font: boldFont, leading: 18 });
  addTable(
    ['ID', 'Severity', 'Issue', 'Impact'],
    [
      ['AURE-01', 'Medium', 'Session tokens stored in extension-readable storage', 'Account takeover if extension context is compromised'],
      ['AURE-02', 'Medium', 'Plain HTTP localhost auth and API trust', 'Credential capture, token theft, prompt and history exposure'],
      ['AURE-03', 'Low', 'Background handlers lack sender-level authorization checks', 'Sensitive actions available to any compromised internal extension page'],
      ['AURE-04', 'Low', 'Broader tab access and generic prompt injection targeting', 'Larger blast radius after compromise, weaker least-privilege posture'],
    ],
    [62, 64, 220, 212]
  );

  addTextLine('Detailed findings', { size: 14, font: boldFont, leading: 18 });

  const findings = [
    {
      id: 'AURE-01',
      severity: 'Medium',
      title: 'Session tokens are persisted in extension-readable storage',
      cwe: 'CWE-922, CWE-312',
      location: 'src/stores/auth.store.ts and src/lib/cookies.ts',
      problem:
        'The login and session-loading paths copy access tokens into chrome.storage.local under promptiq_token and apiToken, then reuse them automatically in the API client. The cookie helper also falls back to document.cookie when available. This means the extension stores bearer credentials in places readable by extension JavaScript rather than relying solely on server-managed HttpOnly cookies.',
      evidence:
        'auth.store.ts lines 103-117, 169-182, and 243-247; cookies.ts lines 71-75 and 103-107; api/client.ts lines 49-55 and 95-97.',
      impact:
        'If any extension UI context is compromised in the future, the attacker can recover the bearer token and impersonate the user against profile, save, history, and prompt endpoints. This is a realistic account takeover and data exposure path after extension compromise.',
      recommendation:
        'Keep session state only in Secure, HttpOnly, SameSite cookies where possible. Stop copying access tokens into chrome.storage.local. Remove document.cookie fallback for auth tokens, and either enforce the encryptData setting or remove it from the product.',
    },
    {
      id: 'AURE-02',
      severity: 'Medium',
      title: 'The extension trusts plaintext localhost services for auth and API traffic',
      cwe: 'CWE-319, CWE-346',
      location: 'src/api/client.ts, src/lib/cookies.ts, and src/components/auth/AuthView.tsx',
      problem:
        'The default API endpoint is http://127.0.0.1:8000/api/v1, the cookie origin defaults to http://127.0.0.1:8000, and the Google sign-in button opens http://localhost:3000/auth. The extension will also honor a custom advanced.apiEndpoint value without enforcing HTTPS for non-loopback origins.',
      evidence:
        'api/client.ts lines 40-43 and 127-133; cookies.ts line 7 and lines 88-97; AuthView.tsx line 237.',
      impact:
        'A malicious or unexpected local process can impersonate the backend, capture credentials or tokens, and collect prompts or history over plaintext HTTP. If users point the extension at another insecure endpoint, Authorization and X-Current-User headers will be sent there as well.',
      recommendation:
        'Require HTTPS for all non-loopback endpoints, explicitly allow only approved origins, and avoid plain HTTP for authentication flows. Treat localhost as a development-only mode with strong warnings and separate build-time controls.',
    },
    {
      id: 'AURE-03',
      severity: 'Low',
      title: 'Privileged background handlers do not enforce sender-based authorization',
      cwe: 'CWE-285, CWE-639',
      location: 'src/lib/messaging.ts and src/entrypoints/background/index.ts',
      problem:
        'The message router dispatches requests by message type without checking sender.url, sender.id, or intended caller role. Sensitive handlers such as GET_HISTORY, DELETE_PROMPT, UPDATE_SETTINGS, SAVE_VERSION, and FILL_PROMPT assume any caller inside the extension is allowed to use them.',
      evidence:
        'lib/messaging.ts lines 91-114; background/index.ts lines 153-180 and 198-241.',
      impact:
        'I did not find a direct webpage-to-background bridge in the current source, so this is not a confirmed remote exploit from the open web. However, if any extension page is compromised later, sensitive background capabilities are immediately available without further authorization checks.',
      recommendation:
        'Apply per-action authorization in the background worker. Validate sender context and limit high-risk actions to the specific popup, side panel, or trusted content-script origins that need them.',
    },
    {
      id: 'AURE-04',
      severity: 'Low',
      title: 'Tabs permission and generic prompt-fill targeting are broader than necessary',
      cwe: 'CWE-250',
      location: 'manifest.json and src/entrypoints/background/index.ts',
      problem:
        'The extension requests tabs in addition to activeTab and uses FILL_PROMPT logic that enumerates all tabs and then chooses any active HTTP or HTTPS page before falling back to known AI domains. This is broader than the core product need suggested by the supported site list.',
      evidence:
        'manifest.json permissions block; background/index.ts lines 198-237.',
      impact:
        'The broader permission and loose targeting increase the blast radius if the extension is abused internally. It also weakens least-privilege posture by allowing prompt injection targeting logic to consider unrelated browser tabs.',
      recommendation:
        'Prefer activeTab with strict host checks and refuse fill actions outside the supported AI platforms unless the user explicitly enables a controlled custom-site mode.',
    },
  ];

  findings.forEach((finding) => {
    addWrappedParagraph(`${finding.id} - ${finding.title}`, { size: 12, font: boldFont, leading: 16, after: 2 });
    addWrappedParagraph(`Severity: ${finding.severity} | ${finding.cwe}`, { size: 10, font: boldFont, leading: 14 });
    addWrappedParagraph(`Location: ${finding.location}`, { size: 10, font: monoFont, leading: 14 });
    addWrappedParagraph(`What is the problem: ${finding.problem}`, { size: 10, leading: 14 });
    addWrappedParagraph(`Evidence: ${finding.evidence}`, { size: 10, leading: 14 });
    addWrappedParagraph(`Impact: ${finding.impact}`, { size: 10, leading: 14 });
    addWrappedParagraph(`Recommended fix: ${finding.recommendation}`, { size: 10, leading: 14, after: 6 });
  });

  addTextLine('Attack path analysis', { size: 14, font: boldFont, leading: 18 });
  addBullet('Local malicious process -> binds localhost backend endpoint -> receives credentials or bearer token -> accesses user profile, prompts, and saved prompt history.');
  addBullet('Future compromise of popup or side panel code -> reads promptiq_token or apiToken from chrome.storage.local -> reuses bearer token through API client -> unauthorized access to user data.');
  addSpacer(6);

  addTextLine('Security test matrix', { size: 14, font: boldFont, leading: 18 });
  addTable(
    ['Category', 'Result', 'Notes'],
    [
      ['XSS and DOM injection', 'PASS', 'No confirmed exploit path from attacker-controlled input to dangerous DOM sink in current source'],
      ['Message passing', 'PARTIAL', 'No external webpage bridge found, but internal background handlers lack sender-level checks'],
      ['Token security', 'FAIL', 'Bearer tokens persisted in local storage and reused automatically'],
      ['Transport security', 'FAIL', 'Plain HTTP localhost defaults used for auth and API'],
      ['Extension permissions', 'PARTIAL', 'No dangerous web-accessible scripts, but tabs scope is broader than needed'],
      ['Secrets scan', 'PASS', 'No hardcoded secrets found in repository review'],
      ['Dependency audit', 'PARTIAL', 'npm audit could not be completed because the audit endpoint was unreachable in this environment on August 17, 2026'],
      ['Backend authorization', 'NOT VERIFIED', 'Backend source not included, so IDOR or BOLA could not be confirmed from extension code alone'],
    ],
    [122, 72, 310]
  );

  addTextLine('Positive security controls', { size: 14, font: boldFont, leading: 18 });
  addBullet('No externally_connectable configuration was present in the manifest.');
  addBullet('No unsafe eval, Function constructor use, or direct webpage postMessage bridge was identified in the current source.');
  addBullet('Content-script scope is limited to the declared AI platform domains rather than all sites.');
  addSpacer(6);

  addTextLine('Remediation roadmap', { size: 14, font: boldFont, leading: 18 });
  addBullet('P0: Remove token duplication into chrome.storage.local and avoid document.cookie auth fallback.');
  addBullet('P0: Enforce secure transport rules and block insecure custom API endpoints by default.');
  addBullet('P1: Add sender-aware authorization checks for privileged background actions.');
  addBullet('P1: Reduce permissions and tighten prompt-fill tab targeting logic.');
  addBullet('P2: Add explicit threat-model tests for extension trust boundaries and malicious-local-service scenarios.');
  addSpacer(6);

  addTextLine('Verification limits', { size: 14, font: boldFont, leading: 18 });
  addWrappedParagraph(
    'This report is evidence-driven from the provided extension source code only. The backend implementation was not present, so server-side authentication, authorization, rate limiting, JWT handling, and cross-user data access could not be verified from source. The local environment also did not provide the usual PDF rendering toolchain, so final PDF QA was limited to structural checks rather than image-based page rendering.',
    { size: 10, leading: 14, after: 4 }
  );

  addWrappedParagraph('End of report.', { size: 10, font: boldFont, leading: 14 });
  pushPage();
}

function buildPdf() {
  buildReport();

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontObj1 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontObj2 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const fontObj3 = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const pageObjectIds = [];
  const pagesRootPlaceholder = addObject('');

  pages.forEach((page) => {
    let stream = 'BT\n';
    stream += '/F1 11 Tf\n';
    page.forEach((item) => {
      if (item.type === 'text' || item.type === 'absoluteText') {
        const fontKey = item.font === boldFont ? '/F2' : item.font === monoFont ? '/F3' : '/F1';
        stream += `${fontKey} ${item.size} Tf\n`;
        stream += `1 0 0 1 ${item.x.toFixed(2)} ${item.y.toFixed(2)} Tm\n`;
        stream += `(${escapePdfText(item.text)}) Tj\n`;
      }
    });
    stream += 'ET\n';

    page.forEach((item) => {
      if (item.type === 'line') {
        stream += `${item.x1} ${item.y1} m ${item.x2} ${item.y2} l S\n`;
      }
      if (item.type === 'rect') {
        if (item.fill) {
          stream += '0.92 0.94 0.97 rg\n';
          stream += `${item.x} ${item.y} ${item.w} ${item.h} re f\n`;
          stream += '0 0 0 rg\n';
        } else {
          stream += `${item.x} ${item.y} ${item.w} ${item.h} re S\n`;
        }
      }
      if (item.type === 'tableGrid') {
        const bottom = item.y - item.totalHeight;
        stream += `${item.x} ${bottom} ${item.widths.reduce((a, b) => a + b, 0)} ${item.totalHeight} re S\n`;
        let x = item.x;
        item.widths.slice(0, -1).forEach((w) => {
          x += w;
          stream += `${x} ${item.y} m ${x} ${bottom} l S\n`;
        });
        for (let i = 1; i < item.rows; i += 1) {
          const y = item.y - i * item.rowHeight;
          stream += `${item.x} ${y} m ${item.x + item.widths.reduce((a, b) => a + b, 0)} ${y} l S\n`;
        }
      }
    });

    const contentBuffer = Buffer.from(stream, 'utf8');
    const contentId = addObject(`<< /Length ${contentBuffer.length} >>\nstream\n${stream}endstream`);

    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesRootPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R /F3 ${fontObj3} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageObjectIds.push(pageId);
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  objects[pagesRootPlaceholder - 1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${kids}] >>`;
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesRootPlaceholder} 0 R >>`);

  const parts = ['%PDF-1.4\n'];
  const offsets = [0];
  let cursor = parts[0].length;

  objects.forEach((obj, index) => {
    offsets.push(cursor);
    const body = `${index + 1} 0 obj\n${obj}\nendobj\n`;
    parts.push(body);
    cursor += body.length;
  });

  const xrefStart = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  parts.push(xref);
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  fs.writeFileSync(outputPath, parts.join(''), 'binary');
}

buildPdf();
console.log(outputPath);
