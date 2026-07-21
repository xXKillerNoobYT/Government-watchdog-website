// Government Watchdog — "How it works" looping explainer.
// Scenario: the Cedar Street sidewalk / eminent-domain notice.
// No audio — guidance is carried by flashing boxes, arrows and captions.
// Reads the timeline engine globals from animations.jsx.

const { Stage, Sprite, useSprite, interpolate, animate, Easing, clamp } = window;

// ── Brand tokens (from the app) ─────────────────────────────────────────────
const C = {
  bg: '#0B0F14', surf: '#12181F', surf2: '#141B23', bd: '#232C37', bd2: '#1F2833',
  ink: '#ECF1F7', sub: '#C3CDD9', mut: '#8D99A7', dim: '#33404E',
  mint: '#4ED8C3', amber: '#E5A83B', blue: '#7DB1FB',
  red: '#EE7A6D', green: '#63D68F', gold: '#ECC35C',
  paper: '#FBF7EB', paper2: '#F3EDDD', paperEdge: '#E2D9C2', navy: '#1A4D8F',
  pink: '#1E1C17', pSub: '#4A463C', notice: '#F5F1E6',
};
const SANS = "'Public Sans',system-ui,sans-serif";
const SERIF = "'Newsreader',Georgia,serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";

const rev = (lt, d, dur = 0.4) => clamp((lt - d) / dur, 0, 1);
const pulse = (t, speed = 1.6) => 0.5 + 0.5 * Math.sin(t * speed * Math.PI);

// ── Reusable pieces ─────────────────────────────────────────────────────────
function SceneWrap({ bg, children, fade = 0.5 }) {
  const { localTime, duration } = useSprite();
  let op = 1;
  if (localTime < fade) op = clamp(localTime / fade, 0, 1);
  else if (localTime > duration - fade) op = clamp((duration - localTime) / fade, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg || 'transparent', opacity: op, fontFamily: SANS }}>
      {children}
    </div>
  );
}

function Flash({ x, y, w, h, color = C.gold, radius = 12, delay = 0, label, labelBg }) {
  const { localTime } = useSprite();
  const t = Math.max(0, localTime - delay);
  const ap = rev(localTime, delay, 0.35);
  const p = pulse(t, 1.5);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: ap, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, border: `3px solid ${color}`, borderRadius: radius,
        boxShadow: `0 0 ${6 + 20 * p}px ${color}, inset 0 0 ${4 + 8 * p}px ${color}22` }} />
      {label && (
        <div style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)',
          background: labelBg || color, color: '#0B0F14', fontFamily: MONO, fontSize: 14, fontWeight: 600,
          letterSpacing: '.4px', padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,.4)' }}>{label}</div>
      )}
    </div>
  );
}

function Arrow({ x, y, rot = 0, len = 96, color = C.gold, delay = 0, thick = 4 }) {
  const { localTime } = useSprite();
  const t = Math.max(0, localTime - delay);
  const op = rev(localTime, delay, 0.3);
  const nudge = 7 * Math.sin(t * 3);
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: op,
      transform: `rotate(${rot}deg) translateX(${nudge}px)`, transformOrigin: 'left center' }}>
      <svg width={len} height={24} viewBox={`0 0 ${len} 24`} fill="none">
        <line x1="3" y1="12" x2={len - 16} y2="12" stroke={color} strokeWidth={thick} strokeLinecap="round" />
        <path d={`M${len - 18} 3 L${len - 3} 12 L${len - 18} 21`} stroke={color} strokeWidth={thick} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Cursor({ x, y, op = 1 }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: op, zIndex: 60,
      filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.55))' }}>
      <svg width="32" height="44" viewBox="0 0 24 34"><path d="M3 2 L3 27 L9.5 20.5 L13.5 30.5 L17.5 28.5 L13.5 18.5 L21 18.5 Z" fill="#fff" stroke="#0B0F14" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </div>
  );
}

function GWLogo({ x, y, scale = 1, light = false }) {
  const sq = light ? { bg: C.navy, fg: C.paper } : { bg: C.ink, fg: C.bg };
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 14 * scale, transformOrigin: 'left center' }}>
      <div style={{ width: 56 * scale, height: 56 * scale, borderRadius: 14 * scale, background: sq.bg, color: sq.fg,
        display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 23 * scale, letterSpacing: '-.5px' }}>GW</div>
      <div style={{ lineHeight: 1.05, fontFamily: SANS }}>
        <div style={{ fontWeight: 800, fontSize: 24 * scale, letterSpacing: '.3px', color: light ? C.navy : C.ink }}>GOVERNMENT</div>
        <div style={{ fontWeight: 600, fontSize: 15 * scale, letterSpacing: 5 * scale, color: light ? C.pSub : C.mut }}>WATCHDOG</div>
      </div>
    </div>
  );
}

