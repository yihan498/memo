import { loadTheme, saveTheme, loadAlwaysOnTop } from './services/storeService.js';
import { createTask, toggleTask, updateTask, deleteTask } from './services/taskManager.js';
import { dateKey, rollover, pendingCheck, recentDays } from './services/dailyManager.js';
import { Header } from './components/Header.js';
import { TaskList } from './components/TaskList.js';
import { TaskInput } from './components/TaskInput.js';

// 需要持久化的状态字段 → electron-store 的 key
const PERSIST_KEYS = ['tasks', 'view', 'lastResetDate', 'dailyHistory', 'checkTime', 'lastNotifiedDate'];

const store = {
    get: (k, d) => window.electronAPI.getStoreValue(k, d),
    set: (k, v) => window.electronAPI.setStoreValue(k, v)
};

class TodoWidgetApp {
    constructor() {
        this.state = {
            tasks: [],
            view: 'daily',          // 'daily' 每日常规 | 'todo' 零碎待办
            lastResetDate: null,
            dailyHistory: {},
            checkTime: '21:30',     // 晚间检查时间
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
        // 旧数据没有 type 字段，视为零碎待办
        this.state.tasks = (this.state.tasks || []).map(t => (t.type ? t : { ...t, type: 'todo' }));

        this.header = new Header({
            onThemeToggle: () => this.toggleTheme(),
            getTaskCount: () => this.state.tasks.filter(t => !t.completed).length
        });

        this.taskList = new TaskList('tasksList', {
            onToggle: (id) => this.handleToggleTask(id),
            onDelete: (id) => this.handleDeleteTask(id),
            onEditStart: (id) => this.handleEditStart(id),
            onEditSave: (id, newText) => this.handleEditSave(id, newText),
            onEditCancel: () => this.updateUI()
        });

        this.taskInput = new TaskInput({
            onAddTask: (text) => this.handleAddTask(text),
            onClearCompleted: () => this.handleClearCompleted()
        });

        this.setupTabs();
        this.setupDailyBar();
        this.setupKeyboardShortcuts();

        this.tick();
        setInterval(() => this.tick(), 30 * 1000);

        this.updateUI();
        this.header.applyTheme(this.currentTheme);
        this.header.updateAlwaysOnTopButton(isAlwaysOnTop);

        window.addEventListener('focus', () => this.taskInput.focus());
    }

    // --- 定时：跨天重置 + 晚间检查 ---

    tick() {
        const now = new Date();
        const before = this.state.lastResetDate;
        this.state = rollover(this.state, now);
        if (this.state.lastResetDate !== before) {
            this.persist();
            this.updateUI();
        }

        const pending = pendingCheck(this.state, now);
        if (pending) {
            const names = pending.map(t => t.text).join('、');
            window.electronAPI.notify(
                `今日常规还有 ${pending.length} 项未完成`,
                names
            );
            this.state.lastNotifiedDate = dateKey(now);
            this.persist();
        }
    }

    // --- 视图切换 ---

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.view = btn.dataset.view;
                store.set('view', this.state.view);
                this.updateUI();
                this.taskInput.focus();
            });
        });
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
        });
    }

    // --- Actions ---

    handleAddTask(text) {
        try {
            this.state = createTask(this.state, text, this.state.view);
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
        this.persist();
        const task = this.state.tasks.find(t => t.id === id);
        const el = document.querySelector(`[data-task-id="${id}"]`);
        if (el && task && task.completed) {
            el.classList.add('task-complete');
            setTimeout(() => el.classList.remove('task-complete'), 300);
        }
        this.updateUI();
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
        if (task) this.taskList.enableEditing(id, task.text);
    }

    handleEditSave(id, newText) {
        if (newText.trim() !== '') {
            this.state = updateTask(this.state, id, { text: newText });
            this.persist();
        }
        this.updateUI();
    }

    // 只清理零碎待办里已完成的；每日常规不会被清掉
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

    // --- Render ---

    updateUI() {
        const view = this.state.view;
        const visible = this.state.tasks.filter(t => t.type === view);

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
            const n = this.state.tasks.filter(t => t.type === btn.dataset.view && !t.completed).length;
            btn.querySelector('.tab-count').textContent = n > 0 ? n : '';
        });

        document.getElementById('taskInput').placeholder =
            view === 'daily' ? '添加每日常规…' : '添加待办…';
        document.getElementById('emptyTitle').textContent =
            view === 'daily' ? '还没有每日常规' : '没有待办，清爽！';

        this.renderDailyBar(view === 'daily');
        this.taskList.render(visible);
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

    // --- Shortcuts ---

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'n') { e.preventDefault(); this.taskInput.focus(); }
            if (e.key === 'Escape') {
                const inputEl = document.getElementById('taskInput');
                if (inputEl && inputEl.value) inputEl.value = '';
            }
            if (mod && e.shiftKey && e.key === 'C') { e.preventDefault(); this.handleClearCompleted(); }
            if (mod && e.key === 't') { e.preventDefault(); this.toggleTheme(); }
            // Ctrl+Tab 切换 每日/待办
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.state.view = this.state.view === 'daily' ? 'todo' : 'daily';
                store.set('view', this.state.view);
                this.updateUI();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.todoWidget = new TodoWidgetApp();
});
