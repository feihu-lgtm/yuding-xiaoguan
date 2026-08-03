// ============================================================================
// 鱼定村小馆 · 第一个垂直切片
// 流程：备菜(PREP) → 白天(DAY 3时段) → 夜晚(NIGHT 4行动点) → 日结(SUMMARY)
// ============================================================================
import { useState, useEffect, useRef } from "react";
import {
  INGREDIENTS, RECIPES, START_INVENTORY, START_CASH, START_RECIPES,
  recipeCost, recipePriceRange, mulberry32,
} from "./engine/data.js";
import { genDayGuests, REGULARS } from "./engine/guestEngine.js";
import { makePrep, prepCost } from "./engine/prepEngine.js";
import { initDay, tick, buildRecipeMap, serveDish, daySeconds } from "./engine/dayEngine.js";
import { knownSummary } from "./engine/tasteProbe.js";
import { buildFighter, battleTurn, enemyChooseMove, battleLoot } from "./engine/battleEngine.js";
import { genEnemyAI } from "./engine/aiEnemy.js";
import { genFreestyleDish } from "./engine/aiDish.js";
import { loadApiCfg, saveApiCfg, hasApi } from "./engine/aiClient.js";
import { genDayReport, templateReport } from "./engine/dayReport.js";
import DevelopScreen from "./ui/DevelopScreen.jsx";
import ExtractionScreen from "./ui/ExtractionScreen.jsx";
import TerminalScreen from "./ui/TerminalScreen.jsx";
import { newStove, runCommand } from "./engine/terminalEngine.js";
import { chatTargets } from "./engine/npcChat.js";
import { initExtraction, extractionAction, applyBattleResult } from "./engine/extractionEngine.js";
import { SKILLS, WEAPONS, ARMORS, teachPrice, trainPotency, cultivate } from "./engine/kungfuData.js";
import { runDungeon, DUNGEONS, developDish, freestyleDish, NIGHT_AP, shopBuy } from "./engine/nightEngine.js";
import { settleDay, checkBankrupt, mergeFavor } from "./engine/economy.js";
import "./style.css";

const PHASE = { PREP: "PREP", DAY: "DAY", NIGHT: "NIGHT", SUMMARY: "SUMMARY" };

function newGame() {
  return {
    dayIdx: 0,
    cash: START_CASH,
    reputation: 20,
    inventory: { ...START_INVENTORY },
    recipes: [...START_RECIPES],
    customRecipes: [], // 妙手偶得研发出的自定义菜
    favors: {},
    netHistory: [],
    player: {
      hp: 50, neigong: 1, waigong: 1, pot: 0, brav: 2,
      skills: [], weapon: null, armor: null,
    },
    phase: PHASE.PREP,
  };
}

// 存档读档（版本号 + 缺字段兜底；phase 强制从备菜开始，跨天继续）
function loadGame() {
  try {
    const raw = localStorage.getItem("yuding_save");
    if (!raw) return newGame();
    const saved = JSON.parse(raw);
    const g = { ...newGame(), ...saved, inventory: { ...newGame().inventory, ...(saved.inventory || {}) } };
    g.phase = PHASE.PREP;
    g.player = { ...newGame().player, ...(saved.player || {}) };
    return g;
  } catch {
    return newGame();
  }
}

