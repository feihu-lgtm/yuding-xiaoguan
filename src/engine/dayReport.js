// ============================================================================
// 每日 AI 报告：今日整体如何、食客喜不喜欢（好评/差评/偏好命中分析）、明日建议
// 有 API → AI 说书人总结；无 API → 规则模板兜底（仍是"活的报告"）
// ============================================================================

import { callAI, hasApi } from "./aiClient.js";

// 汇总今日数据 → 报告输入
export function summarizeDay(day, summary) {
  const sales = day?.sales || [];
  const good = sales.filter(s => s.verdict === "好评");
  const bad = sales.filter(s => s.verdict === "差评");
  const dishCount = {};
  for (const s of sales) if (s.dish) dishCount[s.dish] = (dishCount[s.dish] || 0) + 1;
  const topDish = Object.entries(dishCount).sort((a, b) => b[1] - a[1])[0];
  return {
    revenue: summary?.gross || 0,
    net: summary?.net || 0,
    guests: sales.length,
    good: good.length, bad: bad.length, flat: sales.length - good.length - bad.length,
    goodRate: sales.length ? Math.round((good.length / sales.length) * 100) : 0,
    goodNames: good.map(s => s.guest).slice(0, 5).join("、") || "无",
    badNames: bad.map(s => s.guest).slice(0, 5).join("、") || "无",
    topDish: topDish ? `${topDish[0]}（${topDish[1]}道）` : "无",
    rep: day?.reputationDelta ?? 0,
  };
}

// 规则模板兜底（无 API 时的"活报告"）
export function templateReport(d) {
  const lines = [];
  lines.push(`今日共接待 ${d.guests} 位食客，毛收 ${d.revenue} 文，净利 ${d.net >= 0 ? "+" : ""}${d.net} 文，好评率 ${d.goodRate}%。`);
  if (d.topDish !== "无") lines.push(`卖得最好的是${d.topDish}。`);
  if (d.goodNames !== "无") lines.push(`满意而归的客人里有：${d.goodNames}。`);
  if (d.badNames !== "无") lines.push(`吃得不痛快的：${d.badNames}——明日备菜该避避雷。`);
  if (d.rep > 0) lines.push(`今日声名见长（+${d.rep}）。`);
  else if (d.rep < 0) lines.push(`今日声名有损（${d.rep}）。`);
  lines.push("明日多备些招牌菜，客人的口味还得慢慢喂。");
  return { text: lines.join(""), from: "规则" };
}

// AI 报告（说书人口吻）
export async function genDayReport(day, summary, seed) {
  const d = summarizeDay(day, summary);
  if (!hasApi()) return templateReport(d);

  const system = `你是曲措乡鱼定村小馆的说书人。每晚打烊后，给店主（玩家）写一段当日经营报告。
内容：今日整体如何、食客喜不喜欢、谁记住了你、明日一句建议。
白话古文，章回说书人口吻，120-200 字，收在具体动作或滋味上，禁冒号破折号。`;
  const user = `今日账目：毛收 ${d.revenue} 文，净利 ${d.net >= 0 ? "+" : ""}${d.net} 文。
食客 ${d.guests} 位：好评 ${d.good}，平平 ${d.flat}，差评 ${d.bad}，好评率 ${d.goodRate}%。
${d.topDish !== "无" ? `最受欢迎：${d.topDish}。` : ""}
${d.goodNames !== "无" ? `满意者：${d.goodNames}。` : ""}
${d.badNames !== "无" ? `不满者：${d.badNames}。` : ""}
声望变动：${d.rep >= 0 ? "+" : ""}${d.rep}。`;

  try {
    const text = await callAI(system, user, { maxTokens: 800 });
    return { text, from: "AI" };
  } catch {
    return templateReport(d);
  }
}
