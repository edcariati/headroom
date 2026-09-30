#!/usr/bin/env python3
"""Gera index.html (arquivo único) a partir de src/.

Ordem do JavaScript: core + p2 + p3 + p4 + views + nuvem + boot.
Uso: python3 build.py            (escreve index.html)
     python3 build.py --check   (falha se index.html estiver desatualizado)
"""
import sys, pathlib

RAIZ = pathlib.Path(__file__).parent
SRC = RAIZ / 'src'
ORDEM = ['core.js', 'p2.js', 'p3.js', 'p4.js', 'p5.js', 'views.js', 'nuvem.js', 'boot.js']

def ler(nome):
    return (SRC / nome).read_text(encoding='utf-8')

def montar():
    html = ler('template.html')
    script = ''.join(ler(n) for n in ORDEM)
    for chave, valor in (('{{STYLE}}', ler('style.css')), ('{{PROTO}}', ler('protocolo.json')), ('{{SCRIPT}}', script)):
        assert html.count(chave) == 1, chave
        html = html.replace(chave, valor)
    return html

if __name__ == '__main__':
    saida = RAIZ / 'index.html'
    novo = montar()
    if '--check' in sys.argv:
        if saida.read_text(encoding='utf-8') != novo:
            sys.exit('index.html está desatualizado: rode python3 build.py')
        print('index.html em dia')
    else:
        saida.write_text(novo, encoding='utf-8')
        print('index.html gerado (%d bytes)' % len(novo.encode('utf-8')))
