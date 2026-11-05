// 台帳（Firestore の orders コレクション）への読み書き
import { db } from './firebase.js';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// 注文番号は数値で保存し、画面や出荷指示書では4桁（0001）で見せる
export function formatOrderNo(n) {
  return String(n).padStart(4, '0');
}

// 注文を1件、台帳に追加する（WBS 1-2）。付けた注文番号（数値）を返す。
// meta/counter の lastOrderNo を1つ進めることと、注文の追加を1つのトランザクションで行うので、
// PCとスマホで同時に登録しても番号は重ならない
export async function addOrder(data) {
  const counterRef = doc(db, 'meta', 'counter');
  const orderRef = doc(collection(db, 'orders'));

  return runTransaction(db, async (tx) => {
    const counter = await tx.get(counterRef);
    const orderNo = (counter.exists() ? counter.data().lastOrderNo : 0) + 1;

    tx.set(counterRef, { lastOrderNo: orderNo });
    tx.set(orderRef, {
      ...data,
      orderNo,
      shippedDate: null, // 出荷済みにしたとき（機能3）に日付が入る
      createdAt: serverTimestamp(),
    });
    return orderNo;
  });
}
