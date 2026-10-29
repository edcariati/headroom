import pathlib, json
root=pathlib.Path(__file__).parent
FONTS="".join(f"@font-face{{font-family:'Manrope';font-weight:{w};src:url('../fonts/manrope-latin-{w}-normal.woff2')}}" for w in (400,500,600,700,800))
FONTS+="@font-face{font-family:'DM Serif Display';font-style:normal;src:url('../fonts/dm-serif-display-latin-400-normal.woff2')}@font-face{font-family:'DM Serif Display';font-style:italic;src:url('../fonts/dm-serif-display-latin-400-italic.woff2')}"
T="#c9683d"; D="#2d2722"; BG="#fffdfa"; TINT="#faf1eb"
CSS=FONTS+f"""
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Manrope',sans-serif;color:{D};background:{BG}}}
.f{{position:relative;width:var(--w);height:var(--h);background:linear-gradient(160deg,#fffdfa 0%,#fffdfa 55%,#faf1eb 100%);overflow:hidden;padding:var(--p);display:flex;flex-direction:column}}
.hd{{display:flex;justify-content:space-between;align-items:center}}
.brand{{display:flex;align-items:center;gap:20px;font-weight:700;letter-spacing:.24em;font-size:var(--bf)}}
.brand img{{width:var(--bl);height:var(--bl)}}
.tag{{font-weight:700;letter-spacing:.2em;font-size:var(--tf);color:{T};text-align:right;line-height:1.5}}
.eb{{font-weight:700;letter-spacing:.3em;font-size:var(--ef);color:{T};text-transform:uppercase;display:flex;align-items:center;gap:20px}}
.eb:after{{content:'';height:2px;width:90px;background:{T}}}
h1{{font-family:'DM Serif Display',serif;font-weight:400;font-size:var(--hf);line-height:1.03;letter-spacing:-.01em}}
h1 em{{color:{T}}}
.sub{{font-size:var(--sf);line-height:1.5;color:#5a4f47;font-weight:500}}
.ph{{position:relative;background-size:cover;background-position:center}}
.ph .cap{{position:absolute;left:0;right:0;bottom:0;padding:var(--cp);color:#fff;font-weight:700;letter-spacing:.2em;font-size:var(--cf);text-transform:uppercase;background:linear-gradient(0deg,rgba(45,39,34,.78),transparent)}}
.cards{{display:flex;gap:0;align-items:stretch;position:relative}}
.card:first-child{{padding-right:var(--ox)}}.card:nth-child(2){{padding-left:var(--ox)}}
.card{{flex:1;background:{TINT};border:2px solid {T};padding:var(--cd)}}
.card .k{{font-weight:800;letter-spacing:.24em;font-size:var(--kf);color:{T}}}
.card .t{{font-family:'DM Serif Display',serif;font-size:var(--tt);line-height:1.08;margin:12px 0 10px}}
.card .d{{font-size:var(--df);color:#5a4f47;font-weight:600;line-height:1.35}}
.ou{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:var(--ob);height:var(--ob);border-radius:50%;background:{T};color:#fff;font-weight:800;letter-spacing:.1em;font-size:var(--of);display:flex;align-items:center;justify-content:center;border:5px solid {BG}}}
.blk{{background:{T};color:#fff;padding:var(--bp);display:flex;justify-content:space-between;align-items:center;gap:40px}}
.blk .k{{font-weight:700;letter-spacing:.28em;font-size:var(--kf);opacity:.85}}
.blk h2{{font-family:'DM Serif Display',serif;font-weight:400;font-size:var(--bh);line-height:1.05;margin-top:12px}}
.blk .r{{text-align:left;border-left:2px solid rgba(255,255,255,.4);padding-left:40px}}
.blk .n{{font-family:'DM Serif Display',serif;font-size:var(--nf);white-space:nowrap}}
.btn{{white-space:nowrap;display:inline-block;margin-top:16px;background:{BG};color:{T};font-weight:800;letter-spacing:.14em;font-size:var(--btf);padding:var(--btp);text-transform:uppercase}}
.ft{{display:flex;justify-content:space-between;font-weight:600;letter-spacing:.1em;font-size:var(--ff);color:#7a6d63;margin-top:18px}}
"""
def page(w,h,v,body):
    vs=";".join(f"--{k}:{x}" for k,x in v.items())
    return f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body><div class=f style='--w:{w}px;--h:{h}px;{vs}'>{body}</div></body></html>"
