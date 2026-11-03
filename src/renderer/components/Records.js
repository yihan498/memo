// 「记录」页：选一段时间，看常规完成率、计时时长、待办完成情况，以及每天的明细
import { escapeHtml } from '../utils/helpers.js';
import { buildRecords, presetRange, fmtMin } from '../services/records.js';

const hm = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export class Records {
    constructor(getState) {
        this.getState = getState;
        this.el = document.getElementById('recordsView');
        this.from = document.getElementById('recFrom');
        this.to = document.getElementById('recTo');
        this.body = document.getElementById('recBody');
        this.preset = '7';
        document.querySelectorAll('.rec-preset').forEach(b => b.addEventListener('click', () => this.setPreset(b.dataset.p)));
        [this.from, this.to].forEach(i => i.addEventListener('change', () => { this.preset = null; this.render(); }));
    }

    setPreset(p) {
        this.preset = p;
        this.render();
    }

    cyclePreset() {
        const order = ['7', '30', 'month', 'all'];
        this.setPreset(order[(order.indexOf(this.preset) + 1) % order.length]);
    }

    render() {
        const state = this.getState();
        if (this.preset) [this.from.value, this.to.value] = presetRange(this.preset, state);
        document.querySelectorAll('.rec-preset').forEach(b => b.classList.toggle('active', b.dataset.p === this.preset));
        let from = this.from.value, to = this.to.value;
        if (!from || !to) return;
        if (from > to) [from, to] = [to, from];

        const { days, summary: s, perTask } = buildRecords(state, from, to);
        const rate = s.rate === null ? '—' : s.rate + '%';
        const cards = `
            <div class="cards">
                <div class="card"><b>${rate}</b><span>常规完成率<br>${s.itemDone}/${s.itemTotal} 项次</span></div>
                <div class="card"><b>${s.perfectDays}<small>/${s.days}</small></b><span>全部完成的天数</span></div>
                <div class="card"><b>${fmtMin(s.minutes)}</b><span>累计计时</span></div>
                <div class="card"><b>${s.todoDone}</b><span>完成待办${s.todoWithDue ? `<br>按时 ${s.todoOnTime}/${s.todoWithDue}` : ''}</span></div>
            </div>`;

        const per = perTask.length ? `
            <div class="rec-h">每项常规</div>
            ${perTask.map(p => {
                const pct = Math.round((p.done / p.total) * 100);
                return `<div class="per">
                    <span class="per-name">${escapeHtml(p.text)}</span>
                    <span class="per-bar"><i class="${pct >= 80 ? 'ok' : pct < 50 ? 'bad' : ''}" style="width:${pct}%"></i></span>
                    <span class="per-num">${p.done}/${p.total}${p.timed ? ` · 均 ${Math.round(p.minutes / p.total)} 分` : ''}</span>
                </div>`;
            }).join('')}` : '';

        const list = days.length ? `
            <div class="rec-h">每天明细</div>
            ${days.map(d => {
                const all = d.total && d.done === d.total;
                const status = d.today ? '<span class="day-st">进行中</span>'
                    : `<span class="day-st ${all ? 'ok' : 'bad'}">${all ? '全部完成' : `${d.done}/${d.total}`}</span>`;
                const items = d.items
                    ? d.items.map(i => {
                        const cls = i.done ? 'ok' : (d.today ? '' : 'bad');
                        let extra = '';
                        if (i.targetMin) {
                            extra = ` <em>${i.minutes}/${i.targetMin}分</em>`;
                            if (i.sessions && i.sessions.length) extra += `<small>${i.sessions.map(x => `${hm(x.start)}–${hm(x.end)}`).join(' ')}</small>`;
                        }
                        return `<span class="chip ${cls}">${escapeHtml(i.text)}${extra}</span>`;
                    }).join('')
                    : (d.missed || []).map(x => `<span class="chip bad">${escapeHtml(x)}</span>`).join('');
                return `<div class="day">
                    <div class="day-head"><b>${d.key.slice(5).replace('-', '/')} ${d.week}</b>${status}</div>
                    <div class="chips">${items}</div>
                </div>`;
            }).join('')}` : '<p class="rec-empty">这段时间还没有记录</p>';

        this.body.innerHTML = cards + per + list;
    }
}
