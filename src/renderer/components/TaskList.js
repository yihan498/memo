import { createTaskElement } from './TaskItem.js';

const CONFIRM_MS = 3000;

export class TaskList {
    constructor(containerId, callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;
        this.selectedId = null;
        this.confirmId = null;   // 正在等待二次确认删除的任务
        this.confirmTimer = null;
        this.container.addEventListener('click', (e) => this.handleEvent(e));
        this.container.addEventListener('dblclick', (e) => this.handleEvent(e));
    }

    /**
     * @param tasks 已排好序的任务
     * @param groupOf 可选：task => { key, label }，相邻 key 变化时插入分组标题
     * @param ctx 传给每个任务项的上下文（如 late）
     */
    render(tasks, groupOf = null, ctx = {}) {
        this.ids = tasks.map(t => t.id);
        if (this.selectedId && !this.ids.includes(this.selectedId)) this.selectedId = null;
        this.container.innerHTML = '';
        const frag = document.createDocumentFragment();
        let lastKey = null;
        tasks.forEach(task => {
            if (groupOf) {
                const g = groupOf(task);
                if (g.key !== lastKey) {
                    const h = document.createElement('div');
                    h.className = `group-label ${g.key}`;
                    h.textContent = g.label;
                    frag.appendChild(h);
                    lastKey = g.key;
                }
            }
            const el = createTaskElement(task, ctx);
            if (task.id === this.selectedId) el.classList.add('selected');
            if (task.id === this.confirmId) this.markConfirm(el);
            frag.appendChild(el);
        });
        this.container.appendChild(frag);
    }

    updateEmptyState(count) {
        document.getElementById('emptyState').classList.toggle('hidden', count !== 0);
        this.container.classList.toggle('hidden', count === 0);
    }

    // --- 删除二次确认：第一次点 → 按钮变「确认删除」，3 秒内再点才删 ---

    markConfirm(el) {
        const btn = el.querySelector('.delete-btn');
        btn.classList.add('confirm');
        btn.textContent = '确认删除';
    }

    requestDelete(id) {
        if (this.confirmId === id) {
            this.clearConfirm();
            this.callbacks.onDelete(id);
            return;
        }
        this.clearConfirm();
        this.confirmId = id;
        const el = this.container.querySelector(`[data-task-id="${id}"]`);
        if (el) this.markConfirm(el);
        this.confirmTimer = setTimeout(() => { this.clearConfirm(); this.callbacks.onRerender(); }, CONFIRM_MS);
    }

    clearConfirm() {
        clearTimeout(this.confirmTimer);
        this.confirmId = null;
    }

    handleEvent(e) {
        const target = e.target;
        const taskEl = target.closest('[data-task-id]');
        if (!taskEl) return;
        const id = taskEl.getAttribute('data-task-id');
        this.select(id, false);

        if (e.type === 'click' && target.classList.contains('task-checkbox')) {
            this.callbacks.onToggle(id);
            return;
        }
        if (e.type === 'click' && target.closest('.delete-btn')) {
            this.requestDelete(id);
            return;
        }
        if (e.type === 'click' && target.closest('.timer-btn')) {
            this.callbacks.onTimer(id);
            return;
        }
        if (e.type === 'dblclick' && target.closest('.task-text-container')) {
            this.callbacks.onEditStart(id);
        }
    }

    // --- 键盘选中 ---

    select(id, scroll = true) {
        this.selectedId = id;
        this.container.querySelectorAll('.task.selected').forEach(x => x.classList.remove('selected'));
        const el = id && this.container.querySelector(`[data-task-id="${id}"]`);
        if (el) {
            el.classList.add('selected');
            if (scroll) el.scrollIntoView({ block: 'nearest' });
        }
    }

    move(delta) {
        if (!this.ids || !this.ids.length) return;
        const i = this.ids.indexOf(this.selectedId);
        const next = i === -1 ? (delta > 0 ? 0 : this.ids.length - 1) : Math.max(0, Math.min(this.ids.length - 1, i + delta));
        this.select(this.ids[next]);
    }

    // 每日常规的行内编辑：名称 + 计时目标（分钟，可空）
    enableEditing(taskId, currentText, targetMin) {
        const el = this.container.querySelector(`[data-task-id="${taskId}"] .task-text-container`);
        if (!el) return;
        el.innerHTML = `
            <div class="edit-row">
                <input type="text" class="edit-input" value="">
                <input type="number" class="edit-input edit-min" min="1" max="1440" placeholder="分钟" title="计时目标（分钟），留空 = 不计时">
            </div>`;
        const [input, minInput] = el.querySelectorAll('input');
        input.value = currentText;
        minInput.value = targetMin || '';
        input.focus();
        input.select();
        let done = false;
        const save = () => {
            if (done) return; done = true;
            this.callbacks.onEditSave(taskId, input.value, minInput.value);
        };
        el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) save(); });
        el.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') save();
            else if (e.key === 'Escape') { done = true; this.callbacks.onEditCancel(); }
        });
    }
}
