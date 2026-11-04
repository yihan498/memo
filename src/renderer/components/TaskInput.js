// 底部区域：每日页是快捷输入框（可填计时目标），待办页是「+ 添加待办」按钮（打开表单）
export class TaskInput {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.taskInput = document.getElementById('taskInput');
        this.targetInput = document.getElementById('targetInput');
        this.areaInput = document.getElementById('areaInput');
        this.cdToggle = document.getElementById('cdToggle');
        this.cdToggle.addEventListener('click', () => this.cdToggle.classList.toggle('on'));
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
            // 分区保留不清空：连续往同一个分区里加更顺手
            this.callbacks.onAddTask(text, min > 0 ? min : null, this.areaInput.value, this.cdToggle.classList.contains('on'));
            this.cdToggle.classList.remove('on');
            this.taskInput.value = '';
            this.targetInput.value = '';
            this.taskInput.focus();
        };
        [this.taskInput, this.areaInput, this.targetInput].forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
        document.getElementById('addBtn').addEventListener('click', submit);
        // 待办页：一句话输入 → 回车解析并打开表单；空着点 + 打开空白表单
        this.todoRow = document.getElementById('todoInputRow');
        this.quickInput = document.getElementById('quickInput');
        const quick = () => {
            const text = this.quickInput.value.trim();
            this.quickInput.value = '';
            if (text) this.callbacks.onQuickAdd(text); else this.callbacks.onOpenForm();
        };
        this.quickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); quick(); } }); // 阻止回车落进表单的文本框
        this.openFormBtn.addEventListener('click', quick);
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
        this.todoRow.classList.toggle('hidden', view !== 'todo');
    }

    updateStats(tasks, view) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        this.countEl.textContent = total === 0 ? '0 项' : `剩余 ${total - completed} / 共 ${total} 项`;
        this.clearBtn.classList.toggle('hidden', !(completed > 0 && view === 'todo'));
    }

    focus() {
        if (!this.inputRow.classList.contains('hidden')) this.taskInput.focus();
        else if (!this.todoRow.classList.contains('hidden')) this.quickInput.focus();
    }
}
