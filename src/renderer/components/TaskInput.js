export class TaskInput {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.taskInput = document.getElementById('taskInput');
        this.addBtn = document.getElementById('addBtn');
        this.taskCountElement = document.getElementById('taskCount');
        this.clearCompletedBtn = document.getElementById('clearCompletedBtn');

        this.attachHandlers();
    }

    attachHandlers() {
        if (this.taskInput) {
            this.taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.taskInput.value.trim()) {
                    this.submitTask();
                }
            });
            this.taskInput.addEventListener('focus', () => {
                this.taskInput.select();
            });
        }

        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => {
                if (this.taskInput.value.trim()) {
                    this.submitTask();
                }
            });
        }

        if (this.clearCompletedBtn) {
            this.clearCompletedBtn.addEventListener('click', () => {
                if (this.callbacks.onClearCompleted) {
                    this.callbacks.onClearCompleted();
                }
            });
        }
    }

    submitTask() {
        const text = this.taskInput.value.trim();
        if (this.callbacks.onAddTask) {
            this.callbacks.onAddTask(text);
        }
        this.taskInput.value = '';
    }

    updateStats(tasks) {
        if (!Array.isArray(tasks)) return;

        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const remaining = total - completed;

        if (this.taskCountElement) {
            if (total === 0) {
                this.taskCountElement.textContent = '0 tasks';
            } else if (completed === 0) {
                this.taskCountElement.textContent = `${total} ${total === 1 ? 'task' : 'tasks'}`;
            } else {
                this.taskCountElement.textContent = `${remaining} of ${total} remaining`;
            }
        }

        if (this.clearCompletedBtn) {
            if (completed > 0) {
                this.clearCompletedBtn.classList.remove('hidden');
            } else {
                this.clearCompletedBtn.classList.add('hidden');
            }
        }
    }

    focus() {
        if (this.taskInput) {
            this.taskInput.focus();
        }
    }
}
