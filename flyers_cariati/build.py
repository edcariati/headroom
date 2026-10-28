import pathlib
root=pathlib.Path(__file__).parent
CSS="""
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#fff;background:#05090c;overflow:hidden}
.f{position:relative;width:var(--w);height:var(--h);background:radial-gradient(120% 80% at 50% 0%,#12303f 0%,#07121a 55%,#03070a 100%);overflow:hidden;display:flex;flex-direction:column;padding:var(--p)}
.f:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(95,193,227,.07) 0 2px,transparent 2px 120px);pointer-events:none}
.z{position:relative;z-index:2}
.logo{height:var(--lh);align-self:center}
.eyebrow{font-weight:700;letter-spacing:.28em;font-size:var(--e);color:#5fc1e3;text-transform:uppercase;text-align:center}
h1{font-weight:800;line-height:1.08;font-size:var(--h1);text-align:center;letter-spacing:-.01em}
h1 em{font-style:normal;color:#5fc1e3}
.sub{font-size:var(--s);line-height:1.4;color:#c5d3db;text-align:center;font-weight:400}
.sub b{color:#fff}
.rule{width:140px;height:4px;background:linear-gradient(90deg,#2b7f9c,#5fc1e3);margin:var(--g) auto}
.cta{background:#5fc1e3;color:#07121a;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:center;font-size:var(--c);padding:var(--cp);align-self:center}
.contact{text-align:center;font-weight:700;font-size:var(--t);line-height:1.5}
.contact small{display:block;font-weight:500;color:#9fb4bf;font-size:calc(var(--t)*.62);letter-spacing:.06em;margin-top:6px}
.wa{color:#25d366}
.foot{text-align:center;color:#8aa2af;font-size:var(--fs);letter-spacing:.06em}
.photo{background-size:cover;background-position:center;border:2px solid rgba(95,193,227,.35)}
.list{list-style:none;display:flex;flex-direction:column;gap:var(--lg)}
.list li{font-weight:700;font-size:var(--ls);padding-left:1.6em;position:relative;letter-spacing:.02em}
.list li:before{content:'';position:absolute;left:0;top:.35em;width:.7em;height:.7em;background:#5fc1e3}
.list li span{display:block;font-weight:400;color:#9fb4bf;font-size:.62em;margin-top:2px;letter-spacing:0}
.stat{display:flex;align-items:baseline;justify-content:center;gap:18px}
.stat b{font-size:var(--big);font-weight:800;line-height:1}
.stat b i{font-style:normal;color:#5fc1e3}
.stat span{font-weight:800;letter-spacing:.3em;font-size:calc(var(--big)*.18)}
.chips{display:grid;grid-template-columns:1fr 1fr;gap:var(--chg)}
.chip{border:2px solid rgba(95,193,227,.6);color:#fff;font-weight:700;font-size:var(--chf);padding:var(--chp);letter-spacing:.02em;text-align:center;background:rgba(95,193,227,.08)}
.statrow{display:flex;justify-content:space-around;gap:20px}
.sn{font-weight:800;font-size:var(--sn);color:#5fc1e3;line-height:1}
.sl{font-size:var(--sl);color:#c5d3db;margin-top:8px;letter-spacing:.03em}
.gestao .card{padding:14px 20px}.gestao .card h3{margin:4px 0;font-size:28px}.gestao .card p{font-size:20px}
.bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(3px);transform:scale(1.05)}
.bg:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,10,16,.50),rgba(3,10,16,.62) 45%,rgba(3,10,16,.92))}
.light .bg:after{background:linear-gradient(180deg,rgba(247,245,240,.68),rgba(247,245,240,.78) 45%,rgba(240,237,230,.96))}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--g3)}
.card{background:rgba(255,255,255,.05);border-top:4px solid #5fc1e3;padding:var(--cd)}
.card .l{font-size:var(--cl);font-weight:800;color:#5fc1e3}
.card h3{font-size:var(--ch);margin:8px 0}
.card p{font-size:var(--cp2);color:#c5d3db;line-height:1.35}
"""

