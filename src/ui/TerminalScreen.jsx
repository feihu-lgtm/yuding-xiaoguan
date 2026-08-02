// ============================================================================
// 主叙事 Terminal（SLG 消息流 + 底部输入）：研发走这里
// 消息格式：正文|角色|场景|表情 → 渲染为 说话者+表情+正文
// ============================================================================
import { useState, useRef, useEffect } from "react";

const MOOD_ICON = { 平静: "🙂", 认真: "😤", 满意: "😋", 疑惑: "🤔", 失望: "😞", 惊喜: "✨", none: "📖" };
const WHO_COLOR = { 说书人: "#a8a078", 灶神: "#c8a860", 店小二: "#8fd08a" };

export default function TerminalScreen({ msgs, onCommand, busy, hint }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const submit = () => {
    if (!input.trim() || busy) return;
    onCommand(input);
    setInput("");
  };

  return (
    <div className="terminal">
      {/* 场景背景层（灶房） */}
      <div className="terminal-bg">
        <div className="scene-window">🔥</div>
        <div className="scene-tables-hint">灶房 · 说书人叙事</div>
      </div>

      <div className="terminal-stream" ref={scrollRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`term-msg ${m.who === "说书人" ? "narrator" : ""}`}>
            <span className="term-avatar">{MOOD_ICON[m.mood] || MOOD_ICON.none}</span>
            <span className="term-who" style={{ color: WHO_COLOR[m.who] || "#c8a860" }}>{m.who}</span>
            <span className="term-scene dim">〔{m.scene}〕</span>
            <span className="term-text">{m.text}</span>
          </div>
        ))}
        {busy && <div className="term-msg narrator"><span className="term-avatar">📖</span><span className="term-who">说书人</span><span className="term-text dim">……正捋着胡须斟酌词句</span></div>}
        {!msgs.length && (
          <div className="term-msg narrator">
            <span className="term-avatar">📖</span><span className="term-who">说书人</span>
            <span className="term-text">夜已深，灶房里只剩你一个人。想做什么菜，报给我听——{hint}</span>
          </div>
        )}
      </div>

      <div className="terminal-input-row">
        <input
          value={input}
          disabled={busy}
          placeholder={hint || "输入命令…（放料 松茸 雪鸡｜技法 炖｜开火）"}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
        />
        <button className="mini-btn" onClick={submit} disabled={busy}>出招</button>
      </div>
      <div className="term-hint dim">放料 &lt;材料…&gt; ｜ 技法 &lt;炖/炒/烤/蒸/腌&gt; ｜ 开火 ｜ 清锅 ｜ 看灶 ｜ help</div>
    </div>
  );
}
