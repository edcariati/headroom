// Senha única do dono. A senha vem da variável de ambiente ADMIN_SENHA e é conferida sempre no servidor.
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
export const senhaConfere = (recebida, esperada) => !!esperada && crypto.timingSafeEqual(sha(recebida ?? ''), sha(esperada));

const DURACAO_S = 12 * 3600;
const assinatura = (senha, exp) => crypto.createHmac('sha256', sha(`sessao:${senha}`)).update(String(exp)).digest('hex');

export function criarSessao(senha, agoraMs = Date.now()) {
  const exp = Math.floor(agoraMs / 1000) + DURACAO_S;
  return `${exp}.${assinatura(senha, exp)}`;
}
export function sessaoValida(token, senha, agoraMs = Date.now()) {
  if (!token || !senha) return false;
  const [exp, sig] = String(token).split('.');
  if (!/^\d+$/.test(exp || '') || !sig || Number(exp) < agoraMs / 1000) return false;
  const esperada = assinatura(senha, exp);
  return sig.length === esperada.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperada));
}
export function lerCookie(cabecalho, nome) {
  for (const parte of String(cabecalho || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return null;
}
export const cookieSessao = (token, seguro) =>
  `sessao=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACAO_S}${seguro ? '; Secure' : ''}`;
export const cookieLimpo = (seguro) => `sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${seguro ? '; Secure' : ''}`;
