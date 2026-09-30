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

/* ---------- aba DRE da obra (o DRE em si vem no passo 2) e página DRE ---------- */
function tDRE(o){ ensureEmpresas(); return '<div class="sec-h"><div><h2>DRE da obra</h2></div></div>'+contratoClienteHtml(o); }
function vDRE(){ ensureEmpresas(); return '<div class="wrap"><h1>DRE</h1><p class="muted small" style="margin-top:4px">Resultado gerencial por obra e por empresa.</p>'+empresasHtml()+'</div>'; }
Object.assign(A5,{
  'emp-nova':function(){ empresaForm(); },
  'emp-editar':function(d){ empresaForm(G('empresas',d.id)); },
  'emp-ativar':async function(d){ var e=G('empresas',d.id); var rec=Object.assign({}, e, {ativa:e.ativa===false}); delete rec.id; await Store.set('empresas', d.id, rec); },
  'cc-editar':function(d){ contratoClienteForm(d.oid); },
  'cc-excluir':async function(d){ var ok=await confirmDlg('Excluir o contrato do cliente?','<p>A receita prevista da obra deixa de existir. Lançamentos já feitos não são apagados.</p>','Excluir',true); if(ok){ await Store.del('contratosCliente','cc_'+d.oid); closeDlg(); } }
});
