/* ================= VISÕES ================= */
var ui={semana:{}, ocFiltro:'todas', det:{}, ganttScroll:0, agMes:hoje().slice(0,7), agDia:hoje(), agArea:'todas', docMes:{}, orcBusca:'', orcEtapa:'', orcTipo:'', finFiltro:'abertas'};
var lastKey=null;

function parseRoute(){
  var h=(location.hash||'#/painel').replace(/^#\/?/,''), p=h.split('/');
  if(p[0]==='obra' && p[1]){
    if(p[2]==='etapa' && p[3]) return {view:'etapa', oid:p[1], n:Number(p[3])};
    return {view:'obra', oid:p[1], tab:p[2]||'resumo'};
  }
  if(p[0]==='prestadores') return {view:'prestadores'};
  if(p[0]==='agenda') return {view:'agenda'};
  if(p[0]==='fornecedores') return {view:'fornecedores'};
  if(p[0]==='dre') return {view:'dre'};
  if(p[0]==='nuvem') return {view:'nuvem'};
  if(p[0]==='historico') return {view:'historico'};
  return {view:'painel'};
}
function topbar(r){
  var cur=function(v){ return r.view===v?' aria-current="page"':''; };
  var obraAtiva=(r.view==='obra'||r.view==='etapa');
  return '<header class="top"><div class="top-in"><a class="brand" href="#/painel">Cariati<span>·Obras</span></a>'
    +'<nav class="nav" aria-label="Principal"><a href="#/painel"'+(r.view==='painel'||obraAtiva?' aria-current="page"':'')+'>Obras</a><a href="#/agenda"'+cur('agenda')+'>Agenda</a><a href="#/prestadores"'+cur('prestadores')+'>Prestadores</a><a href="#/fornecedores"'+cur('fornecedores')+'>Fornecedores</a><a href="#/dre"'+cur('dre')+'>DRE</a>'+(Store.backend==='supabase'?'<a href="#/historico"'+cur('historico')+'>Histórico</a>':'')+'<a href="#/nuvem"'+cur('nuvem')+'>Nuvem</a></nav>'
    +'<div class="tools"><button class="btn ghost sm" data-act="exportar" title="Baixar uma cópia dos dados">Exportar</button><button class="btn ghost sm" data-act="tema" title="Alternar tema claro e escuro" aria-label="Alternar tema">◐</button></div></div></header>';
}
function banners(){
  var b='';
  if(Store.mode==='local') b+='<div class="banner">Modo local: os dados ficam só neste navegador e não são compartilhados com a equipe. <a href="#/nuvem">Conectar à nuvem</a></div>';
  if(!Store.writable) b+='<div class="banner">Acesso somente leitura: você pode consultar, mas não editar.</div>';
  return b;
}
function chipMod(m){ return '<span class="chip steel">'+esc(m||'—')+'</span>'; }
function notFound(){ return '<div class="wrap"><div class="card empty"><h3>Não encontrei este registro</h3><p>Ele pode ter sido excluído. <a href="#/painel">Voltar às obras</a></p></div></div>'; }

function regua(oid, mini){
  var crit={};
  byObra('ocorrencias',oid).forEach(function(o){ if(ocAberta(o)&&o.gravidade==='critica'&&o.etapa) crit[o.etapa]=1; });
  var fases=FASES.map(function(f){
    var segs=f.etapas.map(function(n){
      var st=etapaDoc(oid,n).status, cr=crit[n]?' crit':'';
      var title=n+'. '+etapaInfo(n).nome+' — '+STATUS[st]+(cr?' — ocorrência crítica aberta':'');
      return mini?'<span class="seg '+st+cr+'" title="'+esc(title)+'">'+n+'</span>'
                 :'<a class="seg '+st+cr+'" href="#/obra/'+oid+'/etapa/'+n+'" title="'+esc(title)+'" aria-label="'+esc(title)+'">'+n+'</a>';
    }).join('');
    return '<div class="fase" style="flex:'+f.etapas.length+'"><div class="segs" style="grid-template-columns:repeat('+f.etapas.length+',1fr)">'+segs+'</div><div class="lbl">'+esc(f.nome)+'</div></div>';
  }).join('');
  return '<div class="'+(mini?'':'regua-wrap')+'"><div class="regua'+(mini?' mini':'')+'">'+fases+'</div></div>';
}
function legenda(){
  return '<div class="legenda"><span><i></i>Não iniciada</span><span><i class="em_execucao"></i>Em execução</span><span><i class="aguardando_vistoria"></i>Aguardando vistoria</span><span><i class="liberada"></i>Liberada</span><span><i class="crit"></i>Ocorrência crítica aberta</span></div>';
}

/* ---- painel ---- */
function vPainel(){
  var obras=L('obras').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
  var alerts=[];
  obras.forEach(function(o){ alertasObra(o).forEach(function(a){ alerts.push(Object.assign({obra:o.nome},a)); }); });
  L('prestadores').forEach(function(p){
    var s=validade(p.seguro), t=validade(p.treinamento);
    if(s.k==='crit'||s.k==='warn') alerts.push({k:s.k, obra:p.nome, t:'Seguro: '+s.t.toLowerCase()+'.', to:'#/prestadores'});
    if(t.k==='crit'||t.k==='warn') alerts.push({k:t.k, obra:p.nome, t:'Treinamento: '+t.t.toLowerCase()+'.', to:'#/prestadores'});
  });
  alerts.sort(function(a,b){ return (a.k==='crit'?0:1)-(b.k==='crit'?0:1); });
  var alHtml=alerts.length?'<section class="card sec" style="margin-top:18px"><div class="card-h"><h2>Precisa de atenção</h2><span class="chip '+(alerts.some(function(a){return a.k==='crit';})?'crit':'warn')+'">'+alerts.length+'</span></div><ul class="alerts">'
    +alerts.slice(0,12).map(function(a){ return '<li><span class="dot '+a.k+'"></span><div class="grow"><strong>'+esc(a.obra)+'</strong> <span class="muted">— '+esc(a.t)+'</span></div><a class="small" href="'+a.to+'">Abrir</a></li>'; }).join('')
    +(alerts.length>12?'<li class="muted small">E mais '+(alerts.length-12)+' alertas.</li>':'')+'</ul></section>':'';
  var cards=obras.map(function(o){
    var ppc=ppcAtual(o.id), ab=byObra('ocorrencias',o.id).filter(ocAberta), cr=ab.filter(function(x){return x.gravidade==='critica';}).length;
    var and=ETAPAS.filter(function(e){ var s=etapaDoc(o.id,e.n).status; return s==='em_execucao'||s==='aguardando_vistoria'; });
    var lib=ETAPAS.filter(function(e){ return etapaDoc(o.id,e.n).status==='liberada'; }).length;
    return '<a class="card pad" style="display:block;color:inherit" href="#/obra/'+o.id+'/resumo"><div class="row spread" style="align-items:flex-start"><div class="grow"><h3>'+esc(o.nome)+'</h3><p class="muted small">'+esc([o.cliente,o.tipologia].filter(Boolean).join(' · '))+'</p></div>'+chipMod(o.modalidade)+'</div>'
      +'<div style="margin:14px 0 6px">'+regua(o.id,true)+'</div>'
      +'<p class="small muted">'+lib+' de 22 etapas liberadas'+(and.length?' · em andamento: '+and.slice(0,3).map(function(e){return e.n+'. '+esc(e.nome);}).join(', ')+(and.length>3?'…':''):'')+'</p>'
      +'<div class="row" style="margin-top:10px;gap:8px"><span class="chip '+(ppc?(ppc.ppc*100>=(o.metaPPC==null?80:o.metaPPC)?'ok':'warn'):'')+'">PPC '+(ppc?pct(ppc.ppc):'—')+'</span><span class="chip '+(cr?'crit':(ab.length?'warn':'ok'))+'">'+plural(ab.length,'ocorrência aberta','ocorrências abertas')+(cr?' ('+cr+' crítica'+(cr>1?'s':'')+')':'')+'</span></div></a>';
  }).join('');
  var vazio='<div class="card empty" style="margin-top:18px"><h3>Nenhuma obra cadastrada</h3><p>Cadastre a primeira obra para receber as 22 etapas do protocolo, o cronograma e os controles de qualidade.</p><p style="margin-top:14px"><button class="btn primary" data-act="obra-nova" data-write>Cadastrar obra</button></p></div>';
  return '<div class="wrap"><div class="row spread"><h1>Obras</h1><button class="btn primary" data-act="obra-nova" data-write>+ Nova obra</button></div>'+alHtml
    +(obras.length?'<div class="grid cols3 sec">'+cards+'</div>':vazio)+'</div>';
}

/* ---- obra ---- */
function vObra(r){
  var o=G('obras',r.oid); if(!o) return notFound();
  var mapa=abaMapa(), tab=mapa[r.tab]?r.tab:'resumo', fn=mapa[tab];
  var meta=[o.cliente, o.endereco, o.tipologia, o.area?o.area+' m²':'', o.inicio?'início em '+fmt(o.inicio):''].filter(Boolean).map(esc).join(' · ');
  return '<div class="wrap"><a class="back" href="#/painel">← Todas as obras</a>'
    +'<div class="ob-head"><div class="grow"><h1>'+esc(o.nome)+(o.codigo?' <span class="muted small num">'+esc(o.codigo)+'</span>':'')+'</h1><div class="meta">'+chipMod(o.modalidade)+'<span>'+meta+'</span></div></div>'
    +'<div class="row"><button class="btn" data-act="obra-editar" data-oid="'+o.id+'" data-write>Editar obra</button></div></div>'
    +'<div style="margin-top:20px">'+regua(o.id,false)+legenda()+'</div>'
    +obraNav(o,tab)
    +'<div style="margin-top:20px">'+fn(o)+'</div></div>';
}

function indRow(nome, formula, valor, sub, k){
  return '<tr><td><strong>'+esc(nome)+'</strong><div class="f">'+esc(formula)+'</div></td><td class="v">'+valor+'</td><td><span class="dot '+(k||'')+'" style="margin-right:8px"></span><span class="small">'+sub+'</span></td></tr>';
}
function tResumo(o){
  var oid=o.id, meta=o.metaPPC==null?80:o.metaPPC, dias=o.diasEscalar==null?7:o.diasEscalar;
  var al=alertasObra(o);
  var ppc=ppcAtual(oid), conf=conformidade(oid), nFichas=byObra('fichas',oid).length;
  var ab=byObra('ocorrencias',oid).filter(ocAberta);
  var cr=ab.filter(function(x){return x.gravidade==='critica';}).length, im=ab.filter(function(x){return x.gravidade==='importante';}).length, si=ab.length-cr-im;
  var venc=ab.filter(vencidaOc), maxV=venc.reduce(function(m,x){return Math.max(m,atrasoOc(x));},0);
  var lib=ETAPAS.filter(function(e){ return etapaDoc(oid,e.n).status==='liberada'; }).length;
  var cron=avancoCron(oid), atr=byObra('atividades',oid).filter(atAtrasada).length;
  var alHtml=al.length?'<section class="card"><div class="card-h"><h2>Alertas da obra</h2></div><ul class="alerts">'+al.map(function(a){ return '<li><span class="dot '+a.k+'"></span><div class="grow">'+esc(a.t)+'</div><a class="small" href="'+a.to+'">Abrir</a></li>'; }).join('')+'</ul></section>'
    :'<section class="card pad"><span class="dot ok" style="margin-right:8px"></span>Nenhum alerta aberto nesta obra.</section>';
  var tbl='<section class="card"><div class="card-h"><h2>Indicadores</h2></div><div class="tbl-scroll"><table class="ind"><thead><tr><th>Indicador</th><th>Valor</th><th>Situação</th></tr></thead><tbody>'
    +indRow('PPC','Pacotes 100% concluídos ÷ pacotes planejados na semana', ppc?pct(ppc.ppc):'—', ppc?(ppc.ok+' de '+ppc.tot+' pacotes na semana de '+fmtC(ppc.semana)+'. Meta: '+meta+'%'):'Nenhuma semana fechada ainda. Meta: '+meta+'%', ppc?(ppc.ppc*100>=meta?'ok':'warn'):'')
    +indRow('Taxa de conformidade','Fichas aprovadas na 1ª inspeção ÷ fichas emitidas', pct(conf), nFichas?plural(nFichas,'ficha registrada','fichas registradas'):'Nenhuma ficha registrada ainda', conf==null?'':(conf>=0.9?'ok':'warn'))
    +indRow('Ocorrências abertas','Críticas, importantes e simples', String(ab.length), cr+' crítica(s) · '+im+' importante(s) · '+si+' simples', cr?'crit':(ab.length?'warn':'ok'))
    +indRow('Apontamentos vencidos','Prazo de correção já passou', String(venc.length), venc.length?('O mais antigo venceu há '+plural(maxV,'dia','dias')+'. Escalar à diretoria após '+dias+' dias.'):'Nenhum vencido', venc.length?(maxV>dias?'crit':'warn'):'ok')
    +indRow('Etapas liberadas','Etapas com vistoria de liberação aprovada', lib+' <span class="small muted">de 22</span>', pct(lib/22)+' do protocolo concluído', '')
    +indRow('Avanço do cronograma','Avanço das atividades, ponderado pela duração', pct(cron), cron==null?'Nenhuma atividade cadastrada':(plural(atr,'atividade atrasada','atividades atrasadas')+(o.baseData?' · linha de base v'+o.baseVersao+' de '+fmt(o.baseData):' · sem linha de base')), cron==null?'':(atr?'warn':'ok'))
    +indRowsP2(o)+'</tbody></table></div></section>';
  var hist=ppcHist(oid,8);
  var bars=hist.map(function(w){
    var h=w.ppc==null?0:Math.round(w.ppc*70);
    var cls=w.tot===0?'':(w.pend>0?' open':(w.ppc*100<meta?' low':''));
    return '<div class="b"><div class="val">'+(w.ppc==null?'':Math.round(w.ppc*100)+'%')+'</div><div class="col'+cls+'" style="height:'+(w.tot?Math.max(h,3):2)+'%"></div><span>'+fmtC(w.semana)+'</span></div>';
  }).join('');
  var ppcCard='<section class="card"><div class="card-h"><h2>PPC das últimas 8 semanas</h2><span class="small muted">Cinza: semana com pacotes sem marcação</span></div><div class="bars">'+bars+'</div><div style="height:12px"></div></section>';
  var causas={}; hist.forEach(function(w){ w.ps.forEach(function(p){ if(p.concluido===false&&p.causa) causas[p.causa]=(causas[p.causa]||0)+1; }); });
  var maxC=Math.max.apply(null,Object.keys(causas).map(function(k){return causas[k];}).concat([1]));
  var causasHtml=Object.keys(causas).length?Object.keys(CAUSAS).map(function(k){ var n=causas[k]||0; return '<div class="hbar"><span>'+CAUSAS[k]+'</span><div class="t"><i style="width:'+Math.round(n/maxC*100)+'%"></i></div><span class="num">'+n+'</span></div>'; }).join(''):'<p class="muted small" style="padding:0 16px">Sem pacotes não concluídos nas últimas 8 semanas.</p>';
  var causasCard='<section class="card"><div class="card-h"><h2>Causas de não cumprimento</h2></div><div style="padding:10px 0">'+causasHtml+'</div></section>';
  var bands=[['0 a 3 dias',0,3],['4 a 7 dias',4,7],['8 a 15 dias',8,15],['Mais de 15 dias',16,99999]];
  var maxB=Math.max.apply(null,bands.map(function(b){return ab.filter(function(x){var i=idadeOc(x);return i>=b[1]&&i<=b[2];}).length;}).concat([1]));
  var agingHtml=ab.length?bands.map(function(b){ var n=ab.filter(function(x){var i=idadeOc(x);return i>=b[1]&&i<=b[2];}).length; return '<div class="hbar"><span>'+b[0]+'</span><div class="t"><i style="width:'+Math.round(n/maxB*100)+'%;background:'+(b[1]>=8?'var(--crit)':'var(--steel)')+'"></i></div><span class="num">'+n+'</span></div>'; }).join(''):'<p class="muted small" style="padding:0 16px">Nenhum apontamento aberto.</p>';
  var agingCard='<section class="card"><div class="card-h"><h2>Idade dos apontamentos abertos</h2></div><div style="padding:10px 0">'+agingHtml+'</div></section>';
  return '<div class="stack">'+alHtml+'<div class="grid cols2"><div class="stack">'+tbl+'</div><div class="stack">'+ppcCard+causasCard+agingCard+'</div></div></div>';
}

function kcardEtapa(o,e){
  var d=etapaDoc(o.id,e.n), res=fichasResumo(o.id,e.n), i=STATUS_ORDER.indexOf(d.status);
  var cr=byObra('ocorrencias',o.id).filter(function(x){ return x.etapa===e.n&&x.gravidade==='critica'&&ocAberta(x); }).length;
  var back=i>0?'<button class="btn sm" data-act="etapa-mover" data-oid="'+o.id+'" data-n="'+e.n+'" data-to="'+STATUS_ORDER[i-1]+'" data-write>← Voltar</button>':'';
  var fwd=i<3?'<button class="btn sm primary" data-act="etapa-mover" data-oid="'+o.id+'" data-n="'+e.n+'" data-to="'+STATUS_ORDER[i+1]+'" data-write>'+(i===0?'Iniciar':(i===1?'Vistoria':'Liberar'))+' →</button>':'';
  return '<div class="kcard'+(cr?' crit':'')+'"><a class="t" href="#/obra/'+o.id+'/etapa/'+e.n+'">'+e.n+'. '+esc(e.nome)+'</a><div class="m"><span class="chip">'+res.aprov+'/'+res.total+' fichas</span>'+(res.rep?'<span class="chip crit">'+res.rep+' reprovada'+(res.rep>1?'s':'')+'</span>':'')+(cr?'<span class="chip crit">Crítica aberta</span>':'')+'</div><div class="mv">'+back+fwd+'</div></div>';
}
function tEtapas(o){
  var cols=STATUS_ORDER.map(function(st){
    var es=ETAPAS.filter(function(e){ return etapaDoc(o.id,e.n).status===st; });
    return '<section class="col"><header>'+STATUS[st]+' <span class="n num">'+es.length+'</span></header><div class="cards">'+(es.length?es.map(function(e){ return kcardEtapa(o,e); }).join(''):'<p class="muted small" style="padding:8px 4px">Nenhuma etapa</p>')+'</div></section>';
  }).join('');
  return '<p class="muted small" style="margin-bottom:12px">O quadro segue o protocolo: uma etapa só começa com a anterior liberada em vistoria, e só é liberada com todas as fichas aprovadas e sem ocorrência crítica aberta.</p><div class="board">'+cols+'</div>';
}

/* ---- cronograma (Gantt) ---- */
function cmpAt(a,b){ return ((a.etapa||99)-(b.etapa||99)) || (a.inicio<b.inicio?-1:1); }
function tCron(o){
  var ats=byObra('atividades',o.id).sort(cmpAt), tem=!!o.baseData;
  var head='<div class="sec-h"><div><h2>Cronograma</h2><p class="muted small">'+(tem?'Linha de base v'+o.baseVersao+' congelada em '+fmt(o.baseData)+'. Mudar datas exige registrar o motivo.':'Sem linha de base. Congele-a quando o cronograma for aprovado.')+'</p></div>'
    +'<div class="row"><button class="btn" data-act="base-congelar" data-oid="'+o.id+'" data-write'+(ats.length?'':' disabled')+'>'+(tem?'Nova linha de base':'Congelar linha de base')+'</button><button class="btn primary" data-act="ativ-nova" data-oid="'+o.id+'" data-write>+ Atividade</button></div></div>';
  if(!ats.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhuma atividade no cronograma</h3><p>Cadastre as atividades de cada etapa, com início, fim, prestador e predecessora.</p></div>';
  var hj=hoje(), minD=hj, maxD=hj;
  ats.forEach(function(a){ [a.inicio,a.fim,a.base&&a.base.inicio,a.base&&a.base.fim].forEach(function(x){ if(x){ if(x<minD) minD=x; if(x>maxD) maxD=x; } }); });
  var start=segunda(addDays(minD,-3)), end=addDays(maxD,10), weeks=Math.ceil((diffDays(start,end)+1)/7), days=weeks*7;
  var dw=window.innerWidth<640?12:16, wk='';
  for(var i=0;i<weeks;i++) wk+='<span>'+fmtC(addDays(start,i*7))+'</span>';
  var rows='<div class="g-row head"><div class="g-label">Atividade</div><div class="g-weeks">'+wk+'</div></div>', lastE=-1;
  ats.forEach(function(a){
    var en=a.etapa||0;
    if(en!==lastE){ lastE=en; rows+='<div class="g-row etapa"><div class="g-label">'+(en?en+'. '+esc(etapaInfo(en).nome):'Geral')+'</div><div class="g-track"></div></div>'; }
    var off=diffDays(start,a.inicio), len=diffDays(a.inicio,a.fim)+1;
    var cls=(a.avanco||0)>=100?' done':(atAtrasada(a)?' late':'');
    var pred=a.pred?ats.filter(function(x){return x.id===a.pred;})[0]:null, warn=pred&&a.inicio<=pred.fim;
    var base=a.base?'<div class="g-base" style="left:calc('+diffDays(start,a.base.inicio)+'*var(--dw));width:calc('+(diffDays(a.base.inicio,a.base.fim)+1)+'*var(--dw))" title="Linha de base: '+fmtC(a.base.inicio)+' a '+fmtC(a.base.fim)+'"></div>':'';
    rows+='<div class="g-row"><div class="g-label"><button type="button" data-act="ativ-editar" data-id="'+a.id+'"><span class="nm">'+esc(a.nome)+'</span><span class="tiny muted">'+fmtC(a.inicio)+' a '+fmtC(a.fim)+' · '+(a.avanco||0)+'%'+(a.prestadorId?' · '+esc(prestNome(a.prestadorId)):'')+(warn?' · ⚠ começa antes do fim de "'+esc(pred.nome)+'"':'')+'</span></button></div>'
      +'<div class="g-track"><div class="g-bar'+cls+'" style="left:calc('+off+'*var(--dw));width:calc('+len+'*var(--dw))" title="'+esc(a.nome)+': '+fmtC(a.inicio)+' a '+fmtC(a.fim)+'"><i style="width:'+(a.avanco||0)+'%"></i></div>'+base+'</div></div>';
  });
  var todayOff=diffDays(start,hj);
  return head+'<div class="gantt-scroll" style="margin-top:14px"><div class="gantt" style="--days:'+days+';--dw:'+dw+'px">'+rows+'<div class="g-today" style="left:calc(var(--lw) + '+todayOff+'*var(--dw))" title="Hoje"></div></div></div>'
    +'<div class="legenda"><span><i class="em_execucao"></i>Atividade (preenchimento = avanço)</span><span><i class="crit"></i>Atrasada</span><span><i class="liberada"></i>Concluída</span><span>Traço cinza: linha de base</span><span>Linha vermelha: hoje</span></div>';
}

/* ---- semana / PPC ---- */
function tSemana(o){
  var oid=o.id, sem=ui.semana[oid]||segunda(hoje()), info=semanaInfo(oid,sem), meta=o.metaPPC==null?80:o.metaPPC;
  var atual=(sem===segunda(hoje()));
  var nav='<div class="row spread"><div class="row"><button class="btn" data-act="sem-nav" data-oid="'+oid+'" data-d="-7" aria-label="Semana anterior">←</button><div><h2>Semana de '+fmtC(sem)+' a '+fmtC(addDays(sem,6))+'</h2><p class="muted small">'+(atual?'Semana atual':'')+'</p></div><button class="btn" data-act="sem-nav" data-oid="'+oid+'" data-d="7" aria-label="Próxima semana">→</button>'+(atual?'':'<button class="btn sm" data-act="sem-nav" data-oid="'+oid+'" data-d="0">Ir para hoje</button>')+'</div><button class="btn primary" data-act="pac-novo" data-oid="'+oid+'" data-write>+ Pacote de trabalho</button></div>';
  var ppc='<div class="card pad row spread" style="margin-top:14px"><div><div class="small muted">PPC da semana</div><div class="num" style="font-size:34px;font-weight:600;line-height:1.1">'+pct(info.ppc)+'</div></div><div class="small muted" style="text-align:right">'+info.ok+' de '+info.tot+' pacotes concluídos'+(info.pend?'<br>'+plural(info.pend,'pacote sem marcação','pacotes sem marcação'):'')+'<br>Meta '+meta+'%</div></div>';
  var body=info.ps.length?'<div class="card tbl-scroll" style="margin-top:14px"><table class="tbl"><thead><tr><th>Pacote de trabalho</th><th>Etapa</th><th>Prestador</th><th>Resultado</th><th></th></tr></thead><tbody>'
    +info.ps.map(function(p){
      var st=p.concluido===true?'<span class="chip ok">Concluído</span>':(p.concluido===false?'<span class="chip crit">Não concluído</span><div class="tiny muted">Causa: '+esc(CAUSAS[p.causa]||'—')+(p.obs?' · '+esc(p.obs):'')+'</div>':'<span class="chip">Sem marcação</span>');
      return '<tr><td>'+esc(p.descricao)+'</td><td>'+(p.etapa?p.etapa+'. '+esc(etapaInfo(p.etapa).nome):'—')+'</td><td>'+esc(prestNome(p.prestadorId)||'—')+'</td><td>'+st+'</td><td style="white-space:nowrap"><button class="btn sm" data-act="pac-ok" data-id="'+p.id+'" data-write>Concluído</button> <button class="btn sm" data-act="pac-nao" data-id="'+p.id+'" data-write>Não concluído</button> <button class="btn sm ghost" data-act="pac-editar" data-id="'+p.id+'" data-write aria-label="Editar pacote">Editar</button> <button class="btn sm ghost" data-act="pac-excluir" data-id="'+p.id+'" data-write aria-label="Excluir pacote">×</button></td></tr>';
    }).join('')+'</tbody></table></div>'
    :'<div class="card empty" style="margin-top:14px"><h3>Nenhum pacote nesta semana</h3><p>Liste o que a equipe se compromete a concluir. No fim da semana, marque cada pacote: só conta como concluído o que está 100% pronto.</p></div>';
  var pend=info.ps.filter(function(p){ return p.concluido!==true; }).length;
  var levar=pend?'<div style="margin-top:14px"><button class="btn" data-act="pac-levar" data-oid="'+oid+'" data-write>Levar '+plural(pend,'pacote pendente','pacotes pendentes')+' para a próxima semana</button></div>':'';
  return nav+ppc+body+levar;
}

/* ---- diário ---- */
function tDiario(o){
  var es=byObra('diarios',o.id).sort(function(a,b){ return a.data<b.data?1:-1; });
  var head='<div class="sec-h"><div><h2>Diário de obra</h2><p class="muted small">Registro diário com fotos datadas de cada serviço antes de ser coberto.</p></div><button class="btn primary" data-act="dia-novo" data-oid="'+o.id+'" data-write>+ Registro do dia</button></div>';
  if(!es.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhum registro ainda</h3><p>Registre efetivo, clima, o que foi executado e as fotos do dia.</p></div>';
  var dsem=['dom','seg','ter','qua','qui','sex','sáb'];
  return head+'<div class="card" style="margin-top:14px">'+es.map(function(e){
    var tot=(e.efetivo||[]).reduce(function(s,r){ return s+(r.q||0); },0);
    var ef=(e.efetivo||[]).map(function(r){ return esc(prestNome(r.p)||'Prestador removido')+' ('+r.q+')'; }).join(', ');
    return '<article class="entry"><div class="row spread"><div class="row"><strong class="num" style="font-size:17px">'+fmt(e.data)+'</strong><span class="muted small">'+dsem[parse(e.data).getDay()]+'</span>'+(e.clima?'<span class="chip">'+esc(e.clima)+'</span>':'')+(tot?'<span class="chip steel">'+tot+' no efetivo</span>':'')+'</div><div class="row"><button class="btn sm ghost" data-act="dia-editar" data-id="'+e.id+'" data-write>Editar</button><button class="btn sm ghost" data-act="dia-excluir" data-id="'+e.id+'" data-write aria-label="Excluir registro">×</button></div></div>'
      +(ef?'<p class="small muted" style="margin-top:6px">Efetivo: '+ef+'</p>':'')
      +'<p style="margin-top:8px;white-space:pre-wrap">'+esc(e.atividades)+'</p>'+(e.obs?'<p class="small muted" style="margin-top:6px;white-space:pre-wrap">'+esc(e.obs)+'</p>':'')+thumbs(e.fotos)
      +'<p class="tiny muted" style="margin-top:8px">Registrado por '+esc(Names.get(e.por))+'</p></article>';
  }).join('')+'</div>';
}

/* ---- ocorrências ---- */
function kcardOc(o){
  var i=OC_ORDER.indexOf(o.status), v=vencidaOc(o), t=TIPOS_OC.filter(function(x){return x.k===o.tipo;})[0];
  var back=i>0&&o.status!=='fechada'?'<button class="btn sm" data-act="oc-mover" data-id="'+o.id+'" data-to="'+OC_ORDER[i-1]+'" data-write>←</button>':'';
  var fwd=o.status==='fechada'?'<button class="btn sm" data-act="oc-mover" data-id="'+o.id+'" data-to="aberta" data-write>Reabrir</button>':'<button class="btn sm primary" data-act="oc-mover" data-id="'+o.id+'" data-to="'+OC_ORDER[i+1]+'" data-write>'+(o.status==='aberta'?'Iniciar correção':(o.status==='em_correcao'?'Enviar p/ reinspeção':'Fechar'))+' →</button>';
  var d=(o.descricao||''); if(d.length>110) d=d.slice(0,107)+'…';
  return '<div class="kcard '+(o.gravidade==='critica'?'crit':(o.gravidade==='importante'?'importante':''))+'"><button type="button" class="linkbtn" data-act="oc-abrir" data-id="'+o.id+'">'+esc(d)+'</button><div class="m"><span class="chip '+(o.gravidade==='critica'?'crit':(o.gravidade==='importante'?'warn':''))+'">'+GRAV[o.gravidade]+'</span>'+(o.ambiente?'<span class="chip steel">Pré-entrega: '+esc(o.ambiente)+'</span>':'')+(o.etapa?'<span class="chip">Etapa '+o.etapa+'</span>':'')+(o.prestadorId?'<span class="chip">'+esc(prestNome(o.prestadorId))+'</span>':'')+(o.prazo?'<span class="chip '+(v?'crit':'')+'">'+(v?'Venceu ':'Prazo ')+fmtC(o.prazo)+'</span>':'')+(o.status!=='fechada'?'<span class="chip">'+plural(idadeOc(o),'dia','dias')+'</span>':'')+'</div><div class="mv">'+back+fwd+'</div></div>';
}
function tOcorr(o){
  var f=ui.ocFiltro, all=byObra('ocorrencias',o.id);
  var lista=all.filter(function(x){ return f==='criticas'?x.gravidade==='critica':(f==='vencidas'?vencidaOc(x):true); });
  var order={critica:0,importante:1,simples:2};
  lista.sort(function(a,b){ return (order[a.gravidade]-order[b.gravidade]) || ((a.prazo||'9')<(b.prazo||'9')?-1:1); });
  var head='<div class="sec-h"><div><h2>Ocorrências e apontamentos</h2><p class="muted small">Cada ocorrência tem prazo, responsável e histórico de contatos. Só fecha com evidência de reinspeção.</p></div><button class="btn primary" data-act="oc-nova" data-oid="'+o.id+'" data-write>+ Ocorrência</button></div>';
  var chips='<div class="row" style="margin:12px 0">'+[['todas','Todas'],['criticas','Críticas'],['vencidas','Vencidas']].map(function(c){ return '<button class="btn sm'+(f===c[0]?' primary':'')+'" data-act="oc-filtro" data-f="'+c[0]+'">'+c[1]+'</button>'; }).join('')+'</div>';
  var cols=OC_ORDER.map(function(st){
    var cs=lista.filter(function(x){return x.status===st;});
    return '<section class="col"><header>'+OC_STATUS[st]+' <span class="n num">'+cs.length+'</span></header><div class="cards">'+(cs.length?cs.map(kcardOc).join(''):'<p class="muted small" style="padding:8px 4px">Nenhuma</p>')+'</div></section>';
  }).join('');
  return head+chips+(all.length?'<div class="board">'+cols+'</div>':'<div class="card empty"><h3>Nenhuma ocorrência registrada</h3><p>Registre apontamentos da engenharia, pedidos do cliente, reclamações de vizinhos, exigências de órgãos, imprevistos e falhas de projeto ou fornecedor.</p></div>');
}

/* ---- etapa ---- */
function vEtapa(r){
  var o=G('obras',r.oid), info=etapaInfo(r.n); if(!o||!info) return notFound();
  var oid=o.id, e=etapaDoc(oid,r.n), fase=faseDe(r.n), res=fichasResumo(oid,r.n), ini=podeIniciar(oid,r.n), lib=podeLiberar(oid,r.n);
  var prev=r.n>1?'<a class="btn sm" href="#/obra/'+oid+'/etapa/'+(r.n-1)+'">← Etapa '+(r.n-1)+'</a>':'', next=r.n<22?'<a class="btn sm" href="#/obra/'+oid+'/etapa/'+(r.n+1)+'">Etapa '+(r.n+1)+' →</a>':'';
  var acoes='';
  if(e.status==='nao_iniciada') acoes='<button class="btn primary" data-act="etapa-mover" data-oid="'+oid+'" data-n="'+r.n+'" data-to="em_execucao" data-write>Iniciar etapa</button>';
  else if(e.status==='em_execucao') acoes='<button class="btn primary" data-act="etapa-mover" data-oid="'+oid+'" data-n="'+r.n+'" data-to="aguardando_vistoria" data-write>Enviar para vistoria</button>';
  else if(e.status==='aguardando_vistoria') acoes='<button class="btn primary" data-act="etapa-mover" data-oid="'+oid+'" data-n="'+r.n+'" data-to="liberada" data-write>Liberar etapa</button><button class="btn" data-act="etapa-mover" data-oid="'+oid+'" data-n="'+r.n+'" data-to="em_execucao" data-write>Voltar para execução</button>';
  else acoes='<button class="btn" data-act="etapa-mover" data-oid="'+oid+'" data-n="'+r.n+'" data-to="aguardando_vistoria" data-write>Reabrir vistoria</button>';
  var aviso='';
  if(e.status==='nao_iniciada' && !ini.ok) aviso='<div class="callout" style="margin-top:14px"><strong>Pré-requisito do protocolo</strong><ul>'+ini.motivos.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul><p class="small" style="margin-top:6px">Iniciar antes exige registrar uma justificativa.</p></div>';
  else if((e.status==='em_execucao'||e.status==='aguardando_vistoria') && !lib.ok) aviso='<div class="callout" style="margin-top:14px"><strong>Para liberar esta etapa ainda falta</strong><ul>'+lib.motivos.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul></div>';
  else if(e.status!=='liberada' && lib.ok) aviso='<div class="callout ok" style="margin-top:14px"><strong>Tudo pronto para liberar.</strong> Fichas aprovadas, sem ocorrência crítica e condições confirmadas.</div>';
  var fichas=info.verif.map(function(v,i){
    var f=fichaDoc(oid,r.n,i), rs=f?f.resultado:null, k=rs==='aprovado'||rs==='na'?'ok':(rs==='reprovado'?'crit':(rs==='reinspecao'?'warn':''));
    return '<div class="ficha"><div><strong>'+esc(v.item)+'</strong><div class="cri">'+esc(v.criterio)+'</div><div class="err">Erro comum: '+esc(v.erro)+' · Evidência: '+esc(v.evidencia)+'</div>'+(f&&f.obs?'<div class="small" style="margin-top:4px">“'+esc(f.obs)+'”</div>':'')+thumbs(f&&f.fotos)+(f&&f.hist&&f.hist.length?'<div class="tiny muted" style="margin-top:4px">'+plural(f.hist.length,'inspeção','inspeções')+' · última em '+fmt(f.hist[f.hist.length-1].data)+' por '+esc(Names.get(f.hist[f.hist.length-1].por))+'</div>':'')+'</div>'
      +'<div style="text-align:right"><span class="chip '+k+'">'+(rs?RESULT[rs]:'Sem inspeção')+'</span><div style="margin-top:8px"><button class="btn sm" data-act="ficha" data-oid="'+oid+'" data-n="'+r.n+'" data-i="'+i+'" data-write>'+(rs?'Nova inspeção':'Inspecionar')+'</button></div></div></div>';
  }).join('');
  var lc=info.liberacao.charAt(0).toUpperCase()+info.liberacao.slice(1);
  var ocs=byObra('ocorrencias',oid).filter(function(x){return x.etapa===r.n;}).sort(function(a,b){return ocAberta(a)===ocAberta(b)?0:(ocAberta(a)?-1:1);});
  var ocHtml=ocs.length?ocs.map(function(x){ return '<div class="ficha" style="grid-template-columns:1fr auto"><div><button type="button" class="linkbtn" data-act="oc-abrir" data-id="'+x.id+'">'+esc(x.descricao.length>140?x.descricao.slice(0,137)+'…':x.descricao)+'</button><div class="tiny muted">'+esc(GRAV[x.gravidade])+' · '+esc(OC_STATUS[x.status])+(x.prazo?' · prazo '+fmtC(x.prazo):'')+'</div></div><span class="chip '+(x.gravidade==='critica'&&ocAberta(x)?'crit':'')+'">'+esc(OC_STATUS[x.status])+'</span></div>'; }).join(''):'<p class="muted small" style="padding:14px 16px">Nenhuma ocorrência nesta etapa.</p>';
  var ats=byObra('atividades',oid).filter(function(a){return a.etapa===r.n;}).sort(cmpAt);
  var atHtml=ats.length?ats.map(function(a){ return '<div class="ficha" style="grid-template-columns:1fr auto"><div><button type="button" class="linkbtn" data-act="ativ-editar" data-id="'+a.id+'">'+esc(a.nome)+'</button><div class="tiny muted">'+fmt(a.inicio)+' a '+fmt(a.fim)+(a.prestadorId?' · '+esc(prestNome(a.prestadorId)):'')+'</div></div><span class="chip '+((a.avanco||0)>=100?'ok':(atAtrasada(a)?'crit':''))+'">'+(a.avanco||0)+'%</span></div>'; }).join(''):'<p class="muted small" style="padding:14px 16px">Nenhuma atividade cadastrada para esta etapa.</p>';
  var hist=(e.hist||[]).slice().reverse().map(function(h){ return '<li>'+fmt(h.data)+': '+esc(STATUS[h.de]||'—')+' → <strong>'+esc(STATUS[h.para])+'</strong> por '+esc(Names.get(h.por))+(h.nota?' — '+esc(h.nota):'')+'</li>'; }).join('');
  var itens=info.itens.map(function(i){return '<li>'+esc(i)+'</li>';}).join('');
  return '<div class="wrap"><a class="back" href="#/obra/'+oid+'/etapas">← '+esc(o.nome)+'</a>'
    +'<div class="ob-head"><div class="grow"><p class="small muted">'+esc(fase.nome)+'</p><h1>'+r.n+'. '+esc(info.nome)+'</h1><p class="muted" style="margin-top:6px;max-width:70ch">'+esc(info.objetivo)+'</p></div><div class="row">'+prev+next+'</div></div>'
    +'<div class="row" style="margin-top:16px"><span class="chip '+(e.status==='liberada'?'ok':(e.status==='aguardando_vistoria'?'warn':(e.status==='em_execucao'?'steel':'')))+'">'+STATUS[e.status]+'</span><span class="chip">'+res.aprov+' de '+res.total+' fichas aprovadas</span>'+acoes+'</div>'+aviso
    +'<div class="grid cols2 sec">'
    +'<section class="card"><div class="card-h"><h2>Ficha de verificação</h2></div>'+fichas+'</section>'
    +'<div class="stack"><section class="card"><div class="card-h"><h2>Condições de liberação</h2></div><div class="pad"><p>'+esc(lc)+'</p><label class="row" style="margin-top:12px;gap:8px;cursor:pointer"><input type="checkbox" data-chg="cond" data-oid="'+oid+'" data-n="'+r.n+'"'+(e.condicoesOk?' checked':'')+' style="width:20px;height:20px"> <span>Conferi estas condições em campo</span></label></div></section>'
    +'<section class="card"><div class="card-h"><h2>Ocorrências da etapa</h2><button class="btn sm" data-act="oc-nova" data-oid="'+oid+'" data-n="'+r.n+'" data-write>+ Ocorrência</button></div>'+ocHtml+'</section>'
    +'<section class="card"><div class="card-h"><h2>Atividades da etapa</h2><button class="btn sm" data-act="ativ-nova" data-oid="'+oid+'" data-n="'+r.n+'" data-write>+ Atividade</button></div>'+atHtml+'</section></div></div>'
    +'<details class="card ex sec" data-k="itens'+r.n+'"'+(ui.det['itens'+r.n]?' open':'')+'><summary>O que esta etapa exige (protocolo)</summary><ul>'+itens+'</ul></details>'
    +(hist?'<section class="card sec"><div class="card-h"><h2>Histórico da etapa</h2></div><ul style="margin:0;padding:12px 16px 12px 34px" class="small">'+hist+'</ul></section>':'')
    +'</div>';
}

/* ---- prestadores ---- */
function vPrest(){
  var ps=L('prestadores').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');});
  var head='<div class="row spread"><div><h1>Prestadores</h1><p class="muted small" style="margin-top:4px">Seguro ou treinamento vencido impede lançar o prestador no efetivo do diário.</p></div><button class="btn primary" data-act="prest-novo" data-write>+ Novo prestador</button></div>';
  if(!ps.length) return '<div class="wrap">'+head+'<div class="card empty" style="margin-top:18px"><h3>Nenhum prestador cadastrado</h3><p>Cadastre os prestadores com as validades de seguro e treinamento.</p></div></div>';
  return '<div class="wrap">'+head+'<div class="card tbl-scroll sec" style="margin-top:18px"><table class="tbl"><thead><tr><th>Prestador</th><th>Especialidade</th><th>Seguro</th><th>Treinamento</th><th></th></tr></thead><tbody>'+ps.map(function(p){
    var s=validade(p.seguro), t=validade(p.treinamento);
    return '<tr><td><strong>'+esc(p.nome)+'</strong><div class="tiny muted">'+esc([p.doc,p.contato].filter(Boolean).join(' · '))+'</div></td><td>'+esc(p.especialidade||'—')+'</td><td><span class="chip '+s.k+'">'+esc(s.t)+'</span></td><td><span class="chip '+t.k+'">'+esc(t.t)+'</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="prest-editar" data-id="'+p.id+'" data-write>Editar</button> <button class="btn sm ghost" data-act="prest-excluir" data-id="'+p.id+'" data-write aria-label="Excluir prestador">×</button></td></tr>';
  }).join('')+'</tbody></table></div>'+treinamentosHtml()+'</div>';
}

/* ---- render ---- */
function render(){
  var app=document.getElementById('app'); if(!app) return;
  if(Store.mode==='boot'){ app.innerHTML='<div class="wrap"><p class="muted">Conectando aos dados das obras…</p></div>'; return; }
  var r=parseRoute(), key=location.hash||'#/painel', y=window.scrollY;
  var gs=document.querySelector('.gantt-scroll'); if(gs) ui.ganttScroll=gs.scrollLeft;
  if(Store.mode==='login'){ app.innerHTML=vLogin(); lastKey=null; return; }
  if(r.view==='nuvem'||r.view==='historico'){
    document.body.classList.toggle('ro', !Store.writable);
    app.innerHTML=topbar(r)+banners()+(r.view==='nuvem'?vNuvem():vHistorico());
    if(key!==lastKey) window.scrollTo(0,0); lastKey=key; return;
  }
  var body=r.view==='obra'?vObra(r):(r.view==='etapa'?vEtapa(r):(r.view==='prestadores'?vPrest():(r.view==='agenda'?vAgenda():(r.view==='fornecedores'?vForn():(r.view==='dre'?vDRE():vPainel())))));
  document.body.classList.toggle('ro', !Store.writable);
  app.innerHTML=topbar(r)+banners()+body;
  if(key===lastKey){ window.scrollTo(0,y); var g2=document.querySelector('.gantt-scroll'); if(g2) g2.scrollLeft=ui.ganttScroll; } else { window.scrollTo(0,0); ui.ganttScroll=0; }
  lastKey=key;
}
window.__render=render;

/* ================= AÇÕES ================= */
function selOpts(list, blank){ return (blank?[['',blank]]:[]).concat(list); }
function prestOptions(blank){
  return selOpts(L('prestadores').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');}).map(function(p){ return [p.id, p.nome+(prestBloqueado(p)?' — seguro ou treinamento vencido':''), prestBloqueado(p)]; }), blank);
}
function etapaOptions(blank){ return selOpts(ETAPAS.map(function(e){ return [String(e.n), e.n+'. '+e.nome]; }), blank); }

function obraForm(o){
  var novo=!o; ensureEmpresas();
  openForm({
    title:novo?'Nova obra':'Editar obra', submit:novo?'Cadastrar obra':'Salvar',
    fields:[
      {name:'nome',label:'Nome da obra',required:true,value:o&&o.nome,ph:'Ex.: Casa Silva'},
      [{name:'codigo',label:'Código',value:o&&o.codigo,ph:'CA000000'},{name:'cliente',label:'Cliente',value:o&&o.cliente}],
      {name:'endereco',label:'Endereço da obra',value:o&&o.endereco},
      [{name:'tipologia',label:'Tipologia',type:'select',options:TIPOLOGIAS.map(function(t){return [t,t];}),value:(o&&o.tipologia)||TIPOLOGIAS[0]},{name:'modalidade',label:'Modalidade do contrato',type:'select',options:MODALIDADES.map(function(t){return [t,t];}),value:(o&&o.modalidade)||MODALIDADES[0]}],
      [{name:'area',label:'Área (m²)',type:'number',step:'0.01',min:0,value:o&&o.area},{name:'inicio',label:'Início da obra',type:'date',value:o&&o.inicio}],
      [{name:'metaPPC',label:'Meta de PPC (%)',type:'number',min:0,max:100,value:o&&o.metaPPC!=null?o.metaPPC:80,hint:'Valor provisório, a definir pela Cariati.'},{name:'diasEscalar',label:'Dias de atraso para escalar',type:'number',min:1,value:o&&o.diasEscalar!=null?o.diasEscalar:7,hint:'Apontamento vencido há mais dias vai à diretoria.'}],
      [{name:'alcada',label:'Alçada de compra e locação (R$)',type:'number',min:0,step:'0.01',value:o&&o.alcada,hint:'Acima disso, a compra exige aprovação do cliente. A definir pela Cariati.'},{name:'margemPreco',label:'Margem aceita sobre o orçado (%)',type:'number',min:0,step:'0.1',value:o&&o.margemPreco!=null?o.margemPreco:5,hint:'Valor provisório.'}],
      {name:'empresaId',label:'Empresa do grupo (para o DRE)',type:'select',options:selOpts(empresasAtivas().map(function(e){ return [e.id,e.nome]; }),'Sem empresa'),value:o&&o.empresaId,hint:'Cadastre ou edite as empresas na página DRE.'},
      [{name:'tolerAvanco',label:'Tolerância entre avanço e medição (pontos %)',type:'number',min:0,step:'0.1',value:o&&o.tolerAvanco!=null?o.tolerAvanco:5,hint:'Valor provisório, a definir pela Cariati.'},{name:'abcA',label:'Curva ABC: classe A até (%)',type:'number',min:1,max:100,step:'1',value:o&&o.abcA!=null?o.abcA:80,hint:'Valor provisório.'},{name:'abcB',label:'Curva ABC: classe B até (%)',type:'number',min:1,max:100,step:'1',value:o&&o.abcB!=null?o.abcB:95,hint:'Valor provisório.'}]
    ],
    extra:novo?'':'<button type="button" class="btn danger" data-act="obra-excluir" data-oid="'+o.id+'" style="margin-right:auto">Excluir obra</button>',
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o nome da obra.';
      var data=Object.assign({}, o||{}, {nome:v.nome.trim(), codigo:v.codigo||'', cliente:v.cliente||'', endereco:v.endereco||'', tipologia:v.tipologia, modalidade:v.modalidade, area:v.area, inicio:v.inicio||'', metaPPC:v.metaPPC==null?80:v.metaPPC, diasEscalar:v.diasEscalar==null?7:v.diasEscalar, alcada:v.alcada, margemPreco:v.margemPreco==null?5:v.margemPreco, empresaId:v.empresaId||'', tolerAvanco:v.tolerAvanco==null?5:v.tolerAvanco, abcA:v.abcA==null?80:v.abcA, abcB:v.abcB==null?95:v.abcB});
      if(novo) data.criadoEm=new Date().toISOString();
      var id=novo?nid():o.id; await Store.set('obras', id, data);
      if(novo) location.hash='#/obra/'+id+'/resumo';
    }
  });
}
async function excluirObra(oid){
  var o=G('obras',oid); if(!o) return;
  var ok=await confirmDlg('Excluir a obra “'+o.nome+'”?','<p>Isso apaga a obra e todos os registros dela: etapas, fichas, cronograma, pacotes, diário e ocorrências. Não dá para desfazer.</p>','Excluir obra',true);
  if(!ok) return;
  var tasks=[];
  ['etapas','atividades','pacotes','diarios','fichas','ocorrencias','eventos','atas','acoes','docsLegais','docsPrest','rfis','materiais','locs','servicos','compras','movEstoque','locacoes','contratosPrest','termos','danos','orcamentos','orcItens','aditivos','medicoes','contasPagar','aportes'].forEach(function(c){ byObra(c,oid).forEach(function(x){ tasks.push(Store.del(c,x.id)); }); });
  tasks.push(Store.del('obras',oid));
  await Promise.all(tasks); location.hash='#/painel'; toast('Obra excluída.');
}

async function moverEtapa(oid,n,to){
  var e=etapaDoc(oid,n), extra={nota:''};
  if(e.status===to) return;
  if(to==='em_execucao' && e.status==='nao_iniciada'){
    var ini=podeIniciar(oid,n);
    if(!ini.ok){
      var ok=await new Promise(function(res){
        openForm({title:'Iniciar antes da liberação da etapa anterior?', intro:'O protocolo só permite iniciar com a etapa anterior liberada em vistoria. Para seguir mesmo assim, registre a justificativa.',
          fields:[{name:'j',label:'Justificativa',type:'textarea',required:true}], submit:'Iniciar com exceção',
          onSubmit:async function(v){ if(!(v.j||'').trim()) return 'Escreva a justificativa.'; extra.nota='Exceção: '+v.j.trim(); res(true); }});
        dlgEl().addEventListener('close',function(){ res(false); },{once:true});
      });
      if(!ok) return;
    }
  }
  if(to==='liberada'){
    var lib=podeLiberar(oid,n);
    if(!lib.ok){ blockDlg('Não é possível liberar a etapa '+n, lib.motivos, 'A etapa só é liberada quando:'); return; }
  }
  if(e.status==='liberada'){
    var seguintes=ETAPAS.filter(function(x){ return x.n>n && etapaDoc(oid,x.n).status!=='nao_iniciada'; });
    var c=await confirmDlg('Reabrir a etapa '+n+'?','<p>A liberação será desfeita e a etapa volta para vistoria.'+(seguintes.length?' Há '+plural(seguintes.length,'etapa seguinte já iniciada','etapas seguintes já iniciadas')+'.':'')+'</p>','Reabrir',false);
    if(!c) return;
  }
  var hist=(e.hist||[]).concat([{de:e.status, para:to, data:new Date().toISOString(), por:Store.uid||null, nota:extra.nota}]).slice(-30);
  var upd=Object.assign({}, e, {status:to, hist:hist});
  if(to==='liberada') upd.liberadaEm=hoje();
  if(to!=='liberada') delete upd.liberadaEm;
  await Store.set('etapas', e.id, upd);
  toast('Etapa '+n+': '+STATUS[to].toLowerCase()+'.');
}

function fichaForm(oid,n,i){
  var info=etapaInfo(n), v=info.verif[i], cur=fichaDoc(oid,n,i);
  openForm({
    title:'Inspeção: '+v.item, wide:false,
    intro:'<strong>Critério:</strong> '+esc(v.criterio)+'<br><strong>Erro comum:</strong> '+esc(v.erro)+'<br><strong>Evidência esperada:</strong> '+esc(v.evidencia),
    fields:[
      {name:'resultado',label:'Resultado',type:'radio',required:true,options:[['aprovado','Aprovado'],['reprovado','Reprovado'],['reinspecao','Aguardando reinspeção'],['na','Não se aplica']],value:''},
      {name:'obs',label:'Observação',type:'textarea',hint:'Obrigatória quando não se aplica.'},
      {name:'fotos',label:'Fotos (evidência)',type:'photos',value:[]},
      {name:'abrirOc',label:'Se reprovado, abrir apontamento automaticamente',type:'radio',options:[['sim','Sim'],['nao','Não']],value:'sim'}
    ],
    submit:'Registrar inspeção',
    onSubmit:async function(x){
      if(!x.resultado) return 'Escolha o resultado da inspeção.';
      if(x.resultado==='na' && !(x.obs||'').trim()) return 'Explique por que a ficha não se aplica.';
      var hist=((cur&&cur.hist)||[]).concat([{data:new Date().toISOString(), resultado:x.resultado, obs:x.obs||'', por:Store.uid||null}]).slice(-20);
      var primeira=cur?cur.primeira:(x.resultado==='aprovado'?'ok':(x.resultado==='na'?'na':'nok'));
      await Store.set('fichas', oid+'_'+n+'_'+i, {obraId:oid, etapa:n, idx:i, item:v.item, resultado:x.resultado, primeira:primeira, obs:x.obs||'', fotos:x.fotos||[], hist:hist});
      if(x.resultado==='reprovado' && x.abrirOc==='sim'){
        await Store.add('ocorrencias', {obraId:oid, etapa:n, tipo:'apontamento', gravidade:'importante', local:'', descricao:v.item+': '+((x.obs||'').trim()||'reprovado na ficha de verificação.'), prestadorId:'', prazo:addDays(hoje(),7), status:'aberta', criadoEm:new Date().toISOString(), por:Store.uid||null, interacoes:[], fotos:x.fotos||[], origem:'ficha', reabertas:0});
        toast('Apontamento aberto automaticamente, com prazo de 7 dias.');
      }
    }
  });
}

function atividadeForm(oid, a, etapaPre){
  var novo=!a, tem=!!(G('obras',oid)||{}).baseData;
  var outras=byObra('atividades',oid).filter(function(x){ return !a||x.id!==a.id; }).sort(cmpAt);
  var fields=[
    {name:'nome',label:'Atividade',required:true,value:a&&a.nome,ph:'Ex.: Armação das sapatas'},
    [{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('Geral (sem etapa)'),value:a?String(a.etapa||''):(etapaPre?String(etapaPre):'')},{name:'prestadorId',label:'Prestador',type:'select',options:prestOptions('Sem prestador'),value:a&&a.prestadorId}],
    [{name:'inicio',label:'Início',type:'date',required:true,value:a&&a.inicio},{name:'fim',label:'Fim',type:'date',required:true,value:a&&a.fim}],
    [{name:'pred',label:'Predecessora',type:'select',options:selOpts(outras.map(function(x){return [x.id,x.nome];}),'Nenhuma'),value:a&&a.pred},{name:'avanco',label:'Avanço (%)',type:'number',min:0,max:100,step:1,value:a?(a.avanco||0):0}]
  ];
  if(tem) fields.push({name:'motivo',label:'Motivo do replanejamento',type:'textarea',hint:'Obrigatório se você mudar o início ou o fim. A linha de base anterior é preservada.',value:''});
  openForm({
    title:novo?'Nova atividade':'Editar atividade', fields:fields,
    extra:novo?'':'<button type="button" class="btn danger" data-act="ativ-excluir" data-id="'+a.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o nome da atividade.';
      if(!v.inicio||!v.fim) return 'Informe início e fim.';
      if(v.fim<v.inicio) return 'O fim não pode ser antes do início.';
      var av=Math.max(0,Math.min(100,v.avanco==null?0:v.avanco));
      var data=Object.assign({}, a||{}, {obraId:oid, nome:v.nome.trim(), etapa:v.etapa?Number(v.etapa):0, prestadorId:v.prestadorId||'', inicio:v.inicio, fim:v.fim, pred:v.pred||'', avanco:av});
      if(a && tem && (a.inicio!==v.inicio||a.fim!==v.fim)){
        if(!(v.motivo||'').trim()) return 'Informe o motivo do replanejamento.';
        data.hist=(a.hist||[]).concat([{data:new Date().toISOString(), de:[a.inicio,a.fim], para:[v.inicio,v.fim], motivo:v.motivo.trim(), por:Store.uid||null}]).slice(-20);
      }
      await Store.set('atividades', a?a.id:nid(), data);
    }
  });
}
async function congelarBase(oid){
  var o=G('obras',oid), ats=byObra('atividades',oid); if(!o||!ats.length) return;
  var ver=(o.baseVersao||0)+1;
  var aplicar=async function(motivo){
    await Promise.all(ats.map(function(a){ return Store.set('atividades', a.id, Object.assign({}, a, {base:{inicio:a.inicio,fim:a.fim}})); }));
    await Store.patch('obras', oid, {baseVersao:ver, baseData:hoje(), baseMotivo:motivo});
    toast('Linha de base v'+ver+' congelada.');
  };
  if(o.baseData){
    openForm({title:'Nova linha de base', intro:'A linha de base atual (v'+o.baseVersao+') será substituída pelas datas de hoje. Registre o motivo.', fields:[{name:'motivo',label:'Motivo do replanejamento',type:'textarea',required:true}], submit:'Congelar v'+ver, onSubmit:async function(v){ if(!(v.motivo||'').trim()) return 'Informe o motivo.'; await aplicar(v.motivo.trim()); }});
  } else {
    var ok=await confirmDlg('Congelar a linha de base?','<p>As datas atuais de '+plural(ats.length,'atividade','atividades')+' passam a ser a referência. Depois disso, mudar datas exige registrar o motivo.</p>','Congelar',false);
    if(ok) await aplicar('Linha de base inicial');
  }
}

function pacoteForm(oid, p){
  var novo=!p;
  openForm({
    title:novo?'Novo pacote de trabalho':'Editar pacote', intro:novo?'Semana de '+fmtC(ui.semana[oid]||segunda(hoje()))+'. Descreva o que será concluído 100% até o fim da semana.':'',
    fields:[{name:'descricao',label:'Pacote',type:'textarea',required:true,rows:2,value:p&&p.descricao,ph:'Ex.: Concretar as sapatas S1 a S8'},
      [{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('—'),value:p&&p.etapa?String(p.etapa):''},{name:'prestadorId',label:'Prestador',type:'select',options:prestOptions('—'),value:p&&p.prestadorId}]],
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva o pacote.';
      var data=Object.assign({}, p||{semana:ui.semana[oid]||segunda(hoje()), concluido:null, causa:''}, {obraId:oid, descricao:v.descricao.trim(), etapa:v.etapa?Number(v.etapa):0, prestadorId:v.prestadorId||''});
      await Store.set('pacotes', p?p.id:nid(), data);
    }
  });
}
function pacoteNao(p){
  openForm({title:'Pacote não concluído', intro:esc(p.descricao),
    fields:[{name:'causa',label:'Causa do não cumprimento',type:'select',required:true,options:selOpts(Object.keys(CAUSAS).map(function(k){return [k,CAUSAS[k]];}),'Selecione…'),value:p.causa||''},{name:'obs',label:'Observação',type:'textarea',rows:2,value:p.obs}],
    submit:'Registrar',
    onSubmit:async function(v){ if(!v.causa) return 'Escolha a causa: ela alimenta a análise do PPC.'; await Store.patch('pacotes', p.id, {concluido:false, causa:v.causa, obs:v.obs||''}); }});
}
async function levarPendentes(oid){
  var sem=ui.semana[oid]||segunda(hoje()), prox=addDays(sem,7);
  var pend=semanaInfo(oid,sem).ps.filter(function(p){ return p.concluido!==true; });
  var jaTem=semanaInfo(oid,prox).ps.map(function(p){ return p.descricao; });
  var novos=pend.filter(function(p){ return jaTem.indexOf(p.descricao)<0; });
  await Promise.all(novos.map(function(p){ return Store.add('pacotes', {obraId:oid, semana:prox, descricao:p.descricao, etapa:p.etapa||0, prestadorId:p.prestadorId||'', concluido:null, causa:''}); }));
  toast(novos.length?plural(novos.length,'pacote levado','pacotes levados')+' para a semana de '+fmtC(prox)+'.':'Os pendentes já estão na próxima semana.');
}

function diarioForm(oid, e){
  var novo=!e;
  openForm({
    title:novo?'Registro do dia':'Editar registro', wide:true,
    fields:[
      [{name:'data',label:'Data',type:'date',required:true,value:e?e.data:hoje()},{name:'clima',label:'Clima',type:'select',options:selOpts(CLIMA.map(function(c){return [c,c];}),'—'),value:e&&e.clima}],
      {name:'efetivo',label:'Efetivo do dia',type:'efetivo',options:prestOptions('Selecione o prestador…'),value:e&&e.efetivo,hint:'Prestador com seguro ou treinamento vencido não pode ser lançado.'},
      {name:'atividades',label:'O que foi executado',type:'textarea',required:true,rows:4,value:e&&e.atividades,ph:'Serviços do dia, por frente. No celular, use o ditado do teclado.'},
      {name:'obs',label:'Observações',type:'textarea',rows:2,value:e&&e.obs},
      {name:'fotos',label:'Fotos datadas dos serviços (antes de cobrir)',type:'photos',value:(e&&e.fotos)||[]}
    ],
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      if(!(v.atividades||'').trim()) return 'Descreva o que foi executado.';
      var data=Object.assign({}, e||{}, {obraId:oid, data:v.data, clima:v.clima||'', efetivo:v.efetivo||[], atividades:v.atividades.trim(), obs:v.obs||'', fotos:v.fotos||[], por:(e&&e.por)||Store.uid||null});
      await Store.set('diarios', e?e.id:nid(), data);
    }
  });
}

