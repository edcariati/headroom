/* ================= FASE 2 ================= */
var AREAS={engenharia:'Engenharia', suprimentos:'Suprimentos', prestadores:'Prestadores', financeiro:'Financeiro', cliente:'Cliente', legal:'Legal'};
var TIPOS_EV=['Vistoria','Reunião','Visita técnica','Concretagem','Entrega','Outro'];
var EV_STATUS={agendado:'Agendado', realizado:'Realizado', reagendado:'Reagendado', cancelado:'Cancelado'};
var RITOS=[
  {k:'semanal', n:'Reunião semanal de obra', p:'PPC da semana anterior, compromisso da próxima, pendências, ocorrências, compras e locações a pedir'},
  {k:'compras', n:'Reunião de compras e medição', p:'Mapa de cotações, pedidos, entregas, locações e medição dos prestadores'},
  {k:'mensal', n:'Relatório e prestação de contas mensal', p:'Fotos, avanço físico, financeiro, aditivos e pendências de decisão com data-limite'},
  {k:'encerramento', n:'Encerramento e lições aprendidas', p:'Orçado × realizado, causas de desvio e ajustes no P0 e no protocolo'},
  {k:'outra', n:'Outra reunião', p:''}
];
var DOC_LEGAIS=[
  {k:'cno', g:'Abertura e execução', n:'Cadastro da obra no CNO', val:false, dica:'Prazo de 30 dias do início da obra, conforme pesquisa em fontes públicas. Confirmar com o contador.'},
  {k:'art', g:'Abertura e execução', n:'ART ou RRT do responsável técnico', val:false, dica:'Também é informada no cadastro do CNO.'},
  {k:'alvara', g:'Abertura e execução', n:'Alvará de construção', val:true, dica:''},
  {k:'projeto', g:'Abertura e execução', n:'Projeto aprovado na prefeitura', val:false, dica:''},
  {k:'pgr', g:'Abertura e execução', n:'PGR da NR-18', val:true, dica:'Revisar conforme a etapa em que a obra está. Confirmar com o técnico de segurança do trabalho.'},
  {k:'sero', g:'Encerramento', n:'Regularização no SERO', val:false, dica:''},
  {k:'cnd', g:'Encerramento', n:'CND da obra', val:true, dica:''},
  {k:'habitese', g:'Encerramento', n:'Habite-se', val:false, dica:''}
];
var DOC_MENSAIS=[{k:'inss', n:'INSS'}, {k:'fgts', n:'FGTS'}, {k:'folha', n:'Folha'}, {k:'certidoes', n:'Certidões'}];
var DOC_ST={pendente:'Pendente', recebido:'Recebido', conferido:'Conferido'};
var AMBIENTES=['Sala','Cozinha','Suíte','Quarto 2','Quarto 3','Banheiro social','Lavabo','Área de serviço','Garagem','Varanda','Área externa','Fachada','Cobertura','Outro'];
var MAT_RES={pendente:'Aguardando decisão', aprovado:'Aprovado', ressalvas:'Aprovado com ressalvas', reprovado:'Reprovado'};
var RFI_ST={aberto:'Aguardando resposta', respondido:'Respondido', encerrado:'Encerrado'};

function short(s,n){ s=String(s||''); n=n||60; return s.length>n?s.slice(0,n-1)+'…':s; }
function mesAdd(m,n){ var p=m.split('-').map(Number), d=new Date(p[0],p[1]-1+n,1); return d.getFullYear()+'-'+pad(d.getMonth()+1); }
function mesNome(m){ var N=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], p=m.split('-'); return N[Number(p[1])-1]+' de '+p[0]; }
function diasNoMes(m){ var p=m.split('-').map(Number); return new Date(p[0],p[1],0).getDate(); }
function anexosHtml(list){
  if(!list||!list.length) return '';
  var im=list.filter(function(x){return !x.pdf;}).map(function(x){return x.id;}), pd=list.filter(function(x){return x.pdf;});
  return thumbs(im)+(pd.length?'<div class="row" style="margin-top:6px;gap:6px">'+pd.map(function(x){ return '<a class="chip steel" href="'+esc(blobUrl(x.id))+'" target="_blank" rel="noopener">PDF: '+esc(short(x.n||'arquivo',28))+'</a>'; }).join('')+'</div>':'');
}
function overduePlural(n){ return plural(n,'dia','dias'); }

/* ---------- dados auxiliares ---------- */
function docLegal(oid,k){ return G('docsLegais', oid+'_'+k); }
function docRegistrado(d){ return !!(d && (((d.numero||'').trim()) || (d.anexos&&d.anexos.length))); }
function docPrest(oid,pid,mes,k){ return G('docsPrest', oid+'_'+pid+'_'+mes+'_'+k); }
function prestAtivos(oid){
  var s={};
  byObra('atividades',oid).forEach(function(a){ if(a.prestadorId) s[a.prestadorId]=1; });
  byObra('servicos',oid).forEach(function(a){ if(a.prestadorId) s[a.prestadorId]=1; });
  byObra('diarios',oid).forEach(function(d){ (d.efetivo||[]).forEach(function(r){ if(r.p) s[r.p]=1; }); });
  return Object.keys(s).map(function(id){ return G('prestadores',id); }).filter(Boolean).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
}
function prestEmDia(oid,pid,mes){ return DOC_MENSAIS.every(function(t){ var d=docPrest(oid,pid,mes,t.k); return d&&d.status==='conferido'; }); }
function docsMesResumo(oid,mes){
  var ps=prestAtivos(oid), em=ps.filter(function(p){ return prestEmDia(oid,p.id,mes); });
  return {tot:ps.length, ok:em.length, pend:ps.length-em.length};
}
function acaoVencida(a){ return a.status==='aberta' && a.prazo && a.prazo<hoje(); }
function rfiVencido(r){ return r.status==='aberto' && r.prazo && r.prazo<hoje(); }
function matVencido(m){ return m.resultado==='pendente' && m.prazo && m.prazo<hoje(); }
function locsDe(oid){ return byObra('locs',oid).sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); }); }
function lobIni(s,k){ return addDays(s.inicio, k*(s.diasPorLoc||1)); }
function lobFim(s,k){ return addDays(lobIni(s,k), (s.diasPorLoc||1)-1); }
function avLoc(s,lid){ return (s.av&&s.av[lid])||null; }

/* ---------- LINHA DE BALANÇO: cálculo ---------- */
function lobResumo(s,locs){
  var N=locs.length, done=0, prog=0, plan=0, iniReal=null;
  locs.forEach(function(l,k){
    var a=avLoc(s,l.id), p=a?(a.p||0):0;
    if(p>=100) done++;
    prog+=p/100;
    var st=lobIni(s,k), f=(diffDays(st,hoje())+1)/(s.diasPorLoc||1);
    plan+=Math.max(0,Math.min(1,f));
    if(a&&a.ini&&(!iniReal||a.ini<iniReal)) iniReal=a.ini;
  });
  var ratio=plan>0?prog/plan:null;
  return {N:N, done:done, prog:prog, plan:plan, ratio:ratio, iniReal:iniReal, ritPlan:7/(s.diasPorLoc||1)};
}
function lobConflitos(oid){
  var locs=locsDe(oid), svs=byObra('servicos',oid), out=[];
  svs.forEach(function(s){
    var ps=s.pred?svs.filter(function(x){return x.id===s.pred;})[0]:null; if(!ps) return;
    locs.forEach(function(l,k){
      var a=avLoc(ps,l.id), feita=a&&a.p>=100, st=lobIni(s,k);
      if(!feita && st<=addDays(hoje(),7)) out.push('“'+s.nome+'” começa em '+l.nome+' no dia '+fmtC(st)+', mas “'+ps.nome+'” ainda não concluiu essa localização.');
    });
  });
  return out;
}
function lobRatioMedio(oid){
  var locs=locsDe(oid), svs=byObra('servicos',oid).map(function(s){ return lobResumo(s,locs).ratio; }).filter(function(x){ return x!=null; });
  if(!svs.length) return null;
  return svs.reduce(function(a,b){return a+b;},0)/svs.length;
}

