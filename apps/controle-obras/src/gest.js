/* ================= GESTÃO INTEGRADA =================
   1. Relatório quinzenal ao cliente (tarefa da engenharia, campos, fotos, avanço)
   2. Meta × evolução × pagamentos (por etapa) e seu KPI
   3. Pedidos de pagamento com vários orçamentos (cotações) e aprovação por alçada
   4. Fora do escopo: nada é pedido, contratado ou pago sem aditivo assinado (ou autorização de emergência registrada)
   5. Pagamentos e prazos: o que pagar, prazos de entrega e fluxo do mês × programação da etapa
   6. Final de obra × compras: pendências de suprimentos antes de encerrar
   Regras de negócio ficam aqui; valores em R$ só aparecem para quem vê financeiro (nunca campo nem cliente). */
var AG={};
var ORC_MIN=3;            /* mínimo de orçamentos por pedido; abaixo disso exige justificativa de dispensa */
var TOL_FIN=0.10, TOL_FIS=0.10, AVISO_FIN=0.05;
var PED_ST={orcando:'Em orçamento', aprovacao:'Aguardando aprovação', aprovado:'Aprovado', pago:'Pago', recusado:'Recusado', cancelado:'Cancelado'};
var PED_TIPO={prestador:'Prestador (serviço)', material:'Material', servico:'Serviço avulso', outro:'Outro'};
function gVe(){ return dashVeValores(); }
function pct1(x){ return x==null?'—':(Math.round(x*1000)/10).toString().replace('.',',')+'%'; }

/* ---------- quinzenas ---------- */
function qDe(d){
  var m=String(d).slice(0,7), dia=Number(String(d).slice(8,10));
  return dia<=15?{k:m+'-Q1', n:1, mes:m, ini:m+'-01', fim:m+'-15'}:{k:m+'-Q2', n:2, mes:m, ini:m+'-16', fim:addDays(mesAdd(m,1)+'-01',-1)};
}
function qAnterior(q){ return q.n===2?qDe(q.mes+'-01'):qDe(addDays(q.mes+'-01',-1)); }
function qProxima(q){ return q.n===1?qDe(q.mes+'-16'):qDe(mesAdd(q.mes,1)+'-01'); }
function qNome(q){ return q.n+'ª quinzena de '+mesNome(q.mes); }
function qPrazo(q){ return addDays(q.fim,2); }
function qDaChave(k){ var m=/^(\d{4}-\d{2})-Q([12])$/.exec(k||''); return m?qDe(m[1]+(m[2]==='1'?'-01':'-16')):null; }
function qzDaObra(oid){ return byObra('relatorios',oid).filter(function(r){ return r.tipo==='quinzenal'; }); }
function qzDoPeriodo(oid,k){ return qzDaObra(oid).filter(function(r){ return r.mes===k; }).sort(function(a,b){ return (a.criadoEm||'')<(b.criadoEm||'')?-1:1; }); }
function qzVigente(oid,k){ var l=qzDoPeriodo(oid,k).filter(function(r){ return r.status==='emitido'; }).sort(function(a,b){ return (a.emitidoEm||'')<(b.emitidoEm||'')?1:-1; }); return l[0]||null; }
function qzAtiva(o){ return o.situacao!=='encerrada'; }
/* períodos já encerrados (das duas últimas quinzenas) em que a obra já existia e falta emitir o relatório */
function qzPendentes(o){
  if(!qzAtiva(o)||!o.inicio) return [];
  var q=qAnterior(qDe(hoje())), out=[];
  for(var i=0;i<2;i++){ if(o.inicio<=q.fim && !qzVigente(o.id,q.k)) out.push(q); q=qAnterior(q); }
  return out;
}
function eventosG(o,add,b){
  if(!qzAtiva(o)||!o.inicio) return;
  var q=qDe(hoje());
  if(o.inicio<=q.fim && !qzVigente(o.id,q.k)) add(qPrazo(q),'Relatório quinzenal: '+qNome(q),'engenharia',b+'quinzenal');
  qzPendentes(o).forEach(function(p){ add(qPrazo(p),'Relatório quinzenal: '+qNome(p),'engenharia',b+'quinzenal'); });
  byObra('pedidosPag',o.id).forEach(function(p){
    if(p.emergencia&&p.emergencia.regularizarAte&&!foraEscopoOk(p,true)) add(p.emergencia.regularizarAte,'Regularizar aditivo do pedido nº '+p.numero+' (emergência)','financeiro',b+'pedidos');
  });
  byObra('compras',o.id).forEach(function(c){
    if(c.emergencia&&c.emergencia.regularizarAte&&!foraEscopoOk(c,true)) add(c.emergencia.regularizarAte,'Regularizar aditivo da compra “'+short(c.item,30)+'” (emergência)','suprimentos',b+'compras');
  });
}

/* ================= META × EVOLUÇÃO × PAGAMENTOS ================= */
function metaEvo(oid){
  var cu=custoEtapa(oid), hj=hoje(), linhas=[], por={};
  cu.etapas.forEach(function(x){ por[x.etapa]=x; });
  Object.keys(por).map(Number).filter(function(n){ return n>0; }).sort(function(a,b){ return a-b; }).forEach(function(n){
    var x=por[n], f=fisicoEtapa(oid,n), j=janelaEtapa(oid,n), orc=x.orcado, doc=etapaDoc(oid,n);
    var esp=j?Math.max(0,Math.min(1,(diffDays(j.ini,hj)+1)/j.dias)):null;
    var pagoPct=orc>0?x.pago/orc:null, expPct=orc>0?x.exposicao/orc:null;
    var dFin=(pagoPct!=null)?pagoPct-f.v:null, dFis=(esp!=null&&!f.liberada)?f.v-esp:null, mot=[], k='';
    if(orc>0){
      if(dFin!=null&&dFin>TOL_FIN){ mot.push('Pago '+pct1(pagoPct)+' do orçado para '+pct1(f.v)+' executado: pagando adiante do físico.'); k='crit'; }
      else if(dFin!=null&&dFin>AVISO_FIN){ mot.push('Pagamento '+Math.round(dFin*100)+' pontos adiante do físico.'); k='warn'; }
      if(x.acima){ mot.push('Exposição acima do orçado.'); k='crit'; }
      if(dFis!=null&&dFis<-0.25){ mot.push('Físico '+Math.round(-dFis*100)+' pontos atrás da meta do cronograma.'); k='crit'; }
      else if(dFis!=null&&dFis<-TOL_FIS){ mot.push('Físico '+Math.round(-dFis*100)+' pontos atrás da meta do cronograma.'); if(!k) k='warn'; }
    } else if(x.semOrcamento){ mot.push('Gasto em etapa sem orçamento: fora do escopo?'); k='warn'; }
    var ativa=!f.liberada&&((f.v>0&&f.v<1)||(j&&j.ini<=hj&&hj<=j.fim)||x.pago>0||x.comprometido>0);
    linhas.push({n:n, nome:etapaInfo(n).nome, st:doc.status, orc:orc, ini:j?j.ini:'', fim:j?j.fim:'', esp:esp, fis:f.v, liberada:!!f.liberada, semAtiv:!!f.semAtividades, pago:x.pago, comp:x.comprometido, apr:x.apropriado, exposicao:x.exposicao, pagoPct:pagoPct, expPct:expPct, dFin:dFin, dFis:dFis, k:k, mot:mot, ativa:ativa});
  });
  var at=linhas.filter(function(l){ return l.ativa; }), al=at.filter(function(l){ return !l.k; });
  var ev=0, pago=0, orcT=0, adiante=0, comp=0;
  linhas.forEach(function(l){ if(l.orc>0){ orcT+=l.orc; ev+=l.orc*l.fis; adiante+=Math.max(0,l.pago-l.orc*l.fis); } pago+=l.pago; comp+=l.comp; });
  var ipe=ev>0?pago/ev:null;
  return {linhas:linhas, kpi:{nAtivas:at.length, nAlinhadas:al.length, alinh:at.length?al.length/at.length:null, ipe:ipe, ipeK:ipe==null?'':(ipe<=1.05?'ok':(ipe<=1+TOL_FIN?'warn':'crit')), adiante:r2(adiante), pagoTotal:r2(pago), evTotal:r2(ev), orcTotal:r2(orcT), comprometido:r2(comp), nCrit:linhas.filter(function(l){ return l.k==='crit'; }).length, nWarn:linhas.filter(function(l){ return l.k==='warn'; }).length}};
}
COBX.metaEvo=metaEvo;
function tMetaEvo(o){
  var oid=o.id, m=metaEvo(oid), K=m.kpi, card=function(t,v,sub,k){ return '<div class="card pad"><div class="small muted">'+t+'</div><div class="num" style="font-size:24px;font-weight:600'+(k==='crit'?';color:var(--crit)':(k==='warn'?';color:var(--amber)':''))+'">'+v+'</div><div class="tiny muted">'+sub+'</div></div>'; };
  var head='<div class="sec-h"><div><h2>Meta × evolução × pagamentos</h2><p class="muted small">Para cada etapa: o que o cronograma esperava até hoje (meta), o que foi executado e quanto já saiu de caixa. Pagar adiante do executado é o sinal de alerta.</p></div></div>';
  if(!m.linhas.length) return head+'<div class="card empty"><h3>Sem orçamento por etapa</h3><p>Importe o orçamento (aba Orçamento) e monte o cronograma para comparar meta, evolução e pagamentos.</p></div>';
  var cards='<div class="grid cols3">'
    +card('Etapas alinhadas',K.alinh==null?'—':pct1(K.alinh),K.nAtivas?(K.nAlinhadas+' de '+K.nAtivas+' etapas em andamento sem desvio'):'Nenhuma etapa em andamento', K.alinh==null?'':(K.alinh>=0.8?'ok':(K.alinh>=0.5?'warn':'crit')))
    +card('Pago ÷ executado (IPE)',K.ipe==null?'—':String(Math.round(K.ipe*100)/100).replace('.',','),K.ipe==null?'Sem execução ainda':(K.ipe<=1.05?'Pagamentos acompanham a obra':'Pagando mais do que foi feito'),K.ipeK)
    +card('Pago adiante do executado',brl(K.adiante),'Soma, por etapa, do pago acima do valor executado',K.adiante>0?'warn':'')+'</div>';
  var barra=function(v,k){ return '<div class="hbar" style="grid-template-columns:1fr;padding:0"><div class="t"><i style="width:'+Math.max(0,Math.min(100,(v||0)*100))+'%'+(k==='crit'?';background:var(--crit)':'')+'"></i></div></div>'; };
  var rows=m.linhas.map(function(l){
    return '<tr'+(l.k==='crit'?' style="background:var(--crit-soft)"':'')+'><td><a href="#/etapa/'+oid+'/'+l.n+'">'+l.n+'. '+esc(l.nome)+'</a>'+(l.liberada?' <span class="chip ok">Liberada</span>':'')+(l.semAtiv&&!l.liberada?' <span class="chip warn">sem atividades</span>':'')
      +(l.mot.length?'<div class="tiny muted">'+l.mot.map(esc).join(' ')+'</div>':'')+'</td>'
      +'<td class="num">'+brl(l.orc)+'</td><td>'+(l.esp==null?'—':Math.round(l.esp*100)+'%')+(l.esp==null?'':barra(l.esp))+'</td><td>'+Math.round(l.fis*100)+'%'+barra(l.fis)+'</td>'
      +'<td>'+(l.pagoPct==null?'—':Math.round(l.pagoPct*100)+'%')+(l.pagoPct==null?'':barra(l.pagoPct,l.k))+'</td><td class="num">'+brl(l.pago)+'</td><td class="num">'+brl(l.comp)+'</td>'
      +'<td><span class="chip '+(l.k||(l.ativa?'ok':''))+'">'+(l.k==='crit'?'Desalinhada':(l.k==='warn'?'Atenção':(l.ativa?'Alinhada':'—')))+'</span></td></tr>';
  }).join('');
  var tbl='<section class="card sec"><div class="card-h"><div><h2>Por etapa</h2><p class="muted small">Meta = avanço linear esperado pelo cronograma até hoje. Pago = o que já saiu de caixa (compras, locações, medições e pedidos de pagamento). Alerta quando o pago passa do executado em mais de '+Math.round(TOL_FIN*100)+' pontos ou o físico fica mais de '+Math.round(TOL_FIS*100)+' pontos atrás da meta.</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th class="num">Orçado</th><th>Meta hoje</th><th>Executado</th><th>% pago</th><th class="num">Pago</th><th class="num">Comprometido</th><th>Situação</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  return head+'<div style="margin-top:14px">'+cards+'</div>'+tbl;
}

