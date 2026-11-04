import assert from 'node:assert/strict';
import { parseTodo, cnNum } from '../src/renderer/services/quickParse.js';

// 2026-11-04 周三 12:00
const now = new Date(2026, 10, 4, 12, 0);
const p = s => parseTodo(s, now);
const pick = (r, keys) => Object.fromEntries(keys.map(k => [k, r[k]]));
const K = ['text', 'area', 'important', 'urgent', 'dueAt', 'plannedAt', 'remindBefore'];
const base = { area: null, important: false, urgent: false, dueAt: null, plannedAt: null, remindBefore: null };
const eq = (s, exp) => assert.deepEqual(pick(p(s), K), { ...base, ...exp }, s);

assert.equal(cnNum('十二'), 12);
assert.equal(cnNum('二十'), 20);
assert.equal(cnNum('两'), 2);

// 完整一句
eq('明天下午3点前把 Memo 的 bug 修完 #产品 重要 提前1小时提醒',
    { text: '把 Memo 的 bug 修完', area: '产品', important: true, dueAt: '2026-11-05T15:00', remindBefore: 60 });
// 只有日期：计划 → 9:00；截止 → 23:59，默认提前 1 小时提醒
eq('周五交周报', { text: '交周报', plannedAt: '2026-11-06T09:00' });
eq('周五前交周报', { text: '交周报', dueAt: '2026-11-06T23:59', remindBefore: 60 });
// 周几已过 → 下周；「下周一」
eq('周一复盘', { text: '复盘', plannedAt: '2026-11-09T09:00' });
eq('下周一上午10点开会', { text: '开会', plannedAt: '2026-11-09T10:00' });
eq('这周三晚上8点半看书', { text: '看书', plannedAt: '2026-11-04T20:30' });
// 没说上下午：1–7 点按下午；8 点以后已过 → 明天
eq('3点半给妈妈打电话', { text: '给妈妈打电话', plannedAt: '2026-11-04T15:30' });
eq('9点开会', { text: '开会', plannedAt: '2026-11-05T09:00' });
eq('15:30 开会', { text: '开会', plannedAt: '2026-11-04T15:30' });
// 具体日期 + ddl 在后 / 在前
eq('论文初稿 ddl 11月8号 紧急', { text: '论文初稿', urgent: true, dueAt: '2026-11-08T23:59', remindBefore: 60 });
eq('截止12月1日 交材料', { text: '交材料', dueAt: '2026-12-01T23:59', remindBefore: 60 });
eq('8号前缴费', { text: '缴费', dueAt: '2026-11-08T23:59', remindBefore: 60 });
eq('3号前缴费', { text: '缴费', dueAt: '2026-12-03T23:59', remindBefore: 60 }); // 本月 3 号已过 → 下月
// 「提醒」→ 截止 + 到点提醒
eq('两小时后提醒我喝水', { text: '喝水', dueAt: '2026-11-04T14:00', remindBefore: 0 });
eq('明天9点提醒我交表', { text: '交表', dueAt: '2026-11-05T09:00', remindBefore: 0 });
eq('半小时后取快递', { text: '取快递', plannedAt: '2026-11-04T12:30' });
// 时段 + 分区
eq('今晚看书 #学习', { text: '看书', area: '学习', plannedAt: '2026-11-04T20:00' });
eq('明早跑步', { text: '跑步', plannedAt: '2026-11-05T08:00' });
// 提醒的各种写法
eq('周五前交报告 提前一天提醒', { text: '交报告', dueAt: '2026-11-06T23:59', remindBefore: 1440 });
eq('周五前交报告 不提醒', { text: '交报告', dueAt: '2026-11-06T23:59' });
eq('重要紧急 回复导师邮件', { text: '回复导师邮件', important: true, urgent: true });
// 「重要的」不算优先级；什么都没识别 → 原样
eq('整理重要的文件', { text: '整理重要的文件' });
eq('买牙膏', { text: '买牙膏' });
eq('记得买牙膏', { text: '买牙膏' });
// hits 给界面展示
assert.deepEqual(p('明天下午3点前修 bug #产品 重要').hits, ['分区 产品', '重要', '截止 11-05 15:00', '提前 1 小时提醒']);

console.log('parse tests passed');