function ocForm(oid, o, etapaPre){
  var novo=!o;
  openForm({
    title:novo?'Nova ocorrência':'Editar ocorrência', wide:true,
    fields:[
      {name:'descricao',label:'Descrição',type:'textarea',required:true,value:o&&o.descricao,ph:'O que aconteceu, onde e qual o impacto.'},
      [{name:'tipo',label:'Tipo',type:'select',options:TIPOS_OC.map(function(t){return [t.k,t.n];}),value:(o&&o.tipo)||'apontamento',hint:'Solicitação do cliente e imprevisto de campo costumam gerar aditivo.'},{name:'gravidade',label:'Gravidade',type:'radio',required:true,options:Object.keys(GRAV).map(function(k){return [k,GRAV[k]];}),value:(o&&o.gravidade)||'importante'}],
      [{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('Geral (sem etapa)'),value:o?String(o.etapa||''):(etapaPre?String(etapaPre):'')},{name:'local',label:'Local',value:o&&o.local,ph:'Ex.: suíte 2'}],
      [{name:'prestadorId',label:'Responsável pela correção',type:'select',options:prestOptions('A definir'),value:o&&o.prestadorId},{name:'prazo',label:'Prazo de correção',type:'date',required:true,value:o?o.prazo:addDays(hoje(),7)}],
      {name:'fotos',label:'Fotos',type:'photos',value:(o&&o.fotos)||[]}
    ],
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva a ocorrência.';
      if(!v.gravidade) return 'Escolha a gravidade.';
      var data=Object.assign({status:'aberta', interacoes:[], reabertas:0, criadoEm:new Date().toISOString(), por:Store.uid||null}, o||{}, {obraId:oid, descricao:v.descricao.trim(), tipo:v.tipo, gravidade:v.gravidade, etapa:v.etapa?Number(v.etapa):0, local:v.local||'', prestadorId:v.prestadorId||'', prazo:v.prazo, fotos:v.fotos||[]});
      await Store.set('ocorrencias', o?o.id:nid(), data);
    }
  });
}
function openOc(id){
  var o=G('ocorrencias',id); if(!o){ closeDlg(); return; }
  var t=TIPOS_OC.filter(function(x){return x.k===o.tipo;})[0]||TIPOS_OC[0], v=vencidaOc(o);
  var ints=(o.interacoes||[]).slice().reverse().map(function(i){ return '<li style="margin-bottom:8px"><strong>'+fmt(i.data)+'</strong> · '+esc(i.canal)+(i.com?' com '+esc(i.com):'')+'<div>'+esc(i.texto)+'</div>'+(i.novoPrazo?'<div class="tiny muted">Novo prazo combinado: '+fmt(i.novoPrazo)+'</div>':'')+'<div class="tiny muted">Registrado por '+esc(Names.get(i.por))+'</div></li>'; }).join('');
  var i=OC_ORDER.indexOf(o.status), acoes='';
  if(o.status==='fechada') acoes='<button class="btn" data-act="oc-mover" data-id="'+o.id+'" data-to="aberta" data-write>Reabrir</button>';
  else { if(i>0) acoes+='<button class="btn" data-act="oc-mover" data-id="'+o.id+'" data-to="'+OC_ORDER[i-1]+'" data-write>← '+OC_STATUS[OC_ORDER[i-1]]+'</button>'; acoes+='<button class="btn primary" data-act="oc-mover" data-id="'+o.id+'" data-to="'+OC_ORDER[i+1]+'" data-write>'+OC_STATUS[OC_ORDER[i+1]]+' →</button>'; }
  openDlg('<div class="dlg-h"><h2>Ocorrência</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<div class="row" style="margin-bottom:10px"><span class="chip '+(o.gravidade==='critica'?'crit':(o.gravidade==='importante'?'warn':''))+'">'+GRAV[o.gravidade]+'</span><span class="chip">'+esc(OC_STATUS[o.status])+'</span>'+(o.etapa?'<span class="chip">Etapa '+o.etapa+'</span>':'')+(v?'<span class="chip crit">Venceu há '+plural(atrasoOc(o),'dia','dias')+'</span>':'')+'</div>'
    +'<p style="white-space:pre-wrap">'+esc(o.descricao)+'</p>'+thumbs(o.fotos)
    +'<dl class="small" style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:14px 0"><dt class="muted">Tipo</dt><dd style="margin:0">'+esc(t.n)+'<div class="tiny muted">Aditivo: '+esc(t.adt)+'</div></dd><dt class="muted">Local</dt><dd style="margin:0">'+esc(o.local||'—')+'</dd><dt class="muted">Responsável</dt><dd style="margin:0">'+esc(prestNome(o.prestadorId)||'A definir')+'</dd><dt class="muted">Prazo</dt><dd style="margin:0">'+fmt(o.prazo)+'</dd><dt class="muted">Aberta em</dt><dd style="margin:0">'+fmt(o.criadoEm)+' por '+esc(Names.get(o.por))+'</dd>'+(o.status==='fechada'?'<dt class="muted">Evidência do fechamento</dt><dd style="margin:0">'+esc(o.evidencia||'—')+thumbs(o.fotosFechamento)+'</dd>':'')+'</dl>'
    +'<div class="sec-h" style="margin-top:18px"><h3>Contatos e cobranças</h3><button class="btn sm" data-act="oc-contato" data-id="'+o.id+'" data-write>+ Registrar contato</button></div>'
    +(ints?'<ul style="list-style:none;padding:0;margin:10px 0 0">'+ints+'</ul>':'<p class="muted small" style="margin-top:8px">Nenhum contato registrado. Cobrar o responsável antes do prazo e anotar aqui.</p>')
    +'</div><div class="dlg-f"><button class="btn danger" data-act="oc-excluir" data-id="'+o.id+'" data-write style="margin-right:auto">Excluir</button>'+(o.tipo!=='apontamento'?'<button class="btn" data-act="adt-de-oc" data-id="'+o.id+'" data-write>Gerar aditivo</button>':'')+'<button class="btn" data-act="oc-editar" data-id="'+o.id+'" data-write>Editar</button>'+acoes+'</div>', true);
}
function contatoForm(id,col){
  col=col||'ocorrencias'; var o=G(col,id);
  openForm({title:'Registrar contato', intro:'Fica no histórico da ocorrência e serve de prova para reter medição e avaliar o prestador.',
    fields:[[{name:'data',label:'Data',type:'date',required:true,value:hoje()},{name:'canal',label:'Canal',type:'select',options:CANAIS.map(function(c){return [c,c];}),value:'WhatsApp'}],
      {name:'com',label:'Falou com',value:prestNome(o.prestadorId)||o.responsavel||''},{name:'texto',label:'O que foi dito e combinado',type:'textarea',required:true},{name:'novoPrazo',label:'Novo prazo combinado (opcional)',type:'date'}],
    onSubmit:async function(v){
      if(!(v.texto||'').trim()) return 'Descreva o que foi combinado.';
      var ints=(o.interacoes||[]).concat([{data:v.data, canal:v.canal, com:v.com||'', texto:v.texto.trim(), novoPrazo:v.novoPrazo||'', por:Store.uid||null}]).slice(-50);
      var upd=Object.assign({}, o, {interacoes:ints}); if(v.novoPrazo) upd.prazo=v.novoPrazo;
      await Store.set(col, id, upd); if(col==='ocorrencias'){ setTimeout(function(){ openOc(id); },50); return false; } toast('Contato registrado.');
    }});
}
async function moverOc(id,to){
  var o=G('ocorrencias',id); if(!o||o.status===to) return;
  if(to==='fechada'){
    openForm({title:'Fechar ocorrência', intro:'A ocorrência só fecha com evidência da reinspeção.',
      fields:[{name:'evidencia',label:'Evidência da reinspeção',type:'textarea',required:true,ph:'Ex.: reinspecionado em 12/03, prumo conferido, dentro da tolerância.'},{name:'fotos',label:'Fotos da correção',type:'photos',value:[]}],
      submit:'Fechar ocorrência',
      onSubmit:async function(v){ if(!(v.evidencia||'').trim()) return 'Registre a evidência da reinspeção.'; await Store.set('ocorrencias', id, Object.assign({}, o, {status:'fechada', fechadaEm:new Date().toISOString(), evidencia:v.evidencia.trim(), fotosFechamento:v.fotos||[]})); toast('Ocorrência fechada.'); }});
    return;
  }
  var upd=Object.assign({}, o, {status:to});
  if(o.status==='fechada'){ upd.reabertas=(o.reabertas||0)+1; delete upd.fechadaEm; }
  await Store.set('ocorrencias', id, upd);
  if(dlgEl().open && dlgEl().querySelector('[data-act="oc-contato"]')) openOc(id);
}

