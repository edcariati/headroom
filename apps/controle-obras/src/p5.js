/* ================= FASE 5 ================= */
/* ---------- navegação da obra: grupos e subabas ---------- */
var NAV_GRUPOS=[
  ['geral','Visão geral',['resumo']],
  ['plan','Planejamento',['etapas','cronograma','balanco','semana']],
  ['exec','Execução e qualidade',['diario','ocorrencias','entrega','projeto']],
  ['sup','Suprimentos',['compras','estoque','locacoes']],
  ['prest','Prestadores',['contratos','avaliacoes']],
  ['custo','Custo e financeiro',['orcamento','medicao','financeiro','fisfin','dre']],
  ['gest','Gestão',['agenda','reunioes','documentos','relatorio']],
  ['enc','Encerramento',['encerramento']]
];
var NAV_ROTULO={resumo:'Resumo', etapas:'Etapas', cronograma:'Cronograma', balanco:'Balanço', semana:'Semana e PPC', diario:'Diário', ocorrencias:'Ocorrências', entrega:'Pré-entrega', projeto:'RFI e materiais', compras:'Compras', estoque:'Estoque', locacoes:'Locações', contratos:'Contratos e frentes', avaliacoes:'Avaliações', orcamento:'Orçamento', medicao:'Medição', financeiro:'Financeiro', fisfin:'Físico-financeiro', dre:'DRE', agenda:'Agenda', reunioes:'Reuniões', documentos:'Documentos', relatorio:'Relatório mensal', encerramento:'Encerramento e P0'};
function abaMapa(){
  return {resumo:tResumo, etapas:tEtapas, cronograma:tCron, balanco:tBalanco, semana:tSemana, diario:tDiario, ocorrencias:tOcorr, entrega:tEntrega, projeto:tProjeto, compras:tCompras, estoque:tEstoque, locacoes:tLocacoes, contratos:tContratos, avaliacoes:tAvaliacoes, orcamento:tOrcamento, medicao:tMedicao, financeiro:tFinanceiro, fisfin:tFisFin, dre:tDRE, relatorio:tRelatorio, agenda:tAgenda, reunioes:tReunioes, documentos:tDocumentos};
}
function obraNav(o,tab){
  var mapa=abaMapa(), base='#/obra/'+o.id+'/', grupo=NAV_GRUPOS.filter(function(g){ return g[2].indexOf(tab)>=0; })[0]||NAV_GRUPOS[0];
  var grupos=NAV_GRUPOS.map(function(g){
    var abas=g[2].filter(function(t){ return mapa[t]; }); if(!abas.length) return '';
    return '<a href="'+base+abas[0]+'"'+(g===grupo?' aria-current="page"':'')+'>'+g[1]+'</a>';
  }).join('');
  var subs=grupo[2].filter(function(t){ return mapa[t]; });
  return '<nav class="tabs grupos" aria-label="Grupos de seções da obra">'+grupos+'</nav>'
    +(subs.length>1?'<nav class="tabs sub" aria-label="Seções de '+esc(grupo[1])+'">'+subs.map(function(t){ return '<a href="'+base+t+'"'+(t===tab?' aria-current="page"':'')+'>'+NAV_ROTULO[t]+'</a>'; }).join('')+'</nav>':'');
}
COBX.NAV_GRUPOS=NAV_GRUPOS;
var A5={};

/* ================= EMPRESAS E CONTRATO DO CLIENTE ================= */
var EMPRESAS_PADRAO=[['emp_arq','Cariati Arquitetura Ltda'],['emp_cons','Cariati Construtora Ltda']];
var CRIT_RATEIO={receita:'Proporcional à receita do mês', igual:'Partes iguais entre as obras', manual:'Percentuais manuais por obra'};
var REMUN={fixo_mensal:'Valor fixo mensal', percentual_custo:'Percentual sobre o custo apropriado', parcelas:'Parcelas combinadas'};
function ensureEmpresas(){
  if(!Store.writable || Store.mode==='boot' || L('empresas').length) return;
  EMPRESAS_PADRAO.forEach(function(e){ Store.set('empresas', e[0], {nome:e[1], cnpj:'', aliquotaImpostos:null, ativa:true, criterioRateio:'receita', rateioManual:{}}); });
}
function empresasAtivas(){ return L('empresas').filter(function(e){ return e.ativa!==false; }).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); }); }
function empresaNome(id){ var e=id?G('empresas',id):null; return e?e.nome:''; }
function obrasDaEmpresa(eid){ return L('obras').filter(function(o){ return (o.empresaId||'')===(eid||''); }); }
COBX.ensureEmpresas=ensureEmpresas;

function parseManual(texto, obras){
  var out={}, erros=[], tot=0;
  String(texto||'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean).forEach(function(l){
    var p=l.split(';'), nome=(p[0]||'').trim(), v=numBR(p[1]), o=obras.filter(function(x){ return chave(x.nome)===chave(nome); })[0];
    if(!o) erros.push('Obra “'+nome+'” não pertence a esta empresa.'); else if(!(v>=0)) erros.push('Percentual inválido para “'+nome+'”.'); else { out[o.id]=v; tot+=v; }
  });
  if(!erros.length && Object.keys(out).length && Math.abs(tot-100)>0.01) erros.push('Os percentuais somam '+String(Math.round(tot*100)/100).replace('.',',')+'%; precisam somar 100%.');
  return {rateio:out, erros:erros};
}
function empresaForm(e){
  var novo=!e, obras=novo?[]:obrasDaEmpresa(e.id);
  var manualTxt=e&&e.rateioManual?Object.keys(e.rateioManual).map(function(k){ var o=G('obras',k); return o?o.nome+'; '+String(e.rateioManual[k]).replace('.',','):''; }).filter(Boolean).join('\n'):'';
  openForm({title:novo?'Nova empresa':'Editar empresa',
    fields:[{name:'nome',label:'Nome da empresa',required:true,value:e&&e.nome},{name:'cnpj',label:'CNPJ (opcional)',value:e&&e.cnpj},
      {name:'aliquotaImpostos',label:'Alíquota de impostos sobre a receita (%)',type:'number',min:0,max:100,step:'0.01',value:e&&e.aliquotaImpostos!=null?e.aliquotaImpostos:'',hint:'Valor provisório, a definir pela Cariati e pelo contador. Sem alíquota, o app não sugere imposto.'},
      {name:'criterioRateio',label:'Rateio das despesas gerais entre as obras',type:'select',options:Object.keys(CRIT_RATEIO).map(function(k){ return [k,CRIT_RATEIO[k]]; }),value:(e&&e.criterioRateio)||'receita'},
      {name:'rateioManual',label:'Percentuais manuais (só se o critério for manual)',type:'textarea',rows:3,value:manualTxt,ph:'Uma obra por linha: Nome da obra; 60',hint:'Precisam somar 100%.'},
      {name:'ativa',label:'Situação',type:'radio',options:[['sim','Ativa'],['nao','Inativa']],value:e&&e.ativa===false?'nao':'sim'}],
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o nome da empresa.';
      var man={};
      if(v.criterioRateio==='manual'){
        var r=parseManual(v.rateioManual, obras); if(r.erros.length) return r.erros[0];
        if(!Object.keys(r.rateio).length) return 'Informe os percentuais por obra para o rateio manual.';
        man=r.rateio;
      }
      await Store.set('empresas', e?e.id:nid(), Object.assign({}, e||{}, {nome:v.nome.trim(), cnpj:(v.cnpj||'').trim(), aliquotaImpostos:v.aliquotaImpostos==null?null:v.aliquotaImpostos, criterioRateio:v.criterioRateio, rateioManual:man, ativa:v.ativa!=='nao'}));
    }});
}
function empresasHtml(){
  var es=L('empresas').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
  var linhas=es.length?es.map(function(e){
    return '<tr><td><strong>'+esc(e.nome)+'</strong>'+(e.cnpj?'<div class="tiny muted">'+esc(e.cnpj)+'</div>':'')+(e.ativa===false?' <span class="chip">Inativa</span>':'')+'</td><td class="num">'+(e.aliquotaImpostos!=null?String(e.aliquotaImpostos).replace('.',',')+'%':'<span class="chip warn">Sem alíquota</span>')+'</td><td>'+esc(CRIT_RATEIO[e.criterioRateio||'receita'])+'</td><td class="num">'+obrasDaEmpresa(e.id).length+'</td><td style="white-space:nowrap"><button class="btn sm" data-act="emp-editar" data-id="'+e.id+'" data-write>Editar</button> <button class="btn sm ghost" data-act="emp-ativar" data-id="'+e.id+'" data-write>'+(e.ativa===false?'Reativar':'Inativar')+'</button></td></tr>';
  }).join(''):'<tr><td colspan="5" class="muted" style="padding:16px">Nenhuma empresa cadastrada.</td></tr>';
  return '<section class="card sec"><div class="card-h"><div><h2>Empresas do grupo</h2><p class="muted small">Cada obra pertence a uma empresa; o DRE é feito por empresa e consolidado. A alíquota é provisória.</p></div><button class="btn primary sm" data-act="emp-nova" data-write>+ Empresa</button></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Empresa</th><th class="num">Alíquota</th><th>Rateio das despesas gerais</th><th class="num">Obras</th><th></th></tr></thead><tbody>'+linhas+'</tbody></table></div></section>';
}

