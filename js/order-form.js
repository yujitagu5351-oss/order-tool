// 注文の入力画面（WBS 1-1）：初期値を入れ、「登録」で入力をチェックして、1件分の注文データにまとめる
// Firestore への保存は orders.js（WBS 1-2）
// 同じ画面を、台帳から選んだ注文を直す・消すときにも使う（WBS 8。「直す」の形）
import { HOLIDAY_YEARS, nextBusinessDay } from './holidays.js';
import { getSettings, onSettingsChange } from './settings.js';
import { formatOrderNo } from './orders.js';

// 今日の日付を "YYYY-MM-DD" で返す（端末の時刻＝日本時間で数える）
export function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const form = document.getElementById('order-form');
const messageEl = document.getElementById('order-form-message');
const titleEl = document.getElementById('order-title');
const submitButton = form.querySelector('button[type="submit"]');
const cancelButton = document.getElementById('order-cancel-edit');
const deleteButton = document.getElementById('order-delete');

let editing = null; // 直している注文（登録の形のときは null）

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

// 単価の初期値（設定の画面で決めた金額。WBS 5-1）を入れる
function fillDefaultUnitPrice() {
  const s = getSettings();
  form.unitPrice.value = s ? s.defaultUnitPrice : '';
}

// 設定が読み込まれたら、単価がまだ空のときだけ初期値を入れる（入力中の値は消さない）
onSettingsChange(() => {
  if (!editing && form.unitPrice.value === '') fillDefaultUnitPrice();
});

// ボタンの文字と押せる・押せないを、形（登録／直す）と保存中かどうかに合わせる
function setBusy(busy) {
  submitButton.disabled = busy;
  deleteButton.disabled = busy;
  cancelButton.disabled = busy;
  if (editing) {
    submitButton.textContent = busy ? '保存しています…' : '直して保存';
  } else {
    submitButton.textContent = busy ? '登録しています…' : '登録';
  }
}

// 台帳で選んだ注文を、直す形で入力欄に入れる（WBS 8-1）
export function startEdit(order) {
  editing = order;
  form.querySelectorAll('.field.invalid').forEach((el) => el.classList.remove('invalid'));
  form.orderDate.value = order.orderDate;
  form.querySelectorAll('input[name="customerType"]').forEach((r) => { r.checked = r.value === order.customerType; });
  form.customerName.value = order.customerName;
  form.quantity.value = order.quantity;
  form.unitPrice.value = order.unitPrice;
  form.plannedShipDate.value = order.plannedShipDate;
  form.shippingMethod.value = order.shippingMethod;
  form.orderChannel.value = order.orderChannel;
  form.note.value = order.note || '';
  titleEl.textContent = `注文 ${formatOrderNo(order.orderNo)} を直す`
    + (order.shippedDate ? '（出荷済み）' : '');
  cancelButton.hidden = false;
  deleteButton.hidden = false;
  messageEl.hidden = true;
  setBusy(false);
  window.scrollTo(0, 0);
}

export function isEditing() {
  return editing !== null;
}

// 直す形をやめて、登録の形に戻す
export function endEdit() {
  editing = null;
  titleEl.textContent = '注文の登録';
  cancelButton.hidden = true;
  deleteButton.hidden = true;
  setBusy(false);
  resetOrderForm();
}

// 初期値：注文日＝今日、出荷予定日＝翌営業日（土日祝日を除く。WBS 1-3）、単価＝設定の初期値
export function resetOrderForm() {
  form.reset();
  const today = todayString();
  form.orderDate.value = today;
  form.plannedShipDate.value = nextBusinessDay(today);
  fillDefaultUnitPrice();

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

// onSubmit(data, ui) には、チェックを通った注文データが渡される。ui.editing は直している注文（登録なら null）
// onDelete(order, ui) は、直す形で「この注文を消す」を押したときに呼ばれる
export function initOrderForm(onSubmit, onDelete) {
  resetOrderForm();
  const ui = () => ({ showMessage, resetOrderForm, endEdit, setBusy, editing });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data) return;
    await onSubmit(data, ui());
  });
  cancelButton.addEventListener('click', () => {
    endEdit();
    location.hash = '#ledger';
  });
  deleteButton.addEventListener('click', () => {
    if (editing) onDelete(editing, ui());
  });
}