function Kicker({ x, y, text, color = C.mint }) {
  return <div style={{ position: 'absolute', left: x, top: y, fontFamily: MONO, fontSize: 17, fontWeight: 600, letterSpacing: '3px', color }}>{text}</div>;
}

function Caption({ text, y = 968, color = C.mut, accent }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: SANS, fontSize: 26, color, fontWeight: 500 }}>
      {text}{accent && <b style={{ color: accent }}> {accent === C.red ? '' : ''}</b>}
    </div>
  );
}

// A word that rises + fades in
function Rise({ children, x, y, size, color, weight = 700, font = SERIF, delay = 0, align = 'left', ls = '-.5px', dur = 0.5 }) {
  const { localTime } = useSprite();
  const t = Easing.easeOutCubic(rev(localTime, delay, dur));
  const tx = align === 'center' ? '-50%' : '0';
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tx}, ${(1 - t) * 22}px)`, opacity: t,
      fontFamily: font, fontSize: size, fontWeight: weight, color, letterSpacing: ls, lineHeight: 1.05, whiteSpace: 'pre', textAlign: align === 'center' ? 'center' : 'left' }}>
      {children}
    </div>
  );
}

// ── SCENE 1 — the hook ───────────────────────────────────────────────────────
function DotGrid({ cols, rows, gap, cx, top, dot, colorAt, delayAt }) {
  const { localTime } = useSprite();
  const w = (cols - 1) * gap, startX = cx - w / 2;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    const d = delayAt ? delayAt(i) : i * 0.012;
    const ap = rev(localTime, d, 0.4);
    out.push(<div key={i} style={{ position: 'absolute', left: startX + c * gap, top: top + r * gap, width: dot, height: dot,
      borderRadius: '50%', background: colorAt(i, localTime), opacity: ap, transform: `scale(${0.55 + 0.45 * ap})`,
      transition: 'background 500ms ease' }} />);
  }
  return <>{out}</>;
}

function Scene1() {
  const { localTime } = useSprite();
  const pushers = new Set([41, 42, 43, 44, 58, 59, 60, 61]);
  return (
    <SceneWrap bg={C.bg}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 132, textAlign: 'center', fontFamily: MONO, fontSize: 17, letterSpacing: '3px', color: C.mint }}>GOVERNMENT&nbsp;·&nbsp;WATCHDOG</div>
      <Rise x={960} y={186} align="center" size={78} color={C.ink} delay={0.3}>Your town is about to decide</Rise>
      <Rise x={960} y={276} align="center" size={78} color={C.mint} delay={0.9}>something that affects your land.</Rise>

      <DotGrid cols={17} rows={7} gap={46} cx={960} top={430} dot={16}
        colorAt={(i) => pushers.has(i) ? C.red : C.dim}
        delayAt={(i) => 1.8 + i * 0.006} />

      <Rise x={960} y={848} align="center" size={34} font={SANS} weight={600} color={C.sub} delay={4.0} ls="0">
        A few push it through.
      </Rise>
      <Rise x={960} y={900} align="center" size={34} font={SANS} weight={700} color={C.red} delay={4.5} ls="0">
        Most people never even hear about it.
      </Rise>
      {localTime > 3.4 && <Flash x={890} y={498} w={218} h={116} color={C.red} radius={16} delay={0.1} label="THE FEW WHO WANT IT" />}
    </SceneWrap>
  );
}

// ── SCENE 2 — the buried notice ──────────────────────────────────────────────
function Blank({ label }) {
  const { localTime } = useSprite();
  const p = pulse(localTime, 1.3);
  return (
    <span style={{ display: 'inline-block', margin: '0 4px', padding: '2px 16px', borderRadius: 8, color: C.red,
      fontFamily: MONO, fontWeight: 600, border: `2px dashed ${C.red}`, background: `rgba(238,122,109,${0.08 + 0.12 * p})` }}>{label}</span>
  );
}
function AgItem({ n, children, muted }) {
  return (
    <div style={{ display: 'flex', gap: 18, padding: '9px 0', borderBottom: '1px solid #E7DEC8' }}>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: '#9a9078', width: 40, flex: 'none' }}>{n}</div>
      <div style={{ fontFamily: SERIF, fontSize: 22, color: muted ? '#8a806c' : C.pink, lineHeight: 1.35 }}>{children}</div>
    </div>
  );
}
function Scene2() {
  const { localTime } = useSprite();
  const p = pulse(Math.max(0, localTime - 1.6), 1.3);
  return (
    <SceneWrap bg={C.bg}>
      <Rise x={960} y={44} align="center" size={30} font={SANS} weight={700} color={C.mut} delay={0.2} ls="1px">HOW THE TOWN ACTUALLY PUTS IT ON THE AGENDA</Rise>
      <div style={{ position: 'absolute', left: 360, top: 108, width: 1200, background: C.notice, borderRadius: 6,
        boxShadow: '0 40px 90px rgba(0,0,0,.5)', border: '1px solid #d9d0bb', padding: '28px 44px', color: C.pink }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '1.5px', color: C.pSub, borderBottom: '2px solid #1E1C17', paddingBottom: 10 }}>TOWN OF ALPINE · REGULAR COUNCIL MEETING</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: '#8a806c', margin: '6px 0 14px' }}>Tuesday, September 3, 2026 · 6:00 PM · Town Hall — posted agenda</div>
        <AgItem n="1." muted>Call to Order &amp; Roll Call</AgItem>
        <AgItem n="2." muted>Approval of Minutes — Aug 20, 2026</AgItem>
        <AgItem n="3." muted>Consent Agenda</AgItem>
        <AgItem n="4." muted>Treasurer's Report</AgItem>
        <AgItem n="5." muted>Public Works — Monthly Update</AgItem>
        <AgItem n="7.">New Business</AgItem>
        <div style={{ margin: '10px 0 4px 58px', border: `3px solid ${C.red}`, borderRadius: 10, background: `rgba(238,122,109,${0.05 + 0.06 * p})`, boxShadow: `0 0 ${6 + 16 * p}px ${C.red}66`, padding: '14px 18px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -32, left: 18, background: C.red, color: '#160B09', fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: '.4px', padding: '4px 11px', borderRadius: 8 }}>▲ ITEM 7.a — ONE LINE, NO PLAIN SUMMARY</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: C.pink, lineHeight: 1.5 }}><b>7.a</b>&nbsp;&nbsp;Consideration and possible action re: <b>Resolution 2026-041</b> — authorizing acquisition of certain real property interests by negotiated purchase or condemnation for the Cedar Street pedestrian connectivity improvement project, and appropriation of funds therefor. <span style={{ color: '#8a806c' }}>(Public Works)</span></div>
        </div>
        <AgItem n="8." muted>Public Comment</AgItem>
        <AgItem n="9." muted>Adjournment</AgItem>
      </div>
      <Caption text="This is the whole notice most residents get — one procedural line, buried at item 7.a." y={972} color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 3 — GW fills the blanks ────────────────────────────────────────────
const QFRAME = [
  { q: 'WHAT are they doing?', phrase: '“acquire certain real property interests”', ans: 'Taking strips of private front yards', rec: 'Res. 2026-041 §2', color: C.red },
  { q: 'HOW can they take it?', phrase: '“by negotiated purchase or condemnation”', ans: 'Buy it — or force the sale by eminent domain', rec: 'Res. 2026-041 §4', color: C.red },
  { q: 'WHY?', phrase: '“pedestrian connectivity improvement”', ans: 'To build a public sidewalk', rec: 'Public Works plan', color: C.mint },
  { q: 'HOW MUCH?', phrase: '“appropriation of funds therefor”', ans: '$480,000 set aside', rec: 'FY26 budget · p.12', color: C.amber },
  { q: 'WHO is affected?', phrase: '“parcels within the project limits”', ans: 'Cedar Street · 14 homes', rec: 'county parcel map', color: C.blue },
  { q: 'WHEN?', phrase: '“possible action at this meeting”', ans: 'Vote Sept 3 · comment closes Aug 20', rec: 'meeting agenda', color: C.gold },
];
function Scene3() {
  const { localTime } = useSprite();
  return (
    <SceneWrap bg={C.bg}>
      <GWLogo x={560} y={54} scale={1} />
      <Rise x={960} y={134} align="center" size={37} font={SERIF} weight={700} color={C.ink} delay={0.5}>runs item 7.a through the same six plain questions.</Rise>
      {QFRAME.map((f, i) => {
        const d = 1.0 + i * 1.7;
        const on = localTime > d + 0.2;
        const ry = 226 + i * 120;
        return (
          <div key={i} style={{ position: 'absolute', left: 200, top: ry, width: 1520, height: 104, opacity: rev(localTime, d - 0.2, 0.4) }}>
            <div style={{ position: 'absolute', left: 0, top: 8, width: 560 }}>
              <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '.3px' }}>{f.q}</div>
              <div style={{ fontFamily: MONO, fontSize: 15, color: C.mut, marginTop: 6, textDecoration: on ? 'line-through' : 'none', opacity: on ? 0.5 : 1 }}>{f.phrase}</div>
            </div>
            <Arrow x={600} y={44} len={110} color={f.color} delay={d} />
            <div style={{ position: 'absolute', left: 760, top: 0, width: 960, transform: `translateX(${(1 - Easing.easeOutBack(rev(localTime, d, 0.5))) * 40}px)`, opacity: rev(localTime, d, 0.4) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: C.surf, border: `1px solid ${C.bd}`, borderLeft: `4px solid ${f.color}`, borderRadius: 12, padding: '13px 22px' }}>
                <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: C.ink, flex: 1 }}>{f.ans}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 14, color: C.green, border: '1px solid #2C5A3E', background: '#101820', borderRadius: 8, padding: '6px 12px', flex: 'none' }}>&#10003; {f.rec}</div>
              </div>
            </div>
            {on && localTime < d + 1.4 && <Flash x={756} y={-4} w={968} h={70} color={f.color} radius={12} />}
          </div>
        );
      })}
      <Caption text="Same agenda item — rewritten as six plain questions. Every answer links to the record." y={978} color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 4 — the awareness gap + resident sentiment ─────────────────────────
function Bar({ x, y, w, label, sub, val, color, delay }) {
  const { localTime } = useSprite();
  const e = Easing.easeOutCubic(rev(localTime, delay, 1.1));
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: rev(localTime, delay - 0.1, 0.3) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 800, letterSpacing: '.5px', color: C.ink }}>{label}</div>
          <div style={{ fontFamily: SANS, fontSize: 16, color: C.mut, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 52, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(val * e)}%</div>
      </div>
      <div style={{ height: 20, background: '#0d141b', border: `1px solid ${C.bd}`, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${val * e}%`, height: '100%', background: color, borderRadius: 999, boxShadow: `0 0 16px ${color}88` }} />
      </div>
    </div>
  );
}
function House({ color, delay }) {
  const { localTime } = useSprite();
  const t = Easing.easeOutBack(rev(localTime, delay, 0.4));
  return (
    <svg width="66" height="62" viewBox="0 0 40 38" style={{ opacity: clamp(t, 0, 1), transform: `scale(${t})` }}>
      <path d="M20 3 L37 17 L32 17 L32 34 L8 34 L8 17 L3 17 Z" fill={color + '22'} stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}
function Scene4() {
  const { localTime } = useSprite();
  const stances = [
    ...Array(2).fill(['Excited', C.green]),
    ...Array(3).fill(['Willing', C.mint]),
    ...Array(3).fill(['Will sell', C.blue]),
    ...Array(6).fill(['Not willing', C.red]),
  ];
  return (
    <SceneWrap bg={C.bg}>
      <Rise x={960} y={92} align="center" size={58} font={SERIF} weight={700} color={C.ink} delay={0.2}>So who actually knows?</Rise>
      <div style={{ position: 'absolute', left: 300, top: 236 }}>
        <Bar x={0} y={0} w={1320} label="KNOW IT'S HAPPENING" sub="heard about the sidewalk plan at all" val={61} color={C.blue} delay={0.6} />
      </div>
      <div style={{ position: 'absolute', left: 300, top: 366 }}>
        <Bar x={0} y={0} w={1320} label="OFFICIALLY INFORMED" sub="received the required legal notice" val={34} color={C.amber} delay={1.1} />
      </div>
      <div style={{ position: 'absolute', left: 300, top: 496 }}>
        <Bar x={0} y={0} w={1320} label="HAVE WEIGHED IN" sub="submitted a comment before the vote" val={12} color={C.red} delay={1.6} />
      </div>
      {localTime > 3.4 && <Flash x={1360} y={492} w={260} h={104} color={C.red} radius={12} delay={0.1} label="ONLY 1 IN 8" />}

      {/* resident sentiment */}
      <div style={{ position: 'absolute', left: 300, top: 656, fontFamily: SANS, fontSize: 18, fontWeight: 800, letterSpacing: '1.5px', color: C.mint, opacity: rev(localTime, 4.0, 0.4) }}>CEDAR STREET · 14 HOMES · HOW NEIGHBORS FEEL</div>
      <div style={{ position: 'absolute', left: 300, top: 700, display: 'flex', gap: 24 }}>
        {stances.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <House color={s[1]} delay={4.3 + i * 0.07} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 300, top: 792, display: 'flex', gap: 28, opacity: rev(localTime, 5.6, 0.4), fontFamily: SANS, fontSize: 17, color: C.sub }}>
        <span><span style={{ color: C.green }}>■</span> Excited 2</span>
        <span><span style={{ color: C.mint }}>■</span> Willing 3</span>
        <span><span style={{ color: C.blue }}>■</span> Would sell 3</span>
        <span><span style={{ color: C.red }}>■</span> Not willing 6</span>
      </div>
      {localTime > 6.0 && <Flash x={860} y={694} w={410} h={78} color={C.red} radius={12} delay={0.1} label="MAJORITY OPPOSE — VOTE IS SEPT 3" />}
      <Caption text="The people most affected are the least likely to have been told." y={968} color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 5 — Simple mode ────────────────────────────────────────────────────
function Toggle({ x, y, active }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', border: `1.5px solid ${C.pink}`, borderRadius: 999, overflow: 'hidden', fontFamily: SANS, fontWeight: 700, fontSize: 15 }}>
      <span style={{ padding: '7px 18px', background: active === 'simple' ? C.pink : 'transparent', color: active === 'simple' ? C.paper : C.pink }}>Simple</span>
      <span style={{ padding: '7px 18px', background: active === 'advanced' ? C.pink : 'transparent', color: active === 'advanced' ? C.paper : C.pink }}>Advanced</span>
    </div>
  );
}
function Scene5() {
  const { localTime } = useSprite();
  const z = 1 + 0.05 * Easing.easeInOutQuad(rev(localTime, 0, 10));
  // cursor path (local time -> position), anchored to real elements
  const cx = interpolate([0.6, 1.8, 3.6, 5.4, 7.2], [1560, 640, 660, 1240, 1240], Easing.easeInOutCubic);
  const cy = interpolate([0.6, 1.8, 3.6, 5.4, 7.2], [940, 300, 470, 720, 720], Easing.easeInOutCubic);
  return (
    <SceneWrap bg={C.paper2}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 48%' }}>
        <div style={{ position: 'absolute', left: 240, top: 88, width: 1440, background: C.paper, border: `1px solid ${C.paperEdge}`, borderRadius: 4, boxShadow: '0 30px 70px rgba(0,0,0,.35)' }}>
          {/* masthead */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 36px 12px' }}>
            <GWLogoInline light />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 600, color: C.pink, letterSpacing: '-.5px' }}>Government Watchdog Weekly</div>
              <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: '5px', color: C.pSub, marginTop: 4 }}>TOWN&nbsp;/&nbsp;COUNTY&nbsp;/&nbsp;STATE</div>
            </div>
            <div style={{ width: 220 }} />
          </div>
          <div style={{ borderTop: `2px solid ${C.pink}`, borderBottom: `1px solid ${C.pink}`, margin: '0 36px' }} />
          {/* featured story */}
          <div style={{ margin: '22px 36px 30px', border: `1.5px solid ${C.pink}`, borderRadius: 6, background: '#FDFAF1', padding: '24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '2px', color: '#A33327' }}>FRONT-PAGE STORY</div>
              <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: '#0E7A6E', border: '1.5px solid #0E7A6E', borderRadius: 4, padding: '2px 8px' }}>TOWN</div>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 58, fontWeight: 600, lineHeight: 1.06, color: C.pink, marginTop: 10 }}>Town May Take Cedar St. Land to Build a Sidewalk</div>
            <div style={{ fontFamily: SERIF, fontSize: 25, fontStyle: 'italic', color: C.pSub, marginTop: 12, lineHeight: 1.4 }}>The town wants to use <b>eminent domain</b> to buy strips of 14 front yards for a new sidewalk. $480,000 is set aside. A vote is possible Sept 3.</div>
            {/* photo band */}
            <div style={{ display: 'flex', gap: 22, marginTop: 18 }}>
              <div style={{ width: 470, height: 210, borderRadius: 5, border: '1.5px solid #1E1C17', overflow: 'hidden', flex: 'none',
                background: 'repeating-linear-gradient(135deg, #EFE8D5 0 12px, #E6DDC6 12px 24px)', display: 'grid', placeItems: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '2px', color: '#8a806c', textTransform: 'uppercase' }}>photo · cedar street</div>
              </div>
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 16, flex: 1 }}>
                <div style={{ borderTop: `2px solid ${C.pink}`, paddingTop: 10 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1px', color: C.pink }}>PLAIN ENGLISH <span style={{ color: '#7A5B00', background: '#FFF3CD', border: '1px solid #D9A400', borderRadius: 3, padding: '0 5px' }}>AI</span></div>
                  <div style={{ fontFamily: SERIF, fontSize: 21, color: C.pSub, marginTop: 6, lineHeight: 1.45 }}>The town could force the sale of part of your yard to build a public sidewalk.</div>
                </div>
                <div style={{ borderTop: `2px solid ${C.pink}`, paddingTop: 10 }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1px', color: C.pink }}>WHY IT MATTERS</div>
                  <div style={{ fontFamily: SERIF, fontSize: 21, color: C.pSub, marginTop: 6, lineHeight: 1.45 }}>6 of 14 neighbors say they don't want to give up land — but the vote still moves ahead.</div>
                </div>
              </div>
            </div>
            {/* next step banner */}
            <div id="s5-next" style={{ marginTop: 20, background: '#EBF0F8', border: `1.5px solid ${C.navy}`, borderRadius: 8, padding: '16px 22px' }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, letterSpacing: '1.5px', color: C.navy }}>YOUR ONE NEXT STEP</div>
              <div style={{ fontFamily: SERIF, fontSize: 26, color: C.pink, marginTop: 6, lineHeight: 1.35 }}>Send a comment by <b>Aug 20</b>, or speak at the <b>Sept 3</b> meeting — 6 PM, Alpine Town Hall.</div>
            </div>
          </div>
        </div>
        <Toggle x={1420} y={104} active="simple" />
        {localTime > 5.2 && <Flash x={300} y={706} w={1320} h={122} color={C.navy} radius={10} delay={0.1} label="ONE CLEAR NEXT STEP" labelBg={C.navy} />}
        <Cursor x={cx(localTime)} y={cy(localTime)} />
      </div>
      <Caption text="SIMPLE MODE — big type, plain words, one clear thing to do." y={992} color={C.pSub} />
    </SceneWrap>
  );
}
function GWLogoInline({ light }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 220 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: C.navy, color: C.paper, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 19 }}>GW</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 15, lineHeight: 1.15, color: C.navy }}>GOVERNMENT<br />WATCHDOG</div>
    </div>
  );
}

