// 模拟：点「产品」分区框头的 +，在框内输入行加一项（带 20 分钟），回车；再输入第二项不回车（看行保持打开）
(() => {
  const box = [...document.querySelectorAll('.area-box')].find(b => b.dataset.area === '产品');
  if (!box) return;
  box.querySelector('.area-add').click();
  const enter = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  let row = document.querySelector('.area-add-row');
  row.querySelector('.aa-text').value = '画原型图';
  row.querySelector('.aa-min').value = '20';
  enter(row.querySelector('.aa-text'));
  row = document.querySelector('.area-add-row');
  if (row) row.querySelector('.aa-text').value = '第二项（未回车）';
})();
