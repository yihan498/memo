// 零碎待办的新建 / 编辑表单
import { REMIND_OPTIONS } from '../services/todoSort.js';
export class TodoForm {
    constructor({ onSave }) {
        this.onSave = onSave;
        this.el = document.getElementById('todoForm');
        this.title = document.getElementById('formTitle');
        this.fText = document.getElementById('fText');
        this.fPlanned = document.getElementById('fPlanned');
        this.fDue = document.getElementById('fDue');
        this.fImportant = document.getElementById('fImportant');
        this.fUrgent = document.getElementById('fUrgent');
        this.fRemind = document.getElementById('fRemind');
        this.fRemind.innerHTML = REMIND_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        // 填了截止时间但还没选提醒 → 默认提前 1 小时
        this.fDue.addEventListener('change', () => {
            if (this.fDue.value && this.fRemind.value === '' && !this.remindTouched) this.fRemind.value = '60';
        });
        this.fRemind.addEventListener('change', () => { this.remindTouched = true; });
        this.editingId = null;

        [this.fImportant, this.fUrgent].forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
        document.getElementById('fCancel').addEventListener('click', () => this.close());
        document.getElementById('fSave').addEventListener('click', () => this.save());
        this.el.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.save();
        });
    }

    get isOpen() { return !this.el.classList.contains('hidden'); }

    open(task = null) {
        this.editingId = task ? task.id : null;
        this.title.textContent = task ? '编辑待办' : '新建待办';
        this.fText.value = task ? task.text : '';
        this.fPlanned.value = (task && task.plannedAt) || '';
        this.fDue.value = (task && task.dueAt) || '';
        const rb = task && task.remindBefore !== undefined && task.remindBefore !== null ? String(task.remindBefore) : '';
        this.fRemind.value = rb;
        this.remindTouched = !!task;
        this.fImportant.classList.toggle('on', !!(task && task.important));
        this.fUrgent.classList.toggle('on', !!(task && task.urgent));
        this.fText.style.borderColor = '';
        this.el.classList.remove('hidden');
        this.fText.focus();
    }

    close() {
        this.el.classList.add('hidden');
        this.editingId = null;
    }

    save() {
        const text = this.fText.value.trim();
        if (!text) {
            this.fText.style.borderColor = 'var(--accent)';
            this.fText.focus();
            return;
        }
        this.onSave(this.editingId, {
            text,
            plannedAt: this.fPlanned.value || null,
            dueAt: this.fDue.value || null,
            remindBefore: this.fDue.value && this.fRemind.value !== '' ? Number(this.fRemind.value) : null,
            important: this.fImportant.classList.contains('on'),
            urgent: this.fUrgent.classList.contains('on')
        });
        this.close();
    }
}
