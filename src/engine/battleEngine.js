// ============================================================================
// 战斗引擎（简化回合制，复用 qucuo 模型）
// fighter: { hp[max], energy[max], neigong, waigong, atk, def, skills[], weapon, armor }
// 招式 moveType: 攻击(1.0x) / 防御(受击-50%) / 状态(回气或特效)
// 敌人数据由系统从白名单池生成（DUNGEON_ENEMIES），AI 只负责叙事（P3 接入）
// ============================================================================

import { mulberry32 } from "./data.js";

// ── 敌人池（5 副本 × 3 敌人，tier 映射战力）───────────────────────────────
// tier: 白1 绿2 蓝3 紫4 橙5；brav 门槛 = tier
const TIER_HP = [0, 22, 34, 50, 74, 100];
const TIER_ATK = [0, 4, 6, 9, 13, 18];
const TIER_DEF = [0, 0, 1, 2, 4, 6];

export const DUNGEON_ENEMIES = {
  digong: [
    { name: "土司府役从", tier: 1, desc: "提着水火棍的府役，一脸不耐烦", loot: ["锦官城干笋", "玉泉寨土豆"] },
    { name: "巡捕鹰犬",   tier: 2, desc: "腰挎铁尺的巡捕，眼神不善",     loot: ["天都镇酱油", "玉泉寨土豆"] },
    { name: "石甲卫士",   tier: 3, desc: "浑身石甲的卫士，杵着长戟不动", loot: ["牦牛腱子肉", "雅江嫩豆腐"] },
  ],
  gudi: [
    { name: "黑熊",       tier: 2, desc: "胸口一道白月牙的壮黑熊，嗅着空气", loot: ["熊山花椒", "熊山铁棍山药"] },
    { name: "熊山山魁",   tier: 3, desc: "比人还高的山魈，咧嘴露出黄牙",     loot: ["熊山松茸", "熊山铁棍山药"] },
    { name: "花椒老熊王", tier: 4, desc: "熊山之主，鬃毛间缠着花椒枝",       loot: ["熊山松茸", "熊山花椒", "熊山铁棍山药"] },
  ],
  haidi: [
    { name: "寒潭银鱼精", tier: 3, desc: "通体银白的鱼精，尾鳍如薄冰",     loot: ["贡措海裂腹鱼", "贡措海苔花"] },
    { name: "冰封卫兵",   tier: 3, desc: "被封在冰中的古兵，眼珠还能转",   loot: ["贡措海盐", "雪山雪莲瓣"] },
    { name: "湖底玄龟",   tier: 4, desc: "壳上长满苔花的老龟，一步一个响", loot: ["贡措海苔花", "贡措海裂腹鱼", "雪山雪莲瓣"] },
  ],
  shandong: [
    { name: "雪狼",       tier: 3, desc: "独行的白狼，爪下踩着雪",       loot: ["雪山雪鸡肉", "雪山野蜂蜜"] },
    { name: "冻尸行者",   tier: 3, desc: "拖着半截锁链的行尸，步步生冰", loot: ["雪山雪莲瓣", "雪山野蜂蜜"] },
    { name: "冰窟道人",   tier: 4, desc: "白发枯坐的道人，掌中凝着霜气", loot: ["雪山雪莲瓣", "雪山雪鸡肉"] },
  ],
  caoyuan: [
    { name: "野狼群",     tier: 3, desc: "七八只野狼围成半圆，低低地呜咽", loot: ["大草甸黄羊腿", "大草甸蘑菇"] },
    { name: "黑风寨伏兵", tier: 4, desc: "蒙面黑布的山贼，腰间的刀反着光", loot: ["黑风寨苞谷醋", "大草甸孜然"] },
    { name: "银灰独眼狼王", tier: 5, desc: "独眼的银灰狼王，草甸之王",    loot: ["大草甸黄羊腿", "大草甸孜然", "大草甸蘑菇"] },
  ],
};

// 按胆识生成敌人：可碰 tier ≤ 胆识；boss（最高 tier>2）概率 20%
export function genEnemy(dungeonId, brav, seed) {
  const pool = DUNGEON_ENEMIES[dungeonId];
  if (!pool) return null;
  const rng = mulberry32(seed);
  const maxTier = Math.min(5, brav);
  const reachable = pool.filter(e => e.tier <= maxTier);
  const top = Math.max(...reachable.map(e => e.tier));
  const boss = reachable.filter(e => e.tier === top && e.tier > 2);
  let enemy;
  if (boss.length && rng() < 0.2) {
    enemy = boss[Math.floor(rng() * boss.length)];
  } else {
    const rest = reachable.filter(e => !boss.includes(e));
    enemy = (rest.length ? rest : reachable)[Math.floor(rng() * (rest.length ? rest.length : reachable.length))];
  }
  return {
    ...enemy,
    hp: TIER_HP[enemy.tier], maxHp: TIER_HP[enemy.tier],
    atk: TIER_ATK[enemy.tier], def: TIER_DEF[enemy.tier],
  };
}

