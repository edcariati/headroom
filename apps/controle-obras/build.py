#!/usr/bin/env python3
"""Gera index.html (arquivo único) a partir de src/.

Ordem do JavaScript: ver ORDEM abaixo. Também gera sw.js, manifest e ícones (PWA).
Uso: python3 build.py            (escreve index.html)
     python3 build.py --check   (falha se index.html estiver desatualizado)
"""
import sys, pathlib, hashlib

RAIZ = pathlib.Path(__file__).parent
SRC = RAIZ / 'src'
ORDEM = ['core.js', 'p2.js', 'p3.js', 'p4.js', 'p5.js', 'p7.js', 'views.js', 'nuvem.js', 'offline.js', 'boot.js']

def ler(nome):
    return (SRC / nome).read_text(encoding='utf-8')

def montar():
    html = ler('template.html')
    script = ''.join(ler(n) for n in ORDEM)
    for chave, valor in (('{{STYLE}}', ler('style.css')), ('{{PROTO}}', ler('protocolo.json')), ('{{SCRIPT}}', script)):
        assert html.count(chave) == 1, chave
        html = html.replace(chave, valor)
    return html

PWA_ESTATICOS = ['manifest.webmanifest']
ICONES = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']

def gerar_pwa(html):
    """Arquivos ao lado do index.html: sw.js (versão = hash do app + config.js), manifest e ícones."""
    cfg = (RAIZ / 'config.js').read_bytes() if (RAIZ / 'config.js').exists() else b''
    versao = hashlib.sha256(html.encode('utf-8') + cfg).hexdigest()[:12]
    sw = (SRC / 'pwa' / 'sw.js').read_text(encoding='utf-8').replace('__VERSAO__', versao)
    arquivos = {'sw.js': sw.encode('utf-8')}
    for n in PWA_ESTATICOS + ICONES:
        arquivos[n] = (SRC / 'pwa' / n).read_bytes()
    return arquivos

if __name__ == '__main__':
    saida = RAIZ / 'index.html'
    novo = montar()
    extras = gerar_pwa(novo)
    if '--check' in sys.argv:
        if saida.read_text(encoding='utf-8') != novo:
            sys.exit('index.html está desatualizado: rode python3 build.py')
        for nome, conteudo in extras.items():
            alvo = RAIZ / nome
            if not alvo.exists() or alvo.read_bytes() != conteudo:
                sys.exit(nome + ' está desatualizado: rode python3 build.py')
        print('index.html em dia')
    else:
        saida.write_text(novo, encoding='utf-8')
        for nome, conteudo in extras.items():
            (RAIZ / nome).write_bytes(conteudo)
        print('index.html gerado (%d bytes)' % len(novo.encode('utf-8')))