/* ---------- ALERTAS DA FASE 2 ---------- */
function alertasP2(o){
  var A=[], oid=o.id, base='#/obra/'+oid+'/', dias=o.diasEscalar==null?7:o.diasEscalar;
  var rf=byObra('rfis',oid).filter(rfiVencido);
  if(rf.length) A.push({k:'warn', t:plural(rf.length,'RFI sem resposta e vencido','RFIs sem resposta e vencidos')+'. Cobrar o projetista.', to:base+'projeto'});
  var mt=byObra('materiais',oid).filter(matVencido);
  if(mt.length) A.push({k:'warn', t:plural(mt.length,'decisão de material ou amostra vencida','decisões de material ou amostra vencidas')+': pode atrasar pedido e execução.', to:base+'projeto'});
  var ac=byObra('acoes',oid).filter(acaoVencida);
  if(ac.length){
    var esc_=ac.filter(function(x){ return diffDays(x.prazo,hoje())>dias; });
    A.push({k:esc_.length?'crit':'warn', t:plural(ac.length,'ação de reunião vencida','ações de reunião vencidas')+(esc_.length?'; '+plural(esc_.length,'está','estão')+' há mais de '+dias+' dias e deve(m) ir à diretoria.':'.'), to:base+'reunioes'});
  }
  if(o.inicio && !docRegistrado(docLegal(oid,'cno'))){
    var d=diffDays(o.inicio,hoje());
    if(d>30) A.push({k:'crit', t:'Obra iniciada há '+overduePlural(d)+' sem cadastro no CNO (prazo de 30 dias).', to:base+'documentos'});
    else if(d>=20) A.push({k:'warn', t:'Cadastro no CNO vence em '+overduePlural(30-d)+'.', to:base+'documentos'});
  }
  DOC_LEGAIS.forEach(function(t){
    var dc=docLegal(oid,t.k); if(!dc||!dc.validade) return;
    var v=validade(dc.validade);
    if(v.k==='crit'||v.k==='warn') A.push({k:v.k, t:t.n+': '+v.t.toLowerCase()+'.', to:base+'documentos'});
  });
  if(new Date().getDate()>=10){
    var mes=mesAdd(hoje().slice(0,7),-1), r=docsMesResumo(oid,mes);
    if(r.pend>0) A.push({k:'warn', t:plural(r.pend,'prestador','prestadores')+' sem os documentos de '+mesNome(mes)+' conferidos (INSS, FGTS, folha e certidões).', to:base+'documentos'});
  }
  lobConflitos(oid).slice(0,3).forEach(function(t){ A.push({k:'warn', t:t, to:base+'balanco'}); });
  return A.concat(alertasP3(o));
}

/* ================= AGENDA ================= */
function eventosAuto(filtroOid){
  var out=[], hj=hoje(), seen={};
  function put(e){ if(!e.data||seen[e.key]) return; seen[e.key]=1; e.venc=e.data<hj&&e.status==='agendado'; out.push(e); }
  var obras=L('obras').filter(function(o){ return !filtroOid||o.id===filtroOid; });
  obras.forEach(function(o){
    var b='#/obra/'+o.id+'/';
    function add(data,titulo,area,to){ put({key:'a:'+o.id+':'+titulo+':'+data, data:data, hora:'', titulo:titulo, area:area, obraId:o.id, obra:o.nome, to:to, auto:true, status:'agendado'}); }
    byObra('ocorrencias',o.id).filter(ocAberta).forEach(function(x){ add(x.prazo, (x.status==='aguardando_reinspecao'?'Reinspeção: ':'Prazo de correção: ')+short(x.descricao,48), 'engenharia', b+'ocorrencias'); });
    byObra('atividades',o.id).forEach(function(a){ if((a.avanco||0)===0) add(a.inicio,'Início: '+a.nome,'prestadores',b+'cronograma'); if((a.avanco||0)<100) add(a.fim,'Fim previsto: '+a.nome,'prestadores',b+'cronograma'); });
    byObra('rfis',o.id).filter(function(r){return r.status==='aberto';}).forEach(function(r){ add(r.prazo,'Resposta de RFI: '+short(r.pergunta,44),'engenharia',b+'projeto'); });
    byObra('materiais',o.id).filter(function(m){return m.resultado==='pendente';}).forEach(function(m){ add(m.prazo,'Decisão sobre '+m.item,'cliente',b+'projeto'); });
    byObra('acoes',o.id).filter(function(a){return a.status==='aberta';}).forEach(function(a){ add(a.prazo,'Ação: '+short(a.descricao,44)+(a.responsavel?' ('+a.responsavel+')':''),'engenharia',b+'reunioes'); });
    DOC_LEGAIS.forEach(function(t){ var d=docLegal(o.id,t.k); if(d&&d.validade) add(d.validade,'Vence: '+t.n,'legal',b+'documentos'); });
    if(o.inicio && !docRegistrado(docLegal(o.id,'cno'))) add(addDays(o.inicio,30),'Prazo para cadastrar a obra no CNO','legal',b+'documentos');
    eventosP3(o,add,b);
  });
  var pr=filtroOid?prestAtivos(filtroOid):L('prestadores');
  pr.forEach(function(p){
    function addp(data,titulo){ put({key:'p:'+p.id+':'+titulo+':'+data, data:data, hora:'', titulo:titulo, area:'prestadores', obraId:filtroOid||'', obra:'', to:'#/prestadores', auto:true, status:'agendado'}); }
    addp(p.seguro,'Vence o seguro de '+p.nome); addp(p.treinamento,'Vence o treinamento de '+p.nome);
  });
  L('treinamentos').forEach(function(t){
    var p=G('prestadores',t.prestadorId); if(!p||!t.validade) return;
    if(filtroOid && prestAtivos(filtroOid).map(function(x){return x.id;}).indexOf(p.id)<0) return;
    put({key:'t:'+t.id, data:t.validade, hora:'', titulo:'Vence '+t.norma+' de '+(t.trabalhador||p.nome), area:'prestadores', obraId:filtroOid||'', obra:'', to:'#/prestadores', auto:true, status:'agendado'});
  });
  L('eventos').filter(function(e){ return !filtroOid||e.obraId===filtroOid; }).forEach(function(e){
    var ob=G('obras',e.obraId);
    put({key:'m:'+e.id, id:e.id, data:e.data, hora:e.hora||'', titulo:e.titulo, area:e.area||'engenharia', obraId:e.obraId||'', obra:ob?ob.nome:'', auto:false, status:e.status||'agendado', resp:e.responsavel||'', part:e.participantes||'', notas:e.notas||'', tipo:e.tipo||'', reag:e.reag||0, mot:e.motivoReag||''});
  });
  return out;
}
function agendaFiltrada(oid){
  return eventosAuto(oid).filter(function(e){ return ui.agArea==='todas'||e.area===ui.agArea; });
}
function calHtml(oid){
  var mes=ui.agMes, evs=agendaFiltrada(oid), by={};
  evs.forEach(function(e){ (by[e.data]=by[e.data]||[]).push(e); });
  var first=mes+'-01', last=addDays(first,diasNoMes(mes)-1), ini=segunda(first), fim=addDays(segunda(last),6), hj=hoje();
  var sel=ui.agDia&&ui.agDia.slice(0,7)===mes?ui.agDia:(hj.slice(0,7)===mes?hj:first);
  var cells='';
  for(var d=ini; d<=fim; d=addDays(d,1)){
    var list=by[d]||[], dots='', areas={};
    list.forEach(function(e){ areas[e.area]=1; });
    Object.keys(areas).slice(0,4).forEach(function(a){ dots+='<i style="background:var(--a-'+a+')"></i>'; });
    var venc=list.some(function(e){return e.venc;});
    cells+='<button type="button" class="cal-d'+(d.slice(0,7)!==mes?' out':'')+(d===hj?' today':'')+(d===sel?' sel':'')+(venc?' venc':'')+'" data-act="ag-dia" data-d="'+d+'" aria-label="'+fmt(d)+': '+plural(list.length,'evento','eventos')+'"><span class="n">'+Number(d.slice(8))+'</span><span class="dots">'+dots+(list.length>1?'<span class="tiny muted">'+list.length+'</span>':'')+'</span></button>';
  }
  var nome=['seg','ter','qua','qui','sex','sáb','dom'];
  var dayEvs=(by[sel]||[]).slice().sort(function(a,b){ return (a.hora||'99').localeCompare(b.hora||'99') || a.titulo.localeCompare(b.titulo); });
  var conf=conflitosEv(evs);
  var lst=dayEvs.length?dayEvs.map(function(e){
    var acts='';
    if(e.auto) acts='<a class="btn sm" href="'+e.to+'">Abrir</a>';
    else acts=(e.status!=='realizado'&&e.status!=='cancelado'?'<button class="btn sm" data-act="ev-status" data-id="'+e.id+'" data-to="realizado" data-write>Realizado</button><button class="btn sm" data-act="ev-reag" data-id="'+e.id+'" data-write>Reagendar</button><button class="btn sm ghost" data-act="ev-status" data-id="'+e.id+'" data-to="cancelado" data-write>Cancelar</button>':'')+'<button class="btn sm ghost" data-act="ev-editar" data-id="'+e.id+'" data-write>Editar</button>';
    var cf=conf[e.key]?'<span class="chip warn">Conflito de horário</span>':'';
    return '<div class="ev"><div class="num" style="font-size:16px;font-weight:600">'+(e.hora||'—')+'</div><div class="grow"><strong'+(e.status==='cancelado'?' style="text-decoration:line-through"':'')+'>'+esc(e.titulo)+'</strong><div class="row" style="gap:6px;margin-top:4px"><span class="chip"><i class="dot" style="background:var(--a-'+e.area+')"></i>'+AREAS[e.area]+'</span>'+(e.obra?'<span class="chip">'+esc(e.obra)+'</span>':'')+(e.auto?'<span class="chip">Automático</span>':'<span class="chip '+(e.status==='realizado'?'ok':(e.status==='cancelado'?'':(e.status==='reagendado'?'warn':'steel')))+'">'+EV_STATUS[e.status]+'</span>')+(e.venc?'<span class="chip crit">Atrasado</span>':'')+(e.reag?'<span class="chip">'+plural(e.reag,'reagendamento','reagendamentos')+'</span>':'')+cf+'</div>'+(e.resp?'<div class="small muted" style="margin-top:4px">Responsável: '+esc(e.resp)+(e.part?' · Participantes: '+esc(e.part):'')+'</div>':'')+(e.notas?'<div class="small muted">'+esc(e.notas)+'</div>':'')+(e.mot?'<div class="tiny muted">Último motivo de reagendamento: '+esc(e.mot)+'</div>':'')+'</div><div class="row" style="gap:6px">'+acts+'</div></div>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhum evento em '+fmt(sel)+'.</p>';
  var areas=['todas'].concat(Object.keys(AREAS));
  var filtro='<div class="row" style="gap:6px;margin:12px 0">'+areas.map(function(a){ return '<button class="btn sm'+(ui.agArea===a?' primary':'')+'" data-act="ag-area" data-a="'+a+'">'+(a==='todas'?'Todas as áreas':'<i class="dot" style="background:var(--a-'+a+');margin-right:2px"></i>'+AREAS[a])+'</button>'; }).join('')+'</div>';
  var nvenc=evs.filter(function(e){return e.venc;}).length;
  return '<div class="row spread"><div class="row"><button class="btn" data-act="ag-mes" data-d="-1" aria-label="Mês anterior">←</button><h2 style="min-width:170px;text-align:center">'+mesNome(mes)+'</h2><button class="btn" data-act="ag-mes" data-d="1" aria-label="Próximo mês">→</button><button class="btn sm" data-act="ag-mes" data-d="0">Hoje</button></div><div class="row">'+(nvenc?'<span class="chip crit">'+plural(nvenc,'item atrasado','itens atrasados')+'</span>':'')+'<button class="btn primary" data-act="ev-novo" data-oid="'+(oid||'')+'" data-write>+ Compromisso</button></div></div>'
    +filtro+'<div class="cal-h">'+nome.map(function(n){return '<span>'+n+'</span>';}).join('')+'</div><div class="cal">'+cells+'</div>'
    +'<section class="card" style="margin-top:16px"><div class="card-h"><h2>'+fmt(sel)+'</h2><span class="small muted">'+plural(dayEvs.length,'evento','eventos')+'</span></div>'+lst+'</section>'
    +'<p class="small muted" style="margin-top:10px">Prazos de ocorrências, atividades, RFIs, decisões, ações, documentos e treinamentos entram automaticamente. Compromissos manuais são os da equipe: vistorias, reuniões, concretagens e entregas.</p>';
}
function conflitosEv(evs){
  var m={}, res={};
  evs.filter(function(e){ return !e.auto && e.hora && e.resp && e.status!=='cancelado' && e.status!=='realizado'; }).forEach(function(e){
    var k=e.data+'|'+e.hora+'|'+e.resp.trim().toLowerCase(); (m[k]=m[k]||[]).push(e);
  });
  Object.keys(m).forEach(function(k){ if(m[k].length>1) m[k].forEach(function(e){ res[e.key]=1; }); });
  return res;
}
function tAgenda(o){ return calHtml(o.id); }
function vAgenda(){ return '<div class="wrap"><h1>Agenda</h1><p class="muted small" style="margin:4px 0 14px">Todos os compromissos e prazos de todas as obras.</p>'+calHtml('')+'</div>'; }

function eventoForm(oid, e){
  var novo=!e, forcar=false;
  var obras=L('obras').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');});
  openForm({
    title:novo?'Novo compromisso':'Editar compromisso',
    fields:[
      {name:'titulo',label:'O que',required:true,value:e&&e.titulo,ph:'Ex.: Vistoria pré-concretagem'},
      [{name:'tipo',label:'Tipo',type:'select',options:TIPOS_EV.map(function(t){return [t,t];}),value:(e&&e.tipo)||'Vistoria'},{name:'area',label:'Área',type:'select',options:Object.keys(AREAS).map(function(k){return [k,AREAS[k]];}),value:(e&&e.area)||'engenharia'}],
      {name:'obraId',label:'Obra',type:'select',options:selOpts(obras.map(function(x){return [x.id,x.nome];}),'Sem obra'),value:e?e.obraId:(oid||'')},
      [{name:'data',label:'Data',type:'date',required:true,value:e?e.data:(ui.agDia||hoje())},{name:'hora',label:'Hora',type:'time',value:e&&e.hora}],
      [{name:'responsavel',label:'Responsável',value:e&&e.responsavel},{name:'participantes',label:'Participantes',value:e&&e.participantes}],
      {name:'notas',label:'Observações',type:'textarea',rows:2,value:e&&e.notas}
    ],
    extra:novo?'':'<button type="button" class="btn danger" data-act="ev-excluir" data-id="'+e.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.titulo||'').trim()) return 'Informe o que será feito.';
      if(!v.data) return 'Informe a data.';
      if(v.hora && (v.responsavel||'').trim() && !forcar){
        var outros=L('eventos').filter(function(x){ return (!e||x.id!==e.id) && x.data===v.data && x.hora===v.hora && (x.responsavel||'').trim().toLowerCase()===v.responsavel.trim().toLowerCase() && x.status!=='cancelado' && x.status!=='realizado'; });
        if(outros.length){ forcar=true; return v.responsavel.trim()+' já tem “'+outros[0].titulo+'” em '+fmt(v.data)+' às '+v.hora+'. Salve de novo para manter os dois.'; }
      }
      await Store.set('eventos', e?e.id:nid(), Object.assign({status:'agendado', reag:0}, e||{}, {titulo:v.titulo.trim(), tipo:v.tipo, area:v.area, obraId:v.obraId||'', data:v.data, hora:v.hora||'', responsavel:(v.responsavel||'').trim(), participantes:(v.participantes||'').trim(), notas:v.notas||''}));
    }
  });
}
function reagendarForm(id){
  var e=G('eventos',id);
  openForm({title:'Reagendar', intro:esc(e.titulo)+' — hoje em '+fmt(e.data)+(e.hora?' às '+e.hora:'')+'.',
    fields:[[{name:'data',label:'Nova data',type:'date',required:true,value:e.data},{name:'hora',label:'Nova hora',type:'time',value:e.hora}],{name:'motivo',label:'Motivo do reagendamento',type:'textarea',required:true,rows:2}],
    submit:'Reagendar',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a nova data.';
      if(!(v.motivo||'').trim()) return 'Registre o motivo do reagendamento.';
      var hist=(e.hist||[]).concat([{de:[e.data,e.hora||''], para:[v.data,v.hora||''], motivo:v.motivo.trim(), em:new Date().toISOString(), por:Store.uid||null}]).slice(-20);
      await Store.set('eventos', id, Object.assign({}, e, {data:v.data, hora:v.hora||'', status:'reagendado', reag:(e.reag||0)+1, motivoReag:v.motivo.trim(), hist:hist}));
    }});
}

