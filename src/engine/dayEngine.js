// ============================================================================
// 白天引擎：3 时段 × 8 tick 状态机（纯函数，零 AI）
// tick(state) → newState。React 层每秒调一次。
// ============================================================================

import { RECIPES, recipePrepTime } from "./data.js";
import { verdictEffects } from "./satisfaction.js";
import { dishScore, matchScore, satisfactionFrom } from "./dishScore.js";
import { probeUpdate, probeHint, confirmedTastes } from "./tasteProbe.js";

export const STOVE_COUNT = 1; // 灶台并行出餐数（开局）
export const TICK_SECONDS = 3; // 每 tick = 3 秒：白天 30 tick = 90 秒，与配餐时限 1:30 同节奏
export const TICKS_PER_SLOT = 10; // 每时段 tick 数（共 3 时段 = 90 秒）

// 白天已过总秒数（UI 显示 x s/90 s）
export function daySeconds(state) {
  return Math.round((state.slotIdx * TICKS_PER_SLOT + state.tick) * TICK_SECONDS);
}
export const SERVE_LIMIT_SECONDS = 90; // 配餐时限 1:30：客人等太久没人派餐会走

export function initDay(dayIdx, slots, prep, prices, { stove = STOVE_COUNT, recipesMap = null, cuisine = 2 } = {}) {
  return {
    dayIdx, slotIdx: 0, tick: 0, stove,
    slots, // [时段1[], 时段2[], 时段3[]] 客单
    queue: [...slots[0]],
    tables: Array.from({ length: 8 }, () => null),
    prep,   // { dishName: count } 剩余可售
    prices, // { dishName: price }
    cooking: [], // { table, remain }
    sales: [],
    log: [],
    reputationDelta: 0,
    cash: 0,
    done: false,
    recipesMap: recipesMap || buildRecipeMap(), // 固定配方 + 自定义菜
    cuisine,
  };
}

// 菜谱表：名字 → 菜谱（含自定义）
export function buildRecipeMap(customRecipes = []) {
  const map = {};
  for (const r of RECIPES) map[r.name] = r;
  for (const r of customRecipes || []) map[r.name] = r;
  return map;
}

function log(s, text) {
  s.log.push(`[D${s.dayIdx + 1}·时段${s.slotIdx + 1}·t${s.tick}] ${text}`);
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}

function recipeByName(state, name) {
  return state.recipesMap?.[name] || RECIPES.find(r => r.name === name);
}

// 点单：兴趣食材命中（菜名或材料含）> 随机（只选有份数的菜）
function chooseDish(guest, prep, recipesMap) {
  const available = Object.entries(prep).filter(([, c]) => c > 0).map(([n]) => n);
  if (!available.length) return null;
  const hit = available.filter(n => {
    const r = recipesMap?.[n] || RECIPES.find(x => x.name === n);
    const mats = r?.materials || [];
    return guest.likes.some(l => l === n || mats.includes(l));
  });
  if (hit.length) return hit[Math.floor(Math.random() * hit.length)];
  return available[Math.floor(Math.random() * available.length)];
}

// 单次 tick（不可变更新）
export function tick(state) {
  const s = {
    ...state,
    tables: [...state.tables],
    cooking: state.cooking.map(c => ({ ...c })),
    sales: [...state.sales],
    queue: [...state.queue],
  };

  // 1) 出餐推进
  for (let i = s.cooking.length - 1; i >= 0; i--) {
    s.cooking[i].remain -= 1;
    if (s.cooking[i].remain <= 0) {
      const { table } = s.cooking[i];
      s.cooking.splice(i, 1);
      const tb = s.tables[table];
      if (tb && tb.state === "烹饪") {
        s.tables[table] = { ...tb, state: "用餐", eatTicks: 1 };
        log(s, `${tb.guest.name} 的「${tb.dish}」上桌了`);
      }
    }
  }

  // 2) 待派餐/用餐推进
  for (let t = 0; t < s.tables.length; t++) {
    const tb = s.tables[t];
    if (!tb) continue;
    if (tb.state === "评价") {
      const vt = tb.verdictTicks - 1;
      if (vt <= 0) {
        s.tables[t] = null;
      } else {
        s.tables[t] = { ...tb, verdictTicks: vt };
      }
    } else if (tb.state === "waiting") {
      const wt = tb.waitTicks + 1;
      if (wt * TICK_SECONDS > SERVE_LIMIT_SECONDS) {
        // 配餐时限 1:30 内没人派餐，拂袖而去（不算差评，只流失）
        s.missed = (s.missed || 0) + 1;
        log(s, `${tb.guest.name} 等了一分半没人招呼，拂袖而去`);
        s.tables[t] = null;
        continue;
      }
      s.tables[t] = { ...tb, waitTicks: wt };
    } else if (tb.state === "用餐") {
      const remain = tb.eatTicks - 1;
      if (remain <= 0) {
        settle(s, t);
      } else {
        s.tables[t] = { ...tb, eatTicks: remain };
      }
    }
  }

  // 3) 空桌补客：入座即"waiting"——等玩家手动派餐（不知偏好，先试菜扒口味）
  for (let t = 0; t < s.tables.length; t++) {
    if (s.tables[t] || !s.queue.length) continue;
    const guest = s.queue.shift();
    s.tables[t] = { guest, state: "waiting", waitTicks: 0 };
    log(s, `${guest.name} 落座——等店主动手安排。`);
  }

  // 5) 时段推进（10 tick/时段；桌上客人跨时段继续，不清桌）
  s.tick += 1;
  if (s.tick >= TICKS_PER_SLOT) {
    const next = s.slotIdx + 1;
    if (next < 3) {
      s.slotIdx = next;
      s.tick = 0;
      s.queue = [...s.slots[next]];
      log(s, `—— 进入时段${next + 1}，座上客人继续 ——`);
    } else {
      s.done = true;
    }
  }
  return s;
}

