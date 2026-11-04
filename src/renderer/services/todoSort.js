// 零碎待办的排序与分组（重要/紧急 四象限 → 截止时间 → 计划时间 → 创建时间）。纯函数。

const SOON_MS = 24 * 60 * 60 * 1000; // 截止前 24 小时内自动视为紧急

export const QUADRANTS = [
    { id: 0, label: '重要 · 紧急' },
    { id: 1, label: '重要 · 不紧急' },
    { id: 2, label: '紧急 · 不重要' },
    { id: 3, label: '其他' }
];

function toMs(v) {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
}

/** 截止状态：overdue 已过期 / soon 24h 内 / null */
export function dueState(task, now = Date.now()) {
    const due = toMs(task.dueAt);
    if (due === null || task.completed) return null;
    if (due < now) return 'overdue';
    if (due - now <= SOON_MS) return 'soon';
    return null;
}

export function isUrgent(task, now = Date.now()) {
    return !!task.urgent || dueState(task, now) !== null;
}

export function quadrantOf(task, now = Date.now()) {
    const imp = !!task.important;
    const urg = isUrgent(task, now);
    if (imp && urg) return 0;
    if (imp) return 1;
    if (urg) return 2;
    return 3;
}

function cmpNullableAsc(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}

/** 返回排好序的副本；未完成在前，已完成按完成时间倒序在后 */
export function sortTodos(tasks, now = Date.now()) {
    const open = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);
    open.sort((a, b) =>
        quadrantOf(a, now) - quadrantOf(b, now) ||
        cmpNullableAsc(toMs(a.dueAt), toMs(b.dueAt)) ||
        cmpNullableAsc(toMs(a.plannedAt), toMs(b.plannedAt)) ||
        String(a.createdAt).localeCompare(String(b.createdAt))
    );
    done.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return open.concat(done);
}

const WEEK = '日一二三四五六';
const p2 = n => String(n).padStart(2, '0');

/** '2026-11-05T18:00' → '周四' */
export function weekday(v) {
    const ms = toMs(v);
    return ms === null ? '' : '周' + WEEK[new Date(ms).getDay()];
}

/** 'YYYY-MM-DDTHH:mm' → '11/05 周四 18:00'（今年省略年份） */
export function shortTime(v, now = new Date()) {
    const ms = toMs(v);
    if (ms === null) return '';
    const d = new Date(ms);
    const md = `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${weekday(v)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    return d.getFullYear() === new Date(now).getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

/** 按时间排序用的时间点：优先截止时间，没有则用计划时间 */
export function timeKey(task) {
    const due = toMs(task.dueAt);
    return due !== null ? due : toMs(task.plannedAt);
}

/** 按时间排序：时间早的在前，没时间的在后；同一时间按重要程度 */
export function sortTodosByTime(tasks, now = Date.now()) {
    const open = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);
    open.sort((a, b) =>
        cmpNullableAsc(timeKey(a), timeKey(b)) ||
        quadrantOf(a, now) - quadrantOf(b, now) ||
        String(a.createdAt).localeCompare(String(b.createdAt))
    );
    done.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return open.concat(done);
}

function startOfDay(ms) {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 按时间排序时的分组：已过期 / 今天 / 明天 / 后天 / 11/08 周日 / 未定时间 / 已完成 */
export function dayGroup(task, now = Date.now()) {
    if (task.completed) return { key: 'qdone', label: '已完成' };
    const ms = timeKey(task);
    if (ms === null) return { key: 'tnone', label: '未定时间' };
    if (dueState(task, now) === 'overdue') return { key: 'toverdue', label: '已过期' };
    const diff = Math.round((startOfDay(ms) - startOfDay(now)) / 86400000);
    const d = new Date(ms);
    const names = { 0: '今天', 1: '明天', 2: '后天' };
    const date = `${p2(d.getMonth() + 1)}/${p2(d.getDate())} 周${WEEK[d.getDay()]}`;
    return { key: 't' + startOfDay(ms), label: names[diff] ? `${names[diff]} · ${date}` : date };
}

// 截止提醒：remindBefore 为提前分钟数（0 = 截止时），null/undefined = 不提醒
export const REMIND_OPTIONS = [
    { value: '', label: '不提醒' },
    { value: '0', label: '截止时' },
    { value: '60', label: '提前 1 小时' },
    { value: '180', label: '提前 3 小时' },
    { value: '1440', label: '提前 1 天' }
];

export function remindAtMs(task) {
    const due = toMs(task.dueAt);
    if (due === null || task.remindBefore === null || task.remindBefore === undefined || task.remindBefore === '') return null;
    return due - Number(task.remindBefore) * 60 * 1000;
}

// 计划提醒：计划时间 = 「这个点去做」，没有截止也该叫你。planRemind 为提前分钟数（0 = 到点），null/undefined = 不提醒
export const PLAN_REMIND_OPTIONS = [
    { value: '', label: '不提醒' },
    { value: '0', label: '到点提醒' },
    { value: '10', label: '提前 10 分钟' },
    { value: '30', label: '提前 30 分钟' },
    { value: '60', label: '提前 1 小时' }
];
const PLAN_STALE_MS = 12 * 3600 * 1000; // 错过超过 12 小时（如电脑关机）就不补弹了

export function planRemindAtMs(task) {
    const at = toMs(task.plannedAt);
    if (at === null || task.planRemind === null || task.planRemind === undefined || task.planRemind === '') return null;
    return at - Number(task.planRemind) * 60 * 1000;
}

export const planKey = t => t.plannedAt + '|' + t.planRemind;

/** 返回现在该弹「该去做了」、且还没提醒过的待办 */
export function planReminders(tasks, now = Date.now()) {
    return tasks.filter(t => {
        if (t.type !== 'todo' || t.completed) return false;
        const at = planRemindAtMs(t);
        return at !== null && at <= now && now - at < PLAN_STALE_MS && t.planRemindedFor !== planKey(t);
    });
}

/** 返回现在该弹提醒、且还没提醒过的待办 */
export function dueReminders(tasks, now = Date.now()) {
    return tasks.filter(t => {
        if (t.type !== 'todo' || t.completed) return false;
        const at = remindAtMs(t);
        return at !== null && at <= now && t.remindedFor !== t.dueAt + '|' + t.remindBefore;
    });
}
