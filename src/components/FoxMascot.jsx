import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './FoxMascot.css';

const routeMessages = {
  '/': 'Bem-vindo à LeadIA! Quer ver a demo em ação?',
  '/login': 'Entra aí! O painel demo está te esperando.',
  '/app': 'Dashboard pronto! Olha as métricas e o funil.',
  '/app/leads': 'Aqui você gerencia seus leads. Clica em Detalhes!',
  '/app/conversas': 'Dica: testa as sugestões da IA no chat!',
  '/app/pipeline': 'Arrasta os cards no Kanban, é divertido!',
  '/app/analytics': 'Gráficos interativos! Troca o tipo e explora.',
  '/app/alertas': 'Alertas inteligentes pra não perder nenhuma venda.',
  '/app/arquitetura': 'Aqui tem o fluxo técnico e LGPD pra banca.',
  '/app/configuracoes': 'Personaliza a IA e reseta a demo quando quiser.',
};

const clickMessages = [
  'Você clicou em mim! 🧡',
  'LeadIA transforma directs em vendas!',
  'Dica: use os cenários prontos no Dashboard.',
  'Resposta rápida = mais conversão!',
  'Posso te ajudar a impressionar a banca? 😄',
  'Follow-up inteligente salva vendas perdidas.',
  'Zoom! Tô correndo pela tela! 🦊',
  'Me pega se conseguir! 😄',
];

const playMessages = [
  'Vou dar uma voltinha por aqui!',
  'Correndo entre os botões! 🦊',
  'Explorando o painel...',
  'Opa, passando por aqui!',
  'Brincando enquanto você apresenta!',
];

function FoxSVG({ waving, blinking }) {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true" className={`fox-svg ${waving ? 'fox-wave' : ''} ${blinking ? 'fox-blink' : ''}`}>
      <defs>
        <linearGradient id="foxFur" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FF9A5A" />
          <stop offset="55%" stopColor="#FF6A3D" />
          <stop offset="100%" stopColor="#D93D32" />
        </linearGradient>
        <linearGradient id="foxFurDark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E85A35" />
          <stop offset="100%" stopColor="#B83028" />
        </linearGradient>
        <radialGradient id="foxBelly" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#FFF8F1" />
          <stop offset="100%" stopColor="#F3DCCB" />
        </radialGradient>
        <radialGradient id="foxFaceWhite" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0E0D4" />
        </radialGradient>
        <linearGradient id="foxEarInner" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#FFD6C2" />
          <stop offset="100%" stopColor="#FFB799" />
        </linearGradient>
        <radialGradient id="foxHighlight" cx="30%" cy="25%" r="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="foxSoft" x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="#000" floodOpacity=".15" />
        </filter>
      </defs>

      {/* tail */}
      <g className="fox-tail">
        <path d="M54 55 C68 49, 74 36, 66 28 C60 34, 55 40, 50 46 Z" fill="url(#foxFur)" />
        <path d="M55 53 C65 47, 69 38, 64 32 C59 37, 55 42, 51 47 Z" fill="url(#foxHighlight)" opacity=".45" />
        <path d="M67 30 C72 34, 70 41, 63 45 C65 40, 66 35, 67 30 Z" fill="#FFF4EC" opacity=".95" />
        <path d="M60 43 C63 40, 66 36, 66 32" stroke="rgba(0,0,0,.08)" strokeWidth="1.2" fill="none" />
      </g>

      {/* body */}
      <g className="fox-body-group" filter="url(#foxSoft)">
        <ellipse cx="40" cy="56" rx="17" ry="13" fill="url(#foxFur)" />
        <ellipse cx="40" cy="58" rx="10" ry="8" fill="url(#foxBelly)" />
        <ellipse cx="36" cy="51" rx="8" ry="5" fill="rgba(255,255,255,.18)" />
      </g>

      {/* paws */}
      <g className="fox-paw-back">
        <ellipse cx="48" cy="66" rx="4.8" ry="3.2" fill="url(#foxFurDark)" />
        <ellipse cx="48" cy="66.5" rx="2.8" ry="1.8" fill="#FFF4EC" />
      </g>
      <g className="fox-paw-front">
        <ellipse cx="32" cy="66" rx="4.8" ry="3.2" fill="url(#foxFur)" />
        <ellipse cx="32" cy="66.5" rx="2.8" ry="1.8" fill="#FFF4EC" />
      </g>

      {/* head */}
      <g className="fox-head">
        <path d="M22 33 C22 19, 30 12, 40 12 C50 12, 58 19, 58 33 C58 44, 50 50, 40 50 C30 50, 22 44, 22 33 Z" fill="url(#foxFur)" />
        <path d="M26 20 C30 15, 35 13, 40 13 C34 14, 29 17, 26 22 Z" fill="rgba(255,255,255,.22)" />
        {/* ears */}
        <g className="fox-ear-l">
          <path d="M26 24 L19 8 L33 15 Z" fill="url(#foxFur)" />
          <path d="M26 22 L21 11 L31 16 Z" fill="url(#foxEarInner)" />
        </g>
        <g className="fox-ear-r">
          <path d="M54 24 L61 8 L47 15 Z" fill="url(#foxFurDark)" />
          <path d="M54 22 L59 11 L49 16 Z" fill="url(#foxEarInner)" />
        </g>
        {/* face white */}
        <path d="M40 48 C31 48, 25 42, 25 36 C25 30, 31 28, 40 35 C49 28, 55 30, 55 36 C55 42, 49 48, 40 48 Z" fill="url(#foxFaceWhite)" />
        {/* eyes */}
        <g className="fox-eye">
          <ellipse cx="33" cy="32" rx="3.2" ry="3.4" fill="#1F2937" />
          <circle cx="34.2" cy="30.8" r="1.1" fill="#fff" />
          <circle cx="32.2" cy="33.2" r="0.5" fill="rgba(255,255,255,.6)" />
        </g>
        <g className="fox-eye">
          <ellipse cx="47" cy="32" rx="3.2" ry="3.4" fill="#1F2937" />
          <circle cx="48.2" cy="30.8" r="1.1" fill="#fff" />
          <circle cx="46.2" cy="33.2" r="0.5" fill="rgba(255,255,255,.6)" />
        </g>
        {/* snout / nose */}
        <ellipse cx="40" cy="38.5" rx="2.8" ry="2.1" fill="#2B3441" />
        <ellipse cx="39.2" cy="37.8" rx="0.8" ry="0.5" fill="rgba(255,255,255,.35)" />
        <path d="M40 40.2 L40 42.8 M37 43 Q40 45.2 43 43" stroke="#2B3441" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* cheeks */}
        <circle cx="28.5" cy="37.5" r="2.6" fill="#FFB4A8" opacity=".45" />
        <circle cx="51.5" cy="37.5" r="2.6" fill="#FFB4A8" opacity=".45" />
      </g>
    </svg>
  );
}

