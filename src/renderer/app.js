import { loadTheme, saveTheme, loadAlwaysOnTop } from './services/storeService.js';
import { createTask, toggleTask, updateTask, deleteTask } from './services/taskManager.js';
import { dateKey, rollover, pendingCheck, pastCheckTime, recentDays, startTimer, stopTimer, applyTimers, elapsedMs } from './services/dailyManager.js';
import { Header } from './components/Header.js';
import { TaskList } from './components/TaskList.js';
import { TaskInput } from './components/TaskInput.js';
import { TodoForm } from './components/TodoForm.js';
import { Records } from './components/Records.js';
import { timerHtml, fmtClock } from './components/TaskItem.js';
import { localizeKeys } from './utils/helpers.js';
import { sortTodos, sortTodosByTime, dayGroup, quadrantOf, QUADRANTS, dueReminders, planReminders, planKey, shortTime } from './services/todoSort.js';
import { normArea, listAreas, groupByArea } from './services/areas.js';
import { parseTodo } from './services/quickParse.js';
import { Ideas } from './components/Ideas.js';
import { addIdea, captureIdea, editIdea, removeIdea, setIdeaStatus } from './services/ideas.js';

// 需要持久化的状态字段 → electron-store 的 key
const PERSIST_KEYS = ['tasks', 'view', 'lastResetDate', 'dailyHistory', 'checkTime', 'lastNotifiedDate', 'todoSort', 'todoLog', 'ideas'];
const VIEWS = ['daily', 'todo', 'records', 'ideas'];

const store = {
    get: (k, d) => window.electronAPI.getStoreValue(k, d),
    set: (k, v) => window.electronAPI.setStoreValue(k, v)
};

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

class TodoWidgetApp {
    constructor() {
        this.state = {
            tasks: [],
            view: 'daily',          // 'daily' 每日常规 | 'todo' 零碎待办 | 'records' 记录
            lastResetDate: null,
            dailyHistory: {},
            checkTime: '21:30',     // 晚间检查时间
            todoSort: 'time',       // 待办排序：'time' 按时间 | 'priority' 按重要程度
            todoLog: [],            // 待办完成日志（清除已完成后也保留，供记录页统计）
            ideas: [],              // 想法：随手记的小念头，和任务分开
            lastNotifiedDate: null
        };
        this.currentTheme = 'dark';
        this.init();
    }