/* ---------- contrato do cliente e receita prevista ---------- */
function contratoCliente(oid){ return G('contratosCliente','cc_'+oid); }
function parseParcelas(texto){
  var out=[], erros=[];
  String(texto||'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean).forEach(function(l,k){
    var p=l.split(';'), m=(p[0]||'').trim(), v=numBR(p[1]);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) erros.push('Parcela '+(k+1)+': competência “'+m+'” deve ser AAAA-MM.'); else if(!(v>0)) erros.push('Parcela '+(k+1)+': valor inválido.'); else out.push({competencia:m, valor:r2(v)});
  });
  return {parcelas:out, erros:erros};
}
function receitaPrevista(o, mes){
  var c=contratoCliente(o.id); if(!c) return 0;
  if(c.tipoRemuneracao==='fixo_mensal'){ return (c.inicio&&c.fim&&mes>=c.inicio.slice(0,7)&&mes<=c.fim.slice(0,7))?r2(c.valorMensal):0; }
  if(c.tipoRemuneracao==='parcelas'){ return r2((c.parcelas||[]).filter(function(p){ return p.competencia===mes; }).reduce(function(s,p){ return s+p.valor; },0)); }
  if(c.tipoRemuneracao==='percentual_custo'){
    if(!modAdm(o)) return 0;
    var ap=eventosCusto(o.id).filter(function(x){ return x.tipo==='apropriado'&&x.data.slice(0,7)===mes; }).reduce(function(s,x){ return s+x.valor; },0);
    return r2(ap*(Number(c.percentual)||0)/100);
  }
  return 0;
}
COBX.receitaPrevista=receitaPrevista; COBX.parseParcelas=parseParcelas;
function contratoClienteForm(oid){
  var o=G('obras',oid), c=contratoCliente(oid);
  var parcTxt=(c&&c.parcelas||[]).map(function(p){ return p.competencia+'; '+String(p.valor).replace('.',','); }).join('\n');
  openForm({title:c?'Editar contrato do cliente':'Contrato do cliente', wide:true, intro:'Só o que consta no contrato assinado. O app não inventa valores.',
    fields:[{name:'tipoRemuneracao',label:'Como a Cariati é remunerada',type:'radio',required:true,options:Object.keys(REMUN).map(function(k){ return [k,REMUN[k]]; }),value:c&&c.tipoRemuneracao},
      [{name:'valorMensal',label:'Valor mensal (R$)',type:'number',min:0,step:'0.01',value:c&&c.valorMensal},{name:'percentual',label:'Percentual sobre o custo (%)',type:'number',min:0,max:100,step:'0.01',value:c&&c.percentual,hint:'Só na Administração de Obra.'}],
      {name:'parcelas',label:'Parcelas (uma por linha: AAAA-MM; valor)',type:'textarea',rows:3,value:parcTxt,ph:'2026-10; 4500,00'},
      [{name:'inicio',label:'Início',type:'date',value:c&&c.inicio},{name:'fim',label:'Fim',type:'date',value:c&&c.fim}],
      {name:'obs',label:'Observações',type:'textarea',rows:2,value:c&&c.obs},{name:'anexos',label:'Contrato assinado (foto ou PDF)',type:'anexos',value:(c&&c.anexos)||[]}],
    extra:c?'<button type="button" class="btn danger" data-act="cc-excluir" data-oid="'+oid+'" style="margin-right:auto">Excluir contrato</button>':'',
    onSubmit:async function(v){
      var t=v.tipoRemuneracao; if(!t) return 'Escolha como a Cariati é remunerada.';
      var rec={obraId:oid, tipoRemuneracao:t, obs:v.obs||'', anexos:v.anexos||[], inicio:v.inicio||'', fim:v.fim||'', valorMensal:null, percentual:null, parcelas:[]};
      if(t==='fixo_mensal'){ if(!(v.valorMensal>0)) return 'Informe o valor mensal.'; if(!v.inicio||!v.fim) return 'Informe o início e o fim do contrato.'; if(v.fim<v.inicio) return 'O fim não pode ser antes do início.'; rec.valorMensal=r2(v.valorMensal); }
      if(t==='percentual_custo'){ if(!modAdm(o)) return 'O percentual sobre o custo só existe na Administração de Obra.'; if(!(v.percentual>0&&v.percentual<=100)) return 'Informe o percentual (maior que 0 e até 100).'; rec.percentual=v.percentual; }
      if(t==='parcelas'){ var r=parseParcelas(v.parcelas); if(r.erros.length) return r.erros[0]; if(!r.parcelas.length) return 'Informe ao menos uma parcela.'; rec.parcelas=r.parcelas; }
      await Store.set('contratosCliente','cc_'+oid,Object.assign({}, c||{}, rec));
    }});
}
function contratoClienteHtml(o){
  var c=contratoCliente(o.id), emp=empresaNome(o.empresaId);
  var head='<div class="card-h"><div><h2>Contrato do cliente e empresa</h2><p class="muted small">De onde vem a receita da Cariati nesta obra.</p></div><div class="row"><button class="btn sm" data-act="obra-editar" data-oid="'+o.id+'" data-write>Definir empresa</button><button class="btn primary sm" data-act="cc-editar" data-oid="'+o.id+'" data-write>'+(c?'Editar contrato':'Cadastrar contrato')+'</button></div></div>';
  var empHtml='<div class="pad"><strong>Empresa:</strong> '+(emp?esc(emp):'<span class="chip warn">Sem empresa</span> <span class="small muted">o DRE agrupa obras sem empresa à parte</span>')+'</div>';
  if(!c) return '<section class="card sec">'+head+empHtml+'<div class="pad" style="padding-top:0"><span class="chip warn">Sem contrato do cliente</span> <span class="small muted">sem contrato o DRE não tem receita prevista para comparar</span></div></section>';
  var ms=[]; if(c.tipoRemuneracao==='parcelas') ms=(c.parcelas||[]).map(function(p){ return p.competencia; }); else if(c.inicio&&c.fim){ for(var m=c.inicio.slice(0,7); m<=c.fim.slice(0,7)&&ms.length<36; m=mesAdd(m,1)) ms.push(m); } else ms=[hoje().slice(0,7)];
  return '<section class="card sec">'+head+empHtml+'<div class="pad" style="padding-top:0"><span class="chip steel">'+REMUN[c.tipoRemuneracao]+'</span> '
    +(c.tipoRemuneracao==='fixo_mensal'?brl(c.valorMensal)+' por mês de '+fmt(c.inicio)+' a '+fmt(c.fim):'')+(c.tipoRemuneracao==='percentual_custo'?String(c.percentual).replace('.',',')+'% do custo apropriado no mês':'')+(c.obs?'<div class="small muted" style="margin-top:6px;white-space:pre-wrap">'+esc(c.obs)+'</div>':'')+anexosHtml(c.anexos)+'</div>'
    +'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Competência</th><th class="num">Receita prevista</th></tr></thead><tbody>'+ms.map(function(m){ return '<tr><td>'+mesNome(m)+'</td><td class="num">'+brl(receitaPrevista(o,m))+'</td></tr>'; }).join('')+'</tbody></table></div></section>';
}

/* ---------- (aba e página DRE definidas mais adiante) ---------- */
Object.assign(A5,{
  'emp-nova':function(){ empresaForm(); },
  'emp-editar':function(d){ empresaForm(G('empresas',d.id)); },
  'emp-ativar':async function(d){ var e=G('empresas',d.id); var rec=Object.assign({}, e, {ativa:e.ativa===false}); delete rec.id; await Store.set('empresas', d.id, rec); },
  'cc-editar':function(d){ contratoClienteForm(d.oid); },
  'cc-excluir':async function(d){ var ok=await confirmDlg('Excluir o contrato do cliente?','<p>A receita prevista da obra deixa de existir. Lançamentos já feitos não são apagados.</p>','Excluir',true); if(ok){ await Store.del('contratosCliente','cc_'+d.oid); closeDlg(); } }
});

/* ================= LANÇAMENTOS E DRE ================= */
var LANC_CAT={receita:'Receita', imposto:'Imposto sobre a receita', custo_direto:'Custo direto', despesa_geral:'Despesa geral'};
var LANC_SUG={receita:['Fee de gestão','Honorários','Remuneração conforme contrato'], imposto:['Impostos sobre a receita'], custo_direto:['Folha da equipe alocada','Deslocamento','Software da obra','Materiais de escritório da obra'], despesa_geral:['Aluguel do escritório','Contabilidade','Software','Folha administrativa']};
var ORIGEM_LANC={manual:'Manual', contrato:'Contrato', imposto_auto:'Imposto automático'};
function mesesEntre(a,b){ var out=[]; for(var m=a; m<=b && out.length<240; m=mesAdd(m,1)) out.push(m); return out; }
function perPadrao(){ var m=hoje().slice(0,7); return {ini:m, fim:m}; }
function perAnterior(p){ var n=mesesEntre(p.ini,p.fim).length||1; return {ini:mesAdd(p.ini,-n), fim:mesAdd(p.ini,-1)}; }
function perRotulo(p){ return p.ini===p.fim?mesNome(p.ini):mesNome(p.ini)+' a '+mesNome(p.fim); }
function lancDaObra(oid){ return byObra('lancamentos',oid); }
function lancDeEmpresa(eid){ return L('lancamentos').filter(function(l){ return (l.empresaId||'')===(eid||''); }); }
function somaLanc(lista,cat,mes){ return r2(lista.filter(function(l){ return l.categoria===cat && (!mes||l.competencia===mes); }).reduce(function(s,l){ return s+(Number(l.valor)||0); },0)); }
function receitaBrutaMes(oid,mes){ return somaLanc(lancDaObra(oid),'receita',mes); }
function empresaOuPadrao(eid){ return (eid&&G('empresas',eid))||{id:eid||'', criterioRateio:'receita', rateioManual:{}}; }
function rateioMes(eid,mes){
  var emp=empresaOuPadrao(eid), obras=obrasDaEmpresa(eid);
  var total=somaLanc(lancDeEmpresa(eid).filter(function(l){ return !l.obraId; }),'despesa_geral',mes);
  if(!total) return {total:0, porObra:{}, naoRateado:0};
  if(!obras.length) return {total:total, porObra:{}, naoRateado:total};
  var crit=emp.criterioRateio||'receita', pesos={};
  obras.forEach(function(o){ pesos[o.id]=crit==='receita'?receitaBrutaMes(o.id,mes):(crit==='manual'?(Number(emp.rateioManual&&emp.rateioManual[o.id])||0):1); });
  if(!Object.keys(pesos).some(function(k){ return pesos[k]>0; })) obras.forEach(function(o){ pesos[o.id]=1; });   // sem base de cálculo: partes iguais
  return {total:total, porObra:repartir(total,pesos), naoRateado:0};
}
COBX.rateioMes=rateioMes;
function mesesRelevantes(oid){
  var o=G('obras',oid), M={};
  lancDaObra(oid).forEach(function(l){ M[l.competencia]=1; });
  lancDeEmpresa(o?o.empresaId:'').forEach(function(l){ if(!l.obraId&&l.categoria==='despesa_geral') M[l.competencia]=1; });
  return Object.keys(M).sort();
}
function dreObra(oid,ini,fim){
  var o=G('obras',oid), ls=lancDaObra(oid), r={receita:0,impostos:0,custos:0,despesas:0};
  mesesRelevantes(oid).filter(function(m){ return m>=ini&&m<=fim; }).forEach(function(m){
    r.receita=r2(r.receita+somaLanc(ls,'receita',m)); r.impostos=r2(r.impostos+somaLanc(ls,'imposto',m)); r.custos=r2(r.custos+somaLanc(ls,'custo_direto',m));
    r.despesas=r2(r.despesas+((rateioMes(o?o.empresaId:'',m).porObra[oid])||0));
  });
  return dreLinhas(r);
}
function dreLinhas(r){
  r.receitaLiquida=r2(r.receita-r.impostos); r.resultadoBruto=r2(r.receitaLiquida-r.custos); r.resultado=r2(r.resultadoBruto-r.despesas);
  r.margem=r.receitaLiquida>0?r.resultado/r.receitaLiquida:null; return r;
}
COBX.dreObra=dreObra; COBX.dreLinhas=dreLinhas;
function repasseObra(oid,ini,fim){
  var o=G('obras',oid), r={compras:0,medicoes:0,locacoes:0,total:0}; if(!o||!modAdm(o)) return r;
  var no=function(d){ return d&&d.slice(0,7)>=ini&&d.slice(0,7)<=fim; };
  byObra('compras',oid).forEach(function(c){ if(c.status==='pago'&&c.pedido&&no(c.pagoEm)) r.compras=r2(r.compras+c.pedido.total); });
  byObra('medicoes',oid).forEach(function(m){ if(m.status==='paga'&&no(m.pagaEm)) r.medicoes=r2(r.medicoes+(m.valorLiquido!=null?m.valorLiquido:medBruto(m))); });
  byObra('contasPagar',oid).forEach(function(c){ if(c.origem==='locacao'&&c.status==='paga'&&no(c.pagoEm)) r.locacoes=r2(r.locacoes+c.valor); });
  r.total=r2(r.compras+r.medicoes+r.locacoes); return r;
}
COBX.repasseObra=repasseObra;