function settle(s, tableIdx) {
  const tb = s.tables[tableIdx];
  const { guest, dish, waitTicks } = tb;
  const r = recipeByName(s, dish);
  const price = s.prices[dish] || 0;
  const dishInfo = { name: dish, tasteCat: tb.tasteCat, technique: r?.technique, materials: r?.materials || [] };
  // 食物本体分（稀有度+技法名菜+厨艺+创造+bonus）× 食客三维匹配（口味/技法/食材）
  const freestyle = !RECIPES.some(x => x.name === dish);
  const ds = dishScore(
    { technique: r?.technique, materials: r?.materials || [], freestyle },
    { cuisine: s.cuisine, bonusText: r?.from === "AI" ? r.desc : "" }
  );
  const ms = matchScore(guest, { tasteCat: tb.tasteCat, technique: r?.technique, materials: r?.materials || [], name: dish });
  const score = satisfactionFrom(ds.total, ms.total, { waitTicks: Math.round(waitTicks * TICK_SECONDS), patience: guest.patience, price, pay: guest.pay });
  const res = { score, verdict: score >= 80 ? "好评" : score >= 50 ? "中评" : "差评", reasons: [] };
  const eff = verdictEffects(res.verdict, guest);
  // 扒口味：把这道菜的结果喂进推理
  if (guest.known) probeUpdate(guest.known, dishInfo, res.verdict);
  res.hint = probeHint(dishInfo, res.verdict);
  const tip = res.verdict === "好评" && Math.random() < eff.tipChance ? Math.max(1, Math.round(price * 0.15)) : 0;
  s.sales.push({
    guest: guest.name, regular: guest.regular, dish, score: res.score, verdict: res.verdict,
    amount: price + tip, tip, hint: res.hint,
    confirmed: guest.known ? confirmedTastes(guest.known).map(a => a.split(":")[1]) : [],
  });
  s.cash += price + tip;
  s.reputationDelta += eff.rep;
  s.prep[dish] = (s.prep[dish] || 0) - 1;
  s.tables[tableIdx] = { ...tb, state: "评价", verdict: res.verdict, verdictTicks: 2 };
  log(s, `${guest.name} 吃毕「${dish}」${res.verdict}（${res.score}分）${tip ? `，赏${tip}文` : ""}`);
}

// ── 手动派餐：玩家给某桌客人上一道菜 ──
export function serveDish(state, tableIdx, dishName, price) {
  // 深拷贝 prep/log：StrictMode 下 updater 可能执行两次，必须纯函数
  const s = {
    ...state,
    tables: [...state.tables],
    cooking: state.cooking.map(c => ({ ...c })),
    prep: { ...state.prep },
    log: [...state.log],
  };
  const tb = s.tables[tableIdx];
  if (!tb || tb.state !== "waiting") return s;
  const r = recipeByName(s, dishName);
  if (!r || (s.prep[dishName] || 0) <= 0) return s;
  s.tables[tableIdx] = {
    ...tb,
    state: "烹饪",
    dish: dishName,
    prepTime: recipePrepTime(r),
    tasteCat: tasteCategoryOf(r),
    quality: qualityOf(r),
  };
  s.prep[dishName] = (s.prep[dishName] || 0) - 1;
  s.cooking.push({ table: tableIdx, dish: dishName, remain: recipePrepTime(r) });
  log(s, `你给${tb.guest.name}派了一道「${dishName}」。`);
  return s;
}

// 味型大类：菜品细分味型 → 6 大类
import { TASTES } from "./data.js";
export function tasteCategoryOf(recipe) {
  if (!recipe?.taste) return "鲜香";
  for (const [cat, list] of Object.entries(TASTES)) {
    if (list.includes(recipe.taste)) return cat;
  }
  return "鲜香";
}

// 品质档：家常 5 / 精致 7 / 宴席 9（满意度 +）
export function qualityOf(recipe) {
  return { 家常: 5, 精致: 7, 宴席: 9 }[recipe?.tier] ?? 5;
}