/* ================= FORA DO ESCOPO ================= */
/* vale para pedidos de pagamento e compras: foraEscopo exige aditivo assinado ou autorização escrita de emergência */
function aditivoDe(r){ return r&&r.aditivoId?G('aditivos',r.aditivoId):null; }
function foraEscopoOk(r,soAditivo){
  if(!r.foraEscopo) return true;
  var a=aditivoDe(r); if(a&&a.status==='assinado') return true;
  return soAditivo?false:!!(r.emergencia&&r.emergencia.ref);
}
function foraEscopoTravas(r){
  var m=[]; if(!r.foraEscopo||foraEscopoOk(r)) return m;
  var a=aditivoDe(r);
  if(!r.aditivoId) m.push('Fora do escopo: vincule o aditivo (ou registre a autorização de emergência do cliente por escrito).');
  else if(!a) m.push('O aditivo vinculado não existe mais. Vincule outro.');
  else m.push('Fora do escopo: o aditivo nº '+a.numero+' está “'+ADT_ST[a.status]+'”. Só segue depois de assinado pelo cliente.');
  return m;
}
function foraEscopoHtml(r,col){
  if(!r.foraEscopo) return '';
  var a=aditivoDe(r), ok=foraEscopoOk(r), em=r.emergencia;
  var base='#/obra/'+r.obraId+'/orcamento';
  return '<div class="callout'+(ok?' ok':' crit')+'" style="margin-top:14px"><strong>Fora do escopo contratado</strong>'
    +'<p class="small">'+(r.motivoFora?esc((TIPOS_OC.filter(function(t){ return t.k===r.motivoFora; })[0]||{n:r.motivoFora}).n)+'. ':'')
    +(a?'Aditivo nº '+a.numero+' — '+esc(ADT_ST[a.status])+(a.status==='assinado'?' (valor '+brl(adtValor(a))+')':''):'Sem aditivo vinculado.')+'</p>'
    +(em?'<p class="small">Autorização de emergência em '+fmt(em.data)+': '+esc(em.motivo||'')+' — registro: '+esc(em.ref)+'. Aditivo deve ser regularizado até <strong>'+fmt(em.regularizarAte)+'</strong>.</p>':'')
    +'<p class="small" style="margin-top:6px"><a href="'+base+'">Abrir aditivos</a></p>'
    +'<div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-act="fe-vincular" data-col="'+col+'" data-id="'+r.id+'" data-write>Vincular aditivo</button>'+(em?'':'<button class="btn sm" data-act="fe-emerg" data-col="'+col+'" data-id="'+r.id+'" data-write>Registrar autorização de emergência</button>')+'</div></div>';
}
function adtOptions(oid){ return selOpts(adtDaObra(oid).filter(function(a){ return a.status!=='recusado'; }).map(function(a){ return [a.id, 'Nº '+a.numero+' — '+short(a.descricao,50)+' ('+ADT_ST[a.status]+')']; }), 'Nenhum'); }
function reabrirRec(col,id){ if(col==='pedidosPag') pedAbrir(id); else openCompra(id); }
Object.assign(AG,{
  'fe-vincular':function(d){
    var r=G(d.col,d.id); if(!r) return;
    if(!adtDaObra(r.obraId).length){ blockDlg('Nenhum aditivo na obra',['Abra a aba Orçamento > Aditivos, crie o aditivo do item fora do escopo e volte aqui para vincular.'],'Sem aditivo'); return; }
    openForm({title:'Vincular aditivo', intro:esc(r.descricao||r.item||''), fields:[{name:'aditivoId',label:'Aditivo',type:'select',required:true,options:adtOptions(r.obraId),value:r.aditivoId||''}], onSubmit:async function(v){
      if(!v.aditivoId) return 'Escolha o aditivo.'; var cur=G(d.col,d.id); await Store.set(d.col, d.id, Object.assign({}, cur, {aditivoId:v.aditivoId})); reabrirRec(d.col,d.id); return false; }});
  },
  'fe-emerg':function(d){
    var r=G(d.col,d.id); if(!r) return;
    openForm({title:'Autorização de emergência', intro:'Use só quando esperar o aditivo causar risco a pessoas ou à obra. O cliente precisa autorizar <strong>por escrito</strong> (e-mail ou mensagem) e o aditivo é regularizado em até 5 dias.',
      fields:[{name:'motivo',label:'Por que não dá para esperar o aditivo',type:'textarea',rows:2,required:true},[{name:'data',label:'Data da autorização',type:'date',required:true,value:hoje()},{name:'ref',label:'Registro (e-mail/mensagem)',required:true,ph:'Ex.: e-mail de 12/03 do cliente'}],{name:'anexos',label:'Print ou arquivo da autorização',type:'anexos',value:[]}],
      submit:'Registrar autorização',
      onSubmit:async function(v){ if(!(v.motivo||'').trim()||!(v.ref||'').trim()) return 'Informe o motivo e o registro da autorização.'; var cur=G(d.col,d.id);
        await Store.set(d.col, d.id, Object.assign({}, cur, {emergencia:{motivo:v.motivo.trim(), data:v.data, ref:v.ref.trim(), anexos:v.anexos||[], regularizarAte:addDays(v.data,5), por:Store.uid||null}})); reabrirRec(d.col,d.id); return false; }});
  }
});

