import { genDayGuests } from "../src/engine/guestEngine.js";
import { makePrep } from "../src/engine/prepEngine.js";
import { runDungeon, DUNGEONS, shopBuy } from "../src/engine/nightEngine.js";
import { RECIPES, START_INVENTORY } from "../src/engine/data.js";

let inv = { ...START_INVENTORY };
console.log("初始:", JSON.stringify(inv));

// D1 备菜（4 道×3）
const prepIn = { "酸汤裂腹鱼": 3, "牦牛骨汤": 3, "烤黄羊腿": 3, "烤藏香猪": 3 };
const res = makePrep(inv, { ...prepIn });
inv = res.inventory;
console.log("D1备菜后:", JSON.stringify(inv));

// 夜晚：副本（need 定向）+ 采购
const need = [...new Set(Object.keys(prepIn).flatMap(n => RECIPES.find(r => r.name === n).materials))];
console.log("need:", need);
const night = runDungeon(DUNGEONS[0].id, 2, 0, 7, need);
console.log("副本:", night.loot);
for (const it of night.loot) { if (it !== "银两") inv[it] = (inv[it] || 0) + 1; }
let shops = 0;
for (let i = 0; i < 5; i++) {
  const shop = shopBuy(500, i * 13 + 3);
  if (shop.ok) { for (const it of shop.items) inv[it] = (inv[it] || 0) + 1; shops++; }
}
console.log("采购", shops, "次");
console.log("夜晚后库存:", JSON.stringify(inv));

// D2 备菜预算
for (const name of ["酸汤裂腹鱼", "牦牛骨汤", "烤黄羊腿", "烤藏香猪", "冷锅鱼", "雪莲蒸蛋"]) {
  const r = RECIPES.find(x => x.name === name);
  if (!r) continue;
  let m = Infinity;
  for (const mat of r.materials) m = Math.min(m, Math.floor(inv[mat] || 0));
  if (m > 0) console.log(`D2 可备 ${name} ×${m}`);
}
