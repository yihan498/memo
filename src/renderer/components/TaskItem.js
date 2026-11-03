import { escapeHtml } from '../utils/helpers.js';
import { dueState, isUrgent, shortTime, REMIND_OPTIONS } from '../services/todoSort.js';

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
const DEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>';

export function createTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task' + (task.completed ? ' done' : '');
    el.setAttribute('data-task-id', task.id);

    const meta = [];
    if (task.type === 'daily') {
        if (task.missedLast && !task.completed) meta.push('<span class="tag missed">上次未完成</span>');
    } else {
        if (!task.completed) {
            if (task.important) meta.push('<span class="tag imp">重要</span>');
            if (isUrgent(task)) meta.push('<span class="tag urg">紧急</span>');
        }
        if (task.plannedAt) meta.push(`<span>计划 ${shortTime(task.plannedAt)}</span>`);
        if (task.dueAt) {
            const st = dueState(task);
            const suffix = st === 'overdue' ? '（已过期）' : '';
            meta.push(`<span class="due ${st || ''}">截止 ${shortTime(task.dueAt)}${suffix}</span>`);
            const opt = REMIND_OPTIONS.find(o => o.value !== '' && Number(o.value) === task.remindBefore);
            if (opt && !task.completed) meta.push(`<span title="截止提醒">⏰ ${opt.label}</span>`);
        }
    }
    if (task.completed && task.completedAt) {
        meta.push(`<span>完成于 ${new Date(task.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>`);
    }

    el.innerHTML = `
        <label class="check">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="box">${task.completed ? CHECK_SVG : ''}</span>
        </label>
        <div class="task-body task-text-container" title="双击编辑">
            <p class="task-text">${escapeHtml(task.text)}</p>
            ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
        </div>
        <button class="delete-btn" title="删除">${DEL_SVG}</button>`;
    return el;
}
