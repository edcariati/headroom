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
  return {resumo:tResumo, etapas:tEtapas, cronograma:tCron, balanco:tBalanco, semana:tSemana, diario:tDiario, ocorrencias:tOcorr, entrega:tEntrega, projeto:tProjeto, compras:tCompras, estoque:tEstoque, locacoes:tLocacoes, contratos:tContratos, orcamento:tOrcamento, medicao:tMedicao, financeiro:tFinanceiro, fisfin:tFisFin, agenda:tAgenda, reunioes:tReunioes, documentos:tDocumentos};
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
