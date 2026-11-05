// 台帳（Firestore の orders コレクション）への読み書き
import { db } from './firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// 台帳の全注文を1回だけ読む（CSVの書き出し用。WBS 4-1）
export async function fetchAllOrders() {
  const snap = await getDocs(collection(db, 'orders'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 注文を直す（WBS 8-1）。注文番号・出荷日・登録日時はそのまま。
// 作業代（1袋あたり）は登録時の金額を残す。送り方を変えたときだけ、送料を今の設定の金額に入れ直す
export function updateOrder(before, input, settings) {
  const changes = { ...input, updatedAt: serverTimestamp() };
  if (input.shippingMethod !== before.shippingMethod) {
    changes.shippingFee = settings ? settings.shippingFees[input.shippingMethod] : null;
  }
  return updateDoc(doc(db, 'orders', before.id), changes);
}

// 注文を消す（WBS 8-2）。注文番号は詰めない（消した番号は欠番になる）
export function deleteOrder(orderId) {
  return deleteDoc(doc(db, 'orders', orderId));
}

// 出荷済みにする（WBS 3-1）：注文の出荷日に shippedDate（"YYYY-MM-DD"、ふつうは今日）を入れる
export function markShipped(orderId, shippedDate) {
  return updateDoc(doc(db, 'orders', orderId), { shippedDate });
}

// 出荷済みを元に戻す（WBS 3-2）：出荷日を空に戻す
export function unmarkShipped(orderId) {
  return updateDoc(doc(db, 'orders', orderId), { shippedDate: null });
}

// 出荷予定日が shipDate（"YYYY-MM-DD"）の注文を、注文番号の古い順で見張る（WBS 2-1）。
// 並べ替えは画面側で行う（where と orderBy を別の項目で組み合わせると、Firestore に複合インデックスが要るため）
export function watchOrdersByShipDate(shipDate, onChange, onError) {
  const q = query(collection(db, 'orders'), where('plannedShipDate', '==', shipDate));
  return onSnapshot(
    q,
    (snap) => onChange(
      snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.orderNo - b.orderNo),
    ),
    onError,
  );
}

// 台帳の全注文を、注文番号の新しい順で見張る（WBS 1-4）。
// 登録や変更があるたびに onChange(注文の配列) が呼ばれる。PCで登録すればスマホの台帳もすぐ変わる。
// 戻り値の関数を呼ぶと見張りをやめる
export function watchOrders(onChange, onError) {
  const q = query(collection(db, 'orders'), orderBy('orderNo', 'desc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

// 注文番号は数値で保存し、画面や出荷指示書では4桁（0001）で見せる
export function formatOrderNo(n) {
  return String(n).padStart(4, '0');
}

// 注文を1件、台帳に追加する（WBS 1-2）。付けた注文番号（数値）を返す。
// meta/counter の lastOrderNo を1つ進めることと、注文の追加を1つのトランザクションで行うので、
// PCとスマホで同時に登録しても番号は重ならない。
// settings（固定額の設定）があれば、その時点の作業代（1袋あたり）と送料を注文に記録する（WBS 5-1）。
// 設定がまだなければ null を入れ、CSV では書き出す時点の設定で計算する
export async function addOrder(input, settings) {
  const data = {
    ...input,
    workFeePerBag: settings ? settings.workFeePerBag : null,
    shippingFee: settings ? settings.shippingFees[input.shippingMethod] : null,
  };
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
