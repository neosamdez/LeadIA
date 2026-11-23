import { Shield, Database, Bot, MessageSquare, BarChart3, Lock, ArrowRight, Server, Workflow } from 'lucide-react';

const flow = [
  { icon: MessageSquare, title: 'Canais', desc: 'Instagram, WhatsApp e outros pontos de contato via APIs oficiais.' },
  { icon: Server, title: 'Ingestão/Webhooks', desc: 'Recebimento seguro de eventos, validação e enfileiramento.' },
  { icon: Bot, title: 'IA Comercial', desc: 'Classifica intenção, responde, qualifica e sugere próxima ação (RAG/guardrails).' },
  { icon: Database, title: 'CRM & Dados', desc: 'Leads, histórico, status, métricas e base de conhecimento da empresa.' },
  { icon: BarChart3, title: 'Painel & Insights', desc: 'Dashboard, analytics, alertas e acompanhamento humano.' },
];

export default function Arquitetura() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Arquitetura & LGPD</h1>
          <p>Visão técnica da solução, fluxo de dados, segurança e conformidade para apresentação à banca.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 22, display: 'flex', gap: 8, alignItems: 'center' }}><Workflow size={20} color="var(--acc)" /> Fluxo da solução</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
          {flow.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} style={{ position: 'relative' }}>
                <div style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.02)', height: '100%' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,90,82,.14)', color: '#FF8A84', display: 'grid', placeItems: 'center', marginBottom: 10 }}><Icon size={18} /></div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.45 }}>{s.desc}</div>
                </div>
                {i < flow.length - 1 && <div style={{ display: 'none' }}><ArrowRight size={16} /></div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--bg-alt)', fontSize: 13, color: 'var(--mute)' }}>
          <strong style={{ color: 'var(--ink)' }}>Fluxo resumido:</strong> Canal → Webhook/API oficial → Fila/Processamento → IA com contexto da empresa → CRM/Painel → Métricas e alertas → Handoff humano quando necessário.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><Shield size={18} color="#34D399" /> LGPD e conformidade</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['Base legal e consentimento', 'Coleta e uso de dados conforme finalidade, com transparência ao titular.'],
              ['Minimização de dados', 'Armazenar apenas o necessário para atendimento e conversão.'],
              ['Direitos do titular', 'Suporte a acesso, correção, exclusão e portabilidade quando aplicável.'],
              ['Retenção e auditoria', 'Políticas de retenção, logs de acesso e trilha de auditoria.'],
            ].map(([t, d]) => (
              <div key={t} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{t}</div>
                <div style={{ fontSize: 13, color: 'var(--mute)' }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><Lock size={18} color="#60A5FA" /> Segurança e limites</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['APIs oficiais da Meta', 'Uso de APIs oficiais, permissões e janelas de atendimento; sem promessas de acesso irrestrito.'],
              ['Controle de acesso', 'Autenticação, papéis (admin/vendedor) e princípio do menor privilégio.'],
              ['Proteção de dados', 'Criptografia em trânsito/repouso, segredos em vault e isolamento por tenant.'],
              ['Handoff humano', 'Casos sensíveis, baixa confiança ou alta complexidade são encaminhados para humano.'],
            ].map(([t, d]) => (
              <div key={t} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{t}</div>
                <div style={{ fontSize: 13, color: 'var(--mute)' }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>Stack planejada (produção)</h2>
        <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
          Front-end React/Next.js, backend FastAPI ou Node, PostgreSQL/Supabase, Redis para filas, integrações oficiais Meta/WhatsApp, LLM com RAG sobre base de conhecimento da empresa, observabilidade (logs/métricas/tracing) e CI/CD.
        </p>
      </div>

      <style>{`@media (max-width: 1100px){ .app-main [style*="repeat(5, minmax(0,1fr))"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important} } @media (max-width: 800px){ .app-main [style*="repeat(5, minmax(0,1fr))"], .app-main [style*="1fr 1fr"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}