/* ---------- sugestões de fechamento mensal ---------- */
function lancExiste(oid,mes,origem){ return lancDaObra(oid).filter(function(l){ return l.competencia===mes && l.origem===origem; })[0]||null; }
function sugestoesMes(o,mes){
  var out=[], jaFeitas=[];
  if(!o.empresaId) return {sugestoes:[], jaFeitas:[], erro:'Defina a empresa da obra para lançar receita e imposto.'};
  var emp=G('empresas',o.empresaId), rp=receitaPrevista(o,mes), exc=lancExiste(o.id,mes,'contrato');
  if(exc) jaFeitas.push(exc); else if(rp>0) out.push({categoria:'receita', subcategoria:'Remuneração conforme contrato', valor:rp, origem:'contrato', descricao:'Receita prevista do contrato: '+mesNome(mes)});
  var exi=lancExiste(o.id,mes,'imposto_auto');
  if(exi) jaFeitas.push(exi);
  else if(emp&&emp.aliquotaImpostos>0){
    var base=r2(receitaBrutaMes(o.id,mes)+(exc?0:(rp>0?rp:0)));
    if(base>0) out.push({categoria:'imposto', subcategoria:'Impostos sobre a receita', valor:r2(base*emp.aliquotaImpostos/100), origem:'imposto_auto', descricao:'Imposto de '+String(emp.aliquotaImpostos).replace('.',',')+'% sobre a receita de '+mesNome(mes)});
  }
  return {sugestoes:out, jaFeitas:jaFeitas, erro:''};
}
COBX.sugestoesMes=sugestoesMes;
async function confirmarSugestao(o,mes,s){
  await Store.add('lancamentos',{empresaId:o.empresaId, obraId:o.id, competencia:mes, categoria:s.categoria, subcategoria:s.subcategoria, valor:s.valor, descricao:s.descricao, origem:s.origem, anexos:[], criadoEm:new Date().toISOString(), por:Store.uid||null});
}

/* ---------- lançamentos ---------- */
function lancForm(l, fixo){
  fixo=fixo||{};
  var obraFixa=fixo.obraId?G('obras',fixo.obraId):(l&&l.obraId?G('obras',l.obraId):null), empId=obraFixa?obraFixa.empresaId:(fixo.empresaId||(l&&l.empresaId)||'');
  if(obraFixa&&!obraFixa.empresaId){ blockDlg('Defina a empresa da obra',['O lançamento pertence a uma empresa. Edite a obra e escolha a empresa do grupo.'],'Obra sem empresa'); return; }
  var obrasEmp=empId?obrasDaEmpresa(empId):[], cats=obraFixa?['receita','imposto','custo_direto']:(empId?Object.keys(LANC_CAT):['despesa_geral']), escolherEmp=!empId&&!obraFixa;
  openForm({title:l?'Editar lançamento':'Novo lançamento', wide:true, intro:esc(empresaNome(empId)||'Sem empresa')+(obraFixa?' — '+esc(obraFixa.nome):''),
    fields:[[{name:'categoria',label:'Categoria',type:'select',required:true,options:cats.map(function(k){ return [k,LANC_CAT[k]]; }),value:l?l.categoria:cats[0]},{name:'competencia',label:'Competência',type:'month',required:true,value:l?l.competencia:hoje().slice(0,7)}],
      escolherEmp?{name:'empresaId',label:'Empresa',type:'select',required:true,options:selOpts(empresasAtivas().map(function(e){ return [e.id,e.nome]; }),'Selecione…')}:null,
      (obraFixa||escolherEmp)?null:{name:'obraId',label:'Obra (vazio = despesa geral da empresa)',type:'select',options:selOpts(obrasEmp.map(function(o){ return [o.id,o.nome]; }),'Sem obra (despesa geral)'),value:l&&l.obraId},
      {name:'subcategoria',label:'Subcategoria',value:l&&l.subcategoria,hint:'Sugestões: '+Object.keys(LANC_SUG).map(function(k){ return LANC_SUG[k].join(', '); }).join(' · ')},
      [{name:'valor',label:'Valor (R$, sempre positivo)',type:'number',min:0,step:'0.01',required:true,value:l&&l.valor},{name:'descricao',label:'Descrição',value:l&&l.descricao}],
      {name:'anexos',label:'Comprovante (foto ou PDF)',type:'anexos',value:(l&&l.anexos)||[]}].filter(Boolean),
    extra:l?'<button type="button" class="btn danger" data-act="lanc-excluir" data-id="'+l.id+'" style="margin-right:auto">Excluir</button>':'',
    onSubmit:async function(v){
      var emp_=empId||v.empresaId||''; if(!emp_) return 'Escolha a empresa.';
      if(!/^\d{4}-\d{2}$/.test(v.competencia||'')) return 'Informe a competência (mês e ano).';
      if(!(v.valor>0)) return 'Informe o valor, sempre positivo (o sinal vem da categoria).';
      var obraId=obraFixa?obraFixa.id:(v.obraId||'');
      if(v.categoria==='despesa_geral'&&obraId) return 'Despesa geral não tem obra: ela é rateada entre as obras da empresa.';
      if(v.categoria!=='despesa_geral'&&!obraId) return 'Receita, imposto e custo direto precisam de uma obra.';
      var rec=Object.assign({origem:'manual', criadoEm:new Date().toISOString(), por:Store.uid||null}, l||{}, {empresaId:emp_, obraId:obraId, competencia:v.competencia, categoria:v.categoria, subcategoria:(v.subcategoria||'').trim(), valor:r2(v.valor), descricao:(v.descricao||'').trim(), anexos:v.anexos||[]});
      delete rec.id; await Store.set('lancamentos', l?l.id:nid(), rec);
    }});
}

