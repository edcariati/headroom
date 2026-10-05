/* ================= VISÃO GERAL DE GESTÃO =================
   Uma tela para o gestor ler tudo rápido: Geral · Etapas e avanço · Compras · Finanças · Prazos.
   Rota: #/visao[/geral|etapas|compras|financas|prazos]. Filtros: obra e horizonte (7, 15, 30, 90 e 120 dias).
   Só junta o que o app já calcula; valores em R$ só para quem vê financeiro (nunca campo nem cliente). */
var VG_H=[7,15,30,90,120];
var VG_ABAS=[['geral','Visão geral'],['etapas','Etapas e avanço'],['compras','Compras'],['financas','Finanças'],['prazos','Prazos']];
function vgAba(){ var p=(location.hash||'').replace(/^#\/?/,'').split('/'); return VG_ABAS.some(function(a){ return a[0]===p[1]; })?p[1]:'geral'; }
function vgH(){ return VG_H.indexOf(ui.vgH)>=0?ui.vgH:30; }
function vgObras(){
  var l=L('obras').filter(function(o){ return !encerrada(o); });
  if(ui.vgObra) l=l.filter(function(o){ return o.id===ui.vgObra; });
  return l.sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
}
function vgNomeObra(oid){ var o=G('obras',oid); return o?o.nome:''; }
function vgBrl(v){ return gVe()?brl(v):''; }
function vgLink(oid,aba){ return '#/obra/'+oid+'/'+aba; }

/* ---------- etapas: situação de cada uma, por obra ---------- */
function vgEtapas(oid){
  var hj=hoje(), out=[];
  ETAPAS.forEach(function(e){
    var n=e.n, d=etapaDoc(oid,n), f=fisicoEtapa(oid,n), j=janelaEtapa(oid,n), lib=d.status==='liberada';
    var esp=j?Math.max(0,Math.min(1,(diffDays(j.ini,hj)+1)/j.dias)):null;
    var atraso=(j&&!lib&&j.fim<hj)?diffDays(j.fim,hj):0, atras=esp!=null&&!lib&&f.v<esp-0.10;
    var sit=lib?'liberada':(atraso?'atrasada':(atras?'atencao':(d.status==='nao_iniciada'&&!(j&&j.ini<=hj)?(j?'programada':'sem'):'noprazo')));
    out.push({n:n, nome:e.nome, st:d.status, j:j, esp:esp, fis:f.v, lib:lib, atraso:atraso, atras:atras, sit:sit, semAtiv:!!f.semAtividades});
  });
  return out;
}
var VG_SIT={liberada:['ok','Liberada'], atrasada:['crit','Atrasada'], atencao:['warn','Atrás da meta'], noprazo:['steel','No prazo'], programada:['','Programada'], sem:['','Sem cronograma']};

/* ---------- itens em execução ---------- */
function vgEmExecucao(obras){
  var hj=hoje(), out=[];
  obras.forEach(function(o){ byObra('atividades',o.id).forEach(function(a){
    var av=a.avanco||0; if(av>=100) return; if(!(av>0||(a.inicio<=hj&&hj<=a.fim)||a.fim<hj)) return;
    out.push({o:o, a:a, atras:a.fim<hj?diffDays(a.fim,hj):0});
  }); });
  return out.sort(function(x,y){ return (y.atras-x.atras)||((x.a.fim||'9')<(y.a.fim||'9')?-1:1); });
}

/* ---------- linha do tempo de tudo que vence nos próximos dias ---------- */
var VG_CAT={'etapa-ini':'Etapas que iniciam','etapa-fim':'Etapas que terminam','prest':'Prestadores: fim de atividade','entrega':'Entregas de material','pedir':'Compras a emitir (pedir até)','loc':'Locações (início ou devolução)','pag':'Pagamentos a vencer','aporte':'Aportes do cliente a receber','agenda':'Compromissos agendados'};
function vgTimeline(obras){
  var hj=hoje(), ve=gVe(), T=[], push=function(o,cat,data,txt,to,valor){ if(data&&data>=hj) T.push({o:o, cat:cat, data:data, txt:txt, to:to, valor:valor}); };
  obras.forEach(function(o){
    var oid=o.id, b='#/obra/'+oid+'/';
    ETAPAS.forEach(function(e){ var j=janelaEtapa(oid,e.n), d=etapaDoc(oid,e.n); if(!j||d.status==='liberada') return; if(j.ini>hj) push(o,'etapa-ini',j.ini,'Etapa '+e.n+' — '+e.nome,b+'etapa/'+e.n); push(o,'etapa-fim',j.fim,'Etapa '+e.n+' — '+e.nome,b+'etapa/'+e.n); });
    byObra('atividades',oid).filter(function(a){ return a.prestadorId&&(a.avanco||0)<100; }).forEach(function(a){ push(o,'prest',a.fim,(prestNome(a.prestadorId)||'Prestador')+': '+a.nome+' ('+(a.avanco||0)+'%)',b+'cronograma'); });
    byObra('compras',oid).forEach(function(c){
      if(c.status==='pedido'&&c.pedido&&c.pedido.entregaPrevista) push(o,'entrega',c.pedido.entregaPrevista,c.item+' — '+(fornNome(c.pedido.fornecedorId)||''),b+'compras',ve?valorCompra(c):null);
      else if(['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0){ var lim=limiteCompra(c); if(lim) push(o,'pedir',lim,c.item+' ('+COMPRA_ST[c.status]+')',b+'compras',ve?valorCompra(c):null); }
    });
    byObra('locacoes',oid).forEach(function(l){ if(l.status==='ativa') push(o,'loc',l.fimPrevisto,'Devolução: '+l.equipamento,b+'locacoes'); else if(l.status==='prevista') push(o,'loc',l.inicio,'Início: '+l.equipamento,b+'locacoes'); });
    if(ve){
      pagamentosObra(oid).filter(function(p){ return !p.pago; }).forEach(function(p){ push(o,'pag',p.venc,p.desc,p.to,p.valor); });
      byObra('aportes',oid).filter(function(a){ return !a.dataRecebida; }).forEach(function(a){ push(o,'aporte',a.dataPrevista,a.descricao||'Aporte',b+'financeiro',a.valorPrevisto); });
    }
    byObra('eventos',oid).filter(function(e){ return (e.status||'agendado')==='agendado'; }).forEach(function(e){ push(o,'agenda',e.data,e.titulo,'#/agenda'); });
  });
  return T.sort(function(a,b){ return a.data<b.data?-1:1; });
}
function vgConta(T,cat,h){ var lim=addDays(hoje(),h), l=T.filter(function(x){ return x.cat===cat&&x.data<=lim; }); return {n:l.length, v:l.reduce(function(s,x){ return s+(x.valor||0); },0)}; }

/* ---------- atrasos de todas as frentes ---------- */
function vgAtrasos(obras){
  var hj=hoje(), ve=gVe(), A={etapas:[], ativ:[], entregas:[], pedir:[], pagos:[], quinz:[], crit:[]};
  obras.forEach(function(o){
    var oid=o.id, b='#/obra/'+oid+'/';
    vgEtapas(oid).filter(function(e){ return e.sit==='atrasada'||e.sit==='atencao'; }).forEach(function(e){ A.etapas.push({o:o, e:e}); });
    byObra('atividades',oid).filter(atAtrasada).forEach(function(a){ A.ativ.push({o:o, a:a, d:diffDays(a.fim,hj)}); });
    byObra('compras',oid).forEach(function(c){
      if(pedidoAtrasado(c)) A.entregas.push({o:o, c:c, d:diffDays(c.pedido.entregaPrevista,hj)});
      if(compraAtrasadaPedido(c)) A.pedir.push({o:o, c:c, d:diffDays(limiteCompra(c),hj)});
    });
    if(ve) pagamentosObra(oid).filter(function(p){ return !p.pago&&p.venc&&p.venc<hj; }).forEach(function(p){ A.pagos.push({o:o, p:p, d:diffDays(p.venc,hj)}); });
    qzPendentes(o).forEach(function(q){ if(hj>qPrazo(q)) A.quinz.push({o:o, q:q}); });
    alertasObra(o).filter(function(a){ return a.k==='crit'; }).forEach(function(a){ A.crit.push({o:o, a:a}); });
  });
  return A;
}

/* ---------- peças visuais ---------- */
function vgBarra(v,k){ return '<div class="hbar" style="grid-template-columns:1fr;padding:0"><div class="t"><i style="width:'+Math.max(0,Math.min(100,(v||0)*100))+'%'+(k==='crit'?';background:var(--crit)':(k==='warn'?';background:var(--amber-bar)':(k==='ok'?';background:var(--ok)':'')))+'"></i></div></div>'; }
function vgCard(t,v,sub,k,link){ var h='<div class="kpi'+(k?' '+k:'')+'"><div class="kpi-r">'+esc(t)+'</div><div class="kpi-v">'+v+'</div><div class="kpi-s">'+(sub||'&nbsp;')+'</div></div>'; return link?'<a class="kpi-a" href="'+link+'">'+h+'</a>':h; }
function vgSec(t,sub,corpo,extra){ return '<section class="card sec"><div class="card-h"><div><h2>'+esc(t)+'</h2>'+(sub?'<p class="muted small">'+sub+'</p>':'')+'</div>'+(extra||'')+'</div>'+corpo+'</section>'; }
function vgVazio(t){ return '<p class="muted small" style="padding:14px 16px">'+t+'</p>'; }
function vgCab(){
  var obras=L('obras').filter(function(o){ return !encerrada(o); }).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); }), aba=vgAba();
  var tabs='<nav class="tabs" aria-label="Seções da visão geral">'+VG_ABAS.filter(function(a){ return !(a[0]==='financas'&&!gVe()); }).map(function(a){ return '<a href="#/visao/'+a[0]+'"'+(a[0]===aba?' aria-current="page"':'')+'>'+a[1]+'</a>'; }).join('')+'</nav>';
  var sel='<label class="small muted">Obra <select data-chg="vg-obra" aria-label="Filtrar por obra" style="padding:6px;border:1px solid var(--line);border-radius:6px"><option value="">Todas em andamento</option>'+obras.map(function(o){ return '<option value="'+esc(o.id)+'"'+(ui.vgObra===o.id?' selected':'')+'>'+esc(o.nome)+'</option>'; }).join('')+'</select></label>';
  var hz='<div class="row" style="gap:4px" role="group" aria-label="Horizonte">'+VG_H.map(function(h){ return '<button class="btn sm'+(vgH()===h?' primary':'')+'" data-act="vg-h" data-h="'+h+'" aria-pressed="'+(vgH()===h)+'">'+h+' dias</button>'; }).join('')+'</div>';
  return '<div class="sec-h" style="flex-wrap:wrap"><div><h1>Visão geral</h1><p class="muted" style="margin-top:4px">Tudo das obras em andamento num lugar só: avanço, atrasos, compras, pagamentos e prazos. Hoje é '+fmt(hoje())+'.</p></div><div class="row" style="gap:14px">'+sel+hz+'</div></div>'+tabs;
}
document.addEventListener('change', function(e){ var el=e.target.closest('[data-chg="vg-obra"]'); if(el){ ui.vgObra=el.value; render(); } });
Object.assign(AG,{ 'vg-h':function(d){ ui.vgH=Number(d.h); render(); } });

/* ---------- aba: visão geral ---------- */
function vgLeituraRapida(obras,A){
  var ve=gVe(), n=function(l){ return l.length; };
  var cards=[
    vgCard('Etapas em atraso','<span class="num">'+n(A.etapas.filter(function(x){ return x.e.sit==='atrasada'; }))+'</span>',n(A.etapas.filter(function(x){ return x.e.sit==='atencao'; }))+' atrás da meta', A.etapas.some(function(x){ return x.e.sit==='atrasada'; })?'crit':(A.etapas.length?'warn':'ok'),'#/visao/etapas'),
    vgCard('Atividades atrasadas','<span class="num">'+n(A.ativ)+'</span>','prestadores a cobrar',A.ativ.length?'warn':'ok','#/visao/prazos'),
    vgCard('Entregas atrasadas','<span class="num">'+n(A.entregas)+'</span>','fornecedores a cobrar',A.entregas.length?'crit':'ok','#/visao/compras'),
    vgCard('Compras fora do “pedir até”','<span class="num">'+n(A.pedir)+'</span>','já deviam ter sido pedidas',A.pedir.length?'crit':'ok','#/visao/compras')];
  if(ve) cards.push(vgCard('Pagamentos vencidos','<span class="num">'+n(A.pagos)+'</span>',brl(A.pagos.reduce(function(s,x){ return s+x.p.valor; },0)),A.pagos.length?'crit':'ok','#/visao/financas'));
  cards.push(vgCard('Relatórios quinzenais','<span class="num">'+n(A.quinz)+'</span>','em atraso',A.quinz.length?'warn':'ok'));
  cards.push(vgCard('Alertas críticos','<span class="num">'+n(A.crit)+'</span>','nas obras em andamento',A.crit.length?'crit':'ok'));
  return '<section class="dash-sec"><div class="dash-h"><h2>Leitura rápida</h2><span class="muted small">O que está fora do prazo agora</span></div><div class="kpis">'+cards.join('')+'</div></section>';
}
function vgMatrizPrazos(T){
  var ve=gVe(), cats=Object.keys(VG_CAT).filter(function(c){ return ve||(c!=='pag'&&c!=='aporte'); }), h0=vgH();
  var rows=cats.map(function(c){
    return '<tr><td>'+esc(VG_CAT[c])+'</td>'+VG_H.map(function(h){ var x=vgConta(T,c,h); return '<td class="num"'+(h===h0?' style="background:var(--steel-soft)"':'')+'>'+(x.n?x.n:'<span class="muted">·</span>')+((c==='pag'||c==='aporte')&&x.n?'<div class="tiny muted">'+dashBrl(x.v)+'</div>':'')+'</td>'; }).join('')+'</tr>';
  }).join('');
  return vgSec('O que vence nos próximos dias','Acumulado: a coluna de 30 dias inclui o que vence em 7 e 15. A coluna destacada é o horizonte escolhido.','<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Frente</th>'+VG_H.map(function(h){ return '<th class="num">'+h+' dias</th>'; }).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function vgProximos(T,h){
  var lim=addDays(hoje(),h), l=T.filter(function(x){ return x.data<=lim; });
  return vgSec('Próximos '+h+' dias ('+l.length+')','Ordenado por data. Toque no item para abrir.',l.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Data</th><th>Frente</th><th>O quê</th><th>Obra</th>'+(gVe()?'<th class="num">Valor</th>':'')+'</tr></thead><tbody>'+l.slice(0,40).map(function(x){ return '<tr><td>'+fmt(x.data)+'<div class="tiny muted">em '+plural(diffDays(hoje(),x.data),'dia','dias')+'</div></td><td>'+esc(VG_CAT[x.cat])+'</td><td><a href="'+x.to+'">'+esc(short(x.txt,70))+'</a></td><td>'+esc(x.o.nome)+'</td>'+(gVe()?'<td class="num">'+(x.valor!=null?brl(x.valor):'')+'</td>':'')+'</tr>'; }).join('')+'</tbody></table></div>'+(l.length>40?'<p class="tiny muted" style="padding:8px 16px">e mais '+(l.length-40)+' itens. Veja a aba Prazos.</p>':''):vgVazio('Nada programado neste horizonte.'));
}
function vgPorObra(obras){
  if(!obras.length) return '';
  var ve=gVe(), rows=obras.map(function(o){
    var oid=o.id, ev=orcVigente(oid)?evm(o):null, et=vgEtapas(oid), cr=avancoCron(oid), fis=ev&&ev.fisPct!=null?ev.fisPct:null;
    var exec=et.filter(function(e){ return !e.lib&&(e.st==='em_execucao'||e.st==='aguardando_vistoria'||(e.fis>0&&e.fis<1)); }), atr=et.filter(function(e){ return e.sit==='atrasada'; }).length;
    var ab=byObra('ocorrencias',oid).filter(ocAberta), cs=byObra('compras',oid).filter(function(c){ return ['conferido','pago'].indexOf(c.status)<0; }).length;
    var venc=ve?pagamentosObra(oid).filter(function(p){ return !p.pago&&p.venc&&p.venc<hoje(); }):[], al=alertasObra(o), crit=al.filter(function(a){ return a.k==='crit'; }).length;
    var lib=et.filter(function(e){ return e.lib; }).length;
    return '<tr><td><a href="#/obra/'+oid+'/resumo"><strong>'+esc(o.nome)+'</strong></a><div class="tiny muted">'+esc(o.modalidade||'')+' · '+lib+'/22 liberadas</div></td>'
      +'<td>'+(fis==null?'—':Math.round(fis*100)+'%'+vgBarra(fis))+'</td><td>'+(cr==null?'—':pct1(cr)+vgBarra(cr))+'</td>'
      +'<td class="num">'+(ev&&ev.spi!=null?'<span class="chip '+corIdx(ev.spi)+'">'+String(Math.round(ev.spi*100)/100).replace('.',',')+'</span>':'—')+'</td>'
      +'<td class="small">'+(exec.length?exec.slice(0,3).map(function(e){ return e.n; }).join(', ')+(exec.length>3?'…':''):'—')+'</td>'
      +'<td class="num">'+(atr?'<span class="chip crit">'+atr+'</span>':'0')+'</td><td class="num">'+ab.length+'</td><td class="num">'+cs+'</td>'
      +(ve?'<td class="num">'+(venc.length?'<span class="chip crit">'+venc.length+'</span>':'0')+'</td>':'')
      +'<td><span class="dot '+(crit?'crit':(al.length?'warn':'ok')) +'"></span> '+al.length+'</td></tr>';
  }).join('');
  return vgSec('Visão por obra','Avanço físico (executado × orçado), meta do cronograma, SPI, etapas em execução e o que está pendente.','<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th><th>Físico</th><th>Cronograma</th><th class="num">SPI</th><th>Etapas em execução</th><th class="num">Etapas atrasadas</th><th class="num">Ocorrências</th><th class="num">Compras abertas</th>'+(ve?'<th class="num">Pagtos vencidos</th>':'')+'<th>Alertas</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function vgGraficosAvanco(obras){
  if(!obras.length) return '';
  var lb=obras.map(function(o){ return short(o.nome,14); }), fis=[], cr=[];
  obras.forEach(function(o){ var ev=orcVigente(o.id)?evm(o):null; fis.push(ev&&ev.fisPct!=null?Math.round(ev.fisPct*100):0); cr.push(Math.round((avancoCron(o.id)||0)*100)); });
  var g1=svgGrafico({titulo:'Avanço físico × cronograma por obra', labels:lb, barras:[{nome:'Físico executado',cor:'var(--steel)',v:fis},{nome:'Cronograma',cor:'var(--amber-bar)',opaco:true,v:cr}], fmt:function(v){ return Math.round(v)+'%'; }});
  var g2='';
  if(obras.length===1&&orcVigente(obras[0].id)){ var cv=curvasS(obras[0]); if(cv.meses.length>1) g2=svgGrafico({titulo:'Curva S física: planejado e realizado', labels:cv.meses.map(mesCurto), linhas:[{nome:'Planejado',cor:'var(--steel)',tracejado:true,v:cv.fisPlan},{nome:'Realizado',cor:'var(--ok)',v:cv.fisReal}], fmt:function(v){ return Math.round(v)+'%'; }}); }
  return vgSec('Evolução','Barras: onde cada obra está agora. '+(g2?'Linhas: a curva S da obra escolhida.':'Escolha uma obra para ver a curva S.'),'<div class="pad">'+g1+g2+'</div>');
}
function vgListaEmExec(obras){
  var l=vgEmExecucao(obras);
  return vgSec('Itens em execução ('+l.length+')','Atividades do cronograma em andamento ou vencidas e ainda não concluídas.',l.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Atividade</th><th>Obra</th><th>Etapa</th><th>Prestador</th><th>Avanço</th><th>Fim previsto</th></tr></thead><tbody>'+l.slice(0,25).map(function(x){ var a=x.a; return '<tr'+(x.atras?' style="background:var(--crit-soft)"':'')+'><td><a href="'+vgLink(x.o.id,'cronograma')+'">'+esc(short(a.nome,50))+'</a></td><td>'+esc(x.o.nome)+'</td><td>'+(a.etapa?a.etapa:'—')+'</td><td>'+esc(prestNome(a.prestadorId)||'—')+'</td><td>'+(a.avanco||0)+'%'+vgBarra((a.avanco||0)/100,x.atras?'crit':'')+'</td><td>'+fmt(a.fim)+(x.atras?' <span class="chip crit">'+plural(x.atras,'dia','dias')+' de atraso</span>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>'+(l.length>25?'<p class="tiny muted" style="padding:8px 16px">e mais '+(l.length-25)+' atividades.</p>':''):vgVazio('Nenhuma atividade em execução.'));
}
function vgListaEtapasAtraso(A){
  var l=A.etapas.slice().sort(function(a,b){ return (b.e.atraso-a.e.atraso); });
  return vgSec('Etapas em atraso ou atrás da meta ('+l.length+')','Atraso = a etapa passou do fim programado sem ser liberada. “Atrás da meta” = executado 10 pontos abaixo do esperado pelo cronograma.',l.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th><th>Etapa</th><th>Programada</th><th>Meta hoje</th><th>Executado</th><th>Situação</th></tr></thead><tbody>'+l.map(function(x){ var e=x.e, s=VG_SIT[e.sit]; return '<tr><td>'+esc(x.o.nome)+'</td><td><a href="'+vgLink(x.o.id,'etapa/'+e.n)+'">'+e.n+'. '+esc(e.nome)+'</a></td><td>'+(e.j?fmtC(e.j.ini)+' a '+fmtC(e.j.fim):'—')+'</td><td>'+(e.esp==null?'—':Math.round(e.esp*100)+'%')+'</td><td>'+Math.round(e.fis*100)+'%'+vgBarra(e.fis,e.sit==='atrasada'?'crit':'warn')+'</td><td><span class="chip '+s[0]+'">'+s[1]+(e.atraso?' · '+plural(e.atraso,'dia','dias'):'')+'</span></td></tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nenhuma etapa em atraso.'));
}
function vgGeral(){
  var obras=vgObras(); if(!obras.length) return '<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra em andamento</h3><p>Cadastre uma obra no painel para ver os indicadores.</p></div>';
  var T=vgTimeline(obras), A=vgAtrasos(obras), h=vgH();
  return '<div style="margin-top:18px">'+vgLeituraRapida(obras,A)+'</div>'+vgMatrizPrazos(T)+vgProximos(T,h)+vgPorObra(obras)+vgGraficosAvanco(obras)+vgListaEtapasAtraso(A)+vgListaEmExec(obras)
    +'<div class="dash-h" style="margin-top:26px"><h2>Indicadores (todas as obras em andamento)</h2></div>'+vDashboard();
}

/* ---------- aba: etapas e avanço ---------- */
function vgEtapasAba(){
  var obras=vgObras(); if(!obras.length) return '<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra em andamento</h3></div>';
  var ve=gVe(), cards=obras.map(function(o,i){
    var et=vgEtapas(o.id), me=ve?metaEvo(o.id):null, pg={}; if(me) me.linhas.forEach(function(l){ pg[l.n]=l; });
    var rel=et.filter(function(e){ return e.j||e.st!=='nao_iniciada'||e.lib; });
    var g=svgGrafico({titulo:'Meta × executado por etapa', labels:rel.map(function(e){ return String(e.n); }), barras:[{nome:'Meta do cronograma',cor:'var(--amber-bar)',opaco:true,v:rel.map(function(e){ return e.esp==null?0:Math.round(e.esp*100); })},{nome:'Executado',cor:'var(--steel)',v:rel.map(function(e){ return Math.round(e.fis*100); })}], fmt:function(v){ return Math.round(v)+'%'; }});
    var rows=et.map(function(e){ var s=VG_SIT[e.sit], l=pg[e.n];
      return '<tr'+(e.sit==='atrasada'?' style="background:var(--crit-soft)"':'')+(e.sit==='sem'&&e.st==='nao_iniciada'?' class="muted"':'')+'><td><a href="'+vgLink(o.id,'etapa/'+e.n)+'">'+e.n+'. '+esc(e.nome)+'</a></td><td>'+esc(STATUS[e.st]||'')+'</td><td>'+(e.j?fmtC(e.j.ini)+' a '+fmtC(e.j.fim):'—')+'</td><td>'+(e.esp==null?'—':Math.round(e.esp*100)+'%')+'</td><td>'+Math.round(e.fis*100)+'%'+vgBarra(e.fis,e.sit==='atrasada'?'crit':(e.lib?'ok':''))+'</td>'+(ve?'<td>'+(l&&l.pagoPct!=null?Math.round(l.pagoPct*100)+'%':'—')+'</td>':'')+'<td><span class="chip '+s[0]+'">'+s[1]+(e.atraso?' · '+plural(e.atraso,'dia','dias'):'')+'</span>'+(l&&l.k&&l.ativa?' <span class="chip '+l.k+'" title="'+esc(l.mot.join(' '))+'">'+(l.k==='crit'?(l.dFin!=null&&l.dFin>TOL_FIN?'Pago adiante':'Atrás da meta'):'Atenção')+'</span>':'')+'</td></tr>'; }).join('');
    return '<details class="card sec"'+(i===0?' open':'')+'><summary class="card-h" style="cursor:pointer"><div><h2 style="display:inline">'+esc(o.nome)+'</h2> <span class="muted small">'+et.filter(function(e){ return e.lib; }).length+' de 22 etapas liberadas · '+et.filter(function(e){ return e.sit==='atrasada'; }).length+' atrasada(s)</span></div><a class="small" href="'+vgLink(o.id,'cronograma')+'">Abrir cronograma</a></summary>'
      +'<div class="pad">'+g+'</div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th>Situação</th><th>Programada</th><th>Meta hoje</th><th>Executado</th>'+(ve?'<th>% pago</th>':'')+'<th>Apontamento</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
  }).join('');
  var A=vgAtrasos(obras);
  return '<div style="margin-top:18px">'+vgListaEtapasAtraso(A)+vgListaEmExec(obras)+'</div>'+cards;
}

/* ---------- aba: compras ---------- */
function vgComprasObras(obras){ var ids={}; obras.forEach(function(o){ ids[o.id]=o; }); return L('compras').filter(function(c){ return ids[c.obraId]; }); }
/* o que ainda precisa ser comprado, dentro do que o cronograma já programou */
function vgAComprar(obras,h){
  var hj=hoje(), lim=addDays(hj,h), out=[];
  obras.forEach(function(o){
    var oid=o.id, rev=orcRevisado(oid); if(!(rev.total>0)) return;
    var cs=byObra('compras',oid);
    ETAPAS.forEach(function(e){
      var n=e.n, j=janelaEtapa(oid,n), d=etapaDoc(oid,n); if(!j||d.status==='liberada'||j.fim<hj) return;
      if(j.ini>lim) return;
      var mat=rev.itens.filter(function(i){ return (i.etapa||0)===n&&i.tipo==='material'; }), orcMat=r2(mat.reduce(function(s,i){ return s+i.total; },0)); if(!(orcMat>0)) return;
      var comp=r2(cs.filter(function(c){ return (c.etapa||0)===n&&c.status!=='necessidade'; }).reduce(function(s,c){ return s+valorCompra(c); },0));
      var falta=r2(orcMat-comp); if(falta<=orcMat*0.05) return;
      var ate=addDays(j.ini,-7);
      out.push({o:o, n:n, nome:e.nome, ini:j.ini, ate:ate, atrasado:ate<hj, orc:orcMat, comp:comp, falta:falta, itens:mat.slice().sort(function(a,b){ return b.total-a.total; }).slice(0,4)});
    });
  });
  return out.sort(function(a,b){ return a.ate<b.ate?-1:1; });
}
function vgFornecedores(obras){
  var ids={}, F={}; obras.forEach(function(o){ ids[o.id]=1; });
  L('compras').filter(function(c){ return ids[c.obraId]&&c.pedido&&c.pedido.fornecedorId; }).forEach(function(c){
    var id=c.pedido.fornecedorId, f=F[id]||(F[id]={id:id, n:0, aberto:0, atras:0, total:0, ent:0, dias:0, nAtr:0});
    f.n++; f.total=r2(f.total+(c.pedido.total||0));
    if(['pedido','entregue'].indexOf(c.status)>=0) f.aberto++;
    if(pedidoAtrasado(c)) f.atras++;
    if(c.entrega&&c.pedido.entregaPrevista){ f.ent++; var d=diffDays(c.pedido.entregaPrevista,c.entrega.data); if(d>0){ f.nAtr++; f.dias+=d; } }
  });
  L('compras').filter(function(c){ return ids[c.obraId]; }).forEach(function(c){ (c.cotacoes||[]).forEach(function(q){ if(q.fornecedorId){ var f=F[q.fornecedorId]||(F[q.fornecedorId]={id:q.fornecedorId, n:0, aberto:0, atras:0, total:0, ent:0, dias:0, nAtr:0}); f.cot=(f.cot||0)+1; } }); });
  return Object.keys(F).map(function(k){ return F[k]; }).sort(function(a,b){ return (b.atras-a.atras)||(b.total-a.total); });
}
function vgComprasAba(){
  var obras=vgObras(), ve=gVe(), h=vgH(), hj=hoje(); if(!obras.length) return '<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra em andamento</h3></div>';
  var cs=vgComprasObras(obras), A=vgAtrasos(obras);
  var cols=['necessidade','cotacao','aprovacao','pedido','entregue','conferido','pago'];
  var funil='<div class="kpis">'+cols.map(function(s){ var l=cs.filter(function(c){ return c.status===s; }); return vgCard(COMPRA_ST[s],'<span class="num">'+l.length+'</span>',ve&&l.length?dashBrl(l.reduce(function(a,c){ return a+(valorCompra(c)||0); },0)):'&nbsp;',(s==='pedido'&&A.entregas.length)||(s==='necessidade'&&A.pedir.length)?'crit':''); }).join('')+'</div>';
  var semConf=cs.filter(function(c){ return c.status==='entregue'; }).length, pedPag=obras.reduce(function(s,o){ return s+pedDaObra(o.id).filter(function(p){ return pedStatus(p)==='aprovacao'; }).length; },0);
  var ind='<div class="kpis" style="margin-top:12px">'+vgCard('Pedir até vencido','<span class="num">'+A.pedir.length+'</span>','compras atrasadas para emitir',A.pedir.length?'crit':'ok')+vgCard('Entregas atrasadas','<span class="num">'+A.entregas.length+'</span>','cobrar fornecedor',A.entregas.length?'crit':'ok')+vgCard('Entregue sem conferir','<span class="num">'+semConf+'</span>','conferir recebimento',semConf?'warn':'ok')+(ve?vgCard('Pedidos de pagamento a aprovar','<span class="num">'+pedPag+'</span>','',pedPag?'warn':'ok'):'')+'</div>';
  var ac=vgAComprar(obras,h);
  var aComprar=vgSec('O que comprar no fluxo já programado (próximos '+h+' dias)','Etapas que iniciam ou estão em execução, com material orçado ainda não coberto por compras. “Pedir até” = início da etapa menos 7 dias (valor provisório; o prazo de entrega de cada item refina isso).',ac.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th>Obra</th><th>Inicia</th><th>Pedir até</th><th>Itens principais do orçamento</th>'+(ve?'<th class="num">Material orçado</th><th class="num">Já comprado</th><th class="num">A comprar</th>':'')+'</tr></thead><tbody>'+ac.map(function(x){ return '<tr'+(x.atrasado?' style="background:var(--crit-soft)"':'')+'><td><a href="'+vgLink(x.o.id,'compras')+'">'+x.n+'. '+esc(x.nome)+'</a></td><td>'+esc(x.o.nome)+'</td><td>'+fmt(x.ini)+'</td><td>'+fmt(x.ate)+(x.atrasado?' <span class="chip crit">atrasado</span>':'')+'</td><td class="small">'+x.itens.map(function(i){ return esc(short(i.descricao,36)); }).join('; ')+'</td>'+(ve?'<td class="num">'+brl(x.orc)+'</td><td class="num">'+brl(x.comp)+'</td><td class="num"><strong>'+brl(x.falta)+'</strong></td>':'')+'</tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nada a comprar no horizonte: o material das etapas programadas já está coberto.'));
  var reg=cs.filter(function(c){ var lim=limiteCompra(c); return ['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0&&lim&&lim<=addDays(hj,h); }).sort(function(a,b){ return limiteCompra(a)<limiteCompra(b)?-1:1; });
  var regHtml=vgSec('Necessidades registradas para pedir ('+reg.length+')','Compras já cadastradas cujo “pedir até” cai no horizonte (ou já passou).',reg.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th>Obra</th><th>Situação</th><th>Pedir até</th><th>Uso na obra</th>'+(ve?'<th class="num">Valor</th>':'')+'</tr></thead><tbody>'+reg.slice(0,30).map(function(c){ var lim=limiteCompra(c), at=lim<hj; return '<tr'+(at?' style="background:var(--crit-soft)"':'')+'><td><a href="'+vgLink(c.obraId,'compras')+'">'+esc(short(c.item,50))+'</a>'+(c.critico?' <span class="chip warn">Crítico</span>':'')+(c.foraEscopo?' <span class="chip crit">Fora do escopo</span>':'')+'</td><td>'+esc(vgNomeObra(c.obraId))+'</td><td>'+esc(COMPRA_ST[c.status])+'</td><td>'+fmt(lim)+(at?' <span class="chip crit">'+plural(diffDays(lim,hj),'dia','dias')+'</span>':'')+'</td><td>'+fmt(c.dataUso)+'</td>'+(ve?'<td class="num">'+brl(valorCompra(c))+'</td>':'')+'</tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nenhuma necessidade pendente neste horizonte.'));
  var ent=cs.filter(function(c){ return c.status==='pedido'&&c.pedido&&c.pedido.entregaPrevista&&c.pedido.entregaPrevista<=addDays(hj,h); }).sort(function(a,b){ return a.pedido.entregaPrevista<b.pedido.entregaPrevista?-1:1; });
  var entHtml=vgSec('Entregas esperadas ('+ent.length+')','Pedidos emitidos com entrega prevista no horizonte ou já vencida.',ent.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th>Fornecedor</th><th>Obra</th><th>Entrega</th><th>Uso na obra</th></tr></thead><tbody>'+ent.map(function(c){ var at=c.pedido.entregaPrevista<hj, tarde=c.dataUso&&c.pedido.entregaPrevista>c.dataUso; return '<tr'+(at?' style="background:var(--crit-soft)"':'')+'><td><a href="'+vgLink(c.obraId,'compras')+'">'+esc(short(c.item,50))+'</a></td><td>'+esc(fornNome(c.pedido.fornecedorId)||'—')+'</td><td>'+esc(vgNomeObra(c.obraId))+'</td><td>'+fmt(c.pedido.entregaPrevista)+(at?' <span class="chip crit">'+plural(diffDays(c.pedido.entregaPrevista,hj),'dia','dias')+' de atraso</span>':'')+'</td><td>'+fmt(c.dataUso)+(tarde?' <span class="chip warn">chega depois</span>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nenhuma entrega no horizonte.'));
  var fs=vgFornecedores(obras);
  var fHtml=vgSec('Fornecedores','Quem tem pedidos nas obras em andamento: abertos, atrasados e pontualidade das entregas já recebidas.',fs.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Fornecedor</th><th class="num">Pedidos</th><th class="num">Em aberto</th><th class="num">Atrasados</th><th class="num">Entregas com atraso</th><th class="num">Atraso médio</th><th class="num">Cotações</th>'+(ve?'<th class="num">Total pedido</th>':'')+'</tr></thead><tbody>'+fs.slice(0,20).map(function(f){ return '<tr><td><strong>'+esc(fornNome(f.id)||'Fornecedor removido')+'</strong></td><td class="num">'+f.n+'</td><td class="num">'+f.aberto+'</td><td class="num">'+(f.atras?'<span class="chip crit">'+f.atras+'</span>':'0')+'</td><td class="num">'+(f.ent?f.nAtr+' de '+f.ent:'—')+'</td><td class="num">'+(f.nAtr?String(Math.round(f.dias/f.nAtr*10)/10).replace('.',',')+' d':'—')+'</td><td class="num">'+(f.cot||0)+'</td>'+(ve?'<td class="num">'+brl(f.total)+'</td>':'')+'</tr>'; }).join('')+'</tbody></table></div><p class="small" style="padding:10px 16px"><a href="#/fornecedores">Abrir cadastro de fornecedores</a></p>':vgVazio('Nenhum pedido emitido ainda.'));
  var locs=obras.reduce(function(a,o){ return a.concat(byObra('locacoes',o.id).filter(function(l){ return l.status==='ativa'||l.status==='prevista'; }).map(function(l){ return {o:o,l:l}; })); },[]);
  var locHtml=vgSec('Locações em curso ('+locs.length+')','',locs.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Equipamento</th><th>Obra</th><th>Fornecedor</th><th>Situação</th><th>Devolução prevista</th></tr></thead><tbody>'+locs.map(function(x){ var at=x.l.status==='ativa'&&x.l.fimPrevisto&&x.l.fimPrevisto<hj; return '<tr><td>'+esc(x.l.equipamento)+'</td><td>'+esc(x.o.nome)+'</td><td>'+esc(fornNome(x.l.fornecedorId)||'—')+'</td><td>'+esc(LOC_ST[x.l.status])+'</td><td>'+fmt(x.l.fimPrevisto)+(at?' <span class="chip crit">vencida</span>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nenhuma locação em curso.'));
  return '<div style="margin-top:18px"><div class="dash-h"><h2>Funil de compras</h2><span class="muted small">Todas as obras em andamento</span></div>'+funil+ind+'</div>'+aComprar+regHtml+entHtml+fHtml+locHtml;
}

/* ---------- aba: finanças ---------- */
var VG_FAIXAS=[['Vencido',null,-1],['0–7 d',0,7],['8–15 d',8,15],['16–30 d',16,30],['31–90 d',31,90],['91–120 d',91,120]];
function vgFinancasAba(){
  var ve=gVe(); if(!ve) return '<div class="card empty" style="margin-top:18px"><h3>Sem acesso aos valores</h3><p>O financeiro mostra valores em R$ e só aparece para quem tem esse acesso.</p></div>';
  var obras=vgObras(), hj=hoje(), h=vgH(); if(!obras.length) return '<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra em andamento</h3></div>';
  var pg=[]; obras.forEach(function(o){ pagamentosObra(o.id).forEach(function(p){ pg.push(Object.assign({o:o}, p)); }); });
  var ab=pg.filter(function(p){ return !p.pago; }), dias=function(p){ return p.venc?diffDays(hj,p.venc):null; };
  var faixa=VG_FAIXAS.map(function(f){ var l=ab.filter(function(p){ var d=dias(p); return d!=null&&(f[1]==null?d<0:(d>=f[1]&&d<=f[2])); }); return {t:f[0], n:l.length, v:r2(l.reduce(function(s,p){ return s+p.valor; },0))}; });
  var semData=ab.filter(function(p){ return !p.venc; }), soma=function(l){ return r2(l.reduce(function(s,p){ return s+p.valor; },0)); };
  var apor=[]; obras.forEach(function(o){ byObra('aportes',o.id).filter(function(a){ return !a.dataRecebida; }).forEach(function(a){ apor.push(a); }); });
  var aprAtraso=apor.filter(function(a){ return a.dataPrevista&&a.dataPrevista<hj; });
  var medAn=[]; obras.forEach(function(o){ byObra('medicoes',o.id).filter(function(m){ return m.status==='em_analise'; }).forEach(function(m){ medAn.push(m); }); });
  var pedAp=obras.reduce(function(s,o){ return s+pedDaObra(o.id).filter(function(p){ return pedStatus(p)==='aprovacao'; }).length; },0);
  var d=dashDados(), cumul=function(hh){ return soma(ab.filter(function(p){ var x=dias(p); return x!=null&&x>=0&&x<=hh; })); };
  var kp='<div class="kpis">'+vgCard('Vencido',dashBrl(soma(faixa[0].n?ab.filter(function(p){ var x=dias(p); return x!=null&&x<0; }):[])),plural(faixa[0].n,'pagamento','pagamentos'),faixa[0].n?'crit':'ok')
    +VG_H.map(function(hh){ return vgCard('A pagar em '+hh+' dias',dashBrl(cumul(hh)),hh===h?'horizonte escolhido':'acumulado',hh===h?'warn':''); }).join('')
    +vgCard('Aportes a receber',dashBrl(r2(apor.reduce(function(s,a){ return s+(a.valorPrevisto||0); },0))),aprAtraso.length?aprAtraso.length+' atrasado(s)':plural(apor.length,'aporte','aportes'),aprAtraso.length?'warn':'')
    +vgCard('Medições em análise','<span class="num">'+medAn.length+'</span>',medAn.length?'esperando decisão':'nenhuma parada',medAn.length?'warn':'ok')
    +vgCard('Pedidos de pagamento a aprovar','<span class="num">'+pedAp+'</span>','',pedAp?'warn':'ok')
    +vgCard('Resultado do mês',dashBrl(d.res),d.margem==null?'sem lançamentos no DRE':'margem '+dashPct(d.margem),d.margem==null?'':(d.margem>=0?'ok':'crit'),'#/dre')+'</div>';
  var g1=svgGrafico({titulo:'A pagar por faixa de vencimento', labels:faixa.map(function(f){ return f.t; }), barras:[{nome:'A pagar',cor:'var(--amber-bar)',v:faixa.map(function(f){ return f.v; })}], fmt:kfmt});
  var meses=[]; for(var i=0,m=hj.slice(0,7);i<5;i++,m=mesAdd(m,1)) meses.push(m);
  var saidas=meses.map(function(m){ return soma(ab.filter(function(p){ return p.venc&&p.venc.slice(0,7)===m; })); }), entradas=meses.map(function(m){ return r2(apor.filter(function(a){ return a.dataPrevista&&a.dataPrevista.slice(0,7)===m; }).reduce(function(s,a){ return s+(a.valorPrevisto||0); },0)); });
  var g2=svgGrafico({titulo:'Saída prevista × aportes previstos por mês', labels:meses.map(mesCurto), barras:[{nome:'A pagar',cor:'var(--amber-bar)',v:saidas},{nome:'Aportes a receber',cor:'var(--ok)',v:entradas}], fmt:kfmt});
  var graf=vgSec('Gráficos','','<div class="pad">'+g1+g2+'</div>');
  var linhas=obras.map(function(o){
    var c=custoEtapa(o.id).total, me=metaEvo(o.id).kpi, pgo=pagamentosObra(o.id).filter(function(p){ return !p.pago; }), fm=fluxoMes(o.id,hj.slice(0,7));
    var venc=pgo.filter(function(p){ return p.venc&&p.venc<hj; }), a30=pgo.filter(function(p){ return p.venc&&p.venc>=hj&&p.venc<=addDays(hj,30); });
    return '<tr><td><a href="'+vgLink(o.id,'financeiro')+'"><strong>'+esc(o.nome)+'</strong></a></td><td class="num">'+brl(c.orcado)+'</td><td class="num">'+brl(c.comprometido)+'</td><td class="num">'+brl(c.apropriado)+'</td><td class="num">'+brl(c.pago)+'</td><td class="num"><span class="chip '+(me.ipeK||'')+'">'+(me.ipe==null?'—':String(Math.round(me.ipe*100)/100).replace('.',','))+'</span></td><td class="num">'+(venc.length?'<span class="chip crit">'+brl(soma(venc))+'</span>':'—')+'</td><td class="num">'+brl(soma(a30))+'</td><td class="num">'+brl(fm.tot.plan)+' × '+brl(fm.tot.prev+fm.tot.pago)+'</td></tr>';
  }).join('');
  var porObra=vgSec('Financeiro por obra','Orçado, comprometido, apropriado e pago; IPE = pago ÷ executado (acima de 1,05 é pagar adiante do físico); a pagar vencido e em 30 dias; e o fluxo do mês (programado pelo cronograma × saída).','<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th><th class="num">Orçado</th><th class="num">Comprometido</th><th class="num">Apropriado</th><th class="num">Pago</th><th class="num">IPE</th><th class="num">Vencido</th><th class="num">A pagar em 30 d</th><th class="num">Mês: programado × saída</th></tr></thead><tbody>'+linhas+'</tbody></table></div>');
  var lim=addDays(hj,h), prox=ab.filter(function(p){ return p.venc&&p.venc<=lim; }).sort(function(a,b){ return a.venc<b.venc?-1:1; });
  var proxHtml=vgSec('Pagamentos nos próximos '+h+' dias ('+prox.length+')','Inclui vencidos. '+(semData.length?plural(semData.length,'pagamento sem data','pagamentos sem data')+' ficam fora: preencha o vencimento.':''),prox.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Vence</th><th>Pagamento</th><th>Obra</th><th>Etapa</th><th>Origem</th><th class="num">Valor</th></tr></thead><tbody>'+prox.slice(0,40).map(function(p){ var v=p.venc<hj; return '<tr'+(v?' style="background:var(--crit-soft)"':'')+'><td>'+fmt(p.venc)+(v?' <span class="chip crit">vencido</span>':'')+'</td><td><a href="'+p.to+'">'+esc(short(p.desc,60))+'</a></td><td>'+esc(p.o.nome)+'</td><td>'+(p.etapa?p.etapa:'—')+'</td><td>'+esc(p.origem)+'</td><td class="num">'+brl(p.valor)+'</td></tr>'; }).join('')+'</tbody></table></div>':vgVazio('Nenhum pagamento neste horizonte.'));
  var des=[]; obras.forEach(function(o){ metaEvo(o.id).linhas.filter(function(l){ return l.k&&l.ativa; }).forEach(function(l){ des.push({o:o,l:l}); }); });
  var desHtml=vgSec('Meta × evolução × pagamentos: etapas com desvio ('+des.length+')','Onde o pago está adiante do executado ou o físico está atrás da meta.',des.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th><th>Etapa</th><th>Meta</th><th>Executado</th><th>% pago</th><th>Apontamento</th></tr></thead><tbody>'+des.map(function(x){ var l=x.l; return '<tr><td>'+esc(x.o.nome)+'</td><td><a href="'+vgLink(x.o.id,'metaevo')+'">'+l.n+'. '+esc(l.nome)+'</a></td><td>'+(l.esp==null?'—':Math.round(l.esp*100)+'%')+'</td><td>'+Math.round(l.fis*100)+'%</td><td>'+(l.pagoPct==null?'—':Math.round(l.pagoPct*100)+'%')+'</td><td><span class="chip '+l.k+'">'+(l.k==='crit'?'Desalinhada':'Atenção')+'</span> <span class="small">'+esc(l.mot.join(' '))+'</span></td></tr>'; }).join('')+'</tbody></table></div>':vgVazio('Todas as etapas em andamento estão alinhadas.'));
  return '<div style="margin-top:18px">'+kp+'</div>'+graf+porObra+proxHtml+desHtml+'<p class="small muted" style="margin-top:14px">Mais detalhe: <a href="#/dre">DRE gerencial</a> · aba Financeiro, Pedidos de pagamento e Pagamentos e prazos de cada obra.</p>';
}

/* ---------- aba: prazos ---------- */
function vgPrazosAba(){
  var obras=vgObras(); if(!obras.length) return '<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra em andamento</h3></div>';
  var T=vgTimeline(obras), hj=hoje(), ve=gVe(), cortes=[[7,'Até 7 dias'],[15,'8 a 15 dias'],[30,'16 a 30 dias'],[90,'31 a 90 dias'],[120,'91 a 120 dias']], ant=-1, h0=vgH();
  var blocos=cortes.map(function(c){
    var lo=ant+1, hi=c[0]; ant=c[0];
    var l=T.filter(function(x){ var d=diffDays(hj,x.data); return d>=lo&&d<=hi; });
    var por={}; l.forEach(function(x){ por[x.cat]=(por[x.cat]||0)+1; });
    var resumo=Object.keys(por).map(function(k){ return '<span class="chip">'+esc(VG_CAT[k])+': '+por[k]+'</span>'; }).join(' ');
    return '<details class="card sec"'+(hi<=h0?' open':'')+'><summary class="card-h" style="cursor:pointer"><div><h2 style="display:inline">'+c[1]+'</h2> <span class="muted small">'+plural(l.length,'item','itens')+'</span></div><div class="row" style="gap:4px">'+resumo+'</div></summary>'
      +(l.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Data</th><th>Frente</th><th>O quê</th><th>Obra</th>'+(ve?'<th class="num">Valor</th>':'')+'</tr></thead><tbody>'+l.slice(0,60).map(function(x){ return '<tr><td>'+fmt(x.data)+'</td><td>'+esc(VG_CAT[x.cat])+'</td><td><a href="'+x.to+'">'+esc(short(x.txt,70))+'</a></td><td>'+esc(x.o.nome)+'</td>'+(ve?'<td class="num">'+(x.valor!=null?brl(x.valor):'')+'</td>':'')+'</tr>'; }).join('')+'</tbody></table></div>'+(l.length>60?'<p class="tiny muted" style="padding:8px 16px">e mais '+(l.length-60)+' itens.</p>':''):vgVazio('Nada programado nesta faixa.'))+'</details>';
  }).join('');
  var g=svgGrafico({titulo:'Itens a vencer por faixa de prazo', labels:cortes.map(function(c){ return c[0]+' d'; }), barras:[{nome:'Itens',cor:'var(--steel)',v:(function(){ var a=-1; return cortes.map(function(c){ var lo=a+1; a=c[0]; return T.filter(function(x){ var d=diffDays(hj,x.data); return d>=lo&&d<=c[0]; }).length; }); })()}], fmt:function(v){ return String(Math.round(v)); }});
  return '<div style="margin-top:18px">'+vgMatrizPrazos(T)+'</div>'+vgSec('Distribuição','','<div class="pad">'+g+'</div>')+blocos;
}

function vVisao(){
  if(ehCliente()) return notFound();
  var aba=vgAba(), corpo=aba==='etapas'?vgEtapasAba():(aba==='compras'?vgComprasAba():(aba==='financas'?vgFinancasAba():(aba==='prazos'?vgPrazosAba():vgGeral())));
  return '<div class="wrap">'+vgCab()+corpo+'</div>';
}
COBX.vVisao=vVisao; COBX.vgAComprar=vgAComprar; COBX.vgTimeline=vgTimeline; COBX.vgAtrasos=vgAtrasos; COBX.vgEtapas=vgEtapas; COBX.vgFornecedores=vgFornecedores;
