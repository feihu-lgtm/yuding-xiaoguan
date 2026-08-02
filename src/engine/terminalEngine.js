// ============================================================================
// 主叙事终端引擎：研发（烹饪）在主叙事里完成——输入命令 → 说书人叙事 → 系统裁决
// 命令：放料 <材料…> / 技法 <名> / 开火 / 清锅 / 看灶
// 叙事生成：有 API → AI 说书人（带 角色|场景|表情 元数据）；无 API → 模板叙事
// 数值永远系统裁决（matchRecipe / freestyle / dishScore）
// ============================================================================

import { INGREDIENTS, TECHNIQUES, mulberry32 } from "./data.js";
import { matchRecipe, genFreestyleDish } from "./aiDish.js";
import { callAI, hasApi } from "./aiClient.js";

// 灶台状态
export function newStove() {
  return { slots: [], technique: null, cookware: null, logs: [] };
}

// 命令解析（白名单，MUD 式）
export function parseCommand(line) {
  const s = line.trim();
  const lower = s.toLowerCase();
  if (/^(help|帮助|怎么玩)$/.test(lower)) return { action: "help" };
  if (/^(看灶|灶台|状态)$/.test(s)) return { action: "status" };
  if (/^(清锅|清空)$/.test(s)) return { action: "clear" };
  if (/^放料\s+(.+)$/.test(s)) {
    const mats = s.match(/^放料\s+(.+)$/)[1].split(/[\s、,，]+/).filter(Boolean);
    return { action: "put", mats };
  }
  if (/^技法\s+(.+)$/.test(s)) {
    const name = s.match(/^技法\s+(.+)$/)[1].trim();
    return { action: "technique", name };
  }
  if (/^开火$/.test(s)) return { action: "fire" };
  if (/^打烊$/.test(s)) return { action: "close" };
  return { action: "unknown", raw: s };
}

const MOOD = { 平静: "🙂", 认真: "😤", 满意: "😋", 疑惑: "🤔", 失望: "😞", 惊喜: "✨" };

// 模板叙事（无 API 兜底，仍按 SLG 格式 正文|角色|场景|表情）
function templateNarrative(stove, step, detail) {
  const scene = "灶房";
  switch (step) {
    case "put": {
      const mats = detail.join("、");
      if (!mats) return { text: "你说要放料，可手里空空如也。", who: "说书人", scene, mood: "疑惑" };
      return { text: `你把${mats}码在砧板上。${mats.split("、").map(m => (INGREDIENTS[m]?.desc || m).replace(/。$/, "")).join("。")}。`, who: "说书人", scene, mood: "认真" };
    }
    case "technique": {
      const t = TECHNIQUES[detail];
      if (!t) return { text: `「${detail}」？灶神没听过这门手艺。`, who: "说书人", scene, mood: "疑惑" };
      return { text: `你选了${t.icon}${detail}——${t.requirement}`, who: "说书人", scene, mood: "认真" };
    }
    case "fire-recipe": {
      return { text: `灶膛里火一起，「${detail.name}」的香气腾起来——这道菜，成了。${detail.desc}`, who: "说书人", scene, mood: "满意" };
    }
    case "fire-freestyle": {
      return { text: `你按着自己的心思搭配，锅里的东西渐渐有了自己的性子——说书人给不了名字，先记作「${detail.name}」。${detail.desc}`, who: "说书人", scene, mood: "惊喜" };
    }
    case "fire-fail": {
      return { text: "灶火一腾，锅里糊成一团焦黑——灶神摇头。", who: "说书人", scene, mood: "失望" };
    }
    case "clear": return { text: "你把锅刷净，砧板归位，灶台重归清朗。", who: "说书人", scene, mood: "平静" };
    case "help": return {
      text: "放料 <材料…> ｜ 技法 <炖/炒/烤/蒸/腌/干煸/炸收/闷烧> ｜ 开火 ｜ 清锅 ｜ 看灶",
      who: "说书人", scene, mood: "平静",
    };
    default: return { text: "说书人听不懂这句。", who: "说书人", scene, mood: "疑惑" };
  }
}

