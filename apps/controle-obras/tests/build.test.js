'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('build · index.html está em dia com src/', () => {
  const r = spawnSync('python3', ['build.py', '--check'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
