// 模拟：待办页点「产品」框头的 +，一句话「明天下午3点前改需求 重要」回车 → 表单分区应自动是「产品」
(() => {
  const box = [...document.querySelectorAll('.area-box')].find(b => b.dataset.area === '产品');
  if (!box) return;
  box.querySelector('.area-add').click();
  const t = document.querySelector('.area-add-row .aa-text');
  t.value = '明天下午3点前改需求 重要';
  t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
})();
