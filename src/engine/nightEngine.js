// ============================================================================
// 夜晚引擎：4 格行动点 —— 副本 / 研发 / 练功（总纲 §11 + 切片 §三）
// ============================================================================

import { mulberry32, RECIPES, INGREDIENTS, TASTES } from "./data.js";

export const NIGHT_AP = 4;

// 五处副本（对应 qucuo 地图）：难度 = 胆识门槛
export const DUNGEONS = [
  { id: "digong",   name: "地宫",     place: "鱼定土司府下",   brav: 2, ap: 2,
    loot: ["银两", "锦官城干笋", "玉泉寨土豆"], events: "前人遗书，写了一半的家书" },
  { id: "gudi",     name: "谷底",     place: "熊山",           brav: 3, ap: 2,
    loot: ["熊山花椒", "熊山松茸", "熊山铁棍山药"], events: "黑熊拦路，咆哮震得谷底回声不绝" },
  { id: "haidi",    name: "海底密室", place: "贡措海",         brav: 4, ap: 2,
    loot: ["贡措海裂腹鱼", "贡措海盐", "雪山雪莲瓣"], events: "冰洞深处传来叩击声，似有活物" },
  { id: "shandong", name: "山洞",     place: "雪山派侧",       brav: 4, ap: 2,
    loot: ["雪山雪鸡肉", "雪山野蜂蜜", "雪山雪莲瓣"], events: "冻尸的包裹，封着一坛蜂蜜" },
  { id: "caoyuan",  name: "草原深处", place: "大草甸",         brav: 5, ap: 2,
    loot: ["大草甸黄羊腿", "大草甸孜然", "大草甸蘑菇", "牦牛腱子肉", "藏香猪五花"], events: "银灰独眼狼王蹲在草坡上，盯着你" },
];

// 副本判定（轻量）：胆识 + 食物加成 + 随机(0-2) vs 难度
// need：店里缺的食材清单（备菜缺口），本副本能掉的优先掉（§10 seed 因果）
export function runDungeon(dungeonId, brav, foodBonus = 0, seed, need = []) {
  const d = DUNGEONS.find(x => x.id === dungeonId);
  if (!d) return null;
  const rng = mulberry32(seed);
  const roll = brav + foodBonus + Math.floor(rng() * 3);
  const win = roll >= d.brav;
  return {
    win, roll, brav,
    loot: win ? pickLoot(d, rng, seed, need) : [],
    text: win
      ? `胆识${roll}对难度${d.brav}，胜了。${d.events}——此地的物事尽数归你。`
      : `胆识${roll}对难度${d.brav}，败了。带伤回店，次日客流减了一成。`,
  };
}

function pickLoot(d, rng, seed, need = []) {
  const items = [];
  const targeted = need.filter(it => d.loot.includes(it));
  const pool = [...d.loot.filter(x => x !== "银两")];
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    if (targeted.length) {
      items.push(targeted.splice(Math.floor(rng() * targeted.length), 1)[0]);
      pool.splice(pool.indexOf(items[items.length - 1]), 1);
    } else if (pool.length) {
      items.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    } else break;
  }
  if (d.loot.includes("银两") && rng() < 0.5) items.push("银两");
  return items;
}

// 采购（开罗式补给）：花 40 文买 5 件（2 调料 + 3 食材，1 行动点）
const MARKET_SEASONINGS = [
  "贡措海盐", "黑风寨苞谷醋", "大草甸孜然", "鱼定村野葱油", "天都镇酱油", "雅江菜籽油",
];
const MARKET_GOODS = [
  "玉泉寨土豆", "鱼定村青稞", "大草甸野韭",
  "大草甸蘑菇", "雅江嫩豆腐", "锦官城干笋",
  "牦牛腱子肉", "藏香猪五花", "大草甸黄羊腿", "贡措海裂腹鱼",
];
export function shopBuy(cash, seed) {
  const rng = mulberry32(seed);
  if (cash < 40) return { ok: false, reason: "银两不足（需 40 文）" };
  const pick = pool => {
    const i = Math.floor(rng() * pool.length);
    return pool.splice(i, 1)[0];
  };
  const items = [];
  const seas = [...MARKET_SEASONINGS];
  const goods = [...MARKET_GOODS];
  for (let i = 0; i < 2 && seas.length; i++) items.push(pick(seas));
  for (let i = 0; i < 3 && goods.length; i++) items.push(pick(goods));
  return { ok: true, items, cash: cash - 40 };
}

// ── 研发 ──────────────────────────────────────────────────────────────────
// 固定配方：食材齐 → 成功（学习过则改良品质 +1，上限 10）
// 妙手偶得：介质 × 火距 × 食材 → 数值裁决 + 味型从白名单抽（AGI 起名留接口）
export function developDish(inventory, dishName, techniqueId) {
  const recipe = RECIPES.find(r => r.name === dishName);
  if (!recipe) return { ok: false, reason: "没有这道菜的配方" };
  if (recipe.technique !== techniqueId) return { ok: false, reason: "技法不对" };
  const need = {};
  for (const m of recipe.materials) need[m] = (need[m] || 0) + 1;
  const missing = [];
  for (const [m, n] of Object.entries(need)) {
    if ((inventory[m] || 0) < n) missing.push(m);
  }
  if (missing.length) return { ok: false, reason: `缺食材：${missing.join("、")}` };
  const inv = { ...inventory };
  for (const [m, n] of Object.entries(need)) inv[m] -= n;
  return { ok: true, recipe, inventory: inv };
}

// 妙手偶得：返回 { ok, name(占位), taste, quality, inventory }
export function freestyleDish(inventory, materials, { cuisine = 5 } = {}) {
  // cuisine = 厨力；成功率 = 0.4 + 厨力×0.08
  const chance = 0.4 + cuisine * 0.08;
  const rng = mulberry32((Date.now() % 2147483647) | 1);
  const allOk = materials.every(m => (inventory[m] || 0) >= 1);
  if (!allOk) return { ok: false, reason: "材料不够" };
  const inv = { ...inventory };
  for (const m of materials) inv[m] -= 1;
  if (rng() > chance) {
    return { ok: true, success: false, reason: "火候失手，出了一盘焦黑", inventory: inv };
  }
  // 味型从白名单抽
  const cats = Object.keys(TASTES);
  const cat = cats[Math.floor(rng() * cats.length)];
  const taste = TASTES[cat][Math.floor(rng() * TASTES[cat].length)];
  const quality = 4 + Math.floor(rng() * 4); // 4-7
  return {
    ok: true, success: true, name: "妙手偶得·无名菜", taste, tasteCat: cat,
    quality, inventory: inv, // AGI 起名与描述：P3 接入
  };
}

// 练功：胆识 +1（每夜限一次），或收益递减
export function trainBrav(brav, nightIdx) {
  return brav + 1; // 切片：简单 +1
}