export default function App() {
  const [game, setGame] = useState(() => loadGame());
  const [dayState, setDayState] = useState(null);
  const [night, setNight] = useState(null);
  const [summary, setSummary] = useState(null);
  const [prepSelections, setPrepSelections] = useState({});
  const [prepPrices, setPrepPrices] = useState({});
  const [speed, setSpeed] = useState(1100);
  const [nightLog, setNightLog] = useState([]);

  // 存档：每天日结后落盘（localStorage，量小单档）
  useEffect(() => {
    if (game) localStorage.setItem("yuding_save", JSON.stringify(game));
  }, [game]);

  const restart = () => {
    localStorage.removeItem("yuding_save");
    setGame(newGame());
    setDayState(null); setNight(null); setSummary(null); setPrepSelections({}); setPrepPrices({});
  };

  const resetPrep = () => {
    const menu = [...game.recipes.map(n => RECIPES.find(r => r.name === n)), ...game.customRecipes].filter(Boolean).slice(0, 4);
    const sel = {}, prices = {};
    for (const r of menu) {
      const range = recipePriceRange(r);
      sel[r.name] = 3;
      prices[r.name] = Math.round((range.min + range.max) / 2);
    }
    setPrepSelections(sel);
    setPrepPrices(prices);
  };

  // 进入白天
  const startDay = () => {
    const slots = genDayGuests(game.dayIdx, game.reputation);
    const prepRes = makePrep(game.inventory, { ...prepSelections });
    const d = initDay(game.dayIdx, slots, { ...prepRes.prep }, { ...prepPrices }, { recipesMap: buildRecipeMap(game.customRecipes) });
    setGame(g => ({ ...g, inventory: prepRes.inventory }));
    setDayState(d);
    setGame(g => ({ ...g, phase: PHASE.DAY }));
  };

  // 手动派餐
  const serve = (tableIdx, dishName) => {
    console.log("[serve]", tableIdx, dishName, "price:", prepPrices[dishName]);
    setDayState(s => {
      const next = s ? serveDish(s, tableIdx, dishName, prepPrices[dishName]) : s;
      console.log("[serve] table state:", next?.tables[tableIdx]?.state, "| lastLog:", next?.log?.slice(-1)[0]);
      return next;
    });
  };

  // 白天 tick 自动推进
  const running = game.phase === PHASE.DAY && dayState && !dayState.done;
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setDayState(s => (s ? tick(s) : s)), speed);
    return () => clearInterval(iv);
  }, [running, speed]);

  // 白天结束 → 进入夜晚
  useEffect(() => {
    if (dayState?.done && game.phase === PHASE.DAY) {
      setNight({ ap: NIGHT_AP, log: [] });
      setNightLog([]);
      setGame(g => ({ ...g, phase: PHASE.NIGHT }));
    }
  }, [dayState, game.phase]);

  const endNight = () => {
    // 日结（睡前气血恢复；战斗败过则次日客流 -10%）
    const revenue = dayState?.cash || 0;
    const foodCost = Object.entries(prepSelections).reduce((s, [d, c]) => s + prepCost(d, c), 0);
    const settled = settleDay({ cash: game.cash, revenue, foodCost, reputation: game.reputation });
    const bankrupt = checkBankrupt([...game.netHistory, settled.net], settled.cash);
    const hurt = battle?.win === false ? 0.1 : 0;
    setSummary({ ...settled, bankrupt, sales: dayState?.sales || [], hurt });
    setGame(g => ({
      ...g,
      cash: settled.cash, // 打烊即结算，账目当场入袋
      player: { ...g.player, hp: 50 + g.player.waigong * 15 }, // 睡一觉满血
      phase: PHASE.SUMMARY,
    }));
    setReport(null);
    genDayReport(dayState, { gross: revenue, net: settled.net }, game.dayIdx).then(r => setReport(r));
  };

  const nextDay = () => {
    setGame(g => ({
      ...g,
      dayIdx: g.dayIdx + 1,
      cash: summary.cash,
      reputation: Math.max(0, Math.min(100, g.reputation + (dayState?.reputationDelta || 0))),
      netHistory: [...g.netHistory, summary.net].slice(-7),
      phase: PHASE.PREP,
    }));
    setDayState(null);
    setNight(null);
    setSummary(null);
    resetPrep();
  };

  // 夜晚行动
  const [battle, setBattle] = useState(null); // { dungeon, enemy, log, over, loading }
  const [extraction, setExtraction] = useState(null); // 搜打撤状态
  const [apiOpen, setApiOpen] = useState(false);
  const [report, setReport] = useState(null); // 每日 AI 报告
  const [view, setView] = useState("ui"); // ui | terminal（主叙事）
  const [termMsgs, setTermMsgs] = useState([]);
  const [termBusy, setTermBusy] = useState(false);
  const stoveRef = useRef(newStove());

  // 副本 → 搜打撤（大本营 → 多层热区）
  const actDungeon = (d) => {
    if (night.ap < d.ap) return;
    setNight(n => ({ ...n, ap: n.ap - d.ap }));
    setExtraction(initExtraction(d.id, game.player.brav, game.dayIdx * 31 + Date.now() % 997));
  };

  // 搜打撤动作
  const extAction = (action, salt = Date.now() % 997) => {
    setExtraction(s => {
      if (!s || s.over) return s;
      const res = extractionAction(s, action, salt);
      if (res.event === "遇敌") {
        // 生成敌人并开战
        (async () => {
          const need = Object.entries(game.inventory).filter(([, c]) => c <= 0).map(([n]) => n);
          const d = DUNGEONS.find(x => x.id === s.dungeonId);
          const enemy = await genEnemyAI(d, s.brav, s.seed + s.layer * 7 + Date.now() % 997, need);
          setBattle({
            dungeon: d, enemy, fighter: buildFighter(game.player), over: false, win: false,
            fromExtraction: true,
            log: [`${res.state.log[res.state.log.length - 1]}`],
          });
        })();
      }
      if (res.event === "超时") {
        // 战利品丢一半入袋
        setTimeout(() => claimLoot(res.state), 0);
      }
      return res.state;
    });
  };

  // 撤离兑现（战利品入袋）
  const claimLoot = (st) => {
    if (!st?.loot?.length) return;
    setGame(g => {
      const inv = { ...g.inventory };
      for (const it of st.loot) inv[it] = (inv[it] || 0) + 1;
      return { ...g, inventory: inv };
    });
  };
  const extExtract = () => {
    setExtraction(s => {
      if (!s || s.over) return s;
      const res = extractionAction(s, "extract", Date.now() % 997);
      setTimeout(() => claimLoot(res.state), 0);
      return res.state;
    });
  };

  // 战斗结束：若来自搜打撤 → 回到搜打撤并结算胜负
  const onBattleOver = (win) => {
    if (battle?.fromExtraction) {
      setExtraction(s => s ? applyBattleResult(s, win) : s);
      setBattle(null);
    } else {
      setBattle(null);
    }
  };

  // 战斗回合
  const battleAct = (moveType, skillId) => {
    setBattle(b => {
      if (!b || b.over) return b;
      const pMove = moveType === "skill"
        ? { type: "skill", skill: b.fighter.skills.find(s => s.id === skillId) }
        : { type: moveType, power: moveType === "attack" ? 1.0 : 0.5 };
      const rng = mulberry32(game.dayIdx * 1000 + Date.now() % 997 + b.log.length);
      const eMove = enemyChooseMove(b.enemy, rng);
      const res = battleTurn(b.fighter, b.enemy, pMove, eMove, rng);
      const log = [...b.log, ...res.log];
      if (res.win) {
        const loot = battleLoot(b.enemy, rng, Object.keys(game.inventory).filter((_, i) => i < 3));
        log.push(`「${b.enemy.name}」轰然倒地。`);
        setTimeout(() => {
          setGame(g => {
            const inv = { ...g.inventory };
            for (const it of loot) inv[it] = (inv[it] || 0) + 1;
            return { ...g, inventory: inv };
          });
        }, 0);
        return { ...b, fighter: { ...b.fighter, hp: res.pHp }, enemy: { ...b.enemy, hp: res.eHp }, log, over: true, win: true, loot };
      }
      if (res.lose) {
        log.push("你力竭倒地，被巡夜的/野兽拖出了险地。明日怕是要歇一日。");
        return { ...b, fighter: { ...b.fighter, hp: 1 }, enemy: { ...b.enemy, hp: res.eHp }, log, over: true, win: false };
      }
      return { ...b, fighter: { ...b.fighter, hp: res.pHp, energy: res.pEnergy }, enemy: { ...b.enemy, hp: res.eHp }, log };
    });
  };

  // 研发（固定配方）
  const actDevelop = (dishName) => {
    if (night.ap < 1) return;
    const r = developDish(game.inventory, dishName, "炖");
    if (r.ok) {
      if (!game.recipes.includes(dishName)) {
        setGame(g => ({ ...g, recipes: [...g.recipes, dishName], inventory: r.inventory }));
        setNightLog(l => [...l, `研发成功：学会了「${dishName}」`]);
      } else {
        setGame(g => ({ ...g, inventory: r.inventory }));
        setNightLog(l => [...l, `复刻「${dishName}」一份`]);
      }
    } else {
      setNightLog(l => [...l, `研发失败：${r.reason}`]);
    }
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };
  const actFreestyle = () => {
    if (night.ap < 1) return;
    const mats = ["大草甸蘑菇", "贡措海盐"];
    const r = freestyleDish(game.inventory, mats, { cuisine: 2 });
    setNightLog(l => [...l, r.success ? `妙手偶得：出了一道「${r.name}」(${r.taste}·品质${r.quality})` : `妙手偶得：${r.reason}`]);
    if (r.ok && r.success) {
      setGame(g => ({ ...g, inventory: r.inventory }));
    }
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };

  // 武馆买秘籍（银两，1 行动点）
  const actBuySkill = (sk) => {
    if (night.ap < 1 || game.cash < sk.price) return;
    setGame(g => ({
      ...g, cash: g.cash - sk.price,
      player: { ...g.player, skills: [...g.player.skills, sk] },
    }));
    setNightLog(l => [...l, `购得秘籍「${sk.name}」（${sk.quality}品·${sk.price}文），挑灯夜读，记在心中`]);
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };

  // 拜师（好感≥40 的熟客，折价）
  const actTeach = (reg) => {
    if (night.ap < 1) return;
    const base = SKILLS.filter(s => s.quality === "绿")[0];
    const price = teachPrice(base.price, game.favors[reg.id] || 0);
    if (game.cash < price) { setNightLog(l => [...l, `拜师束脩要 ${price} 文，囊中羞涩`]); return; }
    setGame(g => ({
      ...g, cash: g.cash - price,
      player: { ...g.player, skills: [...g.player.skills, { ...base, name: `${reg.name}传授·${base.name}` }] },
    }));
    setNightLog(l => [...l, `${reg.name} 念你诚心，授了一手「${base.name}」（束脩 ${price} 文）`]);
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };

  // 练功 → 潜能
  const actTrain = () => {
    if (night.ap < 1) return;
    const gain = trainPotency(game.player.brav);
    setGame(g => ({ ...g, player: { ...g.player, pot: g.player.pot + gain } }));
    setNightLog(l => [...l, `夜里苦练两个时辰，收获 ${gain} 点潜能`]);
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };

  // 修炼：潜能 → 外功/内功
  const actCultivate = (stat) => {
    if (night.ap < 1) return;
    const r = cultivate(game.player.pot, 3);
    if (!r.ok) { setNightLog(l => [...l, `修炼失败：${r.reason}`]); return; }
    setGame(g => ({
      ...g,
      player: {
        ...g.player, pot: r.pot,
        [stat]: g.player[stat] + r.gain,
        brav: Math.max(g.player.brav, 1 + g.player.waigong + 1),
      },
    }));
    setNightLog(l => [...l, `运功修炼，${stat === "waigong" ? "外功" : "内功"} +1（潜能 −3）`]);
    setNight(n => ({ ...n, ap: n.ap - 1 }));
  };

  const actShop = () => {
    const r = shopBuy(game.cash, game.dayIdx * 71 + Date.now() % 997);
    if (!r.ok) { setNightLog(l => [...l, `采购失败：${r.reason}`]); return; }
    setGame(g => {
      const inv = { ...g.inventory };
      for (const it of r.items) inv[it] = (inv[it] || 0) + 1;
      return { ...g, inventory: inv, cash: r.cash };
    });
    setNightLog(l => [...l, `采购：花 40 文，买到 ${r.items.join("、")}`]);
  };

  // 主叙事终端：研发命令 + NPC 对话（busy 必须有 finally 兜底，否则一次报错永久卡死"不理人"）
  const doRunTerm = async (line) => {
    const r = await runCommand(stoveRef.current, line, {
      inventory: game.inventory,
      cuisine: 2,
      dayIdx: game.dayIdx,
      chatTargets: () => chatTargets(game, dayState),
      onFavor: (id, delta) => setGame(g => ({ ...g, favors: { ...g.favors, [id]: (g.favors[id] || 0) + delta } })),
      onCooked: ({ dish, inventory }) => {
        setGame(g => {
          let recipes = g.recipes, customs = g.customRecipes;
          if (dish.from === "配方") {
            if (!recipes.includes(dish.name)) recipes = [...recipes, dish.name];
          } else {
            customs = [...customs, { name: dish.name, technique: dish.technique, materials: dish.materials || [], taste: dish.taste, tier: dish.tier, desc: dish.desc, from: dish.from }];
          }
          return { ...g, inventory, recipes, customRecipes: customs };
        });
        if (game.phase === PHASE.NIGHT) {
          setNight(n => ({ ...n, ap: n.ap - 1 })); // 开火扣 1 行动点
        }
      },
    });
    setTermMsgs(ms => [...ms, r.msg]);
    if (r.chat) {
      setTermMsgs(ms => [...ms, { text: `（${r.chat.npc} 对你的好感升至 ${r.chat.favor}）`, who: "说书人", scene: "店堂", mood: "平静" }]);
    }
    if (r.dish?.from === "配方" && !game.recipes.includes(r.dish.name)) {
      setTermMsgs(ms => [...ms, { text: `「${r.dish.name}」记进了你的菜谱。`, who: "说书人", scene: "灶房", mood: "满意" }]);
    } else if (r.dish) {
      setTermMsgs(ms => [...ms, { text: `「${r.dish.name}」记进了你的菜谱。`, who: "说书人", scene: "灶房", mood: "惊喜" }]);
    }
  };
  const runTerm = async (line) => {
    setTermMsgs(ms => [...ms, { text: line, who: "你", scene: "灶房", mood: "认真" }]);
    setTermBusy(true);
    try {
      await doRunTerm(line);
    } catch (e) {
      setTermMsgs(ms => [...ms, { text: `说书人愣了一下（${e?.message || "出岔子了"}）。`, who: "说书人", scene: "灶房", mood: "疑惑" }]);
    } finally {
      setTermBusy(false); // 无论如何解锁输入框
    }
  };

  // 退出战斗（回夜晚屏，不结束夜晚）
  const exitBattle = () => setBattle(null);

  // 研发台出餐：扣库存、扣 1 行动点；固定配方学菜 / 妙手偶得 AI 起名入自定义菜谱
  const [devOpen, setDevOpen] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const devCook = async ({ materials, technique, cookware, freestyle, recipe }) => {
    if (night.ap < 1) { setDevOpen(false); return; }
    setDevBusy(true);
    const inv = { ...game.inventory };
    for (const m of materials) inv[m] = (inv[m] || 1) - 1;
    setNight(n => ({ ...n, ap: n.ap - 1 }));
    try {
      if (recipe && !game.recipes.includes(recipe.name)) {
        setGame(g => ({ ...g, inventory: inv, recipes: [...g.recipes, recipe.name] }));
        setNightLog(l => [...l, `研发成功：学会了「${recipe.name}」`]);
      } else if (freestyle) {
        const dish = await genFreestyleDish(materials, technique.id, cookware, 2, game.dayIdx * 977 + Date.now() % 997);
        const custom = {
          name: dish.name, technique: technique.id, materials, taste: dish.taste, tier: dish.tier, desc: dish.desc,
          cost: dish.cost, from: dish.from,
        };
        setGame(g => ({ ...g, inventory: inv, customRecipes: [...g.customRecipes, custom] }));
        setNightLog(l => [...l, `妙手偶得${dish.from === "AI" ? "（说书人赐名）" : ""}：「${dish.name}」——${dish.desc}`]);
      } else {
        setGame(g => ({ ...g, inventory: inv })); // 复刻
        setNightLog(l => [...l, `复刻「${recipe.name}」`]);
      }
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <span>🐟 鱼定村小馆</span>
        <span>第 {game.dayIdx + 1} 天</span>
        <span>💰 {game.cash} 文</span>
        <span>声望 {game.reputation}</span>
        <span className="phase">{PHASE_LABEL[game.phase]}</span>
        <button className="mini-btn" onClick={() => setView(v => (v === "ui" ? "terminal" : "ui"))}>
          {view === "ui" ? "📜 主叙事" : "🗔 外部 UI"}
        </button>
        <button className="mini-btn" onClick={() => setApiOpen(true)}>⚙ AI</button>
        <button className="mini-btn" onClick={restart}>↺ 重开</button>
      </header>
      {apiOpen && <ApiSettings onClose={() => setApiOpen(false)} />}

      {game.phase === PHASE.PREP && (
        <PrepScreen
          game={game} sel={prepSelections} prices={prepPrices}
          setSel={setPrepSelections} setPrices={setPrepPrices}
          onStart={startDay} onInit={resetPrep}
        />
      )}
      {game.phase === PHASE.DAY && dayState && (
        <DayScreen
          day={dayState} speed={speed} setSpeed={setSpeed}
          setPrices={setPrepPrices} prices={prepPrices}
          onServe={serve}
        />
      )}
      {game.phase === PHASE.NIGHT && (
        <NightScreen
          night={night} log={nightLog} game={game} battle={battle}
          onDungeon={actDungeon} onBattleAct={battleAct}
          onShop={actShop} onBuySkill={actBuySkill} onTeach={actTeach}
          onTrain={actTrain} onCultivate={actCultivate}
          onOpenDev={() => setDevOpen(true)}
          onBattleOver={onBattleOver} onEnd={endNight}
        />
      )}
      {view === "terminal" && !battle && (
        <TerminalScreen msgs={termMsgs} onCommand={runTerm} busy={termBusy}
          hint="对话 老猎户 ｜ 放料 X Y ｜ 技法 炖 ｜ 开火" />
      )}
      {game.phase === PHASE.NIGHT && !battle && extraction && (
        <ExtractionScreen state={extraction}
          dungeon={DUNGEONS.find(x => x.id === extraction.dungeonId)}
          onSearch={() => extAction("search")}
          onDeeper={() => extAction("deeper")}
          onExtract={extExtract}
          onFight={() => extAction("deeper")} />
      )}
      {game.phase === PHASE.NIGHT && devOpen && (
        <DevelopScreen inventory={game.inventory} cuisine={2} busy={devBusy}
          onCook={devCook} onClose={() => setDevOpen(false)} />
      )}
      {game.phase === PHASE.SUMMARY && summary && (
        <SummaryScreen summary={summary} day={dayState} report={report} onNext={nextDay} />
      )}
    </div>
  );
}

