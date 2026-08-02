// ============================================================================
// AI 客户端（OpenAI 兼容，反代站）：API 配置存 localStorage
// 铁律：AI 只做叙事与生成，永远不进裁决链；挂了静默落白名单/模板
// ============================================================================

const CFG_KEY = "yuding_api_config";

export function loadApiCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c?.endpoint || !c?.apiKey) return null;
    return {
      endpoint: c.endpoint,
      apiKey: c.apiKey,
      model: c.model || "deepseek-v4-flash",
      timeoutMs: c.timeoutMs || 60000,
    };
  } catch { return null; }
}

export function saveApiCfg(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function hasApi() {
  return !!loadApiCfg();
}

// OpenAI 兼容调用（非流式）
export async function callAI(system, user, { maxTokens = 2000, temperature = 1.0 } = {}) {
  const cfg = loadApiCfg();
  if (!cfg) throw new Error("未配置 API");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}：${data?.error?.message || "接口报错"}`);
    }
    const text = data?.choices?.[0]?.message?.content || "";
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// JSON 容错清洗（复用 qucuo 思路的精简版）：剥围栏 + 修标点 + 补括号
export function cleanJson(str) {
  if (!str) return "";
  let s = str.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const braceStart = s.indexOf("{");
  const braceEnd = s.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) s = s.slice(braceStart, braceEnd + 1);
  s = s.replace(/：/g, ":").replace(/，(?=\s*[}\]"])/g, ",");
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  let prev;
  do { prev = s; s = s.replace(/,\s*([}\]])/g, "$1"); } while (s !== prev);
  let braces = 0;
  for (const ch of s) { if (ch === "{") braces++; else if (ch === "}") braces--; }
  while (braces > 0) { s += "}"; braces--; }
  return s;
}

export async function callAIJson(system, user, opts) {
  const text = await callAI(system, user, opts);
  try {
    return JSON.parse(cleanJson(text));
  } catch (e) {
    throw new Error(`AI 返回无法解析为 JSON：${text.slice(0, 120)}`);
  }
}
