// 書き出しの画面（機能4。WBS 4-1〜4-3）：期間と「出荷済みだけ／すべて」を選んで、台帳を CSV で保存する
// ・期間は出荷日で選ぶ。まだ出荷していない注文は出荷予定日で選ぶ（「年月」の列も同じ日付から）
// ・Excel で開いても文字化けしないよう、UTF-8 の先頭に BOM を付ける
// ・売上金額・作業代・送料・差引・年月の列を足す。作業代と送料は、注文に記録した登録時の金額を使い、
//   記録がない注文（設定より前に登録したもの）は、書き出す時点の設定の金額を使う
import { fetchAllOrders, formatOrderNo } from './orders.js';
import { getSettings } from './settings.js';
import { todayString } from './order-form.js';

const COLUMNS = [
  '注文番号', '注文日', '注文元の種類', '注文元の名前', '数量（袋）', '単価',
  '出荷予定日', '出荷日', '送り方', '注文の届き方', '備考',
  '売上金額', '作業代', '送料', '差引', '年月',
];

// 期間を選ぶときの日付：出荷日。未出荷なら出荷予定日
function basisDate(o) {
  return o.shippedDate || o.plannedShipDate;
}

// 注文を選んで、CSV の行（値の配列）にする。
// 金額を決められない注文（作業代か送料が、注文にも設定にもない）があれば missingFee に数える
export function buildRows(orders, { from, to, scope }, settings) {
  let missingFee = 0;
  const picked = orders
    .filter((o) => (scope === 'all' || o.shippedDate))
    .filter((o) => from <= basisDate(o) && basisDate(o) <= to)
    .sort((a, b) => basisDate(a).localeCompare(basisDate(b)) || a.orderNo - b.orderNo);

  const rows = picked.map((o) => {
    const perBag = o.workFeePerBag ?? settings?.workFeePerBag ?? null;
    const shipping = o.shippingFee ?? settings?.shippingFees?.[o.shippingMethod] ?? null;
    const sales = o.quantity * o.unitPrice;
    const work = perBag === null ? null : o.quantity * perBag;
    if (work === null || shipping === null) missingFee += 1;
    const net = work === null || shipping === null ? null : sales - work - shipping;
    const [y, m] = basisDate(o).split('-');
    return [
      formatOrderNo(o.orderNo), o.orderDate, o.customerType, o.customerName, o.quantity, o.unitPrice,
      o.plannedShipDate, o.shippedDate || '', o.shippingMethod, o.orderChannel, o.note || '',
      sales, work ?? '', shipping ?? '', net ?? '', `${y}年${Number(m)}月`,
    ];
  });
  const totalSales = rows.reduce((sum, r) => sum + r[11], 0);
  return { rows, missingFee, totalSales };
}

// CSV の1つの値を書く。カンマ・ダブルクォート・改行を含むときは "" で囲む。
// 文字の値が = + - @ で始まると Excel が数式として動かしてしまうので、先頭に ' を付けて文字として扱わせる
function csvValue(v) {
  if (typeof v === 'number') return String(v);
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows) {
  const lines = [COLUMNS, ...rows].map((r) => r.map(csvValue).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // 先頭の ﻿ が BOM。Excel が UTF-8 だとわかる
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- 画面 ----

const form = document.getElementById('export-form');
const messageEl = document.getElementById('export-message');

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'form-message ' + kind;
  messageEl.hidden = false;
}

// 期間の初期値：今月の1日〜月末
function setDefaultPeriod() {
  const [y, m] = todayString().split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  form.from.value = `${y}-${mm}-01`;
  form.to.value = `${y}-${mm}-${String(last).padStart(2, '0')}`;
}
setDefaultPeriod();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = form.from.value;
  const to = form.to.value;
  const scope = form.scope.value;
  if (!from || !to || from > to) {
    showMessage('開始日と終了日を確かめてください（開始日は終了日より前に）', 'error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const orders = await fetchAllOrders();
    const { rows, missingFee, totalSales } = buildRows(orders, { from, to, scope }, getSettings());
    if (rows.length === 0) {
      showMessage('この期間に書き出す注文はありません', 'error');
      return;
    }
    const scopeLabel = scope === 'all' ? 'すべて' : '出荷済み';
    download(toCsv(rows), `受注台帳_${from}_${to}_${scopeLabel}.csv`);
    showMessage(
      `${rows.length}件を書き出しました（売上金額の合計 ${totalSales.toLocaleString('ja-JP')}円）`
        + (missingFee > 0 ? `。${missingFee}件は作業代か送料が決まっていないので、その欄が空です。「設定」で金額を保存してください` : ''),
      missingFee > 0 ? 'error' : 'done',
    );
  } catch (err) {
    showMessage('書き出せませんでした（' + (err.code || err.message) + '）', 'error');
  } finally {
    button.disabled = false;
  }
});
