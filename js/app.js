import { isConfigured, app } from './firebase.js';

// Firebase につながる準備ができたかを、画面の下に表示する
const statusEl = document.getElementById('firebase-status');
if (isConfigured) {
  statusEl.textContent = 'Firebase：接続設定を読み込みました（' + app.options.projectId + '）';
} else {
  statusEl.textContent = 'Firebase：js/config.js に設定値を貼ってください';
  statusEl.classList.add('warn');
}

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
