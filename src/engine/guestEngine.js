// ============================================================================
// 客人引擎：种子确定性生成一日 24 客（8×3 时段）
// 熟客档案 = 16 位（NPC口味表），每天轮转 8-10 位在场，其余路人模板。
// 纯函数：genDayGuests(dayIdx, reputation) → 三时段客单。
// ============================================================================

import { mulberry32, TASTE_CATEGORIES, INGREDIENTS } from "./data.js";
import { initKnown } from "./tasteProbe.js";

// ── 熟客档案（NPC口味表节选，编码版）────────────────────────────────────
// taste: 大类（满意度匹配）；likes: 兴趣食材（命中 +25 那档）；tier: 客层。
export const REGULARS = [
  { id: "caidan",   name: "才旦",     role: "村民", taste: "清淡", likes: ["大草甸蘑菇"], tech: "炖", pay: 15,  line: "薄荷脑随身，吃不得太咸" },
  { id: "laosun",   name: "老孙",     role: "村民", taste: "鲜香", likes: ["狼曲冷水鱼"], tech: "炖", pay: 18, line: "嘴上说不辣，回回加花椒" },
  { id: "yuding",   name: "鱼定大娘", role: "村民", taste: "甜",   likes: ["雪山野蜂蜜"], tech: "蒸", pay: 14,  line: "甜奶茶不离手，吃甜的人心肠热" },
  { id: "gongji",   name: "大公鸡",   role: "村民", taste: "鲜香", likes: ["熊山松茸"],    tech: "炒", pay: 12,  line: "闻到菌香就走不动道，给金蛋当饭钱" },
  { id: "basang",   name: "巴桑",     role: "村民", taste: "麻辣", likes: ["黑风寨苞谷醋"], tech: "炒", pay: 20, line: "苞谷醋酸得正就是他说的" },
  { id: "danzeng",  name: "丹增",     role: "村民", taste: "鲜香", likes: ["贡措海裂腹鱼"], tech: "炖", pay: 18, line: "鱼自带盐味，是贡措海的眼泪" },
  { id: "zhuoma",   name: "卓玛",     role: "村民", taste: "厚重", likes: ["牦牛腱子肉"], tech: "炖", pay: 16, line: "牦牛骨汤给病人喝的，认老火慢炖" },
  { id: "asu",      name: "阿索",     role: "村民", taste: "甜",   likes: ["牦牛奶酪"],    tech: "烤", pay: 12,  line: "奶酪蘸蜂蜜是他教的，烤过的更香" },
  { id: "liehu",    name: "老猎户",   role: "村民", taste: "厚重", likes: ["大草甸黄羊腿"], tech: "烤", pay: 18, line: "烤肉要撒厚孜然，山风里就该吃这个" },
  { id: "huasao",   name: "花嫂",     role: "村民", taste: "清淡", likes: ["玉泉寨土豆"],  tech: "炒", pay: 12,  line: "土豆丝下饭就知足" },
  { id: "zhaxi",    name: "扎西",     role: "客商", taste: "厚重", likes: ["大草甸孜然"],  tech: "烤", pay: 40, line: "烤肉没孜然等于没出门" },
  { id: "helian",   name: "赫连铸",   role: "客商", taste: "厚重", likes: ["熊山铁棍山药"], tech: "炒", pay: 35, line: "打铁间隙翻酱油缸，铁锅里什么都炒" },
  { id: "wen",      name: "温掌柜",   role: "客商", taste: "鲜香", likes: ["锦官豆瓣酱"],  tech: "炒", pay: 55, line: "酱缸里泡大的，一口尝出豆瓣晒了几年" },
  { id: "qingyi",   name: "青衣楼老板娘", role: "客商", taste: "麻辣", likes: ["青衣江团鱼"], tech: "炒", pay: 60, line: "一天用二十条团鱼，麻味打颤才够格" },
  { id: "meiduo",   name: "梅朵",     role: "贵客", taste: "麻辣", likes: ["大草甸黄羊腿"], tech: "烤", pay: 180, line: "跑马回来的姑娘，吃完还要赛一场" },
  { id: "luofu",    name: "陆福生",   role: "贵客", taste: "清淡", likes: ["锦官城干笋"],  tech: "炖", pay: 120, line: "账房出身，参须茶养着，油腻不进" },
];

