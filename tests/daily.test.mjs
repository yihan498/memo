import assert from 'node:assert/strict';
const m = await import("../src/renderer/services/dailyManager.js");
const r = await import("../src/renderer/services/records.js");
const t = (text, type, completed, o = {}) => ({ id: text, text, type, completed, completedAt: null, ...o });
let s = { tasks: [t('背单词','daily',true), t('运动','daily',false), t('买纸','todo',false)], checkTime: '21:30' };

// 首次启动只记日期
s = m.rollover(s, new Date(2026,10,3,10,0)); assert.equal(s.lastResetDate, '2026-11-03');
assert.equal(m.rollover(s, new Date(2026,10,3,23,59)), s);
// 晚间检查
assert.equal(m.pendingCheck(s, new Date(2026,10,3,21,29)), null);
assert.deepEqual(m.pendingCheck(s, new Date(2026,10,3,21,30)).map(x=>x.text), ['运动']);
assert.equal(m.pastCheckTime(s, new Date(2026,10,3,21,30)), true);
s.lastNotifiedDate = '2026-11-03';
assert.equal(m.pendingCheck(s, new Date(2026,10,3,22,0)), null);

// 跨天：记录每一项、重置，不带「上次未完成」到第二天
s = m.rollover(s, new Date(2026,10,4,0,1));
const h = s.dailyHistory['2026-11-03'];
assert.equal(h.total, 2); assert.equal(h.done, 1); assert.deepEqual(h.missed, ['运动']);
assert.deepEqual(h.items.map(i => [i.text, i.done]), [['背单词', true], ['运动', false]]);
assert.deepEqual(s.tasks.map(x=>[x.text,x.completed,'missedLast' in x]), [['背单词',false,false],['运动',false,false],['买纸',false,false]]);

// 最近7天圆点
const d = m.recentDays(s, new Date(2026,10,4,9,0));
assert.equal(d[5].status, 'missed'); assert.equal(d[6].status, 'today'); assert.equal(d[0].status, 'none');

// --- 计时 ---
let c = { tasks: [t('阅读','daily',false,{ targetMin: 30 }), t('跑步','daily',false,{ targetMin: 20 })], lastResetDate: '2026-11-04' };
c = m.startTimer(c, '阅读', new Date(2026,10,4,9,0));
c = m.stopTimer(c, '阅读', new Date(2026,10,4,9,20));
assert.equal(m.elapsedMs(c.tasks[0]), 20 * 60000);
c = m.startTimer(c, '阅读', new Date(2026,10,4,14,0));
// 可以同时计时：开始另一个不会停掉正在计时的
c = m.startTimer(c, '跑步', new Date(2026,10,4,14,5));
assert.ok(c.tasks[0].runningSince && c.tasks[1].runningSince);
c = m.stopTimer(c, '阅读', new Date(2026,10,4,14,5));
assert.equal(c.tasks[0].runningSince, null);
assert.equal(c.tasks[0].sessions.length, 2);
assert.equal(m.elapsedMs(c.tasks[0]), 25 * 60000);
// 还差 5 分钟 → 不达标
assert.equal(m.applyTimers(c, new Date(2026,10,4,14,10).getTime()).reached.length, 0);
c = m.startTimer(c, '阅读', new Date(2026,10,4,15,0));
let res = m.applyTimers(c, new Date(2026,10,4,15,5).getTime());
assert.deepEqual(res.reached.map(x => x.text), ['阅读', '跑步']); // 跑步 14:05–15:00 也达标
c = res.state; assert.equal(c.tasks[0].completed, true);
// 手动取消勾选后不再被自动勾上
c = { ...c, tasks: c.tasks.map(x => x.id === '阅读' ? { ...x, completed: false } : x) };
assert.equal(m.applyTimers(c, new Date(2026,10,4,15,30).getTime()).reached.length, 0);
c = { ...c, tasks: c.tasks.map(x => x.id === '阅读' ? { ...x, completed: true } : x) };
// 跨天：仍在计时的按 24:00 截断，并记录分钟和时间段
c = m.rollover(c, new Date(2026,10,5,8,0));
const it = c.dailyHistory['2026-11-04'].items[0];
assert.equal(it.targetMin, 30);
assert.equal(it.minutes, 25 + 9 * 60); // 15:00 → 24:00
assert.equal(it.sessions.length, 3);
assert.deepEqual(c.tasks.map(x => [x.completed, x.sessions.length, x.runningSince, x.autoDone]), [[false,0,null,false],[false,0,null,false]]);

