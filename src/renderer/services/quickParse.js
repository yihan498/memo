// 一句话添加待办：用规则把中文句子解析成表单字段。纯函数，不联网，可直接用 node 测试。
//
// 识别（识别不了的部分原样留在事项文字里，不乱填）：
//   分区     #产品
//   优先级   重要 / 紧急 / 重要紧急
//   提醒     提前1小时提醒 / 提前半天提醒 / 到点提醒 / 不提醒 / 提醒我（= 到点提醒）
//   日期     今天 明天 后天 大后天 今晚 明早 明晚 / 周五 这周五 下周一 / 11月8号 8号 11/8 / 月底 周末
//   时间     下午3点 3点半 15:30 晚上8点15 / 只写时段：上午 下午 晚上…
//   相对     两小时后 30分钟后
//   截止 vs 计划：带「前 / 之前 / 截止 / ddl」→ 截止时间（默认提前 1 小时提醒）；
//                 否则 → 计划时间 =「这个点去做」，默认到点提醒（planRemind = 0）；「提前N…提醒」作用在这个时间上
//
// 返回 { text, area, important, urgent, dueAt, plannedAt, remindBefore, planRemind, hits }
// dueAt / plannedAt 是 datetime-local 格式 'YYYY-MM-DDTHH:MM'；hits 是识别到的内容（给界面展示）

const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 阿拉伯数字或中文数字（到 99）→ 数字；「半」= 0.5 */
export function cnNum(s) {
    if (/^\d+$/.test(s)) return Number(s);
    if (s === '半') return 0.5;
    if (s.includes('十')) {
        const [a, b] = s.split('十');
        return (a ? CN[a] : 1) * 10 + (b ? CN[b] : 0);
    }
    return s.length === 1 && s in CN ? CN[s] : NaN;
}

const NUM = '(?:\\d{1,2}|[零〇一二两三四五六七八九十]{1,3})';
const WD = '[一二三四五六日天1-7]';
const DATE = `今天|今日|今晚|明天|明早|明晚|后天|大后天|月底|周末|(?:下|这|本)?(?:周|星期|礼拜)${WD}|${NUM}月${NUM}[日号]?|\\d{1,2}/\\d{1,2}|${NUM}[日号]`;
const PERIOD = '早上|早晨|上午|中午|下午|傍晚|晚上|夜里|凌晨';
const TIME = `(${NUM})(?:[点时]|[:：](?=\\d))(半|${NUM}分?|\\d{2})?`;
const DT_RE = new RegExp(
    `(截止|ddl|DDL|due)?\\s*(${DATE})?\\s*(${PERIOD})?\\s*(?:${TIME})?\\s*(之前|以前|前|截止|ddl|DDL)?`, 'g');

const PERIOD_DEFAULT = { 早上: 8, 早晨: 8, 上午: 9, 中午: 12, 下午: 15, 傍晚: 18, 晚上: 20, 夜里: 22, 凌晨: 6 };
const PM = ['下午', '傍晚', '晚上', '夜里'];

const pad = n => String(n).padStart(2, '0');
export const fmtLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dow = d => (d.getDay() || 7); // 周一=1 … 周日=7
const wdNum = c => (c === '日' || c === '天' ? 7 : cnNum(c));

/** 日期词 → 当天 0 点；返回 { date, period? } */
function resolveDate(word, now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fixed = { 今天: [0], 今日: [0], 今晚: [0, '晚上'], 明天: [1], 明早: [1, '早上'], 明晚: [1, '晚上'], 后天: [2], 大后天: [3] };
    if (fixed[word]) return { date: addDays(today, fixed[word][0]), period: fixed[word][1] };
    if (word === '月底') return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
    if (word === '周末') return { date: addDays(today, Math.max(0, 6 - dow(today))) };
    let m = word.match(new RegExp(`^(下|这|本)?(?:周|星期|礼拜)(${WD})$`));
    if (m) {
        const target = wdNum(m[2]);
        const monday = addDays(today, 1 - dow(today));
        if (m[1] === '下') return { date: addDays(monday, 7 + target - 1) };
        if (m[1]) return { date: addDays(monday, target - 1) };
        // 只说「周五」：本周还没过就是本周，过了就是下周
        return { date: addDays(monday, target - 1 + (target < dow(today) ? 7 : 0)) };
    }
    m = word.match(new RegExp(`^(${NUM})月(${NUM})[日号]?$`)) || word.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m) {
        let d = new Date(today.getFullYear(), cnNum(m[1]) - 1, cnNum(m[2]));
        if (d < today) d = new Date(today.getFullYear() + 1, cnNum(m[1]) - 1, cnNum(m[2]));
        return { date: d };
    }
    m = word.match(new RegExp(`^(${NUM})[日号]$`));
    if (m) {
        let d = new Date(today.getFullYear(), today.getMonth(), cnNum(m[1]));
        if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, cnNum(m[1]));
        return { date: d };
    }
    return null;
}

const minutesOf = (n, unit) => Math.round(cnNum(n) * (unit === '天' ? 1440 : unit.includes('小时') ? 60 : 1));

