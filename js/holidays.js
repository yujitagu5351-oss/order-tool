// 祝日の一覧と、翌営業日（土日祝日を除く）の計算（WBS 1-3）
// 出典：内閣府「国民の祝日について」の syukujitsu.csv（2026〜2027年分）
// 毎年、翌年分を内閣府の一覧から足す（振替休日・国民の休日も入れる）
const HOLIDAYS = {
  // 2026年
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-22': '休日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日',
  // 2027年
  '2027-01-01': '元日',
  '2027-01-11': '成人の日',
  '2027-02-11': '建国記念の日',
  '2027-02-23': '天皇誕生日',
  '2027-03-21': '春分の日',
  '2027-03-22': '休日',
  '2027-04-29': '昭和の日',
  '2027-05-03': '憲法記念日',
  '2027-05-04': 'みどりの日',
  '2027-05-05': 'こどもの日',
  '2027-07-19': '海の日',
  '2027-08-11': '山の日',
  '2027-09-20': '敬老の日',
  '2027-09-23': '秋分の日',
  '2027-10-11': 'スポーツの日',
  '2027-11-03': '文化の日',
  '2027-11-23': '勤労感謝の日',
};

// 一覧に入っている年
export const HOLIDAY_YEARS = [2026, 2027];

function toDateString(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromDateString(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isBusinessDay(dateString) {
  const day = fromDateString(dateString).getDay(); // 0＝日曜、6＝土曜
  return day !== 0 && day !== 6 && !(dateString in HOLIDAYS);
}

// dateString（"YYYY-MM-DD"）の次の営業日を "YYYY-MM-DD" で返す
export function nextBusinessDay(dateString) {
  const d = fromDateString(dateString);
  do {
    d.setDate(d.getDate() + 1);
  } while (!isBusinessDay(toDateString(d)));
  return toDateString(d);
}
