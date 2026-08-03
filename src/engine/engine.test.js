import { describe, it, expect } from "vitest";
import { RECIPES, INGREDIENTS, START_INVENTORY, recipeCost, recipePrepTime, recipePriceRange } from "./data.js";
import { genDayGuests, REGULARS } from "./guestEngine.js";
import { calcSatisfaction } from "./satisfaction.js";
import { makePrep, overnight } from "./prepEngine.js";
import { initDay, tick, serveDish } from "./dayEngine.js";
import { runDungeon, developDish, freestyleDish, DUNGEONS } from "./nightEngine.js";
import { settleDay, checkBankrupt } from "./economy.js";
import { genEnemy, buildFighter, battleTurn, battleLoot, DUNGEON_ENEMIES } from "./battleEngine.js";
import { resolveEnemyAI } from "./aiEnemy.js";
import { chatTargets, templateChat, chatFavorDelta, parseChatCommand } from "./npcChat.js";
import { mulberry32, TASTES } from "./data.js";
import { rollFreestyleValue, rollTaste, matchRecipe } from "./aiDish.js";

describe("数据层", () => {
  it("31 种食材全带单价", () => {
    expect(Object.keys(INGREDIENTS)).toHaveLength(31);
    for (const [n, v] of Object.entries(INGREDIENTS)) {
      expect(v.price, n).toBeGreaterThan(0);
    }
  });
  it("10 道菜全带味型/档次，成本>0，出餐耗时 2-4t", () => {
    expect(RECIPES).toHaveLength(10);
    for (const r of RECIPES) {
      expect(r.taste, r.name).toBeTruthy();
      expect(["家常", "精致", "宴席"]).toContain(r.tier);
      expect(recipeCost(r)).toBeGreaterThan(0);
      expect(recipePrepTime(r)).toBeGreaterThanOrEqual(2);
      expect(recipePrepTime(r)).toBeLessThanOrEqual(4);
      expect(recipePriceRange(r).min).toBeLessThan(recipePriceRange(r).max);
    }
  });
  it("开局库存够押 4 道菜", () => {
    const res = makePrep({ ...START_INVENTORY }, { "牦牛骨汤": 2, "烤藏香猪": 3, "烤黄羊腿": 3, "酸汤裂腹鱼": 3 });
    expect(res.ok).toBe(true);
    expect(res.prep["牦牛骨汤"]).toBe(2);
  });
});

describe("客人引擎", () => {
  it("16 位熟客档案 + 每日 24 客（3×8），熟客 8-10 位", () => {
    expect(REGULARS).toHaveLength(16);
    const slots = genDayGuests(0, 20);
    expect(slots).toHaveLength(3);
    for (const s of slots) expect(s).toHaveLength(8);
    const regularCount = slots.flat().filter(g => g.regular).length;
    expect(regularCount).toBeGreaterThanOrEqual(8);
    expect(regularCount).toBeLessThanOrEqual(10);
  });
  it("同一天种子确定（防 S/L）", () => {
    expect(JSON.stringify(genDayGuests(5, 20))).toBe(JSON.stringify(genDayGuests(5, 20)));
  });
  it("不同天客单不同", () => {
    expect(JSON.stringify(genDayGuests(1, 20))).not.toBe(JSON.stringify(genDayGuests(2, 20)));
  });
});

