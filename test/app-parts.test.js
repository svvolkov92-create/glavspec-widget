'use strict';
// src/renderer/app.js is built from its parts (src/renderer/app/*.js): an edit made only in one of them
// (or only in app.js) is caught here, not on someone's computer.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { isBuilt } = require('../tools/build-app.js');

test('app.js is built from src/renderer/app/*.js', () => {
  const now = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  assert.ok(isBuilt(now), 'src/renderer/app.js differs from its parts — edit the parts and run: node tools/build-app.js');
});

test('styles.css is built from src/renderer/styles/*.css', () => {
  const { isCssBuilt } = require('../tools/build-app.js');
  const now = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
  assert.ok(isCssBuilt(now), 'src/renderer/styles.css differs from its parts — edit src/renderer/styles/*.css and run: node tools/build-app.js');
});
