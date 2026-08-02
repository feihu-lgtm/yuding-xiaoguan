// ============================================================================
// 数据层：食材 / 技法 / 菜谱 / 味型 —— 一切数值的白名单
// 食材风物志搬自 qucuo cooking.js INGREDIENT_LORE（31 种），新增单价/类别。
// 菜谱按总纲 §16 改造：味型/档次/成本/出餐耗时/建议定价。
// 技法按「料理的四面体」坐标：介质(水/油/空气/蒸汽/生) × 火距(近/中/远)。
// ============================================================================

// ── 味型（川菜 24 味型 → 6 大类，客人口味匹配用大类，细节用细分）────────
export const TASTE_CATEGORIES = ["麻辣", "酸辣", "鲜香", "甜酸", "清淡", "甜"];

export const TASTES = {
  麻辣: ["麻辣", "煳辣", "红油", "椒麻", "怪味"],
  酸辣: ["酸辣", "鱼香"],
  鲜香: ["咸鲜", "家常", "酱香", "五香", "烟香", "香糟", "麻酱"],
  甜酸: ["糖醋", "荔枝", "茄汁"],
  清淡: ["姜汁", "蒜泥", "椒盐", "芥末"],
  甜: ["甜香", "咸甜"],
};

// ── 食材（31 种）─────────────────────────────────────────────────────────
// price：单份成本（文）。region：产地（对接巡回扩张）。
export const INGREDIENTS = {
  // 调味品
  熊山花椒:     { price: 3, tier: "绿",  category: "调味品", region: "鱼定村", desc: "麻得舌尖打颤，冷锅鱼底料的灵魂，产自曲措乡熊山。", },
  贡措海盐:     { price: 1, tier: "白",  category: "调味品", region: "鱼定村", desc: "咸而微甘，贡措海畔石上自结的霜，不是晒的，是湖水自己结的。", },
  锦官豆瓣酱:     { price: 2, tier: "绿",  category: "调味品", region: "锦官城", desc: "咸鲜微辣回甜，晒足一年方出缸，锦官城菜的底子。", },
  雅江菜籽油:     { price: 2, tier: "白",  category: "调味品", region: "雅江", desc: "青香微辛，冷榨而成，青衣楼冷锅鱼就用这个油。", },
  雪山野蜂蜜:     { price: 4, tier: "绿",  category: "调味品", region: "鱼定村", desc: "甜带松脂气，量极少，何雨谢一年只收两罐。", },
  大草甸孜然:     { price: 2, tier: "绿",  category: "调味品", region: "大草甸", desc: "辛香暖人，马帮从西域带回，跑马会烤肉必备。", },
  黑风寨苞谷醋:     { price: 2, tier: "白",  category: "调味品", region: "大草甸", desc: "酸得粗粝，苞谷酒糟二次发酵，巴桑说酸得正。", },
  喇嘛庙藏红花:     { price: 5, tier: "紫",  category: "调味品", region: "鱼定村", desc: "微苦暖香，能染色，入药入膳两用，佛前的东西不浪费。", },
  天都镇酱油:     { price: 2, tier: "白",  category: "调味品", region: "天都镇", desc: "咸鲜焦香，黄豆晒制，孟铁匠打铁间隙翻缸。", },
  鱼定村野葱油:     { price: 3, tier: "白",  category: "调味品", region: "鱼定村", desc: "辛甜葱香浓，鱼定大娘春天熬的，一罐用半年。", },
  // 山珍
  熊山松茸:     { price: 6, tier: "蓝", category: "山珍", region: "鱼定村", desc: "菌香浓，不可水洗，洗了就没了山的味道，要用小刀刮泥松针擦。", },
  青城山蕨菜:     { price: 3, tier: "绿",  category: "山珍", region: "锦官城", desc: "嫩滑微涩，青城后山所产，松鹤道长说练完剑吃这个清火。", },
  熊山铁棍山药:     { price: 3, tier: "绿",  category: "山珍", region: "鱼定村", desc: "粉糯黏液多，熊山北坡沙土里挖，一杆下去三尺深。", },
  雪山雪莲瓣:     { price: 6, tier: "蓝", category: "山珍", region: "鱼定村", desc: "清苦回甘冰凉，雪山顶峰雪莲心里采，何雨谢一年只许采三瓣。", },
  贡措海苔花:     { price: 3, tier: "绿",  category: "山珍", region: "鱼定村", desc: "鲜而微腥，贡措海浅滩石上刮的，丹增说那是湖底长上来的头发。", },
  大草甸野韭:     { price: 2, tier: "白",  category: "山珍", region: "大草甸", desc: "辛香冲鼻，比家韭冲三倍，春天头茬最嫩。", },
  // 水鲜
  狼曲冷水鱼:     { price: 5, tier: "蓝", category: "水鲜", region: "鱼定村", desc: "肉细刺多鲜甜，狼曲上游石缝里，雪团拍水震鱼嘎则拿草绳串。", },
  青衣江团鱼:     { price: 7, tier: "紫", category: "水鲜", region: "雅江", desc: "肉厚无刺胶质重，冷锅鱼的正主，青衣楼一天用二十条。", },
  贡措海裂腹鱼:     { price: 6, tier: "紫", category: "水鲜", region: "鱼定村", desc: "肉紧微咸自带盐味，贡措海深处，一年只吃一次是丹增的规矩。", },
  熊曲石斑:     { price: 6, tier: "蓝", category: "水鲜", region: "鱼定村", desc: "肉嫩带苔香，熊曲急流石下，老孙钓的，一年只有两个月肥。", },
  // 畜肉
  牦牛腱子肉:     { price: 8, tier: "蓝", category: "畜肉", region: "鱼定村", desc: "纤维粗肉味浓，玉泉寨牧民散养，炖三时辰才烂，急不得。", },
  藏香猪五花:     { price: 8, tier: "橙", category: "畜肉", region: "鱼定村", desc: "脂香带松果味，雪山派后山散养，吃松果野菌长大，烤起来满山香。", },
  大草甸黄羊腿:     { price: 6, tier: "蓝", category: "畜肉", region: "大草甸", desc: "肉紧膻味轻，跑马大会烤全羊用的就是这个。", },
  雪山雪鸡肉:     { price: 7, tier: "紫", category: "畜肉", region: "鱼定村", desc: "肉紧而嫩清炖最佳，加一味当归就够，加多了尝不出雪鸡自己的味。", },
  牦牛奶酪:     { price: 4, tier: "绿",  category: "畜肉", region: "鱼定村", desc: "奶香带一丝青草味，卓玛用自家牦牛奶做的鲜酪，春天吃野花的牛，奶做的酪是甜的。", },
  // 蔬果豆谷
  熊猫笋:     { price: 3, tier: "绿",  category: "蔬果豆谷", region: "鱼定村", desc: "嫩清甜带竹香，熊猫啃剩的冷箭竹笋尖，护谷弟子说别捡但确实好吃。", },
  鱼定村青稞:     { price: 1, tier: "白",  category: "蔬果豆谷", region: "鱼定村", desc: "粗嚼劲足微甜，糌粑和青稞饼的原料。", },
  玉泉寨土豆:     { price: 1, tier: "白",  category: "蔬果豆谷", region: "鱼定村", desc: "粉沙煮烂即化，不挑地，石头缝也长。", },
  雅江嫩豆腐:     { price: 3, tier: "白",  category: "蔬果豆谷", region: "雅江", desc: "嫩豆香易碎，青衣江的水点的卤，别处做不出。", },
  大草甸蘑菇:     { price: 3, tier: "白",  category: "蔬果豆谷", region: "大草甸", desc: "鲜肉厚伞大，雨后草坡上的白伞，不能生吃。", },
  锦官城干笋:     { price: 4, tier: "绿",  category: "蔬果豆谷", region: "锦官城", desc: "脆吸味耐煮，雅江鲜笋晒干运来，泡发要一夜。", },
};

