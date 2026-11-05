import { isConfigured, app, auth, db } from './firebase.js';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { initOrderForm, isEditing, endEdit } from './order-form.js';
import { addOrder, updateOrder, deleteOrder, formatOrderNo } from './orders.js';
import { startLedger, stopLedger, showLedgerFlash } from './ledger.js';
import { startSheet, stopSheet } from './sheet.js';
import { startSettings, stopSettings, getSettings } from './settings.js';
import './export.js'; // 書き出しの画面（ボタンを押したときだけ台帳を読むので、開始・停止は要らない）

// 注文の入力画面：「登録」で注文番号を付けて台帳に入れる（WBS 1-2）。
// 台帳の「直す」から来たときは、その注文を直して保存する（WBS 8-1）
function errorReason(e) {
  return e.code === 'permission-denied'
    ? '台帳に書き込む権限がありません。運営者のアカウントでログインし直してください'
    : '電波やWi-Fiを確かめて、もう一度押してください';
}

initOrderForm(async (data, ui) => {
  ui.setBusy(true); // 2回押して二重に登録しないように
  try {
    if (ui.editing) {
      await updateOrder(ui.editing, data, getSettings());
      const no = formatOrderNo(ui.editing.orderNo);
      ui.endEdit();
      showLedgerFlash(`注文 ${no} を直しました`);
      location.hash = '#ledger';
    } else {
      const orderNo = await addOrder(data, getSettings());
      ui.resetOrderForm();
      ui.showMessage(
        `注文番号 ${formatOrderNo(orderNo)} で登録しました：`
          + `${data.customerName}／${data.quantity}袋／出荷予定日 ${data.plannedShipDate}／${data.shippingMethod}`,
        'done',
      );
    }
  } catch (e) {
    ui.showMessage((ui.editing ? '保存' : '登録') + 'できませんでした。' + errorReason(e) + '（' + (e.code || e.message) + '）', 'error');
  } finally {
    ui.setBusy(false);
  }
}, async (order, ui) => {
  // 注文を消す（WBS 8-2）。消すと元に戻せないので、確かめてから
  const no = formatOrderNo(order.orderNo);
  if (!confirm(`注文 ${no}（${order.customerName}／${order.quantity}袋）を消します。元に戻せません。よいですか？`)) return;
  ui.setBusy(true);
  try {
    await deleteOrder(order.id);
    ui.endEdit();
    showLedgerFlash(`注文 ${no} を消しました（番号 ${no} は欠番になります）`);
    location.hash = '#ledger';
  } catch (e) {
    ui.showMessage('消せませんでした。' + errorReason(e) + '（' + (e.code || e.message) + '）', 'error');
    ui.setBusy(false);
  }
});

const statusEl = document.getElementById('firebase-status');

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('warn', warn);
}

// 表示の切り替え：checking／signed-out／denied／ok（CSS が body の data-auth を見て出し分ける）
function setAuthState(state) {
  document.body.dataset.auth = state;
}

function showAccount(user) {
  document.querySelectorAll('.account-email').forEach((el) => { el.textContent = user.email; });
  document.querySelectorAll('.account-uid').forEach((el) => { el.textContent = user.uid; });
}

// ---- ログイン ----

const LOGIN_ERRORS = {
  'auth/unauthorized-domain': 'このURLからのログインが許可されていません（Firebase の承認済みドメインを確認してください）。',
  'auth/operation-not-allowed': 'Google ログインが有効になっていません（Firebase の Authentication を確認してください）。',
  'auth/network-request-failed': 'ネットワークにつながりません。電波やWi-Fiを確かめてください。',
};

async function login() {
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' }); // 毎回アカウントを選べるようにする
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/popup-blocked') {
      // ポップアップが開けない端末では、ページごと移動してログインする
      await signInWithRedirect(auth, provider);
      return;
    }
    errorEl.textContent = LOGIN_ERRORS[e.code] || 'ログインできませんでした（' + e.code + '）';
    errorEl.hidden = false;
  }
}

// ログインしたアカウントが台帳を読めるかを、Firestore に1回問い合わせて確かめる。
// 読めるかどうかは Firestore のルール（firestore.rules）が決める
async function canUseLedger() {
  try {
    await getDoc(doc(db, 'meta', 'counter'));
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code };
  }
}

function startAuth() {
  document.getElementById('login-button').addEventListener('click', login);
  document.querySelectorAll('.logout-button').forEach((b) => {
    b.addEventListener('click', () => signOut(auth));
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (isEditing()) endEdit();
      stopLedger();
      stopSheet();
      stopSettings();
      setAuthState('signed-out');
      setStatus('Firebase：接続しています（' + app.options.projectId + '）。ログインしていません');
      return;
    }
    showAccount(user);
    setAuthState('checking');
    const result = await canUseLedger();
    if (result.ok) {
      setAuthState('ok');
      startLedger();
      startSheet();
      startSettings();
      setStatus('Firebase：接続しています（' + app.options.projectId + '）。台帳を使えます');
    } else {
      stopLedger();
      stopSheet();
      stopSettings();
      setAuthState('denied');
      setStatus('Firebase：台帳を読めません（' + result.code + '）', true);
    }
  });
}

if (isConfigured) {
  startAuth();
} else {
  setAuthState('signed-out');
  document.getElementById('login-button').disabled = true;
  setStatus('Firebase：js/config.js に設定値を貼ってください', true);
}

// ---- 画面の切り替え：URL の # （#order / #ledger / #sheet）で表示する画面を決める ----

const VIEWS = ['order', 'ledger', 'sheet', 'export', 'settings'];
const DEFAULT_VIEW = 'order';

function showView() {
  const name = location.hash.slice(1);
  const view = VIEWS.includes(name) ? name : DEFAULT_VIEW;

  // 注文を直している途中でほかの画面へ移ったら、直すのをやめて登録の形に戻す
  if (view !== 'order' && isEditing()) endEdit();

  VIEWS.forEach((v) => {
    document.getElementById('view-' + v).classList.toggle('active', v === view);
  });
  document.querySelectorAll('.menu a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });
}

window.addEventListener('hashchange', showView);
showView();
