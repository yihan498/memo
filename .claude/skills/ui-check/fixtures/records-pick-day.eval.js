// 模拟：记录页点「昨天」那一格 → 下方明细应切到昨天（常规 + 完成的待办）
(() => {
  const cells = [...document.querySelectorAll('.cal-cell')];
  const i = cells.findIndex(c => c.classList.contains('today'));
  if (i > 0) cells[i - 1].click();
})();