function prestForm(p){
  var novo=!p;
  openForm({title:novo?'Novo prestador':'Editar prestador',
    fields:[{name:'nome',label:'Nome ou razão social',required:true,value:p&&p.nome},
      [{name:'especialidade',label:'Especialidade',value:p&&p.especialidade,ph:'Ex.: Pedreiro, elétrica'},{name:'doc',label:'CPF ou CNPJ',value:p&&p.doc}],
      {name:'contato',label:'Contato',value:p&&p.contato,ph:'Telefone ou WhatsApp'},
      [{name:'seguro',label:'Validade do seguro de responsabilidade civil',type:'date',value:p&&p.seguro},{name:'treinamento',label:'Validade do treinamento de segurança',type:'date',value:p&&p.treinamento}]],
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o nome do prestador.';
      await Store.set('prestadores', p?p.id:nid(), Object.assign({}, p||{}, {nome:v.nome.trim(), especialidade:v.especialidade||'', doc:v.doc||'', contato:v.contato||'', seguro:v.seguro||'', treinamento:v.treinamento||''}));
    }});
}

async function exportar(){
  var dl=null; try{ dl=window.claude && await window.claude.use('downloads'); }catch(e){}
  var data={exportadoEm:new Date().toISOString(), colecoes:{}}; COLS.forEach(function(c){ data.colecoes[c]=L(c); });
  if(!dl){
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download='cariati-obras-'+hoje()+'.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000); toast('Cópia dos dados exportada.'); return;
  }
  try{ await dl.save({filename:'cariati-obras-'+hoje()+'.json', data:JSON.stringify(data,null,2)}); toast('Cópia dos dados exportada.'); }
  catch(e){ if(!e||e.code!=='declined') toast('Não foi possível exportar.', true); }
}
function applyTheme(){ try{ var t=localStorage.getItem('cob.tema'); if(t) document.documentElement.setAttribute('data-theme',t); }catch(e){} }
function toggleTheme(){
  var cur=document.documentElement.getAttribute('data-theme');
  if(!cur) cur=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  var nx=cur==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',nx);
  try{ localStorage.setItem('cob.tema',nx); }catch(e){}
}

