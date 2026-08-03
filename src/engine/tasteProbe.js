// ============================================================================
// 扒口味推理引擎：手动派餐试菜 → 好评/中评/差评 → 候选/排除池 → 正交收敛
// 一道菜 = 属性集 { taste:味型大类, tech:技法, food:食材×N }
// 好评 → 全属性候选 +1（其中必有 TA 喜欢的）；差评 → 全属性排除
// 某类别（味型/技法/食材）只剩一个未排除候选 → 确定 TA 的偏好
// ============================================================================

export function initKnown() {
  return { hits: {}, miss: {} };
}

// 一道菜 → 属性键列表
export function dishAttrs(dish) {
  const attrs = [`taste:${dish.tasteCat}`, `tech:${dish.technique}`];
  for (const m of dish.materials || []) attrs.push(`food:${m}`);
  return attrs;
}

// 试菜结算后更新推理
export function probeUpdate(known, dish, verdict) {
  const attrs = dishAttrs(dish);
  for (const a of attrs) {
    if (verdict === "好评") known.hits[a] = (known.hits[a] || 0) + 1;
    else if (verdict === "差评") known.miss[a] = (known.miss[a] || 0) + 1;
    // 中评：信息量弱，只记一票"不像"（miss+0.5 不进排除，只降候选热度）
  }
  return known;
}

const KIND = {
  "taste:": "味型", "tech:": "技法", "food:": "食材",
};
const kindOf = a => a.split(":")[0] + ":";

// 收敛：某类别只剩一个"未排除且被命中过"的候选 → 确定
export function confirmedTastes(known) {
  const confirmed = [];
  const byKind = { "taste:": [], "tech:": [], "food:": [] };
  for (const [a, n] of Object.entries(known.hits)) {
    if ((known.miss[a] || 0) > 0) continue; // 被排除过
    byKind[kindOf(a)].push(a);
  }
  for (const [kind, list] of Object.entries(byKind)) {
    if (list.length === 1) confirmed.push(list[0]);
  }
  return confirmed;
}

// 候选池（hits>0 未排除）
export function candidateAttrs(known) {
  return Object.entries(known.hits)
    .filter(([a, n]) => n > 0 && (known.miss[a] || 0) === 0)
    .sort((a, b) => b[1] - a[1]);
}

// 排除池
export function excludedAttrs(known) {
  return Object.entries(known.miss).filter(([, n]) => n > 0).map(([a]) => a);
}

const nameOf = a => a.split(":")[1];

// 客人卡上的口味档案文本（玩家视角）
export function knownSummary(known) {
  const conf = confirmedTastes(known).map(a => `${KIND[kindOf(a)]}·${nameOf(a)}`);
  const cand = candidateAttrs(known).map(([a, n]) => `${KIND[kindOf(a)]}·${nameOf(a)}(${n}票)`);
  const excl = excludedAttrs(known).map(a => nameOf(a));
  return { confirmed: conf, candidate: cand, excluded: excl };
}

// 正交试探提示：上次好评的菜属性里藏着 TA 喜欢的，换掉部分属性再试
export function probeHint(lastDish, verdict) {
  if (!lastDish) return "";
  if (verdict === "好评") {
    return `这菜里有 TA 喜欢的——${["味型", "技法", "食材"].join("、")}各留一个，其他换掉再试。`;
  }
  if (verdict === "差评") {
    return `这菜的属性全被排除——换一道完全不沾边的试试。`;
  }
  return "中评，说不准——换掉一半属性再试。";
}
