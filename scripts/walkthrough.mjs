// 验收走查：模拟玩家 7 天（智能备菜 + 夜晚副本/采购）
import { genDayGuests } from "../src/engine/guestEngine.js";
import { initDay, tick } from "../src/engine/dayEngine.js";
import { settleDay, checkBankrupt } from "../src/engine/economy.js";
import { makePrep } from "../src/engine/prepEngine.js";
import { runDungeon, DUNGEONS, shopBuy, developDish } from "../src/engine/nightEngine.js";
import { recipeCost, RECIPES, START_INVENTORY } from "../src/engine/data.js";

let cash = 300, rep = 20, inv = { ...START_INVENTORY };
const netHistory = [];
const DAYS = 7;
let recipes = ["牦牛骨汤", "烤藏香猪", "烤黄羊腿", "酸汤裂腹鱼"];

function scoreDish(name, slots) {
  const r = RECIPES.find(x => x.name === name);
  const mats = [name, ...(r?.materials || [])];
  return slots.flat().filter(g => g.likes.some(l => mats.includes(l))).length;
}

for (let d = 0; d < DAYS; d++) {
  const slots = genDayGuests(d, rep);
  const ranked = recipes.slice()
    .map(n => ({ n, s: scoreDish(n, slots) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(x => x.n);
  const prepIn = {};
  for (const name of ranked) {
    const r = RECIPES.find(x => x.name === name);
    let maxByStock = Infinity;
    for (const m of r.materials) maxByStock = Math.min(maxByStock, Math.floor(inv[m] || 0));
    prepIn[name] = Math.max(0, Math.min(maxByStock, 4));
    if (prepIn[name] === 0) delete prepIn[name];
  }
  if (!Object.keys(prepIn).length) { console.log(`D${d+1} 无菜可备，收工`); break; }
  const res = makePrep(inv, { ...prepIn });
  inv = res.inventory;

  const prices = Object.fromEntries(Object.keys(prepIn).map(n => [n, Math.round(recipeCost(RECIPES.find(r => r.name === n)) * 2.0)]));
  let s = initDay(d, slots, { ...res.prep }, prices);
  let guard = 0;
  while (!s.done && guard++ < 200) s = tick(s);

  const revenue = s.cash;
  const foodCost = Object.entries(prepIn).reduce((sum, [n, c]) => sum + recipeCost(RECIPES.find(r => r.name === n)) * c, 0);
  const settled = settleDay({ cash, revenue, foodCost, reputation: rep });
  netHistory.push(settled.net);
  cash = settled.cash;
  rep = Math.max(0, Math.min(100, rep + s.reputationDelta));

  // 夜晚 4 点：副本(2，need=今日耗材) + 采购(市场，不占点，买到银两不足)
  const need = [...new Set(Object.keys(prepIn).flatMap(n => RECIPES.find(r => r.name === n).materials))];
  const brav = 2 + Math.floor(d / 2);
  const dungeon = DUNGEONS[Math.min(d, DUNGEONS.length - 1)];
  const night = runDungeon(dungeon.id, brav, 0, d * 31 + 7, need);
  if (night.win) {
    for (const it of night.loot) { if (it === "银两") cash += 20; else inv[it] = (inv[it] || 0) + 1; }
  }
  let shops = 0;
  for (let i = 0; i < 5; i++) {
    const shop = shopBuy(cash, d * 71 + i * 13 + 3);
    if (shop.ok) { cash = shop.cash; for (const it of shop.items) inv[it] = (inv[it] || 0) + 1; shops++; }
  }

  const good = s.sales.filter(x => x.verdict === "好评").length;
  const bad = s.sales.filter(x => x.verdict === "差评").length;
  console.log(`D${d+1}: [${Object.keys(prepIn).join("/")}] 接${s.sales.length} 拒${s.turnedAway || 0} 好${good} 差${bad} | 毛${revenue} 净${settled.net>=0?"+":""}${settled.net} 银${cash} 声望${rep} | 破${checkBankrupt(netHistory, cash)?"⚠":"-"}`);
}
console.log(`\n7天净利 ${netHistory.reduce((a,b)=>a+b,0)} | 终银 ${cash} | 破产: ${checkBankrupt(netHistory, cash) ? "触发" : "安全"}`);
