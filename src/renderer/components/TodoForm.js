// 零碎待办的新建 / 编辑表单
import { REMIND_OPTIONS, PLAN_REMIND_OPTIONS, weekday } from '../services/todoSort.js';
import { normArea } from '../services/areas.js';
import { fmtMin } from '../services/quickParse.js';
// 选中某个提前量；不在预设里（如解析出的提前 15 分钟）→ 临时加一项
function setSelect(sel, options, value) {
    sel.querySelectorAll('option[data-extra]').forEach(o => o.remove());
    if (value && !options.some(o => o.value === value)) {
        const o = document.createElement('option');
        o.value = value; o.dataset.extra = '1'; o.textContent = `提前 ${fmtMin(Number(value))}`;
        sel.appendChild(o);
    }
    sel.value = value;
}

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
        // 计划时间 = 这个点去做：填了就默认到点提醒（没有截止也会叫你）
        this.fPlanRemind = document.getElementById('fPlanRemind');
        this.fPlanRemind.innerHTML = PLAN_REMIND_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        this.fPlanned.addEventListener('change', () => {
            if (this.fPlanned.value && this.fPlanRemind.value === '' && !this.planTouched) this.fPlanRemind.value = '0';
            this.updateRemindFields();
        });
        this.fDue.addEventListener('change', () => this.updateRemindFields());
        this.fPlanRemind.addEventListener('change', () => { this.planTouched = true; });
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
            // 用 e.code 而不是 e.key：Mac 上 Option+I 打出的是 ˆ，e.key 对不上
            if (e.altKey && e.code === 'KeyI') { e.preventDefault(); this.fImportant.click(); }
            if (e.altKey && e.code === 'KeyU') { e.preventDefault(); this.fUrgent.click(); }
        });
    }

    get isOpen() { return !this.el.classList.contains('hidden'); }

    /**
     * @param task 编辑已有待办；null = 新建
     * @param parsed 一句话解析结果（新建时预填，hits 显示在顶部供核对）
     */
    open(task = null, parsed = null) {
        this.editingId = task ? task.id : null;
        this.title.textContent = task ? '编辑待办' : parsed ? (parsed.title || '新建待办 · 已自动识别') : '新建待办';
        this.fParsed.textContent = parsed
            ? (parsed.hits.length ? `识别到：${parsed.hits.join(' · ')}` : '没识别到时间 / 分区 / 优先级，可以手动补')
            : '';
        this.fParsed.classList.toggle('hidden', !parsed || !!parsed.title);
        if (parsed) task = { ...parsed, id: null };
        this.fText.value = task ? task.text : '';
        this.fArea.value = (task && task.area) || '';
        this.fPlanned.value = (task && task.plannedAt) || '';
        this.fDue.value = (task && task.dueAt) || '';
        const rb = task && task.remindBefore !== undefined && task.remindBefore !== null ? String(task.remindBefore) : '';
        setSelect(this.fRemind, REMIND_OPTIONS, rb);
        const pr = task && task.planRemind !== undefined && task.planRemind !== null ? String(task.planRemind) : '';
        setSelect(this.fPlanRemind, PLAN_REMIND_OPTIONS, pr);
        this.remindTouched = !!task;
        this.planTouched = !!task;
        this.updateRemindFields();
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

    // 提醒下拉只在填了对应时间时显示，避免「截止提醒」和「计划提醒」混在一起
    updateRemindFields() {
        document.getElementById('fPlanRemindField').classList.toggle('hidden', !this.fPlanned.value);
        document.getElementById('fRemindField').classList.toggle('hidden', !this.fDue.value);
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
            planRemind: this.fPlanned.value && this.fPlanRemind.value !== '' ? Number(this.fPlanRemind.value) : null,
            important: this.fImportant.classList.contains('on'),
            urgent: this.fUrgent.classList.contains('on')
        });
        this.close();
    }
}
