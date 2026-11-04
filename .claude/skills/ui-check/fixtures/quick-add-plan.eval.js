// 模拟：一句话「明天下午3点开会 提前10分钟提醒」→ 计划时间 + 计划提醒（提前 10 分钟），不应出现截止
(() => {
  const input = document.getElementById('quickInput');
  input.value = '明天下午3点开会 提前10分钟提醒';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
})();
