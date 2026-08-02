// ============================================================================
// 经济引擎：营收 / 成本 / 固定支出 / 声望 / 破产线（总纲 §3）
// ============================================================================

export const FIXED_WAGE = 30;   // 小二工钱 文/天
export const FIXED_RENT = 20;   // 铺面租金 文/天
export const BANKRUPT_DAYS = 3; // 连续负净利天数

// 一日结算
export function settleDay({ cash, revenue, foodCost, tips = 0, reputation }) {
  const gross = revenue + tips;
  const net = gross - foodCost - FIXED_WAGE - FIXED_RENT;
  return { gross, foodCost, wage: FIXED_WAGE, rent: FIXED_RENT, net, cash: cash + net };
}

// 破产判定：连续 N 日净利为负且现银 < 固定支出
export function checkBankrupt(dayNetHistory, cash) {
  if (cash >= FIXED_WAGE + FIXED_RENT) return false;
  const last = dayNetHistory.slice(-BANKRUPT_DAYS);
  if (last.length < BANKRUPT_DAYS) return false;
  return last.every(n => n < 0);
}

// 声望 → 次日上座率权重（0-100）
export function repToTraffic(reputation) {
  return 1 + reputation / 200; // 0 声望 = 1.0，100 声望 = 1.5
}

// 好感度（对熟客）：按当日互动累积，存档用简单对象
export function mergeFavor(favors, guestId, delta) {
  return { ...favors, [guestId]: Math.max(0, Math.min(100, (favors[guestId] || 0) + delta)) };
}
