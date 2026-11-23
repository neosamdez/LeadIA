import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, Compass } from 'lucide-react';
import { useApp } from '../context/AppContext';

const steps = [
  { path: '/app', title: 'Dashboard', text: 'Veja métricas-chave: leads recebidos, taxa de conversão e receita simulada.' },
  { path: '/app/leads', title: 'Leads', text: 'Gerencie leads, filtre por status, crie novos contatos e acompanhe oportunidades.' },
  { path: '/app/conversas', title: 'Conversas', text: 'Acompanhe o histórico e simule respostas da IA para demonstrar o atendimento comercial.' },
  { path: '/app/pipeline', title: 'Pipeline', text: 'Arraste leads entre etapas no Kanban para atualizar o funil em tempo real.' },
  { path: '/app/analytics', title: 'Analytics', text: 'Analise funil, canais, motivos de perda e recomendações da IA para decisões comerciais.' },
  { path: '/app/alertas', title: 'Alertas', text: 'Veja ações prioritárias: leads quentes, propostas pendentes e objeções detectadas.' },
  { path: '/app/arquitetura', title: 'Arquitetura & LGPD', text: 'Mostre à banca o fluxo técnico, segurança, limites da Meta e conformidade com LGPD.' },
  { path: '/app/configuracoes', title: 'Configurações', text: 'Ajuste o tom da IA, regras de follow-up e resete a demonstração quando necessário.' },
];

export default function Tour() {
  const { tour, nextTour, endTour } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!tour.active) return;
    const step = steps[tour.step];
    if (step && location.pathname !== step.path) navigate(step.path);
  }, [tour.active, tour.step]);

  if (!tour.active) return null;
  const step = steps[tour.step];
  if (!step) {
    return (
      <div style={{ position: 'fixed', right: 20, bottom: 20, width: 340, maxWidth: 'calc(100vw - 40px)', background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)), var(--surf)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 16, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,.4)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8 }}><Compass size={18} color="#FF6A5E" /> Tour concluído</div>
        <p style={{ margin: '0 0 14px', color: 'var(--mute)', fontSize: 14 }}>Você percorreu o fluxo principal da LeadIA. Agora você pode usar os cenários prontos no Dashboard para demonstrar ao vivo.</p>
        <button className="btn btn-primary btn-sm" onClick={endTour}>Fechar</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, width: 360, maxWidth: 'calc(100vw - 40px)', background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)), var(--surf)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 16, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,.4)', zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>TOUR GUIADO · {tour.step + 1}/{steps.length}</div>
        <button onClick={endTour} style={{ background: 'transparent', border: 0, color: 'var(--mute)', cursor: 'pointer' }} aria-label="Fechar tour"><X size={16} /></button>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0 6px' }}>{step.title}</div>
      <p style={{ margin: '0 0 16px', color: 'var(--mute)', fontSize: 14, lineHeight: 1.5 }}>{step.text}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={nextTour}>{tour.step === steps.length - 1 ? 'Concluir' : 'Próximo'} <ArrowRight size={14} /></button>
        <button className="btn btn-ghost btn-sm" onClick={endTour} style={{ color: 'var(--mute)' }}>Pular</button>
      </div>
    </div>
  );
}