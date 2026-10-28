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
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--g3)}
.card{background:rgba(255,255,255,.05);border-top:4px solid #5fc1e3;padding:var(--cd)}
.card .l{font-size:var(--cl);font-weight:800;color:#5fc1e3}
.card h3{font-size:var(--ch);margin:8px 0}
.card p{font-size:var(--cp2);color:#c5d3db;line-height:1.35}
"""
def page(w,h,body,vars_):
    v=";".join(f"--{k}:{x}" for k,x in vars_.items())
    return f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body><div class=f style='--w:{w}px;--h:{h}px;{v}'>{body}</div></body></html>"
L='<img class="logo z" src="assets/logo.png">'
PH='<div class="contact z"><span class=wa style="font-size:.7em;letter-spacing:.2em;text-transform:uppercase">WhatsApp</span><br>(15) 99680-5291 &nbsp;·&nbsp; (15) 99814-6455<small>cariati.com.br · Tatuí e região</small></div>'
FOOT='<div class="foot z">CARIATI ARQUITETURA LTDA · RESP. TÉCNICO ARQUITETO CAU/SP A120704-0</div>'
V=dict(w=1080,h=1920)
VV=dict(p="90px",lh="190px",e="26px",h1="74px",s="36px",g="36px",c="34px",cp="30px 60px",t="44px",fs="19px",ls="42px",lg="30px",big="260px",g3="22px",cd="26px",cl="30px",ch="38px",cp2="27px")
SQ=dict(p="64px",lh="140px",e="21px",h1="64px",s="28px",g="26px",c="27px",cp="22px 46px",t="34px",fs="15px",ls="35px",lg="24px",big="150px",g3="16px",cd="22px",cl="26px",ch="32px",cp2="23px")
def photo(img,h,pos="center"):
    return f"<div class='photo z' style=\"flex:none;height:{h}px;background-image:url('assets/{img}');background-position:{pos}\"></div>"
def sp(n): return f"<div style='height:{n}px;flex:none'></div>"
def flex(): return "<div style='flex:1'></div>"
F={}
# 1 tudo em um só lugar
def f1(vert):
    li=lambda t,s='':f"<li>{t}<span>{s}</span></li>"
    items=li("Financiamento Caixa","Financie a sua obra")+li("Projeto arquitetônico","Planta, fachada e imagens 3D")+li("Projetos complementares","Estrutural, elétrico e hidrossanitário")+li("Projeto de interiores","Layout, acabamentos e mobiliário")+li("Regularização de obras","Aprovação na prefeitura")+li("Gestão e execução de obras","Cronograma e controle de cada etapa")
    if vert:
        return L+sp(40)+'<div class="eyebrow z">Tudo em um só lugar</div>'+sp(20)+'<h1 class=z style="white-space:nowrap;font-size:70px">Do projeto <em>à chave na mão</em></h1>'+sp(60)+f'<ul class="list z">{items}</ul>'+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(40)+PH+sp(30)+FOOT
    return L+sp(26)+'<div class="eyebrow z">Tudo em um só lugar</div>'+sp(14)+'<h1 class=z>Do projeto <em>à chave na mão</em></h1>'+sp(24)+f'<ul class="list z" style="columns:2;display:block;column-gap:40px">{items.replace("<li>","<li style=\"margin-bottom:18px;break-inside:avoid\">")}</ul>'+flex()+'<div class="cta z">Quero meu projeto</div>'+sp(18)+PH+sp(14)+FOOT
# 2 prova social
def f2(vert):
    ph=photo("casa_dia.jpg",560 if vert else 236)
    return L+sp(30 if vert else 26)+'<div class="eyebrow z">14 anos em Tatuí e região</div>'+sp(10)+f'<div class="stat z"><b><i>+</i>400</b><span>OBRAS</span></div>'+sp(20)+'<p class="sub z"><b>entregues</b> e mais de <b>100 mil m²</b> construídos.<br>Experiência que entra no desenho do seu projeto.</p>'+sp(30 if vert else 14)+ph+flex()+sp(18)+'<div class="cta z">Fale com um arquiteto</div>'+sp(30 if vert else 14)+PH+sp(24 if vert else 10)+FOOT
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
        return photo("fachada.jpg",760,"center top")+sp(40)+'<div class="eyebrow z">Peça o seu projeto</div>'+sp(18)+'<h1 class=z>Vamos começar<br><em>pela conversa.</em></h1>'+sp(20)+'<p class="sub z">Leva menos de 1 minuto. Fale com a nossa equipe pelo WhatsApp.</p>'+flex()+'<div class="cta z">Chamar no WhatsApp</div>'+sp(34)+PH+sp(26)+FOOT
    return f"<div class='z' style='display:flex;gap:34px;flex:1'><div class='photo' style=\"width:370px;background-image:url('assets/fachada.jpg');background-position:center top\"></div><div style='flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px'><div class='eyebrow' style='text-align:left'>Peça o seu projeto</div><h1 style='text-align:left'>Vamos começar <em>pela conversa.</em></h1><p class='sub' style='text-align:left'>Leva menos de 1 minuto.</p><div class='cta' style='align-self:flex-start'>Chamar no WhatsApp</div>{PH.replace('contact z','contact z\" style=\"text-align:left')}</div></div>"+sp(14)+FOOT
FL=[("01_tudo_em_um_so_lugar",f1),("02_400_obras",f2),("03_metodo_ppg",f3),("04_vamos_conversar",f4)]
import json
jobs=[]
(root/"html").mkdir(exist_ok=True)
for name,fn in FL:
    for tag,(w,h,vars_,vert) in {"vertical_1080x1920":(1080,1920,VV,True),"quadrado_1080x1080":(1080,1080,SQ,False)}.items():
        html=page(w,h,fn(vert),vars_).replace('assets/','../assets/')
        fn_=f"{name}_{tag}"
        (root/"html"/f"{fn_}.html").write_text(html)
        jobs.append(dict(f=fn_,w=w,h=h))
(root/"jobs.json").write_text(json.dumps(jobs))