// AI 叙事（研发过程说书）
export async function aiNarrative(stove, step, detail, dish) {
  if (!hasApi()) return null;
  const system = `你是曲措乡鱼定村小馆灶房的灶神说书人。玩家正在灶房做菜，你以说书人口吻描述这一步。
输出格式：正文|角色|场景|表情（角色填"灶神"，场景填"灶房"，表情取：平静/认真/满意/惊喜/失望/疑惑）。
白话古文，章回口吻，2-3 句，收在具体动作或滋味上，禁冒号破折号。不要出现任何数值。`;
  let user = "";
  if (step === "put") user = `玩家把材料放进灶台：${detail.join("、")}。`;
  else if (step === "technique") user = `玩家选了技法「${detail}」。要求：${TECHNIQUES[detail]?.requirement || "家常做法"}。`;
  else if (step === "fire") {
    if (dish?.from === "AI") user = `开火出锅，菜成，名为「${dish.name}」。描述：${dish.desc}`;
    else user = `开火出锅，成了「${dish.name}」。`;
  } else if (step === "clear") user = "玩家清空了灶台。";
  try {
    const raw = await callAI(system, user, { maxTokens: 500 });
    const parts = raw.split("|").map(p => p.trim());
    if (parts.length >= 1 && parts[0]) {
      return {
        text: parts[0].slice(0, 160),
        who: parts[1] || "灶神",
        scene: parts[2] || "灶房",
        mood: MOOD[parts[3]] ? parts[3] : "平静",
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 执行命令（纯裁决 + 叙事）
// deps: { inventory, cuisine, recipes, customRecipes, onCooked(dish) }
export async function runCommand(stove, line, deps) {
  const cmd = parseCommand(line);
  const narr = (n, detail) => n || templateNarrative(stove, cmd.action, detail ?? "");
  const seed = Date.now() % 997;

  switch (cmd.action) {
    case "help":
      return { stove, msg: narr(await aiNarrative(stove, "help", null), null) };
    case "clear": {
      stove.slots = [];
      stove.technique = null;
      return { stove, msg: narr(await aiNarrative(stove, "clear", null), null) };
    }
    case "put": {
      const valid = cmd.mats.filter(m => deps.inventory[m] > 0);
      const bad = cmd.mats.filter(m => !valid.includes(m));
      if (bad.length) {
        return { stove, msg: { text: `「${bad.join("、")}」？你手上没有这物件。`, who: "说书人", scene: "灶房", mood: "疑惑" } };
      }
      stove.slots = [...stove.slots, ...valid].slice(0, 4);
      return { stove, msg: narr(await aiNarrative(stove, "put", valid), valid) };
    }
    case "technique": {
      const t = TECHNIQUES[cmd.name];
      if (!t) return { stove, msg: narr() };
      if ((t.unlock || 0) > deps.cuisine) {
        return { stove, msg: { text: `「${cmd.name}」是进阶技法，厨力 ${t.unlock} 才够得着。`, who: "说书人", scene: "灶房", mood: "疑惑" } };
      }
      stove.technique = cmd.name;
      return { stove, msg: narr(await aiNarrative(stove, "technique", cmd.name), cmd.name) };
    }
    case "fire": {
      if (!stove.slots.length) {
        return { stove, msg: { text: "灶膛烧得正旺，可锅里空空如也。", who: "说书人", scene: "灶房", mood: "疑惑" } };
      }
      if (!stove.technique) {
        return { stove, msg: { text: "料码好了，可你还没说要怎么个做法——报个技法。", who: "说书人", scene: "灶房", mood: "疑惑" } };
      }
      const recipe = matchRecipe(stove.slots, stove.technique);
      // 扣库存
      const inv = { ...deps.inventory };
      for (const m of stove.slots) inv[m] = (inv[m] || 1) - 1;
      let dish;
      if (recipe) {
        dish = { name: recipe.name, technique: recipe.technique, taste: recipe.taste, tier: recipe.tier, desc: recipe.desc, from: "配方" };
      } else {
        dish = await genFreestyleDish(stove.slots, stove.technique, stove.cookware, deps.cuisine, seed);
        dish = { ...dish, technique: stove.technique, materials: [...stove.slots] };
      }
      const aiMsg = await aiNarrative(stove, "fire", null, dish);
      const msg = aiMsg || templateNarrative(stove, recipe ? "fire-recipe" : "fire-freestyle", dish);
      const next = { ...stove, slots: [], technique: null };
      deps.onCooked?.({ dish, inventory: inv });
      return { stove: next, msg, dish, recipe: !!recipe };
    }
    case "status": {
      const t = stove.technique ? `${stove.technique}（${TECHNIQUES[stove.technique]?.icon}）` : "未定";
      return {
        stove,
        msg: { text: `灶上：${stove.slots.join("、") || "空空"} ｜ 技法：${t}`, who: "说书人", scene: "灶房", mood: "平静" },
      };
    }
    default:
      return { stove, msg: narr() };
  }
}
