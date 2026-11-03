import { createTaskElement } from './TaskItem.js';

export class TaskList {
    constructor(containerId, callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;
        this.attachHandlers();
    }

    render(tasks) {
        if (!this.container) return;

        this.container.innerHTML = '';
        if (!Array.isArray(tasks) || tasks.length === 0) return;

        const frag = document.createDocumentFragment();
        tasks.forEach(task => {
            frag.appendChild(createTaskElement(task));
        });
        this.container.appendChild(frag);
    }

    updateEmptyState(taskCount) {
        const emptyState = document.getElementById('emptyState');
        if (!emptyState || !this.container) return;

        if (taskCount === 0) {
            emptyState.classList.remove('hidden');
            this.container.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            this.container.classList.remove('hidden');
        }
    }

    attachHandlers() {
        if (!this.container) return;
        this.container.addEventListener('click', this.handleEvent.bind(this));
        this.container.addEventListener('dblclick', this.handleEvent.bind(this));
    }

    handleEvent(e) {
        const target = e.target;
        const taskEl = target.closest('[data-task-id]');
        if (!taskEl) return;
        
        const taskId = taskEl.getAttribute('data-task-id');

        // Checkbox change
        if (target.classList.contains('task-checkbox')) {
            if (this.callbacks.onToggle) this.callbacks.onToggle(taskId);
            return;
        }

        // Delete button
        if (target.closest('.delete-btn')) {
            if (this.callbacks.onDelete) this.callbacks.onDelete(taskId);
            return;
        }

        // Double click to edit
        if (e.type === 'dblclick' && target.closest('.task-text-container')) {
            if (this.callbacks.onEditStart) this.callbacks.onEditStart(taskId);
            return;
        }
    }

    enableEditing(taskId, currentText) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const textContainer = taskElement.querySelector('.task-text-container');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'w-full bg-transparent border-b border-blue-500 focus:outline-none text-sm text-gray-800 dark:text-gray-200 py-0.5';

        textContainer.innerHTML = '';
        textContainer.appendChild(input);
        input.focus();

        const save = () => {
            if (this.callbacks.onEditSave) {
                this.callbacks.onEditSave(taskId, input.value);
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                if (this.callbacks.onEditCancel) this.callbacks.onEditCancel();
            }
        });
    }
}
