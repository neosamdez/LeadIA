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
];

function FoxSVG({ waving, blinking }) {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true" className={`${waving ? 'fox-wave' : ''} ${blinking ? 'fox-blink' : ''}`}>
      <defs>
        <linearGradient id="foxBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8A4C" />
          <stop offset="100%" stopColor="#E8453C" />
        </linearGradient>
      </defs>
      {/* tail */}
      <g className="fox-tail">
        <path d="M52 50 C64 44, 68 34, 60 28 C56 34, 52 38, 48 42 Z" fill="url(#foxBody)" />
        <path d="M61 30 C66 34, 64 40, 58 43 C60 39, 61 35, 61 30 Z" fill="#FFF3E8" opacity="0.9" />
      </g>
      {/* body */}
      <ellipse cx="38" cy="52" rx="16" ry="12" fill="url(#foxBody)" />
      <ellipse cx="38" cy="55" rx="9" ry="7" fill="#FFF3E8" opacity="0.95" />
      {/* head */}
      <path d="M20 30 C20 18, 28 12, 38 12 C48 12, 56 18, 56 30 C56 40, 48 46, 38 46 C28 46, 20 40, 20 30 Z" fill="url(#foxBody)" />
      {/* ears */}
      <path d="M24 22 L18 8 L30 14 Z" fill="#FF8A4C" />
      <path d="M24 20 L20 11 L28 15 Z" fill="#FFD1B3" />
      <path d="M52 22 L58 8 L46 14 Z" fill="#FF8A4C" />
      <path d="M52 20 L56 11 L48 15 Z" fill="#FFD1B3" />
      {/* face white */}
      <path d="M38 44 C30 44, 24 39, 24 33 C24 28, 30 26, 38 32 C46 26, 52 28, 52 33 C52 39, 46 44, 38 44 Z" fill="#FFF3E8" />
      {/* eyes */}
      <g className="fox-eye"><circle cx="31" cy="29" r="2.8" fill="#1F2937" /><circle cx="32" cy="28" r="0.9" fill="#fff" /></g>
      <g className="fox-eye"><circle cx="45" cy="29" r="2.8" fill="#1F2937" /><circle cx="46" cy="28" r="0.9" fill="#fff" /></g>
      {/* nose */}
      <ellipse cx="38" cy="35" rx="2.4" ry="1.8" fill="#1F2937" />
      <path d="M38 36.5 L38 39 M35.5 39 Q38 41 40.5 39" stroke="#1F2937" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="27" cy="34" r="2.2" fill="#FFB4A8" opacity="0.55" />
      <circle cx="49" cy="34" r="2.2" fill="#FFB4A8" opacity="0.55" />
      {/* paw */}
      <g className="fox-paw"><ellipse cx="28" cy="60" rx="4.2" ry="3" fill="#FF8A4C" /><ellipse cx="28" cy="60" rx="2.4" ry="1.7" fill="#FFF3E8" /></g>
      <ellipse cx="48" cy="60" rx="4.2" ry="3" fill="#FF8A4C" />
      <ellipse cx="48" cy="60" rx="2.4" ry="1.7" fill="#FFF3E8" />
    </svg>
  );
}

export default function FoxMascot() {
  const location = useLocation();
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const [waving, setWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [sparkle, setSparkle] = useState(0);
  const hideTimer = useRef();
  const clickIndex = useRef(0);

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
    hideTimer.current = setTimeout(() => setVisible(false), 3500);
  }

  useEffect(() => {
    show(routeMessages[routeKey] || 'Explora a LeadIA!');
  }, [routeKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
    }, 4200);
    return () => { clearInterval(id); clearTimeout(hideTimer.current); };
  }, []);

  function onClick() {
    const text = clickMessages[clickIndex.current % clickMessages.length];
    clickIndex.current += 1;
    setSparkle(s => s + 1);
    show(text, true);
  }

  return (
    <div className="fox-mascot" aria-live="polite">
      {visible && <div className="fox-bubble">{msg}</div>}
      {sparkle > 0 && <div className="fox-sparkle" key={sparkle}>✨</div>}
      <button className="fox-btn fox-float" onClick={onClick} aria-label="Mascote raposa da LeadIA">
        <FoxSVG waving={waving} blinking={blinking} />
      </button>
    </div>
  );
}