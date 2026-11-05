// 注文の入力画面（WBS 1-1）：初期値を入れ、「登録」で入力をチェックして、1件分の注文データにまとめる
// Firestore への保存は orders.js（WBS 1-2）
import { HOLIDAY_YEARS, nextBusinessDay } from './holidays.js';

// 今日の日付を "YYYY-MM-DD" で返す（端末の時刻＝日本時間で数える）
export function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const form = document.getElementById('order-form');
const messageEl = document.getElementById('order-form-message');

// 入力欄の名前と、エラーのときに出す項目名（画面に並ぶ順）
const LABELS = {
  orderDate: '注文日',
  customerType: '注文元の種類',
  customerName: '注文元の名前',
  quantity: '数量',
  unitPrice: '単価',
  plannedShipDate: '出荷予定日',
  shippingMethod: '送り方',
  orderChannel: '注文の届き方',
};
const FIELD_ORDER = Object.keys(LABELS);

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'form-message ' + kind;
  messageEl.hidden = false;
}

// 初期値：注文日＝今日、出荷予定日＝翌営業日（土日祝日を除く。WBS 1-3）
export function resetOrderForm() {
  form.reset();
  const today = todayString();
  form.orderDate.value = today;
  form.plannedShipDate.value = nextBusinessDay(today);

  // 祝日の一覧に入っていない年なら、毎年の追記を忘れていることを知らせる
  const hint = document.getElementById('ship-date-hint');
  const year = Number(form.plannedShipDate.value.slice(0, 4));
  if (HOLIDAY_YEARS.includes(year)) {
    hint.textContent = '初期値は翌営業日（土日祝日を除く）。手で変えられます';
    hint.classList.remove('warn');
  } else {
    hint.textContent = `祝日の一覧に${year}年がありません（土日だけ除いています）。js/holidays.js に${year}年の祝日を足してください`;
    hint.classList.add('warn');
  }
  form.querySelectorAll('.field.invalid').forEach((el) => el.classList.remove('invalid'));
}

// 入力を読み取ってチェックする。問題がなければ注文データ、あれば null を返す
function readForm() {
  const data = {
    orderDate: form.orderDate.value,
    customerType: form.customerType.value,
    customerName: form.customerName.value.trim(),
    quantity: Number(form.quantity.value),
    unitPrice: Number(form.unitPrice.value),
    plannedShipDate: form.plannedShipDate.value,
    shippingMethod: form.shippingMethod.value,
    orderChannel: form.orderChannel.value,
    note: form.note.value.trim(),
  };

  const bad = [];
  ['orderDate', 'customerType', 'customerName', 'plannedShipDate', 'shippingMethod', 'orderChannel']
    .forEach((key) => { if (!data[key]) bad.push(key); });
  if (form.quantity.value === '' || !Number.isInteger(data.quantity) || data.quantity < 1) bad.push('quantity');
  if (form.unitPrice.value === '' || !Number.isInteger(data.unitPrice) || data.unitPrice < 0) bad.push('unitPrice');
  bad.sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b));

  // 赤くする欄を付け直す
  form.querySelectorAll('.field').forEach((el) => el.classList.remove('invalid'));
  bad.forEach((key) => {
    const input = form.elements[key];
    const el = (input instanceof RadioNodeList ? input[0] : input).closest('.field');
    el.classList.add('invalid');
  });

  if (bad.length > 0) {
    const extra = [];
    if (bad.includes('quantity')) extra.push('数量は1以上の整数');
    if (bad.includes('unitPrice')) extra.push('単価は0以上の整数');
    showMessage(
      '次の項目を確かめてください：' + bad.map((k) => LABELS[k]).join('、')
        + (extra.length ? '（' + extra.join('、') + '）' : ''),
      'error',
    );
    return null;
  }
  return data;
}

// onSubmit(data) には、チェックを通った注文データが渡される
export function initOrderForm(onSubmit) {
  resetOrderForm();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data) return;
    await onSubmit(data, { showMessage, resetOrderForm });
  });
}
