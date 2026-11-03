import { createTaskElement } from './TaskItem.js';

export class TaskList {
    constructor(containerId, callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;
        this.container.addEventListener('click', (e) => this.handleEvent(e));
        this.container.addEventListener('dblclick', (e) => this.handleEvent(e));
    }

    /**
     * @param tasks 已排好序的任务
     * @param groupOf 可选：task => { key, label }，相邻 key 变化时插入分组标题
     */
    render(tasks, groupOf = null) {
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
            frag.appendChild(createTaskElement(task));
        });
        this.container.appendChild(frag);
    }

    updateEmptyState(count) {
        document.getElementById('emptyState').classList.toggle('hidden', count !== 0);
        this.container.classList.toggle('hidden', count === 0);
    }

    handleEvent(e) {
        const target = e.target;
        const taskEl = target.closest('[data-task-id]');
        if (!taskEl) return;
        const id = taskEl.getAttribute('data-task-id');

        if (e.type === 'click' && target.classList.contains('task-checkbox')) {
            this.callbacks.onToggle && this.callbacks.onToggle(id);
            return;
        }
        if (e.type === 'click' && target.closest('.delete-btn')) {
            this.callbacks.onDelete && this.callbacks.onDelete(id);
            return;
        }
        if (e.type === 'dblclick' && target.closest('.task-text-container')) {
            this.callbacks.onEditStart && this.callbacks.onEditStart(id);
        }
    }

    // 每日常规的行内编辑
    enableEditing(taskId, currentText) {
        const el = this.container.querySelector(`[data-task-id="${taskId}"] .task-text-container`);
        if (!el) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        let done = false;
        const save = () => { if (!done) { done = true; this.callbacks.onEditSave(taskId, input.value); } };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') { done = true; this.callbacks.onEditCancel(); }
        });
    }
}
