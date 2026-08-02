// ============================================================================
// AI 敌人生成器：AI 生成名字/外貌/特性（叙事层），数值与 loot 系统裁决
// 铁律：AI 不碰数值——tier 由系统按胆识 roll，属性走公式，loot 走白名单池
// 降级：API 挂了/没配 → 静默落 DUNGEON_ENEMIES 白名单池
// ============================================================================

import { DUNGEON_ENEMIES, genEnemy } from "./battleEngine.js";
import { callAIJson, hasApi } from "./aiClient.js";
import { mulberry32 } from "./data.js";

const TIER_NAMES = { 1: "白", 2: "绿", 3: "蓝", 4: "紫", 5: "橙" };

// 系统裁决 + AI 皮肉合成（纯函数，可测）：AI 只给 name/desc/feature/line，
// tier 由胆识裁决、属性走公式、loot 走白名单池——AI 不碰任何数值
export function resolveEnemyAI(dungeonId, brav, seed, aiJson, fallback) {
  const rng = mulberry32(seed);
  const pool = DUNGEON_ENEMIES[dungeonId] || [];
  const maxTier = Math.min(5, brav);
  const reachable = pool.filter(e => e.tier <= maxTier);
  const top = reachable.length ? Math.max(...reachable.map(e => e.tier)) : 1;
  const isBoss = top > 2 && rng() < 0.2;
  const tier = isBoss ? top : 1 + Math.floor(rng() * maxTier);

  const name = String(aiJson?.name || "").trim().slice(0, 8);
  if (!name) return { ...fallback, from: "白名单" };

  const base = pool.find(e => e.tier === tier) || fallback;
  return {
    ...fallback,
    name,
    desc: String(aiJson?.desc || fallback.desc || "").slice(0, 80),
    feature: String(aiJson?.feature || "").slice(0, 40),
    line: String(aiJson?.line || "").slice(0, 40),
    tier,
    hp: fallback.maxHp, maxHp: fallback.maxHp,
    atk: fallback.atk, def: fallback.def,
    loot: base?.loot || fallback.loot,
    from: "AI",
  };
}

// 生成敌人：优先 AI（名字/外貌/特性/掉向），数值系统裁决；无 API 落白名单
// dungeon: DUNGEONS 里的副本对象；brav: 玩家胆识；need: 缺料清单（掉向偏好）
export async function genEnemyAI(dungeon, brav, seed, need = []) {
  const fallback = genEnemy(dungeon.id, brav, seed);
  if (!fallback) return null;
  if (!hasApi()) {
    return { ...fallback, from: "白名单" };
  }

  const system = `你是曲措乡武侠世界的说书人，为鱼定村小馆的夜晚副本生成一个拦路之敌。
只生成叙事层信息：名字、外貌描写、战斗特性、一句登场台词。
数值与掉落一律由系统裁决——你的输出里绝对不许出现数字（品阶、血量、攻击、掉落物品名）。
风格：白话古文，章回说书人口吻，3-5 句话，禁冒号破折号。`;
  const user = `副本：${dungeon.name}（${dungeon.place}）
地况：${dungeon.events || "幽深之地"}
敌人实力档：${TIER_NAMES[fallback.tier]}档（系统裁决，只作氛围参考）
${need.length ? `玩家店里正缺这些食材（敌人气质可与之呼应，但不要直接命名）：${need.slice(0, 3).join("、")}` : ""}

请输出 JSON：{"name":"敌人名(2-5字)","desc":"外貌与来头(2-3句)","feature":"战斗特性一句话(如：残血时狂暴/皮糙肉厚/身法鬼魅)","line":"登场台词一句"}`;

  try {
    const j = await callAIJson(system, user, { maxTokens: 800 });
    return resolveEnemyAI(dungeon.id, brav, seed, j, fallback);
  } catch {
    return { ...fallback, from: "白名单" }; // 静默降级
  }
}