// ── 技法（料理的四面体坐标）─────────────────────────────────────────────
// medium：水/油/空气/蒸汽/生；heat：近/中/远（火距）；turns：出餐耗时基准。
// requirement：制作要求（研发台展示：炊具/手法/特殊注意）
export const TECHNIQUES = {
  炖: { medium: "水",   heat: "中", turns: 40, icon: "🍲", unlock: 0,
    requirement: "文火慢煨，水盖过食材。不挑调料，新手保底。",
    desc: "文火慢煨，什么都能炖。不挑调料，新手保底。" },
  炒: { medium: "油",   heat: "近", turns: 25, icon: "🥘", unlock: 0,
    requirement: "旺火快炒，锅气足。味汁须一次兑准，火急成菜快，中途改不了比例。",
    desc: "旺火快炒，锅气足。出餐快，身法 buff 短而实用。" },
  烤: { medium: "空气", heat: "近", turns: 30, icon: "🔥", unlock: 0,
    requirement: "明火炙烤，肉食加成。火候要勤翻面，焦香入骨但不可过火。",
    desc: "明火炙烤，肉食加成。焦香入骨。" },
  腌: { medium: "生",   heat: "无", turns: 50, icon: "🫙", unlock: 0,
    requirement: "盐醋封坛，日久味长。坛沿水封要严实，急不得。",
    desc: "盐醋封坛，日久味长。回血低但 buff 最持久，跑图前备。" },
  蒸: { medium: "蒸汽", heat: "中", turns: 40, icon: "♨", unlock: 0,
    requirement: "竹笼水汽，原味不夺。需带蒸笼的炊具，水要一次加足。",
    desc: "竹笼水汽，原味不夺。效果最强，需蒸笼。" },
  // 进阶技法（厨力门槛解锁）
  干煸: { medium: "油",   heat: "中", turns: 45, icon: "🍳", unlock: 3,
    requirement: "码味不上浆，小火煸到干香。耗时久，干香醇厚。",
    desc: "码味不上浆，煸到干香。buff 持久。" },
  炸收: { medium: "油",   heat: "远", turns: 35, icon: "🍤", unlock: 2,
    requirement: "先炸干水气，再小火收汁。成品干香酥脆，耐存放。",
    desc: "炸干水气再收汁，耐存放。隔夜不坏。" },
  闷烧: { medium: "水",   heat: "近", turns: 40, icon: "🍲", unlock: 3,
    requirement: "盖盖烧制，汤汁浓稠上色油亮。比炖更绵软。",
    desc: "盖盖烧，汤汁浓稠绵软。" },
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

// 四面体介质线分组（研发台布局：三条线 + 蒸汽/生端点）
export const TETRA_LINES = [
  { line: "油线",   icon: "🛢", mediums: ["油"],   desc: "油为介质，锅气为魂" },
  { line: "水线",   icon: "💧", mediums: ["水"],   desc: "水为介质，绵长入味" },
  { line: "空气线", icon: "🌬", mediums: ["空气"], desc: "空气为介质，焦香明火" },
  { line: "蒸汽/生", icon: "♨", mediums: ["蒸汽", "生"], desc: "蒸汽原味 · 生领域封坛" },
];

// ── 炊具（研发台炊具槽，qucuo COOKWARE 精简）────────────────────────────
export const COOKWARE = [
  { id: "jiutieguo", name: "溪边旧铁锅", quality: "白", canSteam: false,
    requirement: "锅沿磕了三个豁口，鱼定大娘说补补还能用十年。炖炒皆可。" },
  { id: "zhenglong", name: "竹编蒸笼（三层）", quality: "绿", canSteam: true,
    requirement: "雅江冷箭竹编的，蒸出来带竹香。唯一能上蒸的炊具。" },
  { id: "kaojia",    name: "跑马会炭烤架", quality: "绿", canSteam: false,
    requirement: "铁条焊的，烤全羊都架得住。烤 buff +5 回合。" },
  { id: "caitan",    name: "黑风寨腌菜坛", quality: "白", canSteam: false,
    requirement: "坛沿水封得严实，腌三年不坏。腌 buff +10 回合。" },
];
export const DEFAULT_COOKWARE = "jiutieguo";

// 技法可否用：蒸需 canSteam 炊具
export function canUseTechnique(techId, cookware) {
  if (TECHNIQUES[techId]?.medium === "蒸汽") return !!cookware?.canSteam;
  return true;
}

// ── 菜谱（10 道，按总纲 §16 改造为"商品"）────────────────────────────────
// 味型：细分（TASTES 白名单）；档次：家常/精致/宴席（决定出餐耗时档）；
// cost：食材单价合计（系统算，不手写）；建议定价区间 = cost×1.5 ~ ×3.0。
export const RECIPES = [
  { name: "牦牛骨汤", technique: "炖", materials: ["牦牛腱子肉", "贡措海盐"], taste: "咸鲜", tier: "家常",
    desc: "骨髓熬化了，汤白得像奶。卓玛说这汤是给病人喝的——不是药，但比药暖。" },
  { name: "松茸炖雪鸡", technique: "炖", materials: ["雪山雪鸡肉", "熊山松茸", "贡措海盐"], taste: "咸鲜", tier: "精致",
    desc: "何雨谢亲手炖的，小火煨一天一夜。呼延雪说师母只炖过三次。" },
  { name: "烤藏香猪", technique: "烤", materials: ["藏香猪五花", "大草甸孜然"], taste: "椒盐", tier: "家常",
    desc: "吃松果野菌长大的，烤起来一股松脂香。呼延雪闻闻味道就当吃过了。" },
  { name: "烤黄羊腿", technique: "烤", materials: ["大草甸黄羊腿", "贡措海盐", "大草甸孜然"], taste: "椒盐", tier: "家常",
    desc: "跑马大会集市上现烤的，孜然辣椒撒得厚。梅朵每年跑完马都要吃半条。" },
  { name: "冷锅鱼", technique: "炒", materials: ["青衣江团鱼", "熊山花椒", "雅江菜籽油"], taste: "麻辣", tier: "精致",
    desc: "青衣楼招牌。冷锅底料铺七分熟鱼片，不开火先吃鱼。不吃冷锅鱼等于没来过雅江。" },
  { name: "熊猫笋炒腊肉", technique: "炒", materials: ["熊猫笋", "牦牛腱子肉", "熊山花椒"], taste: "家常", tier: "家常",
    desc: "熊猫啃剩的冷箭竹笋尖配腊肉，嫩得能掐出水。护谷弟子说别捡——但确实好吃。" },
  { name: "酸汤裂腹鱼", technique: "腌", materials: ["贡措海裂腹鱼", "黑风寨苞谷醋", "贡措海盐"], taste: "酸辣", tier: "家常",
    desc: "苞谷醋腌的裂腹鱼，酸得开胃。丹增说这鱼自带盐味，是贡措海的眼泪。" },
  { name: "腊牦牛肉", technique: "腌", materials: ["牦牛腱子肉", "贡措海盐", "熊山花椒"], taste: "麻辣", tier: "家常",
    desc: "盐与花椒封坛，风干半月。含在嘴里慢慢泡软，一块能吃一上午。" },
  { name: "雪莲蒸蛋", technique: "蒸", materials: ["雪山雪莲瓣", "牦牛奶酪", "贡措海盐"], taste: "清淡", tier: "精致",
    desc: "雪莲瓣入蛋，竹笼水汽一蒸，清苦回甘。何雨谢一年只许采三瓣雪莲。" },
  { name: "松茸蒸鸡", technique: "蒸", materials: ["雪山雪鸡肉", "熊山松茸", "喇嘛庙藏红花"], taste: "酱香", tier: "宴席",
    desc: "藏红花染出金黄，松茸提鲜。住持说佛前的东西不能浪费，入膳也是修行。" },
];

// ── 派生计算 ─────────────────────────────────────────────────────────────
export function recipeCost(recipe) {
  return (recipe.materials || []).reduce((sum, m) => sum + (INGREDIENTS[m]?.price ?? 1), 0);
}

export function recipePrepTime(recipe) {
  return { 家常: 2, 精致: 3, 宴席: 4 }[recipe.tier] ?? 2; // tick
}

export function recipePriceRange(recipe) {
  const c = recipeCost(recipe);
  return { min: Math.round(c * 1.2), max: Math.round(c * 3.0) };
}

// 开局食材（第一天）：覆盖 4 道可押菜的原料 + 一点富余
export const START_INVENTORY = {
  鱼定村青稞: 5, 玉泉寨土豆: 4, 大草甸野韭: 3,
  贡措海盐: 8,
  牦牛腱子肉: 2, 藏香猪五花: 3, 大草甸黄羊腿: 3, 贡措海裂腹鱼: 3,
  大草甸孜然: 6, 黑风寨苞谷醋: 3,
};

export const START_CASH = 300; // 文

// ── 初始菜谱（已研发，可上架）────────────────────────────────────────────
export const START_RECIPES = ["牦牛骨汤", "烤藏香猪", "烤黄羊腿", "酸汤裂腹鱼"];

// 随机数：mulberry32（种子确定性，防 S/L）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