// --- 倒计时：到点自动停表，结束时间 = 恰好用完的那一刻 ---
let cd = { tasks: [t('刷题', 'daily', false, { targetMin: 60, countdown: true, sessions: [], runningSince: null })] };
cd = m.startTimer(cd, '刷题', new Date(2026,10,4,9,0));
cd = m.stopTimer(cd, '刷题', new Date(2026,10,4,9,40));
cd = m.startTimer(cd, '刷题', new Date(2026,10,4,10,0));
assert.equal(m.remainingMs(cd.tasks[0], new Date(2026,10,4,10,5).getTime()), 15 * 60000);
assert.equal(m.applyTimers(cd, new Date(2026,10,4,10,19).getTime()).reached.length, 0);
res = m.applyTimers(cd, new Date(2026,10,4,10,30).getTime()); // 电脑睡了 10 分钟才醒
assert.equal(res.reached.length, 1);
const ct = res.state.tasks[0];
assert.equal(ct.runningSince, null);
assert.equal(ct.completed, true);
assert.equal(m.elapsedMs(ct), 60 * 60000);           // 不多记
assert.equal(new Date(ct.sessions[1].end).getHours() * 60 + new Date(ct.sessions[1].end).getMinutes(), 10 * 60 + 20);
// 正计时型达标后不停表
let up = { tasks: [t('阅读', 'daily', false, { targetMin: 10, sessions: [], runningSince: null })] };
up = m.startTimer(up, '阅读', new Date(2026,10,4,9,0));
assert.notEqual(m.applyTimers(up, new Date(2026,10,4,9,15).getTime()).state.tasks[0].runningSince, null);

// --- 记录统计 ---
const st = {
    dailyHistory: {
        '2026-11-01': { total: 2, done: 2, missed: [], items: [{ text: 'A', done: true }, { text: 'B', done: true, targetMin: 30, minutes: 35 }] },
        '2026-11-02': { total: 2, done: 1, missed: ['B'], items: [{ text: 'A', done: true }, { text: 'B', done: false, targetMin: 30, minutes: 10 }] }
    },
    tasks: [t('A','daily',true), t('B','daily',false,{ targetMin: 30 })],
    todoLog: [{ id: 'x', text: 'x', completedAt: '2026-11-02T10:00:00', dueAt: '2026-11-02T12:00' }, { id: 'y', text: 'y', completedAt: '2026-10-01T10:00:00' }]
};
const now = new Date(2026,10,3,12,0);
const rec = r.buildRecords(st, '2026-11-01', '2026-11-03', now);
assert.deepEqual(rec.days.map(x => x.key), ['2026-11-03', '2026-11-02', '2026-11-01']);
assert.equal(rec.summary.days, 2); assert.equal(rec.summary.perfectDays, 1);
assert.equal(rec.summary.rate, 75); assert.equal(rec.summary.minutes, 45);
assert.equal(rec.summary.todoDone, 1); assert.equal(rec.summary.todoOnTime, 1);
assert.deepEqual(rec.perTask.map(p => [p.text, p.done, p.total]), [['B', 1, 2], ['A', 2, 2]]);
assert.deepEqual(r.presetRange('7', st, now), ['2026-10-28', '2026-11-03']);
assert.deepEqual(r.presetRange('all', st, now), ['2026-10-01', '2026-11-03']);
assert.equal(r.fmtMin(95), '1 小时 35 分');

// --- 月历 ---
assert.equal(r.shiftMonth('2026-01', -1), '2025-12');
assert.equal(r.shiftMonth('2026-11', 2), '2027-01');
const st2 = { ...st, tasks: st.tasks.concat([
    { id: 'p', type: 'todo', text: '计划', completed: false, plannedAt: '2026-11-05T09:00' },
    { id: 'd', type: 'todo', text: '截止', completed: false, dueAt: '2026-11-02T18:00' },
    { id: 'z', type: 'todo', text: '已完成不重复', completed: true, dueAt: '2026-11-05T18:00' }
]) };
const mo = r.buildMonth(st2, '2026-11', now);
assert.equal(mo.cells.length % 7, 0);
assert.equal(mo.cells[0].key, '2026-10-26');               // 2026-11-01 是周日 → 前面补 6 天，周一开头
const cell = k => mo.cells.find(x => x.key === k);
assert.equal(cell('2026-11-01').routine.done, 2);
assert.ok(cell('2026-11-03').isToday && cell('2026-11-03').routine.today);
assert.ok(cell('2026-11-04').future && !cell('2026-11-04').routine);
assert.equal(cell('2026-10-31').routine, null);               // 上月格子不带常规
assert.deepEqual(cell('2026-11-02').todos.map(x => [x.text, x.kind]), [['x', 'done'], ['截止', 'overdue']]);
assert.deepEqual(cell('2026-11-05').todos.map(x => x.kind), ['planned']);
assert.equal(mo.summary.todoDone, 1);
const dd = r.dayDetail(st2, '2026-11-02', now);
assert.equal(dd.week, '周一'); assert.equal(dd.routine.done, 1); assert.equal(dd.todos.length, 2);
console.log('ALL PASS');
