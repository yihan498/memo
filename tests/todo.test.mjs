import assert from 'node:assert/strict';
import { sortTodos, quadrantOf, dueState, shortTime, dueReminders } from '../src/renderer/services/todoSort.js';

const now = new Date(2026, 10, 3, 12, 0).getTime();
const mk = (text, o = {}) => ({ id: text, text, completed: false, createdAt: '2026-11-01T00:00:00Z', ...o });

// 截止状态
assert.equal(dueState(mk('a', { dueAt: '2026-11-03T11:00' }), now), 'overdue');
assert.equal(dueState(mk('a', { dueAt: '2026-11-04T10:00' }), now), 'soon');
assert.equal(dueState(mk('a', { dueAt: '2026-11-10T10:00' }), now), null);
assert.equal(dueState(mk('a', { dueAt: '2026-11-03T11:00', completed: true }), now), null);

// 象限：截止临近自动算紧急
assert.equal(quadrantOf(mk('a', { important: true, urgent: true }), now), 0);
assert.equal(quadrantOf(mk('a', { important: true }), now), 1);
assert.equal(quadrantOf(mk('a', { important: true, dueAt: '2026-11-04T10:00' }), now), 0);
assert.equal(quadrantOf(mk('a', { urgent: true }), now), 2);
assert.equal(quadrantOf(mk('a'), now), 3);

// 排序：象限 → 截止 → 计划；已完成沉底
const list = [
    mk('杂事'),
    mk('已完成', { important: true, urgent: true, completed: true, completedAt: '2026-11-03T01:00:00Z' }),
    mk('重要晚截止', { important: true, dueAt: '2026-11-20T10:00' }),
    mk('重要早截止', { important: true, dueAt: '2026-11-10T10:00' }),
    mk('重要无截止', { important: true }),
    mk('急', { urgent: true }),
    mk('重要且急', { important: true, urgent: true })
];
assert.deepEqual(sortTodos(list, now).map(t => t.text),
    ['重要且急', '重要早截止', '重要晚截止', '重要无截止', '急', '杂事', '已完成']);

assert.equal(shortTime('2026-11-05T18:00', new Date(now)), '11/05 18:00');
assert.equal(shortTime('2027-01-02T08:05', new Date(now)), '2027/01/02 08:05');
assert.equal(shortTime(null), '');

// 截止提醒
const r = (o) => mk('r', { type: 'todo', dueAt: '2026-11-03T13:00', ...o });
assert.equal(dueReminders([r({ remindBefore: 60 })], now).length, 1);          // 12:00 = 13:00 前 1h
assert.equal(dueReminders([r({ remindBefore: 0 })], now).length, 0);           // 截止时，还没到
assert.equal(dueReminders([r({ remindBefore: null })], now).length, 0);        // 不提醒
assert.equal(dueReminders([r({ remindBefore: 60, completed: true })], now).length, 0);
assert.equal(dueReminders([r({ remindBefore: 60, remindedFor: '2026-11-03T13:00|60' })], now).length, 0); // 已提醒过
assert.equal(dueReminders([r({ remindBefore: 60, remindedFor: '2026-11-03T12:30|60' })], now).length, 1); // 改了截止 → 重新提醒
assert.equal(dueReminders([mk('d', { type: 'daily', dueAt: '2026-11-03T13:00', remindBefore: 60 })], now).length, 0);

console.log('todo: ALL PASS');