VV=dict(p="80px",bf="26px",bl="68px",tf="18px",ef="24px",hf="100px",sf="32px",cp="22px 28px",cf="20px",cd="30px 32px",kf="18px",tt="48px",df="26px",ob="86px",ox="64px",of="24px",bp="44px 52px",bh="46px",nf="46px",btf="20px",btp="20px 30px",ff="17px")
SQ=dict(p="56px",bf="21px",bl="54px",tf="15px",ef="19px",hf="62px",sf="23px",cp="16px 20px",cf="15px",cd="22px 24px",kf="15px",tt="35px",df="21px",ob="68px",ox="50px",of="19px",bp="28px 40px",bh="40px",nf="40px",btf="17px",btp="14px 26px",ff="14px")
hdr='<div class="hd"><div class="brand"><img src="../assets/logo.jpg">MAIS PROJETOS</div><div class="tag">ARQUITETURA RESIDENCIAL<br>0 A 150 M²</div></div>'
def sp(n): return f"<div style='height:{n}px;flex:none'></div>"
FL="<div style='flex:1'></div>"
def photo(img,h,pos="center",cap=""):
    return f"<div class='ph' style=\"height:{h}px;background-image:url('../assets/{img}');background-position:{pos};flex:none\"><div class='cap'>{cap}</div></div>"
def cards():
    return ('<div class="cards"><div class="card"><div class="k">BÔNUS 01</div><div class="t">Taxa de aprovação da prefeitura</div><div class="d">Por nossa conta, no valor da taxa.</div></div>'
            '<div class="card" style="border-left:none"><div class="k">BÔNUS 02</div><div class="t">Projeto 3D realista da fachada</div><div class="d">Veja a sua casa pronta antes de construir.</div></div><div class="ou">OU</div></div>')
def blk(vert):
    return ('<div class="blk"><div><div class="k">PRÓXIMO PASSO</div><h2>Garanta o seu bônus em novembro.</h2></div>'
            '<div class="r"><div class="k">WHATSAPP</div><div class="n">(15) 99680-5291</div><div class="btn">Falar com a gente</div></div></div>')
FOOT='<div class="ft"><span>@MAISPROJETOS · ARQUITETURA PARA COMEÇAR DO JEITO CERTO</span><span>MAIS PROJETOS</span></div>'
def promo(vert):
    h1='<h1>Feche o seu projeto e <em>escolha o seu bônus.</em></h1>'
    eb='<div class="eb">Promoção de novembro</div>'
    sub='<p class="sub">Contratando o seu projeto com a gente em novembro, você leva um destes presentes. É só escolher.</p>'
    if vert:
        return hdr+sp(70)+eb+sp(26)+h1+sp(26)+sub+sp(40)+photo("casa_terracota.jpg",400,"center 55%","Projeto 3D realista da fachada")+sp(34)+cards()+FL+blk(True)+FOOT
    inner=f"<div style='display:flex;gap:36px;flex:none'><div style='flex:1;display:flex;flex-direction:column'>{eb}{sp(16)}{h1}{sp(14)}{sub}</div><div style='width:330px;flex:none'>{photo('casa_terracota.jpg',330,'center 58%','Fachada em 3D')}</div></div>"
    return hdr+sp(26)+inner+sp(22)+cards()+FL+blk(False)+FOOT
