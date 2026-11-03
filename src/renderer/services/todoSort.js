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

/** 'YYYY-MM-DDTHH:mm' → '11/05 18:00'（今年省略年份） */
export function shortTime(v, now = new Date()) {
    const ms = toMs(v);
    if (ms === null) return '';
    const d = new Date(ms);
    const p = n => String(n).padStart(2, '0');
    const md = `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`;
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

/** 返回现在该弹提醒、且还没提醒过的待办 */
export function dueReminders(tasks, now = Date.now()) {
    return tasks.filter(t => {
        if (t.type !== 'todo' || t.completed) return false;
        const at = remindAtMs(t);
        return at !== null && at <= now && t.remindedFor !== t.dueAt + '|' + t.remindBefore;
    });
}
