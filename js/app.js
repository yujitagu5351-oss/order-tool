import { isConfigured, app, auth, db } from './firebase.js';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { initOrderForm } from './order-form.js';

// 注文の入力画面。保存（注文番号を付けて台帳に入れる）は WBS 1-2 でつくる。
// それまでは、入力チェックを通った内容を確かめのために表示するだけ
initOrderForm((data, ui) => {
  ui.showMessage(
    '入力はOKです（まだ保存はしません。保存はステップ6でつくります）：'
      + `${data.customerName}／${data.quantity}袋／出荷予定日 ${data.plannedShipDate}／${data.shippingMethod}`,
    'done',
  );
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
      setAuthState('signed-out');
      setStatus('Firebase：接続しています（' + app.options.projectId + '）。ログインしていません');
      return;
    }
    showAccount(user);
    setAuthState('checking');
    const result = await canUseLedger();
    if (result.ok) {
      setAuthState('ok');
      setStatus('Firebase：接続しています（' + app.options.projectId + '）。台帳を使えます');
    } else {
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