// ── 路人模板（L1 填充，无档案）────────────────────────────────────────────
export const PASSERBY_TEMPLATES = [
  { id: "fucai",   name: "赶集的村妇",   taste: "清淡", likes: ["玉泉寨土豆", "大草甸野韭", "大草甸蘑菇"], tech: "炒", pay: [12, 18] },
  { id: "maichai", name: "卖柴的汉子",   taste: "厚重", likes: ["牦牛腱子肉", "大草甸黄羊腿"], tech: "烤", pay: [14, 20] },
  { id: "shang",   name: "跑单帮的客商", taste: "鲜香", likes: ["锦官城干笋", "雅江菜籽油"], tech: "炖", pay: [30, 45] },
  { id: "seng",    name: "路过的行脚僧", taste: "清淡", likes: ["喇嘛庙藏红花", "大草甸蘑菇"], tech: "蒸", pay: [10, 15] },
  { id: "shusheng", name: "锦官城来的书生", taste: "甜", likes: ["雅江嫩豆腐", "雪山雪莲瓣"], tech: "蒸", pay: [35, 55] },
  { id: "caigou",  name: "黑风寨采买的", taste: "麻辣", likes: ["熊山花椒", "黑风寨苞谷醋"], tech: "炒", pay: [25, 40] },
];

// 时段客群构成：午市村民为主 / 晚市客商多 / 夜宵高单价
const SLOT_COMPOSITION = [
  { village: 0.7, merchant: 0.3, noble: 0.0 }, // 午市
  { village: 0.4, merchant: 0.4, noble: 0.2 }, // 晚市
  { village: 0.3, merchant: 0.5, noble: 0.2 }, // 夜宵
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeRegularCard(reg, seed) {
  const rng = mulberry32(seed);
  return {
    id: reg.id, name: reg.name, role: reg.role, regular: true,
    taste: reg.taste, likes: [...reg.likes], tech: reg.tech, pay: reg.pay, known: initKnown(),
    patience: 90, // 配餐时限 1:30（秒）
    line: reg.line,
  };
}

function makePasserbyCard(tpl, seed) {
  const rng = mulberry32(seed);
  const likes = [...tpl.likes].sort(() => rng() - 0.5).slice(0, 2);
  return {
    id: `${tpl.id}_${seed}`, name: tpl.name, role: "路人", regular: false,
    taste: tpl.taste, likes, tech: tpl.tech, pay: Math.round(tpl.pay[0] + rng() * (tpl.pay[1] - tpl.pay[0])), known: initKnown(),
    patience: 90, // 配餐时限 1:30（秒）
    line: "",
  };
}

// 生成一日客单：返回 [时段1[], 时段2[], 时段3[]]，各 8 客
// 熟客每天轮转 8-10 位（村民 6-7 + 客商 1-2 + 贵客 0-1，贵客需声望），其余路人。
export function genDayGuests(dayIdx, reputation = 0) {
  const rng = mulberry32(dayIdx * 7919 + 13);
  const shuffle = arr => [...arr].sort(() => rng() - 0.5);

  const villagePool = shuffle(REGULARS.filter(r => r.role === "村民"));
  const merchantPool = shuffle(REGULARS.filter(r => r.role === "客商"));
  const noblePool = shuffle(REGULARS.filter(r => r.role === "贵客"));

  const nVillage = 6 + (rng() < 0.5 ? 1 : 0);        // 6-7
  const nMerchant = 1 + (rng() < 0.5 ? 1 : 0);       // 1-2
  const nNoble = reputation >= 30 && noblePool.length ? 1 : 0; // 0-1

  const todayRegular = [
    ...villagePool.slice(0, nVillage),
    ...merchantPool.slice(0, nMerchant),
    ...noblePool.slice(0, nNoble),
  ];
  const regularByRole = role => todayRegular.filter(r => r.role === role);

  // 熟客池跨时段共享：一天每人只来一次
  const availV = [...regularByRole("村民")];
  const availM = [...regularByRole("客商")];
  const availN = [...regularByRole("贵客")];

  const slots = [];
  for (let s = 0; s < 3; s++) {
    const comp = SLOT_COMPOSITION[s];
    const guests = [];
    const maxNoble = s === 0 ? 0 : comp.noble; // 贵客只在晚市/夜宵
    for (let i = 0; i < 8; i++) {
      const roll = rng();
      let card = null;
      if (roll < comp.village && availV.length) {
        card = makeRegularCard(availV.splice(Math.floor(rng() * availV.length), 1)[0], dayIdx * 1000 + s * 10 + i + 7);
      } else if (roll < comp.village + comp.merchant && availM.length) {
        card = makeRegularCard(availM.splice(Math.floor(rng() * availM.length), 1)[0], dayIdx * 1000 + s * 10 + i + 11);
      } else if (roll < comp.village + comp.merchant + maxNoble && availN.length) {
        card = makeRegularCard(availN.splice(Math.floor(rng() * availN.length), 1)[0], dayIdx * 1000 + s * 10 + i + 17);
      } else {
        card = makePasserbyCard(pick(rng, PASSERBY_TEMPLATES), dayIdx * 1000 + s * 10 + i + 3);
      }
      guests.push(card);
    }
    slots.push(guests);
  }
  return slots;
}
