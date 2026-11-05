// 注文の入力画面（WBS 1-1）：初期値を入れ、「登録」で入力をチェックして、1件分の注文データにまとめる
// Firestore への保存は WBS 1-2 で orders.js につくる

// 今日の日付を "YYYY-MM-DD" で返す（端末の時刻＝日本時間で数える）
export function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const form = document.getElementById('order-form');
const messageEl = document.getElementById('order-form-message');

// 入力欄の名前と、エラーのときに出す項目名
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

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'form-message ' + kind;
  messageEl.hidden = false;
}

// 初期値：注文日＝今日。出荷予定日の初期値（翌営業日）は WBS 1-3 で入れる
export function resetOrderForm() {
  form.reset();
  form.orderDate.value = todayString();
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
