'use strict';
// Equivalência servidor × navegador: as mesmas obras/ocorrências/contas nas duas implementações
// das regras de notificação (app em jsdom × função SQL em Postgres local) têm de dar listas idênticas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { abrir, obra, obraAdm, dia } = require('./helpers');

const temPg = spawnSync('bash', ['-c', 'which psql && ls /usr/lib/postgresql/*/bin/initdb'], { encoding: 'utf8' }).status === 0;

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
function sqlDoSeed(seed) {
  const out = [];
  Object.keys(seed).forEach((tab) => Object.keys(seed[tab]).forEach((id) => {
    const d = seed[tab][id];
    out.push('insert into public.' + JSON.stringify(tab) + '(id,obra_id,dados) values (' + q(id) + ',' + (tab === 'obras' ? q(id) : (d.obraId ? q(d.obraId) : 'null')) + ',' + q(JSON.stringify(d)) + '::jsonb);');
  }));
  return 'set session_replication_role = replica;\n' + out.join('\n');
}

const seed = () => ({
  obras: {
    a1: obraAdm({ nome: 'Adm padrão' }),
    a2: obraAdm({ nome: 'Adm 3 dias', diasEscalar: 3 }),
    g1: obra({ nome: 'Gestão' }),
    e1: obraAdm({ nome: 'Encerrada', situacao: 'encerrada' })
  },
  ocorrencias: {
    c1: { obraId: 'a1', gravidade: 'critica', status: 'aberta' },
    c2: { obraId: 'a1', gravidade: 'critica' },                         // sem status = aberta
    c3: { obraId: 'a1', gravidade: 'critica', status: 'fechada' },
    h0: { obraId: 'a1', gravidade: 'media', status: 'aberta', prazo: dia(0) },   // vence hoje: não está vencida
    h1: { obraId: 'a1', gravidade: 'media', status: 'aberta', prazo: dia(-1) },
    h7: { obraId: 'a1', gravidade: 'media', status: 'aberta', prazo: dia(-7) },  // 7 dias: não escala (limite > 7)
    h8: { obraId: 'a1', gravidade: 'media', status: 'aberta', prazo: dia(-8) },  // 8 dias: escala
    t3: { obraId: 'a2', gravidade: 'media', status: 'aberta', prazo: dia(-3) },  // diasEscalar 3: não escala
    t4: { obraId: 'a2', gravidade: 'media', status: 'aberta', prazo: dia(-4) },  // escala
    x1: { obraId: 'a1', gravidade: 'media', status: 'aberta', prazo: '' },
    g1: { obraId: 'g1', gravidade: 'critica', status: 'aberta', prazo: dia(-20) },
    z1: { obraId: 'e1', gravidade: 'critica', status: 'aberta', prazo: dia(-20) }
  },
  contasPagar: {
    k1: { obraId: 'a1', status: 'aberta', vencimento: dia(-1) },
    k2: { obraId: 'a1', status: 'aberta', vencimento: dia(0) },
    k3: { obraId: 'a1', status: 'aberta', vencimento: dia(3) },
    k4: { obraId: 'a1', status: 'aberta', vencimento: dia(4) },
    k5: { obraId: 'a1', status: 'paga', vencimento: dia(-10) },
    k6: { obraId: 'g1', status: 'aberta', vencimento: dia(-10) },   // Gestão: sem contas a pagar
    k7: { obraId: 'a1', status: 'aberta', vencimento: '' }
  },
  aportes: {
    p1: { obraId: 'a1', dataPrevista: dia(-1) },
    p2: { obraId: 'a1', dataPrevista: dia(-1), dataRecebida: dia(0) },
    p3: { obraId: 'a1', dataPrevista: dia(0) },
    p4: { obraId: 'g1', dataPrevista: dia(-5) }
  },
  acoes: {
    q1: { obraId: 'a1', status: 'aberta', prazo: dia(-1) },
    q2: { obraId: 'a1', status: 'aberta', prazo: dia(-8) },
    q3: { obraId: 'a1', status: 'concluida', prazo: dia(-8) },
    q4: { obraId: 'a1', status: 'aberta', prazo: dia(0) }
  },
  rfis: {
    f1: { obraId: 'a1', status: 'aberto', prazo: dia(-1) },
    f2: { obraId: 'a1', status: 'respondido', prazo: dia(-1) },
    f3: { obraId: 'a1', status: 'aberto', prazo: dia(0) }
  },
  materiais: {
    t1: { obraId: 'a1', resultado: 'pendente', prazo: dia(-1) },
    t2: { obraId: 'a1', resultado: 'aprovado', prazo: dia(-1) }
  },
  aditivos: {
    d1: { obraId: 'a1', status: 'aguardando_cliente', enviadoEm: dia(-8) + 'T10:00:00Z' },
    d2: { obraId: 'a1', status: 'aguardando_cliente', enviadoEm: dia(-7) + 'T10:00:00Z' },
    d3: { obraId: 'a1', status: 'assinado', enviadoEm: dia(-30) + 'T10:00:00Z' }
  },
  medicoes: {
    m1: { obraId: 'a1', status: 'em_analise', analiseDesde: dia(-7) + 'T10:00:00Z' },   // 7 dias: não
    m2: { obraId: 'a1', status: 'em_analise', analiseDesde: dia(-8) + 'T10:00:00Z' },   // 8 dias: sim
    m3: { obraId: 'a1', status: 'aprovada', analiseDesde: dia(-30) + 'T10:00:00Z' },
    m4: { obraId: 'a2', status: 'em_analise', analiseDesde: dia(-4) + 'T10:00:00Z' }     // diasEscalar 3: sim
  }
});

test('equivalência · eventos do servidor (SQL) = eventos do app, nos mesmos dados', { skip: !temPg && 'Postgres local indisponível' }, async () => {
  const s = seed();
  const e = await abrir({ seed: s });
  const app = Array.from(e.x.eventosNotificaveis());

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eqv-'));
  fs.chmodSync(dir, 0o755);
  const arq = path.join(dir, 'seed.sql'); fs.writeFileSync(arq, sqlDoSeed(s)); fs.chmodSync(arq, 0o644);
  const r = spawnSync('bash', [path.join(__dirname, '..', 'supabase', 'tests', 'consulta_eventos.sh'), arq, dia(0)], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'consulta SQL falhou: ' + r.stderr);
  const sql = r.stdout.split('\n').map((x) => x.trim()).filter(Boolean).sort();

  assert.ok(app.length >= 24, 'o cenário precisa ter eventos de verdade (' + app.length + ')');
  assert.deepEqual(sql, app);
});

test('equivalência · sanidade do cenário: limites exatos do app', async () => {
  const e = await abrir({ seed: seed() });
  const ev = Array.from(e.x.eventosNotificaveis());
  assert.ok(ev.includes('oc_vencida|a1|h1') && !ev.includes('oc_vencida|a1|h0'), 'vencer hoje não é vencida');
  assert.ok(!ev.includes('oc_escalada|a1|h7') && ev.includes('oc_escalada|a1|h8'), 'escala só acima de diasEscalar');
  assert.ok(ev.includes('oc_escalada|a2|t4') && !ev.includes('oc_escalada|a2|t3'), 'diasEscalar próprio da obra');
  assert.ok(!ev.some((x) => x.startsWith('conta_') && x.includes('|g1|')), 'Gestão não tem contas a pagar');
  assert.ok(!ev.some((x) => x.includes('|e1|')), 'obra encerrada não notifica');
});
