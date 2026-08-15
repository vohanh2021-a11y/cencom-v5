#!/usr/bin/env node
/**
 * check-tokens.js — Validate CSS tokens (globals.css) ↔ Design System (MASTER.md)
 *
 * Chạy: node "E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\scripts\check-tokens.js"
 *
 * Kiểm tra:
 * 1. Mỗi CSS variable trong :root của globals.css có tồn tại trong MASTER.md
 * 2. Giá trị màu sắc khớp (hex format)
 * 3. Typography base ≥ 16px
 * 4. Line-height body ≥ 1.5
 *
 * Exit code: 0 = OK, 1 = có lỗi token mismatch
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSS_FILE = path.join(PROJECT_ROOT, 'apps/web/app/globals.css');
const MD_FILE = path.join(PROJECT_ROOT, 'design-system/cencomos-gara/MASTER.md');

let errors = 0;
let warnings = 0;

// --- Parse CSS variables from globals.css (only :root block = light mode base) ---
const cssContent = fs.readFileSync(CSS_FILE, 'utf-8');
// Extract only the :root { ... } block (first occurrence)
const rootMatch = cssContent.match(/:root\s*\{([^}]*)\}/);
const rootBlock = rootMatch ? rootMatch[1] : cssContent;
const cssVarRegex = /--([a-zA-Z-]+):\s*([^;]+);/g;
const cssVars = {};
let match;
while ((match = cssVarRegex.exec(rootBlock)) !== null) {
  const name = match[1];
  let value = match[2].trim();
  cssVars[name] = value;
}

// --- Parse color palette from MASTER.md (only the first/light mode table) ---
const mdContent = fs.readFileSync(MD_FILE, 'utf-8');
// Match table rows with exactly 3 columns: | Role | `#HEX` | `--c-var` |
const mdTableRegex = /^\| ([^|]+?) \| `(#[0-9A-Fa-f]{6})` \| `--c-([^`]+)` \|$/gm;
const mdColors = {};
while ((match = mdTableRegex.exec(mdContent)) !== null) {
  const role = match[1].trim();
  const hex = match[2];
  const varName = match[3];
  mdColors[`c-${varName}`] = { role, hex };
}

// --- Check 1: Color tokens match ---
console.log('Màu sắc (colors):');
for (const [varName, mdColor] of Object.entries(mdColors)) {
  const cssValue = cssVars[varName];
  if (!cssValue) {
    console.log(`  [WARN] ${varName} — CSS variable không tìn thấy trong globals.css`);
    warnings++;
  } else {
    // Normalize hex for comparison
    const cssHex = cssValue.replace(/;/g, '').trim();
    if (cssHex.toLowerCase() !== mdColor.hex.toLowerCase()) {
      console.log(`  [ERR] ${varName} — CSS: ${cssHex} ≠ MD: ${mdColor.hex} (${mdColor.role})`);
      errors++;
    } else {
      console.log(`  [OK] ${varName} — ${mdColor.hex} (${mdColor.role})`);
    }
  }
}

// Also check CSS vars that are in globals.css but not in MD
for (const varName of Object.keys(cssVars)) {
  if (varName.startsWith('c-') && !mdColors[varName]) {
    // Check if it's a derived color (light/subtle variant)
    const isVariant = varName.includes('-light') || varName.includes('-lighter') || varName.includes('-subtle') || varName.includes('-bg');
    if (!isVariant) {
      console.log(`  [WARN] CSS có ${varName} — chưa có trong MASTER.md`);
      warnings++;
    }
  }
}

// --- Check 2: Typography base ≥ 16px ---
const textBaseMatch = cssContent.match(/--text-base:\s*clamp\([^,]+,\s*[^,]+,\s*([0-9]+)px\)/);
if (textBaseMatch) {
  const maxSize = parseInt(textBaseMatch[1]);
  console.log(`\nTypography:`);
  if (maxSize < 16) {
    console.log(`  [ERR] --text-base max là ${maxSize}px < 16px (WCAG mobile)`);
    errors++;
  } else {
    console.log(`  [OK] --text-base max: ${maxSize}px (>= 16px ✓)`);
  }
}

// --- Check 3: Line-height body ≥ 1.5 ---
const lineHeightMatch = cssContent.match(/body\s*\{[^}]*line-height:\s*([0-9.]+)\s*[^}]*\}/);
console.log(`\nLine-height:`);
if (!lineHeightMatch) {
  console.log(`  [ERR] body không có line-height`);
  errors++;
} else {
  const lh = parseFloat(lineHeightMatch[1]);
  if (lh < 1.5) {
    console.log(`  [ERR] body line-height: ${lh} < 1.5`);
    errors++;
  } else {
    console.log(`  [OK] body line-height: ${lh} (>= 1.5 ✓)`);
  }
}

// --- Check 4: prefers-reduced-motion ---
console.log(`\nReduced motion:`);
if (cssContent.includes('prefers-reduced-motion: reduce')) {
  console.log(`  [OK] prefers-reduced-motion có trong CSS`);
} else {
  console.log(`  [ERR] Thiếu @media (prefers-reduced-motion: reduce)`);
  errors++;
}

// --- Check 5: focus-visible ---
console.log(`\nFocus states:`);
if (cssContent.includes('focus-visible') || cssContent.includes('focus:not-sr-only')) {
  console.log(`  [OK] Focus states có trong CSS`);
} else {
  console.log(`  [ERR] Thiếu focus-visible styles`);
  errors++;
}

// --- Summary ---
console.log(`\n=== Kết quả ===`);
console.log(`  ERR: ${errors} | WARN: ${warnings}`);
if (errors > 0) {
  console.log(`  ❌ Có lỗi token mismatch — cần sync globals.css ↔ MASTER.md`);
  process.exit(1);
} else {
  console.log(`  ✅ Tokens đồng bộ hoàn toàn`);
  process.exit(0);
}
