// 底部区域：每日页是快捷输入框，待办页是「+ 添加待办」按钮（打开表单）
export class TaskInput {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.taskInput = document.getElementById('taskInput');
        this.inputRow = document.getElementById('dailyInputRow');
        this.openFormBtn = document.getElementById('openFormBtn');
        this.countEl = document.getElementById('taskCount');
        this.clearBtn = document.getElementById('clearCompletedBtn');

        const submit = () => {
            const text = this.taskInput.value.trim();
            if (!text) return;
            this.callbacks.onAddTask(text);
            this.taskInput.value = '';
        };
        this.taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        document.getElementById('addBtn').addEventListener('click', submit);
        this.openFormBtn.addEventListener('click', () => this.callbacks.onOpenForm());
        this.clearBtn.addEventListener('click', () => this.callbacks.onClearCompleted());
    }

    setView(view) {
        this.inputRow.classList.toggle('hidden', view !== 'daily');
        this.openFormBtn.classList.toggle('hidden', view !== 'todo');
    }

    updateStats(tasks, view) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        this.countEl.textContent = total === 0 ? '0 项' : `剩余 ${total - completed} / 共 ${total} 项`;
        this.clearBtn.classList.toggle('hidden', !(completed > 0 && view === 'todo'));
    }

    focus() {
        if (!this.inputRow.classList.contains('hidden')) this.taskInput.focus();
    }
}