    async init() {
        this.currentTheme = await loadTheme();
        const isAlwaysOnTop = await loadAlwaysOnTop();
        for (const k of PERSIST_KEYS) {
            const v = await store.get(k, this.state[k]);
            if (v !== undefined && v !== null) this.state[k] = v;
        }
        if (!VIEWS.includes(this.state.view)) this.state.view = 'daily';
        // 旧数据没有 type 字段，视为零碎待办
        this.state.tasks = (this.state.tasks || []).map(t => (t.type ? t : { ...t, type: 'todo' }));
        // 把已勾选但还没进日志的待办补进日志
        const logged = new Set(this.state.todoLog.map(l => l.id));
        this.state.tasks.filter(t => t.type === 'todo' && t.completed && t.completedAt && !logged.has(t.id))
            .forEach(t => this.state.todoLog.push(this.logEntry(t)));

        this.header = new Header({
            onThemeToggle: () => this.toggleTheme(),
            onCompactChange: (on) => this.syncCompact(on),
            getTaskCount: () => this.state.tasks.filter(t => !t.completed).length
        });

        this.taskList = new TaskList('tasksList', {
            onToggle: (id) => this.handleToggleTask(id),
            onDelete: (id) => this.handleDeleteTask(id),
            onTimer: (id) => this.handleTimer(id),
            onEditStart: (id) => this.handleEditStart(id),
            onEditSave: (id, text, min, area, countdown) => this.handleEditSave(id, text, min, area, countdown),
            onEditCancel: () => this.updateUI(),
            onAreaAdd: (area, text, min, countdown) => this.handleAddTask(text, min, area, countdown),
            onAreaQuick: (area, text) => { const p = parseTodo(text); this.todoForm.open(null, p.area ? p : { ...p, area, hits: [`分区 ${area}`, ...p.hits] }); },
            onRerender: () => this.updateUI()
        });

        this.taskInput = new TaskInput({
            onAddTask: (text, min, area, countdown) => this.handleAddTask(text, min, area, countdown),
            onOpenForm: () => this.todoForm.open(),
            onQuickAdd: (text) => this.todoForm.open(null, parseTodo(text)),
            onClearCompleted: () => this.handleClearCompleted()
        });

        this.todoForm = new TodoForm({
            onSave: (id, attrs) => this.handleSaveTodo(id, attrs)
        });

        this.records = new Records(() => this.state, {
            // 日历上给某天加待办：预填「计划时间」为那天 09:00 + 到点提醒（时间在表单里改）
            onAddOnDate: (key) => this.todoForm.open(null, {
                text: '', area: null, important: false, urgent: false, dueAt: null, remindBefore: null,
                plannedAt: `${key}T09:00`, planRemind: 0, hits: [], title: `新建待办 · ${key.slice(5).replace('-', '/')}`
            })
        });

        const saveIdeas = (ideas) => { this.state.ideas = ideas; store.set('ideas', ideas); this.updateUI(); };
        this.ideas = new Ideas(() => this.state, {
            onAdd: (text, area) => saveIdeas(addIdea(this.state.ideas, text, new Date(), area)),
            onEdit: (id, text, area) => saveIdeas(editIdea(this.state.ideas, id, text, new Date(), area)),
            onStatus: (id, status) => saveIdeas(setIdeaStatus(this.state.ideas, id, status)),
            onDelete: (id) => saveIdeas(removeIdea(this.state.ideas, id)),
            // 转成待办：用一句话解析预填表单（带上想法的分区），想法本身保留，做成了再点落实
            onToTodo: (idea) => {
                const p = parseTodo(idea.text);
                this.todoForm.open(null, p.area || !idea.area ? p : { ...p, area: idea.area, hits: [`分区 ${idea.area}`, ...p.hits] });
            }
        });
        // 全局快捷键 Ctrl+Alt+I：主进程呼出窗口后通知这里跳到想法页
        if (window.electronAPI.onQuickIdea) window.electronAPI.onQuickIdea(() => this.setView('ideas'));
        if (window.electronAPI.onClipIdea) window.electronAPI.onClipIdea((text, quiet) => this.handleClipIdea(text, quiet));
        if (window.electronAPI.onCollect) window.electronAPI.onCollect((on) => this.handleCollect(on));

        this.setupTabs();
        this.setupDailyBar();
        document.querySelectorAll('.seg-btn').forEach(btn => btn.addEventListener('click', () => this.setSort(btn.dataset.sort)));
        this.setupKeyboardShortcuts();
        document.getElementById('helpBtn').addEventListener('click', () => this.toggleHelp());
        document.getElementById('helpOverlay').addEventListener('click', () => this.toggleHelp(false));

        this.tick();
        setInterval(() => this.tick(), 30 * 1000);
        setInterval(() => this.tickTimers(), 1000);

        this.updateUI();
        this.header.applyTheme(this.currentTheme);
        this.header.updateAlwaysOnTopButton(isAlwaysOnTop);

        window.addEventListener('focus', () => (this.state.view === 'ideas' ? this.ideas.focus() : this.taskInput.focus()));
    }

    // --- 定时：跨天重置 + 晚间检查 ---

    tick() {
        const now = new Date();
        const before = this.state.lastResetDate;
        this.state = rollover(this.state, now);
        if (this.state.lastResetDate !== before) this.persist();
        // 截止状态随时间变化，定时重绘（编辑中不打断）
        if (!document.querySelector('.edit-input')) this.updateUI();

        // 零碎待办的截止提醒
        const due = dueReminders(this.state.tasks, now.getTime());
        if (due.length) {
            due.forEach(t => window.electronAPI.notify(`提醒：${t.text}`, `截止 ${shortTime(t.dueAt)}`));
            const ids = new Set(due.map(t => t.id));
            this.state.tasks = this.state.tasks.map(t =>
                ids.has(t.id) ? { ...t, remindedFor: t.dueAt + '|' + t.remindBefore } : t);
            this.persist();
        }

        // 零碎待办的计划提醒（到点去做）
        const plans = planReminders(this.state.tasks, now.getTime());
        if (plans.length) {
            plans.forEach(t => window.electronAPI.notify(`该做了：${t.text}`, `计划 ${shortTime(t.plannedAt)}${t.planRemind ? `（提前 ${t.planRemind} 分钟提醒）` : ''}`));
            const ids = new Set(plans.map(t => t.id));
            this.state.tasks = this.state.tasks.map(t => (ids.has(t.id) ? { ...t, planRemindedFor: planKey(t) } : t));
            this.persist();
        }

        const pending = pendingCheck(this.state, now);
        if (pending) {
            window.electronAPI.notify(`今天还有 ${pending.length} 项常规没做`, pending.map(t => t.text).join('、'));
            this.state.lastNotifiedDate = dateKey(now);
            this.persist();
        }
    }