// ── SCENE 6 — Advanced mode (tracking dashboard) ─────────────────────────────
const COSTS = [
  ['Land acquisition · 14 parcels', 210, C.red],
  ['Construction', 178, C.mint],
  ['Engineering & design', 42, C.blue],
  ['Legal / condemnation', 30, C.amber],
  ['Contingency', 20, C.gold],
];
const COMMENTS = [
  { who: 'M. Alvarez', addr: '12 Cedar St', stance: 'Opposes', color: C.red, src: 'email · Aug 22', txt: '“Nobody told me until a neighbor called. Don’t take my front yard.”' },
  { who: 'R. Bui', addr: '28 Cedar St', stance: 'Opposes', color: C.red, src: 'letter · Aug 24', txt: '“A sidewalk is fine. Forcing the sale by condemnation is not.”' },
  { who: 'T. Okafor', addr: '9 Cedar St', stance: 'Supports', color: C.green, src: 'email · Aug 25', txt: '“Kids walk in the road today. I’ll sell the strip if the price is fair.”' },
];
function Scene6() {
  const { localTime } = useSprite();
  const toggle = localTime < 1.0 ? 'simple' : 'advanced';
  const cx = interpolate([1.4, 2.8, 5.0, 7.2], [1620, 520, 1360, 520], Easing.easeInOutCubic);
  const cy = interpolate([1.4, 2.8, 5.0, 7.2], [980, 360, 380, 720], Easing.easeInOutCubic);
  const maxCost = 210;
  return (
    <SceneWrap bg={C.bg}>
      {/* header strip */}
      <div style={{ position: 'absolute', left: 96, top: 60, right: 96, display: 'flex', alignItems: 'center', gap: 18, borderBottom: `1px solid ${C.bd}`, paddingBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: C.ink, color: C.bg, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 17 }}>GW</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 20, color: C.ink }}>Cedar Street Sidewalk <span style={{ color: C.mut, fontWeight: 600 }}>· Eminent Domain</span></div>
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 800, letterSpacing: '.8px', color: C.mint, border: `1px solid ${C.mint}`, borderRadius: 5, padding: '3px 9px' }}>TOWN</span>
        <div style={{ marginLeft: 'auto', display: 'flex', border: `1px solid ${C.bd}`, borderRadius: 999, overflow: 'hidden', fontFamily: SANS, fontWeight: 700, fontSize: 14 }}>
          <span style={{ padding: '6px 15px', background: toggle === 'simple' ? C.mint : 'transparent', color: toggle === 'simple' ? '#062019' : C.mut }}>Simple</span>
          <span style={{ padding: '6px 15px', background: toggle === 'advanced' ? C.mint : 'transparent', color: toggle === 'advanced' ? '#062019' : C.mut }}>Advanced</span>
        </div>
      </div>

      {/* Q1 — estimated cost */}
      <div style={{ position: 'absolute', left: 96, top: 176, width: 853, height: 348, background: C.surf, border: `1px solid ${C.bd}`, borderRadius: 14, padding: '20px 24px', opacity: rev(localTime, 1.0, 0.5) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1.4px', color: C.mint }}>ESTIMATED COST</div>
          <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800, color: C.ink }}>$480,000</div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {COSTS.map((c, i) => {
            const e = Easing.easeOutCubic(rev(localTime, 1.4 + i * 0.12, 0.9));
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 15, marginBottom: 4 }}>
                  <span style={{ color: C.sub }}>{c[0]}</span>
                  <span style={{ color: C.ink, fontWeight: 700, fontFamily: MONO, fontSize: 14 }}>${c[1]}K</span>
                </div>
                <div style={{ height: 12, background: '#0d141b', border: `1px solid ${C.bd}`, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(c[1] / maxCost) * 100 * e}%`, height: '100%', background: c[2], borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.mut, marginTop: 12 }}>&#10003; Town estimate — FY26 capital plan, p.14 · matches appropriation to the dollar</div>
      </div>

      {/* Q2 — public comments */}
      <div style={{ position: 'absolute', left: 971, top: 176, width: 853, height: 348, background: C.surf, border: `1px solid ${C.bd}`, borderRadius: 14, padding: '20px 24px', opacity: rev(localTime, 1.2, 0.5) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1.4px', color: C.mint }}>PUBLIC COMMENTS · EMAILS &amp; LETTERS TO THE TOWN</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.mut }}>public record</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {COMMENTS.map((c, i) => (
            <div key={i} style={{ background: C.surf2, border: `1px solid ${C.bd}`, borderLeft: `3px solid ${c.color}`, borderRadius: 9, padding: '8px 12px', opacity: rev(localTime, 1.6 + i * 0.3, 0.4) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: SANS, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{c.who}</span>
                <span style={{ color: C.mut }}>{c.addr}</span>
                <span style={{ color: c.color, fontWeight: 700 }}>· {c.stance}</span>
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.green }}>&#10003; {c.src}</span>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 16.5, color: C.sub, marginTop: 3, lineHeight: 1.3 }}>{c.txt}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 11, fontFamily: MONO, fontSize: 13 }}>
          <span style={{ color: C.red }}>6 oppose</span><span style={{ color: C.green }}>3 support</span><span style={{ color: C.mut }}>3 undecided</span><span style={{ color: C.mut }}>· of 12 on file</span>
        </div>
      </div>

      {/* Q3 — hidden-change flag */}
      <div style={{ position: 'absolute', left: 96, top: 548, width: 853, height: 300, background: '#151210', border: '1px solid #3E2A24', borderRadius: 14, padding: '20px 24px', opacity: rev(localTime, 1.4, 0.5) }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1.4px', color: C.red }}>HIDDEN THINGS · TRANSPARENCY ALERT</div>
        <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 700, color: C.red, marginTop: 12 }}>&#9650; Money added after the notice posted</div>
        <div style={{ fontFamily: SANS, fontSize: 18, color: C.sub, lineHeight: 1.5, marginTop: 9 }}>The <b style={{ color: C.ink }}>$480,000</b> appropriation appeared in packet <b style={{ color: C.ink }}>v2 on Aug 30</b> — three days before the vote, after most residents had read v1.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: C.green, border: '1px solid #1F3A2C', background: '#101820', borderRadius: 6, padding: '4px 10px' }}>v1 · Aug 12</span>
          <span style={{ color: C.red, border: '1px solid #52302B', background: '#1D1412', borderRadius: 6, padding: '4px 10px' }}>v2 · Aug 30 · $480K added</span>
          <span style={{ color: C.gold, border: '1px solid #4a3c14', background: '#201A0E', borderRadius: 6, padding: '4px 10px' }}>vote · Sept 3</span>
        </div>
      </div>

      {/* Q4 — receipts + timeline */}
      <div style={{ position: 'absolute', left: 971, top: 548, width: 853, height: 300, background: C.surf, border: `1px solid ${C.bd}`, borderRadius: 14, padding: '20px 24px', opacity: rev(localTime, 1.6, 0.5) }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1.4px', color: C.mint }}>RECEIPTS · EVERYTHING IS SOURCED</div>
        <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap', fontFamily: MONO, fontSize: 13 }}>
          {['✓ Resolution 2026-041', '✓ FY26 budget p.12', '✓ Roll-call vote', '✓ Parcel map', '✓ 12 public comments'].map((r, i) => (
            <span key={i} style={{ color: C.green, border: '1px solid #2C5A3E', background: '#101820', borderRadius: 8, padding: '6px 11px' }}>{r}</span>
          ))}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, letterSpacing: '1.4px', color: C.mint, margin: '16px 0 10px' }}>THREE-LANE TIMELINE</div>
        {[['TOWN', C.mint, 'Notice → v2 changed → vote Sept 3'], ['COUNTY', C.amber, 'Parcel map filed Aug 15'], ['STATE', C.blue, 'Property-rights law referenced']].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
            <span style={{ width: 52, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: l[1] }}>{l[0]}</span>
            <span style={{ flex: 1, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${l[1]}, ${l[1]}22)` }} />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.sub, width: 300 }}>{l[2]}</span>
          </div>
        ))}
      </div>

      {localTime > 1.8 && localTime < 4.4 && <Flash x={90} y={170} w={865} h={360} color={C.amber} radius={16} delay={0.1} label="WHAT IT REALLY COSTS" labelBg={C.amber} />}
      {localTime > 4.6 && <Flash x={965} y={170} w={865} h={360} color={C.mint} radius={16} delay={0.1} label="WHAT NEIGHBORS ACTUALLY SAID — PUBLIC RECORD" labelBg={C.mint} />}
      <Cursor x={cx(localTime)} y={cy(localTime)} />
      <Caption text="ADVANCED MODE — costs, public comments, hidden-change flags, the full record." y={984} color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 7 — how it reaches people ──────────────────────────────────────────