/* ================= REUNIÕES E AÇÕES ================= */
function tReunioes(o){
  var oid=o.id, dias=o.diasEscalar==null?7:o.diasEscalar;
  var acs=byObra('acoes',oid), abertas=acs.filter(function(a){return a.status==='aberta';}).sort(function(a,b){return (a.prazo||'9')<(b.prazo||'9')?-1:1;});
  var feitas=acs.length-abertas.length;
  var atas=byObra('atas',oid).sort(function(a,b){ return a.data<b.data?1:-1; });
  var acHtml=abertas.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead><tbody>'+abertas.map(function(a){
    var v=acaoVencida(a), atr=v?diffDays(a.prazo,hoje()):0, ult=(a.interacoes||[]).slice(-1)[0];
    return '<tr><td>'+esc(a.descricao)+(ult?'<div class="tiny muted">Último contato: '+fmt(ult.data)+' ('+esc(ult.canal)+') — '+esc(short(ult.texto,60))+'</div>':'')+'</td><td>'+esc(a.responsavel||'—')+'</td><td><span class="chip '+(v?(atr>dias?'crit':'warn'):'')+'">'+(v?'Venceu há '+overduePlural(atr):fmtC(a.prazo))+'</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="acao-ok" data-id="'+a.id+'" data-write>Concluir</button> <button class="btn sm" data-act="acao-contato" data-id="'+a.id+'" data-write>Contato</button> <button class="btn sm ghost" data-act="acao-editar" data-id="'+a.id+'" data-write>Editar</button></td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted" style="padding:16px">Nenhuma ação aberta.'+(feitas?' '+plural(feitas,'ação concluída','ações concluídas')+'.':'')+'</p>';
  var ataHtml=atas.length?atas.map(function(t){
    var r=RITOS.filter(function(x){return x.k===t.rito;})[0]||RITOS[4], acT=acs.filter(function(a){return a.ataId===t.id;}), ab=acT.filter(function(a){return a.status==='aberta';}).length;
    return '<article class="entry"><div class="row spread"><div class="row"><strong>'+esc(r.n)+'</strong><span class="chip">'+fmt(t.data)+'</span>'+(t.assinada?'<span class="chip ok">Assinada</span>':'<span class="chip">Sem assinatura</span>')+'</div><div class="row"><button class="btn sm" data-act="acao-nova" data-oid="'+oid+'" data-ata="'+t.id+'" data-write>+ Ação</button><button class="btn sm ghost" data-act="ata-editar" data-id="'+t.id+'" data-write>Editar</button></div></div>'
      +(t.participantes?'<p class="small muted" style="margin-top:6px">Participantes: '+esc(t.participantes)+'</p>':'')
      +(t.pauta?'<p class="small" style="margin-top:8px;white-space:pre-wrap"><strong>Pauta:</strong> '+esc(t.pauta)+'</p>':'')
      +'<p style="margin-top:8px;white-space:pre-wrap"><strong>Decisões:</strong> '+esc(t.decisoes||'—')+'</p>'
      +(acT.length?'<p class="tiny muted" style="margin-top:6px">'+plural(acT.length,'ação','ações')+' desta ata, '+ab+' aberta(s).</p>':'')+'</article>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhuma ata registrada. A ata é preenchida à mão, com pauta, decisões e ações com responsável e prazo.</p>';
  return '<div class="sec-h"><div><h2>Reuniões e plano de ação</h2><p class="muted small">Atas dos ritos de gestão e as ações que saem delas.</p></div><div class="row"><button class="btn" data-act="acao-nova" data-oid="'+oid+'" data-write>+ Ação</button><button class="btn primary" data-act="ata-nova" data-oid="'+oid+'" data-write>+ Ata</button></div></div>'
    +'<div class="grid cols2" style="margin-top:14px"><section class="card"><div class="card-h"><h2>Ações abertas</h2><span class="chip">'+abertas.length+'</span></div>'+acHtml+'</section><section class="card"><div class="card-h"><h2>Atas</h2><span class="chip">'+atas.length+'</span></div>'+ataHtml+'</section></div>';
}
function ataForm(oid,t){
  var novo=!t;
  openForm({title:novo?'Nova ata':'Editar ata', wide:true,
    fields:[[{name:'rito',label:'Reunião',type:'select',options:RITOS.map(function(r){return [r.k,r.n];}),value:(t&&t.rito)||'semanal'},{name:'data',label:'Data',type:'date',required:true,value:t?t.data:hoje()}],
      {name:'participantes',label:'Participantes',value:t&&t.participantes},
      {name:'pauta',label:'Pauta',type:'textarea',rows:3,value:t?t.pauta:RITOS[0].p,hint:'Sugestão do protocolo para a reunião escolhida: '+RITOS.slice(0,4).map(function(r){return r.n+' — '+r.p;}).join(' | ')},
      {name:'decisoes',label:'Decisões',type:'textarea',required:true,rows:4,value:t&&t.decisoes},
      {name:'assinada',label:'Ata assinada pelos presentes?',type:'radio',options:[['sim','Sim'],['nao','Ainda não']],value:t&&t.assinada?'sim':'nao'}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="ata-excluir" data-id="'+t.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      if(!(v.decisoes||'').trim()) return 'Registre as decisões.';
      await Store.set('atas', t?t.id:nid(), Object.assign({}, t||{}, {obraId:oid, rito:v.rito, data:v.data, participantes:v.participantes||'', pauta:v.pauta||'', decisoes:v.decisoes.trim(), assinada:v.assinada==='sim'}));
    }});
}
function acaoForm(oid,a,ataId){
  var novo=!a, atas=byObra('atas',oid).sort(function(x,y){return x.data<y.data?1:-1;});
  openForm({title:novo?'Nova ação':'Editar ação',
    fields:[{name:'descricao',label:'Ação',type:'textarea',required:true,rows:2,value:a&&a.descricao},
      [{name:'responsavel',label:'Responsável',required:true,value:a&&a.responsavel},{name:'prazo',label:'Prazo',type:'date',required:true,value:a?a.prazo:addDays(hoje(),7)}],
      {name:'ataId',label:'Origem',type:'select',options:selOpts(atas.map(function(t){ var r=RITOS.filter(function(x){return x.k===t.rito;})[0]||RITOS[4]; return [t.id, r.n+' de '+fmt(t.data)]; }),'Sem ata'),value:a?a.ataId:(ataId||'')}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="acao-excluir" data-id="'+a.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva a ação.';
      if(!(v.responsavel||'').trim()) return 'Diga quem é o responsável.';
      if(!v.prazo) return 'Informe o prazo.';
      await Store.set('acoes', a?a.id:nid(), Object.assign({status:'aberta', interacoes:[], criadoEm:new Date().toISOString()}, a||{}, {obraId:oid, descricao:v.descricao.trim(), responsavel:v.responsavel.trim(), prazo:v.prazo, ataId:v.ataId||''}));
    }});
}

/* ================= DOCUMENTOS ================= */
function docStatusLegal(t,d,o){
  if(!docRegistrado(d)){
    if(t.k==='cno' && o.inicio){ var dd=diffDays(o.inicio,hoje()); if(dd>30) return {k:'crit', t:'Pendente há '+overduePlural(dd)}; if(dd>=20) return {k:'warn', t:'Pendente: vence em '+overduePlural(30-dd)}; }
    return {k:'', t:'Pendente'};
  }
  if(d.validade){ var v=validade(d.validade); if(v.k==='crit'||v.k==='warn') return {k:v.k, t:v.t}; return {k:'ok', t:'Registrado · '+v.t.toLowerCase()}; }
  return {k:'ok', t:'Registrado'};
}
function tDocumentos(o){
  var oid=o.id, grupos={}; DOC_LEGAIS.forEach(function(t){ (grupos[t.g]=grupos[t.g]||[]).push(t); });
  var leg=Object.keys(grupos).map(function(g){
    return '<tr><th colspan="4" style="padding-top:14px;color:var(--ink);font-family:var(--f-head);font-size:14px">'+esc(g)+'</th></tr>'+grupos[g].map(function(t){
      var d=docLegal(oid,t.k), s=docStatusLegal(t,d,o);
      return '<tr><td><strong>'+esc(t.n)+'</strong>'+(t.dica?'<div class="tiny muted">'+esc(t.dica)+'</div>':'')+'</td><td>'+esc((d&&d.numero)||'—')+(d&&d.obs?'<div class="tiny muted">'+esc(short(d.obs,60))+'</div>':'')+anexosHtml(d&&d.anexos)+'</td><td><span class="chip '+s.k+'">'+esc(s.t)+'</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="doc-legal" data-oid="'+oid+'" data-k="'+t.k+'" data-write>'+(docRegistrado(d)?'Editar':'Registrar')+'</button></td></tr>';
    }).join('');
  }).join('');
  var mes=ui.docMes[oid]||mesAdd(hoje().slice(0,7),-1), ps=prestAtivos(oid), res=docsMesResumo(oid,mes);
  var mat=ps.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Prestador</th>'+DOC_MENSAIS.map(function(t){return '<th>'+t.n+'</th>';}).join('')+'<th>Situação</th></tr></thead><tbody>'+ps.map(function(p){
    var ok=prestEmDia(oid,p.id,mes);
    return '<tr><td><strong>'+esc(p.nome)+'</strong></td>'+DOC_MENSAIS.map(function(t){
      var d=docPrest(oid,p.id,mes,t.k), st=d?d.status:'pendente';
      return '<td><button type="button" class="chip '+(st==='conferido'?'ok':(st==='recebido'?'warn':''))+'" style="cursor:pointer" data-act="doc-prest" data-oid="'+oid+'" data-p="'+p.id+'" data-m="'+mes+'" data-k="'+t.k+'" data-write aria-label="'+esc(p.nome+', '+t.n+': '+DOC_ST[st])+'">'+DOC_ST[st]+'</button></td>';
    }).join('')+'<td><span class="chip '+(ok?'ok':'warn')+'">'+(ok?'Em dia':'Incompleto')+'</span></td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted" style="padding:16px">Ainda não há prestadores ligados a esta obra. Eles aparecem aqui quando entram no cronograma, no efetivo do diário ou na linha de balanço.</p>';
  var nav='<div class="row"><button class="btn sm" data-act="docmes" data-oid="'+oid+'" data-d="-1" aria-label="Mês anterior">←</button><strong style="min-width:140px;text-align:center">'+mesNome(mes)+'</strong><button class="btn sm" data-act="docmes" data-oid="'+oid+'" data-d="1" aria-label="Próximo mês">→</button></div>';
  return '<div class="stack"><section class="card"><div class="card-h"><div><h2>Documentos da obra</h2><p class="muted small">Cadastro, responsabilidade técnica, licenças e regularização. Prazos vêm de pesquisa em fontes públicas; confirme com o contador e o técnico de segurança.</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Documento</th><th>Número e anexos</th><th>Situação</th><th></th></tr></thead><tbody>'+leg+'</tbody></table></div></section>'
    +'<section class="card"><div class="card-h"><div><h2>Documentos mensais dos prestadores</h2><p class="muted small">INSS, FGTS, folha e certidões a cada competência. Conferido é quando alguém da Cariati verificou o documento.</p></div>'+nav+'</div>'
    +(ps.length?'<div class="pad row" style="gap:8px;padding-bottom:0"><span class="chip '+(res.pend?'warn':'ok')+'">'+res.ok+' de '+res.tot+' prestadores em dia</span></div>':'')+mat+'</section></div>';
}
function docLegalForm(oid,k){
  var t=DOC_LEGAIS.filter(function(x){return x.k===k;})[0], d=docLegal(oid,k);
  openForm({title:t.n, intro:t.dica?esc(t.dica):'',
    fields:[[{name:'numero',label:'Número ou protocolo',value:d&&d.numero},{name:'validade',label:t.val?'Validade':'Validade (se houver)',type:'date',value:d&&d.validade}],
      {name:'obs',label:'Observações',type:'textarea',rows:2,value:d&&d.obs},
      {name:'anexos',label:'Arquivos (foto ou PDF)',type:'anexos',value:(d&&d.anexos)||[]}],
    extra:d?'<button type="button" class="btn danger" data-act="doc-legal-limpar" data-oid="'+oid+'" data-k="'+k+'" style="margin-right:auto">Remover registro</button>':'',
    onSubmit:async function(v){
      if(!(v.numero||'').trim() && !(v.anexos&&v.anexos.length)) return 'Informe o número ou anexe o documento.';
      await Store.set('docsLegais', oid+'_'+k, {obraId:oid, tipo:k, numero:(v.numero||'').trim(), validade:v.validade||'', obs:v.obs||'', anexos:v.anexos||[], por:Store.uid||null, em:new Date().toISOString()});
    }});
}
function docPrestForm(oid,pid,mes,k){
  var p=G('prestadores',pid), t=DOC_MENSAIS.filter(function(x){return x.k===k;})[0], d=docPrest(oid,pid,mes,k);
  openForm({title:t.n+' — '+p.nome, intro:'Competência: '+mesNome(mes)+'.',
    fields:[{name:'status',label:'Situação',type:'radio',required:true,options:Object.keys(DOC_ST).map(function(s){return [s,DOC_ST[s]];}),value:d?d.status:'pendente'},
      {name:'obs',label:'Observações',type:'textarea',rows:2,value:d&&d.obs},
      {name:'anexos',label:'Arquivos (foto ou PDF)',type:'anexos',value:(d&&d.anexos)||[]}],
    onSubmit:async function(v){
      if(!v.status) return 'Escolha a situação.';
      var rec={obraId:oid, prestadorId:pid, mes:mes, tipo:k, status:v.status, obs:v.obs||'', anexos:v.anexos||[]};
      if(v.status==='conferido'){ rec.conferidoPor=Store.uid||null; rec.conferidoEm=new Date().toISOString(); }
      await Store.set('docsPrest', oid+'_'+pid+'_'+mes+'_'+k, rec);
    }});
}

/* ================= PROJETO: RFI E MATERIAIS ================= */
function tProjeto(o){
  var oid=o.id, rf=byObra('rfis',oid).sort(function(a,b){ return (a.status==='aberto'?0:1)-(b.status==='aberto'?0:1) || ((a.prazo||'9')<(b.prazo||'9')?-1:1); });
  var mt=byObra('materiais',oid).sort(function(a,b){ return (a.resultado==='pendente'?0:1)-(b.resultado==='pendente'?0:1) || ((a.prazo||'9')<(b.prazo||'9')?-1:1); });
  var rfHtml=rf.length?rf.map(function(r){
    var v=rfiVencido(r);
    return '<article class="entry"><div class="row spread"><div class="row"><span class="chip '+(r.status==='aberto'?(v?'crit':'warn'):'ok')+'">'+RFI_ST[r.status]+'</span>'+(r.etapa?'<span class="chip">Etapa '+r.etapa+'</span>':'')+(r.prazo?'<span class="chip '+(v?'crit':'')+'">'+(v?'Venceu ':'Prazo ')+fmtC(r.prazo)+'</span>':'')+'</div><div class="row">'+(r.status==='aberto'?'<button class="btn sm primary" data-act="rfi-resp" data-id="'+r.id+'" data-write>Registrar resposta</button>':'')+'<button class="btn sm ghost" data-act="rfi-editar" data-id="'+r.id+'" data-write>Editar</button></div></div>'
      +'<p style="margin-top:8px;white-space:pre-wrap">'+esc(r.pergunta)+'</p><p class="tiny muted">Para: '+esc(r.destinatario||'—')+' · aberto em '+fmt(r.criadoEm)+'</p>'+anexosHtml(r.anexos)
      +(r.resposta?'<div class="callout ok" style="margin-top:8px"><strong>Resposta em '+fmt(r.dataResposta)+'</strong><p style="white-space:pre-wrap">'+esc(r.resposta)+'</p>'+anexosHtml(r.anexosResp)+'</div>':'')+'</article>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhum RFI. Use para perguntas formais ao projetista, com prazo e resposta registrada.</p>';
  var mtHtml=mt.length?mt.map(function(m){
    var v=matVencido(m);
    return '<article class="entry"><div class="row spread"><div class="row"><strong>'+esc(m.item)+'</strong><span class="chip '+(m.resultado==='pendente'?(v?'crit':'warn'):(m.resultado==='reprovado'?'crit':'ok'))+'">'+MAT_RES[m.resultado]+'</span>'+(m.etapa?'<span class="chip">Etapa '+m.etapa+'</span>':'')+(m.nivel3?'<span class="chip steel">Nível 3: escolha do cliente</span>':'')+(m.aditivo?'<span class="chip warn">Gera aditivo</span>':'')+'</div><div class="row">'+(m.resultado==='pendente'?'<button class="btn sm primary" data-act="mat-dec" data-id="'+m.id+'" data-write>Registrar decisão</button>':'')+'<button class="btn sm ghost" data-act="mat-editar" data-id="'+m.id+'" data-write>Editar</button></div></div>'
      +'<p class="tiny muted" style="margin-top:4px">Decide: '+esc(m.aprovador||'—')+(m.prazo&&m.resultado==='pendente'?' · prazo '+fmt(m.prazo):'')+(m.dataDecisao?' · decidido em '+fmt(m.dataDecisao):'')+'</p>'+(m.obs?'<p class="small" style="margin-top:6px;white-space:pre-wrap">'+esc(m.obs)+'</p>':'')+thumbs(m.fotos)+'</article>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhuma amostra ou material submetido. Registre o que precisa de aprovação antes de comprar ou executar.</p>';
  return '<div class="grid cols2"><section class="card"><div class="card-h"><div><h2>RFI — pedidos de esclarecimento</h2></div><button class="btn primary sm" data-act="rfi-novo" data-oid="'+oid+'" data-write>+ RFI</button></div>'+rfHtml+'</section>'
    +'<section class="card"><div class="card-h"><div><h2>Aprovação de material e amostra</h2></div><button class="btn primary sm" data-act="mat-novo" data-oid="'+oid+'" data-write>+ Material</button></div>'+mtHtml+'</section></div>';
}
function rfiForm(oid,r){
  var novo=!r;
  openForm({title:novo?'Novo RFI':'Editar RFI', wide:true,
    fields:[{name:'pergunta',label:'Pergunta ao projetista',type:'textarea',required:true,value:r&&r.pergunta,ph:'Descreva a dúvida ou a incompatibilidade, e onde ela aparece no projeto.'},
      [{name:'destinatario',label:'Para quem',required:true,value:r&&r.destinatario,ph:'Ex.: projetista estrutural'},{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('Geral'),value:r&&r.etapa?String(r.etapa):''}],
      {name:'prazo',label:'Prazo de resposta',type:'date',required:true,value:r?r.prazo:addDays(hoje(),5)},
      {name:'anexos',label:'Trecho do desenho ou foto',type:'anexos',value:(r&&r.anexos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="rfi-excluir" data-id="'+r.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.pergunta||'').trim()) return 'Escreva a pergunta.';
      if(!(v.destinatario||'').trim()) return 'Diga a quem a pergunta é dirigida.';
      if(!v.prazo) return 'Informe o prazo.';
      await Store.set('rfis', r?r.id:nid(), Object.assign({status:'aberto', criadoEm:new Date().toISOString()}, r||{}, {obraId:oid, pergunta:v.pergunta.trim(), destinatario:v.destinatario.trim(), etapa:v.etapa?Number(v.etapa):0, prazo:v.prazo, anexos:v.anexos||[]}));
    }});
}
function rfiResposta(id){
  var r=G('rfis',id);
  openForm({title:'Registrar resposta do RFI', intro:esc(short(r.pergunta,180)),
    fields:[{name:'resposta',label:'Resposta recebida',type:'textarea',required:true,rows:4},{name:'data',label:'Data da resposta',type:'date',required:true,value:hoje()},{name:'anexos',label:'Desenho revisado ou documento',type:'anexos',value:[]}],
    submit:'Registrar resposta',
    onSubmit:async function(v){
      if(!(v.resposta||'').trim()) return 'Registre a resposta.';
      await Store.set('rfis', id, Object.assign({}, r, {status:'respondido', resposta:v.resposta.trim(), dataResposta:v.data, anexosResp:v.anexos||[]}));
    }});
}
function matForm(oid,m){
  var novo=!m;
  openForm({title:novo?'Material ou amostra':'Editar material', wide:true,
    fields:[{name:'item',label:'Item',required:true,value:m&&m.item,ph:'Ex.: Porcelanato da sala, amostra 2'},
      [{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('Geral'),value:m&&m.etapa?String(m.etapa):''},{name:'aprovador',label:'Quem decide',required:true,value:m&&m.aprovador,ph:'Cliente, projetista ou Cariati'}],
      [{name:'prazo',label:'Prazo da decisão',type:'date',required:true,value:m?m.prazo:addDays(hoje(),7)},{name:'nivel3',label:'É escolha do cliente (nível 3)?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:m&&m.nivel3?'sim':'nao'}],
      {name:'aditivo',label:'Altera valor ou prazo (vira aditivo)?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:m&&m.aditivo?'sim':'nao'},
      {name:'obs',label:'Observações',type:'textarea',rows:2,value:m&&m.obs},
      {name:'fotos',label:'Fotos da amostra',type:'photos',value:(m&&m.fotos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="mat-excluir" data-id="'+m.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.item||'').trim()) return 'Informe o item.';
      if(!(v.aprovador||'').trim()) return 'Diga quem decide.';
      if(!v.prazo) return 'Informe o prazo.';
      await Store.set('materiais', m?m.id:nid(), Object.assign({resultado:'pendente', criadoEm:new Date().toISOString()}, m||{}, {obraId:oid, item:v.item.trim(), etapa:v.etapa?Number(v.etapa):0, aprovador:v.aprovador.trim(), prazo:v.prazo, nivel3:v.nivel3==='sim', aditivo:v.aditivo==='sim', obs:v.obs||'', fotos:v.fotos||[]}));
    }});
}
function matDecisao(id){
  var m=G('materiais',id);
  openForm({title:'Decisão: '+m.item,
    fields:[{name:'resultado',label:'Decisão',type:'radio',required:true,options:[['aprovado','Aprovado'],['ressalvas','Aprovado com ressalvas'],['reprovado','Reprovado']],value:''},{name:'data',label:'Data da decisão',type:'date',required:true,value:hoje()},{name:'obs',label:'Registro da decisão',type:'textarea',rows:3,value:m.obs,hint:'Nível 3 exige aprovação por escrito. Anote onde ela está.'}],
    submit:'Registrar decisão',
    onSubmit:async function(v){
      if(!v.resultado) return 'Escolha a decisão.';
      if((v.resultado==='ressalvas'||v.resultado==='reprovado') && !(v.obs||'').trim()) return 'Descreva as ressalvas ou o motivo da reprovação.';
      await Store.set('materiais', id, Object.assign({}, m, {resultado:v.resultado, dataDecisao:v.data, obs:v.obs||''}));
    }});
}

/* ================= VISTORIA PRÉ-ENTREGA ================= */
function tEntrega(o){
  var oid=o.id, its=byObra('ocorrencias',oid).filter(function(x){return x.origem==='pre_entrega';});
  var head='<div class="sec-h"><div><h2>Vistoria pré-entrega</h2><p class="muted small">Cada pendência vira uma ocorrência com prazo e responsável, e segue o mesmo fluxo de correção, contatos e reinspeção.</p></div><button class="btn primary" data-act="ent-nova" data-oid="'+oid+'" data-write>+ Item da vistoria</button></div>';
  if(!its.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhum item lançado</h3><p>Percorra a casa por ambiente e lance cada pendência com foto, responsável e prazo.</p></div>';
  var abertos=its.filter(ocAberta).length, amb={};
  its.forEach(function(x){ (amb[x.ambiente||'Sem ambiente']=amb[x.ambiente||'Sem ambiente']||[]).push(x); });
  var cards=Object.keys(amb).sort().map(function(a){
    var l=amb[a], ab=l.filter(ocAberta).length;
    return '<section class="card"><div class="card-h"><h3>'+esc(a)+'</h3><span class="chip '+(ab?'warn':'ok')+'">'+(ab?plural(ab,'pendente','pendentes'):'Concluído')+' · '+l.length+' item(ns)</span></div>'+l.sort(function(x,y){return ocAberta(x)===ocAberta(y)?0:(ocAberta(x)?-1:1);}).map(function(x){
      return '<div class="ficha" style="grid-template-columns:1fr auto"><div><button type="button" class="linkbtn" data-act="oc-abrir" data-id="'+x.id+'">'+esc(short(x.descricao,120))+'</button><div class="tiny muted">'+esc(prestNome(x.prestadorId)||'Responsável a definir')+(x.prazo?' · prazo '+fmtC(x.prazo):'')+'</div>'+thumbs(x.fotos)+'</div><span class="chip '+(!ocAberta(x)?'ok':(vencidaOc(x)?'crit':''))+'">'+esc(OC_STATUS[x.status])+'</span></div>';
    }).join('')+'</section>';
  }).join('');
  return head+'<div class="row" style="margin:12px 0"><span class="chip '+(abertos?'warn':'ok')+'">'+abertos+' de '+its.length+' itens abertos</span></div><div class="grid cols2">'+cards+'</div>';
}
function entregaForm(oid){
  openForm({title:'Item da vistoria pré-entrega', wide:true,
    fields:[[{name:'ambiente',label:'Ambiente',type:'select',options:AMBIENTES.map(function(a){return [a,a];}),value:AMBIENTES[0]},{name:'ambienteOutro',label:'Se “Outro”, qual?'}],
      {name:'descricao',label:'Pendência',type:'textarea',required:true,rows:2,ph:'Ex.: Rejunte falhado atrás da porta'},
      {name:'gravidade',label:'Gravidade',type:'radio',required:true,options:Object.keys(GRAV).map(function(k){return [k,GRAV[k]];}),value:'simples'},
      [{name:'prestadorId',label:'Responsável pela correção',type:'select',options:prestOptions('A definir')},{name:'prazo',label:'Prazo',type:'date',required:true,value:addDays(hoje(),7)}],
      {name:'fotos',label:'Fotos',type:'photos',value:[]}],
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva a pendência.';
      var amb=v.ambiente==='Outro'?((v.ambienteOutro||'').trim()||'Outro'):v.ambiente;
      await Store.add('ocorrencias', {obraId:oid, etapa:21, tipo:'apontamento', gravidade:v.gravidade, local:amb, ambiente:amb, origem:'pre_entrega', descricao:v.descricao.trim(), prestadorId:v.prestadorId||'', prazo:v.prazo, status:'aberta', criadoEm:new Date().toISOString(), por:Store.uid||null, interacoes:[], fotos:v.fotos||[], reabertas:0});
    }});
}

/* ================= LINHA DE BALANÇO ================= */
function tBalanco(o){
  var oid=o.id, locs=locsDe(oid), svs=byObra('servicos',oid).sort(function(a,b){ return (a.ordem||0)-(b.ordem||0) || (a.inicio<b.inicio?-1:1); });
  var head='<div class="sec-h"><div><h2>Linha de balanço</h2><p class="muted small">Para obras com repetição (unidades, pavimentos ou quadras). Mostra o ritmo de cada serviço e onde uma equipe vai alcançar a outra.</p></div><div class="row"><button class="btn" data-act="loc-novas" data-oid="'+oid+'" data-write>+ Localizações</button><button class="btn primary" data-act="serv-novo" data-oid="'+oid+'" data-write'+(locs.length?'':' disabled')+'>+ Serviço</button></div></div>';
  if(!locs.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhuma localização cadastrada</h3><p>Cadastre as unidades, pavimentos ou quadras da obra (por exemplo, “Casa 1, Casa 2, Casa 3” ou “Térreo, 1º pavimento”). Depois lance os serviços que passam por todas elas.</p></div>';
  var chips='<div class="row" style="gap:6px;margin:12px 0">'+locs.map(function(l){ return '<span class="chip">'+esc(l.nome)+' <button type="button" class="linkbtn" style="display:inline;color:var(--crit)" data-act="loc-excluir" data-id="'+l.id+'" data-write aria-label="Remover '+esc(l.nome)+'">×</button></span>'; }).join('')+'</div>';
  if(!svs.length) return head+chips+'<div class="card empty"><h3>Nenhum serviço lançado</h3><p>Cada serviço tem uma data de início na primeira localização e um número de dias por localização. O gráfico mostra o previsto e o realizado.</p></div>';
  var cf=lobConflitos(oid), cfHtml=cf.length?'<div class="callout" style="margin-bottom:14px"><strong>Equipes que se alcançam</strong><ul>'+cf.map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul></div>':'';
  var rows=svs.map(function(s,i){
    var r=lobResumo(s,locs), k=r.ratio==null?'':(r.ratio>=0.95?'ok':(r.ratio>=0.75?'warn':'crit'));
    return '<tr><td><span class="dot" style="background:var(--s'+((i%5)+1)+');margin-right:8px"></span><strong>'+esc(s.nome)+'</strong><div class="tiny muted">'+esc(prestNome(s.prestadorId)||'Sem prestador')+' · início '+fmtC(s.inicio)+' · '+s.diasPorLoc+' dia(s) por localização</div></td><td class="num">'+r.done+' de '+r.N+'</td><td class="num">'+r.plan.toFixed(1).replace('.',',')+' → '+r.prog.toFixed(1).replace('.',',')+'</td><td><span class="chip '+k+'">'+(r.ratio==null?'Ainda não começou':Math.round(r.ratio*100)+'% do previsto')+'</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="serv-av" data-id="'+s.id+'" data-write>Lançar avanço</button> <button class="btn sm ghost" data-act="serv-editar" data-id="'+s.id+'" data-write>Editar</button></td></tr>';
  }).join('');
  var leg=svs.map(function(s,i){ return '<span><i style="display:inline-block;width:18px;height:3px;background:var(--s'+((i%5)+1)+');margin-right:6px;vertical-align:middle"></i>'+esc(s.nome)+'</span>'; }).join('');
  return head+chips+cfHtml+'<div class="card" style="overflow-x:auto;padding:8px">'+lobChart(locs,svs)+'</div><div class="legenda" style="margin-top:8px">'+leg+'<span>Tracejado: previsto</span><span>Linha cheia: realizado</span><span>Anel vermelho: localização atrasada</span></div>'
    +'<section class="card" style="margin-top:16px"><div class="card-h"><h2>Ritmo por serviço</h2><span class="small muted">Previsto → realizado, em localizações concluídas até hoje</span></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Serviço</th><th>Concluídas</th><th>Previsto → realizado</th><th>Ritmo</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function lobChart(locs,svs){
  var LW=124, RH=28, TOP=32, RIGHT=16, hj=hoje(), minD=hj, maxD=hj;
  svs.forEach(function(s){ locs.forEach(function(l,k){
    var a=avLoc(s,l.id), st=lobIni(s,k), en=lobFim(s,k);
    if(st<minD) minD=st; if(en>maxD) maxD=en; if(a&&a.ini&&a.ini<minD) minD=a.ini;
  }); });
  var start=addDays(minD,-2), end=addDays(maxD,7), days=diffDays(start,end)+1, dx=Math.max(7,Math.min(16,860/days));
  var W=LW+days*dx+RIGHT, H=TOP+locs.length*RH+18;
  var X=function(d){ return LW+diffDays(start,d)*dx; }, Y=function(k){ return TOP+k*RH+RH/2; };
  var g='';
  locs.forEach(function(l,k){ g+='<line x1="'+LW+'" x2="'+(W-RIGHT)+'" y1="'+(TOP+k*RH)+'" y2="'+(TOP+k*RH)+'" class="lob-grid"/><text x="'+(LW-8)+'" y="'+(Y(k)+4)+'" text-anchor="end" class="lob-t">'+esc(short(l.nome,16))+'</text>'; });
  g+='<line x1="'+LW+'" x2="'+(W-RIGHT)+'" y1="'+(TOP+locs.length*RH)+'" y2="'+(TOP+locs.length*RH)+'" class="lob-grid"/>';
  for(var d=segunda(start); d<=end; d=addDays(d,7)){ if(d<start) continue; g+='<line x1="'+X(d)+'" x2="'+X(d)+'" y1="'+(TOP-6)+'" y2="'+(TOP+locs.length*RH)+'" class="lob-grid"/><text x="'+(X(d)+3)+'" y="'+(TOP-12)+'" class="lob-t">'+fmtC(d)+'</text>'; }
  svs.forEach(function(s,i){
    var col='var(--s'+((i%5)+1)+')', pp=[], rp=[], marks='';
    locs.forEach(function(l,k){
      var st=lobIni(s,k), en=lobFim(s,k), mid=addDays(st,Math.floor((s.diasPorLoc||1)/2)), a=avLoc(s,l.id), p=a?(a.p||0):0;
      pp.push(X(mid)+','+Y(k));
      if(p>0){ var xr=X(a.fim||hj); rp.push(xr+','+Y(k)); marks+='<circle cx="'+xr+'" cy="'+Y(k)+'" r="'+(p>=100?4:3.5)+'" fill="'+(p>=100?col:'var(--surface)')+'" stroke="'+col+'" stroke-width="2"/>'; }
      if(en<hj && p<100) marks+='<circle cx="'+X(mid)+'" cy="'+Y(k)+'" r="7" fill="none" stroke="var(--crit)" stroke-width="2"><title>'+esc(s.nome+' em '+l.nome+': previsto até '+fmtC(en))+'</title></circle>';
    });
    g+='<polyline points="'+pp.join(' ')+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-dasharray="6 4" opacity=".6"/>';
    if(rp.length>1) g+='<polyline points="'+rp.join(' ')+'" fill="none" stroke="'+col+'" stroke-width="3"/>';
    g+=marks;
  });
  g+='<line x1="'+X(hj)+'" x2="'+X(hj)+'" y1="'+(TOP-6)+'" y2="'+(TOP+locs.length*RH)+'" stroke="var(--crit)" stroke-width="2"/><text x="'+X(hj)+'" y="'+(TOP+locs.length*RH+13)+'" text-anchor="middle" class="lob-t" fill="var(--crit)" style="fill:var(--crit)">hoje</text>';
  return '<svg class="lob" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Linha de balanço: previsto e realizado de cada serviço por localização">'+g+'</svg>';
}
function locsForm(oid){
  openForm({title:'Cadastrar localizações', intro:'Uma por linha, na ordem em que a equipe percorre a obra. Ex.: Casa 1, Casa 2… ou Térreo, 1º pavimento, Cobertura.',
    fields:[{name:'lista',label:'Localizações',type:'textarea',required:true,rows:6},{name:'tipo',label:'Tipo',type:'select',options:[['Unidade','Unidade'],['Pavimento','Pavimento'],['Quadra','Quadra'],['Outro','Outro']],value:'Unidade'}],
    submit:'Cadastrar',
    onSubmit:async function(v){
      var nomes=(v.lista||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
      if(!nomes.length) return 'Escreva ao menos uma localização.';
      var ordem=locsDe(oid).reduce(function(m,l){return Math.max(m,l.ordem||0);},0);
      await Promise.all(nomes.map(function(n,i){ return Store.add('locs',{obraId:oid, nome:n, tipo:v.tipo, ordem:ordem+i+1}); }));
    }});
}
function servForm(oid,s){
  var novo=!s, outros=byObra('servicos',oid).filter(function(x){return !s||x.id!==s.id;});
  openForm({title:novo?'Novo serviço na linha de balanço':'Editar serviço',
    intro:'O serviço começa na primeira localização na data de início e segue para as outras no ritmo de dias por localização.',
    fields:[{name:'nome',label:'Serviço',required:true,value:s&&s.nome,ph:'Ex.: Alvenaria'},
      [{name:'inicio',label:'Início na 1ª localização',type:'date',required:true,value:s&&s.inicio},{name:'diasPorLoc',label:'Dias por localização',type:'number',min:1,step:1,required:true,value:s?s.diasPorLoc:5}],
      [{name:'prestadorId',label:'Prestador',type:'select',options:prestOptions('Sem prestador'),value:s&&s.prestadorId},{name:'pred',label:'Vem depois de',type:'select',options:selOpts(outros.map(function(x){return [x.id,x.nome];}),'Nenhum'),value:s&&s.pred}]],
    extra:novo?'':'<button type="button" class="btn danger" data-act="serv-excluir" data-id="'+s.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o serviço.';
      if(!v.inicio) return 'Informe o início.';
      if(!(v.diasPorLoc>=1)) return 'Informe quantos dias o serviço leva em cada localização.';
      await Store.set('servicos', s?s.id:nid(), Object.assign({av:{}, ordem:outros.length+1}, s||{}, {obraId:oid, nome:v.nome.trim(), inicio:v.inicio, diasPorLoc:Math.round(v.diasPorLoc), prestadorId:v.prestadorId||'', pred:v.pred||''}));
    }});
}
function servAvanco(id){
  var s=G('servicos',id), locs=locsDe(s.obraId);
  openForm({title:'Avanço: '+s.nome, intro:'Percentual concluído em cada localização, hoje ('+fmt(hoje())+').',
    fields:locs.map(function(l){ return {name:'p_'+l.id,label:l.nome,type:'number',min:0,max:100,step:1,value:(avLoc(s,l.id)||{p:0}).p||0}; }),
    submit:'Salvar avanço',
    onSubmit:async function(v){
      var av=clone(s.av||{});
      locs.forEach(function(l){
        var p=Math.max(0,Math.min(100,Number(v['p_'+l.id])||0)), a=av[l.id]||{p:0};
        var n={p:p};
        if(a.ini) n.ini=a.ini; if(p>0&&!n.ini) n.ini=hoje();
        if(p>=100) n.fim=a.fim||hoje();
        if(p>0||a.ini) av[l.id]=n; else delete av[l.id];
      });
      await Store.set('servicos', id, Object.assign({}, s, {av:av}));
    }});
}

/* ================= TREINAMENTOS (prestadores) ================= */
function treinamentosHtml(){
  var ts=L('treinamentos').sort(function(a,b){ return (a.validade||'9')<(b.validade||'9')?-1:1; });
  var linhas=ts.length?ts.map(function(t){
    var p=G('prestadores',t.prestadorId), v=validade(t.validade);
    return '<tr><td>'+esc(t.trabalhador||'Equipe')+'<div class="tiny muted">'+esc(p?p.nome:'Prestador removido')+'</div></td><td>'+esc(t.norma)+'</td><td>'+fmt(t.data)+'</td><td><span class="chip '+v.k+'">'+esc(v.t)+'</span></td><td>'+anexosHtml(t.anexos)+'</td><td style="white-space:nowrap"><button class="btn sm" data-act="trein-editar" data-id="'+t.id+'" data-write>Editar</button></td></tr>';
  }).join(''):'<tr><td colspan="6" class="muted" style="padding:16px">Nenhum treinamento registrado.</td></tr>';
  return '<section class="card sec"><div class="card-h"><div><h2>Treinamentos obrigatórios</h2><p class="muted small">Treinamento vencido de um prestador impede lançá-lo no efetivo do diário.</p></div><button class="btn primary sm" data-act="trein-novo" data-write>+ Treinamento</button></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Trabalhador</th><th>Norma ou curso</th><th>Data</th><th>Validade</th><th>Comprovante</th><th></th></tr></thead><tbody>'+linhas+'</tbody></table></div></section>';
}
function treinForm(t){
  var novo=!t;
  openForm({title:novo?'Novo treinamento':'Editar treinamento',
    fields:[{name:'prestadorId',label:'Prestador',type:'select',required:true,options:selOpts(L('prestadores').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');}).map(function(p){return [p.id,p.nome];}),'Selecione…'),value:t&&t.prestadorId},
      {name:'trabalhador',label:'Trabalhador',value:t&&t.trabalhador,ph:'Nome, ou deixe em branco para a equipe toda'},
      [{name:'norma',label:'Norma ou curso',required:true,value:t&&t.norma,ph:'Ex.: NR-18, NR-35'},{name:'data',label:'Data do treinamento',type:'date',required:true,value:t&&t.data}],
      {name:'validade',label:'Validade',type:'date',required:true,value:t&&t.validade},
      {name:'anexos',label:'Comprovante',type:'anexos',value:(t&&t.anexos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="trein-excluir" data-id="'+t.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!v.prestadorId) return 'Escolha o prestador.';
      if(!(v.norma||'').trim()) return 'Informe a norma ou o curso.';
      if(!v.data||!v.validade) return 'Informe a data e a validade.';
      if(v.validade<v.data) return 'A validade não pode ser antes da data do treinamento.';
      await Store.set('treinamentos', t?t.id:nid(), {prestadorId:v.prestadorId, trabalhador:(v.trabalhador||'').trim(), norma:v.norma.trim(), data:v.data, validade:v.validade, anexos:v.anexos||[]});
    }});
}

/* ---------- indicadores extras do resumo ---------- */
function indRowsP2(o){
  var oid=o.id, out='', locs=locsDe(oid), svs=byObra('servicos',oid);
  if(svs.length){
    var r=lobRatioMedio(oid);
    out+=indRow('Ritmo da equipe','Realizado ÷ previsto em cada serviço (média)', r==null?'—':Math.round(r*100)+'%', r==null?'Nenhum serviço começou ainda':plural(svs.length,'serviço','serviços')+' na linha de balanço', r==null?'':(r>=0.95?'ok':(r>=0.75?'warn':'crit')));
  }
  var mes=mesAdd(hoje().slice(0,7),-1), rs=docsMesResumo(oid,mes);
  if(rs.tot) out+=indRow('Documentos do prestador em dia','Prestadores com INSS, FGTS, folha e certidões conferidos', rs.ok+' <span class="small muted">de '+rs.tot+'</span>', 'Competência de '+mesNome(mes), rs.pend?'warn':'ok');
  return out+indRowsP3(o);
}

/* ---------- ações da fase 2 ---------- */
var A2={
  'ag-dia':function(d){ ui.agDia=d.d; render(); },
  'ag-mes':function(d){ var n=Number(d.d); ui.agMes=n===0?hoje().slice(0,7):mesAdd(ui.agMes,n); if(n===0) ui.agDia=hoje(); render(); },
  'ag-area':function(d){ ui.agArea=d.a; render(); },
  'ev-novo':function(d){ eventoForm(d.oid||''); },
  'ev-editar':function(d){ eventoForm('', G('eventos',d.id)); },
  'ev-status':function(d){ Store.patch('eventos', d.id, {status:d.to}); toast(d.to==='realizado'?'Compromisso marcado como realizado.':'Compromisso cancelado.'); },
  'ev-reag':function(d){ reagendarForm(d.id); },
  'ev-excluir':async function(d){ var ok=await confirmDlg('Excluir compromisso?','<p>Se ele foi cancelado, prefira marcar como cancelado para manter o histórico.</p>','Excluir',true); if(ok){ await Store.del('eventos',d.id); } },
  'ata-nova':function(d){ ataForm(d.oid); },
  'ata-editar':function(d){ var t=G('atas',d.id); ataForm(t.obraId,t); },
  'ata-excluir':async function(d){ var ok=await confirmDlg('Excluir ata?','<p>As ações ligadas a ela continuam na lista, sem origem.</p>','Excluir',true); if(ok) await Store.del('atas',d.id); },
  'acao-nova':function(d){ acaoForm(d.oid,null,d.ata||''); },
  'acao-editar':function(d){ var a=G('acoes',d.id); acaoForm(a.obraId,a); },
  'acao-ok':function(d){ Store.patch('acoes', d.id, {status:'concluida', concluidaEm:hoje()}); toast('Ação concluída.'); },
  'acao-contato':function(d){ contatoForm(d.id,'acoes'); },
  'acao-excluir':async function(d){ var ok=await confirmDlg('Excluir ação?','<p>O histórico de contatos também será apagado.</p>','Excluir',true); if(ok) await Store.del('acoes',d.id); },
  'doc-legal':function(d){ docLegalForm(d.oid,d.k); },
  'doc-legal-limpar':async function(d){ var ok=await confirmDlg('Remover o registro?','<p>Número e anexos serão apagados.</p>','Remover',true); if(ok){ await Store.del('docsLegais', d.oid+'_'+d.k); } },
  'doc-prest':function(d){ docPrestForm(d.oid,d.p,d.m,d.k); },
  'docmes':function(d){ ui.docMes[d.oid]=mesAdd(ui.docMes[d.oid]||mesAdd(hoje().slice(0,7),-1), Number(d.d)); render(); },
  'rfi-novo':function(d){ rfiForm(d.oid); },
  'rfi-editar':function(d){ var r=G('rfis',d.id); rfiForm(r.obraId,r); },
  'rfi-resp':function(d){ rfiResposta(d.id); },
  'rfi-excluir':async function(d){ var ok=await confirmDlg('Excluir RFI?','<p>A pergunta e a resposta serão apagadas.</p>','Excluir',true); if(ok) await Store.del('rfis',d.id); },
  'mat-novo':function(d){ matForm(d.oid); },
  'mat-editar':function(d){ var m=G('materiais',d.id); matForm(m.obraId,m); },
  'mat-dec':function(d){ matDecisao(d.id); },
  'mat-excluir':async function(d){ var ok=await confirmDlg('Excluir registro?','<p>O material e a decisão serão apagados.</p>','Excluir',true); if(ok) await Store.del('materiais',d.id); },
  'ent-nova':function(d){ entregaForm(d.oid); },
  'loc-novas':function(d){ locsForm(d.oid); },
  'loc-excluir':async function(d){ var l=G('locs',d.id); var ok=await confirmDlg('Remover “'+l.nome+'”?','<p>O previsto dos serviços é calculado pela ordem das localizações; remover uma muda as datas seguintes.</p>','Remover',true); if(ok) await Store.del('locs',d.id); },
  'serv-novo':function(d){ servForm(d.oid); },
  'serv-editar':function(d){ var s=G('servicos',d.id); servForm(s.obraId,s); },
  'serv-av':function(d){ servAvanco(d.id); },
  'serv-excluir':async function(d){ var ok=await confirmDlg('Excluir serviço?','<p>O avanço lançado nele será perdido.</p>','Excluir',true); if(ok){ await Store.del('servicos',d.id); closeDlg(); } },
  'trein-novo':function(){ treinForm(); },
  'trein-editar':function(d){ treinForm(G('treinamentos',d.id)); },
  'trein-excluir':async function(d){ var ok=await confirmDlg('Excluir treinamento?','<p>O registro e o comprovante serão removidos.</p>','Excluir',true); if(ok){ await Store.del('treinamentos',d.id); closeDlg(); } }
};