const SIZE = 80;
const MARGIN = 10;
const POS_KEY = 'leadia-fox-pos';

function clampPos(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxX = Math.max(MARGIN, w - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, h - SIZE - MARGIN);
  return { x: Math.min(maxX, Math.max(MARGIN, x)), y: Math.min(maxY, Math.max(MARGIN, y)) };
}

function defaultPos() {
  if (typeof window === 'undefined') return { x: 20, y: 20 };
  return clampPos(window.innerWidth - SIZE - 22, window.innerHeight - SIZE - 22);
}

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return defaultPos();
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return clampPos(p.x, p.y);
  } catch {}
  return defaultPos();
}

function randomTarget(current) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.random() < 0.38) {
    const els = Array.from(document.querySelectorAll('button, a.btn, .nav-item, .l-plan, .card'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 30 && r.height > 20 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
      });
    if (els.length) {
      const el = els[Math.floor(Math.random() * els.length)];
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width / 2 - SIZE / 2 + (Math.random() * 40 - 20);
      const ty = r.top - SIZE - 10 + (Math.random() * 16 - 8);
      const t = clampPos(tx, ty);
      if (Math.hypot(t.x - current.x, t.y - current.y) > 60) return t;
    }
  }
  for (let i = 0; i < 8; i++) {
    const t = clampPos(MARGIN + Math.random() * (w - SIZE - MARGIN * 2), MARGIN + Math.random() * (h - SIZE - MARGIN * 2));
    if (Math.hypot(t.x - current.x, t.y - current.y) > 90) return t;
  }
  return clampPos(MARGIN + Math.random() * (w - SIZE - MARGIN * 2), MARGIN + Math.random() * (h - SIZE - MARGIN * 2));
}

