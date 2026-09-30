'use strict';
// Ajudantes dos testes: abrem o index.html no jsdom com um banco falso
// (o mesmo contrato do window.claude.use('db') que o app usa dentro do Claude).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dia = (n) => { const x = new Date(); x.setDate(x.getDate() + (n || 0)); return iso(x); };
const segunda = (s) => { const p = s.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const mesAtras = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function bancoFalso(seed) {
  const data = {}, subs = {};
  const col = (c) => data[c] || (data[c] = new Map());
  Object.keys(seed || {}).forEach((c) => Object.keys(seed[c]).forEach((id) => col(c).set(id, clone(seed[c][id]))));
  const snap = (c) => ({ docs: Array.from(col(c)).map(([id, d]) => ({ id, exists: true, data: () => clone(d) })) });
  const notifica = (c) => (subs[c] || []).forEach((cb) => cb(snap(c)));
  return {
    data, col, notifica,
    linhas: (c) => Array.from(col(c)).map(([id, d]) => Object.assign({ id }, clone(d))),
    api: {
      collection: (c) => ({ onSnapshot(cb) { (subs[c] = subs[c] || []).push(cb); Promise.resolve().then(() => cb(snap(c))); return () => {}; } }),
      doc: (p) => {
        const i = p.indexOf('/'), c = p.slice(0, i), id = p.slice(i + 1);
        return {
          set: async (d) => { col(c).set(id, clone(d)); notifica(c); },
          delete: async () => { col(c).delete(id); notifica(c); }
        };
      }
    }
  };
}

// Dados-base para os testes
const obra = (over) => Object.assign({ nome: 'Casa Teste', cliente: 'Cliente Teste', tipologia: 'Casa térrea', modalidade: 'Gestão de Obras', metaPPC: 80, diasEscalar: 7, margemPreco: 5, alcada: null, area: 120, inicio: dia(-10), criadoEm: new Date().toISOString() }, over || {});
const obraAdm = (over) => obra(Object.assign({ nome: 'Casa Adm', modalidade: 'Administração de Obra' }, over || {}));

async function abrir(opts) {
  opts = opts || {};
  const db = bancoFalso(opts.seed);
  const erros = [];
  const gancho = {};
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/' + (opts.hash || '#/painel'),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(win) {
      win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      win.HTMLDialogElement.prototype.close = function () { if (this.hasAttribute('open')) { this.removeAttribute('open'); this.dispatchEvent(new win.Event('close')); } };
      Object.defineProperty(win.HTMLDialogElement.prototype, 'open', { configurable: true, get() { return this.hasAttribute('open'); } });
      win.__COB_TEST_HOOK = (x) => { gancho.x = x; };
      win.scrollTo = () => {};
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.URL.createObjectURL = () => 'blob:teste';
      win.URL.revokeObjectURL = () => {};
      const user = { id: async () => 'u1', can: async () => opts.somenteLeitura ? false : true, profiles: async () => ({}) };
      win.claude = { use: async (nome) => (nome === 'db' ? db.api : (nome === 'user' ? user : null)) };
      win.addEventListener('error', (e) => erros.push(e.message));
      const ce = win.console.error; win.console.error = (...a) => { erros.push(a.join(' ')); ce.apply(win.console, a); };
    }
  });
  const win = dom.window, doc = win.document;
  const tick = (ms) => espera(ms == null ? 90 : ms);
  await tick(250);

  const env = {
    win, doc, db, erros, tick,
    get x() { return gancho.x; },
    app: () => doc.getElementById('app').textContent.replace(/\s+/g, ' '),
    dlg: () => doc.getElementById('dlg').textContent.replace(/\s+/g, ' '),
    dlgAberto: () => doc.getElementById('dlg').hasAttribute('open'),
    linhas: db.linhas,
    async go(h) { win.location.hash = h; await tick(); },
    async click(sel, ms) {
      const el = doc.querySelector(sel);
      if (!el) throw new Error('não achei ' + sel + '\nTela: ' + env.app().slice(0, 400) + '\nDiálogo: ' + env.dlg().slice(0, 300));
      el.click(); await tick(ms);
    },
    async submit(vals, ms) {
      const form = doc.querySelector('#dform');
      if (!form) throw new Error('nenhum formulário aberto. Diálogo: ' + env.dlg().slice(0, 300));
      Object.keys(vals || {}).forEach((k) => {
        const els = Array.from(form.querySelectorAll('[name="' + k + '"]'));
        if (!els.length) throw new Error('campo inexistente no formulário: ' + k);
        if (els[0].type === 'radio') {
          if (!els.some((e) => e.value === String(vals[k]))) throw new Error('opção inexistente em ' + k + ': ' + vals[k]);
          els.forEach((e) => { e.checked = (e.value === String(vals[k])); });
        } else {
          els[0].value = vals[k];
          if (els[0].tagName === 'SELECT' && els[0].value !== String(vals[k])) throw new Error('opção inexistente em ' + k + ': ' + vals[k]);
        }
      });
      form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
      await tick(ms == null ? 160 : ms);
    },
    erroForm: () => { const e = doc.getElementById('derr'); return e && !e.classList.contains('hide') ? e.textContent : ''; },
    async recarrega(c, id, d) { db.col(c).set(id, clone(d)); db.notifica(c); await tick(); }
  };
  return env;
}

module.exports = { abrir, obra, obraAdm, dia, segunda, mesAtras, iso, clone };
