import pathlib
root=pathlib.Path(__file__).parent
CSS="""
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#fff}
.f{position:relative;width:var(--w);height:var(--h);background:#06121a;overflow:hidden;display:flex;flex-direction:column;padding:var(--p)}
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
def chips(): 
    c=[("Medidas","12 × 30 m"),("Área","450 m²"),("Posição","Fachada leste"),("Terreno","Leve aclive")]
    return '<div class="chips z">'+''.join(f'<div class=chip><span>{a}</span>{b}</div>' for a,b in c)+'</div>'
PH='<div class="ph z"><span class=wa>WhatsApp</span>(15) 99701-8090<small>Riviera de Santa Cristina XIII</small></div>'
def sp(n): return f"<div style='height:{n}px;flex:none'></div>"
def build(w,h,v,vert):
    vs=";".join(f"--{k}:{x}" for k,x in v.items())
    L='<img class="logo z" src="../assets/logo.png">'
    bg=f"<div class=bg style=\"background-image:url('../assets/foto1.jpg')\"></div>"
    if vert:
        body=bg+L+sp(560)+'<div class="eb z">Riviera de Santa Cristina XIII · Setor Marina</div>'+sp(20)+'<h1 class=z>Lote de 450&nbsp;m² <em>no Setor Marina</em></h1>'+sp(30)+'<div class="price z"><small>POR APENAS</small><b>R$ 67.000</b></div>'+sp(34)+chips()+"<div style='flex:1'></div>"+'<div class="cta z">Quero conhecer o lote</div>'+sp(30)+PH
    else:
        body=bg+L+sp(262)+'<div class="eb z">Riviera de Santa Cristina XIII · Setor Marina</div>'+sp(10)+'<h1 class=z>Lote de 450&nbsp;m² <em>no Setor Marina</em></h1>'+sp(12)+'<div class="price z"><small>POR APENAS</small><b>R$ 67.000</b></div>'+sp(16)+chips().replace('class="chips z"','class="chips z" style="grid-template-columns:repeat(4,1fr)"')+"<div style='flex:1'></div>"+PH
    return f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body><div class=f style='--w:{w}px;--h:{h}px;{vs}'>{body}</div></body></html>"
V=dict(p="80px",ph="1000px",pp="center 40%",lh="120px",e="24px",h1="82px",pr="120px",g="18px",cp="20px 26px",cf="38px",c="34px",cb="30px",t="52px")
S=dict(p="56px",ph="470px",pp="center 40%",lh="84px",e="18px",h1="56px",pr="84px",g="12px",cp="12px 14px",cf="23px",c="28px",cb="22px",t="38px")
(root/"html").mkdir(exist_ok=True); import json; jobs=[]
for tag,(w,h,v,vert) in {"vertical_1080x1920":(1080,1920,V,True),"quadrado_1080x1080":(1080,1080,S,False)}.items():
    f=f"anuncio_lote_{tag}"; (root/"html"/f"{f}.html").write_text(build(w,h,v,vert)); jobs.append(dict(f=f,w=w,h=h))
(root/"jobs.json").write_text(json.dumps(jobs))
