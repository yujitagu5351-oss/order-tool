// 台帳の画面（WBS 1-4）：登録した注文を新しい順に表で並べる
// 機能3（WBS 3-1〜3-3）：出荷済みにする／元に戻す、出荷予定日を過ぎた未出荷の注文を目立たせる
// 機能8（WBS 8-1・8-2）：「直す」で入力画面を直す形で開く（消すのも、そこから）
import { watchOrders, formatOrderNo, markShipped, unmarkShipped } from './orders.js';
import { todayString, startEdit } from './order-form.js';
import { logUsage } from './usage.js';

const bodyEl = document.getElementById('ledger-body');
const statusEl = document.getElementById('ledger-status');
const flashEl = document.getElementById('ledger-flash');
let stopWatching = null;
let ordersById = new Map(); // 「直す」を押したときに、その注文の中身を取り出すため

// 直した・消したあとに、台帳の上にひとこと出す（次に別の画面へ移るまで）
export function showLedgerFlash(text) {
  flashEl.textContent = text;
  flashEl.hidden = false;
}
window.addEventListener('hashchange', () => {
  if (location.hash !== '#ledger') flashEl.hidden = true;
});

function editCell(o) {
  const td = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small-button';
  button.textContent = '直す';
  button.dataset.id = o.id;
  button.dataset.action = 'edit';
  td.append(button);
  return td;
}

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

// 出荷の列：未出荷なら「出荷済みにする」、出荷済みなら出荷日と「戻す」
function shipCell(o, overdue) {
  const cellEl = document.createElement('td');
  const td = document.createElement('div'); // 中身を横に並べる箱（td そのものを flex にすると表が崩れる）
  td.className = 'ship';
  cellEl.append(td);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.id = o.id;
  if (o.shippedDate) {
    const label = document.createElement('span');
    label.className = 'shipped-label';
    label.textContent = `済 ${shortDate(o.shippedDate)}`;
    button.textContent = '戻す';
    button.className = 'small-button';
    button.dataset.action = 'unship';
    td.append(label, button);
  } else {
    if (overdue) {
      const badge = document.createElement('span');
      badge.className = 'overdue-badge';
      badge.textContent = '遅れ';
      td.append(badge);
    }
    button.textContent = '出荷済みにする';
    button.className = 'small-button primary';
    button.dataset.action = 'ship';
    td.append(button);
  }
  return cellEl;
}

// 表を描き直す（見た目の確かめにも使えるよう export しておく）
export function render(orders) {
  const today = todayString();
  let overdueCount = 0;
  ordersById = new Map(orders.map((o) => [o.id, o]));
  bodyEl.replaceChildren(...orders.map((o) => {
    // 出荷予定日を過ぎても出荷済みになっていない（WBS 3-3）
    const overdue = !o.shippedDate && o.plannedShipDate < today;
    if (overdue) overdueCount += 1;
    const tr = document.createElement('tr');
    if (overdue) tr.className = 'overdue';
    if (o.shippedDate) tr.className = 'shipped';
    tr.append(
      cell(formatOrderNo(o.orderNo)),
      shipCell(o, overdue),
      editCell(o),
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
  if (orders.length === 0) {
    statusEl.textContent = 'まだ注文がありません。「注文の登録」から登録してください';
    statusEl.classList.remove('warn');
  } else {
    statusEl.textContent = `全${orders.length}件（新しい順）`
      + (overdueCount > 0 ? `　出荷予定日を過ぎた未出荷：${overdueCount}件` : '');
    statusEl.classList.toggle('warn', overdueCount > 0);
  }
}

// 「出荷済みにする」「戻す」のボタン
bodyEl.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'edit') {
    const order = ordersById.get(button.dataset.id);
    if (!order) return;
    startEdit(order);
    location.hash = '#order';
    return;
  }
  button.disabled = true; // 2回押さないように（成功すると表が描き直される）
  const order = ordersById.get(button.dataset.id); // 表が描き直される前に、注文番号を控えておく
  const no = order ? formatOrderNo(order.orderNo) : '';
  try {
    if (button.dataset.action === 'ship') {
      await markShipped(button.dataset.id, todayString());
      logUsage('出荷済みにする', no);
    } else {
      await unmarkShipped(button.dataset.id);
      logUsage('戻す', no);
    }
  } catch (err) {
    button.disabled = false;
    alert('変更できませんでした（' + (err.code || err.message) + '）');
  }
});

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
