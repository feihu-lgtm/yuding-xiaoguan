// ============================================================================
// 搜打撤副本引擎（摸金校尉厨房版）：大本营 → 多层场景（绿/黄/红热区）
// 六动作：进入 → 搜索（摸食材）→ 交战（遭遇战）→ 抉择（继续/撤离）→ 撤离（兑现）→ 损失与成长
// 体力（探索格）5：搜索-1 / 交战-1 / 深入-1；耗尽强制撤离
// 白皮书落地：绿区保底收益、黄区稳定收益、红区高上限+Boss；撤离点=贪婪终点
// ============================================================================

import { mulberry32 } from "./data.js";

// 每副本 3 层（绿/黄/红），loot 池按热区，encounter 为遭遇概率
export const EXTRACT_LAYERS = {
  digong: [
    { name: "甬道",   heat: "绿", brav: 1, encounter: 0.3, loot: ["玉泉寨土豆", "雅江嫩豆腐", "锦官城干笋"] },
    { name: "库房",   heat: "黄", brav: 2, encounter: 0.6, loot: ["牦牛腱子肉", "天都镇酱油", "鱼定村野葱油"] },
    { name: "主殿",   heat: "红", brav: 3, encounter: 0.9, loot: ["雪山雪莲瓣", "喇嘛庙藏红花", "贡措海盐"] },
  ],
  gudi: [
    { name: "山径",   heat: "绿", brav: 1, encounter: 0.3, loot: ["大草甸野韭", "大草甸蘑菇", "雅江菜籽油"] },
    { name: "密林",   heat: "黄", brav: 2, encounter: 0.6, loot: ["熊山花椒", "熊山铁棍山药", "大草甸孜然"] },
    { name: "熊王洞", heat: "红", brav: 3, encounter: 0.9, loot: ["熊山松茸", "藏香猪五花", "雪山野蜂蜜"] },
  ],
  haidi: [
    { name: "浅滩",   heat: "绿", brav: 1, encounter: 0.3, loot: ["贡措海苔花", "雅江嫩豆腐", "玉泉寨土豆"] },
    { name: "深水廊", heat: "黄", brav: 2, encounter: 0.6, loot: ["贡措海盐", "熊曲石斑", "贡措海裂腹鱼"] },
    { name: "龙宫残殿", heat: "红", brav: 3, encounter: 0.9, loot: ["雪山雪莲瓣", "雪山雪鸡肉", "喇嘛庙藏红花"] },
  ],
  shandong: [
    { name: "洞口",   heat: "绿", brav: 1, encounter: 0.3, loot: ["大草甸蘑菇", "鱼定村青稞", "雅江菜籽油"] },
    { name: "冰廊",   heat: "黄", brav: 2, encounter: 0.6, loot: ["雪山野蜂蜜", "牦牛奶酪", "熊山铁棍山药"] },
    { name: "雪窟",   heat: "红", brav: 3, encounter: 0.9, loot: ["雪山雪莲瓣", "雪山雪鸡肉", "藏香猪五花"] },
  ],
  caoyuan: [
    { name: "草坡",   heat: "绿", brav: 1, encounter: 0.3, loot: ["大草甸野韭", "大草甸蘑菇", "玉泉寨土豆"] },
    { name: "深草带", heat: "黄", brav: 2, encounter: 0.6, loot: ["大草甸孜然", "大草甸黄羊腿", "牦牛奶酪"] },
    { name: "狼王领地", heat: "红", brav: 3, encounter: 0.9, loot: ["大草甸黄羊腿", "藏香猪五花", "喇嘛庙藏红花"] },
  ],
};

export const EXTRACT_ENERGY = 5;

// 进入副本（耗 2 行动点由调用方扣）：返回初始状态
export function initExtraction(dungeonId, brav, seed) {
  const layers = EXTRACT_LAYERS[dungeonId];
  if (!layers) return null;
  return {
    dungeonId,
    layer: 0,          // 当前层
    energy: EXTRACT_ENERGY,
    loot: [],          // 已搜刮
    log: [`你摸进${layers[0].name}（${layers[0].heat}区）。`],
    over: false,
    win: false,        // 是否撤离成功
    brav, seed,
  };
}

const rngOf = (state, salt) => mulberry32(state.seed + state.layer * 131 + salt);

// 动作：search（搜索当前层）/ deeper（深入下一层）/ extract（撤离）
// 返回 { state, event: "遇敌"|"搜到"|"深入"|"撤离"|"超时", enemy? , looted? }
export function extractionAction(state, action, salt) {
  if (state.over) return { state };
  const s = { ...state, loot: [...state.loot], log: [...state.log] };
  const layer = EXTRACT_LAYERS[s.dungeonId][s.layer];
  const rng = rngOf(s, salt);

  if (action === "extract") {
    s.over = true; s.win = true;
    s.log.push("你带着搜刮之物撤出险地——贪心有终点，恐惧有出口。");
    return { state: s, event: "撤离" };
  }

  if (action === "search") {
    if (s.energy < 1) { s.over = true; s.win = false; s.log.push("体力耗尽，被巡夜的拖出险地，行囊丢了一半。"); return { state: s, event: "超时" }; }
    s.energy -= 1;
    // 摸 1-2 件（红区 2 件 + Boss 概率）
    const pool = [...layer.loot];
    const n = layer.heat === "红" ? 2 : 1 + (rng() < 0.4 ? 1 : 0);
    const got = [];
    for (let i = 0; i < n && pool.length; i++) got.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    s.loot.push(...got);
    s.log.push(`你在${layer.name}摸到：${got.join("、") || "两手空空"}`);
    // 遭遇战？
    if (rng() < layer.encounter) {
      s.log.push("——草丛/转角处有动静！");
      return { state: s, event: "遇敌", looted: got };
    }
    return { state: s, event: "搜到", looted: got };
  }

  if (action === "deeper") {
    const next = s.layer + 1;
    if (next >= EXTRACT_LAYERS[s.dungeonId].length) {
      // 已到最深——这是 Boss 层（红区）
      s.log.push("你已抵达最深处——此地的守关之物现身了！");
      return { state: s, event: "遇敌", boss: true };
    }
    const need = EXTRACT_LAYERS[s.dungeonId][next].brav;
    if (s.brav < need) {
      s.log.push(`再往前是${EXTRACT_LAYERS[s.dungeonId][next].heat}区（需胆识${need}），你现在还闯不过去。`);
      return { state: s, event: "受阻" };
    }
    if (s.energy < 1) { s.over = true; s.win = false; s.log.push("体力耗尽……"); return { state: s, event: "超时" }; }
    s.energy -= 1;
    s.layer = next;
    s.log.push(`你深入了${EXTRACT_LAYERS[s.dungeonId][next].name}（${EXTRACT_LAYERS[s.dungeonId][next].heat}区）。`);
    return { state: s, event: "深入" };
  }

  return { state: s, event: "未知" };
}

// 战斗结算后：胜 → 继续探索（还可能再遇敌）；败 → 丢一半战利品强制撤离
export function applyBattleResult(state, win) {
  const s = { ...state, loot: [...state.loot], log: [...state.log] };
  if (win) {
    s.log.push("你收拾了拦路之物，继续搜刮。");
  } else {
    const keep = Math.ceil(s.loot.length / 2);
    const dropped = s.loot.slice(keep);
    s.loot = s.loot.slice(0, keep);
    s.log.push(`你力竭败退，行囊散落了一半（丢了：${dropped.join("、") || "无"}），仓皇撤出。`);
    s.over = true; s.win = false;
  }
  return s;
}