/* ---------- aba DRE da obra ---------- */
function drePeriodoObra(){ return ui.drePer||perPadrao(); }
function dreTabelaHtml(cols){
  var linhas=[['Receita bruta','receita',''],['(−) Impostos sobre a receita','impostos',''],['= Receita líquida','receitaLiquida','t'],['(−) Custos diretos','custos',''],['= Resultado bruto','resultadoBruto','t'],['(−) Despesas gerais rateadas','despesas',''],['= Resultado do período','resultado','t2'],['Margem líquida (sobre a receita líquida)','margem','m']];
  return '<div class="tbl-scroll"><table class="tbl"><thead><tr><th></th>'+cols.map(function(c){ return '<th class="num">'+esc(c.t)+'</th>'; }).join('')+'</tr></thead><tbody>'+linhas.map(function(l){
    return '<tr'+(l[2]==='t2'?' style="background:var(--surface2)"':'')+'><td'+(l[2]?' style="font-weight:600"':'')+'>'+l[0]+'</td>'+cols.map(function(c){ var v=c.d[l[1]]; return '<td class="num"'+(l[2]?' style="font-weight:600"':'')+(l[1]==='resultado'&&v<0?' style="color:var(--crit);font-weight:600"':'')+'>'+(l[1]==='margem'?(v==null?'—':(Math.round(v*1000)/10).toString().replace('.',',')+'%'):brl(v))+'</td>'; }).join('')+'</tr>';
  }).join('')+'</tbody></table></div>';
}
function avisosDre(){ return '<div class="callout" style="margin:14px 0"><strong>Informação restrita à diretoria; o app ainda não separa perfis.</strong><p class="small">O DRE é gerencial, para acompanhar o resultado, e não é escrituração contábil. O tratamento correto do regime, do repasse e dos impostos deve ser confirmado com o contador.</p></div>'; }
function tDRE(o){
  ensureEmpresas();
  var oid=o.id, per=drePeriodoObra(), ant=perAnterior(per), adm=modAdm(o);
  var cols=[{t:perRotulo(per), d:dreObra(oid,per.ini,per.fim)},{t:'Período anterior', d:dreObra(oid,ant.ini,ant.fim)},{t:'Acumulado até '+mesCurto(per.fim), d:dreObra(oid,'0000-01',per.fim)}];
  var presets='<div class="row" style="gap:6px"><button class="btn sm" data-act="dre-preset" data-p="mes">Mês atual</button><button class="btn sm" data-act="dre-preset" data-p="trimestre">Trimestre</button><button class="btn sm" data-act="dre-preset" data-p="ano">Ano</button><label class="small muted">de <input type="month" data-chg="dre-per" data-k="ini" value="'+per.ini+'" aria-label="Início do período" style="padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"></label><label class="small muted">até <input type="month" data-chg="dre-per" data-k="fim" value="'+per.fim+'" aria-label="Fim do período" style="padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"></label></div>';
  var sm=ui.sugMes||hoje().slice(0,7), sg=sugestoesMes(o,sm), desc=ui.sugDescartadas||{};
  var sugHtml='<section class="card sec"><div class="card-h"><div><h2>Fechamento do mês</h2><p class="muted small">O app sugere a receita do contrato e o imposto; nada é lançado sem você confirmar.</p></div><label class="small muted">Mês <input type="month" data-chg="dre-sug" value="'+sm+'" aria-label="Mês do fechamento" style="padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"></label></div><div class="pad">'
    +(sg.erro?'<div class="callout">'+esc(sg.erro)+'</div>':'')
    +sg.jaFeitas.map(function(l){ return '<p class="small"><span class="chip ok">Já lançado</span> '+LANC_CAT[l.categoria]+': '+brl(l.valor)+' ('+ORIGEM_LANC[l.origem]+')</p>'; }).join('')
    +(sg.sugestoes.filter(function(x){ return !desc[o.id+sm+x.origem]; }).length?'<div class="row" style="margin:8px 0"><button class="btn primary sm" data-act="sug-todas" data-oid="'+oid+'" data-write>Confirmar todas</button></div>':'')
    +sg.sugestoes.filter(function(x){ return !desc[o.id+sm+x.origem]; }).map(function(x){ return '<div class="ficha" style="grid-template-columns:1fr auto"><div><strong>'+LANC_CAT[x.categoria]+': '+brl(x.valor)+'</strong><div class="tiny muted">'+esc(x.descricao)+'</div></div><div class="row" style="gap:6px"><button class="btn sm primary" data-act="sug-ok" data-oid="'+oid+'" data-origem="'+x.origem+'" data-write>Confirmar</button><button class="btn sm" data-act="sug-editar" data-oid="'+oid+'" data-origem="'+x.origem+'" data-write>Editar</button><button class="btn sm ghost" data-act="sug-descartar" data-oid="'+oid+'" data-origem="'+x.origem+'">Descartar</button></div></div>'; }).join('')
    +(!sg.erro&&!sg.sugestoes.length&&!sg.jaFeitas.length?'<p class="muted small">Nada a sugerir para '+mesNome(sm)+': sem contrato do cliente com receita nessa competência.</p>':'')+'</div></section>';
  var ls=lancDaObra(oid).filter(function(l){ return l.competencia>=per.ini&&l.competencia<=per.fim; }).sort(function(a,b){ return a.competencia<b.competencia?1:-1; });
  var lancHtml='<section class="card sec"><div class="card-h"><h2>Lançamentos do período</h2><button class="btn primary sm" data-act="lanc-novo" data-oid="'+oid+'" data-write>+ Lançamento</button></div>'+(ls.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Competência</th><th>Categoria</th><th>Descrição</th><th class="num">Valor</th><th></th></tr></thead><tbody>'+ls.map(function(l){ return '<tr><td>'+mesCurto(l.competencia)+'</td><td>'+LANC_CAT[l.categoria]+'<div class="tiny muted">'+esc(l.subcategoria||'')+' · '+ORIGEM_LANC[l.origem||'manual']+'</div></td><td>'+esc(short(l.descricao,60))+anexosHtml(l.anexos)+'</td><td class="num">'+brl(l.valor)+'</td><td><button class="btn sm ghost" data-act="lanc-editar" data-id="'+l.id+'" data-write>Editar</button></td></tr>'; }).join('')+'</tbody></table></div>':'<p class="muted pad">Nenhum lançamento neste período.</p>')+'</section>';
  var rp=adm?repasseObra(oid,per.ini,per.fim):null;
  var repHtml=adm?'<section class="card sec"><div class="card-h"><div><h2>Recursos de terceiros movimentados (repasse)</h2><p class="muted small">Dinheiro do cliente que passou pela Cariati no período. <strong>Não é receita nem custo da Cariati e está fora do resultado acima.</strong></p></div></div><div class="tbl-scroll"><table class="tbl"><tbody><tr><td>Compras pagas</td><td class="num">'+brl(rp.compras)+'</td></tr><tr><td>Medições pagas (líquido)</td><td class="num">'+brl(rp.medicoes)+'</td></tr><tr><td>Locações pagas</td><td class="num">'+brl(rp.locacoes)+'</td></tr><tr style="font-weight:600"><td>Total movimentado</td><td class="num">'+brl(rp.total)+'</td></tr></tbody></table></div></section>':'';
  return '<div class="sec-h"><div><h2>DRE da obra</h2><p class="muted small">'+esc(empresaNome(o.empresaId)||'Sem empresa')+' · '+perRotulo(per)+'</p></div>'+presets+'</div>'+avisosDre()
    +'<section class="card">'+dreTabelaHtml(cols)+'</section>'+repHtml+sugHtml+lancHtml+contratoClienteHtml(o);
}
Object.assign(A5,{
  'dre-preset':function(d){ var h=hoje().slice(0,7), y=h.slice(0,4); ui.drePer=d.p==='mes'?{ini:h,fim:h}:(d.p==='trimestre'?{ini:mesAdd(h,-2),fim:h}:{ini:y+'-01',fim:y+'-12'}); render(); },
  'sug-ok':async function(d){ var o=G('obras',d.oid), sm=ui.sugMes||hoje().slice(0,7), s=sugestoesMes(o,sm).sugestoes.filter(function(x){ return x.origem===d.origem; })[0]; if(s){ await confirmarSugestao(o,sm,s); toast('Lançamento confirmado.'); } },
  'sug-todas':async function(d){ var o=G('obras',d.oid), sm=ui.sugMes||hoje().slice(0,7), desc=ui.sugDescartadas||{}; var lista=sugestoesMes(o,sm).sugestoes.filter(function(x){ return !desc[o.id+sm+x.origem]; }); for(var i=0;i<lista.length;i++) await confirmarSugestao(o,sm,lista[i]); toast(plural(lista.length,'lançamento confirmado','lançamentos confirmados')+'.'); },
  'sug-descartar':function(d){ var sm=ui.sugMes||hoje().slice(0,7); ui.sugDescartadas=ui.sugDescartadas||{}; ui.sugDescartadas[d.oid+sm+d.origem]=true; render(); },
  'sug-editar':function(d){
    var o=G('obras',d.oid), sm=ui.sugMes||hoje().slice(0,7), s=sugestoesMes(o,sm).sugestoes.filter(function(x){ return x.origem===d.origem; })[0]; if(!s) return;
    openForm({title:'Editar antes de confirmar', intro:esc(s.descricao), fields:[{name:'valor',label:'Valor (R$)',type:'number',min:0,step:'0.01',required:true,value:s.valor}], submit:'Confirmar lançamento',
      onSubmit:async function(v){ if(!(v.valor>0)) return 'Informe o valor.'; await confirmarSugestao(o,sm,Object.assign({}, s, {valor:r2(v.valor)})); }});
  },
  'lanc-novo':function(d){ lancForm(null,{obraId:d.oid}); },
  'lanc-editar':function(d){ lancForm(G('lancamentos',d.id)); },
  'lanc-excluir':async function(d){ var ok=await confirmDlg('Excluir lançamento?','<p>O valor sai do DRE.</p>','Excluir',true); if(ok){ await Store.del('lancamentos',d.id); closeDlg(); } }
});
document.addEventListener('change', function(e){
  var el=e.target.closest('[data-chg="dre-per"]'); if(el){ var p=Object.assign({}, drePeriodoObra()); p[el.dataset.k]=el.value; if(p.ini>p.fim){ if(el.dataset.k==='ini') p.fim=p.ini; else p.ini=p.fim; } ui.drePer=p; render(); return; }
  var s=e.target.closest('[data-chg="dre-sug"]'); if(s&&s.value){ ui.sugMes=s.value; render(); }
});

/* ================= DRE POR EMPRESA E CONSOLIDADO ================= */
function dreEmpresa(eid,ini,fim){
  var ls=lancDeEmpresa(eid).filter(function(l){ return l.competencia>=ini&&l.competencia<=fim; });
  var r={receita:0,impostos:0,custos:0,despesas:0};
  ls.forEach(function(l){ var v=Number(l.valor)||0; if(l.categoria==='receita') r.receita=r2(r.receita+v); else if(l.categoria==='imposto') r.impostos=r2(r.impostos+v); else if(l.categoria==='custo_direto') r.custos=r2(r.custos+v); else if(l.categoria==='despesa_geral') r.despesas=r2(r.despesas+v); });
  return dreLinhas(r);
}
function somaDre(lista){
  var r={receita:0,impostos:0,custos:0,despesas:0};
  lista.forEach(function(d){ ['receita','impostos','custos','despesas'].forEach(function(k){ r[k]=r2(r[k]+d[k]); }); });
  return dreLinhas(r);
}
function dreConsolidado(ini,fim){ return somaDre(idsEmpresas().map(function(id){ return dreEmpresa(id,ini,fim); })); }
function idsEmpresas(){ var ids=L('empresas').map(function(e){ return e.id; }); if(L('obras').some(function(o){ return !o.empresaId; })||L('lancamentos').some(function(l){ return !l.empresaId; })) ids.push(''); return ids; }
function dreDoEscopo(escopo,ini,fim){ return escopo==='__todas'?dreConsolidado(ini,fim):dreEmpresa(escopo==='__sem'?'':escopo,ini,fim); }
// linhas "por obra" de uma empresa: as obras + o que não pertence a obra nenhuma (para o total fechar exatamente)
function dreLinhasPorObra(eid,ini,fim){
  var obras=obrasDaEmpresa(eid), linhas=obras.map(function(o){ return {nome:o.nome, oid:o.id, d:dreObra(o.id,ini,fim)}; });
  var emp=dreEmpresa(eid,ini,fim), soma=somaDre(linhas.map(function(l){ return l.d; }));
  var resto={receita:r2(emp.receita-soma.receita), impostos:r2(emp.impostos-soma.impostos), custos:r2(emp.custos-soma.custos), despesas:r2(emp.despesas-soma.despesas)};
  if(resto.receita||resto.impostos||resto.custos||resto.despesas) linhas.push({nome:resto.despesas&&!resto.receita&&!resto.impostos&&!resto.custos?'Despesas gerais sem obra para ratear':'Lançamentos sem obra', oid:'', d:dreLinhas(resto)});
  return linhas;
}
COBX.dreEmpresa=dreEmpresa; COBX.dreConsolidado=dreConsolidado; COBX.dreLinhasPorObra=dreLinhasPorObra;

function csvLancamentos(escopo,ini,fim){
  var ls=L('lancamentos').filter(function(l){ return l.competencia>=ini&&l.competencia<=fim&&(escopo==='__todas'||(l.empresaId||'')===(escopo==='__sem'?'':escopo)); }).sort(function(a,b){ return a.competencia<b.competencia?-1:(a.competencia>b.competencia?1:0); });
  var linhas=[['empresa','obra','competencia','categoria','subcategoria','descricao','valor','origem']].concat(ls.map(function(l){ var o=l.obraId?G('obras',l.obraId):null; return [empresaNome(l.empresaId)||'Sem empresa', o?o.nome:'', l.competencia, LANC_CAT[l.categoria]||l.categoria, l.subcategoria||'', l.descricao||'', String(l.valor).replace('.',','), ORIGEM_LANC[l.origem||'manual']||l.origem]; }));
  return linhas.map(function(l){ return csvLinha(l,';'); }).join('\r\n')+'\r\n';
}
COBX.csvLancamentos=csvLancamentos;

function drePerGlobal(){ return ui.drePerG||perPadrao(); }
function vDRE(){
  ensureEmpresas();
  var per=drePerGlobal(), ant=perAnterior(per), esc_=ui.dreEsc||'__todas', emps=L('empresas').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
  var opts='<option value="__todas"'+(esc_==='__todas'?' selected':'')+'>Consolidado (todas as empresas)</option>'+emps.map(function(e){ return '<option value="'+esc(e.id)+'"'+(esc_===e.id?' selected':'')+'>'+esc(e.nome)+'</option>'; }).join('')+(idsEmpresas().indexOf('')>=0?'<option value="__sem"'+(esc_==='__sem'?' selected':'')+'>Sem empresa</option>':'');
  var estilo='padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)';
  var filtros='<div class="row" style="gap:8px;margin:12px 0"><label class="small muted">Empresa <select data-chg="dre-emp" aria-label="Empresa" style="'+estilo+'">'+opts+'</select></label><button class="btn sm" data-act="dreg-preset" data-p="mes">Mês atual</button><button class="btn sm" data-act="dreg-preset" data-p="trimestre">Trimestre</button><button class="btn sm" data-act="dreg-preset" data-p="ano">Ano</button><label class="small muted">de <input type="month" data-chg="dreg-per" data-k="ini" value="'+per.ini+'" aria-label="Início do período" style="'+estilo+'"></label><label class="small muted">até <input type="month" data-chg="dreg-per" data-k="fim" value="'+per.fim+'" aria-label="Fim do período" style="'+estilo+'"></label><span class="grow"></span><button class="btn sm" data-act="dre-csv">Exportar CSV detalhado</button><button class="btn sm primary" data-act="despesa-nova" data-write>+ Despesa geral</button></div>';
  var cols=[{t:perRotulo(per), d:dreDoEscopo(esc_,per.ini,per.fim)},{t:'Período anterior', d:dreDoEscopo(esc_,ant.ini,ant.fim)},{t:'Acumulado até '+mesCurto(per.fim), d:dreDoEscopo(esc_,'0000-01',per.fim)}];
  var grupos=esc_==='__todas'?idsEmpresas():[esc_==='__sem'?'':esc_], linhasObra=[];
  grupos.forEach(function(g){ dreLinhasPorObra(g,per.ini,per.fim).forEach(function(l){ linhasObra.push(Object.assign({emp:empresaNome(g)||'Sem empresa'}, l)); }); });
  var tot=somaDre(linhasObra.map(function(l){ return l.d; })), fm=function(v){ return v==null?'—':(Math.round(v*1000)/10).toString().replace('.',',')+'%'; };
  var tabObra='<section class="card sec"><div class="card-h"><div><h2>Por obra</h2><p class="muted small">Despesas gerais rateadas pelo critério de cada empresa. O total fecha com o DRE acima.</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th>'+(esc_==='__todas'?'<th>Empresa</th>':'')+'<th class="num">Receita bruta</th><th class="num">Receita líquida</th><th class="num">Custos diretos</th><th class="num">Despesas rateadas</th><th class="num">Resultado</th><th class="num">Margem</th></tr></thead><tbody>'
    +(linhasObra.length?linhasObra.map(function(l){ return '<tr><td>'+(l.oid?'<a href="#/obra/'+l.oid+'/dre">'+esc(l.nome)+'</a>':esc(l.nome))+'</td>'+(esc_==='__todas'?'<td>'+esc(l.emp)+'</td>':'')+'<td class="num">'+brl(l.d.receita)+'</td><td class="num">'+brl(l.d.receitaLiquida)+'</td><td class="num">'+brl(l.d.custos)+'</td><td class="num">'+brl(l.d.despesas)+'</td><td class="num"'+(l.d.resultado<0?' style="color:var(--crit)"':'')+'><strong>'+brl(l.d.resultado)+'</strong></td><td class="num">'+fm(l.d.margem)+'</td></tr>'; }).join('')+'<tr style="font-weight:600;background:var(--surface2)"><td>Total</td>'+(esc_==='__todas'?'<td></td>':'')+'<td class="num">'+brl(tot.receita)+'</td><td class="num">'+brl(tot.receitaLiquida)+'</td><td class="num">'+brl(tot.custos)+'</td><td class="num">'+brl(tot.despesas)+'</td><td class="num">'+brl(tot.resultado)+'</td><td class="num">'+fm(tot.margem)+'</td></tr>':'<tr><td colspan="8" class="muted" style="padding:16px">Nenhuma obra nesta seleção.</td></tr>')+'</tbody></table></div></section>';
  var meses=mesesEntre(mesAdd(hoje().slice(0,7),-11),hoje().slice(0,7)), serie=meses.map(function(m){ return dreDoEscopo(esc_,m,m); });
  var g1=svgGrafico({titulo:'Receita líquida e resultado por mês (últimos 12 meses)', labels:meses.map(mesCurto), barras:[{nome:'Receita líquida',cor:'var(--steel)',v:serie.map(function(d){ return d.receitaLiquida; })},{nome:'Resultado',cor:'var(--ok)',v:serie.map(function(d){ return d.resultado; })}], fmt:kfmt});
  var rank=linhasObra.filter(function(l){ return l.oid&&l.d.margem!=null; }).sort(function(a,b){ return b.d.margem-a.d.margem; });
  var g2=rank.length?'<div style="padding:8px 0">'+rank.map(function(l){ var pc=Math.max(0,Math.min(100,l.d.margem*100)); return '<div class="hbar" style="grid-template-columns:170px 1fr 60px"><span>'+esc(short(l.nome,22))+'</span><div class="t"><i style="width:'+pc+'%;background:'+(l.d.margem<0?'var(--crit)':'var(--steel)')+'"></i></div><span class="num">'+fm(l.d.margem)+'</span></div>'; }).join('')+'</div>':'<p class="muted small pad">Sem obras com receita no período.</p>';
  return '<div class="wrap"><h1>DRE</h1><p class="muted small" style="margin-top:4px">Resultado gerencial por obra e por empresa.</p>'+avisosDre()+filtros
    +'<section class="card"><div class="card-h"><h2>'+(esc_==='__todas'?'DRE consolidado':(esc_==='__sem'?'Sem empresa':esc(empresaNome(esc_))))+'</h2></div>'+dreTabelaHtml(cols)+(esc_!=='__todas'&&esc_!=='__sem'?'<p class="tiny muted pad">Neste quadro as despesas gerais da empresa entram por inteiro, sem rateio.</p>':'')+'</section>'
    +tabObra+'<section class="card sec pad"><h3 style="margin-bottom:8px">Receita líquida e resultado por mês</h3>'+g1+'</section><section class="card sec"><div class="card-h"><h2>Ranking de margem por obra</h2></div>'+g2+'</section>'+empresasHtml()+'</div>';
}
Object.assign(A5,{
  'dreg-preset':function(d){ var h=hoje().slice(0,7), y=h.slice(0,4); ui.drePerG=d.p==='mes'?{ini:h,fim:h}:(d.p==='trimestre'?{ini:mesAdd(h,-2),fim:h}:{ini:y+'-01',fim:y+'-12'}); render(); },
  'dre-csv':function(){ var p=drePerGlobal(); baixar('dre-lancamentos-'+p.ini+'-a-'+p.fim+'.csv','﻿'+csvLancamentos(ui.dreEsc||'__todas',p.ini,p.fim),'text/csv').then(function(ok){ if(ok) toast('CSV dos lançamentos exportado.'); }); },
  'despesa-nova':function(){ var e=ui.dreEsc; lancForm(null, e&&e!=='__todas'&&e!=='__sem'?{empresaId:e}:{}); }
});
document.addEventListener('change', function(e){
  var s=e.target.closest('[data-chg="dre-emp"]'); if(s){ ui.dreEsc=s.value; render(); return; }
  var el=e.target.closest('[data-chg="dreg-per"]'); if(el){ var p=Object.assign({}, drePerGlobal()); p[el.dataset.k]=el.value; if(p.ini>p.fim){ if(el.dataset.k==='ini') p.fim=p.ini; else p.ini=p.fim; } ui.drePerG=p; render(); }
});

/* ================= RELATÓRIO MENSAL AO CLIENTE ================= */
var REL_ST={rascunho:'Rascunho', emitido:'Emitido'};
var VALID_ST={pendente:'Aguardando o cliente', validado:'Validado pelo cliente', objecao:'Objeção do cliente'};
function relDoMes(oid,mes){ return byObra('relatorios',oid).filter(function(r){ return r.mes===mes; }).sort(function(a,b){ return (a.criadoEm||'')<(b.criadoEm||'')?-1:1; }); }
function relVigente(oid,mes){ var l=relDoMes(oid,mes).filter(function(r){ return r.status==='emitido'; }).sort(function(a,b){ return (a.emitidoEm||'')<(b.emitidoEm||'')?1:-1; }); return l[0]||null; }
function relDados(o,mes){
  var oid=o.id, adm=modAdm(o), hj=hoje(), noMes=function(d){ return d&&String(d).slice(0,7)===mes; }, ev=evm(o), cv=curvasS(o), fimMes=addDays(mesAdd(mes,1)+'-01',-1);
  var d={mes:mes, geradoEm:new Date().toISOString(), adm:adm};
  d.capa={obra:o.nome, codigo:o.codigo||'', cliente:o.cliente||'', endereco:o.endereco||'', modalidade:o.modalidade, empresa:empresaNome(o.empresaId)||''};
  var lib=ETAPAS.filter(function(e){ var x=etapaDoc(oid,e.n); return x.status==='liberada'&&noMes(x.liberadaEm); }).map(function(e){ return {n:e.n,nome:e.nome}; });
  d.avanco={liberadasNoMes:lib, liberadasTotal:ETAPAS.filter(function(e){ return etapaDoc(oid,e.n).status==='liberada'; }).length, cronograma:avancoCron(oid), fisico:ev.fisPct, curva:{meses:cv.meses, plan:cv.fisPlan, real:cv.fisReal}};
  var ocs=byObra('ocorrencias',oid), conf=conformidade(oid);
  d.qualidade={conformidade:conf, abertasAgora:ocs.filter(ocAberta).length, criticasAgora:ocs.filter(function(x){ return ocAberta(x)&&x.gravidade==='critica'; }).length, abertasNoMes:ocs.filter(function(x){ return noMes(x.criadoEm); }).length, fechadasNoMes:ocs.filter(function(x){ return noMes(x.fechadaEm); }).length, retrabalho:ocs.reduce(function(s,x){ return s+(x.reabertas||0); },0)};
  var sem=0, ok=0, tot=0, causas={};
  for(var w=segunda(mes+'-01'); w<=fimMes; w=addDays(w,7)){ if(!noMes(w)&&w<mes+'-01') continue; var si=semanaInfo(oid,w); tot+=si.tot; ok+=si.ok; si.ps.forEach(function(p){ if(p.concluido===false&&p.causa) causas[p.causa]=(causas[p.causa]||0)+1; }); sem++; }
  d.planejamento={ppc:tot?ok/tot:null, pacotes:tot, concluidos:ok, causas:causas, meta:o.metaPPC==null?80:o.metaPPC};
  var meds=byObra('medicoes',oid).filter(function(m){ return noMes(m.periodoFim); });
  if(adm){
    var c=custoEtapa(oid), cs=byObra('contasPagar',oid), prox=[1,2,3].map(function(k){ var m=mesAdd(mes,k); return {mes:m, valor:r2(cs.filter(function(x){ return x.status==='aberta'&&x.vencimento&&x.vencimento.slice(0,7)===m; }).reduce(function(s,x){ return s+x.valor; },0))}; });
    d.suprimentos={pedidosNoMes:byObra('compras',oid).filter(function(x){ return x.pedido&&noMes(x.pedido.data); }).map(function(x){ return {item:x.item,valor:x.pedido.total}; }), conferidasNoMes:byObra('compras',oid).filter(function(x){ return x.conf&&noMes(x.conf.data); }).length, locacoesAtivas:byObra('locacoes',oid).filter(function(x){ return x.status==='ativa'; }).map(function(x){ return x.equipamento; })};
    d.financeiro={orcado:c.total.orcado, comprometido:c.total.comprometido, apropriado:c.total.apropriado, pago:c.total.pago, medicoes:meds.map(function(m){ return {numero:m.numero, prestador:prestNome(m.prestadorId), status:m.status, bruto:medBruto(m), liquido:m.valorLiquido!=null?m.valorLiquido:medCalc(m,o).liquido}; }), contasAbertas:r2(cs.filter(function(x){ return x.status==='aberta'; }).reduce(function(s,x){ return s+x.valor; },0)), contasVencidas:cs.filter(contaVencida).length, proximosMeses:prox, cpi:ev.cpi, spi:ev.spi, eac:ev.eac, bac:ev.bac, analise:(meds.filter(function(m){ return m.analiseDesvio; }).slice(-1)[0]||{}).analiseDesvio||''};
  } else {
    d.financeiro={medicoesAprovadas:meds.filter(function(m){ return m.status==='aprovada'||m.status==='paga'; }).map(function(m){ return {numero:m.numero, prestador:prestNome(m.prestadorId), liquido:m.valorLiquido!=null?m.valorLiquido:medCalc(m,o).liquido}; }), proximosMeses:[1,2,3].map(function(k){ var m=mesAdd(mes,k), x=desembolsoCliente(oid).filter(function(y){ return y.mes===m; })[0]; return {mes:m, valor:x?r2(x.aprovadas+x.aAprovar):0}; }), spi:ev.spi, bac:ev.bac};
  }
  d.aditivos={assinadosNoMes:adtAssinados(oid).filter(function(a){ return noMes(a.assinatura&&a.assinatura.data); }).map(function(a){ return {numero:a.numero, descricao:a.descricao, valor:adtValor(a)}; }), aguardando:adtDaObra(oid).filter(function(a){ return a.status==='aguardando_cliente'; }).map(function(a){ return {numero:a.numero, descricao:a.descricao, valor:adtValor(a), enviadoEm:(a.enviadoEm||'').slice(0,10)}; })};
  d.pendencias=byObra('materiais',oid).filter(function(m){ return m.resultado==='pendente'&&m.nivel3; }).map(function(m){ return {tipo:'Escolha de material', descricao:m.item, prazo:m.prazo}; })
    .concat(d.aditivos.aguardando.map(function(a){ return {tipo:'Aditivo nº '+a.numero, descricao:short(a.descricao,80), prazo:a.enviadoEm?addDays(a.enviadoEm,o.diasEscalar==null?7:o.diasEscalar):''}; }))
    .concat(adm?byObra('compras',oid).filter(function(c){ var nv=c.status==='aprovacao'&&!c.aprov?nivelDaCompra(o,c):null; return nv&&nv.nivel===3; }).map(function(c){ return {tipo:'Compra fora do orçado ou da alçada', descricao:c.item, prazo:limiteCompra(c)}; }):[]);
  d.documentos=DOC_LEGAIS.map(function(t){ var s=docStatusLegal(t,docLegal(oid,t.k),o); return {nome:t.n, situacao:s.t, k:s.k}; });
  d.proximos30=eventosAuto(oid).filter(function(e){ return e.data>=hj&&e.data<=addDays(hj,30)&&e.status==='agendado'; }).sort(function(a,b){ return a.data<b.data?-1:1; }).slice(0,25).map(function(e){ return {data:e.data, titulo:e.titulo}; });
  return d;
}
COBX.relDados=relDados;
function relHtml(o,rel){
  var d=rel.snapshot||rel.dados, adm=d.adm, pc=function(x){ return x==null?'—':(Math.round(x*1000)/10).toString().replace('.',',')+'%'; }, fm=function(x){ return x==null?'—':String(Math.round(x*100)/100).replace('.',','); };
  var sec=function(n,t,b){ return '<section class="card sec pad rel-sec"><h2 style="margin-bottom:8px">'+n+'. '+t+'</h2>'+b+'</section>'; };
  var lista=function(a,f,vazio){ return a.length?'<ul class="small" style="padding-left:18px">'+a.map(function(x){ return '<li>'+f(x)+'</li>'; }).join('')+'</ul>':'<p class="muted small">'+vazio+'</p>'; };
  var h='<article class="rel-doc">';
  h+='<section class="card sec pad rel-sec"><p class="small muted">Relatório mensal ao cliente'+(rel.retificacaoDe?' — <strong>retificação</strong>':'')+'</p><h1 style="margin:4px 0">'+esc(d.capa.obra)+'</h1><p>'+esc(mesNome(d.mes))+'</p><p class="small muted">'+[d.capa.cliente, d.capa.endereco, d.capa.modalidade, d.capa.empresa].filter(Boolean).map(esc).join(' · ')+(d.capa.codigo?' · '+esc(d.capa.codigo):'')+'</p></section>';
  h+=sec(2,'Resumo da engenharia', rel.textoEngenharia?'<p style="white-space:pre-wrap">'+esc(rel.textoEngenharia)+'</p>':'<p class="muted small">Sem resumo escrito.</p>');
  var cv=d.avanco.curva, g=(cv.meses||[]).length>1?svgGrafico({titulo:'Curva S física', labels:cv.meses.map(mesCurto), linhas:[{nome:'Físico planejado',cor:'var(--steel)',tracejado:true,v:cv.plan},{nome:'Físico realizado',cor:'var(--ok)',v:cv.real}], fmt:function(v){ return Math.round(v)+'%'; }}):'';
  h+=sec(3,'Avanço físico','<p>Avanço do cronograma: <strong>'+pc(d.avanco.cronograma)+'</strong> · valor executado sobre o orçamento: <strong>'+pc(d.avanco.fisico)+'</strong> · etapas liberadas: <strong>'+d.avanco.liberadasTotal+' de 22</strong></p>'+lista(d.avanco.liberadasNoMes,function(x){ return 'Etapa '+x.n+' — '+esc(x.nome)+' liberada no mês'; },'Nenhuma etapa liberada neste mês.')+g);
  h+=sec(4,'Qualidade','<p>Conformidade na primeira inspeção: <strong>'+pc(d.qualidade.conformidade)+'</strong> · ocorrências abertas: <strong>'+d.qualidade.abertasAgora+'</strong> ('+d.qualidade.criticasAgora+' crítica(s)) · abertas no mês: '+d.qualidade.abertasNoMes+' · fechadas no mês: '+d.qualidade.fechadasNoMes+' · reaberturas (retrabalho): '+d.qualidade.retrabalho+'</p>');
  var cz=Object.keys(d.planejamento.causas).map(function(k){ return (CAUSAS[k]||k)+': '+d.planejamento.causas[k]; }).join(' · ');
  h+=sec(5,'Planejamento','<p>PPC do mês: <strong>'+pc(d.planejamento.ppc)+'</strong> ('+d.planejamento.concluidos+' de '+d.planejamento.pacotes+' pacotes; meta '+d.planejamento.meta+'%)</p>'+(cz?'<p class="small muted">Causas de não cumprimento — '+esc(cz)+'</p>':''));
  if(adm){
    var f=d.financeiro, s=d.suprimentos;
    h+=sec(6,'Suprimentos e financeiro',
      '<h3>Suprimentos do mês</h3>'+lista(s.pedidosNoMes,function(x){ return 'Pedido: '+esc(x.item)+' — '+brl(x.valor); },'Nenhum pedido emitido no mês.')+'<p class="small">Recebimentos conferidos no mês: '+s.conferidasNoMes+(s.locacoesAtivas.length?' · locações ativas: '+esc(s.locacoesAtivas.join(', ')):'')+'</p>'
      +'<h3 style="margin-top:12px">Financeiro</h3><div class="tbl-scroll"><table class="tbl"><thead><tr><th class="num">Orçado</th><th class="num">Comprometido</th><th class="num">Apropriado</th><th class="num">Pago</th></tr></thead><tbody><tr><td class="num">'+brl(f.orcado)+'</td><td class="num">'+brl(f.comprometido)+'</td><td class="num">'+brl(f.apropriado)+'</td><td class="num">'+brl(f.pago)+'</td></tr></tbody></table></div>'
      +'<p class="small">Medições do mês:</p>'+lista(f.medicoes,function(m){ return 'Nº '+m.numero+' — '+esc(m.prestador||'')+' ('+MED_ST[m.status]+'): bruto '+brl(m.bruto)+', líquido '+brl(m.liquido); },'Nenhuma medição no mês.')
      +'<p class="small">Contas a pagar em aberto: <strong>'+brl(f.contasAbertas)+'</strong> ('+f.contasVencidas+' vencida(s)). Desembolso previsto: '+f.proximosMeses.map(function(x){ return mesCurto(x.mes)+' '+brl(x.valor); }).join(' · ')+'</p>'
      +'<p class="small">CPI '+fm(f.cpi)+' · SPI '+fm(f.spi)+' · custo final previsto '+(f.eac==null?'—':brl(f.eac))+(f.analise?'</p><div class="callout"><strong>Análise do desvio</strong><p class="small" style="white-space:pre-wrap">'+esc(f.analise)+'</p></div>':'</p>'));
  } else {
    var f2=d.financeiro;
    h+=sec(6,'Medições e desembolso previsto',lista(f2.medicoesAprovadas,function(m){ return 'Medição nº '+m.numero+' — '+esc(m.prestador||'')+': '+brl(m.liquido)+' a pagar pelo cliente'; },'Nenhuma medição aprovada no mês.')+'<p class="small">Desembolso previsto do cliente: '+f2.proximosMeses.map(function(x){ return mesCurto(x.mes)+' '+brl(x.valor); }).join(' · ')+' · SPI '+fm(f2.spi)+'</p>');
  }
  h+=sec(7,'Aditivos','<p class="small"><strong>Assinados no mês</strong></p>'+lista(d.aditivos.assinadosNoMes,function(a){ return 'Nº '+a.numero+' — '+esc(short(a.descricao,80))+': '+brl(a.valor); },'Nenhum.')+'<p class="small"><strong>Aguardando o cliente</strong></p>'+lista(d.aditivos.aguardando,function(a){ return 'Nº '+a.numero+' — '+esc(short(a.descricao,80))+': '+brl(a.valor); },'Nenhum.'));
  h+=sec(8,'Pendências de decisão do cliente',lista(d.pendencias,function(p){ return '<strong>'+esc(p.tipo)+'</strong>: '+esc(p.descricao)+(p.prazo?' — decidir até <strong>'+fmt(p.prazo)+'</strong>':''); },'Nenhuma decisão pendente.'));
  h+=sec(9,'Documentos e conformidade',lista(d.documentos,function(x){ return esc(x.nome)+': <span class="chip '+x.k+'">'+esc(x.situacao)+'</span>'; },''));
  h+=sec(10,'Próximos 30 dias',lista(d.proximos30,function(e){ return fmt(e.data)+' — '+esc(e.titulo); },'Nada agendado.'));
  h+=sec(11,'Fotos do mês',(rel.fotos&&rel.fotos.length)?thumbs(rel.fotos):'<p class="muted small">Sem fotos selecionadas.</p>');
  return h+'</article>';
}
function relHtmlDocumento(o,rel){
  var css=(document.querySelector('style')||{}).textContent||'';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório mensal — '+esc(o.nome)+' — '+esc(rel.mes)+'</title><style>'+css+'\nbody{padding:16px}.rel-doc{max-width:900px;margin:0 auto}</style></head><body><div class="rel-doc-wrap">'+relHtml(o,rel)+'</div></body></html>';
}
function relSelecionado(o,mes){ var l=relDoMes(o.id,mes), id=ui.relSel; return l.filter(function(r){ return r.id===id; })[0]||relVigente(o.id,mes)||l[l.length-1]||null; }
function tRelatorio(o){
  var oid=o.id, mes=ui.relMes||hoje().slice(0,7), lista=relDoMes(oid,mes), rel=relSelecionado(o,mes), emit=rel&&rel.status==='emitido';
  var head='<div class="sec-h no-print"><div><h2>Relatório mensal</h2><p class="muted small">Prestação de contas ao cliente: números ao vivo no rascunho, congelados ao emitir. Para corrigir um relatório emitido, crie uma retificação.</p></div><label class="small muted">Mês <input type="month" data-chg="rel-mes" value="'+mes+'" aria-label="Mês do relatório" style="padding:6px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"></label></div>';
  if(!lista.length) return head+'<div class="card empty no-print" style="margin-top:14px"><h3>Nenhum relatório de '+mesNome(mes)+'</h3><p>O rascunho junta avanço, qualidade, PPC, financeiro, aditivos e pendências do cliente.</p><p style="margin-top:14px"><button class="btn primary" data-act="rel-criar" data-oid="'+oid+'" data-mes="'+mes+'" data-write>Criar relatório de '+mesNome(mes)+'</button></p></div>';
  var vig=relVigente(oid,mes);
  var versoes='<div class="row no-print" style="gap:6px;margin:12px 0">'+lista.map(function(r,i){ return '<button class="btn sm'+(rel&&r.id===rel.id?' primary':'')+'" data-act="rel-abrir" data-id="'+r.id+'">'+(r.retificacaoDe?'Retificação':'Relatório')+' '+(i+1)+' · '+REL_ST[r.status]+(r.status==='emitido'&&vig&&r.id!==vig.id?' (substituído)':'')+'</button>'; }).join('')+'</div>';
  var v=rel.validacaoCliente, prazo=rel.prazoObjecao;
  var estado=emit?'<div class="callout ok no-print"><strong>Emitido em '+fmt((rel.emitidoEm||'').slice(0,10))+' por '+esc(Names.get(rel.emitidoPor))+'.</strong> Os números estão congelados.'+(rel.enviadoEm?'<br>Enviado ao cliente em '+fmt(rel.enviadoEm)+(prazo?' · prazo para objeção: <strong>'+fmt(prazo)+'</strong>':''):'<br>Ainda não registrado como enviado ao cliente.')+'<br>Cliente: <span class="chip '+(v&&v.status==='validado'?'ok':(v&&v.status==='objecao'?'crit':'warn'))+'">'+VALID_ST[(v&&v.status)||'pendente']+'</span>'+(v&&v.data?' em '+fmt(v.data):'')+(v&&v.ref?' — '+esc(v.ref):'')+(v&&v.texto?'<div class="small" style="white-space:pre-wrap">'+esc(v.texto)+'</div>':'')+'</div>':'<div class="callout no-print"><strong>Rascunho.</strong> Os números mudam junto com os dados da obra até você emitir.'+(rel.retificacaoDe?' Este relatório retifica um já emitido.':'')+'</div>';
  var acts='<div class="row no-print" style="gap:6px;margin:12px 0">'
    +(!emit?'<button class="btn" data-act="rel-texto" data-id="'+rel.id+'" data-write>Escrever resumo</button><button class="btn" data-act="rel-fotos" data-id="'+rel.id+'" data-write>Escolher fotos</button><button class="btn primary" data-act="rel-emitir" data-id="'+rel.id+'" data-write>Emitir relatório</button><button class="btn danger" data-act="rel-excluir" data-id="'+rel.id+'" data-write>Excluir rascunho</button>'
      :'<button class="btn" data-act="rel-enviar" data-id="'+rel.id+'" data-write>Registrar envio ao cliente</button><button class="btn" data-act="rel-valid" data-id="'+rel.id+'" data-write>Registrar validação ou objeção</button><button class="btn" data-act="rel-retificar" data-id="'+rel.id+'" data-write>Criar retificação</button>')
    +'<button class="btn" data-act="rel-imprimir">Imprimir / salvar como PDF</button><button class="btn" data-act="rel-html" data-id="'+rel.id+'">Baixar relatório em HTML</button></div>';
  var rr=emit?rel:Object.assign({}, rel, {dados:relDados(o,mes)});
  return head+versoes+estado+acts+relHtml(o,rr);
}
function relCriar(oid,mes,de){
  var base=de?G('relatorios',de):null;
  return Store.add('relatorios',{obraId:oid, mes:mes, status:'rascunho', textoEngenharia:base?base.textoEngenharia:'', fotos:base?(base.fotos||[]).slice():[], prazoObjecao:'', validacaoCliente:{status:'pendente'}, retificacaoDe:de||'', criadoEm:new Date().toISOString(), por:Store.uid||null, hist:[]});
}
function relFotosDlg(id){
  var r=G('relatorios',id), o=G('obras',r.obraId), sel=(r.fotos||[]).slice();
  var cand=[]; byObra('diarios',r.obraId).filter(function(x){ return String(x.data).slice(0,7)===r.mes; }).forEach(function(x){ (x.fotos||[]).forEach(function(f){ if(cand.indexOf(f)<0) cand.push(f); }); });
  sel.forEach(function(f){ if(cand.indexOf(f)<0) cand.push(f); });
  var d=openDlg('<div class="dlg-h"><h2>Fotos do relatório</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b"><p class="muted small">Até 12 fotos, escolhidas entre as do diário de '+mesNome(r.mes)+'. <strong id="rf_n"></strong></p>'
    +(cand.length?'<div class="thumbs" id="rf_grid">'+cand.map(function(f){ return '<button type="button" data-rf="'+esc(f)+'" aria-pressed="false" style="border:3px solid transparent;border-radius:6px"><img loading="lazy" src="'+esc(blobUrl(f))+'" alt="Foto do diário"></button>'; }).join('')+'</div>':'<p class="muted">Nenhuma foto no diário deste mês.</p>')+'<div class="err-msg hide" id="rf_err" role="alert"></div></div><div class="dlg-f"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rf_ok">Salvar seleção</button></div>', true);
  var pinta=function(){ Array.prototype.forEach.call(d.querySelectorAll('[data-rf]'), function(b){ var on=sel.indexOf(b.dataset.rf)>=0; b.setAttribute('aria-pressed',on?'true':'false'); b.style.borderColor=on?'var(--steel)':'transparent'; }); $('#rf_n',d).textContent=sel.length+' de 12 selecionadas.'; }; pinta();
  d.addEventListener('click', async function(e){
    var b=e.target.closest('[data-rf]');
    if(b){ var i=sel.indexOf(b.dataset.rf); if(i>=0) sel.splice(i,1); else if(sel.length>=12){ var er=$('#rf_err',d); er.textContent='O limite é de 12 fotos.'; er.classList.remove('hide'); return; } else sel.push(b.dataset.rf); pinta(); return; }
    if(e.target.closest('#rf_ok')){ await Store.set('relatorios', id, Object.assign({}, r, {fotos:sel})); closeDlg(); }
  });
}
Object.assign(A5,{
  'rel-criar':async function(d){ var id=await relCriar(d.oid,d.mes); ui.relSel=id; render(); },
  'rel-abrir':function(d){ ui.relSel=d.id; render(); },
  'rel-texto':function(d){ var r=G('relatorios',d.id); openForm({title:'Resumo da engenharia', wide:true, fields:[{name:'texto',label:'Resumo do mês para o cliente',type:'textarea',rows:8,value:r.textoEngenharia,hint:'O que aconteceu no mês, em linguagem simples.'}], onSubmit:async function(v){ if(r.status!=='rascunho') return 'Relatório emitido não pode ser alterado. Crie uma retificação.'; await Store.set('relatorios', d.id, Object.assign({}, r, {textoEngenharia:(v.texto||'').trim()})); }}); },
  'rel-fotos':function(d){ relFotosDlg(d.id); },
  'rel-emitir':async function(d){
    var r=G('relatorios',d.id), o=G('obras',r.obraId); if(r.status!=='rascunho') return;
    var ok=await confirmDlg('Emitir o relatório de '+mesNome(r.mes)+'?','<p>Os números de hoje ficam <strong>congelados</strong>: depois de emitido o relatório não muda. Para corrigir, você cria uma retificação.</p>','Emitir',false); if(!ok) return;
    await Store.set('relatorios', d.id, Object.assign({}, r, {status:'emitido', snapshot:relDados(o,r.mes), emitidoPor:Store.uid||null, emitidoEm:new Date().toISOString(), hist:(r.hist||[]).concat([{acao:'emitido', data:new Date().toISOString(), por:Store.uid||null}]).slice(-20)}));
    ui.relSel=d.id; toast('Relatório emitido.');
  },
  'rel-enviar':function(d){ var r=G('relatorios',d.id); openForm({title:'Envio ao cliente', fields:[[{name:'data',label:'Data do envio',type:'date',required:true,value:r.enviadoEm||hoje()},{name:'prazo',label:'Prazo para objeção',type:'date',required:true,value:r.prazoObjecao||addDays(hoje(),5)}]], submit:'Registrar envio',
      onSubmit:async function(v){ if(!v.data||!v.prazo) return 'Informe a data do envio e o prazo para objeção.'; if(v.prazo<v.data) return 'O prazo para objeção não pode ser antes do envio.'; await Store.set('relatorios', d.id, Object.assign({}, r, {enviadoEm:v.data, prazoObjecao:v.prazo})); }}); },
  'rel-valid':function(d){ var r=G('relatorios',d.id); openForm({title:'Validação ou objeção do cliente', intro:'A rotina financeira dentro do orçado é validada pelo cliente na prestação de contas (nível 2).',
      fields:[{name:'status',label:'Resposta do cliente',type:'radio',required:true,options:[['validado','Validou'],['objecao','Fez objeção']],value:r.validacaoCliente&&r.validacaoCliente.status!=='pendente'?r.validacaoCliente.status:''},[{name:'data',label:'Data da resposta',type:'date',required:true,value:hoje()},{name:'ref',label:'Como respondeu',ph:'Ex.: e-mail de 12/03'}],{name:'texto',label:'O que o cliente disse',type:'textarea',rows:3,hint:'Obrigatório se houver objeção.'}], submit:'Registrar',
      onSubmit:async function(v){ if(!v.status) return 'Escolha se o cliente validou ou fez objeção.'; if(v.status==='objecao'&&!(v.texto||'').trim()) return 'Descreva a objeção do cliente.'; await Store.set('relatorios', d.id, Object.assign({}, r, {validacaoCliente:{status:v.status, data:v.data, ref:(v.ref||'').trim(), texto:(v.texto||'').trim()}})); }}); },
  'rel-retificar':async function(d){ var r=G('relatorios',d.id), id=await relCriar(r.obraId,r.mes,d.id); ui.relSel=id; toast('Retificação criada como rascunho.'); render(); },
  'rel-excluir':async function(d){ var r=G('relatorios',d.id); if(r.status!=='rascunho') return; var ok=await confirmDlg('Excluir rascunho?','<p>Só rascunhos podem ser excluídos; relatórios emitidos ficam para sempre.</p>','Excluir',true); if(ok){ await Store.del('relatorios',d.id); ui.relSel=''; } },
  'rel-imprimir':function(){ try{ window.print(); }catch(e){ toast('A impressão está bloqueada neste ambiente. Use “Baixar relatório em HTML” e imprima o arquivo.', true); } },
  'rel-html':function(d){ var r=G('relatorios',d.id), o=G('obras',r.obraId), rr=r.status==='emitido'?r:Object.assign({}, r, {dados:relDados(o,r.mes)}); baixar('relatorio-'+r.mes+'-'+chave(o.nome)+'.html', relHtmlDocumento(o,rr), 'text/html').then(function(ok){ if(ok) toast('Relatório baixado.'); }); }
});
document.addEventListener('change', function(e){ var el=e.target.closest('[data-chg="rel-mes"]'); if(el&&el.value){ ui.relMes=el.value; ui.relSel=''; render(); } });

COBX.relHtml=relHtml; COBX.relHtmlDocumento=relHtmlDocumento; COBX.relVigente=relVigente;

/* ================= AVALIAÇÃO DE PRESTADORES ================= */
var AV_CRIT=[['pontualidade','Pontualidade'],['conformidade','Conformidade'],['limpeza','Limpeza'],['danos','Danos'],['seguranca','Segurança'],['documentacao','Documentação'],['reincidencia','Reincidência']];
var RECONTRATA={sim:'Sim', com_ressalvas:'Com ressalvas', nao:'Não'};
function r1(x){ return Math.round((x+(x<0?-1:1)*1e-9)*10)/10; }
function avContratosDe(oid,pid){ return byObra('contratosPrest',oid).filter(function(c){ return c.prestadorId===pid; }); }
function avSugestoes(oid,pid,ate){
  var s={pontualidade:null, conformidade:null, limpeza:null, danos:null, seguranca:null, documentacao:null, reincidencia:null};
  var pacs=byObra('pacotes',oid).filter(function(p){ return p.prestadorId===pid && (p.concluido===true||p.concluido===false); });
  if(pacs.length) s.pontualidade=r1(10*pacs.filter(function(p){ return p.concluido===true; }).length/pacs.length);
  var ocs=byObra('ocorrencias',oid).filter(function(x){ return x.prestadorId===pid; });
  if(ocs.length){
    var pts=ocs.reduce(function(t,x){ return t+(x.gravidade==='critica'?3:(x.gravidade==='importante'?1:0.3)); },0);
    s.conformidade=r1(10*(1-Math.min(1,pts/10)));
    s.reincidencia=r1(10*(1-ocs.filter(function(x){ return (x.reabertas||0)>0; }).length/ocs.length));
  }
  var termos=byObra('termos',oid).filter(function(t){ return t.saiId===pid; });
  if(termos.length) s.limpeza=r1(10*termos.filter(function(t){ return t.estado==='limpa'; }).length/termos.length);
  var cts=avContratosDe(oid,pid), valor=cts.reduce(function(t,c){ return t+(Number(c.valor)||0); },0);
  if(valor>0){ var custo=byObra('danos',oid).filter(function(d){ return d.causadorId===pid; }).reduce(function(t,d){ return t+(Number(d.custo)||0); },0); s.danos=r1(10*(1-Math.min(1,custo/(0.02*valor)))); }
  var meses=[]; cts.forEach(function(c){ if(!c.inicio||!c.fim) return; var fim=c.fim.slice(0,7), lim=(ate||hoje()).slice(0,7); if(lim<fim) fim=lim; mesesEntre(c.inicio.slice(0,7),fim).forEach(function(m){ if(meses.indexOf(m)<0) meses.push(m); }); });
  if(meses.length) s.documentacao=r1(10*meses.filter(function(m){ return prestEmDia(oid,pid,m); }).length/meses.length);
  return s;
}
function avNotaFinal(criterios,pesos){
  var soma=0, pt=0; AV_CRIT.forEach(function(c){ var n=criterios[c[0]]; if(n==null||n==='') return; var p=pesos&&pesos[c[0]]!=null?Number(pesos[c[0]]):1; if(!(p>0)) return; soma+=Number(n)*p; pt+=p; });
  return pt>0?r1(soma/pt):null;
}
COBX.avSugestoes=avSugestoes; COBX.avNotaFinal=avNotaFinal;
function avDoPrestador(pid){ return L('avaliacoes').filter(function(a){ return a.prestadorId===pid; }); }
function prestNotaMedia(pid){ var l=avDoPrestador(pid).filter(function(a){ return a.notaFinal!=null; }); return l.length?r1(l.reduce(function(s,a){ return s+a.notaFinal; },0)/l.length):null; }
function avPendentes(oid){ return byObra('contratosPrest',oid).filter(function(c){ return c.status==='encerrado' && !byObra('avaliacoes',oid).some(function(a){ return a.prestadorId===c.prestadorId; }); }); }
COBX.prestNotaMedia=prestNotaMedia; COBX.avPendentes=avPendentes;
function avCelula(pid){
  var l=avDoPrestador(pid).sort(function(a,b){ return a.data<b.data?1:-1; }); if(!l.length) return '<span class="muted small">Sem avaliação</span>';
  var m=prestNotaMedia(pid), obras={}; l.forEach(function(a){ obras[a.obraId]=1; });
  return '<span class="chip '+(m>=7?'ok':(m>=6?'warn':'crit'))+'">Nota '+String(m).replace('.',',')+'</span><div class="tiny muted">'+plural(Object.keys(obras).length,'obra avaliada','obras avaliadas')+' · última em '+fmt(l[0].data)+(l[0].recontrataria?' · recontrataria: '+RECONTRATA[l[0].recontrataria]:'')+'</div>';
}
function avForm(oid,pid,a){
  var o=G('obras',oid), p=G('prestadores',pid), cts=avContratosDe(oid,pid), sug=a?a.sugeridos:avSugestoes(oid,pid), cur=a?a.criterios:sug;
  var f=[[{name:'data',label:'Data da avaliação',type:'date',required:true,value:a?a.data:hoje()},{name:'contratoId',label:'Contrato',type:'select',options:selOpts(cts.map(function(c){ return [c.id,short(c.escopo,50)]; }),'—'),value:a&&a.contratoId}]];
  AV_CRIT.forEach(function(c){
    var k=c[0], s=sug[k];
    f.push([{name:'n_'+k,label:c[1]+' (0 a 10)',type:'number',min:0,max:10,step:'0.1',value:cur[k]==null?'':cur[k],hint:s==null?(k==='seguranca'?'Sem sugestão automática: o avaliador preenche.':'Sem dados para sugerir.'):'Sugerido: '+String(s).replace('.',',')+'. Diferença acima de 2 pontos exige justificativa.'},{name:'p_'+k,label:'Peso',type:'number',min:0,step:'0.1',value:a&&a.pesos&&a.pesos[k]!=null?a.pesos[k]:1}]);
    f.push({name:'j_'+k,label:'Justificativa de '+c[1].toLowerCase(),type:'textarea',rows:1,value:a&&a.justificativas?a.justificativas[k]:''});
  });
  f.push({name:'comentario',label:'Comentário geral',type:'textarea',rows:2,value:a&&a.comentario});
  f.push({name:'recontrataria',label:'Recontrataria?',type:'radio',required:true,options:Object.keys(RECONTRATA).map(function(k){ return [k,RECONTRATA[k]]; }),value:a&&a.recontrataria});
  openForm({title:(a?'Editar avaliação: ':'Avaliar: ')+(p?p.nome:'prestador'), wide:true, intro:'Notas de 0 a 10. As sugestões vêm dos dados da obra (provisórias) e você pode alterar qualquer nota.', fields:f,
    extra:a?'<button type="button" class="btn danger" data-act="av-excluir" data-id="'+a.id+'" style="margin-right:auto">Excluir</button>':'',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      var crit={}, pes={}, just={}, tem=false;
      for(var i=0;i<AV_CRIT.length;i++){
        var k=AV_CRIT[i][0], n=v['n_'+k], pe=v['p_'+k], j=(v['j_'+k]||'').trim();
        if(n!=null&&n!==''){
          if(!(n>=0&&n<=10)) return AV_CRIT[i][1]+': a nota vai de 0 a 10.';
          if(sug[k]!=null&&Math.abs(n-sug[k])>2&&!j) return AV_CRIT[i][1]+': a nota difere '+String(r1(Math.abs(n-sug[k]))).replace('.',',')+' pontos da sugestão ('+String(sug[k]).replace('.',',')+'). Escreva a justificativa.';
          crit[k]=n; tem=true;
        } else crit[k]=null;
        pes[k]=pe==null?1:pe; if(j) just[k]=j;
      }
      if(!tem) return 'Dê nota a ao menos um critério.';
      if(!v.recontrataria) return 'Diga se recontrataria o prestador.';
      var rec=Object.assign({}, a||{}, {obraId:oid, prestadorId:pid, contratoId:v.contratoId||'', data:v.data, criterios:crit, sugeridos:sug, justificativas:just, pesos:pes, notaFinal:avNotaFinal(crit,pes), comentario:(v.comentario||'').trim(), recontrataria:v.recontrataria, avaliadoPor:(a&&a.avaliadoPor)||Store.uid||null});
      delete rec.id; await Store.set('avaliacoes', a?a.id:nid(), rec);
    }});
}
function tAvaliacoes(o){
  var oid=o.id, avs=byObra('avaliacoes',oid).sort(function(a,b){ return a.data<b.data?1:-1; }), pend=avPendentes(oid), pids={};
  byObra('contratosPrest',oid).forEach(function(c){ pids[c.prestadorId]=c; });
  var head='<div class="sec-h"><div><h2>Avaliações de prestadores</h2><p class="muted small">Sete critérios, ao fim de cada serviço. As sugestões usam os dados da obra e você pode alterá-las (com justificativa se a diferença passar de 2 pontos).</p></div></div>';
  var pendHtml=pend.length?'<div class="callout" style="margin-top:14px"><strong>Avaliação pendente</strong><ul>'+pend.map(function(c){ return '<li>'+esc(prestNome(c.prestadorId)||'Prestador')+' — contrato encerrado <button class="btn sm" data-act="av-nova" data-oid="'+oid+'" data-p="'+c.prestadorId+'" data-write>Avaliar agora</button></li>'; }).join('')+'</ul></div>':'';
  var quem='<section class="card sec"><div class="card-h"><h2>Prestadores desta obra</h2></div>'+(Object.keys(pids).length?'<div class="tbl-scroll"><table class="tbl"><tbody>'+Object.keys(pids).map(function(pid){ return '<tr><td><strong>'+esc(prestNome(pid)||'Prestador removido')+'</strong><div class="tiny muted">'+(pids[pid].status==='encerrado'?'Contrato encerrado':'Contrato ativo')+'</div></td><td>'+avCelula(pid)+'</td><td><button class="btn sm primary" data-act="av-nova" data-oid="'+oid+'" data-p="'+pid+'" data-write>Avaliar</button></td></tr>'; }).join('')+'</tbody></table></div>':'<p class="muted pad">Nenhum contrato de prestador nesta obra. Cadastre em “Contratos e frentes”.</p>')+'</section>';
  var lista='<section class="card sec"><div class="card-h"><h2>Avaliações registradas</h2></div>'+(avs.length?avs.map(function(a){
    return '<div class="ficha" style="grid-template-columns:1fr auto"><div><strong>'+esc(prestNome(a.prestadorId)||'Prestador')+'</strong> <span class="chip '+(a.notaFinal>=7?'ok':(a.notaFinal>=6?'warn':'crit'))+'">Nota '+String(a.notaFinal).replace('.',',')+'</span> <span class="chip">Recontrataria: '+RECONTRATA[a.recontrataria]+'</span><div class="small muted">'+fmt(a.data)+' · '+AV_CRIT.filter(function(c){ return a.criterios[c[0]]!=null; }).map(function(c){ return c[1]+' '+String(a.criterios[c[0]]).replace('.',','); }).join(' · ')+'</div>'+(a.comentario?'<div class="small" style="white-space:pre-wrap">'+esc(a.comentario)+'</div>':'')+'</div><button class="btn sm ghost" data-act="av-editar" data-id="'+a.id+'" data-write>Editar</button></div>';
  }).join(''):'<p class="muted pad">Nenhuma avaliação ainda.</p>')+'</section>';
  return head+pendHtml+quem+lista;
}
Object.assign(A5,{
  'av-nova':function(d){ avForm(d.oid,d.p); },
  'av-editar':function(d){ var a=G('avaliacoes',d.id); avForm(a.obraId,a.prestadorId,a); },
  'av-excluir':async function(d){ var ok=await confirmDlg('Excluir avaliação?','<p>A nota deixa de contar no ranking do prestador.</p>','Excluir',true); if(ok){ await Store.del('avaliacoes',d.id); closeDlg(); } }
});
