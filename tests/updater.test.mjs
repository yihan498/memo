// 更新通知里的「这次更新了什么」：从发布说明取第一句
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const load = Module._load;
Module._load = (req, ...rest) => (req === 'electron' ? {} : load(req, ...rest)); // 不启动 Electron
const { noteSummary, isNewer } = require('../src/updater.js');
Module._load = load;

// Windows：electron-updater 给的是 GitHub 渲染好的 HTML
assert.equal(noteSummary('<p>新增贴到屏幕右边。</p>\n<h2>新功能</h2><ul><li>a</li></ul>'), '新增贴到屏幕右边。');
// Mac：GitHub API 给的是 Markdown 原文
assert.equal(noteSummary('\n新增 **贴边** 收起 &amp; 删除\n\n## 新功能\n- a'), '新增 贴边 收起 & 删除');
assert.equal(noteSummary('## 新功能\n- 第一条'), '新功能');
// 某些情况下是 [{version, note}] 数组
assert.equal(noteSummary([{ version: '1.7.0', note: '<p>一句话</p>' }]), '一句话');
// 没有说明 / 太长
assert.equal(noteSummary(null), '');
assert.equal(noteSummary(''), '');
assert.equal(noteSummary('字'.repeat(80)).length, 60);
assert.ok(noteSummary('字'.repeat(80)).endsWith('…'));
// 版本比较
assert.ok(isNewer('v1.7.0', '1.6.2'));
assert.ok(!isNewer('v1.6.2', '1.6.2'));
assert.ok(isNewer('v1.10.0', '1.9.2'));
console.log('updater tests passed');