/* ================= PEDIDOS DE PAGAMENTO ================= */
function pedDaObra(oid){ return byObra('pedidosPag',oid).sort(function(a,b){ return (a.numero||0)-(b.numero||0); }); }
function pedOrcs(p){ return p.orcamentos||[]; }
function pedMenor(p){ var l=pedOrcs(p); return l.length?l.reduce(function(m,x){ return x.valor<m.valor?x:m; },l[0]):null; }
function pedEsc(p){ return pedOrcs(p).filter(function(x){ return x.id===p.escolhida; })[0]||null; }
function pedValor(p){ var e=pedEsc(p); if(e) return e.valor; if(p.valorFinal!=null) return p.valorFinal; var m=pedMenor(p); return m?m.valor:0; }
function pedPago(p){ var c=G('contasPagar',contaId('pedido',p.id)); return !!(p.pagoEm||(c&&c.status==='paga')); }
function pedStatus(p){ return (p.status==='aprovado'&&pedPago(p))?'pago':p.status; }
function pedAberto(p){ var s=pedStatus(p); return s==='orcando'||s==='aprovacao'||s==='aprovado'; }
function pedNivel(o,p){ var e=pedEsc(p); return e?nivelCompra(o,e.valor,p.orcado):null; }
function pedTravasEnviar(p){
  var m=[], l=pedOrcs(p), men=pedMenor(p), e=pedEsc(p);
  if(!l.length) m.push('Registre ao menos um orçamento.');
  else if(l.length<ORC_MIN && !(p.dispensa&&p.dispensa.trim())) m.push('Há '+l.length+' orçamento(s); o mínimo é '+ORC_MIN+'. Registre mais orçamentos ou a justificativa de dispensa.');
  if(l.length&&!e) m.push('Escolha um dos orçamentos.');
  if(e&&men&&e.id!==men.id&&!(p.justificativa||'').trim()) m.push('Não escolheu o menor valor: registre a justificativa.');
  return m;
}
function pedTravasAprovar(p){ return foraEscopoTravas(p); }
function nextPedNumero(oid){ return pedDaObra(oid).reduce(function(m,x){ return Math.max(m,x.numero||0); },0)+1; }
function setPed(p,patch,nota){
  var hist=(p.hist||[]);
  if(patch.status&&patch.status!==p.status) hist=hist.concat([{de:p.status, para:patch.status, data:new Date().toISOString(), por:Store.uid||null, nota:nota||''}]).slice(-30);
  var rec=Object.assign({}, p, patch, {hist:hist}); delete rec.id;
  return Store.set('pedidosPag', p.id, rec);
}
function favNome(p){ var e=pedEsc(p); return (e&&e.favorecido)||p.favorecido||'—'; }
function tPedidos(o){
  var oid=o.id, lista=pedDaObra(oid), f=ui.pedFiltro||'abertos';
  var fl={abertos:lista.filter(pedAberto), todos:lista, pagos:lista.filter(function(p){ return pedStatus(p)==='pago'; }), fora:lista.filter(function(p){ return p.foraEscopo; })}[f]||lista;
  var abas=[['abertos','Em andamento'],['pagos','Pagos'],['fora','Fora do escopo'],['todos','Todos']].map(function(x){ return '<button class="btn sm'+(f===x[0]?' primary':'')+'" data-act="ped-filtro" data-f="'+x[0]+'">'+x[1]+'</button>'; }).join('');
  var head='<div class="sec-h"><div><h2>Pedidos de pagamento</h2><p class="muted small">Todo pagamento que não nasce de compra ou medição (serviços avulsos, contratações, despesas) passa por aqui: vários orçamentos, escolha justificada, aprovação por alçada e, se for fora do escopo, aditivo assinado.</p></div><button class="btn primary" data-act="ped-novo" data-oid="'+oid+'" data-write>+ Pedido de pagamento</button></div>';
  var rows=fl.map(function(p){
    var st=pedStatus(p), men=pedMenor(p), n=pedOrcs(p).length;
    return '<tr><td class="num">'+p.numero+'</td><td><button type="button" class="linkbtn" data-act="ped-abrir" data-id="'+p.id+'">'+esc(short(p.descricao,60))+'</button>'+(p.foraEscopo?' <span class="chip '+(foraEscopoOk(p)?'ok':'crit')+'">Fora do escopo</span>':'')+'<div class="tiny muted">'+esc(PED_TIPO[p.tipo]||'')+(p.etapa?' · etapa '+p.etapa:'')+' · '+esc(favNome(p))+'</div></td>'
      +'<td>'+n+(n&&n<ORC_MIN&&!p.dispensa?' <span class="chip warn">menos de '+ORC_MIN+'</span>':'')+'</td><td class="num">'+brl(pedValor(p)||(men&&men.valor))+'</td><td>'+(p.vencimento?fmt(p.vencimento):'—')+'</td><td><span class="chip '+(st==='pago'?'ok':(st==='recusado'||st==='cancelado'?'':'steel'))+'">'+esc(PED_ST[st])+'</span></td></tr>';
  }).join('');
  return head+'<div class="row" style="gap:6px;margin:12px 0">'+abas+'</div>'
    +(fl.length?'<div class="card tbl-scroll"><table class="tbl"><thead><tr><th class="num">Nº</th><th>Pedido</th><th>Orçamentos</th><th class="num">Valor</th><th>Vencimento</th><th>Situação</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      :'<div class="card empty"><h3>Nenhum pedido aqui</h3><p>Registre o pedido, anexe os orçamentos recebidos e envie para aprovação.</p></div>');
}
function pedForm(oid,p){
  var o=G('obras',oid), novo=!p;
  var motivos=selOpts(TIPOS_OC.map(function(t){ return [t.k,t.n]; }),'Selecione…');
  var f=[{name:'descricao',label:'O que será pago',required:true,value:p&&p.descricao,ph:'Ex.: Impermeabilização extra da laje do terraço'},
    [{name:'tipo',label:'Tipo',type:'select',options:Object.keys(PED_TIPO).map(function(k){ return [k,PED_TIPO[k]]; }),value:(p&&p.tipo)||'servico'},{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('—'),value:p&&p.etapa?String(p.etapa):''}],
    [{name:'orcado',label:'Valor orçado/previsto (R$)',type:'number',min:0,step:'0.01',value:p&&p.orcado,hint:'Referência para a alçada. Vazio = sem valor orçado.'},{name:'vencimento',label:'Pagar até',type:'date',value:p&&p.vencimento}],
    [{name:'foraEscopo',label:'Está fora do escopo contratado?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:p&&p.foraEscopo?'sim':'nao'},{name:'motivoFora',label:'Se fora do escopo, por quê?',type:'select',options:motivos,value:(p&&p.motivoFora)||''}],
    {name:'obs',label:'Observações',type:'textarea',rows:2,value:p&&p.obs}];
  openForm({title:novo?'Novo pedido de pagamento':'Editar pedido', wide:true, fields:f, onSubmit:async function(v){
    if(!(v.descricao||'').trim()) return 'Descreva o que será pago.';
    var fora=v.foraEscopo==='sim'; if(fora&&!v.motivoFora) return 'Informe por que está fora do escopo.';
    var rev=orcRevisado(oid), et=v.etapa?Number(v.etapa):0;
    if(!fora&&et&&rev.total>0&&!(rev.porEtapa[et]>0)) return 'A etapa '+et+' não tem orçamento. Se o serviço não estava previsto, marque como fora do escopo.';
    var data=Object.assign({status:'orcando', orcamentos:[], criadoEm:new Date().toISOString(), por:Store.uid||null, numero:novo?nextPedNumero(oid):(p.numero||1)}, p||{}, {obraId:oid, descricao:v.descricao.trim(), tipo:v.tipo, etapa:et, orcado:v.orcado==null?null:v.orcado, vencimento:v.vencimento||'', foraEscopo:fora, motivoFora:fora?v.motivoFora:'', obs:v.obs||''});
    var id=p?p.id:nid(); await Store.set('pedidosPag', id, data);
    pedAbrir(id); return false;
  }});
}
function pedAbrir(id){
  var p=G('pedidosPag',id); if(!p){ closeDlg(); return; }
  var o=G('obras',p.obraId), adm=modAdm(o), st=pedStatus(p), men=pedMenor(p), e=pedEsc(p), nv=pedNivel(o,p), edit=(st==='orcando');
  var l=pedOrcs(p).slice().sort(function(a,b){ return a.valor-b.valor; });
  var orcHtml='<div class="sec-h" style="margin-top:18px"><h3>Orçamentos ('+l.length+(l.length<ORC_MIN&&!p.dispensa?' de '+ORC_MIN+' mínimos':'')+')</h3>'+(edit?'<button class="btn sm" data-act="ped-orc-novo" data-id="'+id+'" data-write>+ Orçamento recebido</button>':'')+'</div>'
    +(l.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Favorecido</th><th class="num">Valor</th><th>Prazo</th><th>Condição</th><th></th></tr></thead><tbody>'+l.map(function(x){
      var best=men&&x.id===men.id, sel=p.escolhida===x.id;
      return '<tr'+(sel?' style="background:var(--steel-soft)"':'')+'><td><strong>'+esc(x.favorecido||'—')+'</strong>'+(best?' <span class="chip ok">Menor valor</span>':'')+(sel?' <span class="chip steel">Escolhido</span>':'')+(x.obs?'<div class="tiny muted">'+esc(x.obs)+'</div>':'')+anexosHtml(x.anexos)+'</td><td class="num">'+brl(x.valor)+'</td><td>'+(x.prazo!=null&&x.prazo!==''?plural(Number(x.prazo),'dia','dias'):'—')+'</td><td>'+esc(x.cond||'—')+'</td><td style="white-space:nowrap">'+(edit?(sel?'':'<button class="btn sm" data-act="ped-orc-esc" data-id="'+id+'" data-oid2="'+x.id+'" data-write>Escolher</button> ')+'<button class="btn sm danger" data-act="ped-orc-rem" data-id="'+id+'" data-oid2="'+x.id+'" data-write>Remover</button>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>'
      +(e&&men&&e.id!==men.id?'<p class="small" style="margin-top:8px"><strong>Justificativa para não escolher o menor valor:</strong> '+esc(p.justificativa||'—')+'</p>':'')
      +(l.length<ORC_MIN&&p.dispensa?'<p class="small" style="margin-top:8px"><strong>Dispensa de orçamentos:</strong> '+esc(p.dispensa)+'</p>':''):'<p class="muted small" style="margin-top:6px">Nenhum orçamento ainda.</p>');
  var apr='';
  if(e){ var tr=pedTravasAprovar(p);
    apr='<div class="callout'+(p.aprov?' ok':(nv&&nv.nivel===3?'':' ok'))+'" style="margin-top:14px"><strong>'+(p.aprov?('Aprovado — nível '+p.aprov.nivel+' em '+fmt(p.aprov.data)+(p.aprov.por==='cliente'?', pelo cliente':', pela Cariati')):('Aprovação necessária: nível '+(nv?nv.nivel:2)+((nv&&nv.nivel===3)||p.foraEscopo?' (cliente, por escrito)':' (Cariati)')))+'</strong>'
      +(nv&&nv.motivos.length?'<ul>'+nv.motivos.map(function(m){ return '<li>'+esc(m)+'</li>'; }).join('')+'</ul>':'')+(p.aprov&&p.aprov.ref?'<p class="small" style="margin-top:6px">Registro: '+esc(p.aprov.ref)+'</p>':'')+anexosHtml(p.aprov&&p.aprov.anexos)+'</div>'; }
  var fim='';
  if(st==='pago') fim='<div class="callout ok" style="margin-top:14px"><strong>Pago em '+fmt(p.pagoEm||((G('contasPagar',contaId('pedido',id))||{}).pagoEm))+'</strong></div>';
  if(st==='recusado') fim='<div class="callout crit" style="margin-top:14px"><strong>Recusado</strong><p class="small">'+esc(p.motivoRecusa||'')+'</p></div>';
  var btns='';
  if(st==='orcando') btns='<button class="btn primary" data-act="ped-enviar" data-id="'+id+'" data-write>Enviar para aprovação</button>';
  if(st==='aprovacao') btns='<button class="btn danger" data-act="ped-recusar" data-id="'+id+'" data-write>Recusar</button><button class="btn primary" data-act="ped-aprovar" data-id="'+id+'" data-write>Aprovar</button>';
  if(st==='aprovado') btns='<button class="btn primary" data-act="ped-pagar" data-id="'+id+'" data-write>Registrar pagamento</button>';
  var hist=(p.hist||[]).slice().reverse().map(function(h){ return '<li>'+fmt(h.data)+': '+esc(PED_ST[h.de]||'—')+' → <strong>'+esc(PED_ST[h.para]||h.para)+'</strong> por '+esc(Names.get(h.por))+(h.nota?' — '+esc(h.nota):'')+'</li>'; }).join('');
  openDlg('<div class="dlg-h"><h2>Pedido nº '+p.numero+' — '+esc(short(p.descricao,60))+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<div class="row" style="margin-bottom:10px"><span class="chip steel">'+esc(PED_ST[st])+'</span><span class="chip">'+esc(PED_TIPO[p.tipo]||'')+'</span>'+(p.etapa?'<span class="chip">Etapa '+p.etapa+'</span>':'')+(p.foraEscopo?'<span class="chip '+(foraEscopoOk(p)?'ok':'crit')+'">Fora do escopo</span>':'')+'</div>'
    +'<dl class="small" style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0"><dt class="muted">Orçado</dt><dd style="margin:0">'+brl(p.orcado)+'</dd><dt class="muted">Pagar até</dt><dd style="margin:0">'+fmt(p.vencimento)+'</dd>'+(p.obs?'<dt class="muted">Observações</dt><dd style="margin:0;white-space:pre-wrap">'+esc(p.obs)+'</dd>':'')+'</dl>'
    +foraEscopoHtml(p,'pedidosPag')+orcHtml+apr+fim+(hist?'<h3 style="margin-top:18px">Histórico</h3><ul class="small" style="padding-left:18px">'+hist+'</ul>':'')
    +'</div><div class="dlg-f">'+(st==='orcando'||st==='recusado'?'<button class="btn danger" data-act="ped-excluir" data-id="'+id+'" data-write style="margin-right:auto">Excluir</button>':(st==='aprovado'?'<button class="btn danger" data-act="ped-cancelar" data-id="'+id+'" data-write style="margin-right:auto">Cancelar pedido</button>':''))
    +(st==='orcando'?'<button class="btn" data-act="ped-editar" data-id="'+id+'" data-write>Editar</button>':'')+btns+'</div>', true);
}
function pedConta(p){
  var o=G('obras',p.obraId); if(!o||!modAdm(o)) return Promise.resolve();
  var e=pedEsc(p), venc=p.vencimento||vencDaCond(e&&e.cond, p.aprov&&p.aprov.data)||'';
  return upsertConta(o,{origem:'pedido', origemId:p.id, descricao:'Pedido de pagamento nº '+p.numero+': '+short(p.descricao,50), credorTipo:'outro', credorId:'', valor:r2(pedValor(p)), retencao:0, desconto:0, vencimento:venc});
}
Object.assign(AG,{
  'ped-filtro':function(d){ ui.pedFiltro=d.f; render(); },
  'ped-novo':function(d){ pedForm(d.oid,null); },
  'ped-abrir':function(d){ pedAbrir(d.id); },
  'ped-editar':function(d){ pedForm(G('pedidosPag',d.id).obraId, G('pedidosPag',d.id)); },
  'ped-orc-novo':function(d){
    var p=G('pedidosPag',d.id);
    openForm({title:'Orçamento recebido', intro:esc(short(p.descricao,80)), fields:[{name:'favorecido',label:'Fornecedor / prestador',required:true,ph:'Nome de quem enviou o orçamento'},
      [{name:'valor',label:'Valor total (R$)',type:'number',min:0,step:'0.01',required:true},{name:'prazo',label:'Prazo de execução/entrega (dias)',type:'number',min:0,step:1}],
      {name:'cond',label:'Condição de pagamento',ph:'Ex.: 50% na entrada e 50% em 30 dias'},{name:'obs',label:'Observações',type:'textarea',rows:2},{name:'anexos',label:'Arquivo do orçamento (foto ou PDF)',type:'anexos',value:[]}],
      onSubmit:async function(v){
        if(!(v.favorecido||'').trim()) return 'Informe quem enviou o orçamento.'; if(!(v.valor>0)) return 'Informe o valor.';
        var cur=G('pedidosPag',d.id), l=pedOrcs(cur).concat([{id:nid(), favorecido:v.favorecido.trim(), valor:r2(v.valor), prazo:v.prazo==null?'':v.prazo, cond:v.cond||'', obs:v.obs||'', anexos:v.anexos||[]}]);
        await Store.set('pedidosPag', d.id, Object.assign({}, cur, {orcamentos:l})); pedAbrir(d.id); return false; }});
  },
  'ped-orc-rem':async function(d){ var p=G('pedidosPag',d.id), l=pedOrcs(p).filter(function(x){ return x.id!==d.oid2; }); await Store.set('pedidosPag', d.id, Object.assign({}, p, {orcamentos:l, escolhida:p.escolhida===d.oid2?'':p.escolhida})); pedAbrir(d.id); },
  'ped-orc-esc':function(d){
    var p=G('pedidosPag',d.id), men=pedMenor(p), x=pedOrcs(p).filter(function(y){ return y.id===d.oid2; })[0];
    var grava=async function(just){ var cur=G('pedidosPag',d.id); await Store.set('pedidosPag', d.id, Object.assign({}, cur, {escolhida:d.oid2, justificativa:just||''})); pedAbrir(d.id); return false; };
    if(men&&x&&x.id!==men.id) openForm({title:'Não é o menor valor', intro:'O menor valor é '+brl(men.valor)+' ('+esc(men.favorecido)+'). Justifique a escolha de '+esc(x.favorecido)+' ('+brl(x.valor)+').', fields:[{name:'j',label:'Justificativa',type:'textarea',rows:3,required:true,hint:'Ex.: prazo, garantia, qualidade comprovada, escopo mais completo.'}], submit:'Escolher este orçamento', onSubmit:async function(v){ if(!(v.j||'').trim()) return 'Informe a justificativa.'; return grava(v.j.trim()); }});
    else grava('');
  },
  'ped-enviar':function(d){
    var p=G('pedidosPag',d.id), l=pedOrcs(p), tr=pedTravasEnviar(p);
    var ir=async function(){ await setPed(p,{status:'aprovacao'},'Enviado para aprovação'); pedAbrir(d.id); return false; };
    if(tr.length && l.length<ORC_MIN && l.length>0 && !(p.dispensa||'').trim() && tr.every(function(m){ return /mínimo/.test(m); })){
      openForm({title:'Menos de '+ORC_MIN+' orçamentos', intro:'Registre por que não há '+ORC_MIN+' orçamentos (ex.: fornecedor único, urgência, serviço especializado).', fields:[{name:'dispensa',label:'Justificativa de dispensa',type:'textarea',rows:3,required:true}], submit:'Registrar e enviar',
        onSubmit:async function(v){ if(!(v.dispensa||'').trim()) return 'Informe a justificativa.'; var cur=G('pedidosPag',d.id); await Store.set('pedidosPag', d.id, Object.assign({}, cur, {dispensa:v.dispensa.trim()})); var again=pedTravasEnviar(G('pedidosPag',d.id)); if(again.length) return again[0]; return ir(); }});
      return;
    }
    if(tr.length){ blockDlg('Não dá para enviar para aprovação',tr,'Antes de enviar:'); return; }
    ir();
  },
  'ped-aprovar':function(d){
    var p=G('pedidosPag',d.id), o=G('obras',p.obraId), nv=pedNivel(o,p), tr=pedTravasAprovar(p);
    if(tr.length){ blockDlg('Não dá para aprovar',tr,'Antes de aprovar:'); return; }
    var cliente=(nv&&nv.nivel===3)||p.foraEscopo;
    openForm({title:cliente?'Aprovação do cliente por escrito':'Aprovar pedido', intro:cliente?'<strong>Fora do orçado, acima da alçada ou fora do escopo:</strong> registre como o cliente aprovou.':'Dentro do orçado e da alçada: aprovação da Cariati.',
      fields:cliente?[[{name:'data',label:'Data da aprovação',type:'date',required:true,value:hoje()},{name:'ref',label:'Registro (e-mail/mensagem)',required:true}],{name:'anexos',label:'Print ou arquivo da aprovação',type:'anexos',value:[]}]:[{name:'data',label:'Data da aprovação',type:'date',required:true,value:hoje()}],
      submit:'Aprovar',
      onSubmit:async function(v){
        if(cliente&&!(v.ref||'').trim()) return 'Informe o registro da aprovação do cliente.';
        var cur=G('pedidosPag',d.id);
        await setPed(cur,{status:'aprovado', valorFinal:r2(pedValor(cur)), aprov:{nivel:cliente?3:2, por:cliente?'cliente':'cariati', data:v.data, ref:(v.ref||'').trim(), anexos:v.anexos||[], uid:Store.uid||null}},'Aprovado');
        await pedConta(G('pedidosPag',d.id)); pedAbrir(d.id); return false; }});
  },
  'ped-recusar':function(d){ var p=G('pedidosPag',d.id); openForm({title:'Recusar pedido', fields:[{name:'m',label:'Motivo',type:'textarea',rows:2,required:true}], submit:'Recusar', onSubmit:async function(v){ if(!(v.m||'').trim()) return 'Informe o motivo.'; await setPed(p,{status:'recusado', motivoRecusa:v.m.trim()},'Recusado'); pedAbrir(d.id); return false; }}); },
  'ped-cancelar':async function(d){ var p=G('pedidosPag',d.id), ok=await confirmDlg('Cancelar o pedido?','<p>A conta a pagar gerada também é cancelada. O registro fica no histórico.</p>','Cancelar pedido',true); if(!ok) return;
    var c=G('contasPagar',contaId('pedido',d.id)); if(c&&c.status==='aberta'){ var upd=Object.assign({}, c, {status:'cancelada', motivoCancelamento:'Pedido cancelado'}); delete upd.id; await Store.set('contasPagar', c.id, upd); }
    await setPed(p,{status:'cancelado'},'Cancelado'); pedAbrir(d.id); },
  'ped-pagar':function(d){
    var p=G('pedidosPag',d.id); openForm({title:'Registrar pagamento', fields:[[{name:'data',label:'Data do pagamento',type:'date',required:true,value:hoje()},{name:'forma',label:'Forma',type:'select',options:FORMAS_PAG.map(function(f){ return [f,f]; }),value:'Pix'}]], submit:'Registrar',
      onSubmit:async function(v){ if(!v.data) return 'Informe a data.'; await baixarConta('pedido',d.id,v.data); await Store.set('pedidosPag', d.id, Object.assign({}, G('pedidosPag',d.id), {pagoEm:v.data, formaPag:v.forma||''})); pedAbrir(d.id); return false; }});
  },
  'ped-excluir':async function(d){ var ok=await confirmDlg('Excluir o pedido?','<p>Só pedidos em orçamento ou recusados podem ser excluídos.</p>','Excluir',true); if(ok){ await Store.del('pedidosPag',d.id); closeDlg(); } }
});

/* ================= PAGAMENTOS E PRAZOS ================= */
function contaEtapa(c){
  if(c.origem==='compra'){ var x=G('compras',c.origemId); return (x&&x.etapa)||0; }
  if(c.origem==='locacao'){ var l=G('locacoes',c.origemId); return (l&&l.etapa)||0; }
  if(c.origem==='pedido'){ var p=G('pedidosPag',c.origemId); return (p&&p.etapa)||0; }
  if(c.origem==='medicao'){ var m=G('medicoes',c.origemId), pe={}; if(!m) return 0; (m.itens||[]).forEach(function(i){ pe[i.etapa||0]=(pe[i.etapa||0]||0)+(Number(i.qtdMedida)||0)*i.precoUnitario; }); var best=0,bv=-1; Object.keys(pe).forEach(function(k){ if(pe[k]>bv){ bv=pe[k]; best=Number(k); } }); return best; }
  return 0;
}
/* tudo que ainda vai sair de caixa (ou saiu), por data */
function pagamentosObra(oid){
  var o=G('obras',oid), adm=modAdm(o), out=[], link='#/obra/'+oid+'/';
  if(adm) byObra('contasPagar',oid).filter(function(c){ return c.status==='aberta'||c.status==='paga'; }).forEach(function(c){
    out.push({id:c.id, desc:c.descricao, valor:c.valor, data:c.status==='paga'?c.pagoEm:c.vencimento, venc:c.vencimento||'', pago:c.status==='paga', etapa:contaEtapa(c), origem:CONTA_ORIGEM[c.origem]||c.origem, to:link+'financeiro'});
  });
  else {
    byObra('medicoes',oid).filter(function(m){ return m.status==='aprovada'||m.status==='em_analise'||m.status==='paga'; }).forEach(function(m){
      out.push({id:m.id, desc:'Medição nº '+m.numero+' — '+(prestNome(m.prestadorId)||''), valor:m.valorLiquido!=null?m.valorLiquido:medCalc(m,o).liquido, data:m.periodoFim, venc:m.periodoFim||'', pago:m.status==='paga', etapa:contaEtapa({origem:'medicao',origemId:m.id}), origem:'Medição'+(m.status==='em_analise'?' (a aprovar)':''), to:link+'medicao'});
    });
    pedDaObra(oid).filter(function(p){ return pedStatus(p)==='aprovado'||pedStatus(p)==='pago'; }).forEach(function(p){
      out.push({id:p.id, desc:'Pedido de pagamento nº '+p.numero+': '+short(p.descricao,50), valor:pedValor(p), data:pedPago(p)?p.pagoEm:p.vencimento, venc:p.vencimento||'', pago:pedPago(p), etapa:p.etapa||0, origem:'Pedido de pagamento', to:link+'pedidos'});
    });
  }
  return out.sort(function(a,b){ return (a.data||'9')<(b.data||'9')?-1:1; });
}
function prazosObra(oid){
  var hj=hoje(), out=[], link='#/obra/'+oid+'/';
  byObra('compras',oid).forEach(function(c){
    if(c.status==='pedido'&&c.pedido&&c.pedido.entregaPrevista){
      var tarde=c.dataUso&&c.pedido.entregaPrevista>c.dataUso;
      out.push({data:c.pedido.entregaPrevista, quem:fornNome(c.pedido.fornecedorId)||'Fornecedor', o:'Entrega: '+c.item, etapa:c.etapa||0, atras:c.pedido.entregaPrevista<hj, risco:tarde?'Chega depois do uso na obra ('+fmt(c.dataUso)+')':'', to:link+'compras', tipo:'Material'});
    } else if(['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0){
      var lim=limiteCompra(c); if(lim) out.push({data:lim, quem:'—', o:'Pedir até: '+c.item, etapa:c.etapa||0, atras:lim<hj, risco:'', to:link+'compras', tipo:'Pedido a emitir'});
    }
  });
  byObra('locacoes',oid).filter(function(l){ return l.status==='ativa'||l.status==='prevista'; }).forEach(function(l){
    var dt=l.status==='prevista'?l.inicio:l.fimPrevisto; if(dt) out.push({data:dt, quem:fornNome(l.fornecedorId)||'Fornecedor', o:(l.status==='prevista'?'Início da locação: ':'Devolução: ')+l.equipamento, etapa:l.etapa||0, atras:dt<hj, risco:'', to:link+'locacoes', tipo:'Locação'});
  });
  byObra('atividades',oid).filter(function(a){ return (a.avanco||0)<100&&a.prestadorId; }).forEach(function(a){
    out.push({data:a.fim, quem:prestNome(a.prestadorId)||'Prestador', o:'Fim previsto: '+a.nome+' ('+(a.avanco||0)+'%)', etapa:a.etapa||0, atras:atAtrasada(a), risco:'', to:link+'cronograma', tipo:'Prestador'});
  });
  pedDaObra(oid).filter(function(p){ return pedStatus(p)==='aprovado'&&!pedPago(p)&&pedEsc(p)&&pedEsc(p).prazo!==''&&pedEsc(p).prazo!=null&&p.aprov; }).forEach(function(p){
    var dt=addDays(p.aprov.data,Number(pedEsc(p).prazo)||0); out.push({data:dt, quem:favNome(p), o:'Prazo do pedido nº '+p.numero+': '+short(p.descricao,40), etapa:p.etapa||0, atras:dt<hj, risco:'', to:link+'pedidos', tipo:'Pedido de pagamento'});
  });
  return out.sort(function(a,b){ return (a.data||'9')<(b.data||'9')?-1:1; });
}
/* fluxo de pagamento do mês × o que a etapa programou para o mês */
function fluxoMes(oid,mes){
  var rev=orcRevisado(oid), ini=mes+'-01', fim=addDays(mesAdd(mes,1)+'-01',-1), E={}, pags=pagamentosObra(oid);
  var at=function(n){ return E[n]||(E[n]={n:n, orc:0, prog:false, dias:0, plan:0, prev:0, pago:0}); };
  Object.keys(rev.porEtapa).forEach(function(k){
    var n=Number(k), orc=rev.porEtapa[k]; if(!n||!(orc>0)) return; var j=janelaEtapa(oid,n); if(!j) return;
    var a=j.ini>ini?j.ini:ini, b=j.fim<fim?j.fim:fim, d=diffDays(a,b)+1, x=at(n); x.orc=orc;
    if(d>0){ x.prog=true; x.dias=d; x.plan=r2(orc*d/j.dias); }
  });
  pags.forEach(function(p){ if(!p.data||String(p.data).slice(0,7)!==mes) return; var x=at(p.etapa||0); if(p.pago) x.pago=r2(x.pago+p.valor); else x.prev=r2(x.prev+p.valor); });
  var linhas=Object.keys(E).map(Number).sort(function(a,b){ return (a||99)-(b||99); }).map(function(n){
    var x=E[n]; x.semProg=!x.prog&&(x.prev+x.pago)>0; x.semPag=x.prog&&x.plan>0&&(x.prev+x.pago)===0; return x; }).filter(function(x){ return x.prog||x.prev||x.pago; });
  var tot={plan:0, prev:0, pago:0}; linhas.forEach(function(x){ tot.plan=r2(tot.plan+x.plan); tot.prev=r2(tot.prev+x.prev); tot.pago=r2(tot.pago+x.pago); });
  return {linhas:linhas, tot:tot, mes:mes};
}
COBX.fluxoMes=fluxoMes; COBX.pagamentosObra=pagamentosObra; COBX.prazosObra=prazosObra;
function tPagPrazos(o){
  var oid=o.id, hj=hoje(), mes=ui.ppMes||hj.slice(0,7), pg=pagamentosObra(oid), abertos=pg.filter(function(p){ return !p.pago; });
  var soma=function(l){ return r2(l.reduce(function(s,x){ return s+x.valor; },0)); };
  var venc=abertos.filter(function(p){ return p.venc&&p.venc<hj; }), prox7=abertos.filter(function(p){ return p.venc&&p.venc>=hj&&p.venc<=addDays(hj,7); }), prox30=abertos.filter(function(p){ return p.venc&&p.venc>=hj&&p.venc<=addDays(hj,30); });
  var card=function(t,v,sub,k){ return '<div class="card pad"><div class="small muted">'+t+'</div><div class="num" style="font-size:24px;font-weight:600'+(k==='crit'?';color:var(--crit)':'')+'">'+v+'</div><div class="tiny muted">'+sub+'</div></div>'; };
  var cards='<div class="grid cols3">'+card('Vencidos',brl(soma(venc)),plural(venc.length,'pagamento','pagamentos'),venc.length?'crit':'')+card('Próximos 7 dias',brl(soma(prox7)),plural(prox7.length,'pagamento','pagamentos'),'')+card('Próximos 30 dias',brl(soma(prox30)),plural(prox30.length,'pagamento','pagamentos'),'')+'</div>';
  var lista=abertos.slice(0,40), nSem=abertos.filter(function(p){ return !p.venc; }).length;
  var tPag='<section class="card sec"><div class="card-h"><div><h2>Pagamentos a fazer</h2><p class="muted small">'+(modAdm(o)?'Contas a pagar em aberto (compras, locações, medições e pedidos de pagamento).':'Medições e pedidos que o cliente precisa pagar.')+(nSem?' '+plural(nSem,'item sem data','itens sem data')+': preencha o vencimento.':'')+'</p></div></div>'
    +(lista.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Vence</th><th>Pagamento</th><th>Etapa</th><th>Origem</th><th class="num">Valor</th></tr></thead><tbody>'+lista.map(function(p){ var v=p.venc&&p.venc<hj; return '<tr'+(v?' style="background:var(--crit-soft)"':'')+'><td>'+(p.venc?fmt(p.venc):'<span class="chip warn">sem data</span>')+(v?' <span class="chip crit">vencido</span>':'')+'</td><td><a href="'+p.to+'">'+esc(short(p.desc,70))+'</a></td><td>'+(p.etapa?p.etapa+'. '+esc(etapaInfo(p.etapa).nome):'—')+'</td><td>'+esc(p.origem)+'</td><td class="num">'+brl(p.valor)+'</td></tr>'; }).join('')+'</tbody></table></div>':'<div class="card empty"><p>Nenhum pagamento em aberto.</p></div>')+'</section>';
  var pz=prazosObra(oid).filter(function(x){ return x.data; }), pzAt=pz.filter(function(x){ return x.atras; });
  var tPraz='<section class="card sec"><div class="card-h"><div><h2>Prazos de entrega e de prestadores</h2><p class="muted small">'+(pzAt.length?plural(pzAt.length,'prazo vencido','prazos vencidos')+'. Cobrar antes que atrase a etapa.':'Entregas de material, locações, atividades dos prestadores e pedidos em andamento.')+'</p></div></div>'
    +(pz.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Data</th><th>O quê</th><th>Quem</th><th>Etapa</th><th>Tipo</th></tr></thead><tbody>'+pz.slice(0,50).map(function(x){ return '<tr'+(x.atras?' style="background:var(--crit-soft)"':'')+'><td>'+fmt(x.data)+(x.atras?' <span class="chip crit">atrasado</span>':'')+'</td><td><a href="'+x.to+'">'+esc(short(x.o,70))+'</a>'+(x.risco?'<div class="tiny" style="color:var(--crit)">'+esc(x.risco)+'</div>':'')+'</td><td>'+esc(x.quem)+'</td><td>'+(x.etapa?x.etapa+'. '+esc(etapaInfo(x.etapa).nome):'—')+'</td><td>'+esc(x.tipo)+'</td></tr>'; }).join('')+'</tbody></table></div>':'<div class="card empty"><p>Nenhum prazo registrado.</p></div>')+'</section>';
  var fm=fluxoMes(oid,mes), diff=r2(fm.tot.prev+fm.tot.pago-fm.tot.plan);
  var linhas=fm.linhas.map(function(x){
    return '<tr'+(x.semProg?' style="background:var(--crit-soft)"':'')+'><td>'+(x.n?x.n+'. '+esc(etapaInfo(x.n).nome):'Sem etapa')+(x.semProg?' <span class="chip crit">pagamento sem programação</span>':'')+(x.semPag?' <span class="chip warn">sem pagamento previsto</span>':'')+'</td><td>'+(x.prog?plural(x.dias,'dia','dias'):'—')+'</td><td class="num">'+(x.prog?brl(x.plan):'—')+'</td><td class="num">'+brl(x.prev)+'</td><td class="num">'+brl(x.pago)+'</td></tr>'; }).join('');
  var graf=fm.linhas.length>1?svgGrafico({titulo:'Programado × a pagar × pago no mês, por etapa', labels:fm.linhas.map(function(x){ return x.n?String(x.n):'—'; }), barras:[{nome:'Programado pela etapa',cor:'var(--steel)',opaco:true,v:fm.linhas.map(function(x){ return x.plan; })},{nome:'A pagar',cor:'var(--amber-bar)',v:fm.linhas.map(function(x){ return x.prev; })},{nome:'Pago',cor:'var(--ok)',v:fm.linhas.map(function(x){ return x.pago; })}], fmt:kfmt}):'';
  var tFlx='<section class="card sec"><div class="card-h"><div><h2>Fluxo de pagamento do mês × programação das etapas</h2><p class="muted small">“Programado” é a parte do orçado de cada etapa que o cronograma coloca neste mês. Pagamento em etapa que não está programada, ou etapa programada sem pagamento previsto, pede conferência.</p></div><label class="small muted">Mês <input type="month" data-chg="pp-mes" value="'+mes+'" aria-label="Mês do fluxo" style="padding:6px;border:1px solid var(--line);border-radius:6px"></label></div>'
    +(fm.linhas.length?'<div style="padding:0 16px">'+graf+'</div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th>Programada</th><th class="num">Programado (orçado)</th><th class="num">A pagar</th><th class="num">Pago</th></tr></thead><tbody>'+linhas+'<tr style="font-weight:600"><td>Total</td><td></td><td class="num">'+brl(fm.tot.plan)+'</td><td class="num">'+brl(fm.tot.prev)+'</td><td class="num">'+brl(fm.tot.pago)+'</td></tr></tbody></table></div><p class="small muted" style="padding:10px 16px">Saída do mês (a pagar + pago) '+(diff>0?'<strong>'+brl(diff)+' acima</strong> do programado.':(diff<0?brl(-diff)+' abaixo do programado.':'igual ao programado.'))+'</p>':'<div class="card empty"><p>Sem etapa programada nem pagamento previsto em '+mesNome(mes)+'.</p></div>')+'</section>';
  return '<div class="sec-h"><div><h2>Pagamentos e prazos</h2><p class="muted small">O que vai sair de caixa, quando os prestadores e fornecedores entregam, e se o pagamento do mês acompanha a programação da obra.</p></div></div><div style="margin-top:14px">'+cards+'</div>'+tPag+tPraz+tFlx;
}
document.addEventListener('change', function(e){ var el=e.target.closest('[data-chg="pp-mes"]'); if(el&&el.value){ ui.ppMes=el.value; render(); } });

/* ================= FINAL DE OBRA × COMPRAS ================= */
function pendenciasFim(oid){
  var cs=byObra('compras',oid), r={};
  r.abertas=cs.filter(function(c){ return ['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0; });
  r.semConferir=cs.filter(function(c){ return c.status==='pedido'||c.status==='entregue'; });
  r.locacoes=byObra('locacoes',oid).filter(function(l){ return l.status==='ativa'||l.status==='prevista'; });
  r.pedidos=pedDaObra(oid).filter(pedAberto);
  r.foraEscopo=cs.concat(pedDaObra(oid)).filter(function(x){ return x.foraEscopo&&!foraEscopoOk(x,true)&&x.status!=='recusado'&&x.status!=='cancelado'; });
  return r;
}
function itensEncerG(o,add){
  var oid=o.id, base='#/obra/'+oid+'/', p=pendenciasFim(oid);
  add('compras','Compras e pedidos de suprimentos fechados', !p.abertas.length&&!p.semConferir.length, (p.abertas.length||p.semConferir.length)?[p.abertas.length?plural(p.abertas.length,'necessidade sem pedido','necessidades sem pedido'):'', p.semConferir.length?plural(p.semConferir.length,'pedido sem conferência de recebimento','pedidos sem conferência de recebimento'):''].filter(Boolean).join('; ')+'.':'Tudo conferido.', base+'compras', byObra('compras',oid).length>0);
  add('locacoes','Locações devolvidas', !p.locacoes.length, p.locacoes.length?plural(p.locacoes.length,'locação ainda ativa ou prevista','locações ainda ativas ou previstas')+'.':'Todas devolvidas.', base+'locacoes', byObra('locacoes',oid).length>0);
  add('pedidosPag','Pedidos de pagamento resolvidos', !p.pedidos.length, p.pedidos.length?plural(p.pedidos.length,'pedido em andamento','pedidos em andamento')+'.':'Nenhum em andamento.', base+'pedidos', pedDaObra(oid).length>0);
  add('foraEscopo','Itens fora do escopo com aditivo assinado', !p.foraEscopo.length, p.foraEscopo.length?plural(p.foraEscopo.length,'item sem aditivo assinado','itens sem aditivo assinado')+'.':'Todos regularizados.', base+'orcamento', temForaEscopo(oid));
}
function temForaEscopo(oid){ return byObra('compras',oid).concat(pedDaObra(oid)).some(function(x){ return x.foraEscopo; }); }
/* janela de fim de obra: etapa 21 (pré-entrega) começou ou a última atividade termina em até 30 dias */
function fimDeObra(o){
  var ats=byObra('atividades',o.id), fim=''; ats.forEach(function(a){ if(a.fim>fim) fim=a.fim; });
  var e21=etapaDoc(o.id,21).status; if(e21&&e21!=='nao_iniciada') return true;
  return !!fim&&diffDays(hoje(),fim)<=30&&diffDays(hoje(),fim)>=-60&&qzAtiva(o);
}
function encerComprasHtml(o){
  var oid=o.id, p=pendenciasFim(oid), base='#/obra/'+oid+'/', fim=fimDeObra(o);
  var linha=function(t,l,to,f){ return l.length?'<tr><td><a href="'+to+'">'+t+'</a></td><td class="num">'+l.length+'</td><td class="small">'+l.slice(0,4).map(function(x){ return esc(short(f(x),40)); }).join('; ')+(l.length>4?'…':'')+'</td></tr>':''; };
  var rows=linha('Necessidades sem pedido',p.abertas,base+'compras',function(c){ return c.item; })+linha('Pedidos sem conferência',p.semConferir,base+'compras',function(c){ return c.item; })+linha('Locações ativas ou previstas',p.locacoes,base+'locacoes',function(l){ return l.equipamento; })+linha('Pedidos de pagamento em andamento',p.pedidos,base+'pedidos',function(x){ return 'nº '+x.numero+' '+x.descricao; })+linha('Fora do escopo sem aditivo assinado',p.foraEscopo,base+'orcamento',function(x){ return x.descricao||x.item; });
  return '<section class="card sec"><div class="card-h"><div><h2>Alinhamento final com compras</h2><p class="muted small">'+(fim?'A obra está na janela de fim de obra: reúna compras e engenharia e feche o que sobrou. ':'')+'Nada de pedido novo sem destino: o que for comprado agora precisa ser consumido ou devolvido até a entrega.</p></div></div>'
    +(rows?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Pendência</th><th class="num">Qtd</th><th>Itens</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="small" style="padding:14px">Nenhuma pendência de suprimentos.</p>')+'</section>';
}

/* ================= RELATÓRIO QUINZENAL ================= */
function quinzDados(o,q){
  var oid=o.id, ev=evm(o), me=metaEvo(oid), noPer=function(x){ var d=String(x||'').slice(0,10); return d>=q.ini&&d<=q.fim; };
  var d={k:q.k, ini:q.ini, fim:q.fim, geradoEm:new Date().toISOString(), adm:modAdm(o)};
  d.capa={obra:o.nome, codigo:o.codigo||'', cliente:o.cliente||'', endereco:o.endereco||'', modalidade:o.modalidade, empresa:empresaNome(o.empresaId)||''};
  d.avanco={cronograma:avancoCron(oid), fisico:ev.fisPct, liberadas:ETAPAS.filter(function(e){ var x=etapaDoc(oid,e.n); return x.status==='liberada'&&noPer(x.liberadaEm); }).map(function(e){ return {n:e.n, nome:e.nome}; }),
    andamento:me.linhas.filter(function(l){ return l.ativa; }).map(function(l){ return {n:l.n, nome:l.nome, meta:l.esp, fis:l.fis, k:l.k}; })};
  /* percentuais apenas: o cliente vê o relatório; valores em R$ ficam no relatório mensal */
  d.alinhamento={alinh:me.kpi.alinh, nAtivas:me.kpi.nAtivas, nAlinhadas:me.kpi.nAlinhadas, atencao:me.linhas.filter(function(l){ return l.k&&l.ativa; }).map(function(l){ return {n:l.n, nome:l.nome, mot:l.mot[0]||''}; })};
  var ocs=byObra('ocorrencias',oid);
  d.qualidade={abertas:ocs.filter(ocAberta).length, criticas:ocs.filter(function(x){ return ocAberta(x)&&x.gravidade==='critica'; }).length, abertasPer:ocs.filter(function(x){ return noPer(x.criadoEm); }).length, fechadasPer:ocs.filter(function(x){ return noPer(x.fechadaEm); }).length};
  var tot=0, ok=0; for(var w=segunda(q.ini); w<=q.fim; w=addDays(w,7)){ if(addDays(w,6)<q.ini) continue; var si=semanaInfo(oid,w); tot+=si.tot; ok+=si.ok; }
  d.planejamento={ppc:tot?ok/tot:null, pacotes:tot, concluidos:ok, meta:o.metaPPC==null?80:o.metaPPC};
  d.pendencias=adtDaObra(oid).filter(function(a){ return a.status==='aguardando_cliente'; }).map(function(a){ return {tipo:'Aditivo nº '+a.numero, descricao:short(a.descricao,80), valor:adtValor(a)}; })
    .concat(byObra('materiais',oid).filter(function(m){ return m.resultado==='pendente'&&m.nivel3; }).map(function(m){ return {tipo:'Escolha de material', descricao:m.item, prazo:m.prazo}; }))
    .concat(pedDaObra(oid).filter(function(p){ return pedStatus(p)==='aprovacao'&&((pedNivel(o,p)&&pedNivel(o,p).nivel===3)||p.foraEscopo); }).map(function(p){ return {tipo:'Pedido fora do orçado ou do escopo', descricao:short(p.descricao,80), valor:pedValor(p)}; }));
  d.proximos=eventosAuto(oid).filter(function(e){ return e.data>=hoje()&&e.data<=addDays(hoje(),15)&&e.status==='agendado'&&e.area!=='financeiro'; }).sort(function(a,b){ return a.data<b.data?-1:1; }).slice(0,15).map(function(e){ return {data:e.data, titulo:e.titulo}; });
  return d;
}
COBX.quinzDados=quinzDados;
function quinzHtml(o,rel){
  var d=rel.snapshot||rel.dados, q=qDaChave(rel.mes)||qDe(hoje());
  var sec=function(n,t,b){ return '<section class="card sec pad rel-sec"><h2 style="margin-bottom:8px">'+n+'. '+t+'</h2>'+b+'</section>'; };
  var lista=function(a,f,vazio){ return a.length?'<ul class="small" style="padding-left:18px">'+a.map(function(x){ return '<li>'+f(x)+'</li>'; }).join('')+'</ul>':'<p class="muted small">'+vazio+'</p>'; };
  var h='<article class="rel-doc">';
  h+='<section class="card sec pad rel-sec"><p class="small muted">Relatório quinzenal ao cliente'+(rel.retificacaoDe?' — <strong>retificação</strong>':'')+'</p><h1 style="margin:4px 0">'+esc(d.capa.obra)+'</h1><p>'+esc(qNome(q))+' · '+fmt(q.ini)+' a '+fmt(q.fim)+'</p><p class="small muted">'+[d.capa.cliente, d.capa.endereco, d.capa.modalidade, d.capa.empresa].filter(Boolean).map(esc).join(' · ')+'</p></section>';
  h+=sec(1,'Resumo da engenharia', rel.textoEngenharia?'<p style="white-space:pre-wrap">'+esc(rel.textoEngenharia)+'</p>':'<p class="muted small">Sem resumo escrito.</p>');
  h+=sec(2,'Onde estamos e o que precisamos do cliente', rel.posicaoCliente?'<p style="white-space:pre-wrap">'+esc(rel.posicaoCliente)+'</p>':'<p class="muted small">Sem posicionamento escrito.</p>');
  h+=sec(3,'Avanço da obra','<p>Avanço do cronograma: <strong>'+pct1(d.avanco.cronograma)+'</strong> · valor executado sobre o orçamento: <strong>'+pct1(d.avanco.fisico)+'</strong></p>'
    +lista(d.avanco.liberadas,function(x){ return 'Etapa '+x.n+' — '+esc(x.nome)+' liberada no período'; },'Nenhuma etapa liberada no período.')
    +(d.avanco.andamento.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa em andamento</th><th>Meta do cronograma</th><th>Executado</th></tr></thead><tbody>'+d.avanco.andamento.map(function(x){ return '<tr><td>'+x.n+'. '+esc(x.nome)+'</td><td>'+(x.meta==null?'—':Math.round(x.meta*100)+'%')+'</td><td>'+Math.round(x.fis*100)+'%</td></tr>'; }).join('')+'</tbody></table></div>':''));
  h+=sec(4,'Meta, evolução e pagamentos','<p>Etapas em andamento alinhadas (meta, execução e pagamentos): <strong>'+pct1(d.alinhamento.alinh)+'</strong>'+(d.alinhamento.nAtivas?' ('+d.alinhamento.nAlinhadas+' de '+d.alinhamento.nAtivas+')':'')+'</p>'+lista(d.alinhamento.atencao,function(x){ return 'Etapa '+x.n+' — '+esc(x.nome)+': '+esc(x.mot); },'Nenhuma etapa com desvio.'));
  h+=sec(5,'Qualidade e planejamento','<p>Ocorrências abertas: <strong>'+d.qualidade.abertas+'</strong> ('+d.qualidade.criticas+' crítica(s)) · abertas no período: '+d.qualidade.abertasPer+' · fechadas no período: '+d.qualidade.fechadasPer+'</p><p>PPC do período: <strong>'+pct1(d.planejamento.ppc)+'</strong> ('+d.planejamento.concluidos+' de '+d.planejamento.pacotes+' pacotes; meta '+d.planejamento.meta+'%)</p>');
  h+=sec(6,'Pendências de decisão do cliente',lista(d.pendencias,function(p){ return '<strong>'+esc(p.tipo)+'</strong>: '+esc(p.descricao)+(p.valor!=null?' — '+brl(p.valor):'')+(p.prazo?' — decidir até <strong>'+fmt(p.prazo)+'</strong>':''); },'Nenhuma decisão pendente.'));
  h+=sec(7,'Próximos 15 dias',lista(d.proximos,function(e){ return fmt(e.data)+' — '+esc(e.titulo); },'Nada agendado.')+(rel.proximosPassos?'<p class="small" style="margin-top:8px;white-space:pre-wrap"><strong>Próximos passos:</strong> '+esc(rel.proximosPassos)+'</p>':''));
  h+=sec(8,'Fotos do período',(rel.fotos&&rel.fotos.length)?thumbs(rel.fotos):'<p class="muted small">Sem fotos.</p>');
  return h+'</article>';
}
function quinzHtmlDocumento(o,rel){
  var css=(document.querySelector('style')||{}).textContent||'';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório quinzenal — '+esc(o.nome)+' — '+esc(rel.mes)+'</title><style>'+css+'\nbody{padding:16px}.rel-doc{max-width:900px;margin:0 auto}</style></head><body><div class="rel-doc-wrap">'+quinzHtml(o,rel)+'</div></body></html>';
}
function tQuinzenal(o){
  var oid=o.id, q=qDaChave(ui.qzK)||qAnterior(qDe(hoje()));
  var cur=qDe(hoje()), opcoes=[]; for(var i=0,x=qProxima(cur);i<8;i++,x=qAnterior(x)) opcoes.push(x);
  var sel='<label class="small muted">Quinzena <select data-chg="qz-k" aria-label="Quinzena" style="padding:6px;border:1px solid var(--line);border-radius:6px">'+opcoes.map(function(p){ return '<option value="'+p.k+'"'+(p.k===q.k?' selected':'')+'>'+esc(qNome(p))+(p.k===cur.k?' (atual)':'')+'</option>'; }).join('')+'</select></label>';
  var pend=qzPendentes(o);
  var head='<div class="sec-h no-print"><div><h2>Relatório quinzenal</h2><p class="muted small">Tarefa da engenharia a cada 15 dias (1ª a 15 e 16 ao fim do mês), até 2 dias depois de fechar a quinzena. Texto, posicionamento ao cliente, fotos e os números de avanço e alinhamento.</p></div>'+sel+'</div>'
    +(pend.length?'<div class="callout no-print" style="margin-bottom:12px"><strong>Pendente da engenharia:</strong> '+pend.map(function(p){ return esc(qNome(p))+' (prazo '+fmt(qPrazo(p))+')'; }).join('; ')+'.</div>':'');
  var lista=qzDoPeriodo(oid,q.k), rel=lista.filter(function(r){ return r.id===ui.qzSel; })[0]||qzVigente(oid,q.k)||lista[lista.length-1]||null;
  if(!rel) return head+'<div class="card empty no-print"><h3>Nenhum relatório de '+esc(qNome(q))+'</h3><p>O rascunho junta avanço, meta × evolução, qualidade, PPC, pendências do cliente e próximos 15 dias.</p><p style="margin-top:14px"><button class="btn primary" data-act="qz-criar" data-oid="'+oid+'" data-k="'+q.k+'" data-write>Criar relatório da '+esc(qNome(q))+'</button></p></div>';
  var emit=rel.status==='emitido', vig=qzVigente(oid,q.k), v=rel.validacaoCliente;
  var versoes='<div class="row no-print" style="gap:6px;margin:12px 0">'+lista.map(function(r,i){ return '<button class="btn sm'+(r.id===rel.id?' primary':'')+'" data-act="qz-abrir" data-id="'+r.id+'">'+(r.retificacaoDe?'Retificação':'Relatório')+' '+(i+1)+' · '+REL_ST[r.status]+(r.status==='emitido'&&vig&&r.id!==vig.id?' (substituído)':'')+'</button>'; }).join('')+'</div>';
  var estado=emit?'<div class="callout ok no-print"><strong>Emitido em '+fmt((rel.emitidoEm||'').slice(0,10))+' por '+esc(Names.get(rel.emitidoPor))+'.</strong> Números congelados.'+(rel.enviadoEm?'<br>Enviado ao cliente em '+fmt(rel.enviadoEm)+(rel.prazoObjecao?' · prazo para objeção: <strong>'+fmt(rel.prazoObjecao)+'</strong>':''):'<br>Ainda não registrado como enviado ao cliente.')+'<br>Cliente: <span class="chip '+(v&&v.status==='validado'?'ok':(v&&v.status==='objecao'?'crit':'warn'))+'">'+esc((VALID_ST[(v&&v.status)||'pendente']))+'</span></div>':'';
  var acts='<div class="row no-print" style="gap:6px;margin:12px 0">'+(!emit?'<button class="btn" data-act="qz-editar" data-id="'+rel.id+'" data-write>Preencher texto e fotos</button><button class="btn" data-act="qz-fotos" data-id="'+rel.id+'" data-write>Fotos do diário</button><button class="btn primary" data-act="qz-emitir" data-id="'+rel.id+'" data-write>Emitir relatório</button><button class="btn danger" data-act="qz-excluir" data-id="'+rel.id+'" data-write>Excluir rascunho</button>'
    :'<button class="btn" data-act="rel-enviar" data-id="'+rel.id+'" data-write>Registrar envio ao cliente</button><button class="btn" data-act="rel-valid" data-id="'+rel.id+'" data-write>Registrar validação ou objeção</button><button class="btn" data-act="qz-retificar" data-id="'+rel.id+'" data-write>Criar retificação</button>')
    +'<button class="btn" data-act="rel-imprimir">Imprimir / salvar como PDF</button><button class="btn" data-act="qz-html" data-id="'+rel.id+'">Baixar em HTML</button></div>';
  var rr=emit?rel:Object.assign({}, rel, {dados:quinzDados(o,q)});
  return head+versoes+estado+acts+quinzHtml(o,rr);
}
function qzCriar(oid,k,de){
  var base=de?G('relatorios',de):null;
  return Store.add('relatorios',{obraId:oid, tipo:'quinzenal', mes:k, status:'rascunho', textoEngenharia:base?base.textoEngenharia:'', posicaoCliente:base?base.posicaoCliente:'', proximosPassos:base?base.proximosPassos:'', fotos:base?(base.fotos||[]).slice():[], prazoObjecao:'', validacaoCliente:{status:'pendente'}, retificacaoDe:de||'', criadoEm:new Date().toISOString(), por:Store.uid||null, hist:[]});
}
function qzFotosDlg(id){
  var r=G('relatorios',id), q=qDaChave(r.mes), sel=(r.fotos||[]).slice(), cand=[];
  byObra('diarios',r.obraId).filter(function(x){ return String(x.data)>=q.ini&&String(x.data)<=q.fim; }).forEach(function(x){ (x.fotos||[]).forEach(function(f){ if(cand.indexOf(f)<0) cand.push(f); }); });
  sel.forEach(function(f){ if(cand.indexOf(f)<0) cand.push(f); });
  var d=openDlg('<div class="dlg-h"><h2>Fotos do relatório</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b"><p class="muted small">Até 12 fotos, escolhidas entre as do diário da quinzena. <strong id="qf_n"></strong></p>'
    +(cand.length?'<div class="thumbs" id="qf_grid">'+cand.map(function(f){ return '<button type="button" data-qf="'+esc(f)+'" aria-pressed="false" style="border:3px solid transparent;border-radius:6px"><img loading="lazy" src="'+esc(blobUrl(f))+'" alt="Foto do diário"></button>'; }).join('')+'</div>':'<p class="muted">Nenhuma foto no diário desta quinzena. Use “Preencher texto e fotos” para enviar fotos novas.</p>')+'<div class="err-msg hide" id="qf_err" role="alert"></div></div><div class="dlg-f"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="qf_ok">Usar estas fotos</button></div>', true);
  var pinta=function(){ Array.prototype.forEach.call(d.querySelectorAll('[data-qf]'), function(b){ var on=sel.indexOf(b.dataset.qf)>=0; b.setAttribute('aria-pressed',on?'true':'false'); b.style.borderColor=on?'var(--steel)':'transparent'; }); $('#qf_n',d).textContent=sel.length+' de 12 selecionadas.'; }; pinta();
  d.addEventListener('click', async function(e){
    var b=e.target.closest('[data-qf]');
    if(b){ var i=sel.indexOf(b.dataset.qf); if(i>=0) sel.splice(i,1); else if(sel.length>=12){ var er=$('#qf_err',d); er.textContent='O limite é de 12 fotos.'; er.classList.remove('hide'); return; } else sel.push(b.dataset.qf); pinta(); return; }
    if(e.target.closest('#qf_ok')){ await Store.set('relatorios', id, Object.assign({}, r, {fotos:sel})); closeDlg(); }
  });
}
Object.assign(AG,{
  'qz-criar':async function(d){ var id=await qzCriar(d.oid,d.k); ui.qzSel=id; render(); },
  'qz-abrir':function(d){ ui.qzSel=d.id; render(); },
  'qz-editar':function(d){
    var r=G('relatorios',d.id);
    openForm({title:'Relatório quinzenal', wide:true, fields:[{name:'texto',label:'Resumo da engenharia',type:'textarea',rows:5,value:r.textoEngenharia,hint:'O que aconteceu na quinzena, em linguagem simples.'},
      {name:'posicao',label:'Onde estamos e o que precisamos do cliente',type:'textarea',rows:4,value:r.posicaoCliente,hint:'Posicionamento: situação da obra, decisões e aprovações que dependem do cliente, riscos de prazo ou custo.'},
      {name:'proximos',label:'Próximos passos',type:'textarea',rows:3,value:r.proximosPassos},{name:'fotos',label:'Fotos',type:'photos',value:r.fotos||[]}],
      onSubmit:async function(v){ if(r.status!=='rascunho') return 'Relatório emitido não pode ser alterado. Crie uma retificação.'; var cur=G('relatorios',d.id);
        await Store.set('relatorios', d.id, Object.assign({}, cur, {textoEngenharia:v.texto||'', posicaoCliente:v.posicao||'', proximosPassos:v.proximos||'', fotos:(v.fotos||[]).slice(0,12)})); }});
  },
  'qz-fotos':function(d){ qzFotosDlg(d.id); },
  'qz-emitir':async function(d){
    var r=G('relatorios',d.id), o=G('obras',r.obraId), q=qDaChave(r.mes); if(r.status!=='rascunho') return;
    if(!(r.textoEngenharia||'').trim()||!(r.posicaoCliente||'').trim()){ blockDlg('Falta preencher',['Escreva o resumo da engenharia e o posicionamento ao cliente antes de emitir.'],'Não dá para emitir:'); return; }
    var ok=await confirmDlg('Emitir o relatório da '+qNome(q)+'?','<p>Os números de hoje ficam <strong>congelados</strong>. Para corrigir depois, crie uma retificação.</p>','Emitir',false); if(!ok) return;
    await Store.set('relatorios', d.id, Object.assign({}, r, {status:'emitido', snapshot:quinzDados(o,q), emitidoPor:Store.uid||null, emitidoEm:new Date().toISOString(), hist:(r.hist||[]).concat([{acao:'emitido', data:new Date().toISOString(), por:Store.uid||null}]).slice(-20)}));
    ui.qzSel=d.id; toast('Relatório emitido.');
  },
  'qz-retificar':async function(d){ var r=G('relatorios',d.id), id=await qzCriar(r.obraId,r.mes,d.id); ui.qzSel=id; toast('Retificação criada como rascunho.'); render(); },
  'qz-excluir':async function(d){ var r=G('relatorios',d.id); if(r.status!=='rascunho') return; var ok=await confirmDlg('Excluir rascunho?','<p>Só rascunhos podem ser excluídos.</p>','Excluir',true); if(ok){ await Store.del('relatorios',d.id); ui.qzSel=''; } },
  'qz-html':function(d){ var r=G('relatorios',d.id), o=G('obras',r.obraId), rr=r.status==='emitido'?r:Object.assign({}, r, {dados:quinzDados(o,qDaChave(r.mes))}); baixar('relatorio-quinzenal-'+r.mes+'-'+chave(o.nome)+'.html', quinzHtmlDocumento(o,rr), 'text/html').then(function(ok){ if(ok) toast('Relatório baixado.'); }); }
});
document.addEventListener('change', function(e){ var el=e.target.closest('[data-chg="qz-k"]'); if(el&&el.value){ ui.qzK=el.value; ui.qzSel=''; render(); } });

/* ================= ALERTAS E INDICADORES ================= */
function alertasG(o){
  var A=[], oid=o.id, base='#/obra/'+oid+'/', hj=hoje();
  qzPendentes(o).forEach(function(q){ var atr=diffDays(qPrazo(q),hj); if(atr>0) A.push({k:atr>5?'crit':'warn', t:'Relatório quinzenal da '+qNome(q)+' não emitido (prazo era '+fmt(qPrazo(q))+').', to:base+'quinzenal'}); });
  var m=metaEvo(oid), k=m.linhas.filter(function(l){ return l.k==='crit'&&l.ativa; });
  if(k.length&&gVe()) A.push({k:'crit', t:plural(k.length,'etapa desalinhada','etapas desalinhadas')+' entre meta, execução e pagamento'+(m.kpi.adiante>0?' (pago adiante: '+brl(m.kpi.adiante)+')':'')+'.', to:base+'metaevo'});
  var fe=byObra('compras',oid).concat(pedDaObra(oid)).filter(function(x){ return x.foraEscopo&&!foraEscopoOk(x,true)&&x.status!=='recusado'&&x.status!=='cancelado'&&!(x.status==='pago'); });
  var vencEm=fe.filter(function(x){ return x.emergencia&&x.emergencia.regularizarAte&&x.emergencia.regularizarAte<hj; });
  if(vencEm.length) A.push({k:'crit', t:plural(vencEm.length,'item de emergência sem aditivo regularizado no prazo','itens de emergência sem aditivo regularizado no prazo')+'.', to:base+'pedidos'});
  else if(fe.length) A.push({k:'warn', t:plural(fe.length,'item fora do escopo aguardando aditivo assinado','itens fora do escopo aguardando aditivo assinado')+'.', to:base+'pedidos'});
  if(gVe()){ var pa=pedDaObra(oid).filter(function(p){ return pedStatus(p)==='aprovacao'; }); if(pa.length) A.push({k:'warn', t:plural(pa.length,'pedido de pagamento aguardando aprovação','pedidos de pagamento aguardando aprovação')+'.', to:base+'pedidos'}); }
  if(fimDeObra(o)){ var pf=pendenciasFim(oid), n=pf.abertas.length+pf.semConferir.length; if(n) A.push({k:'warn', t:'Fim de obra: '+plural(n,'compra ainda aberta ou sem conferência','compras ainda abertas ou sem conferência')+'. Alinhar com suprimentos antes de encerrar.', to:base+'encerramento'}); }
  return A;
}
COBX.eventosAuto=eventosAuto; COBX.alertasG=alertasG; COBX.pedStatus=pedStatus; COBX.qzPendentes=qzPendentes; COBX.pendenciasFim=pendenciasFim; COBX.foraEscopoOk=foraEscopoOk;

/* ================= COMPRAS: código, prioridade e vista em lista (como a lista de solicitações da Vobi) ================= */
var PRIO={baixa:'Baixa', media:'Média', alta:'Alta'};
function proximoCodigoCompra(){
  var m=0; L('compras').forEach(function(c){ var n=Number(String(c.codigo||'').replace(/\D/g,''))||0; if(n>m) m=n; });
  var s=String(m+1); while(s.length<5) s='0'+s; return 'SC'+s;
}
function comprasVistaBarra(o,cs){
  var fl=fluxoDe(o), f=ui.cmpFiltro||'';
  var chips=['<button class="btn sm'+(f===''?' primary':'')+'" data-act="cmp-filtro" data-f="">Todas <span class="num">'+cs.length+'</span></button>'].concat(fl.map(function(st){ var n=cs.filter(function(c){ return c.status===st||(st===fl[0]&&fl.indexOf(c.status)<0); }).length; return '<button class="btn sm'+(f===st?' primary':'')+'" data-act="cmp-filtro" data-f="'+st+'">'+COMPRA_ST[st]+' <span class="num">'+n+'</span></button>'; }));
  var vis='<div class="row" style="gap:4px"><button class="btn sm'+(ui.cmpVista!=='lista'?' primary':'')+'" data-act="cmp-vista" data-v="quadro">Quadro</button><button class="btn sm'+(ui.cmpVista==='lista'?' primary':'')+'" data-act="cmp-vista" data-v="lista">Lista</button></div>';
  return '<div class="row spread no-print" style="margin:12px 0;flex-wrap:wrap;gap:8px"><div class="row" style="gap:4px;flex-wrap:wrap">'+chips.join('')+'</div>'+vis+'</div>';
}
function comprasLista(o,cs){
  var fl=fluxoDe(o), f=ui.cmpFiltro||'', ve=gVe(), adm=modAdm(o);
  var l=cs.filter(function(c){ return !f||c.status===f||(f===fl[0]&&fl.indexOf(c.status)<0); }).sort(function(a,b){ return (b.criadoEm||'')<(a.criadoEm||'')?-1:1; });
  var cor={alta:'crit',media:'warn',baixa:''};
  return '<div class="card tbl-scroll"><table class="tbl"><thead><tr><th>Código</th><th>Nome</th><th>Criação</th><th>Necessidade</th><th>Pedir até</th>'+((adm&&ve)?'<th class="num">Custo previsto</th>':'')+'<th>Status</th><th>Prioridade</th></tr></thead><tbody>'
    +(l.length?l.map(function(c){ var lim=limiteCompra(c), at=compraAtrasadaPedido(c)||pedidoAtrasado(c);
      return '<tr'+(at?' style="background:var(--crit-soft)"':'')+'><td class="num">'+esc(c.codigo||'—')+'</td><td><button type="button" class="linkbtn" data-act="compra-abrir" data-id="'+c.id+'">'+esc(short(c.item,60))+'</button>'+(c.critico?' <span class="chip warn">Crítico</span>':'')+(c.foraEscopo?' <span class="chip crit">Fora do escopo</span>':'')+'</td><td>'+fmt((c.criadoEm||'').slice(0,10))+'</td><td>'+fmt(c.dataUso)+'</td><td>'+(lim?fmt(lim):'—')+'</td>'+((adm&&ve)?'<td class="num">'+(valorCompra(c)?brl(valorCompra(c)):(c.orcado?brl(c.orcado):'—'))+'</td>':'')+'<td><span class="chip steel">'+esc(COMPRA_ST[c.status]||c.status)+'</span></td><td><span class="chip '+(cor[c.prioridade||'media'])+'">'+PRIO[c.prioridade||'media']+'</span></td></tr>'; }).join(''):'<tr><td colspan="8" class="muted">Nenhuma compra neste filtro.</td></tr>')
    +'</tbody></table></div>';
}
Object.assign(AG,{
  'cmp-vista':function(d){ ui.cmpVista=d.v; render(); },
  'cmp-filtro':function(d){ ui.cmpFiltro=d.f; render(); }
});

/* ================= RESUMO DA OBRA: próximos pagamentos e próximas tarefas (como a tela Geral da Vobi) ================= */
function resumoProximos(o){
  var oid=o.id, hj=hoje(), ve=gVe(), b='#/obra/'+oid+'/';
  var tar=eventosAuto(oid).filter(function(e){ return e.status==='agendado'&&e.data>=addDays(hj,-30)&&e.area!=='financeiro'; }).sort(function(a,c){ return a.data<c.data?-1:1; }).slice(0,6);
  var tarHtml='<section class="card"><div class="card-h"><h2>Próximas tarefas</h2><a class="small" href="'+b+'agenda">Abrir agenda</a></div>'
    +(tar.length?'<ul class="alerts">'+tar.map(function(e){ return '<li><span class="dot '+(e.data<hj?'crit':'steel')+'"></span><div class="grow">'+esc(short(e.titulo,70))+'<div class="tiny muted">'+fmt(e.data)+(e.data<hj?' · atrasada':'')+'</div></div>'+(e.to?'<a class="small" href="'+e.to+'">Abrir</a>':'')+'</li>'; }).join('')+'</ul>':'<p class="muted small" style="padding:14px 16px">Nenhuma tarefa programada.</p>')+'</section>';
  var pg=ve?pagamentosObra(oid).filter(function(p){ return !p.pago; }).sort(function(a,c){ return (a.venc||'9')<(c.venc||'9')?-1:1; }).slice(0,6):[];
  var pgHtml=ve?'<section class="card"><div class="card-h"><h2>Próximos pagamentos</h2><a class="small" href="'+b+'pagprazos">Pagamentos e prazos</a></div>'
    +(pg.length?'<ul class="alerts">'+pg.map(function(p){ var v=p.venc&&p.venc<hj; return '<li><span class="dot '+(v?'crit':'steel')+'"></span><div class="grow">'+esc(short(p.desc,60))+'<div class="tiny muted">'+(p.venc?fmt(p.venc):'sem data')+(v?' · vencido':'')+' · '+brl(p.valor)+'</div></div><a class="small" href="'+p.to+'">Abrir</a></li>'; }).join('')+'</ul>':'<p class="muted small" style="padding:14px 16px">Nenhum pagamento em aberto.</p>')+'</section>':'';
  return '<div class="grid cols2">'+tarHtml+pgHtml+'</div>';
}
