import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const base = process.env.LEADIA_TEST_ORIGIN;
assert(base?.startsWith('https://'), 'Defina LEADIA_TEST_ORIGIN HTTPS do dev');
function request(path, { method = 'GET', body, token, anon, object = false } = {}) {
  const args = ['--silent', '--show-error', '--max-time', '30', '-w', '\n%{http_code}', '-X', method, base + path];
  if (anon) args.push('-H', `apikey: ${anon}`, '-H', `Authorization: Bearer ${token || anon}`);
  if (object) args.push('-H', 'Accept: application/vnd.pgrst.object+json');
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-H', 'Prefer: return=representation', '--data-binary', JSON.stringify(body));
  const raw = execFileSync('curl', args, { encoding: 'utf8' });
  const end = raw.lastIndexOf('\n');
  const text = raw.slice(0, end);
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: Number(raw.slice(end + 1)), data };
}
const configText = request('/config.js').data;
const config = JSON.parse(configText.match(/=\s*(\{.*\});/)[1]);
assert.equal(config.appMode, 'real');
const anon = config.supabaseAnonKey;
assert(anon);
assert.equal(request('/api/healthz').status, 200);
assert.equal(request('/auth/v1/health').status, 200);
assert.equal(request('/auth/v1/admin/users', { anon }).status, 404);
assert([401, 403].includes(request('/rest/v1/leads', { anon }).status));
const password = randomBytes(24).toString('base64url');
const accounts = [];
for (let i = 0; i < 2; i++) {
  const email = `qa-${randomUUID()}@example.test`;
  const result = request('/auth/v1/signup', { method: 'POST', anon, body: { email, password } });
  assert.equal(result.status, 200, `signup: ${result.status} ${JSON.stringify(result.data)}`);
  assert(result.data.access_token, 'Cadastro deve retornar sessão neste dev sem SMTP');
  accounts.push({ email, password, id: result.data.user.id, token: result.data.access_token });
}
const [a, b] = accounts;
const api = (account, path, options = {}) => request('/rest/v1/' + path, { anon, token: account.token, ...options });
for (const account of accounts) {
  const result = api(account, 'rpc/get_or_create_org', { method: 'POST', body: {}, object: true });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  account.org = result.data.id;
  assert.equal(api(account, 'rpc/get_or_create_org', { method: 'POST', body: {}, object: true }).data.id, account.org);
}
assert.notEqual(a.org, b.org);
const created = api(a, 'leads', { method: 'POST', object: true, body: { org_id: a.org, name: 'QA persistência banco', value: 1250, next_action: 'Teste de recarga' } });
assert.equal(created.status, 201, JSON.stringify(created.data));
const lead = created.data;
assert.deepEqual(api(b, `leads?id=eq.${lead.id}`).data, []);
const forged = api(b, 'memberships', { method: 'POST', body: { org_id: a.org, user_id: b.id, role: 'owner' } });
assert([401, 403].includes(forged.status));
const message = api(a, 'rpc/append_message', { method: 'POST', object: true, body: { p_lead_id: lead.id, p_sender: 'consultor', p_content: 'Mensagem gravada no PostgreSQL' } });
assert.equal(message.status, 200, JSON.stringify(message.data));
const cross = api(b, 'messages', { method: 'POST', body: { org_id: b.org, conversation_id: message.data.conversation_id, lead_id: lead.id, sender: 'client', content: 'Tentativa entre organizações' } });
assert([400, 403, 409].includes(cross.status));
const followUp = api(a, 'follow_ups', { method: 'POST', object: true, body: { org_id: a.org, lead_id: lead.id, title: 'QA follow-up', when_label: 'Amanhã' } });
assert.equal(followUp.status, 201, JSON.stringify(followUp.data));
assert.equal(api(a, `leads?id=eq.${lead.id}`, { method: 'PATCH', body: { status: 'Qualificado' } }).status, 200);
assert.equal(api(a, `org_settings?org_id=eq.${a.org}`, { method: 'PATCH', body: { company_name: 'Empresa QA persistente' } }).status, 200);
assert.equal(api(a, `goals?org_id=eq.${a.org}`, { method: 'PATCH', body: { target_leads: 20 } }).status, 200);
const signed = request('/auth/v1/token?grant_type=password', { method: 'POST', anon, body: { email: a.email, password } });
assert.equal(signed.status, 200, JSON.stringify(signed.data));
a.token = signed.data.access_token;
const reloaded = api(a, `leads?id=eq.${lead.id}`).data[0];
assert.equal(reloaded.status, 'Qualificado');
assert.equal(Number(reloaded.value), 1250);
assert.equal(reloaded.next_action, 'Teste de recarga');
assert.equal(reloaded.last_message, 'Mensagem gravada no PostgreSQL');
assert.equal(api(a, `messages?lead_id=eq.${lead.id}`).data.length, 1);
assert.equal(api(a, `follow_ups?lead_id=eq.${lead.id}`).data.length, 1);
assert.equal(api(a, `lead_events?lead_id=eq.${lead.id}`).data.length, 2);
assert.equal(api(a, `org_settings?org_id=eq.${a.org}`).data[0].company_name, 'Empresa QA persistente');
assert.equal(api(a, `goals?org_id=eq.${a.org}`).data[0].target_leads, 20);
if (process.env.LEADIA_TEST_ACCOUNTS_FILE) writeFileSync(process.env.LEADIA_TEST_ACCOUNTS_FILE, JSON.stringify(accounts), { mode: 0o600 });
console.log(JSON.stringify({ result: 'PASS', origin: base, checks: ['TLS/readiness','signup/login','atomic bootstrap','persistent lead/message/follow-up/settings/goals/events','new-session reload','anonymous denial','tenant isolation','forged membership denial','cross-tenant FK denial','admin endpoint blocked'], testLeadId: lead.id }));