export function parseTodo(input, now = new Date()) {
    const out = { text: '', area: null, important: false, urgent: false, dueAt: null, plannedAt: null, remindBefore: null, planRemind: null, hits: [] };
    let s = ` ${input} `;
    const take = (re, fn) => { s = s.replace(re, (...m) => { fn(m); return ' '; }); };

    // 分区
    take(/[#＃]([^\s#＃，,。；;]+)/, m => { out.area = m[1]; out.hits.push(`分区 ${m[1]}`); });

    // 优先级
    take(/重要(?:且|又|并且)?紧急|紧急(?:且|又)?重要/, () => { out.important = out.urgent = true; });
    take(/(?:非常|很|特别)?重要(?!的)/, () => { out.important = true; });
    take(/紧急|加急|很急|特急/, () => { out.urgent = true; });
    if (out.important) out.hits.push('重要');
    if (out.urgent) out.hits.push('紧急');

    // 提醒（先处理，避免「提前1天」被当成日期）
    let remindWord = false, noRemind = false;
    take(/不(?:用|要|需要)?提醒/, () => { noRemind = true; });
    take(new RegExp(`(?:提前)?(${NUM}|半)个?(分钟|小时|钟头|天)(?:前)?提醒(?:我)?`), m => {
        out.remindBefore = minutesOf(m[1], m[2]);
    });
    take(/(?:到点|准时|截止时|按时)提醒(?:我)?/, () => { out.remindBefore = 0; });
    take(/提醒(?:我|一下)?/, () => { remindWord = true; });

    // 相对时间：两小时后 / 30分钟后
    let when = null;
    take(new RegExp(`(${NUM}|半)个?(分钟|小时|钟头)(?:以?后|之后)`), m => {
        when = { at: new Date(now.getTime() + minutesOf(m[1], m[2]) * 60000), due: false };
    });

    // 日期 + 时段 + 时间（取第一处有内容的）
    if (!when) {
        DT_RE.lastIndex = 0;
        let m;
        while ((m = DT_RE.exec(s))) {
            if (!m[0].trim()) { DT_RE.lastIndex++; continue; }
            const [whole, pre, dateW, periodW, hourW, minW, post] = m;
            // 只有「前」「ddl」这种词，不算时间；只前进一个字，让「ddl 11月8号」能从 ddl 开头重新匹配
            if (!dateW && !periodW && !hourW) { DT_RE.lastIndex = m.index + 1; continue; }
            const r = dateW ? resolveDate(dateW, now) : null;
            if (dateW && !r) continue;
            const period = periodW || (r && r.period);
            let date = r ? r.date : new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const due = !!(pre || post);
            let h, mm = 0;
            if (hourW) {
                h = cnNum(hourW);
                if (minW) mm = minW === '半' ? 30 : cnNum(minW.replace('分', ''));
                if (period && PM.includes(period) && h < 12) h += 12;
                else if (period === '中午' && h <= 3) h += 12;
                else if (!period && h >= 1 && h <= 7) h += 12; // 没说上下午：1–7 点按下午算
            } else if (period) {
                h = PERIOD_DEFAULT[period];
            } else {
                [h, mm] = due ? [23, 59] : [9, 0]; // 只有日期：截止算当天结束，计划算早上 9 点
            }
            let at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, mm);
            if (!dateW && at < now) at = addDays(at, 1), at.setHours(h, mm); // 没说哪天且已过 → 明天
            when = { at, due };
            s = s.slice(0, m.index) + ' ' + s.slice(m.index + whole.length);
            break;
        }
    }

    if (when) {
        // 没说截止的时间点 = 这个点去做 → 计划时间，默认到点提醒（不硬凑一个截止时间）
        const asDue = when.due;
        if (asDue) out.dueAt = fmtLocal(when.at); else out.plannedAt = fmtLocal(when.at);
        out.hits.push(`${asDue ? '截止' : '计划'} ${fmtLocal(when.at).slice(5).replace('T', ' ')}`);
        if (asDue && out.remindBefore === null && !noRemind) out.remindBefore = remindWord ? 0 : 60;
        if (!asDue) out.planRemind = noRemind ? null : (out.remindBefore ?? 0);
    }
    if (!out.dueAt) out.remindBefore = null; // 没有截止时间就没有截止提醒
    if (noRemind) out.remindBefore = null;
    if (out.remindBefore !== null) out.hits.push(out.remindBefore === 0 ? '截止时提醒' : `截止前 ${fmtMin(out.remindBefore)}提醒`);
    if (out.planRemind !== null) out.hits.push(out.planRemind === 0 ? '到点提醒' : `提前 ${fmtMin(out.planRemind)}提醒`);

    out.text = s.replace(/\s+/g, ' ')
        .replace(/^[\s，,。、；;:：]+|[\s，,。、；;:：]+$/g, '')
        .replace(/^(?:记得|需要|要|得)\s*/, '')
        .trim() || input.trim();
    return out;
}

export function fmtMin(min) {
    if (min % 1440 === 0) return `${min / 1440} 天`;
    if (min % 60 === 0) return `${min / 60} 小时`;
    return `${min} 分钟`;
}
