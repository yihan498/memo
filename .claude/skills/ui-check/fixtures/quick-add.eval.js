// 模拟：在待办页的一句话输入框里输入一句话并回车 → 应弹出已填好的表单（带「识别到：…」）
// 改这句话就能目测解析效果；页面已加载 1.5 秒后执行
(() => {
  const input = document.getElementById('quickInput');
  if (!input) return;
  input.value = '周五下午3点前交周报 #产品 重要 提前1小时提醒';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
})();
