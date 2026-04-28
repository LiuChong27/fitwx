#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { parse: parseSfc, compileTemplate } = require('@vue/compiler-sfc');
const babelParser = require('@babel/parser');

const ROOT = process.cwd();
const TARGET_DIRS = ['pages', 'components', 'common', 'services'];
const TARGET_EXTS = new Set(['.vue', '.nvue', '.js', '.ts']);
const report = [];

function walk(dir, acc) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, acc);
      continue;
    }
    if (entry.isFile() && TARGET_EXTS.has(path.extname(entry.name))) {
      acc.push(abs);
    }
  }
}

function getLineCol(source, index) {
  const prefix = source.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function addIssue(filePath, type, message, line = 1, col = 1, snippet = '') {
  report.push({
    file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    type,
    message,
    line,
    col,
    snippet: snippet.trim().slice(0, 220),
  });
}

function parseScript(filePath, source, kind) {
  try {
    babelParser.parse(source, {
      sourceType: 'unambiguous',
      errorRecovery: false,
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
        'objectRestSpread',
        'decorators-legacy',
      ],
    });
  } catch (err) {
    const loc = err.loc || { line: 1, column: 0 };
    addIssue(filePath, `${kind}-syntax`, err.message, loc.line, (loc.column || 0) + 1);
  }
}

function scanFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (err) {
    addIssue(filePath, 'encoding-invalid-utf8', err.message, 1, 1);
  }

  const text = buf.toString('utf8');

  if (text.includes('\uFFFD')) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const col = lines[i].indexOf('\uFFFD');
      if (col !== -1) {
        addIssue(filePath, 'encoding-replacement-char', 'Found replacement character U+FFFD', i + 1, col + 1, lines[i]);
      }
    }
  }

  const pollutionPatterns = [
    /'[\p{L}\p{N}\u4E00-\u9FFF][^'\r\n]*'[ \t]*[A-Za-z_$][A-Za-z0-9_$]*[ \t]*'/gu,
    /"[\p{L}\p{N}\u4E00-\u9FFF][^"\r\n]*"[ \t]*[A-Za-z_$][A-Za-z0-9_$]*[ \t]*"/gu,
  ];
  for (const re of pollutionPatterns) {
    let m = re.exec(text);
    while (m) {
      const { line, col } = getLineCol(text, m.index);
      addIssue(filePath, 'string-pollution', `Suspicious token near ${JSON.stringify(m[0])}`, line, col, m[0]);
      m = re.exec(text);
    }
  }

  const ext = path.extname(filePath);
  if (ext === '.js' || ext === '.ts') {
    parseScript(filePath, text, 'script');
    return;
  }

  const sfc = parseSfc(text, { filename: rel });
  if (sfc.errors?.length) {
    for (const err of sfc.errors) {
      if (typeof err === 'string') {
        addIssue(filePath, 'sfc-parse', err, 1, 1);
        continue;
      }
      const loc = err.loc?.start || { line: 1, column: 0 };
      addIssue(filePath, 'sfc-parse', err.message || String(err), loc.line, (loc.column || 0) + 1);
    }
  }

  const { descriptor } = sfc;
  if (descriptor.template?.content) {
    const tpl = compileTemplate({
      source: descriptor.template.content,
      filename: rel,
      id: 'scan-project-quality',
    });
    if (tpl.errors?.length) {
      for (const err of tpl.errors) {
        if (typeof err === 'string') {
          addIssue(filePath, 'template-compile', err, 1, 1);
          continue;
        }
        const loc = err.loc?.start || { line: 1, column: 0 };
        addIssue(filePath, 'template-compile', err.message || String(err), loc.line, (loc.column || 0) + 1);
      }
    }
  }

  if (descriptor.script?.content) {
    parseScript(filePath, descriptor.script.content, 'sfc-script');
  }
  if (descriptor.scriptSetup?.content) {
    parseScript(filePath, descriptor.scriptSetup.content, 'sfc-script-setup');
  }
}

const files = [];
for (const dir of TARGET_DIRS) {
  walk(path.join(ROOT, dir), files);
}

for (const file of files) {
  scanFile(file);
}

report.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
});

const summary = report.reduce((acc, cur) => {
  acc[cur.type] = (acc[cur.type] || 0) + 1;
  return acc;
}, {});

const result = {
  scannedFiles: files.length,
  issueCount: report.length,
  summary,
  issues: report,
};

const outputPath = path.join(ROOT, 'scan-report.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

console.log(`scannedFiles=${result.scannedFiles}`);
console.log(`issueCount=${result.issueCount}`);
console.log(`report=${path.relative(ROOT, outputPath).replace(/\\/g, '/')}`);
if (result.issueCount > 0) {
  console.log('summary=', JSON.stringify(summary));
}
