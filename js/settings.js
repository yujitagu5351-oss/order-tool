// 固定額の設定（WBS 5-1）：単価の初期値、作業代（1袋あたり）、送料（送り方ごと）
// Firestore の meta/settings に1件だけ持つ。注文を登録するときに、その時点の作業代と送料を注文に記録する
// （あとで金額を変えても、登録済みの注文の金額は変わらない）
import { db } from './firebase.js';
import { doc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const SHIPPING_METHODS = ['ゆうパック', '宅急便', '小型便', '直接お届け'];

const settingsRef = doc(db, 'meta', 'settings');
const form = document.getElementById('settings-form');
const messageEl = document.getElementById('settings-message');

let current = null; // まだ一度も保存していなければ null
let stopWatching = null;
const listeners = [];

export function getSettings() {
  return current;
}

// 設定が読み込まれたり変わったりしたときに呼んでほしい関数を登録する
export function onSettingsChange(fn) {
  listeners.push(fn);
}

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'form-message ' + kind;
  messageEl.hidden = false;
}

function fillForm(s) {
  form.defaultUnitPrice.value = s ? s.defaultUnitPrice : '';
  form.workFeePerBag.value = s ? s.workFeePerBag : '';
  SHIPPING_METHODS.forEach((m) => {
    form.elements['ship-' + m].value = s ? s.shippingFees[m] : '';
  });
}

// 入力欄の値を「0以上の整数」として読む。だめなら null
function readInt(input) {
  const v = Number(input.value);
  return input.value !== '' && Number.isInteger(v) && v >= 0 ? v : null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputs = [form.defaultUnitPrice, form.workFeePerBag, ...SHIPPING_METHODS.map((m) => form.elements['ship-' + m])];
  const values = inputs.map(readInt);
  inputs.forEach((input, i) => input.closest('.field').classList.toggle('invalid', values[i] === null));
  if (values.includes(null)) {
    showMessage('赤い欄を、0以上の整数（円）で入れてください', 'error');
    return;
  }
  const [defaultUnitPrice, workFeePerBag, ...fees] = values;
  const shippingFees = Object.fromEntries(SHIPPING_METHODS.map((m, i) => [m, fees[i]]));

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await setDoc(settingsRef, { defaultUnitPrice, workFeePerBag, shippingFees });
    showMessage('保存しました。これから登録する注文に使います（登録済みの注文の金額は変わりません）', 'done');
  } catch (err) {
    showMessage('保存できませんでした（' + (err.code || err.message) + '）', 'error');
  } finally {
    button.disabled = false;
  }
});

export function startSettings() {
  if (stopWatching) return;
  stopWatching = onSnapshot(settingsRef, (snap) => {
    current = snap.exists() ? snap.data() : null;
    fillForm(current);
    if (!current) showMessage('まだ金額が決まっていません。入れて「保存」を押してください', 'error');
    listeners.forEach((fn) => fn(current));
  });
}

export function stopSettings() {
  if (stopWatching) stopWatching();
  stopWatching = null;
  current = null;
  fillForm(null);
}
