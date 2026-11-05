// 使われ方の記録（WBS 7-1）：いつ、どの機能を、どの端末で使ったかを Firestore の usageLogs に1件ずつためる
// 記録に失敗しても、本来の作業（登録や出荷済みなど）は止めない
import { db } from './firebase.js';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const logs = collection(db, 'usageLogs');

function pad(n) {
  return String(n).padStart(2, '0');
}

// 指で操作する端末ならスマホ、マウスならPCとみなす
function deviceName() {
  return window.matchMedia('(pointer: coarse)').matches ? 'スマホ' : 'PC';
}

// feature：'登録'／'直す'／'消す'／'出荷済みにする'／'戻す'／'出荷指示書を印刷'／'書き出し'
// detail：注文番号や件数などの補足（なくてもよい）
export function logUsage(feature, detail = '') {
  const d = new Date();
  addDoc(logs, {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, // 期間で選ぶための日付（端末の日本時間）
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    feature,
    detail: String(detail),
    device: deviceName(),
    at: serverTimestamp(),
  }).catch((e) => console.warn('使われ方を記録できませんでした', e));
}

// 期間（"YYYY-MM-DD"〜"YYYY-MM-DD"）の記録を、古い順で返す
export async function fetchUsage(from, to) {
  const q = query(logs, where('date', '>=', from), where('date', '<=', to));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
