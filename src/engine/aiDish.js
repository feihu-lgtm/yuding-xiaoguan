// ============================================================================
// AGI 出餐裁决：命中固定配方直出；妙手偶得 → AI 起名定味（数值系统裁决）
// 铁律：AI 只给菜名与风味描述；味型/档次/品质/成本全走系统
// 降级：无 API → 规则名（介质×火距×主料）兜底
// ============================================================================

import { RECIPES, TASTES, INGREDIENTS, mulberry32 } from "./data.js";
import { callAIJson, hasApi } from "./aiClient.js";

// 味型裁决（系统）：从白名单抽，按主料产地倾向
const REGION_TASTE = {
  鱼定村: ["麻辣", "鲜香"], 大草甸: ["麻辣", "厚重"], 锦官城: ["鲜香", "酱香"],
  雅江: ["酸辣", "鲜香"], 天都镇: ["酱香", "五香"], 雪山: ["清淡", "甜"],
};

export function rollTaste(materials, rng) {
  const regions = materials.map(m => INGREDIENTS[m]?.region).filter(Boolean);
  const pool = [];
  for (const r of regions) pool.push(...(REGION_TASTE[r] || ["鲜香"]));
  const cat = pool.length ? pool[Math.floor(rng() * pool.length)] : "鲜香";
  const list = TASTES[cat] || ["咸鲜"];
  return { cat, taste: list[Math.floor(rng() * list.length)] };
}

// 妙手偶得数值裁决（系统）：品质随厨力；档次看材料档次（均价）
export function rollFreestyleValue(materials, cuisine = 2, seed) {
  const rng = mulberry32(seed);
  const quality = 4 + Math.floor(rng() * Math.min(4, 1 + cuisine)); // 4 ~ 4+厨力
  const cost = materials.reduce((s, m) => s + (INGREDIENTS[m]?.price || 1), 0);
  const tier = cost >= 15 ? "宴席" : cost >= 9 ? "精致" : "家常";
  const { cat, taste } = rollTaste(materials, rng);
  return { quality, tier, cost, cat, taste };
}

// AI 出餐（妙手偶得）：起名 + 说书人小描述；失败落规则名
export async function genFreestyleDish(materials, technique, cookware, cuisine, seed) {
  const val = rollFreestyleValue(materials, cuisine, seed);
  const fallbackName = `${materials[0] || "无名"}${technique}`;
  const fallbackDesc = `${technique}${cookware?.name || "旧铁锅"}里翻腾出的${val.taste}味家常。`;

  if (!hasApi()) {
    return { ...val, name: fallbackName, desc: fallbackDesc, from: "规则" };
  }

  const system = `你是曲措乡武侠世界的说书人。玩家在灶房自由搭配食材做出一道无名菜。
只输出菜名与风味小描述（2-3 句，白话古文，章回口吻，禁冒号破折号）。
味型/档次/品质由系统裁决，你的输出里不要出现任何数值与品阶词。
每样材料都有它的风物来历（见下），起名与描写要贴合它们的来头——想象有据，不凭空。`;
  const lore = materials.map(m => {
    const ing = INGREDIENTS[m];
    return ing ? `${m}（${ing.desc}）` : m;
  }).join("；");
  const user = `材料与风物：${lore}
技法：${technique}（${TECH_REQ[technique] || "家常做法"}）
炊具：${cookware?.name || "溪边旧铁锅"}（${cookware?.requirement || ""}）

请输出 JSON：{"name":"菜名(3-7字，见料性见手法，如：山菌醋椒煨江团)","desc":"色香味的说书人小总结(2-3句，收在具体动作或滋味上)"}`;

  try {
    const j = await callAIJson(system, user, { maxTokens: 600 });
    const name = String(j.name || "").trim().slice(0, 12);
    if (!name) throw new Error("空名");
    return {
      ...val, name,
      desc: String(j.desc || fallbackDesc).slice(0, 120),
      from: "AI",
    };
  } catch {
    return { ...val, name: fallbackName, desc: fallbackDesc, from: "规则" };
  }
}

const TECH_REQ = {
  炖: "文火慢煨", 炒: "旺火快炒", 烤: "明火炙烤", 腌: "盐醋封坛", 蒸: "竹笼水汽",
  干煸: "码味不上浆，小火煸干", 炸收: "炸干水气再收汁", 闷烧: "盖盖烧至浓稠",
};

// 固定配方命中判定
export function matchRecipe(materials, techniqueId) {
  const key = [...new Set(materials)].sort().join("|");
  return RECIPES.find(r => r.technique === techniqueId && [...new Set(r.materials)].sort().join("|") === key) || null;
}