function Scene7() {
  const { localTime } = useSprite();
  const informed = Math.round(interpolate([2.6, 5.2], [34, 96], Easing.easeOutCubic)(localTime));
  return (
    <SceneWrap bg={C.bg}>
      <Rise x={960} y={92} align="center" size={58} font={SERIF} weight={700} color={C.ink} delay={0.2}>The moment it's filed, everyone hears.</Rise>

      {/* alert card */}
      <div style={{ position: 'absolute', left: 300, top: 216, width: 760, transform: `translateY(${(1 - Easing.easeOutBack(rev(localTime, 0.6, 0.6))) * 40}px)`, opacity: rev(localTime, 0.6, 0.5) }}>
        <div style={{ background: C.surf, border: `1px solid ${C.bd}`, borderRadius: 16, padding: 26, boxShadow: '0 30px 70px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.ink, color: C.bg, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 16 }}>GW</div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 18, color: C.ink }}>Government Watchdog Alert</div>
            <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 13, color: C.green, border: '1px solid #2C5A3E', background: '#101820', borderRadius: 8, padding: '5px 11px' }}>within 1 day of the notice</span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: C.ink, marginTop: 16, lineHeight: 1.3 }}>The town may take part of your Cedar St. yard for a sidewalk.</div>
          <div style={{ fontFamily: SANS, fontSize: 19, color: C.sub, marginTop: 8 }}>Eminent domain · $480,000 set aside · vote Sept 3. <b style={{ color: C.gold }}>Comment closes Aug 20.</b></div>
        </div>
      </div>

      {/* informed meter */}
      <div style={{ position: 'absolute', left: 1140, top: 250, width: 480, opacity: rev(localTime, 2.2, 0.4) }}>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 800, letterSpacing: '.5px', color: C.ink }}>NOW INFORMED</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 4 }}>
          <div style={{ fontFamily: SANS, fontSize: 80, fontWeight: 800, color: C.green, lineHeight: 1 }}>{informed}%</div>
          <div style={{ fontFamily: SANS, fontSize: 18, color: C.mut }}>of Cedar St. residents</div>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 17, color: C.mut, marginTop: 4 }}>was <span style={{ color: C.amber, fontWeight: 700 }}>34%</span> before the alert</div>
      </div>

      {/* dot field lighting up green */}
      <DotGrid cols={17} rows={4} gap={46} cx={960} top={560} dot={16}
        colorAt={(i, lt) => lt > (2.4 + i * 0.028) ? C.green : C.dim}
        delayAt={() => 0.2} />
      {localTime > 4.6 && <Flash x={560} y={536} w={800} h={196} color={C.green} radius={16} delay={0.1} label="NOW THE WHOLE STREET KNOWS — BEFORE THE VOTE" />}
      <Caption text="Alerts, a plain-English newsletter, the record — pushed out before it's too late to act." y={968} color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 8 — outro ──────────────────────────────────────────────────────────