    // 每秒：只刷新正在计时那一项的数字和进度条；达标时自动勾选
    tickTimers() {
        const running = this.state.tasks.filter(t => t.runningSince);
        if (!running.length) return;
        const { state, reached } = applyTimers(this.state);
        if (reached.length) {
            this.state = state;
            reached.forEach(t => t.countdown
                ? window.electronAPI.notify(`⏰「${t.text}」时间到`, `今天的 ${t.targetMin} 分钟已用完，计时已自动停止`)
                : window.electronAPI.notify(`「${t.text}」已达标`, `今天已计时 ${t.targetMin} 分钟，可以停下了`));
            this.persist();
            if (!document.querySelector('.edit-input')) this.updateUI();
            return;
        }
        running.forEach(t => {
            const box = document.querySelector(`[data-task-id="${t.id}"] .timer`);
            if (box) box.innerHTML = timerHtml(t);
        });
        if (this.header.isCompact) this.renderMiniTimers(running);
    }

    // --- 收起模式：标题栏下方列出正在计时的项目 ---

    /** 每行：名字 · 进度条 · 已计时（正计时）或剩余（倒计时） */
    renderMiniTimers(running) {
        const now = Date.now();
        const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
        document.getElementById('miniTimers').innerHTML = running.map(t => {
            const el = elapsedMs(t, now), total = t.targetMin * 60000;
            let clock, pct;
            if (t.countdown) {
                const left = total - el;
                pct = Math.max(0, Math.min(100, (left / total) * 100));
                clock = left > 0 ? `<b class="clock running">${fmtClock(left)}</b>` : `<b class="clock running over">+${fmtClock(-left)}</b>`;
            } else {
                pct = Math.min(100, (el / total) * 100);
                clock = `<b class="clock running">${fmtClock(el)}</b>`;
            }
            const tip = t.countdown ? `倒计时 · 共 ${t.targetMin} 分` : `正计时 · 目标 ${t.targetMin} 分`;
            return `<div class="mini-row" title="${tip}"><span class="mt-name">${esc(t.text)}</span><span class="mt-bar"><i style="width:${pct}%"></i></span>${clock}</div>`;
        }).join('');
    }

    /** 收起 / 展开，或收起状态下计时项增减时调整窗口高度 */
    syncCompact(on = this.header.isCompact) {
        const strip = document.getElementById('miniTimers');
        if (!on) {
            strip.classList.add('hidden');
            this.compactHeight = null;
            window.electronAPI.setCompactMode(false);
            return;
        }
        const running = this.state.tasks.filter(t => t.type === 'daily' && t.runningSince && t.targetMin);
        this.renderMiniTimers(running);
        strip.classList.toggle('hidden', !running.length);
        const h = 46 + (running.length ? running.length * 24 + 6 : 0);
        if (h !== this.compactHeight) {
            this.compactHeight = h;
            window.electronAPI.setCompactMode(true, h);
        }
    }

    // --- 视图切换 ---

    setView(view) {
        this.state.view = view;
        store.set('view', view);
        this.updateUI();
        if (view === 'ideas') this.ideas.focus(); else this.taskInput.focus();
    }