describe("满意度", () => {
  const guest = { taste: "麻辣", likes: ["青衣江团鱼"], pay: 30, patience: 5 };
  it("兴趣命中+口味契合+品质 → 好评", () => {
    const r = calcSatisfaction(guest, { tasteCat: "麻辣", quality: 7, price: 25 }, 2, {});
    expect(r.verdict).toBe("好评");
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
  it("等待超时 → 差评", () => {
    const r = calcSatisfaction(guest, { tasteCat: "麻辣", quality: 5, price: 20 }, 12, {});
    expect(r.verdict).toBe("差评");
  });
  it("缺货 → 固定 -30", () => {
    const r = calcSatisfaction(guest, { tasteCat: "鲜香", quality: 5, price: 10 }, 2, { outOfStock: true });
    expect(r.verdict).toBe("差评");
  });
  it("超消费力 → 性价比惩罚", () => {
    const r = calcSatisfaction(guest, { tasteCat: "麻辣", quality: 5, price: 100 }, 2, {});
    expect(r.score).toBeLessThan(60);
  });
});

describe("白天引擎", () => {
  it("手动派餐：waiting 桌派菜 → 24 客全结账，零 AI", () => {
    const slots = genDayGuests(0, 20);
    const prep = { "牦牛骨汤": 8, "烤藏香猪": 8, "烤黄羊腿": 8, "酸汤裂腹鱼": 8 };
    const prices = { "牦牛骨汤": 14, "烤藏香猪": 16, "烤黄羊腿": 14, "酸汤裂腹鱼": 14 };
    let s = initDay(0, slots, prep, prices);
    let guard = 0;
    while (!s.done && guard++ < 300) {
      for (let t = 0; t < s.tables.length; t++) {
        const tb = s.tables[t];
        if (tb?.state === "waiting") {
          const available = Object.keys(s.prep).filter(n => s.prep[n] > 0);
          if (available.length) s = serveDish(s, t, available[0], 14);
        }
      }
      s = tick(s);
    }
    expect(s.done).toBe(true);
    expect(s.sales.length).toBe(24);
    expect(s.cash).toBeGreaterThan(0);
  });
  it("没派餐的客人等太久会走（流失不差评）；份数耗尽后无菜可派", () => {
    const slots = genDayGuests(0, 20);
    const prep = { "牦牛骨汤": 1 };
    let s = initDay(0, slots, prep, { "牦牛骨汤": 14 });
    let guard = 0;
    while (guard++ < 200) {
      // 只派第一桌，其余不管 → 90 秒配餐时限后流失
      for (let t = 0; t < s.tables.length; t++) {
        const tb = s.tables[t];
        if (tb?.state === "waiting" && t === 0 && s.prep["牦牛骨汤"] > 0) {
          s = serveDish(s, t, "牦牛骨汤", 14);
        }
      }
      s = tick(s);
    }
    expect(s.prep["牦牛骨汤"]).toBeLessThanOrEqual(0);
    expect(s.missed).toBeGreaterThan(0);
    expect(s.sales.filter(x => x.verdict === "差评").length).toBe(0);
  });
  it("扒口味：好评把菜属性计入候选，差评排除", () => {
    const slots = genDayGuests(0, 20);
    const prep = { "牦牛骨汤": 8, "烤藏香猪": 8 };
    let s = initDay(0, slots, prep, { "牦牛骨汤": 14, "烤藏香猪": 16 });
    let guard = 0;
    while (!s.done && guard++ < 300) {
      for (let t = 0; t < s.tables.length; t++) {
        const tb = s.tables[t];
        if (tb?.state === "waiting") {
          const available = Object.keys(s.prep).filter(n => s.prep[n] > 0);
          if (available.length) s = serveDish(s, t, available[guard % available.length], 14);
        }
      }
      s = tick(s);
    }
    const guest = slots.flat().find(g => Object.keys(g.known.hits).length > 0 || Object.keys(g.known.miss).length > 0);
    expect(guest).toBeTruthy();
  });
});

describe("夜晚引擎", () => {
  it("胆识达标 → 胜，战利品出自白名单", () => {
    for (const d of DUNGEONS) {
      const r = runDungeon(d.id, d.brav + 2, 0, 42);
      expect(r.win).toBe(true);
      for (const it of r.loot) {
        if (it !== "银两") expect(d.loot).toContain(it);
      }
    }
  });
  it("胆识不足 → 败", () => {
    const r = runDungeon("gudi", 1, 0, 42);
    expect(r.win).toBe(false);
  });
  it("固定配方研发：缺料失败，齐料成功且扣库存", () => {
    expect(developDish({}, "牦牛骨汤", "炖").ok).toBe(false);
    const r = developDish({ "牦牛腱子肉": 1, "贡措海盐": 1 }, "牦牛骨汤", "炖");
    expect(r.ok).toBe(true);
    expect(r.inventory["牦牛腱子肉"]).toBe(0);
  });
  it("妙手偶得：材料不够拒绝，成功产出味型在白名单", () => {
    expect(freestyleDish({}, ["大草甸蘑菇"], {}).ok).toBe(false);
    const r = freestyleDish({ "大草甸蘑菇": 1, "贡措海盐": 1 }, ["大草甸蘑菇", "贡措海盐"], { cuisine: 5 });
    expect(r.ok).toBe(true);
  });
});

describe("经济引擎", () => {
  it("日结：净利 = 毛收 - 成本 - 工钱 - 租金", () => {
    const s = settleDay({ cash: 300, revenue: 400, foodCost: 100 });
    expect(s.net).toBe(400 - 100 - 30 - 20);
    expect(s.cash).toBe(300 + s.net);
  });
  it("破产：连续 3 日负且现银见底", () => {
    expect(checkBankrupt([-10, -10, -10], 10)).toBe(true);
    expect(checkBankrupt([-10, -10, -10], 100)).toBe(false);
    expect(checkBankrupt([10, -10, -10], 10)).toBe(false);
  });
  it("备菜隔夜：无冰窖全损耗，有冰窖减半", () => {
    expect(overnight({ "牦牛骨汤": 3 }, false)).toEqual({});
    expect(overnight({ "牦牛骨汤": 3 }, true)).toEqual({ "牦牛骨汤": 2 });
  });
});

describe("战斗引擎（qucuo 模型）", () => {

  it("敌人生成：胆识限制可碰 tier，名字出自白名单池", () => {
    const e1 = genEnemy("gudi", 2, 42);
    expect(e1.tier).toBeLessThanOrEqual(2);
    expect(DUNGEON_ENEMIES.gudi.map(x => x.name)).toContain(e1.name);
    const e2 = genEnemy("caoyuan", 5, 42);
    expect(e2.tier).toBeLessThanOrEqual(5);
  });

  it("回合结算：攻击造成伤害，敌人 HP 下降", () => {
    const f = buildFighter({ waigong: 2, neigong: 1 });
    const e = genEnemy("digong", 2, 7);
    const rng = mulberry32(1);
    const r = battleTurn(f, e, { type: "attack", power: 1 }, { type: "attack", power: 1 }, rng);
    expect(r.eHp).toBeLessThan(e.maxHp);
    expect(Array.isArray(r.log)).toBe(true);
  });

  it("防御减伤：受伤比平砍小", () => {
    const f1 = buildFighter({ waigong: 1 });
    const f2 = buildFighter({ waigong: 1 });
    const e = genEnemy("digong", 2, 7);
    const r1 = battleTurn(f1, { ...e }, { type: "attack" }, { type: "attack", power: 1.3 }, mulberry32(5));
    const r2 = battleTurn(f2, { ...e }, { type: "defend" }, { type: "attack", power: 1.3 }, mulberry32(5));
    expect(r2.pHp).toBeGreaterThanOrEqual(r1.pHp);
  });

  it("低血敌人胜出 → win=true；战利品出自该敌人白名单", () => {
    const f = buildFighter({ waigong: 5, skills: [{ id: "kf_rec_langqu", name: "狼曲饮雪", healHp: 0.08 }] });
    const e = { ...genEnemy("digong", 2, 7), hp: 1 };
    const r = battleTurn(f, e, { type: "attack", power: 1 }, { type: "attack", power: 1 }, mulberry32(2));
    expect(r.win).toBe(true);
    const loot = battleLoot(e, mulberry32(3));
    for (const it of loot) expect(e.loot).toContain(it);
  });

  it("败北：玩家 HP 归零 → lose=true", () => {
    const f = buildFighter({ waigong: 1 });
    f.hp = 1;
    const e = genEnemy("gudi", 2, 7);
    const r = battleTurn(f, e, { type: "attack" }, { type: "attack", power: 1 }, mulberry32(4));
    expect(r.lose).toBe(true);
  });
});

describe("AI 敌人生成（AI 只填皮，数值系统裁决）", () => {

  it("AI 给名字/描述 → 敌人卡数值全走系统（tier≤胆识、属性公式、loot 白名单）", () => {
    const fb = { tier: 2, maxHp: 34, atk: 6, def: 1, loot: ["天都镇酱油", "玉泉寨土豆"], desc: "兜底" };
    const enemy = resolveEnemyAI("digong", 2, 42, {
      name: "蒙面夜枭", desc: "一身夜行衣，只露一双眼睛。", feature: "残血时狂暴", line: "留下买路财！",
    }, fb);
    expect(enemy.from).toBe("AI");
    expect(enemy.name).toBe("蒙面夜枭");
    expect(enemy.tier).toBeLessThanOrEqual(2);
    expect(enemy.maxHp).toBe(fb.maxHp);
    expect(enemy.atk).toBe(fb.atk);
    for (const it of enemy.loot) expect(DUNGEON_ENEMIES.digong.flatMap(e => e.loot)).toContain(it);
  });

  it("AI 没给名字 → 静默落白名单兜底", () => {
    const fb = { tier: 2, maxHp: 34, atk: 6, def: 1, loot: [], desc: "兜底" };
    const enemy = resolveEnemyAI("digong", 2, 42, { desc: "没有名字" }, fb);
    expect(enemy.from).toBe("白名单");
  });

  it("AI 名字过长/含数字 → 截断与清洗后仍合法", () => {
    const fb = { tier: 3, maxHp: 50, atk: 9, def: 2, loot: [], desc: "兜底" };
    const enemy = resolveEnemyAI("gudi", 3, 7, { name: "熊山千年老妖王熊二（血量9999）" }, fb);
    expect(enemy.name.length).toBeLessThanOrEqual(8);
    expect(typeof enemy.maxHp).toBe("number");
  });
});

describe("AGI 出餐裁决（aiDish）", () => {

  it("味型永远出自 24 味型白名单", () => {
    const ALL = Object.values(TASTES).flat();
    for (let i = 1; i < 20; i++) {
      const { taste } = rollTaste(["牦牛腱子肉", "贡措海盐"], mulberry32(i));
      expect(ALL).toContain(taste);
    }
  });

  it("妙手偶得数值：品质 4+、档次随成本、成本=材料合计", () => {
    const v = rollFreestyleValue(["牦牛腱子肉", "贡措海盐", "熊山松茸"], 3, 42);
    expect(v.quality).toBeGreaterThanOrEqual(4);
    expect(v.cost).toBe(8 + 1 + 6);
    expect(["家常", "精致", "宴席"]).toContain(v.tier);
  });

  it("固定配方命中判定：材料不分先后", () => {
    expect(matchRecipe(["贡措海盐", "牦牛腱子肉"], "炖")).toEqual(matchRecipe(["牦牛腱子肉", "贡措海盐"], "炖"));
    expect(matchRecipe(["牦牛腱子肉", "贡措海盐"], "炖")?.name).toBe("牦牛骨汤");
  });
});

describe("NPC 对话接口（精简 qucuo act 对话模式）", () => {

  it("对话对象池：16 位熟客全可对话，白天店堂在场优先标注", () => {
    const day = { tables: [{ guest: { name: "才旦" } }, { guest: { name: "老孙" } }, null] };
    const targets = chatTargets({ favors: {} }, day);
    expect(targets).toHaveLength(16);
    expect(targets.find(t => t.name === "才旦").where).toBe("店堂");
    expect(targets.find(t => t.name === "老猎户").where).toBe("可登门");
  });

  it("对话命令解析：对话 X / 和X说 / 问X 都认", () => {
    expect(parseChatCommand("对话 老猎户")?.name).toBe("老猎户");
    expect(parseChatCommand("和老猎户说话 爱吃什么")?.name).toBe("老猎户");
    expect(parseChatCommand("老猎户")?.name).toBe("老猎户");
  });

  it("模板回应：带 NPC 人设与口味线索，好感按态度涨", () => {
    const npc = { ...REGULARS.find(r => r.name === "老猎户"), favor: 0 };
    const msg = templateChat(npc, "近来可好", "店堂");
    expect(msg.who).toBe("老猎户");
    expect(msg.text).toContain("厚重"); // 口味线索（味型）
    expect(chatFavorDelta(npc, "热情")).toBe(2);
    expect(chatFavorDelta(npc, "不耐烦")).toBe(0);
  });
});
