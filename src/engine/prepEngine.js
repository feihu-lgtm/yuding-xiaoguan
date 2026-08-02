// ============================================================================
// 备菜引擎（总纲 §5）：清晨押注 → 今日可售份数；腐坏/缺货模型
// ============================================================================

import { RECIPES, recipeCost } from "./data.js";

// 押注：prep = { [菜名]: 份数 }；库存 inventory = { [食材]: 数量 }
// 返回 { ok, missing, prep, inventory } —— missing 为缺少的食材
export function makePrep(inventory, prep) {
  const inv = { ...inventory };
  const missing = {};
  for (const [dishName, count] of Object.entries(prep)) {
    const recipe = RECIPES.find(r => r.name === dishName);
    if (!recipe || count <= 0) continue;
    for (let i = 0; i < count; i++) {
      const need = {};
      for (const m of recipe.materials) need[m] = (need[m] || 0) + 1;
      let can = true;
      for (const [m, n] of Object.entries(need)) {
        if ((inv[m] || 0) < n) { can = false; missing[dishName] = missing[dishName] || []; missing[dishName].push(m); break; }
      }
      if (!can) break;
      for (const [m, n] of Object.entries(need)) inv[m] -= n;
      prep[dishName] = prep[dishName] || 0;
    }
  }
  return { ok: Object.keys(missing).length === 0, missing, prep, inventory: inv };
}

// 隔夜：份数腐坏（无冰窖 → 直接损耗；有冰窖 → 品质 -50%）
// 返回隔夜后剩余的"次日可卖份数"（品质降低版）
export function overnight(remaining, hasIceCellar = false) {
  const next = {};
  for (const [dish, count] of Object.entries(remaining)) {
    if (hasIceCellar) next[dish] = Math.round(count * 0.5);
    // 无冰窖：直接归零（损耗）
  }
  return next;
}

// 菜谱成本（一次备菜的消耗清单）
export function prepCost(dishName, count) {
  const recipe = RECIPES.find(r => r.name === dishName);
  if (!recipe) return 0;
  return recipeCost(recipe) * count;
}
