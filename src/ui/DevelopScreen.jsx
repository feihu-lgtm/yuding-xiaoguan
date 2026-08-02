// ============================================================================
// 研发台（四面体烹饪台）：料×4 + 技法（四面体分组）+ 炊具 → AGI 出餐
// 交互照搬 qucuo CookingScreen：点材料入槽、点槽取回、技法/炊具点击切换、
// 预测实时显示（命中配方或妙手偶得）、开火出餐。
// ============================================================================
import { useState } from "react";
import {
  TECHNIQUES, TECHNIQUE_IDS, TETRA_LINES, COOKWARE, DEFAULT_COOKWARE,
  canUseTechnique, INGREDIENTS,
} from "../engine/data.js";
import { matchRecipe } from "../engine/aiDish.js";

const QUAL_COLOR = { 白: "#c8bfa0", 绿: "#6aaa6a", 蓝: "#5a9adf", 紫: "#b48adf" };
const HEAT_LABEL = { 近: "近火", 中: "中火", 远: "远火", 无: "无火" };

export default function DevelopScreen({ inventory, cuisine, busy, onCook, onClose }) {
  const [slots, setSlots] = useState([null, null, null, null]);
  const [techniqueId, setTechniqueId] = useState("炖");
  const [cookwareId, setCookwareId] = useState(DEFAULT_COOKWARE);
  const [warn, setWarn] = useState("");
  const [fx, setFx] = useState(null);

  const cookware = COOKWARE.find(c => c.id === cookwareId) || COOKWARE[0];
  const tech = TECHNIQUES[techniqueId];
  const techUnlocked = cuisine >= (tech.unlock || 0);
  const techOk = techUnlocked && canUseTechnique(techniqueId, cookware);

  const slotCounts = {};
  slots.forEach(s => { if (s) slotCounts[s] = (slotCounts[s] || 0) + 1; });
  const remaining = name => (inventory[name] || 0) - (slotCounts[name] || 0);
  const filled = slots.filter(Boolean);
  const recipe = filled.length ? matchRecipe(filled, techniqueId) : null;
  const freestyle = !recipe && filled.length > 0 && techOk;

  function putMaterial(name) {
    if (fx?.kind === "ok" || remaining(name) <= 0) return;
    setSlots(prev => {
      const i = prev.indexOf(null);
      if (i < 0) return prev;
      const next = [...prev]; next[i] = name; return next;
    });
    setWarn("");
  }
  function clearSlot(i) {
    setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
  }
  function clearAll() { setSlots([null, null, null, null]); setWarn(""); setFx(null); }

  async function fire() {
    if (fx?.kind === "ok" || busy) return;
    if (!filled.length) { setWarn("灶膛烧得正旺，可锅里空空如也——先放点料。"); return; }
    if (!techUnlocked) { setWarn(`「${techniqueId}」是进阶技法，厨力 ${tech.unlock} 才够得着。`); return; }
    if (!techOk) { setWarn(`「${techniqueId}」需要能蒸的炊具（竹编蒸笼）。换一件家什。`); return; }
    await onCook({ materials: [...filled], technique: { id: techniqueId, req: tech.requirement }, cookware, freestyle, recipe });
    setFx({ kind: "ok", name: "出锅", freestyle });
    setTimeout(() => { setFx(null); setSlots([null, null, null, null]); }, 1500);
  }

  const mats = Object.entries(inventory).filter(([, c]) => c > 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dev-panel" onClick={e => e.stopPropagation()}>
        <div className="dev-head">
          <span>🔥 研发台 · 四面体灶</span>
          <span className="dim">{cookware.name}</span>
          <span className="dev-close" onClick={onClose}>✕</span>
        </div>

        {/* ① 四格料槽 */}
        <div className="dev-label">料 · 调味料与食材混装（点击放入，点格取回）</div>
        <div className="dev-slots">
          {slots.map((s, i) => (
            <div key={i} className={`dev-slot ${s ? "filled" : ""}`} onClick={() => s && clearSlot(i)}>
              <span className="dev-slot-idx">料{i + 1}</span>
              {s || <span className="dev-empty">空</span>}
            </div>
          ))}
          <div className="dev-flame">🔥</div>
        </div>

        {/* ② 技法（四面体：介质线 × 火距） */}
        <div className="dev-label">技法 · 四面体坐标（介质线 × 火距，点击选中看制作要求）</div>
        <div className="dev-tetra">
          {TETRA_LINES.map(line => (
            <div key={line.line} className="dev-line">
              <div className="dev-line-name">{line.icon} {line.line}</div>
              {TECHNIQUE_IDS.filter(tid => line.mediums.includes(TECHNIQUES[tid].medium)).map(tid => {
                const t = TECHNIQUES[tid];
                const sel = techniqueId === tid;
                const locked = cuisine < (t.unlock || 0);
                return (
                  <div key={tid}
                    className={`dev-tech ${sel ? "sel" : ""} ${locked ? "locked" : ""}`}
                    onClick={() => { setTechniqueId(tid); setWarn(""); }}
                    title={t.requirement}>
                    <span>{t.icon} {tid}</span>
                    <span className="dev-heat">{HEAT_LABEL[t.heat]}</span>
                    {locked && <span className="dev-lock">厨力{t.unlock}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* 制作要求 */}
        <div className="dev-req">
          {techUnlocked ? tech.requirement : `进阶技法——厨力 ${tech.unlock} 解锁（当前 ${cuisine}）`}
        </div>

        {/* ③ 炊具槽 */}
        <div className="dev-label">炊具 · 囊中所有（{COOKWARE.length}）</div>
        <div className="dev-cookware">
          {COOKWARE.map(cw => (
            <div key={cw.id}
              className={`dev-cw ${cookwareId === cw.id ? "sel" : ""}`}
              onClick={() => { setCookwareId(cw.id); setWarn(""); }}
              title={cw.requirement}>
              <span className="qual" style={{ color: QUAL_COLOR[cw.quality] || "#c8bfa0" }}>●</span>
              {cw.name}{cw.canSteam ? " ♨" : ""}
            </div>
          ))}
        </div>
        <div className="dev-cw-req dim">{cookware.requirement}</div>

        {/* ④ 预测 */}
        <div className="dev-scroll">
          {recipe ? (
            <div className="dev-dish">
              可烹 · 「{recipe.name}」 <span className="tier">[{recipe.tier}]</span>
              <div className="dim">{recipe.taste}味 · {recipe.technique} · 成本 {recipe.materials.reduce((s, m) => s + (INGREDIENTS[m]?.price || 1), 0)}文</div>
            </div>
          ) : freestyle ? (
            <div className="dev-dish freestyle">妙手偶得 · 灶神/说书人来起名
              <div className="dim">数值系统裁决，菜名风味交给 AI（无 API 时规则兜底）</div>
            </div>
          ) : filled.length ? (
            <div className="dev-dish dim">灶神摇头——这几样凑不成一道菜，换搭配或技法。</div>
          ) : (
            <div className="dev-dish dim">卷轴空着，等你下料。</div>
          )}
        </div>
        {warn && <div className="dev-warn">{warn}</div>}
        {fx && <div className="dev-fx">{fx.freestyle ? "妙手偶得！出锅了" : "「出锅！」香气四溢"}</div>}

        {/* ⑤ 开火 / 清空 */}
        <div className="dev-actions">
          <button className="big-btn" onClick={fire} disabled={busy}>开 火</button>
          <button className="list-btn" onClick={clearAll}>清空</button>
        </div>

        {/* ⑥ 可用材料 */}
        <div className="dev-label">🎒 可用材料</div>
        <div className="dev-mats">
          {mats.map(([n, c]) => {
            const left = remaining(n);
            return (
              <div key={n}
                className={`dev-mat ${left > 0 ? "" : "gone"}`}
                onClick={() => left > 0 && putMaterial(n)}>
                {n} <span className="dim">×{left}</span>
              </div>
            );
          })}
          {!mats.length && <div className="dim">囊中没有食材——白天买点，或夜里去抢。</div>}
        </div>
      </div>
    </div>
  );
}
