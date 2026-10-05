/* ================= FLUXO GERAL DA OBRA =================
   Mostra as 6 fases e as 22 etapas do protocolo, ligadas por setas, com a porta de liberação de cada etapa.
   Rotas: #/fluxo · #/fluxo/<obra> · #/fluxo/<obra>/<etapa>   (use "-" no lugar da obra para ver só o protocolo).
   Tudo vem do protocolo que o app já usa; com uma obra escolhida, cada etapa mostra a situação dela. */
function fluxoRota(){ var p=(location.hash||'').replace(/^#\/?/,'').split('/'); return {oid:p[1]&&p[1]!=='-'?p[1]:'', n:Number(p[2])||0, sem:p[1]==='-'}; }
function fluxoLink(oid,n){ return '#/fluxo/'+(oid||'-')+(n?'/'+n:''); }
/* ritos de gestão: o que acontece o tempo todo, ao lado das 22 etapas */
function fluxoRitos(o){
  var oid=o?o.id:'', b=o?'#/obra/'+oid+'/':'', ve=gVe(), st={};
  if(o){
    var qp=qzPendentes(o), me=ve?metaEvo(oid):null, pf=pendenciasFim(oid), pd=pedDaObra(oid);
    var feN=byObra('compras',oid).concat(pd).filter(function(x){ return x.foraEscopo&&!foraEscopoOk(x,true)&&x.status!=='recusado'&&x.status!=='cancelado'&&x.status!=='pago'; }).length;
    var venc=ve?pagamentosObra(oid).filter(function(p){ return !p.pago&&p.venc&&p.venc<hoje(); }).length:0;
    st.quinzenal=qp.length?{k:'warn',t:plural(qp.length,'quinzena sem relatório','quinzenas sem relatório')}:{k:'ok',t:'em dia'};
    st.metaevo=me?(me.kpi.nCrit?{k:'crit',t:plural(me.kpi.nCrit,'etapa desalinhada','etapas desalinhadas')}:{k:'ok',t:me.kpi.alinh==null?'sem etapa em andamento':'alinhado'}):null;
    st.pedidos=ve?(pd.filter(function(p){ return pedStatus(p)==='aprovacao'; }).length?{k:'warn',t:plural(pd.filter(function(p){ return pedStatus(p)==='aprovacao'; }).length,'aguardando aprovação','aguardando aprovação')}:{k:'ok',t:'nada pendente'}):null;
    st.fora=feN?{k:'warn',t:plural(feN,'sem aditivo assinado','sem aditivo assinado')}:{k:'ok',t:'nenhum pendente'};
    st.pagprazos=ve?(venc?{k:'crit',t:plural(venc,'pagamento vencido','pagamentos vencidos')}:{k:'ok',t:'sem vencidos'}):null;
    var nf=pf.abertas.length+pf.semConferir.length+pf.locacoes.length+pf.pedidos.length;
    st.fim=fimDeObra(o)?(nf?{k:'warn',t:plural(nf,'pendência','pendências')}:{k:'ok',t:'sem pendências'}):{k:'',t:'ainda não é fim de obra'};
  }
  var R=[['Relatório quinzenal ao cliente','A cada 15 dias, a engenharia emite: texto, posicionamento, fotos e avanço.',o?b+'quinzenal':'','quinzenal'],
    ['Meta × evolução × pagamentos','Toda semana na reunião de compras e medição: o pago acompanha o executado?',o&&ve?b+'metaevo':'','metaevo'],
    ['Pedidos de pagamento e orçamentos','Todo pagamento fora de compra e medição: vários orçamentos, escolha justificada, alçada.',o&&ve?b+'pedidos':'','pedidos'],
    ['Fora do escopo','Aditivo assinado antes de comprar, contratar ou pagar. Emergência: autorização escrita e aditivo em 5 dias.',o?b+'pedidos':'','fora'],
    ['Pagamentos e prazos do mês','Todo mês: o fluxo de pagamento acompanha o que as etapas programaram?',o&&ve?b+'pagprazos':'','pagprazos'],
    ['Final de obra × compras','Na janela de fim de obra: fechar pedidos, entregas, locações e estoque antes de encerrar.',o?b+'encerramento':'','fim']];
  return '<section class="card sec flx-ritos"><div class="card-h"><div><h2>Ritos de gestão</h2><p class="muted small">Acontecem ao longo de todas as etapas e alimentam as portas de liberação.</p></div></div><ul class="alerts">'
    +R.map(function(r){ var s=st[r[3]]; return '<li><span class="dot '+(s?s.k:'')+'"></span><div class="grow"><strong>'+esc(r[0])+'</strong><div class="muted small">'+esc(r[1])+'</div></div>'+(s?'<span class="chip '+s.k+'">'+esc(s.t)+'</span>':'')+(r[2]?' <a class="small" href="'+r[2]+'">Abrir</a>':'')+'</li>'; }).join('')+'</ul></section>';
}
function vFluxo(){
  var r=fluxoRota(), obras=L('obras').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
  if(!r.oid&&!r.sem&&obras.length) r.oid=obras[0].id;
  var o=r.oid?G('obras',r.oid):null; if(r.oid&&!o) r.oid='';
  var crit={}; if(o) byObra('ocorrencias',o.id).forEach(function(x){ if(ocAberta(x)&&x.gravidade==='critica'&&x.etapa) crit[x.etapa]=1; });
  var sel=r.n>=1&&r.n<=22?r.n:0;
  var seletor='<div class="row" style="gap:10px;flex-wrap:wrap"><label class="muted small" for="fluxo-obra">Mostrar a situação da obra:</label><select id="fluxo-obra" data-chg="fluxo-obra" aria-label="Obra"><option value="-"'+(o?'':' selected')+'>Só o protocolo (sem obra)</option>'
    +obras.map(function(x){ return '<option value="'+esc(x.id)+'"'+(o&&o.id===x.id?' selected':'')+'>'+esc(x.nome)+'</option>'; }).join('')+'</select></div>';
  var leg=o?'<div class="flx-leg" aria-label="Legenda">'+STATUS_ORDER.map(function(s){ return '<span><i class="flx-dot '+s+'"></i>'+STATUS[s]+'</span>'; }).join('')+'<span><i class="flx-dot crit"></i>Ocorrência crítica aberta</span></div>':'<p class="muted small">Escolha uma obra para ver em que etapa ela está.</p>';
  var h='<div class="wrap"><div class="sec-h"><div><h1>Fluxo geral</h1><p class="muted" style="margin-top:4px">O caminho de uma obra, da pré-obra ao pós-obra. Cada etapa só é liberada na vistoria (losango).</p></div>'+seletor+'</div>'+leg;
  h+=fluxoRitos(o);
  h+='<div class="flx"><div class="flx-fim ini"><strong>Início</strong><span>A obra abre com terreno regularizado, projetos, orçamento, contrato e licenças</span></div>';
  FASES.forEach(function(f,fi){
    h+='<section class="flx-fase" aria-label="Fase '+(fi+1)+': '+esc(f.nome)+'"><h2><span class="flx-num">'+(fi+1)+'</span>'+esc(f.nome)+'</h2><div class="flx-row">';
    f.etapas.forEach(function(n,i){
      var e=etapaInfo(n), st=o?etapaDoc(o.id,n).status:'', cr=crit[n]?' crit':'', on=sel===n?' sel':'';
      var nf=fichasResumo(o?o.id:'-',n);
      h+=(i?'<span class="flx-seta" aria-hidden="true"></span>':'')+'<a class="flx-no'+(st?' '+st:'')+cr+on+'" href="'+fluxoLink(o?o.id:'',n)+'" aria-current="'+(sel===n?'true':'false')+'" title="'+esc(e.nome+(st?' — '+STATUS[st]:''))+'"><span class="flx-n">'+n+'</span><span class="flx-t">'+esc(e.nome)+'</span>'+(st?'<span class="flx-s">'+STATUS[st]+(cr?' · crítica':'')+'</span>':'')+'</a><span class="flx-porta" title="Vistoria de liberação da etapa '+n+'" aria-hidden="true"></span>';
    });
    h+='</div></section>'+(fi<FASES.length-1?'<div class="flx-liga" aria-hidden="true"></div>':'');
  });
  h+='<div class="flx-fim"><strong>Entrega e pós-obra</strong><span>Entrega, garantias e visitas de 30, 90 e 180 dias</span></div></div>';
  if(sel){
    var e=etapaInfo(sel), ed=o?etapaDoc(o.id,sel):null, fr=o?fichasResumo(o.id,sel):null, it=e.itens||[], vf=e.verif||[];
    h+='<section class="card sec flx-det" id="flx-det"><div class="card-h"><div><h2>Etapa '+sel+' — '+esc(e.nome)+'</h2>'+(ed?'<span class="chip '+({liberada:'ok',aguardando_vistoria:'warn',em_execucao:'steel'}[ed.status]||'')+'">'+STATUS[ed.status]+'</span>':'')+'</div>'+(o?'<a class="btn primary" href="#/obra/'+o.id+'/etapa/'+sel+'">Abrir na obra</a>':'')+'</div><div class="pad">'
      +'<p><strong>Objetivo.</strong> '+esc(e.objetivo||'')+'</p>'
      +'<p class="flx-lib"><span class="flx-losango" aria-hidden="true"></span><span><strong>Só libera quando:</strong> '+esc(e.liberacao||'')+'</span></p>'
      +(o&&gVe()?fluxoMetaEtapa(o.id,sel):'')
      +(fr?'<p class="muted small">Fichas de verificação desta obra: '+fr.aprov+' aprovadas de '+fr.total+(fr.rep?' · '+fr.rep+' reprovada(s)':'')+(fr.pend?' · '+fr.pend+' sem inspeção':'')+'.</p>':'')
      +'<div class="flx-cols"><div><h3>O que se executa ('+it.length+')</h3><ul class="lst">'+it.slice(0,12).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+(it.length>12?'<li class="muted">e mais '+(it.length-12)+' itens</li>':'')+'</ul></div>'
      +'<div><h3>O que se verifica ('+vf.length+')</h3><ul class="lst">'+vf.map(function(x){ return '<li>'+esc(x.item||x)+'</li>'; }).join('')+'</ul></div></div></div></section>';
  }
  return h+'</div>';
}
function fluxoMetaEtapa(oid,n){
  var l=metaEvo(oid).linhas.filter(function(x){ return x.n===n; })[0]; if(!l) return '';
  return '<p class="small"><strong>Meta × evolução × pagamentos:</strong> meta do cronograma '+(l.esp==null?'—':Math.round(l.esp*100)+'%')+' · executado '+Math.round(l.fis*100)+'% · pago '+(l.pagoPct==null?'—':Math.round(l.pagoPct*100)+'%')+' ('+brl(l.pago)+' de '+brl(l.orc)+')'+(l.k?' <span class="chip '+l.k+'">'+(l.k==='crit'?'Desalinhada':'Atenção')+'</span> '+esc(l.mot.join(' ')):'')+'</p>';
}
COBX.vFluxo=vFluxo;
