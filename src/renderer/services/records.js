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

// --- 月历 ---

const pad2 = n => String(n).padStart(2, '0');
const hmOf = iso => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

/** 'YYYY-MM' 加减 n 个月 */
export function shiftMonth(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * 每天的待办（像日历里的提醒事项）：Map<'YYYY-MM-DD', [{ id, text, kind, time }]>
 * kind：done 当天完成 / due 当天截止 / overdue 截止已过还没做 / planned 计划在当天做
 */
export function todosByDay(state, now = new Date()) {
    const map = new Map();
    const add = (key, e) => { if (!map.has(key)) map.set(key, []); map.get(key).push(e); };
    for (const l of state.todoLog || []) {
        if (l.completedAt) add(dateKey(new Date(l.completedAt)), { id: l.id, text: l.text, kind: 'done', time: hmOf(l.completedAt) });
    }
    for (const t of state.tasks || []) {
        if (t.type !== 'todo' || t.completed) continue;
        if (t.plannedAt) add(t.plannedAt.slice(0, 10), { id: t.id, text: t.text, kind: 'planned', time: t.plannedAt.slice(11, 16) });
        if (t.dueAt) add(t.dueAt.slice(0, 10), { id: t.id, text: t.text, kind: new Date(t.dueAt) < now ? 'overdue' : 'due', time: t.dueAt.slice(11, 16) });
    }
    for (const list of map.values()) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return map;
}

/**
 * 一个月的日历：周一开头的整周格子 + 本月统计。
 * cells[i] = { key, day, inMonth, isToday, future, routine (同 buildRecords 的 day 或 null), todos }
 */
export function buildMonth(state, ym, now = new Date()) {
    const [y, m] = ym.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate();
    const first = `${ym}-01`, last = `${ym}-${pad2(dim)}`;
    const today = dateKey(now);
    const rec = buildRecords(state, first, last, now);
    const routineOf = new Map(rec.days.map(d => [d.key, d]));
    const todos = todosByDay(state, now);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 周一 = 0
    const count = Math.ceil((lead + dim) / 7) * 7;
    const cells = [];
    for (let i = 0; i < count; i++) {
        const key = shiftKey(first, i - lead);
        const inMonth = key >= first && key <= last;
        cells.push({
            key, day: Number(key.slice(8)), inMonth,
            isToday: key === today, future: key > today,
            routine: inMonth ? routineOf.get(key) || null : null,
            todos: todos.get(key) || []
        });
    }
    return { ym, cells, summary: rec.summary, perTask: rec.perTask };
}

/** 某一天的明细（点日历格子时用） */
export function dayDetail(state, key, now = new Date()) {
    const today = dateKey(now);
    const routine = key === today ? todayRecord(state, now) : (state.dailyHistory || {})[key] || null;
    return { key, week: weekdayOfKey(key), today: key === today, future: key > today, routine, todos: todosByDay(state, now).get(key) || [] };
}
