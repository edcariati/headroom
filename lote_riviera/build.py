import pathlib
root=pathlib.Path(__file__).parent
CSS="""
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#fff}
.f{position:relative;width:var(--w);height:var(--h);background:#06121a;overflow:hidden;display:flex;flex-direction:column;padding:var(--p)}
.hd{display:flex;justify-content:space-between;align-items:center}
.hr{text-align:right;font-weight:600;font-size:var(--hrf);color:#c5d3db;letter-spacing:.04em;line-height:1.5}
.hr span{display:block;color:#5fc1e3;font-weight:800;letter-spacing:.26em;font-size:.8em}
.im{background-size:cover;border:2px solid rgba(95,193,227,.35);position:relative;flex:none}
.mt{position:absolute;left:0;bottom:0;background:rgba(6,18,26,.88);padding:10px 16px;font-weight:800;letter-spacing:.18em;font-size:var(--mtf);color:#5fc1e3}
.pb{position:absolute;right:0;bottom:0;background:#5fc1e3;color:#07121a;padding:var(--pbp);text-align:left}
.pb small{display:block;font-weight:800;letter-spacing:.2em;font-size:var(--pbs)}
.pb b{font-weight:800;font-size:var(--pbf);line-height:1.1}
.mp{position:relative}
.bg{position:absolute;left:0;top:0;width:100%;height:var(--ph);background-size:cover;background-position:var(--pp)}
.bg:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,10,16,.55) 0%,rgba(3,10,16,0) 28%,rgba(6,18,26,.35) 62%,#06121a 100%)}
.z{position:relative;z-index:2}
.logo{height:var(--lh);align-self:flex-start}
.eb{font-weight:700;letter-spacing:.26em;font-size:var(--e);color:#5fc1e3;text-transform:uppercase}
h1{font-weight:800;font-size:var(--h1);line-height:1.05;letter-spacing:-.01em}
h1 em{font-style:normal;color:#5fc1e3}
.price{display:flex;align-items:baseline;gap:18px}
.price small{font-weight:700;letter-spacing:.2em;font-size:var(--e);color:#c5d3db}
.price b{font-weight:800;font-size:var(--pr);line-height:1}
.chips{display:grid;grid-template-columns:1fr 1fr;gap:var(--g)}
.chip{border:2px solid rgba(95,193,227,.6);background:rgba(6,18,26,.55);padding:var(--cp);font-weight:700;font-size:var(--cf)}
.chip span{display:block;font-weight:600;color:#9fb4bf;font-size:calc(var(--cf)*.62);letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px}
.cta{background:#5fc1e3;color:#07121a;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:center;font-size:var(--c);padding:var(--cb)}
.ph{text-align:center;font-weight:700;font-size:var(--t);line-height:1.4}
.ph .wa{color:#25d366;font-size:.6em;letter-spacing:.2em;text-transform:uppercase;display:block}
.ph small{display:block;font-weight:500;color:#9fb4bf;font-size:.5em;letter-spacing:.05em;margin-top:4px}
"""
def chips(cols=4):
    c=[("Medidas","12 × 30 m"),("Área","450 m²"),("Posição","Fachada leste"),("Terreno","Leve aclive")]
    return f'<div class="chips z" style="grid-template-columns:repeat({cols},1fr)">'+''.join(f'<div class=chip><span>{a}</span>{b}</div>' for a,b in c)+'</div>'
PH='<div class="ph z"><span class=wa>WhatsApp</span>(15) 99701-8090</div>'
def sp(n): return f"<div style='height:{n}px;flex:none'></div>"
def img(f,h,pos="center",extra="",inner="",w=""):
    return f"<div class='im' style=\"height:{h}px;{w}background-image:url('../assets/{f}');background-position:{pos};{extra}\">{inner}</div>"
def tag(t): return f"<div class=tg>{t}</div>"
BADGE='<div class=pb><small>VALOR DO LOTE</small><b>R$ 67.000</b></div>'
def build(w,h,v,vert):
    vs=";".join(f"--{k}:{x}" for k,x in v.items())
    top=f'<div class="hd z"><img class="logo" src="../assets/logo.png"><div class=hr><span>OPORTUNIDADE</span>Riviera de Santa Cristina XIII</div></div>'
    title='<div class="eb z">Setor Marina</div>'+sp(8)+'<h1 class=z>Lote de 450&nbsp;m² <em>com fachada leste</em></h1>'
    if vert:
        body=(top+sp(34)+title+sp(30)+img("foto1.jpg",560,"center 42%","","",'')+f"<div class=z style='margin-top:-560px;height:560px;position:relative'>{BADGE}</div>"
          +sp(16)+f"<div class='z' style='display:flex;gap:16px;flex:none'>{img('foto3.jpg',220,'center 55%','flex:1')}{img('foto2.jpg',220,'center 60%','flex:1')}</div>"
          +sp(14)+f"<div class='z mp'>{img('mapa.jpg',350,'center 78%','','<div class=mt>LOCALIZAÇÃO DO TERRENO</div>')}</div>"
          +sp(18)+chips(4)+"<div style='flex:1'></div>"+sp(14)+'<div class="cta z">Agende uma visita</div>'+sp(24)+PH)
    else:
        body=(top+sp(18)+title+sp(20)
          +f"<div class='z' style='display:flex;gap:16px;flex:none'><div style='flex:1.25;position:relative'>{img('foto1.jpg',470,'center 42%')}{BADGE}</div><div style='flex:1;position:relative'>{img('mapa.jpg',470,'center 80%','','<div class=mt>LOCALIZAÇÃO DO TERRENO</div>')}</div></div>"
          +sp(14)+chips(4)+"<div style='flex:1'></div>"+sp(10)+'<div class="cta z">Agende uma visita</div>'+sp(14)+PH)
    return f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body><div class=f style='--w:{w}px;--h:{h}px;{vs}'>{body}</div></body></html>"
V=dict(hrf="22px",mtf="17px",pbp="18px 28px",pbs="14px",pbf="54px",p="64px",ph="1000px",pp="center 40%",lh="96px",e="24px",h1="70px",pr="120px",g="18px",cp="16px 18px",cf="27px",c="32px",cb="26px",t="50px")
S=dict(hrf="17px",mtf="13px",pbp="10px 18px",pbs="11px",pbf="34px",p="48px",ph="470px",pp="center 40%",lh="64px",e="18px",h1="48px",pr="84px",g="12px",cp="10px 12px",cf="21px",c="24px",cb="16px",t="36px")
(root/"html").mkdir(exist_ok=True); import json; jobs=[]
for tag,(w,h,v,vert) in {"vertical_1080x1920":(1080,1920,V,True),"quadrado_1080x1080":(1080,1080,S,False)}.items():
    f=f"anuncio_lote_{tag}"; (root/"html"/f"{f}.html").write_text(build(w,h,v,vert)); jobs.append(dict(f=f,w=w,h=h))
(root/"jobs.json").write_text(json.dumps(jobs))
