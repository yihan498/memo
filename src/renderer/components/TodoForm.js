// 零碎待办的新建 / 编辑表单
import { REMIND_OPTIONS, weekday } from '../services/todoSort.js';
import { normArea } from '../services/areas.js';
import { fmtMin } from '../services/quickParse.js';
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
        this.fArea = document.getElementById('fArea');
        this.fParsed = document.getElementById('fParsed');
        this.fRemind.innerHTML = REMIND_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        // 填了截止时间但还没选提醒 → 默认提前 1 小时
        this.fDue.addEventListener('change', () => {
            if (this.fDue.value && this.fRemind.value === '' && !this.remindTouched) this.fRemind.value = '60';
        });
        this.fRemind.addEventListener('change', () => { this.remindTouched = true; });
        this.editingId = null;
        this.wkPairs = [[this.fPlanned, document.getElementById('fPlannedWk')], [this.fDue, document.getElementById('fDueWk')]];
        this.wkPairs.forEach(([inp]) => inp.addEventListener('input', () => this.updateWeekdays()));

        [this.fImportant, this.fUrgent].forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
        document.getElementById('fCancel').addEventListener('click', () => this.close());
        document.getElementById('fSave').addEventListener('click', () => this.save());
        this.el.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
            const mod = e.ctrlKey || e.metaKey;
            if (mod && (e.key === 'Enter' || e.key.toLowerCase() === 's')) { e.preventDefault(); this.save(); }
            if (e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); this.fImportant.click(); }
            if (e.altKey && e.key.toLowerCase() === 'u') { e.preventDefault(); this.fUrgent.click(); }
        });
    }

    get isOpen() { return !this.el.classList.contains('hidden'); }

    /**
     * @param task 编辑已有待办；null = 新建
     * @param parsed 一句话解析结果（新建时预填，hits 显示在顶部供核对）
     */
    open(task = null, parsed = null) {
        this.editingId = task ? task.id : null;
        this.title.textContent = task ? '编辑待办' : parsed ? '新建待办 · 已自动识别' : '新建待办';
        this.fParsed.textContent = parsed
            ? (parsed.hits.length ? `识别到：${parsed.hits.join(' · ')}` : '没识别到时间 / 分区 / 优先级，可以手动补')
            : '';
        this.fParsed.classList.toggle('hidden', !parsed);
        if (parsed) task = { ...parsed, id: null };
        this.fText.value = task ? task.text : '';
        this.fArea.value = (task && task.area) || '';
        this.fPlanned.value = (task && task.plannedAt) || '';
        this.fDue.value = (task && task.dueAt) || '';
        const rb = task && task.remindBefore !== undefined && task.remindBefore !== null ? String(task.remindBefore) : '';
        // 解析出的提前量不在下拉里（如提前 30 分钟）→ 临时加一项
        this.fRemind.querySelectorAll('option[data-extra]').forEach(o => o.remove());
        if (rb && !REMIND_OPTIONS.some(o => o.value === rb)) {
            const o = document.createElement('option');
            o.value = rb; o.dataset.extra = '1'; o.textContent = `提前 ${fmtMin(Number(rb))}`;
            this.fRemind.appendChild(o);
        }
        this.fRemind.value = rb;
        this.remindTouched = !!task;
        this.fImportant.classList.toggle('on', !!(task && task.important));
        this.fUrgent.classList.toggle('on', !!(task && task.urgent));
        this.fText.style.borderColor = '';
        this.updateWeekdays();
        this.el.classList.remove('hidden');
        this.fText.focus();
    }

    updateWeekdays() {
        this.wkPairs.forEach(([inp, wk]) => { wk.textContent = weekday(inp.value); });
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
            area: normArea(this.fArea.value),
            plannedAt: this.fPlanned.value || null,
            dueAt: this.fDue.value || null,
            remindBefore: this.fDue.value && this.fRemind.value !== '' ? Number(this.fRemind.value) : null,
            important: this.fImportant.classList.contains('on'),
            urgent: this.fUrgent.classList.contains('on')
        });
        this.close();
    }
}