    setSort(sort) {
        this.state.todoSort = sort;
        store.set('todoSort', sort);
        this.updateUI();
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => this.setView(btn.dataset.view)));
    }

    setupDailyBar() {
        const timeInput = document.getElementById('checkTimeInput');
        timeInput.value = this.state.checkTime;
        timeInput.addEventListener('change', () => {
            if (!timeInput.value) return;
            this.state.checkTime = timeInput.value;
            // 改了时间允许今天按新时间再提醒一次
            this.state.lastNotifiedDate = null;
            this.persist();
            this.updateUI();
        });
    }

    // --- Actions ---

    logEntry(t) {
        return { id: t.id, text: t.text, completedAt: t.completedAt, dueAt: t.dueAt || null };
    }

    handleAddTask(text, targetMin = null, area = null, countdown = false) {
        try {
            this.state = createTask(this.state, text, this.state.view);
            const id = this.state.tasks[0].id;
            if (targetMin) this.state = updateTask(this.state, id, { targetMin, countdown: !!countdown, sessions: [], runningSince: null });
            if (normArea(area)) this.state = updateTask(this.state, id, { area: normArea(area) });
            this.persist();
            this.updateUI();
            setTimeout(() => {
                const el = document.querySelector(`[data-task-id="${this.state.tasks[0].id}"]`);
                if (el) el.classList.add('slide-in');
            }, 10);
        } catch (error) {
            console.warn('Invalid task:', error.message);
        }
    }

    handleToggleTask(id) {
        this.state = toggleTask(this.state, id);
        const task = this.state.tasks.find(t => t.id === id);
        if (task && task.type === 'todo') {
            this.state.todoLog = this.state.todoLog.filter(l => l.id !== id);
            if (task.completed) this.state.todoLog.push(this.logEntry(task));
        }
        this.persist();
        const el = document.querySelector(`[data-task-id="${id}"]`);
        if (el && task && task.completed) {
            el.classList.add('task-complete');
            setTimeout(() => el.classList.remove('task-complete'), 300);
        }
        this.updateUI();
    }

    /** 收集模式开 / 关：开时提示用法，关时报总数 */
    handleCollect(on) {
        if (on) {
            this.collected = 0;
            window.electronAPI.notify('收集模式已开启', '在微信里挨个右键「复制」，每条都会收进想法。再按 Ctrl+Alt+Shift+V 结束');
        } else {
            window.electronAPI.notify('收集结束', `这次收进想法 ${this.collected || 0} 条`);
        }
    }

    /** Ctrl+Alt+V：剪贴板 → 想法（不切页面，用通知告诉结果）；quiet = 收集模式里自动收，不逐条弹通知 */
    handleClipIdea(text, quiet = false) {
        const { ideas, added } = captureIdea(this.state.ideas, text);
        if (quiet) {
            if (!added) return;
            this.collected = (this.collected || 0) + 1;
            this.state.ideas = ideas;
            store.set('ideas', ideas);
            this.updateUI();
            return;
        }
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (!t) { window.electronAPI.notify('剪贴板里没有文字', '先在微信里右键「复制」，再按 Ctrl+Alt+V'); return; }
        if (!added) { window.electronAPI.notify('这条已经收过了', t.slice(0, 40)); return; }
        this.state.ideas = ideas;
        store.set('ideas', ideas);
        this.updateUI();
        window.electronAPI.notify('已收进想法', t.slice(0, 40));
    }

    handleTimer(id) {
        const task = this.state.tasks.find(t => t.id === id);
        if (!task || !task.targetMin) return;
        const stopping = !!task.runningSince;
        this.state = stopping ? stopTimer(this.state, id) : startTimer(this.state, id);
        this.persist();
        this.updateUI();
        // 停掉一个后，选中行跳到最近开始、仍在计时的那一项：连按 S 依次全部停掉，不会把刚停的重新打开
        if (stopping) {
            const next = this.state.tasks.filter(t => t.runningSince)
                .sort((a, b) => b.runningSince.localeCompare(a.runningSince))[0];
            if (next && this.taskList.ids.includes(next.id)) this.taskList.select(next.id);
        }
    }

    /** 停掉最近开始、仍在计时的那一项（收起状态下按 S 用） */
    stopLatestTimer() {
        const latest = this.state.tasks.filter(t => t.runningSince)
            .sort((a, b) => b.runningSince.localeCompare(a.runningSince))[0];
        if (latest) this.handleTimer(latest.id);
    }

    handleDeleteTask(id) {
        const remove = () => {
            this.state = deleteTask(this.state, id);
            this.persist();
            this.updateUI();
        };
        const el = document.querySelector(`[data-task-id="${id}"]`);
        if (el) {
            el.classList.add('fade-out');
            setTimeout(remove, 200);
        } else {
            remove();
        }
    }

    handleEditStart(id) {
        const task = this.state.tasks.find(t => t.id === id);
        if (!task) return;
        if (task.type === 'todo') this.todoForm.open(task);
        else this.taskList.enableEditing(id, task.text, task.targetMin, task.area, task.countdown);
    }

    handleSaveTodo(id, attrs) {
        if (id) {
            this.state = updateTask(this.state, id, attrs);
        } else {
            this.state = createTask(this.state, attrs.text, 'todo');
            this.state = updateTask(this.state, this.state.tasks[0].id, attrs);
        }
        this.persist();
        this.updateUI();
    }

    handleEditSave(id, newText, minRaw, area, countdown = false) {
        if (newText.trim() !== '') {
            const min = parseInt(minRaw, 10);
            const task = this.state.tasks.find(t => t.id === id);
            const attrs = { text: newText, targetMin: min > 0 ? min : null, area: normArea(area), countdown: !!countdown };
            if (!attrs.targetMin && task && task.runningSince) this.state = stopTimer(this.state, id);
            this.state = updateTask(this.state, id, attrs);
            this.persist();
        }
        this.updateUI();
    }

    // 只清理零碎待办里已完成的；每日常规不会被清掉（完成日志保留）
    handleClearCompleted() {
        const done = this.state.tasks.filter(t => t.type === 'todo' && t.completed);
        if (done.length === 0) return;
        done.forEach(t => {
            const el = document.querySelector(`[data-task-id="${t.id}"]`);
            if (el) el.classList.add('fade-out');
        });
        setTimeout(() => {
            done.forEach(t => { this.state = deleteTask(this.state, t.id); });
            this.persist();
            this.updateUI();
        }, 200);
    }

    async toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        await saveTheme(this.currentTheme);
        this.header.applyTheme(this.currentTheme);
    }

    toggleHelp(force) {
        const el = document.getElementById('helpOverlay');
        el.classList.toggle('hidden', force === undefined ? !el.classList.contains('hidden') : !force);
    }

    // --- Render ---

    updateUI() {
        if (this.header && this.header.isCompact) this.syncCompact(true);
        const view = this.state.view;
        const isRecords = view === 'records';
        let visible = this.state.tasks.filter(t => t.type === view);
        let groupOf = null;
        if (view === 'todo') {
            const now = Date.now();
            if (this.state.todoSort === 'time') {
                visible = sortTodosByTime(visible, now);
                groupOf = t => dayGroup(t, now);
            } else {
                visible = sortTodos(visible, now);
                groupOf = t => t.completed
                    ? { key: 'qdone', label: '已完成' }
                    : { key: 'q' + quadrantOf(t, now), label: QUADRANTS[quadrantOf(t, now)].label };
            }
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
            const c = btn.querySelector('.tab-count');
            if (!c) return;
            const n = this.state.tasks.filter(t => t.type === btn.dataset.view && !t.completed).length;
            c.textContent = n > 0 ? n : '';
        });

        this.taskInput.setView(view);
        document.getElementById('listWrap').classList.toggle('hidden', isRecords);
        document.getElementById('recordsView').classList.toggle('hidden', !isRecords);
        this.renderDailyBar(view === 'daily');
        document.getElementById('todoBar').classList.toggle('hidden', view !== 'todo');
        const isIdeas = view === 'ideas';
        document.getElementById('listWrap').classList.toggle('hidden', isRecords || isIdeas);
        document.getElementById('ideasView').classList.toggle('hidden', !isIdeas);
        document.getElementById('ideaInputRow').classList.toggle('hidden', !isIdeas);
        document.getElementById('ideasBar').classList.toggle('hidden', !isIdeas);
        if (isRecords) { this.records.render(); return; }
        if (isIdeas) {
            this.ideas.render();
            document.getElementById('clearCompletedBtn').classList.add('hidden');
            return;
        }

        document.getElementById('emptyTitle').textContent =
            view === 'daily' ? '还没有每日常规' : '没有待办，清爽！';
        document.getElementById('emptySub').textContent =
            view === 'daily' ? '在下方输入，想计时就在右边填分钟数' : '在下方用一句话添加，如：周五前交报告 #产品';
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === this.state.todoSort));
        // 分区候选：两个页面共用已有的分区名
        // 只在变化时重建，避免每 30 秒 tick 打断正在展开的下拉
        const areaHtml = listAreas(this.state.tasks)
            .map(a => `<option value="${a.replace(/[&"<>]/g, c => `&#${c.charCodeAt(0)};`)}"></option>`).join('');
        if (areaHtml !== this.lastAreaHtml) {
            document.getElementById('areaList').innerHTML = areaHtml;
            this.lastAreaHtml = areaHtml;
        }
        this.taskList.render(groupByArea(visible), groupOf, { late: pastCheckTime(this.state), view });
        this.taskList.updateEmptyState(visible.length);
        this.taskInput.updateStats(visible, view);
    }

    renderDailyBar(show) {
        const bar = document.getElementById('dailyBar');
        bar.classList.toggle('hidden', !show);
        if (!show) return;

        const days = recentDays(this.state);
        const today = days[days.length - 1];
        document.getElementById('dailyProgress').textContent =
            today.total ? `今日 ${today.done}/${today.total}` : '今日 0/0';

        const dots = document.getElementById('dailyDots');
        dots.innerHTML = '';
        const labels = { done: '全部完成', missed: '未完成', none: '无记录', today: '进行中' };
        days.forEach(d => {
            const dot = document.createElement('span');
            dot.className = `day-dot ${d.status}`;
            let tip = `${d.key.slice(5)} ${labels[d.status]}`;
            if (d.total) tip += ` (${d.done}/${d.total})`;
            if (d.missed && d.missed.length) tip += `\n未完成：${d.missed.join('、')}`;
            dot.title = tip;
            dots.appendChild(dot);
        });
    }

    async persist() {
        for (const k of PERSIST_KEYS) await store.set(k, this.state[k]);
    }

    // --- Shortcuts（? 查看全部） ---

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            const k = e.key.toLowerCase();
            const help = document.getElementById('helpOverlay');
            if (!help.classList.contains('hidden')) { this.toggleHelp(false); e.preventDefault(); return; }
            if (this.todoForm.isOpen) return;
            const typing = isTyping(document.activeElement);

            // 全局（任何时候）
            if (mod && k === 'n') {
                e.preventDefault();
                if (this.state.view === 'todo') this.todoForm.open();
                else if (this.state.view === 'ideas') this.ideas.focus();
                else { if (this.state.view !== 'daily') this.setView('daily'); this.taskInput.focus(); }
                return;
            }
            if (mod && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); this.setView(VIEWS[Number(e.key) - 1]); return; }
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                const i = VIEWS.indexOf(this.state.view);
                this.setView(VIEWS[(i + (e.shiftKey ? VIEWS.length - 1 : 1)) % VIEWS.length]);
                return;
            }
            if (mod && k === 't') { e.preventDefault(); this.toggleTheme(); return; }
            if (mod && k === 'p') { e.preventDefault(); document.getElementById('alwaysOnTopBtn').click(); return; }
            if (mod && k === 'm') { e.preventDefault(); this.header.toggleCompactMode(); return; }
            if (mod && k === 'w') { e.preventDefault(); window.electronAPI.minimizeWindow(); return; }
            if (mod && k === 'l' && this.state.view === 'todo') { e.preventDefault(); this.setSort(this.state.todoSort === 'time' ? 'priority' : 'time'); return; }
            if (mod && k === 'l' && this.state.view === 'records') { e.preventDefault(); this.records.cyclePreset(); return; }
            if (mod && e.shiftKey && k === 'c') { e.preventDefault(); document.getElementById('clearCompletedBtn').click(); return; }

            // 收起状态下列表看不见：S 直接停掉最近开始的计时（连按依次全停），不管停在哪一页、焦点在哪
            if (this.header.isCompact && !mod && !e.altKey && k === 's') { e.preventDefault(); this.stopLatestTimer(); return; }

            if (e.key === 'Escape') {
                if (typing && document.activeElement.value) { document.activeElement.value = ''; return; }
                if (typing) { document.activeElement.blur(); return; }
                if (this.taskList.selectedId) { this.taskList.select(null); return; }
                window.electronAPI.minimizeWindow();
                return;
            }
            // 每日输入框为空时按 ↓ 直接进入列表
            if (typing && e.key === 'ArrowDown' && !document.activeElement.value) {
                e.preventDefault(); document.activeElement.blur(); this.taskList.move(1); return;
            }
            if (typing) return;

            // 列表操作（不在输入框里时）
            if (e.key === '?' || e.key === 'F1') { e.preventDefault(); this.toggleHelp(true); return; }
            if (this.state.view === 'ideas') return;
            if (this.state.view === 'records') {
                if (e.key === 'ArrowLeft') { e.preventDefault(); this.records.shift(-1); }
                if (e.key === 'ArrowRight') { e.preventDefault(); this.records.shift(1); }
                return;
            }
            const sel = this.taskList.selectedId;
            if (e.key === 'ArrowDown' || k === 'j') { e.preventDefault(); this.taskList.move(1); return; }
            if (e.key === 'ArrowUp' || k === 'k') { e.preventDefault(); this.taskList.move(-1); return; }
            if (!sel) return;
            if (e.key === ' ' || e.key === 'x') { e.preventDefault(); this.handleToggleTask(sel); return; }
            if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); this.handleEditStart(sel); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.taskList.requestDelete(sel); return; }
            if (k === 's') { e.preventDefault(); this.handleTimer(sel); }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    localizeKeys();
    window.todoWidget = new TodoWidgetApp();
});
