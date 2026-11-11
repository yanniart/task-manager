// 글자 대비 계산 (TRD 6장 "글자 대비 4.5:1 이상", TL-018).
// 화면에 보이는 모든 글자의 색과, 조상들의 바탕색·투명도를 겹친 실제 바탕색으로 대비를 계산해요.
// 큰 글자(24px 이상, 또는 18.66px 이상 굵은 글자)는 3:1, 나머지는 4.5:1. 비활성 버튼은 기준 예외.
// ※ 단독 실행 파일이 아니에요. run.mjs가 harness.js 뒤에 이어 붙여요. audit()을 부르면 { count, min, bad } 를 돌려줘요.
// 화면에 보이는 모든 글자의 실제 대비를 계산 (조상들의 바탕색·투명도까지 겹쳐서)
const AUDIT = `(() => {
  const parse = (s) => {
    let m = s.match(/^color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)/);
    if (m) return { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return { r: 0, g: 0, b: 0, a: 0 };
    const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const over = (top, a, bot) => ({ r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a) });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.sr-only, [hidden], script, style, svg')) continue;
    if (el.disabled) continue; // 비활성 버튼은 대비 기준 예외
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || !el.getClientRects().length) continue;
    const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
    let bg = { r: 255, g: 255, b: 255 }; let op = 1;
    for (const e of chain) {
      const s = getComputedStyle(e);
      if (e.closest('[inert]') && e !== el) {}
      op *= +s.opacity;
      const c = parse(s.backgroundColor);
      if (c.a > 0) bg = over(c, c.a, bg);
    }
    const fgc = parse(cs.color);
    const fg = over(fgc, fgc.a * op, bg);
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(fg, bg);
    out.push({ text: el.textContent.trim().slice(0, 18), ratio: +r.toFixed(2), need: large ? 3 : 4.5 });
  }
  const bad = out.filter((o) => o.ratio < o.need);
  const min = out.reduce((m, o) => Math.min(m, o.ratio), 99);
  return { count: out.length, min: +min.toFixed(2), bad };
})()`;
const audit = () => evaluate(AUDIT);