// ── 玩家 fighter 构建（夜晚状态）─────────────────────────────────────────
export function buildFighter({ hp = 50, neigong = 1, waigong = 1, skills = [], weapon = null, armor = null }) {
  const atk = 5 + waigong * 4 + (weapon?.atk || 0);
  const def = Math.floor(waigong / 2) + (armor?.def || 0);
  const maxHp = 50 + waigong * 15;
  const maxEnergy = 30 + neigong * 8;
  return {
    hp, maxHp, energy: maxEnergy, maxEnergy,
    neigong, waigong, atk, def, skills, weapon, armor,
  };
}

// 可用招式：玩家手动选（UI），敌人 AI 自动选
export function enemyChooseMove(enemy, rng, state) {
  // 简单 AI：血量低时 30% 防御；气足够时用"招式"；否则平砍
  const roll = rng();
  if (enemy.hp < enemy.maxHp * 0.3 && roll < 0.3) return { type: "defend" };
  if (roll < 0.75) return { type: "attack", power: 1.0 };
  return { type: "attack", power: 1.3 }; // 暴起
}

// 单回合结算（纯函数）
// p 招式: { type: "attack"|"defend"|"skill", skill? , healHp? }
export function battleTurn(p, enemy, pMove, eMove, rng) {
  const log = [];
  const pAtk = p.atk * (pMove.power ?? 1);
  const eAtk = enemy.atk * (eMove.power ?? 1);
  const pDefend = pMove.type === "defend";
  const eDefend = eMove.type === "defend";

  // 玩家行动
  let pHp = p.hp, pHpHeal = 0;
  if (pMove.type === "skill" && pMove.skill) {
    const sk = pMove.skill;
    if (sk.healEnergy) {
      p.energy = Math.min(p.maxEnergy, p.energy + sk.healEnergy);
      log.push(`你使出「${sk.name}」，气机回复 ${sk.healEnergy} 点`);
    }
    if (sk.healHp) {
      pHpHeal = Math.round(p.maxHp * sk.healHp);
      p.hp = Math.min(p.maxHp, p.hp + pHpHeal);
      log.push(`你使出「${sk.name}」，气血回复 ${pHpHeal} 点`);
    }
    if (!sk.healEnergy && !sk.healHp && sk.power) {
      const dmg = Math.max(1, Math.round(pAtk * sk.power * (rng() * 0.4 + 0.8) - enemy.def * 0.5));
      enemy.hp = Math.max(0, enemy.hp - dmg);
      log.push(`你使出「${sk.name}」，对${enemy.name}造成 ${dmg} 点伤害`);
    }
  } else if (pMove.type === "attack") {
    const dmg = Math.max(1, Math.round(pAtk * (rng() * 0.4 + 0.8) - enemy.def * 0.5));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    log.push(`你挥出一击，对${enemy.name}造成 ${dmg} 点伤害`);
  } else {
    log.push("你凝神防御");
  }

  // 敌人行动
  if (enemy.hp > 0) {
    if (eMove.type === "defend") {
      log.push(`${enemy.name} 稳住身形，谨慎防守`);
    } else {
      const dmg = Math.max(1, Math.round(eAtk * (rng() * 0.4 + 0.8) - (pDefend ? p.def + 5 : p.def) * 0.5));
      p.hp = Math.max(0, p.hp - dmg);
      log.push(`${enemy.name} 扑来，你受 ${dmg} 点伤害${pDefend ? "（防御减伤）" : ""}`);
    }
  }

  const win = enemy.hp <= 0;
  const lose = p.hp <= 0;
  return { pHp: p.hp, eHp: enemy.hp, pEnergy: p.energy, log, win, lose, over: win || lose };
}

// 战斗结果 → 战利品（白名单）
export function battleLoot(enemy, rng, need = []) {
  if (!enemy) return [];
  const loot = [...enemy.loot];
  const targeted = need.filter(it => loot.includes(it));
  const items = [];
  const n = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < n && (targeted.length || loot.length); i++) {
    if (targeted.length) {
      const it = targeted.splice(Math.floor(rng() * targeted.length), 1)[0];
      items.push(it);
    } else if (loot.length) {
      items.push(loot.splice(Math.floor(rng() * loot.length), 1)[0]);
    }
  }
  return items;
}