LIGHT="""
.f.light{background:radial-gradient(120% 80% at 50% 0%,#ffffff 0%,#f3f1ec 60%,#e9e6df 100%);color:#0b1f2b}
.light:before{background:repeating-linear-gradient(90deg,rgba(11,31,43,.045) 0 2px,transparent 2px 120px)}
.light .eyebrow{color:#2a7c99}
.light h1 em{color:#2a7c99}
.light .sub{color:#4a5b66}.light .sub b{color:#0b1f2b}
.light .cta{background:#0b1f2b;color:#fff}
.light .wa{color:#128c4a}
.light .contact small{color:#5b6c77}
.light .foot{color:#6b7b85}
.light .photo{border:2px solid rgba(11,31,43,.15)}
.light .list li:before{background:#2a7c99}.light .list li span{color:#5b6c77}
.light .card{background:#fff;border-top-color:#2a7c99;box-shadow:0 6px 22px rgba(11,31,43,.08)}
.light .card .l{color:#2a7c99}.light .card p{color:#4a5b66}
.light .chip{border-color:#2a7c99;color:#0b1f2b;background:rgba(42,124,153,.08)}
.light .sn{color:#2a7c99}.light .sl{color:#4a5b66}
.light .stat b i{color:#2a7c99}
"""
def page(w,h,body,vars_,light=False):
    v=";".join(f"--{k}:{x}" for k,x in vars_.items())
    cls=' light' if light else ''
    return f"<html><head><meta charset=utf-8><style>{CSS}{LIGHT}</style></head><body><div class='f{cls}' style='--w:{w}px;--h:{h}px;{v}'>{body}</div></body></html>"
L='<img class="logo z" src="assets/logo.png">'
def mkph(n2):
    return '<div class="contact z"><span class=wa style="font-size:.7em;letter-spacing:.2em;text-transform:uppercase">WhatsApp</span><br>(15) 99680-5291 &nbsp;·&nbsp; '+n2+'<small>cariati.com.br · Tatuí e região</small></div>'
PH=mkph('(15) 99841-9295')
PH2=mkph('(15) 99841-9295')
FOOT='<div class="foot z">CARIATI ARQUITETURA LTDA · RESP. TÉCNICO ARQUITETO CAU/SP A120704-0</div>'
V=dict(w=1080,h=1920)
VV=dict(p="90px",lh="190px",e="26px",h1="74px",s="36px",g="36px",c="34px",cp="30px 60px",t="44px",fs="19px",ls="42px",lg="30px",big="260px",sn="74px",sl="26px",chg="18px",chf="40px",chp="20px 20px",g3="22px",cd="26px",cl="30px",ch="38px",cp2="27px")
SQ=dict(p="64px",lh="140px",e="21px",h1="64px",s="28px",g="26px",c="27px",cp="22px 46px",t="34px",fs="15px",ls="35px",lg="24px",big="150px",sn="42px",sl="19px",chg="10px",chf="25px",chp="11px 10px",g3="16px",cd="22px",cl="26px",ch="32px",cp2="23px")
def photo(img,h,pos="center"):
    return f"<div class='photo z' style=\"flex:none;height:{h}px;background-image:url('assets/{img}');background-position:{pos}\"></div>"
def sp(n): return f"<div style='height:{n}px;flex:none'></div>"
def flex(): return "<div style='flex:1'></div>"
SERV=["Projetos","Obras","Regularização","Financiamento"]
def chips(extra=''): return f'<div class="chips z {extra}">'+''.join(f'<span class=chip>{x}</span>' for x in SERV)+'</div>'
F={}
# 1 tudo em um só lugar
def f1(vert):
    li=lambda t,s='':f"<li>{t}<span>{s}</span></li>"
    items=li("Projeto arquitetônico","Planta, fachada e imagens 3D")+li("Projetos complementares","Estrutural, elétrico e hidrossanitário")+li("Projeto de interiores","Layout, acabamentos e mobiliário")+li("Regularização de obras","Aprovação na prefeitura")+li("Gestão e execução de obras","Cronograma e controle de cada etapa")+li("Financiamento Caixa","Financie a sua obra")
    if vert:
        return L+sp(40)+'<div class="eyebrow z">Tudo em um só lugar</div>'+sp(20)+'<h1 class=z style="white-space:nowrap;font-size:70px">Do projeto <em>à chave na mão</em></h1>'+sp(60)+f'<ul class="list z">{items}</ul>'+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(40)+PH2+sp(30)+FOOT
    return L+sp(26)+'<div class="eyebrow z">Tudo em um só lugar</div>'+sp(14)+'<h1 class=z>Do projeto <em>à chave na mão</em></h1>'+sp(24)+f'<ul class="list z" style="columns:2;display:block;column-gap:40px">{items.replace("<li>","<li style=\"margin-bottom:18px;break-inside:avoid\">")}</ul>'+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(18)+PH2+sp(14)+FOOT
# 2 prova social
def f2(vert):
    ph=photo("casa_dia.jpg",560 if vert else 236)
    return L+sp(30 if vert else 26)+'<div class="eyebrow z">14 anos em Tatuí e região</div>'+sp(10)+f'<div class="stat z"><b><i>+</i>400</b><span>OBRAS</span></div>'+sp(20)+'<p class="sub z"><b>entregues</b> e mais de <b>100 mil m²</b> construídos.<br>Experiência que entra no desenho do seu projeto.</p>'+sp(30 if vert else 14)+ph+flex()+sp(18)+'<div class="cta z">Fale com um arquiteto</div>'+sp(30 if vert else 14)+PH2+sp(24 if vert else 10)+FOOT