export default function FoxMascot() {
  const location = useLocation();
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const [waving, setWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [sparkle, setSparkle] = useState(0);
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, z: 0 });
  const hideTimer = useRef();
  const clickIndex = useRef(0);
  const playIndex = useRef(0);
  const dragRef = useRef(null);
  const wasDragged = useRef(false);
  const posRef = useRef(pos);
  const roamTimer = useRef();
  const runStopTimer = useRef();
  const pauseRoamUntil = useRef(0);

  const routeKey = useMemo(() => {
    const p = location.pathname;
    if (routeMessages[p]) return p;
    if (p.startsWith('/app/conversas')) return '/app/conversas';
    return p.startsWith('/app') ? '/app' : '/';
  }, [location.pathname]);

  function show(text, wave = true) {
    setMsg(text);
    setVisible(true);
    setWaving(wave);
    setTimeout(() => setWaving(false), 900);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3200);
  }

  useEffect(() => { posRef.current = pos; }, [pos]);

  useEffect(() => {
    show(routeMessages[routeKey] || 'Explora a LeadIA!');
    pauseRoamUntil.current = Date.now() + 2500;
  }, [routeKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
    }, 4200);
    const onResize = () => {
      const c = clampPos(posRef.current.x, posRef.current.y);
      posRef.current = c;
      setPos(c);
    };
    window.addEventListener('resize', onResize);
    return () => { clearInterval(id); clearTimeout(hideTimer.current); clearTimeout(roamTimer.current); clearTimeout(runStopTimer.current); window.removeEventListener('resize', onResize); };
  }, []);

  useEffect(() => {
    function schedule(delay = 1800 + Math.random() * 2200) {
      clearTimeout(roamTimer.current);
      roamTimer.current = setTimeout(move, delay);
    }
    function move() {
      if (dragging || Date.now() < pauseRoamUntil.current) { schedule(800); return; }
      const from = posRef.current;
      const to = randomTarget(from);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dir = dx < 0 ? -1 : 1;
      if (Math.abs(dx) > 8) setFacingLeft(dx < 0);
      setTilt({ x: Math.max(-8, Math.min(8, -dy * 0.03)), y: dir * 10, z: dir * -4 });
      setRunning(true);
      posRef.current = to;
      setPos(to);
      if (Math.random() < 0.28) {
        const t = playMessages[playIndex.current % playMessages.length];
        playIndex.current += 1;
        show(t, false);
      }
      clearTimeout(runStopTimer.current);
      runStopTimer.current = setTimeout(() => {
        setRunning(false);
        setTilt({ x: 0, y: 0, z: 0 });
        try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch {}
        schedule(1400 + Math.random() * 2400);
      }, 2900);
    }
    schedule(1600);
    return () => { clearTimeout(roamTimer.current); clearTimeout(runStopTimer.current); };
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    clearTimeout(roamTimer.current);
    clearTimeout(runStopTimer.current);
    setRunning(false);
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setTilt({ x: Math.max(-10, Math.min(10, dy * 0.06)), y: Math.max(-12, Math.min(12, dx * 0.06)), z: Math.max(-6, Math.min(6, dx * 0.02)) });
      const next = clampPos(d.originX + dx, d.originY + dy);
      posRef.current = next;
      setPos(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      wasDragged.current = !!d?.moved;
      setDragging(false);
      setTilt({ x: 0, y: 0, z: 0 });
      dragRef.current = null;
      pauseRoamUntil.current = Date.now() + 2600;
      try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch {}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    wasDragged.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, moved: false };
    setDragging(true);
  }

  function onClick() {
    if (wasDragged.current) { wasDragged.current = false; return; }
    const text = clickMessages[clickIndex.current % clickMessages.length];
    clickIndex.current += 1;
    setSparkle(s => s + 1);
    show(text, true);
    setTilt({ x: -6, y: 0, z: 0 });
    setTimeout(() => setTilt({ x: 0, y: 0, z: 0 }), 250);
    pauseRoamUntil.current = Date.now() + 2200;
  }

  const bubbleBelow = pos.y < 120;
  const bubbleW = 240;
  const center = pos.x + SIZE / 2;
  const half = bubbleW / 2;
  const minCenter = 12 + half;
  const maxCenter = (typeof window !== 'undefined' ? window.innerWidth : 1000) - 12 - half;
  const shift = Math.max(minCenter - center, Math.min(maxCenter - center, 0));
  const tiltStyle = { transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(${tilt.z}deg)` };

  return (
    <div
      className={`fox-mascot ${bubbleBelow ? 'bubble-below' : ''} ${dragging ? 'dragging' : ''} ${running ? 'fox-running' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      aria-live="polite"
    >
      <div className="fox-shadow" />
      {visible && <div className="fox-bubble" style={{ transform: `translateX(calc(-50% + ${shift}px))` }}>{msg}</div>}
      {sparkle > 0 && <div className="fox-sparkle" key={sparkle}>✨</div>}
      <button
        className={`fox-btn ${dragging ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
        onClick={onClick}
        aria-label="Mascote raposa da LeadIA - clique para interagir, arraste para mover"
        title="Clique para interagir • Arraste para mover"
      >
        <div className="fox-3d" style={tiltStyle}>
          <div className="fox-float">
            <div className={`fox-face-wrap ${facingLeft ? 'left' : ''}`}>
              <FoxSVG waving={waving} blinking={blinking} />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