var A={
  'obra-nova':function(){ obraForm(); },
  'obra-editar':function(d){ obraForm(G('obras',d.oid)); },
  'obra-excluir':function(d){ closeDlg(); excluirObra(d.oid); },
  'etapa-mover':function(d){ moverEtapa(d.oid, Number(d.n), d.to); },
  'ficha':function(d){ fichaForm(d.oid, Number(d.n), Number(d.i)); },
  'ativ-nova':function(d){ atividadeForm(d.oid, null, d.n?Number(d.n):0); },
  'ativ-editar':function(d){ atividadeForm(G('atividades',d.id).obraId, G('atividades',d.id)); },
  'ativ-excluir':async function(d){ var a=G('atividades',d.id); var ok=await confirmDlg('Excluir atividade?','<p>“'+esc(a.nome)+'” será removida do cronograma.</p>','Excluir',true); if(ok){ await Store.del('atividades',d.id); toast('Atividade excluída.'); } },
  'base-congelar':function(d){ congelarBase(d.oid); },
  'sem-nav':function(d){ var cur=ui.semana[d.oid]||segunda(hoje()); ui.semana[d.oid]=Number(d.d)===0?segunda(hoje()):addDays(cur,Number(d.d)); render(); },
  'pac-novo':function(d){ pacoteForm(d.oid); },
  'pac-editar':function(d){ var p=G('pacotes',d.id); pacoteForm(p.obraId,p); },
  'pac-ok':function(d){ Store.patch('pacotes', d.id, {concluido:true, causa:'', obs:''}); },
  'pac-nao':function(d){ pacoteNao(G('pacotes',d.id)); },
  'pac-excluir':async function(d){ var ok=await confirmDlg('Excluir pacote?','<p>O pacote sai do cálculo do PPC desta semana.</p>','Excluir',true); if(ok) Store.del('pacotes',d.id); },
  'pac-levar':function(d){ levarPendentes(d.oid); },
  'dia-novo':function(d){ diarioForm(d.oid); },
  'dia-editar':function(d){ var e=G('diarios',d.id); diarioForm(e.obraId,e); },
  'dia-excluir':async function(d){ var ok=await confirmDlg('Excluir registro do dia?','<p>Fotos e texto deste dia serão removidos do diário.</p>','Excluir',true); if(ok) Store.del('diarios',d.id); },
  'oc-nova':function(d){ ocForm(d.oid, null, d.n?Number(d.n):0); },
  'oc-abrir':function(d){ openOc(d.id); },
  'oc-editar':function(d){ var o=G('ocorrencias',d.id); ocForm(o.obraId,o); },
  'oc-mover':function(d){ moverOc(d.id, d.to); },
  'oc-contato':function(d){ contatoForm(d.id); },
  'oc-excluir':async function(d){ var ok=await confirmDlg('Excluir ocorrência?','<p>O histórico de contatos também será apagado. Prefira fechar a ocorrência, se ela foi resolvida.</p>','Excluir',true); if(ok){ await Store.del('ocorrencias',d.id); closeDlg(); } },
  'oc-filtro':function(d){ ui.ocFiltro=d.f; render(); },
  'prest-novo':function(){ prestForm(); },
  'prest-editar':function(d){ prestForm(G('prestadores',d.id)); },
  'prest-excluir':async function(d){
    var p=G('prestadores',d.id), usos=L('atividades').filter(function(a){return a.prestadorId===d.id;}).length+L('ocorrencias').filter(function(a){return a.prestadorId===d.id;}).length;
    var ok=await confirmDlg('Excluir prestador?','<p>“'+esc(p.nome)+'” será removido.'+(usos?' Ele aparece em '+plural(usos,'registro','registros')+', que ficarão sem responsável.':'')+'</p>','Excluir',true);
    if(ok) Store.del('prestadores',d.id);
  },
  'foto':function(d){ lightbox(d.id); },
  'exportar':function(){ exportar(); },
  'tema':function(){ toggleTheme(); }
};
document.addEventListener('click', function(e){
  if(e.target.closest('[data-close]')){ closeDlg(); return; }
  var el=e.target.closest('[data-act]'); if(!el) return;
  var f=A[el.dataset.act]||A2[el.dataset.act]||A3[el.dataset.act]||A4[el.dataset.act]||A5[el.dataset.act]||ANuvem[el.dataset.act]; if(f){ e.preventDefault(); f(el.dataset, el); }
});
document.addEventListener('change', function(e){
  var el=e.target.closest('[data-chg="cond"]'); if(!el) return;
  var oid=el.dataset.oid, n=Number(el.dataset.n), cur=etapaDoc(oid,n);
  Store.set('etapas', cur.id, Object.assign({}, cur, {condicoesOk:el.checked}));
});
document.addEventListener('toggle', function(e){ var d=e.target; if(d&&d.matches&&d.matches('details.ex')) ui.det[d.dataset.k]=d.open; }, true);

