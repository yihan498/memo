// 背单词已在计时 → 再开「写产品文档」倒计时（两个应同时在跑）→ 4.5 秒后收起
const click = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
click(document.querySelector('[data-task-id="d1"] .timer-btn'));
setTimeout(() => click(document.getElementById('compactBtn')), 2500);
