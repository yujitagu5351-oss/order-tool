// 画面の切り替え：URL の # （#order / #ledger / #sheet）で表示する画面を決める
const VIEWS = ['order', 'ledger', 'sheet'];
const DEFAULT_VIEW = 'order';

function showView() {
  const name = location.hash.slice(1);
  const view = VIEWS.includes(name) ? name : DEFAULT_VIEW;

  VIEWS.forEach((v) => {
    document.getElementById('view-' + v).classList.toggle('active', v === view);
  });
  document.querySelectorAll('.menu a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });
}

window.addEventListener('hashchange', showView);
showView();
