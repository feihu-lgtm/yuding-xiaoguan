// ============================================================================
// 搜打撤屏（摸金校尉厨房版）：大本营进入 → 多层热区 → 搜索/深入/撤离抉择
// ============================================================================
import { EXTRACT_LAYERS, EXTRACT_ENERGY } from "../engine/extractionEngine.js";

const HEAT_LABEL = { 绿: "低风险区", 黄: "中风险区", 红: "高风险区" };
const HEAT_COLOR = { 绿: "#6aaa6a", 黄: "#c8a860", 红: "#d4756a" };

export default function ExtractionScreen({ state, dungeon, onSearch, onDeeper, onExtract, onFight }) {
  const layer = EXTRACT_LAYERS[state.dungeonId][state.layer];
  const layers = EXTRACT_LAYERS[state.dungeonId];
  const isDeepest = state.layer >= layers.length - 1;

  return (
    <div className="screen battle">
      <h2>🗺 搜打撤 · {dungeon.name}</h2>
      {/* 地图进度 */}
      <div className="ext-map">
        {layers.map((l, i) => (
          <div key={i} className={`ext-node ${i === state.layer ? "cur" : i < state.layer ? "done" : ""}`}>
            <span style={{ color: HEAT_COLOR[l.heat] }}>●</span> {l.name}
            <div className="dim">{HEAT_LABEL[l.heat]}</div>
          </div>
        ))}
      </div>
      <div className="ext-stats">
        当前层：{layer.name}（{HEAT_LABEL[layer.heat]}）· 探索体力 {state.energy}/{EXTRACT_ENERGY}
        · 已搜刮 {state.loot.length} 件
      </div>
      <div className="ext-loot">
        {state.loot.length ? state.loot.join("、") : <span className="dim">行囊空空</span>}
      </div>
      <div className="battle-actions">
        <button className="list-btn" onClick={onSearch} disabled={state.energy < 1}>🔍 搜索本层（体力-1·或遇敌）</button>
        {!isDeepest
          ? <button className="list-btn" onClick={onDeeper}>➡ 深入下一层（体力-1·需胆识）</button>
          : <button className="list-btn" onClick={onFight}>👹 挑战守关之物（红区 Boss）</button>}
        <button className="list-btn" onClick={onExtract}>🏃 撤离（保住战利品）</button>
      </div>
      <div className="log battle-log">
        {state.log.slice(-10).map((l, i) => <div key={i} className="log-line">{l}</div>)}
      </div>
      <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
        贪一点还是现在走——撤离点既是安全承诺，也是末局冲突的诱因。
      </div>
    </div>
  );
}
