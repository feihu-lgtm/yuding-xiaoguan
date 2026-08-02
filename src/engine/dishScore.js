// ============================================================================
// 食物本体分（AI 制作时裁决）—— 用户定的四因子：
//   技法匹配名菜（四面体） + 食材稀有度（副本热区决定） + 厨艺/见识/创造力 + 特殊描述 bonus
// 加上食客三维偏好（口味/技法/食材）的匹配分 → 满意度
// ============================================================================

import { INGREDIENTS, RECIPES, TECHNIQUES } from "./data.js";

const RARITY_SCORE = { 白: 5, 绿: 12, 蓝: 20, 紫: 28, 橙: 35, 红: 42 };

// 技法匹配名菜：这道菜的（技法 × 主料）与 10 道名菜的重合度
// 技法同 → +8；技法同介质线 → +3；主料命中名菜主料 → +4/样（上限 8）
export function techniqueMatch(dish, recipes = RECIPES) {
  let score = 0;
  for (const r of recipes) {
    if (r.technique === dish.technique) {
      score += 8;
      const shared = (r.materials || []).filter(m => dish.materials?.includes(m)).length;
      score += Math.min(8, shared * 4);
    } else if (TECHNIQUES[r.technique]?.medium === TECHNIQUES[dish.technique]?.medium) {
      score += 3;
    }
  }
  return Math.min(15, score);
}

// 食物本体分（0-100）：稀有度 + 技法名菜 + 厨艺 + 创造 + bonus
// dish: { technique, materials[], freestyle?, desc }
// ctx: { cuisine(厨力), insight(见识), creativity(创造力), bonusText(特殊描述) }
export function dishScore(dish, ctx = {}) {
  const rarity = Math.max(0, ...(dish.materials || []).map(m => RARITY_SCORE[INGREDIENTS[m]?.tier] || 0));
  const tech = techniqueMatch(dish);
  const cuisine = Math.min(15, Math.round((ctx.cuisine || 2) * 1.5));       // 厨艺
  const insight = Math.min(8, Math.round((ctx.insight || 0) * 0.8));        // 见识（食材知识）
  const create = (dish.freestyle ? 8 : 0) + Math.min(4, Math.round((ctx.creativity || 0) * 0.6)); // 创造力
  const bonus = ctx.bonusText ? 8 : ctx.bonus ? Math.min(10, ctx.bonus) : 0; // 特殊描述 bonus
  return {
    total: Math.min(100, rarity + tech + cuisine + insight + create + bonus),
    rarity, tech, cuisine, insight, create, bonus,
  };
}

// 食客匹配分（0-30）：口味命中 10 + 技法偏好命中 10 + 食材偏好命中 10（按比例）
export function matchScore(guest, dish) {
  let taste = guest.taste === dish.tasteCat ? 10 : 0;
  let tech = guest.tech === dish.technique ? 10 : 0;
  const likes = guest.likes || [];
  const hits = likes.filter(l => l === dish.name || dish.materials?.includes(l)).length;
  let food = likes.length ? Math.round((hits / likes.length) * 10) : 5;
  return { taste, tech, food, total: taste + tech + food };
}

// 满意度 = 50 + 本体分×0.35 + 匹配分 − 等待 − 价格（封顶 100）
export function satisfactionFrom(dishScoreTotal, matchTotal, { waitTicks = 0, patience = 5, price = 0, pay = 100 } = {}) {
  let s = 50 + dishScoreTotal * 0.35 + matchTotal;
  s -= Math.max(0, waitTicks - patience) * 6;
  s -= Math.min(20, Math.max(0, price - pay) * 0.3);
  s = Math.max(0, Math.min(100, Math.round(s)));
  return s;
}
