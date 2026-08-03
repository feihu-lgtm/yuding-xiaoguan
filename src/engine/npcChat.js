// ============================================================================
// NPC 对话接口（精简 qucuo act/对话模式）：
//   对话对象池 → 说书人扮演 NPC 回应（AI，喂 NPC 档案+好感）→ 模板兜底 → 好感微调
// 参考 qucuo：对话模式不消耗回合、TALK_CASUAL 提取 respondedNpcs+好感
// ============================================================================

import { REGULARS } from "./guestEngine.js";
import { callAI, hasApi } from "./aiClient.js";

const MOOD = { 平静: "🙂", 热情: "😊", 谨慎: "🤨", 不耐烦: "😤", 满意: "😋", 疑惑: "🤔" };

// 对话对象池：白天 = 店堂在场客人（桌卡）；夜晚 = 熟客档案（登门拜访）
export function chatTargets(game, dayState) {
  const inHall = new Set();
  if (dayState?.tables) {
    for (const tb of dayState.tables) {
      if (tb?.guest?.name) inHall.add(tb.guest.name);
    }
  }
  const targets = [];
  for (const r of REGULARS) {
    targets.push({
      ...r,
      where: inHall.has(r.name) ? "店堂" : "可登门",
      favor: game.favors?.[r.id] || 0,
    });
  }
  return targets;
}

// 对话命令解析：对话 X / 和X说 / 问X
// 名字精确匹配档案（最长匹配，防贪婪吞后缀）
function matchNpcName(text) {
  const names = [...REGULARS].sort((a, b) => b.name.length - a.name.length);
  const hit = names.find(r => text.startsWith(r.name));
  return hit ? hit.name : null;
}

export function parseChatCommand(line) {
  const s = line.trim();
  let m = s.match(/^(对话|和|找|问)\s*(.+)$/);
  if (m) {
    const name = matchNpcName(m[2]);
    if (name) return { action: "chat", name, rest: m[2].slice(name.length).replace(/^(说话|聊聊|聊两句|在吗|聊|说说)\s*/, "") };
  }
  const name = matchNpcName(s);
  if (name) return { action: "chat", name, rest: "" };
  return null;
}

// NPC 档案摘要（喂 AI）
function npcBrief(npc) {
  const f = npc.favor;
  const favorTxt = f >= 60 ? "与你是老交情" : f >= 40 ? "待你颇为亲近" : f >= 20 ? "跟你相熟" : f > 0 ? "与你点头之交" : "与你素不相识";
  return `${npc.name}：${npc.line}。口味：${npc.taste}味、偏好${npc.tech}法、惦记${npc.likes.join("、")}。${favorTxt}（好感${f}）。`;
}

// AI 对话（说书人扮演 NPC 回话）
export async function aiChat(npc, playerMsg, where, dayIdx) {
  if (!hasApi()) return null;
  const system = `你是曲措乡鱼定村小馆的说书人，此刻扮作 ${npc.name} 与店主（玩家）搭话。
只回 ${npc.name} 会说的话，口吻贴合其性格，白话古文，章回说书人风味，2-3 句。
对话中自然流露他的口味线索（${npc.taste}味、${npc.tech}法、${npc.likes.join("、")}）——他可能直说、可能暗示、也可能藏着掖着。
输出格式：正文|角色|场景|表情（角色填"${npc.name}"，场景填"${where}"，表情取：平静/热情/谨慎/不耐烦/满意/疑惑）。
禁冒号破折号。`;
  const user = `【${npc.name} 的底细】${npcBrief(npc)}
【场景】${where}，第 ${dayIdx + 1} 天。
【店主说】${playerMsg || "（只是来打招呼）"}`;
  try {
    const raw = await callAI(system, user, { maxTokens: 700 });
    const parts = raw.split("|").map(x => x.trim());
    if (parts[0]) {
      return {
        text: parts[0].slice(0, 200),
        who: parts[1] || npc.name,
        scene: parts[2] || where,
        mood: MOOD[parts[3]] ? parts[3] : "平静",
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 模板兜底：用 NPC 人设 + 好感档拼一句"活的"回应（含口味线索）
export function templateChat(npc, playerMsg, where) {
  const f = npc.favor;
  const greet = f >= 40 ? "笑着迎上来" : f >= 20 ? "点点头" : "打量了你一眼";
  const clue = `（随口提一句：${npc.taste}味、${npc.tech}法、${npc.likes[0]}）`;
  const text = `${npc.name}${greet}：「${npc.line}」${clue}${playerMsg ? `——回你一句「${playerMsg.slice(0, 20)}」的事，他记下了。` : ""}`;
  return { text: text.slice(0, 120), who: npc.name, scene: where, mood: f >= 40 ? "热情" : "平静" };
}

// 对话结算：回应 + 好感微调（respondedNpcs 模式，好感只升不降）
export function chatFavorDelta(npc, mood) {
  if (mood === "热情" || mood === "满意") return 2;
  if (mood === "不耐烦") return 0;
  return 1;
}