# 3 método PPG
def f3(vert):
    cards=[("P","Projetos detalhados","Cada decisão alinhada antes da obra. Sem retrabalho no canteiro."),("P","Processo planejado","Cronograma definido e entrega dentro do prazo previsto."),("G","Gestão integrada","Controle físico e financeiro, com acompanhamento de perto até a entrega.")]
    if vert:
        c="".join(f'<div class="card z"><div class=l>{a}</div><h3>{b}</h3><p>{d}</p></div>' for a,b,d in cards)
        body=L+sp(40)+'<div class="eyebrow z">Método PPG</div>'+sp(20)+'<h1 class=z>Tudo pensado <em>antes do primeiro tijolo</em></h1>'+sp(50)+f'<div class="z" style="display:flex;flex-direction:column;gap:26px">{c}</div>'+sp(40)+'<p class="sub z"><b>Mesma equipe</b>, do primeiro traço à entrega.</p>'+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(40)+PH+sp(30)+FOOT
    else:
        c="".join(f'<div class="card z"><div class=l>{a}</div><h3>{b}</h3><p>{d}</p></div>' for a,b,d in cards)
        body=L+sp(26)+'<div class="eyebrow z">Método PPG</div>'+sp(14)+'<h1 class=z>Tudo pensado <em>antes do primeiro tijolo</em></h1>'+sp(28)+f'<div class="grid3 z">{c}</div>'+sp(22)+'<p class="sub z"><b>Mesma equipe</b>, do primeiro traço à entrega.</p>'+flex()+sp(18)+'<div class="cta z">Quero meu projeto</div>'+sp(18)+PH+sp(14)+FOOT
    return body
# 4 chamada orçamento com foto real
def f4(vert):
    if vert:
        return photo("fachada.jpg",700,"center 0%")+sp(40)+'<div class="eyebrow z">Peça o seu projeto</div>'+sp(18)+'<h1 class=z>Vamos começar<br><em>pela conversa.</em></h1>'+sp(20)+'<p class="sub z">Leva menos de 1 minuto. Fale com a nossa equipe pelo WhatsApp.</p>'+sp(34)+'<div class="eyebrow z" style="font-size:24px">Como podemos ajudar</div>'+sp(18)+chips()+flex()+sp(30)+'<div class="cta z">Chamar no WhatsApp</div>'+sp(34)+PH+sp(26)+FOOT
    return f"<div class='z' style='display:flex;gap:34px;flex:1'><div class='photo' style=\"width:370px;background-image:url('assets/fachada.jpg');background-position:center top\"></div><div style='flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px'><div class='eyebrow' style='text-align:left'>Peça o seu projeto</div><h1 style='text-align:left'>Vamos começar <em>pela conversa.</em></h1><p class='sub' style='text-align:left'>Leva menos de 1 minuto.</p>{chips('l')}<div class='cta' style='align-self:flex-start'>Chamar no WhatsApp</div>{PH.replace('contact z','contact z\" style=\"text-align:center').replace(' &nbsp;·&nbsp; ','<br>')}</div></div>"+sp(14)+FOOT
# 5 financiamento Caixa
def f5(vert):
    li=lambda t:f"<li>{t}</li>"
    items=li("Projeto e documentação organizados")+li("Obra acompanhada etapa por etapa")+li("Uma única equipe, do início à entrega")
    if vert:
        return L+sp(40)+'<div class="eyebrow z">Financiamento Caixa</div>'+sp(20)+'<h1 class=z>Construa a sua casa<br><em>com financiamento</em></h1>'+sp(44)+photo("casa_piscina.jpg",440,"center")+sp(40)+f'<ul class="list z" style="margin:0 auto;width:840px;--ls:38px">{items}</ul>'+flex()+'<div class="cta z">Quero simular</div>'+sp(40)+PH+sp(30)+FOOT
    return L+sp(26)+'<div class="eyebrow z">Financiamento Caixa</div>'+sp(14)+'<h1 class=z>Construa a sua casa<br><em>com financiamento</em></h1>'+sp(22)+f"<div class='z' style='display:flex;gap:30px;align-items:center'>"+f"<div class='photo' style=\"width:430px;height:300px;flex:none;background-image:url('assets/casa_piscina.jpg')\"></div>"+f'<ul class="list" style="flex:1;--ls:31px">{items}</ul></div>'+flex()+sp(20)+'<div class="cta z">Quero simular</div>'+sp(18)+PH+sp(14)+FOOT
