'use strict';
// Varredura de segredos nos arquivos versionados e no HTML gerado (auditoria 9A.10).
// O próprio teste prova que o detector funciona: um segredo plantado de propósito É encontrado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const PADROES = [
  ['chave secreta do Supabase (sb_secret_)', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['JWT (pode ser service_role)', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/],
  ['chave privada', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['chave de nuvem AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['URL de banco com senha', /postgres(ql)?:\/\/[^\s:@]+:[^\s@]{4,}@/],
  ['atribuição de service_role com valor', /service_role['"]?\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/]
];
const varre = (texto) => PADROES.filter(([, re]) => re.test(texto)).map(([n]) => n);

test('segurança · o detector de segredos funciona (segredos plantados são encontrados)', () => {
  assert.deepEqual(varre('x = "sb_secret_abcdefghijklmnop"'), ['chave secreta do Supabase (sb_secret_)']);
  assert.ok(varre('eyJhbGciOiJIUzI1NiJ9AAAA.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.AAAAAAAAAAAAAAAAAAAA').includes('JWT (pode ser service_role)'));
  assert.ok(varre('postgresql://postgres:minhasenha@db.exemplo.co:5432/postgres').length === 1);
  assert.deepEqual(varre('texto normal, sem segredo'), []);
});

test('segurança · nenhum arquivo versionado do app contém segredo', () => {
  const arquivos = execSync('git ls-files', { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => !/package-lock\.json$|\.png$|\.ico$/.test(f));
  const achados = [];
  arquivos.forEach((f) => { try { varre(fs.readFileSync(path.join(RAIZ, f), 'utf8')).forEach((n) => achados.push(f + ': ' + n)); } catch (e) {} });
  assert.deepEqual(achados, []);
});

test('segurança · o HTML gerado não leva segredo nem a chave service_role, e .env não é versionado', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  assert.deepEqual(varre(html), []);
  assert.doesNotMatch(html, /service_role['"]?\s*[:=]\s*['"]/);
  const gitignore = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  const versionados = execSync('git ls-files', { cwd: RAIZ, encoding: 'utf8' }).split('\n');
  assert.ok(!versionados.some((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)), 'nenhum .env versionado');
});

test('segurança · config.js só pode ter a chave pública (anon), nunca a secreta', () => {
  const cfg = fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8');
  assert.deepEqual(varre(cfg), []);
});
