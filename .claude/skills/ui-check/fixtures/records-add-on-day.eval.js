// 模拟：记录页点今天后面第 2 天 → 「+ 给这天添加待办」→ 表单应预填计划时间 09:00 + 到点提醒，截止提醒隐藏
(() => {
  const cells = [...document.querySelectorAll('.cal-cell')];
  const i = cells.findIndex(c => c.classList.contains('today'));
  cells[i + 2].click();
  setTimeout(() => document.querySelector('.cal-add').click(), 100);
})();
