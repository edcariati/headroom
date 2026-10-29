// Armazenamento no Vercel Blob PRIVADO. Um arquivo por registro; leitura sem cache e gravação com sobrescrita.
import * as blob from '@vercel/blob';

export class StoreBlob {
  constructor(sdk = blob) { this.sdk = sdk; }
  async listar(prefixo) {
    const out = [];
    let cursor;
    do {
      const r = await this.sdk.list({ prefix: prefixo, limit: 1000, cursor });
      for (const b of r.blobs) out.push({ caminho: b.pathname, etag: b.etag });
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }
  async ler(caminho) {
    const r = await this.sdk.get(caminho, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  }
  async gravar(caminho, obj) {
    // tenta de novo se o Blob recusar por excesso de chamadas ou falhar por um instante
    for (let tentativa = 1; ; tentativa++) {
      try {
        const r = await this.sdk.put(caminho, JSON.stringify(obj), {
          access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
        return r.etag;
      } catch (e) {
        if (tentativa >= 4) throw e;
        await new Promise((ok) => setTimeout(ok, 250 * tentativa * tentativa));
      }
    }
  }
  async excluir(caminho) { await this.sdk.del(caminho); }
}