# 6 equipe
def f6(vert):
    st=lambda a,b:f"<div style='text-align:center'><div class=sn>{a}</div><div class=sl>{b}</div></div>"
    stats=st("14","anos em Tatuí")+st("+400","obras entregues")+st("CAU/SP","responsável técnico")
    row=f'<div class="statrow z">{stats}</div>'
    if vert:
        return L+sp(40)+'<div class="eyebrow z">Quem faz a Cariati</div>'+sp(20)+'<h1 class=z>Uma equipe completa<br><em>do projeto à entrega</em></h1>'+sp(50)+photo("equipe.jpg",330,"center top")+sp(80)+row+sp(70)+'<p class="sub z"><b>Mesma equipe</b> em cada etapa: projeto, aprovação, gestão e obra.</p>'+flex()+'<div class="cta z">Fale com a nossa equipe</div>'+sp(40)+PH+sp(30)+FOOT
    return L+sp(26)+'<div class="eyebrow z">Quem faz a Cariati</div>'+sp(14)+'<h1 class=z>Uma equipe completa<br><em>do projeto à entrega</em></h1>'+sp(24)+photo("equipe.jpg",262,"center top")+sp(22)+row+flex()+sp(22)+'<div class="cta z">Fale com a nossa equipe</div>'+sp(18)+PH+sp(14)+FOOT
# 7 gestão e administração de obras
def f7(vert):
    items=[("01","Planejamento","Cronograma e planejamento financeiro prontos antes de construir."),("02","Controle físico","Andamento da obra acompanhado etapa por etapa."),("03","Controle financeiro","Custos acompanhados com transparência, do início ao fim."),("04","Entrega no prazo","Responsabilidade técnica de arquiteto CAU/SP até a entrega.")]
    cards="".join(f'<div class="card z" style="position:relative"><div class=l>{n}</div><h3>{t}</h3><p>{d}</p></div>' for n,t,d in items)
    if vert:
        return L+sp(40)+'<div class="eyebrow z">Gestão e administração de obras</div>'+sp(20)+'<h1 class=z>Sua obra com <em>controle de cada etapa</em></h1>'+sp(24)+'<p class="sub z">Quem desenhou o projeto acompanha a execução.</p>'+sp(34)+f'<div class="z" style="display:flex;flex-direction:column;gap:20px">{cards}</div>'+flex()+sp(40)+'<div class="cta z">Quero gestão da minha obra</div>'+sp(36)+PH+sp(30)+FOOT
    return L+sp(26)+'<div class="eyebrow z">Gestão e administração de obras</div>'+sp(14)+'<h1 class=z style="font-size:50px;white-space:nowrap">Sua obra com <em>controle de cada etapa</em></h1>'+sp(18)+f'<div class="z gestao" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">{cards}</div>'+flex()+sp(20)+'<div class="cta z">Quero gestão da minha obra</div>'+sp(16)+PH+sp(12)+FOOT
# 8 projetos com fundo + equipe
def f8(vert):
    bgimg="casa_noite_v.jpg" if vert else "casa_piscina.jpg"
    bg=f"<div class='bg' style=\"background-image:url('assets/{bgimg}')\"></div>"
    if vert:
        return bg+L+sp(40)+'<div class="eyebrow z">Projetos</div>'+sp(20)+'<h1 class=z>Projetos pensados <em>para a sua rotina</em></h1>'+sp(24)+'<p class="sub z">Do primeiro traço à aprovação, com a mesma equipe.</p>'+flex()+photo("equipe.jpg",320,"center top")+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(40)+PH+sp(30)
    return bg+L+sp(26)+'<div class="eyebrow z">Projetos</div>'+sp(12)+'<h1 class=z style="font-size:52px;white-space:nowrap">Projetos pensados <em>para a sua rotina</em></h1>'+flex()+photo("equipe.jpg",250,"center top")+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(18)+PH+sp(8)
FL=[("01_tudo_em_um_so_lugar",f1),("02_400_obras",f2),("03_metodo_ppg",f3),("04_vamos_conversar",f4),("05_financiamento_caixa",f5),("06_equipe",f6),("07_gestao_de_obras",f7),("08_projetos_e_equipe",f8)]
import json
jobs=[]
(root/"html").mkdir(exist_ok=True)
for name,fn in FL:
    for tag,(w,h,vars_,vert) in {"vertical_1080x1920":(1080,1920,VV,True),"quadrado_1080x1080":(1080,1080,SQ,False)}.items():
        for light in (False,True):
            html=page(w,h,fn(vert),vars_,light).replace('assets/','../assets/')
            if light: html=html.replace('../assets/logo.png','../assets/logo_escuro.png')
            fn_=f"{name}_{tag}"+("_claro" if light else "")
            (root/"html"/f"{fn_}.html").write_text(html)
            jobs.append(dict(f=fn_,w=w,h=h,d="png_claro" if light else "png"))
(root/"jobs.json").write_text(json.dumps(jobs))
