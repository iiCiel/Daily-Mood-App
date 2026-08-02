#!/usr/bin/env node
/**
 * Repair a Daily Mood backup JSON that was truncated (e.g. cut off by the
 * Android clipboard size limit). Salvages every complete record and drops the
 * incomplete tail, then writes valid JSON that "restore from file" can read.
 *
 *   node scripts/repair-backup.js <input.json> [output.json]
 *
 * If the input is already valid, it is passed through unchanged.
 */
const fs = require('fs');
const path = require('path');

const [, , inPath, outPathArg] = process.argv;
if (!inPath) {
  console.error('usage: node scripts/repair-backup.js <input.json> [output.json]');
  process.exit(1);
}
if (!fs.existsSync(inPath)) {
  console.error(`file not found: ${inPath}`);
  process.exit(1);
}

let raw = fs.readFileSync(inPath, 'utf8');
// Strip a UTF-8 BOM and any leading junk before the opening brace.
raw = raw.replace(/^﻿/, '');
const firstBrace = raw.indexOf('{');
if (firstBrace > 0) raw = raw.slice(firstBrace);

const outPath = outPathArg || inPath.replace(/\.json$/i, '') + '.repaired.json';

function summarize(obj) {
  const counts = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) counts[key] = value.length;
    else if (value && typeof value === 'object') {
      // workouts is an object of arrays
      const inner = {};
      for (const [k2, v2] of Object.entries(value)) if (Array.isArray(v2)) inner[k2] = v2.length;
      if (Object.keys(inner).length) counts[key] = inner;
    }
  }
  return counts;
}

// Already valid? Nothing to repair.
try {
  const parsed = JSON.parse(raw);
  console.log('Input is already valid JSON — no repair needed.');
  console.log('Records found:', JSON.stringify(summarize(parsed), null, 2));
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8');
  console.log(`\nWrote normalized copy to: ${outPath}`);
  process.exit(0);
} catch (err) {
  console.log(`Input does not parse: ${err.message}`);
  console.log(`Length: ${raw.length.toLocaleString()} characters. Attempting salvage...\n`);
}

/**
 * Scan the raw text tracking string/escape state and bracket depth, recording
 * the index just after every structurally complete value that sits at a
 * "safe" close point. Then rebuild by cutting at the deepest safe point and
 * closing whatever is still open.
 */
function salvage(text) {
  const stack = [];
  let inString = false;
  let escaped = false;
  // For each open container, the index just past the last completed element.
  const lastGood = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { stack.push(ch); lastGood.push(-1); continue; }

    if (ch === '}' || ch === ']') {
      stack.pop();
      lastGood.pop();
      if (lastGood.length) lastGood[lastGood.length - 1] = i + 1;
      continue;
    }

    if (ch === ',' && lastGood.length) {
      lastGood[lastGood.length - 1] = i; // safe cut point: just before this comma
    }
  }

  if (!stack.length) return null; // balanced already

  // Cut at the last completed element of the innermost still-open container.
  let cut = -1;
  for (let i = lastGood.length - 1; i >= 0; i--) {
    if (lastGood[i] > 0) { cut = lastGood[i]; break; }
  }
  if (cut <= 0) return null;

  let repaired = text.slice(0, cut).replace(/,\s*$/, '');

  // Close containers that are still open, innermost first.
  // Recompute depth for the truncated slice.
  const closers = [];
  const stack2 = [];
  let s2 = false, e2 = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (s2) {
      if (e2) e2 = false;
      else if (ch === '\\') e2 = true;
      else if (ch === '"') s2 = false;
      continue;
    }
    if (ch === '"') { s2 = true; continue; }
    if (ch === '{' || ch === '[') stack2.push(ch);
    else if (ch === '}' || ch === ']') stack2.pop();
  }
  while (stack2.length) closers.push(stack2.pop() === '{' ? '}' : ']');

  return repaired + closers.join('');
}

const repaired = salvage(raw);
if (!repaired) {
  console.error('Could not salvage this file — the damage is too early in the data.');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(repaired);
} catch (err) {
  console.error(`Salvage attempt still does not parse: ${err.message}`);
  process.exit(1);
}

const counts = summarize(parsed);
console.log('Salvage succeeded. Recovered records:');
console.log(JSON.stringify(counts, null, 2));

const total = Object.values(counts).reduce(
  (sum, v) => sum + (typeof v === 'number' ? v : Object.values(v).reduce((a, b) => a + b, 0)),
  0
);
console.log(`\nTotal records recovered: ${total}`);
const lost = raw.length - repaired.length;
if (lost > 0) {
  console.log(`Discarded ${lost.toLocaleString()} characters of incomplete trailing data.`);
}
console.log('NOTE: records that were cut off before the truncation point cannot be recovered —');
console.log('this salvages everything that survived intact, not the whole original backup.');

if (!parsed.app) {
  parsed.app = 'Daily Mood';
  console.log('\nNote: re-added missing "app" field.');
}

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8');
console.log(`\nWrote repaired backup to: ${outPath}`);
