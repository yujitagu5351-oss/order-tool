// 出荷指示書の画面（WBS 2-1・2-2）：日付を選ぶと、その日が出荷予定日の注文を1枚にまとめる
// 委託先に渡すものなので、金額（単価など）は載せない
import { watchOrdersByShipDate, formatOrderNo } from './orders.js';
import { todayString } from './order-form.js';

const dateInput = document.getElementById('sheet-date');
const dateLabel = document.getElementById('sheet-date-label');
const statusEl = document.getElementById('sheet-status');
const bodyEl = document.getElementById('sheet-body');
const totalEl = document.getElementById('sheet-total');
const emptyEl = document.getElementById('sheet-empty');
const tableEl = document.querySelector('.sheet-table');

let stopWatching = null;
let active = false;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// "2026-11-06" → "2026年11月6日（金）"
function longDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日（${w}）`;
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

// 表を描き直す（見た目の確かめにも使えるよう export しておく）
export function render(orders) {
  bodyEl.replaceChildren(...orders.map((o) => {
    const tr = document.createElement('tr');
    tr.append(
      cell('□', 'check'), // 委託先が終わったものに印を付ける欄
      cell(formatOrderNo(o.orderNo)),
      cell(o.customerName),
      cell(String(o.quantity), 'num'),
      cell(o.shippingMethod),
      cell(o.note || '', 'note'),
    );
    return tr;
  }));
  const total = orders.reduce((sum, o) => sum + o.quantity, 0);
  totalEl.textContent = `${total}袋`;
  tableEl.hidden = orders.length === 0;
  emptyEl.hidden = orders.length > 0;
  statusEl.textContent = `${orders.length}件・合計${total}袋`;
}

function watchSelectedDate() {
  if (stopWatching) stopWatching();
  const date = dateInput.value;
  if (!date) {
    stopWatching = null;
    return;
  }
  dateLabel.textContent = longDate(date);
  statusEl.textContent = '読み込んでいます…';
  stopWatching = watchOrdersByShipDate(date, render, (e) => {
    statusEl.textContent = '注文を読み込めませんでした（' + e.code + '）';
  });
}

dateInput.addEventListener('change', () => {
  if (active) watchSelectedDate();
});

// ログインして台帳を使えるようになったら始める。日付の初期値は今日
export function startSheet() {
  if (active) return;
  active = true;
  dateInput.value = todayString();
  watchSelectedDate();
}

export function stopSheet() {
  active = false;
  if (stopWatching) stopWatching();
  stopWatching = null;
  bodyEl.replaceChildren();
  totalEl.textContent = '';
}
