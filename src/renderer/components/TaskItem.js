import { escapeHtml } from '../utils/helpers.js';
import { dueState, isUrgent, shortTime, REMIND_OPTIONS } from '../services/todoSort.js';
import { elapsedMs } from '../services/dailyManager.js';

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
const DEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const STOP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

const hm = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** 计时显示：已计 mm:ss（或 h:mm:ss） */
export function fmtClock(msv) {
    const s = Math.floor(msv / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = n => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/** 计时型常规的进度块（每秒刷新时也只重画这一块） */
export function timerHtml(task, now = Date.now()) {
    const el = elapsedMs(task, now);
    const pct = Math.min(100, (el / (task.targetMin * 60000)) * 100);
    const sess = (task.sessions || []).map(x => `${hm(x.start)}–${hm(x.end)}`);
    if (task.runningSince) sess.push(`${hm(task.runningSince)}–…`);
    return `
        <div class="timer-line">
            <b class="clock ${task.runningSince ? 'running' : ''}">${fmtClock(el)}</b>
            <span class="target">/ ${task.targetMin} 分</span>
        </div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        ${sess.length ? `<div class="sessions">${sess.join('　')}</div>` : ''}`;
}

/** ctx: { late } —— late = 已过晚间检查时间（没完成的标红） */
export function createTaskElement(task, ctx = {}) {
    const el = document.createElement('div');
    let status = '';
    if (task.type === 'daily') status = task.completed ? ' pass' : (ctx.late ? ' fail' : '');
    el.className = 'task' + (task.completed ? ' done' : '') + status;
    el.setAttribute('data-task-id', task.id);
    el.tabIndex = -1;

    const meta = [];
    const when = [];
    let timer = '', timerBtn = '';
    if (task.type === 'daily') {
        if (task.completed) meta.push('<span class="tag ok">通过</span>');
        else if (ctx.late) meta.push('<span class="tag bad">未完成</span>');
        if (task.targetMin) {
            timer = `<div class="timer">${timerHtml(task)}</div>`;
            timerBtn = `<button class="timer-btn ${task.runningSince ? 'running' : ''}" title="${task.runningSince ? '停止计时' : '开始计时'}（S）">${task.runningSince ? STOP_SVG : PLAY_SVG}</button>`;
        }
    } else {
        if (!task.completed) {
            if (task.important) meta.push('<span class="tag imp">重要</span>');
            if (isUrgent(task)) meta.push('<span class="tag urg">紧急</span>');
        }
        if (task.dueAt) {
            const st = dueState(task);
            const suffix = st === 'overdue' ? ' 已过期' : '';
            when.push(`<span class="w due ${st || ''}"><i>截止</i><b>${shortTime(task.dueAt)}${suffix}</b></span>`);
            const opt = REMIND_OPTIONS.find(o => o.value !== '' && Number(o.value) === task.remindBefore);
            if (opt && !task.completed) meta.push(`<span title="截止提醒">⏰ ${opt.label}</span>`);
        }
        if (task.plannedAt) when.push(`<span class="w plan"><i>计划</i><b>${shortTime(task.plannedAt)}</b></span>`);
    }
    if (task.completed && task.completedAt) {
        meta.push(`<span>完成于 ${hm(task.completedAt)}</span>`);
    }

    el.innerHTML = `
        <label class="check">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="box">${task.completed ? CHECK_SVG : ''}</span>
        </label>
        <div class="task-body task-text-container" title="双击编辑（Enter）">
            <p class="task-text">${escapeHtml(task.text)}</p>
            ${when.length ? `<div class="when">${when.join('')}</div>` : ''}
            ${timer}
            ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
        </div>
        ${timerBtn}
        <button class="delete-btn" title="删除（Delete，需再按一次确认）">${DEL_SVG}</button>`;
    return el;
}
