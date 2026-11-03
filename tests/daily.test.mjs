import assert from 'node:assert/strict';
const m = await import("../src/renderer/services/dailyManager.js");
const t = (text, type, completed) => ({ id: text, text, type, completed, completedAt: null });
let s = { tasks: [t('背单词','daily',true), t('运动','daily',false), t('买纸','todo',false)], checkTime: '21:30' };

// 首次启动只记日期
s = m.rollover(s, new Date(2026,10,3,10,0)); assert.equal(s.lastResetDate, '2026-11-03');
// 同一天不变
assert.equal(m.rollover(s, new Date(2026,10,3,23,59)), s);
// 21:29 不提醒，21:30 提醒运动
assert.equal(m.pendingCheck(s, new Date(2026,10,3,21,29)), null);
assert.deepEqual(m.pendingCheck(s, new Date(2026,10,3,21,30)).map(x=>x.text), ['运动']);
s.lastNotifiedDate = '2026-11-03';
assert.equal(m.pendingCheck(s, new Date(2026,10,3,22,0)), null); // 当天只提醒一次
// 跨天：记录历史、重置、打标记；todo 不动
s = m.rollover(s, new Date(2026,10,4,0,1));
assert.deepEqual(s.dailyHistory['2026-11-03'], { total: 2, done: 1, missed: ['运动'] });
assert.deepEqual(s.tasks.map(x=>[x.text,x.completed,!!x.missedLast]), [['背单词',false,false],['运动',false,true],['买纸',false,false]]);
assert.equal(m.pendingCheck(s, new Date(2026,10,4,21,30)).length, 2); // 新的一天可再提醒
// 最近7天圆点
const d = m.recentDays(s, new Date(2026,10,4,9,0));
assert.equal(d.length, 7); assert.equal(d[5].status, 'missed'); assert.equal(d[6].status, 'today'); assert.equal(d[0].status, 'none');
// 全完成 → done
s.tasks.forEach(x=>{ if(x.type==='daily') x.completed=true; });
s = m.rollover(s, new Date(2026,10,5,8,0));
assert.equal(m.recentDays(s, new Date(2026,10,5,8,0))[5].status, 'done');
assert.equal(s.tasks.find(x=>x.text==='运动').missedLast, false);
// 跨月 + 60天清理
s.dailyHistory['2026-08-01'] = {total:1,done:1,missed:[]};
s = m.rollover(s, new Date(2026,11,1,8,0));
assert.ok(!('2026-08-01' in s.dailyHistory)); assert.ok('2026-11-05' in s.dailyHistory);
console.log('ALL PASS');
