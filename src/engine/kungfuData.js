// ============================================================================
// 武学与装备数据（从 qucuo SKILL_CATALOG 精简搬运，白名单池）
// 渠道：武馆买（银两）/ 拜师（好感≥40，折价）/ 练功潜能修炼
// ============================================================================

// ── 武学秘籍（玉泉练武场 + 雪山练功堂的低中级目）────────────────────────
// moveType: 攻击/防御/状态（回气或特效）；power：招式威力系数；cost：耗气
export const SKILLS = [
  // 玉泉练武场（便宜入门）
  { id: "kf_jiangong",  name: "坚桩功",   quality: "白", price: 20,  school: "玉泉", moveType: "防御", power: 0.5, cost: 0,
    desc: "扎实的站桩功夫，招式简单但根基牢固，练到纯熟能以守代攻。初学者的不二之选。" },
  { id: "kf_daishuai",  name: "摔跌术",   quality: "绿", price: 35,  school: "玉泉", moveType: "状态", power: 1.0, cost: 6,
    desc: "借力打力，将对手的气势引入虚处——看似平淡，实则以巧破力，是玉泉寨人相互切磋最常用的手段。" },
  { id: "kf_liuyun",    name: "流云步法", quality: "绿", price: 45,  school: "玉泉", moveType: "状态", power: 1.0, cost: 5,
    desc: "藏地牧民代代相传的步伐心诀，身随意转，如云散无形。修习后身法加强，更易占得先手。" },
  { id: "kf_rec_muge",  name: "牧歌调息", quality: "绿", price: 55,  school: "玉泉", moveType: "状态", power: 0.6, cost: 0, healEnergy: 8,
    desc: "放牦牛的人在坡上哼的调子，没词，只有起伏。哼到第三遍呼吸自己就跟上了拍子。" },
  { id: "kf_rec_langqu", name: "狼曲饮雪", quality: "蓝", price: 120, school: "玉泉", moveType: "状态", power: 0.8, cost: 0, healEnergy: 7, healHp: 0.08,
    desc: "掬一捧狼曲上游的雪含在嘴里，不嚼不咽，让它自己化。牧民冬天赶远路全靠这一口。" },
  // 雪山练功堂（中级）
  { id: "kf_xuexin",    name: "雪山养气诀", quality: "绿", price: 70, school: "雪山", moveType: "状态", power: 1.0, cost: 6,
    desc: "雪山派养气的入门心法，行气如雪水渗地，不急不躁。" },
  { id: "kf_bingxin",   name: "冰心掌",   quality: "绿", price: 55,  school: "雪山", moveType: "防御", power: 0.7, cost: 4, counter: 0.6,
    desc: "掌风凝寒，守中有攻。对方越是急躁，越容易撞上这一掌的冰碴子。" },
  { id: "kf_rec_xuexian", name: "雪线吐纳", quality: "蓝", price: 130, school: "雪山", moveType: "状态", power: 0.7, cost: 0, healEnergy: 9,
    desc: "沿着雪线往上走，越走呼吸越匀。修习此诀，气海如雪山融水，取之不竭。" },
  { id: "kf_xuekong",   name: "虚空游步", quality: "蓝", price: 100, school: "雪山", moveType: "状态", power: 1.1, cost: 7,
    desc: "雪山派成名身法，脚下如踏虚空，出招飘忽难测。" },
];

// ── 装备（鱼定铁匠铺/玉泉杂货，加攻击/防御）─────────────────────────────
export const WEAPONS = [
  { id: "eq_caidao",  name: "剔骨菜刀",  quality: "白", price: 30, atk: 2,  desc: "鱼定大娘磨了半辈子的剔骨刀，锋利趁手。" },
  { id: "eq_liedao",  name: "猎户短刀",  quality: "绿", price: 80, atk: 4,  desc: "老猎户的备用短刀，刀身带着陈年的松脂味。" },
  { id: "eq_tieqiang", name: "马帮铁枪", quality: "蓝", price: 200, atk: 7, desc: "马帮护货的铁枪，枪头磨得发亮，捅野狼一枪一个。" },
];

export const ARMORS = [
  { id: "eq_cubu",  name: "粗布短打", quality: "白", price: 20, def: 1, desc: "结实的粗布衣裳，跑起来利索。" },
  { id: "eq_pijia", name: "熊皮坎肩", quality: "绿", price: 60, def: 3, desc: "熊皮缝的坎肩，挡风又挡野兽爪牙。" },
  { id: "eq_suojia", name: "巡捕锁子甲", quality: "蓝", price: 180, def: 6, desc: "从锦官城巡捕营流出来的锁子甲，做工扎实。" },
];

// ── 拜师（好感≥40 解锁，折价 = 基础价 × 折价系数）──────────────────────
export function teachPrice(basePrice, favor) {
  const discount = favor >= 80 ? 0.5 : favor >= 60 ? 0.65 : favor >= 40 ? 0.8 : 1.0;
  return Math.max(5, Math.round(basePrice * discount));
}

// 练功：每夜 1 次，得潜能（跟胆识走：潜能 = 2 + 胆识）
export function trainPotency(brav) {
  return 2 + brav;
}

// 修炼：潜能 → 外功（waigong 每级 +1 需 3 潜能）/ 内功（neigong 每级 +1 需 3 潜能）
export function cultivate(stat, pot, cost = 3) {
  if (pot < cost) return { ok: false, reason: `潜能不足（需 ${cost}）` };
  return { ok: true, pot: pot - cost, gain: 1 };
}