(root/"html").mkdir(exist_ok=True)
jobs=[]
for name,fn in [("promo_novembro",promo)]:
    for tag,(w,h,v,vert) in {"vertical_1080x1920":(1080,1920,VV,True),"quadrado_1080x1080":(1080,1080,SQ,False)}.items():
        f=f"{name}_{tag}"; (root/"html"/f"{f}.html").write_text(page(w,h,v,fn(vert))); jobs.append(dict(f=f,w=w,h=h))

BCSS=FONTS+"""
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Manrope',sans-serif;color:#2d2722;background:#fffdfa;width:1600px}
.w{padding:70px 80px 60px}
.eb{font-weight:700;letter-spacing:.3em;font-size:17px;color:#c9683d;text-transform:uppercase}
h1{font-family:'DM Serif Display',serif;font-weight:400;font-size:84px;line-height:1.02;margin:16px 0 14px}
h1 em{color:#c9683d}
h2{font-family:'DM Serif Display',serif;font-weight:400;font-size:40px;margin:6px 0 22px}
.lead{font-size:22px;color:#5a4f47;line-height:1.5;font-weight:500;max-width:1000px}
.sec{border-top:2px solid #c9683d;margin-top:54px;padding-top:30px}
.row{display:flex;gap:40px}
.sw{flex:1}.sw .c{height:150px;border:1px solid rgba(45,39,34,.15)}.sw b{display:block;margin-top:12px;font-size:20px}.sw span{font-size:16px;color:#5a4f47;line-height:1.4;display:block;margin-top:4px;font-weight:500}
.p{font-size:19px;line-height:1.55;color:#5a4f47;font-weight:500}
.sp1{font-family:'DM Serif Display',serif;font-size:76px;line-height:1.05}.sp1 i{color:#c9683d}
.ph{height:250px;background-size:cover;background-position:center}
.btn{display:inline-block;background:#c9683d;color:#fff;font-weight:800;letter-spacing:.14em;font-size:17px;padding:18px 30px;text-transform:uppercase}
.btn2{display:inline-block;background:#fffdfa;color:#c9683d;font-weight:800;letter-spacing:.14em;font-size:17px;padding:18px 30px;text-transform:uppercase}
.cap{font-size:15px;color:#7a6d63;margin-top:8px;font-weight:600;letter-spacing:.04em}
"""
def board_html():
    sw=lambda c,n,u,col="#2d2722":f"<div class=sw><div class=c style='background:{c}'></div><b>{n}</b><span>{c.upper()}<br>{u}</span></div>"
    ph=lambda img,pos="center":f"<div style='flex:1'><div class=ph style=\"background-image:url('../assets/{img}');background-position:{pos}\"></div></div>"
    return f"""<html><head><meta charset=utf-8><style>{BCSS}</style></head><body><div class=w>
<div class=eb>Identidade visual · lida do PDF "Resumo 1 página"</div>
<h1>Mais Projetos, <em>arquitetura sem complicação.</em></h1>
<p class=lead>Marca quente e acolhedora, de arquitetura residencial para casas de 0 a 150 m²: tons de terracota e café sobre fundo off-white, títulos serifados com palavra-chave em itálico e linguagem simples.</p>

<div class=sec><div class=row>
<div style="width:330px"><div class=eb>01 · Logo</div><div style="display:flex;gap:26px;align-items:center;margin-top:20px"><img src="../assets/logo.jpg" style="width:150px;height:150px"><div><div style="font-weight:700;letter-spacing:.24em;font-size:22px">MAIS PROJETOS</div><div style="font-weight:700;letter-spacing:.2em;font-size:13px;color:#c9683d;margin-top:10px;line-height:1.6">ARQUITETURA RESIDENCIAL<br>0 A 150 M²</div></div></div></div>
<div style="flex:1"><p class=p style="margin-top:44px">Símbolo em blocos 3D, terracota e marrom, que se encaixam e formam um <b>sinal de "+"</b> (de <i>Mais</i>). Fica sobre um quadrado preto, ao lado do nome em Manrope Bold, caixa-alta e espaçado. Descritor pequeno em terracota.</p></div>
</div></div>

<div class=sec><div class=eb>02 · Paleta</div><div class=row style="margin-top:22px">
{sw("#c9683d","Terracota","Cor principal: CTAs, destaques, blocos")}
{sw("#2d2722","Marrom café","Títulos e textos")}
{sw("#fffdfa","Off-white quente","Fundo (nunca branco puro)")}
{sw("#faf1eb","Pêssego claro","Cards e áreas suaves")}
{sw("#3e261c","Marrom do logo","Só no símbolo")}
</div></div>

<div class=sec><div class=eb>03 · Tipografia</div><div class=row style="margin-top:22px">
<div style="flex:1.4"><div class=sp1>Sua planta feita do seu jeito, <i>dentro do seu orçamento</i></div><div class=cap>DM Serif Display · Regular nos títulos, <i>Italic</i> em terracota na palavra-chave</div></div>
<div style="flex:1"><div style="font-weight:700;letter-spacing:.3em;font-size:17px;color:#c9683d">PARA COMEÇAR DO JEITO CERTO!</div><p class=p style="margin-top:16px;font-size:22px">Projetos residenciais claros e funcionais para transformar sua ideia, seu terreno e sua rotina em um caminho seguro para construir.</p><div class=cap>Manrope · 500 no texto, 700/800 em eyebrows, botões e rótulos (caixa-alta, tracking .2 a .3 em)</div></div>
</div></div>

<div class=sec><div class=eb>04 · Fotografia</div><div class=row style="margin-top:22px">
{ph("familia.jpg","center 35%")}{ph("casa_terracota.jpg","center 60%")}{ph("casa_sobrado.jpg","center 55%")}{ph("casa_noite.jpg","center 60%")}
</div><p class=p style="margin-top:16px">Fachadas realistas em 3D e fotos de famílias sorrindo com a planta na mão. Luz dourada de fim de tarde, céu suave, materiais terrosos (tijolo, reboco areia, madeira, preto fosco) que conversam com a terracota da marca.</p></div>

<div class=sec><div class=eb>05 · Componentes de layout</div><div class=row style="margin-top:22px;align-items:flex-start">
<div style="flex:1"><div class=eb>Eyebrow</div><p class=p style="margin-top:8px">Caixa-alta, terracota, tracking largo, às vezes com filete.</p></div>
<div style="flex:1"><div class=btn>Falar com a gente</div><div class=cap>CTA: retângulo reto, sem cantos arredondados</div></div>
<div style="flex:1.3;background:#c9683d;color:#fff;padding:26px 30px"><div style="font-weight:700;letter-spacing:.28em;font-size:13px;opacity:.85">PRÓXIMO PASSO</div><div style="font-family:'DM Serif Display';font-size:36px;margin:8px 0 14px">Manda a medida do seu terreno.</div><div class=btn2>Abrir WhatsApp</div></div>
<div style="flex:1"><div style="border-top:2px solid #c9683d;height:2px"></div><p class=p style="margin-top:10px">Filetes finos separando seções; cantos retos; muito respiro.</p></div>
</div></div>

<div class=sec><div class=eb>06 · Tom de voz</div><div class=row style="margin-top:18px">
<p class=p style="flex:1;font-size:22px"><b>Acolhedor e direto.</b> "A gente", "você", frases curtas.</p>
<p class=p style="flex:1;font-size:22px">"Arquitetura sem complicação." · "Manda a medida do seu terreno." · "Um sonho começa no papel."</p>
<p class=p style="flex:1;font-size:22px">Promessas de clareza e orçamento: <i>dentro do seu orçamento</i>, <i>caminho seguro para construir</i>, documentação CAIXA.</p>
</div></div>
</div></body></html>"""
(root/"html"/"identidade.html").write_text(board_html())
jobs.append(dict(f="identidade",w=1600,h=2600))
(root/"jobs.json").write_text(json.dumps(jobs))