function Scene8() {
  const { localTime } = useSprite();
  return (
    <SceneWrap bg={C.bg}>
      <div style={{ position: 'absolute', left: '50%', top: 300, transform: `translateX(-50%) scale(${0.9 + 0.1 * Easing.easeOutBack(rev(localTime, 0.2, 0.6))})`, opacity: rev(localTime, 0.2, 0.5), display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ width: 96, height: 96, borderRadius: 22, background: C.ink, color: C.bg, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: '-1px' }}>GW</div>
        <div style={{ fontFamily: SANS, textAlign: 'left' }}>
          <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: '.5px', color: C.ink, lineHeight: 1 }}>GOVERNMENT</div>
          <div style={{ fontWeight: 600, fontSize: 26, letterSpacing: '9px', color: C.mut, marginTop: 4 }}>WATCHDOG</div>
        </div>
      </div>
      <Rise x={960} y={480} align="center" size={62} font={SERIF} weight={700} color={C.mint} delay={1.0}>We Watch. We Report. You Decide.</Rise>
      <Rise x={960} y={588} align="center" size={26} font={SANS} weight={500} color={C.mut} delay={1.6} ls="0">Simple for everyone. Advanced for the record. Nothing without a receipt.</Rise>
      <Rise x={960} y={676} align="center" size={17} font={MONO} weight={500} color={C.mut} delay={2.1} ls="2px">FIXTURE MODE · SAMPLE TOWN OF ALPINE RECORDS</Rise>
    </SceneWrap>
  );
}

// ── Stage assembly ───────────────────────────────────────────────────────────
function SidewalkDemo() {
  return (
    <Stage width={1920} height={1080} duration={73} background={C.bg} persistKey="gw_sidewalk_demo" loop={true}>
      <Sprite start={0} end={7.5}><Scene1 /></Sprite>
      <Sprite start={7} end={16.5}><Scene2 /></Sprite>
      <Sprite start={16} end={30.5}><Scene3 /></Sprite>
      <Sprite start={30} end={41.5}><Scene4 /></Sprite>
      <Sprite start={41} end={52.5}><Scene5 /></Sprite>
      <Sprite start={52} end={61.5}><Scene6 /></Sprite>
      <Sprite start={61} end={70.5}><Scene7 /></Sprite>
      <Sprite start={70} end={73}><Scene8 /></Sprite>
    </Stage>
  );
}

window.SidewalkDemo = SidewalkDemo;
