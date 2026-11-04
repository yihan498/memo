// 每日常规的纯逻辑：计时、跨天重置、历史记录、晚间检查提醒判断。
// 不依赖 DOM / Electron，可直接用 node 测试。
//
// 每日常规任务字段：
//   targetMin   目标分钟数（null = 普通勾选型）
//   sessions    今天的计时段 [{ start, end }]（ISO 字符串）
//   runningSince 正在计时的开始时间（ISO）或 null
//   autoDone    今天是否已因计时达标自动勾选过（防止手动取消后又被自动勾上）

export function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function shiftKey(key, deltaDays) {
    const [y, m, d] = key.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d + deltaDays));
}

function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

const ms = v => new Date(v).getTime();

// --- 计时 ---

export function elapsedMs(task, now = Date.now()) {
    let total = (task.sessions || []).reduce((s, x) => s + Math.max(0, ms(x.end) - ms(x.start)), 0);
    if (task.runningSince) total += Math.max(0, now - ms(task.runningSince));
    return total;
}

function closeSession(t, endIso) {
    if (!t.runningSince) return t;
    return { ...t, sessions: (t.sessions || []).concat({ start: t.runningSince, end: endIso }), runningSince: null };
}

/** 开始计时；同一时间只允许一个在计时，会先停掉别的 */
export function startTimer(state, id, now = new Date()) {
    const iso = now.toISOString();
    const tasks = state.tasks.map(t => {
        if (t.type !== 'daily') return t;
        if (t.id === id) return t.runningSince ? t : { ...t, runningSince: iso };
        return closeSession(t, iso);
    });
    return { ...state, tasks };
}

export function stopTimer(state, id, now = new Date()) {
    const iso = now.toISOString();
    return { ...state, tasks: state.tasks.map(t => (t.id === id ? closeSession(t, iso) : t)) };
}

/** 剩余毫秒（倒计时显示用）；超时为负数 */
export function remainingMs(task, now = Date.now()) {
    return task.targetMin * 60000 - elapsedMs(task, now);
}

/**
 * 计时达标的自动勾选；返回 { state, reached: [刚达标的任务] }
 * 倒计时型（countdown）到点还会自动停表，结束时间按「恰好用完」那一刻算（睡眠 / 卡顿也不多记）
 */
export function applyTimers(state, now = Date.now()) {
    const reached = [];
    const tasks = state.tasks.map(t => {
        if (t.type !== 'daily' || !t.targetMin || t.completed || t.autoDone) return t;
        const over = elapsedMs(t, now) - t.targetMin * 60000;
        if (over < 0) return t;
        const hitAt = now - over;
        const base = t.countdown && t.runningSince ? closeSession(t, new Date(hitAt).toISOString()) : t;
        const done = { ...base, completed: true, completedAt: new Date(hitAt).toISOString(), autoDone: true };
        reached.push(done);
        return done;
    });
    return reached.length ? { state: { ...state, tasks }, reached } : { state, reached };
}

// --- 跨天 ---

function dayItem(t, endMs) {
    const item = { text: t.text, done: !!t.completed };
    if (t.targetMin) {
        item.targetMin = t.targetMin;
        item.minutes = Math.round(elapsedMs(t, endMs) / 60000);
        item.sessions = t.sessions || [];
    }
    return item;
}

/**
 * 跨天：把上一个记录日的每一项完成情况写入历史（永久保留，供「记录」页统计），
 * 然后把每日常规重置为未完成——不把未完成带到第二天。
 * 跨天时还在计时的，按当天 24:00 截断。
 */
export function rollover(state, now = new Date()) {
    const today = dateKey(now);
    if (!state.lastResetDate) return { ...state, lastResetDate: today };
    if (state.lastResetDate === today) return state;

    const midnight = keyToDate(shiftKey(state.lastResetDate, 1));
    const tasks = (Array.isArray(state.tasks) ? state.tasks : [])
        .map(t => (t.type === 'daily' ? closeSession(t, midnight.toISOString()) : t));
    const dailies = tasks.filter(t => t.type === 'daily');
    const history = { ...(state.dailyHistory || {}) };

    if (dailies.length > 0) {
        const items = dailies.map(t => dayItem(t, midnight.getTime()));
        history[state.lastResetDate] = {
            total: items.length,
            done: items.filter(i => i.done).length,
            missed: items.filter(i => !i.done).map(i => i.text),
            items
        };
    }

    const newTasks = tasks.map(t => {
        if (t.type !== 'daily') return t;
        const { missedLast, ...rest } = t;
        return { ...rest, completed: false, completedAt: null, sessions: [], runningSince: null, autoDone: false };
    });

    return { ...state, tasks: newTasks, lastResetDate: today, dailyHistory: history };
}

function hhmm(now) {
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** 是否已过晚间检查时间（过了之后，没完成的常规标红） */
export function pastCheckTime(state, now = new Date()) {
    return hhmm(now) >= (state.checkTime || '21:30');
}

/** 到了检查时间、今天还没提醒过、且有未完成常规 → 返回未完成列表，否则 null */
export function pendingCheck(state, now = new Date()) {
    if (!pastCheckTime(state, now)) return null;
    if (state.lastNotifiedDate === dateKey(now)) return null;
    const pending = (state.tasks || []).filter(t => t.type === 'daily' && !t.completed);
    return pending.length > 0 ? pending : null;
}

/** 今天的记录（和历史同结构），用于「记录」页把今天也算进去 */
export function todayRecord(state, now = new Date()) {
    const dailies = (state.tasks || []).filter(t => t.type === 'daily');
    if (!dailies.length) return null;
    const items = dailies.map(t => dayItem(t, now.getTime()));
    return { total: items.length, done: items.filter(i => i.done).length, missed: items.filter(i => !i.done).map(i => i.text), items, today: true };
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
