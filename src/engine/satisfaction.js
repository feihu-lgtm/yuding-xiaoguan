// ============================================================================
// 满意度裁决（纯函数，零 AI）—— 总纲 §4.2 公式落地
// ============================================================================

// dish: { name, taste(大类), tier, quality(0-10), price }
// guest: { taste(大类), likes[], pay, patience }
// waitTicks: 等待 tick 数
export function calcSatisfaction(guest, dish, waitTicks, { outOfStock = false, served = true } = {}) {
  if (!served || !dish) {
    return { score: 0, verdict: "差评", reason: "没吃上" };
  }
  let score = 60;
  const reasons = [];

  const likeHit = guest.likes.some(l => dish.materials?.includes(l) || l === dish.name);
  if (likeHit) { score += 25; reasons.push("兴趣命中+25"); }
  else if (guest.likes.some(l => l === (dish.interest || ""))) { score += 25; reasons.push("兴趣命中+25"); }

  const tasteMatch = guest.taste === dish.tasteCat;
  if (tasteMatch) { score += 15; reasons.push("口味契合+15"); }

  score += dish.quality ?? 5; reasons.push(`品质+${dish.quality ?? 5}`);

  const waitPenalty = Math.min(40, Math.max(0, waitTicks - guest.patience) * 8);
  if (waitPenalty > 0) { score -= waitPenalty; reasons.push(`等待-${waitPenalty}`); }

  if (outOfStock) { score -= 30; reasons.push("缺货-30"); }

  const overpay = Math.max(0, (dish.price ?? 0) - guest.pay);
  const pricePenalty = Math.min(25, Math.round(overpay * 0.35));
  if (pricePenalty > 0) { score -= pricePenalty; reasons.push(`性价比-${pricePenalty}`); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = score >= 80 ? "好评" : score >= 50 ? "平" : "差评";
  return { score, verdict, reasons };
}

// 档位 → 经营产出
export function verdictEffects(verdict, guest) {
  if (verdict === "好评") return { favor: 2, rep: 1, tipChance: 0.3, rumorSeed: true };
  if (verdict === "平") return { favor: 0, rep: 0, tipChance: 0.05, rumorSeed: false };
  return { favor: -1, rep: -1, tipChance: 0, rumorSeed: true }; // 差评也产流言种子
}
