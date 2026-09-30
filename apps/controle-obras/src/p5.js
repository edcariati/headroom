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
  return {resumo:tResumo, etapas:tEtapas, cronograma:tCron, balanco:tBalanco, semana:tSemana, diario:tDiario, ocorrencias:tOcorr, entrega:tEntrega, projeto:tProjeto, compras:tCompras, estoque:tEstoque, locacoes:tLocacoes, contratos:tContratos, orcamento:tOrcamento, medicao:tMedicao, financeiro:tFinanceiro, fisfin:tFisFin, dre:tDRE, agenda:tAgenda, reunioes:tReunioes, documentos:tDocumentos};
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
