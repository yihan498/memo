// 底部区域：每日页是快捷输入框（可填计时目标），待办页是「+ 添加待办」按钮（打开表单）
export class TaskInput {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.taskInput = document.getElementById('taskInput');
        this.targetInput = document.getElementById('targetInput');
        this.inputRow = document.getElementById('dailyInputRow');
        this.openFormBtn = document.getElementById('openFormBtn');
        this.countEl = document.getElementById('taskCount');
        this.clearBtn = document.getElementById('clearCompletedBtn');
        this.footer = document.getElementById('footer');
        this.clearConfirm = false;

        const submit = () => {
            const text = this.taskInput.value.trim();
            if (!text) return;
            const min = parseInt(this.targetInput.value, 10);
            this.callbacks.onAddTask(text, min > 0 ? min : null);
            this.taskInput.value = '';
            this.targetInput.value = '';
            this.taskInput.focus();
        };
        [this.taskInput, this.targetInput].forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
        document.getElementById('addBtn').addEventListener('click', submit);
        this.openFormBtn.addEventListener('click', () => this.callbacks.onOpenForm());
        this.clearBtn.addEventListener('click', () => this.requestClear());
    }

    // 清除已完成也要二次确认
    requestClear() {
        if (this.clearConfirm) {
            this.resetClear();
            this.callbacks.onClearCompleted();
            return;
        }
        this.clearConfirm = true;
        this.clearBtn.textContent = '再点一次确认清除';
        this.clearBtn.classList.add('danger');
        this.clearTimer = setTimeout(() => this.resetClear(), 3000);
    }

    resetClear() {
        clearTimeout(this.clearTimer);
        this.clearConfirm = false;
        this.clearBtn.textContent = '清除已完成';
        this.clearBtn.classList.remove('danger');
    }

    setView(view) {
        this.footer.classList.toggle('hidden', view === 'records');
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
