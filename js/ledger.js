// 台帳の画面（WBS 1-4）：登録した注文を新しい順に表で並べる
import { watchOrders, formatOrderNo } from './orders.js';

const bodyEl = document.getElementById('ledger-body');
const statusEl = document.getElementById('ledger-status');
let stopWatching = null;

// "2026-11-06" → "11/06"。年が今年でなければ年も付ける
function shortDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return y === String(new Date().getFullYear()) ? `${m}/${d}` : `${y}/${m}/${d}`;
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text; // textContent で入れるので、名前や備考に記号があっても表が崩れない
  if (className) td.className = className;
  return td;
}

// 表を描き直す（見た目の確かめにも使えるよう export しておく）
export function render(orders) {
  bodyEl.replaceChildren(...orders.map((o) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(formatOrderNo(o.orderNo)),
      cell(shortDate(o.orderDate)),
      cell(o.customerType),
      cell(o.customerName),
      cell(String(o.quantity), 'num'),
      cell(o.unitPrice.toLocaleString('ja-JP'), 'num'),
      cell(shortDate(o.plannedShipDate)),
      cell(o.shippingMethod),
      cell(o.orderChannel),
      cell(o.note || '', 'note'),
    );
    return tr;
  }));
  statusEl.textContent = orders.length === 0
    ? 'まだ注文がありません。「注文の登録」から登録してください'
    : `全${orders.length}件（新しい順）`;
}

// ログインして台帳を使えるようになったら見張りを始め、ログアウトしたらやめる
export function startLedger() {
  if (stopWatching) return;
  statusEl.textContent = '読み込んでいます…';
  stopWatching = watchOrders(render, (e) => {
    statusEl.textContent = '台帳を読み込めませんでした（' + e.code + '）';
  });
}

export function stopLedger() {
  if (stopWatching) stopWatching();
  stopWatching = null;
  bodyEl.replaceChildren(); // ログアウトしたら画面からも消す
}
