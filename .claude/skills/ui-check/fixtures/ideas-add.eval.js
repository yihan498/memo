// 想法页：带 #分区 的一句回车保存 → 出现在「待处理」最上面并带分区标签；
// 3 秒后切到「已落实」页看已落实的样式
const inp = document.getElementById('ideaInput');
inp.value = '记录页可以显示想法数 #产品';
inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
setTimeout(() => document.querySelector('.idea-seg[data-status="done"]').click(), 3000);