const PHASE_LABEL = { PREP: "卯时·备菜", DAY: "营业中", NIGHT: "入夜", SUMMARY: "子时·日结" };

// ── 备菜屏 ──────────────────────────────────────────────────────────────
function PrepScreen({ game, sel, prices, setSel, setPrices, onStart, onInit }) {
  const menu = [...game.recipes.map(n => RECIPES.find(r => r.name === n)), ...game.customRecipes].filter(Boolean);
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (!touched) { onInit(); setTouched(true); } }, []);
  useEffect(() => { if (!selected && menu.length) setSelected(menu[0].name); }, [menu.length, selected]);
  const stock = Object.entries(game.inventory).filter(([, c]) => c > 0);
  const cur = menu.find(r => r.name === selected) || menu[0];
  const range = cur ? recipePriceRange(cur) : null;
  const armed = Object.values(sel).filter(c => c > 0).length;
  return (
    <div className="screen prep-screen">
      <h2>🌅 卯时 · 备菜 <span className="dim" style={{ fontSize: 12 }}>选菜押份数——押少缺货，押多腐坏。已选 {armed}/4 道。</span></h2>
      <div className="prep-layout">
        {/* 左 3：选择 + 备量 */}
        <div className="prep-left">
          <h3>🧾 菜单（点击查看详情 · 份数/定价/✕删除）</h3>
          {menu.map(r => {
            const n = r.name;
            const rg = recipePriceRange(r);
            const on = (sel[n] ?? 0) > 0;
            return (
              <div key={n} className={`prep-row ${selected === n ? "sel" : ""} ${on ? "armed" : ""}`} onClick={() => setSelected(n)}>
                <div className="prep-row-name">
                  {n} <span className="tier">[{r.tier}]</span>{r.from === "AI" ? " ✦" : ""}
                </div>
                <div className="prep-row-ctrl" onClick={e => e.stopPropagation()}>
                  <label>份</label>
                  <input type="number" min={0} max={8} value={sel[n] ?? 0}
                    onChange={e => setSel({ ...sel, [n]: Math.max(0, Math.min(8, +e.target.value)) })} />
                  <label>价</label>
                  <input type="number" min={rg.min} max={rg.max} value={prices[n] ?? rg.min}
                    onChange={e => setPrices({ ...prices, [n]: +e.target.value })} />
                  <button className="del-btn" title="删除这道菜" onClick={() => setSel({ ...sel, [n]: 0 })}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        {/* 右 7：详情 */}
        <div className="prep-right">
          {cur && range && (
            <div className="card prep-detail">
              <div className="dish-name">{cur.name} <span className="tier">[{cur.tier}]</span>{cur.from === "AI" ? " ✦ AI研发菜" : ""}</div>
              <div className="dish-meta">味型 {cur.taste} · 技法 {cur.technique} · 档次 {cur.tier}</div>
              <div className="dish-meta">备料：{cur.materials.map(m => `${m}（${INGREDIENTS[m]?.tier || "白"}品·${recipeCost({ materials: [m] })}文）`).join("、")}</div>
              <div className="dish-meta">成本 {recipeCost(cur)}文 · 建议定价 {range.min}-{range.max}文</div>
              <div className="dish-desc">{cur.desc}</div>
              {sel[cur.name] > 0 && (
                <div className="row">
                  <span className="ok">已押 {sel[cur.name]} 份 · 备料成本 {recipeCost(cur) * sel[cur.name]} 文</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* 库存放下面 */}
      <div className="stock-bar">
        <h3>🧺 食材库存</h3>
        <div className="tags">
          {stock.map(([n, c]) => (
            <span className="tag" key={n}>{n} ×{c}</span>
          ))}
        </div>
      </div>
      <button className="big-btn" onClick={onStart}>开门营业 →</button>
    </div>
  );
}

// ── 经营屏（SLG 风格：背景层 + 桌台 + 消息流 + 底部输入）────────────────
// 解析引擎日志 → 消息流 { who, text, mood }（说书人 / 客人）
function parseLogToMsg(line) {
  const m = line.match(/^\[[^\]]*\]\s*(.*)$/);
  const text = m ? m[1] : line;
  const guest = text.match(/^([\u4e00-\u9fff·]{2,6})\s(?:落座|吃毕|见菜牌|看了眼|的「)/);
  if (guest) {
    return { who: guest[1], text, mood: text.includes("好评") ? "😋" : text.includes("差评") ? "😠" : "😐" };
  }
  if (text.startsWith("——")) return { who: "说书人", text, mood: "📖" };
  if (text.includes("上桌")) return { who: "店小二", text, mood: "🍽" };
  return { who: "说书人", text, mood: "📖" };
}

function DayScreen({ day, speed, setSpeed, onServe }) {
  const queueNames = day.queue.slice(0, 6).map(g => g.name).join("、");
  const [say, setSay] = useState("");
  const [serveTarget, setServeTarget] = useState(null); // 正在派餐的桌号
  const servingDishes = Object.entries(day.prep).filter(([, c]) => c > 0).map(([n]) => n);
  const msgs = day.log.slice(-14).map(parseLogToMsg).map(m => {
    // 把最近的结账 hint 挂到对应消息上
    const lastSale = day.sales[day.sales.length - 1];
    if (lastSale?.hint && m.text.includes(lastSale.guest)) m.hint = lastSale.hint;
    return m;
  });
  const lastGuest = msgs.filter(m => m.who !== "说书人" && m.who !== "店小二").slice(-1)[0];
  const slotNames = ["午市", "晚市", "夜宵"];
  return (
    <div className={`day-layout slot-${day.slotIdx}`}>
      {/* 场景背景层（店堂内景，随时段切换） */}
      <div className="scene-bg">
        <div className="scene-window">☀/🌙 窗</div>
        <div className="scene-tables-hint">🏮 店堂 · {slotNames[day.slotIdx]}</div>
      </div>

      <aside className="leftbar">
        <h3>🍽 菜单（今日份数）</h3>
        {Object.entries(day.prep).map(([d, c]) => (
          <div key={d} className="menu-line">
            <span>{d}</span>
            <span className={c > 0 ? "ok" : "empty"}>{c > 0 ? `×${c}` : "售罄"}</span>
          </div>
        ))}
        <h3>🚪 门口候客</h3>
        <div className="dim">{queueNames || "无人"}</div>
      </aside>

      <main className="floor">
        <div className="slotbar">
          {slotNames[day.slotIdx]} · {daySeconds(day)}s/360s
          <label className="speed">速度
            <input type="range" min={500} max={2500} step={100} value={speed}
              onChange={e => setSpeed(+e.target.value)} />
          </label>
        </div>
        <div className="tables">
          {day.tables.map((tb, i) => {
            const known = tb?.guest?.known ? knownSummary(tb.guest.known) : null;
            return (
            <div className={`table ${tb ? "occupied" : ""}`} key={i}>
              {tb ? (
                <>
                  <div className="t-name">{tb.guest.name}</div>
                  <div className="t-taste">预算:{tb.guest.pay}文 · 耐心:{tb.guest.patience}</div>
                  {known && (known.confirmed.length || known.candidate.length || known.excluded.length) ? (
                    <div className="t-known">
                      {known.confirmed.map((c, k) => <span key={k} className="known-yes">✓{c}</span>)}
                      {known.candidate.slice(0, 2).map((c, k) => <span key={k} className="known-maybe">?{c}</span>)}
                      {known.excluded.slice(0, 2).map((c, k) => <span key={k} className="known-no">✗{c}</span>)}
                    </div>
                  ) : tb.state === "waiting" ? (
                    <div className="t-unknown">??? 口味成谜——试一道菜</div>
                  ) : null}
                  <div className="t-dish">
                    {tb.state === "waiting" ? (
                      <button className="serve-btn" onClick={() => setServeTarget(i)}>🖐 派餐</button>
                    ) : tb.state === "烹饪" ? (
                      `烹饪「${tb.dish}」(t${tb.waitTicks})`
                    ) : tb.state === "用餐" ? (
                      `用餐「${tb.dish}」`
                    ) : tb.state === "评价" ? (
                      <div className={`verdict-flip ${tb.verdict === "好评" ? "good" : tb.verdict === "差评" ? "bad" : ""}`}>
                        {tb.verdict === "好评" ? "😋 好评" : tb.verdict === "差评" ? "😠 差评" : "😐 中评"}
                      </div>
                    ) : null}
                  </div>
                  {tb.state === "waiting" && <div className={`t-state ${tb.waitTicks * 3 > 90 ? "angry" : ""}`}>
                    配餐倒计时 {Math.max(0, Math.ceil(90 - tb.waitTicks * 3))}s
                  </div>}
                </>
              ) : (
                <div className="t-empty">空桌 {i + 1}</div>
              )}
            </div>
          );})}
        </div>
      </main>

      <aside className="rightbar">
        <h3>💰 今日营收</h3>
        <div className="big-num">{day.cash} 文</div>
        <h3>📊 结算</h3>
        <div className="stats">
          <div>好评 {day.sales.filter(s => s.verdict === "好评").length}</div>
          <div>中评 {day.sales.filter(s => s.verdict === "中评").length}</div>
          <div>差评 {day.sales.filter(s => s.verdict === "差评").length}</div>
          <div>声望 Δ{day.reputationDelta > 0 ? "+" : ""}{day.reputationDelta}</div>
        </div>
        <h3>👤 本店声誉</h3>
        <div className="dim">食客喜爱度：看吃客的脸色行事</div>
      </aside>

      {/* 派餐弹层：手动给客人上菜 */}
      {serveTarget !== null && (
        <div className="serve-modal" onClick={() => setServeTarget(null)}>
          <div className="serve-panel" onClick={e => e.stopPropagation()}>
            <h3>🖐 给 {day.tables[serveTarget]?.guest?.name} 派菜</h3>
            <div className="dim">TA 的口味你还不知道——试一道菜，看 TA 给好评还是差评，慢慢扒出喜好。</div>
            {servingDishes.map(n => (
              <button key={n} className="list-btn" onClick={() => { onServe(serveTarget, n); setServeTarget(null); }}>
                {n}（剩 {day.prep[n]} 份）
              </button>
            ))}
            {!servingDishes.length && <div className="dim">今日份数售罄了——明早多押点。</div>}
            <button className="list-btn" onClick={() => setServeTarget(null)}>算了</button>
          </div>
        </div>
      )}

      {/* SLG 消息流（姬侠传式：说话者|表情|正文）+ 立绘 + 底部输入 */}
      <div className="mud-stream">
        <div className="mud-scroll">
          {msgs.map((m, i) => (
            <div key={i} className={`mud-msg ${m.who === "说书人" ? "narrator" : "guest"}`}>
              <span className="mud-avatar">{m.mood}</span>
              <span className="mud-who">{m.who}</span>
              <span className="mud-text">
                {m.text.replace(/^([\u4e00-\u9fff·]{2,6})\s/, "")}
                {m.hint && <span className="probe-hint">{m.hint}</span>}
              </span>
            </div>
          ))}
        </div>
        {/* 立绘层（当前说话的客人，大立绘在前） */}
        {lastGuest && (
          <div className="mud-portrait">
            <div className="mud-portrait-avatar">{lastGuest.mood}</div>
            <div className="mud-portrait-name">{lastGuest.who}</div>
          </div>
        )}
        <div className="mud-input-row">
          <input
            value={say}
            placeholder="对店堂说点什么…（AI 应答 P3 接入）"
            onChange={e => setSay(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && say.trim()) {
                day.log.push(`[你说] ${say.trim()}`);
                setSay("");
              }
            }}
          />
          <button className="mini-btn" onClick={() => {
            if (say.trim()) { day.log.push(`[你说] ${say.trim()}`); setSay(""); }
          }}>说</button>
        </div>
      </div>
    </div>
  );
}

// ── 夜晚屏 ──────────────────────────────────────────────────────────────
function NightScreen({ night, log, game, battle, onDungeon, onBattleAct, onShop,
  onBuySkill, onTeach, onTrain, onCultivate, onOpenDev, onBattleOver, onEnd }) {
  const p = game.player;
  const unlearnedSkills = SKILLS.filter(s => !p.skills.some(x => x.id === s.id));
  const teachers = REGULARS.filter(r => (game.favors[r.id] || 0) >= 40 && r.role === "村民");

  // 战斗模式
  if (battle) {
    if (battle.loading) {
      return (
        <div className="screen battle">
          <h2>⚔ 夜战 · {battle.dungeon.name}</h2>
          <div className="card">
            <div className="dim">夜色沉沉，你摸进{battle.dungeon.place}……</div>
            <div className="hint">深处传来窸窣声，是什么在等着你……</div>
          </div>
        </div>
      );
    }
    return (
      <div className="screen battle">
        <h2>⚔ 夜战 · {battle.dungeon.name}</h2>
        <div className="battle-cards">
          <div className="card fighter-card">
            <h3>你 · 气血 {battle.fighter.hp}/{battle.fighter.maxHp} · 气 {battle.fighter.energy}/{battle.fighter.maxEnergy}</h3>
            <div className="dim">外功 {battle.fighter.waigong} · 内功 {battle.fighter.neigong} · 攻 {battle.fighter.atk} · 防 {battle.fighter.def}</div>
          </div>
          <div className="card enemy-card">
            <h3>👹 {battle.enemy.name} <span className="tier">[{battle.enemy.tier}品{battle.enemy.from === "AI" ? "·AI" : ""}]</span></h3>
            <div className="dim">{battle.enemy.desc}</div>
            {battle.enemy.feature && <div className="enemy-feature">⚡ {battle.enemy.feature}</div>}
            <div>气血 {battle.enemy.hp}/{battle.enemy.maxHp}</div>
          </div>
        </div>
        <div className="battle-actions">
          {!battle.over ? (
            <>
              <button className="list-btn" onClick={() => onBattleAct("attack")}>⚔ 平砍（1.0x）</button>
              <button className="list-btn" onClick={() => onBattleAct("defend")}>🛡 防御（减伤）</button>
              {battle.fighter.skills.map(s => (
                <button key={s.id} className="list-btn" disabled={battle.fighter.energy < (s.cost || 0)}
                  onClick={() => onBattleAct("skill", s.id)}>
                  ✨ {s.name}（耗气{s.cost || 0}）
                </button>
              ))}
              {!battle.fighter.skills.length && <div className="dim">（尚无招式——去武馆买本秘籍吧）</div>}
            </>
          ) : (
            <div className="battle-end">
              <div className={battle.win ? "ok" : "empty"}>
                {battle.win ? `🏆 大胜！${battle.loot?.join("、") || "空手而归"} 入袋` : "💀 力竭败退，明日客流减一成"}
              </div>
              <button className="list-btn" onClick={() => onBattleOver(battle.win)}>退出战斗</button>
            </div>
          )}
        </div>
        <div className="log battle-log">
          {battle.log.slice(-12).map((l, i) => <div key={i} className="log-line">{l}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="screen night">
      <h2>🌙 入夜 · 行动点 {night.ap}/{NIGHT_AP}</h2>
      <div className="player-strip">
        你：气血 {p.hp} · 外功{p.waigong} 内功{p.neigong} · 潜能{p.pot} · 胆识{p.brav}
        {p.weapon ? ` · ${p.weapon.name}` : ""}{p.armor ? ` · ${p.armor.name}` : ""}
        {p.skills.length ? ` · 会 ${p.skills.map(s => s.name).join("、")}` : " · 两手空空"}
      </div>
      <div className="night-col">
        <div>
          <h3>⛰ 副本（2 点·遇敌即战）</h3>
          {DUNGEONS.map(d => (
            <button key={d.id} className="list-btn" disabled={night.ap < d.ap}
              onClick={() => onDungeon(d)}>
              {d.name}（{d.place}·需胆识{d.brav}）
            </button>
          ))}
          <button className="list-btn" onClick={onShop}>
            🧺 市场采购（不占行动点·40 文·5 件）
          </button>
        </div>
        <div>
          <h3>🥋 武馆买秘籍（1 点）</h3>
          {unlearnedSkills.slice(0, 4).map(s => (
            <button key={s.id} className="list-btn" disabled={night.ap < 1 || game.cash < s.price}
              onClick={() => onBuySkill(s)}>
              「{s.name}」（{s.quality}品·{s.price}文·{s.moveType}）
            </button>
          ))}
          <h3>🧘 修炼（1 点·潜能3）</h3>
          <button className="list-btn" disabled={night.ap < 1} onClick={() => onCultivate("waigong")}>外功 +1（攻↑ 血↑ 胆识↑）</button>
          <button className="list-btn" disabled={night.ap < 1} onClick={() => onCultivate("neigong")}>内功 +1（气↑）</button>
          <button className="list-btn" disabled={night.ap < 1} onClick={onTrain}>
            练功（1 点·得潜能 {trainPotency(p.brav)}）
          </button>
        </div>
        <div>
          <h3>🙏 拜师（好感≥40·1 点）</h3>
          {teachers.slice(0, 3).map(r => (
            <button key={r.id} className="list-btn" disabled={night.ap < 1}
              onClick={() => onTeach(r)}>
              {r.name}（好感{game.favors[r.id] || 0}·束脩{teachPrice(35, game.favors[r.id] || 0)}文）
            </button>
          ))}
          {!teachers.length && <div className="dim">熟客好感还不够——白天多招呼、多投其所好</div>}
          <h3>🔥 研发台（1 点·开火时扣）</h3>
          <button className="list-btn" disabled={night.ap < 1} onClick={onOpenDev}>
            四面体灶 · 自由搭配出菜（AI 起名）
          </button>
          {game.customRecipes.length > 0 && (
            <div className="dim">自研菜谱：{game.customRecipes.map(r => r.name).join("、")}</div>
          )}
        </div>
      </div>
      <div className="log night-log">
        {log.map((l, i) => <div key={i} className="log-line">{l}</div>)}
      </div>
      <button className="big-btn" onClick={onEnd}>打烊 → 子时日结</button>
    </div>
  );
}

// ── 日结屏 ──────────────────────────────────────────────────────────────
function SummaryScreen({ summary, day, report, onNext }) {
  return (
    <div className="screen">
      <h2>🌃 子时 · 日结</h2>
      <div className="summary-grid">
        <div className="card">
          <h3>收支</h3>
          <div>毛收 {summary.gross} 文</div>
          <div>食材成本 {summary.foodCost} 文</div>
          <div>工钱 {summary.wage} + 租金 {summary.rent} 文</div>
          <div className={summary.net >= 0 ? "ok" : "empty"}>
            净利 {summary.net >= 0 ? "+" : ""}{summary.net} 文
          </div>
          <div>现银 {summary.cash} 文</div>
        </div>
        <div className="card">
          <h3>今日食客结算</h3>
          <div className="dim" style={{ marginBottom: 6 }}>谁喜欢 · 谁不喜欢 · 你扒出了什么</div>
          <div className="sale-list">
            {day?.sales.map((s, i) => (
              <div key={i} className={`sale-line ${s.verdict === "好评" ? "ok" : s.verdict === "差评" ? "empty" : ""}`}>
                <span>{s.verdict === "好评" ? "😋" : s.verdict === "差评" ? "😠" : "😐"}</span>
                <span>{s.guest}</span>
                <span className="dim">{s.dish || "没吃上"}</span>
                <span className="dim">{s.score}分</span>
                <span className="dim">{s.amount}文</span>
                {s.confirmed?.length > 0 && <span className="guess">→ 扒出：{s.confirmed.join("、")}</span>}
              </div>
            ))}
          </div>
          {day?.sales.some(s => s.confirmed?.length) ? null : (
            <div className="dim" style={{ marginTop: 6 }}>今天一道偏好都没扒出来——明天多试几道正交的菜。</div>
          )}
        </div>
      </div>
      {summary.bankrupt && (
        <div className="bankrupt">⚠ 连续三日亏损，现银见底——「典当」事件触发了（AGI 叙事占位）</div>
      )}
      <div className="card report-card">
        <h3>📜 说书人夜报</h3>
        {report ? (
          <div className="report-text">
            {report.text}
            {report.from === "AI" && <span className="dim" style={{ display: "block", marginTop: 6 }}>—— 说书人（AI）</span>}
          </div>
        ) : (
          <div className="dim">说书人正在盘点今日账目与食客脸色……</div>
        )}
      </div>
      <button className="big-btn" onClick={onNext}>睡下 → 新的一天</button>
    </div>
  );
}

// ── API 设置浮层（OpenAI 兼容反代站）────────────────────────────────────
function ApiSettings({ onClose }) {
  const [cfg, setCfg] = useState(() => loadApiCfg() || { endpoint: "", apiKey: "", model: "deepseek-v4-flash" });
  const [msg, setMsg] = useState("");
  const save = () => {
    saveApiCfg(cfg);
    setMsg("已保存 ✓（副本敌人将走 AI 生成）");
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card api-card" onClick={e => e.stopPropagation()}>
        <h2>⚙ AI 配置（OpenAI 兼容）</h2>
        <div className="row"><label>接口地址</label>
          <input className="wide" value={cfg.endpoint} placeholder="https://反代站/v1/chat/completions"
            onChange={e => setCfg({ ...cfg, endpoint: e.target.value })} /></div>
        <div className="row"><label>API Key</label>
          <input className="wide" value={cfg.apiKey} placeholder="sk-..."
            onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} /></div>
        <div className="row"><label>模型</label>
          <input className="wide" value={cfg.model} onChange={e => setCfg({ ...cfg, model: e.target.value })} /></div>
        <div className="dim">没配也能玩——敌人/菜名落白名单与规则，AI 是增味不是主料。</div>
        {msg && <div className="ok">{msg}</div>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="list-btn" onClick={save}>保存</button>
          <button className="list-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
