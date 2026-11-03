// 每日常规的纯逻辑：跨天重置、历史记录、晚间检查提醒判断。
// 不依赖 DOM / Electron，可直接用 node 测试。

const HISTORY_KEEP_DAYS = 60;

export function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function shiftKey(key, deltaDays) {
    const [y, m, d] = key.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d + deltaDays));
}

/**
 * 跨天处理：把上一个记录日的完成情况写入历史，并把每日常规重置为未完成。
 * 未完成的常规打上 missedLast 标记（新的一天完成后标记随之消失）。
 */
export function rollover(state, now = new Date()) {
    const today = dateKey(now);
    if (!state.lastResetDate) return { ...state, lastResetDate: today };
    if (state.lastResetDate === today) return state;

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const dailies = tasks.filter(t => t.type === 'daily');
    const history = { ...(state.dailyHistory || {}) };

    if (dailies.length > 0) {
        const missed = dailies.filter(t => !t.completed);
        history[state.lastResetDate] = {
            total: dailies.length,
            done: dailies.length - missed.length,
            missed: missed.map(t => t.text)
        };
    }

    const cutoff = shiftKey(today, -HISTORY_KEEP_DAYS);
    for (const k of Object.keys(history)) {
        if (k < cutoff) delete history[k];
    }

    const newTasks = tasks.map(t => {
        if (t.type !== 'daily') return t;
        return { ...t, completed: false, completedAt: null, missedLast: !t.completed };
    });

    return { ...state, tasks: newTasks, lastResetDate: today, dailyHistory: history };
}

/** 到了检查时间、今天还没提醒过、且有未完成常规 → 返回未完成列表，否则 null */
export function pendingCheck(state, now = new Date()) {
    const checkTime = state.checkTime || '21:30';
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (hhmm < checkTime) return null;
    if (state.lastNotifiedDate === dateKey(now)) return null;
    const pending = (state.tasks || []).filter(t => t.type === 'daily' && !t.completed);
    return pending.length > 0 ? pending : null;
}

/** 最近 n 天（含今天）的完成状态，用于圆点标记 */
export function recentDays(state, now = new Date(), n = 7) {
    const today = dateKey(now);
    const history = state.dailyHistory || {};
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
        const key = shiftKey(today, -i);
        if (key === today) {
            const dailies = (state.tasks || []).filter(t => t.type === 'daily');
            const done = dailies.filter(t => t.completed).length;
            days.push({ key, status: dailies.length && done === dailies.length ? 'done' : 'today', done, total: dailies.length, missed: [] });
            continue;
        }
        const h = history[key];
        if (!h) days.push({ key, status: 'none', missed: [] });
        else days.push({ key, status: h.done === h.total ? 'done' : 'missed', done: h.done, total: h.total, missed: h.missed });
    }
    return days;
}
