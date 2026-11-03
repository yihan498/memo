// 「记录」页的统计：纯函数，输入 state + 日期范围，输出汇总 / 每项 / 每天。
import { dateKey, shiftKey, todayRecord } from './dailyManager.js';

const WEEK = '日一二三四五六';

export function weekdayOfKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return '周' + WEEK[new Date(y, m - 1, d).getDay()];
}

/** 预设范围 → [from, to]（含两端，'YYYY-MM-DD'） */
export function presetRange(preset, state, now = new Date()) {
    const today = dateKey(now);
    if (preset === '7') return [shiftKey(today, -6), today];
    if (preset === '30') return [shiftKey(today, -29), today];
    if (preset === 'month') return [today.slice(0, 8) + '01', today];
    const keys = Object.keys(state.dailyHistory || {}).sort();
    const logKeys = (state.todoLog || []).map(l => dateKey(new Date(l.completedAt))).sort();
    const first = [keys[0], logKeys[0], today].filter(Boolean).sort()[0];
    return [first, today];
}

export function buildRecords(state, from, to, now = new Date()) {
    const today = dateKey(now);
    const history = state.dailyHistory || {};
    const days = [];
    for (let k = to; k >= from; k = shiftKey(k, -1)) {
        const rec = k === today ? todayRecord(state, now) : history[k];
        if (rec) days.push({ key: k, week: weekdayOfKey(k), ...rec });
        if (days.length > 3660) break;
    }

    const closed = days.filter(d => !d.today); // 今天还没结束，不计入完成率
    const per = new Map();
    let itemTotal = 0, itemDone = 0, minutes = 0;
    for (const d of days) {
        for (const it of d.items || []) {
            if (it.minutes) minutes += it.minutes;
            if (d.today) continue;
            const p = per.get(it.text) || { text: it.text, total: 0, done: 0, minutes: 0, timed: false };
            p.total++; if (it.done) p.done++;
            if (it.targetMin) { p.timed = true; p.minutes += it.minutes || 0; }
            per.set(it.text, p);
        }
    }
    for (const d of closed) { itemTotal += d.total; itemDone += d.done; }

    const log = (state.todoLog || []).filter(l => {
        const k = dateKey(new Date(l.completedAt));
        return k >= from && k <= to;
    });

    return {
        days,
        summary: {
            days: closed.length,
            perfectDays: closed.filter(d => d.total && d.done === d.total).length,
            itemTotal, itemDone,
            rate: itemTotal ? Math.round((itemDone / itemTotal) * 100) : null,
            minutes,
            todoDone: log.length,
            todoOnTime: log.filter(l => l.dueAt && new Date(l.completedAt) <= new Date(l.dueAt)).length,
            todoWithDue: log.filter(l => l.dueAt).length
        },
        perTask: [...per.values()].sort((a, b) => a.done / a.total - b.done / b.total)
    };
}

export function fmtMin(m) {
    if (!m) return '0 分';
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} 小时${r ? ' ' + r + ' 分' : ''}` : `${r} 分`;
}
