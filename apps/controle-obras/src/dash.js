/* ================= PAINEL DE INDICADORES (tela principal) =================
   Perspectivas no estilo Balanced Scorecard: Prazo e execução · Qualidade · Financeiro · Prestadores · Cliente.
   Só usa o que o app já calcula (nenhuma regra nova). Valores em R$ só para quem pode vê-los. */
function dashVeValores(){ var p=Store.papel; return !(p==='campo'||p==='cliente'); }
function dashMedia(l){ l=l.filter(function(x){ return x!=null&&!isNaN(x); }); return l.length?l.reduce(function(s,x){ return s+x; },0)/l.length:null; }
function dashBrl(x){ if(x==null) return '—'; var a=Math.abs(x); return (x<0?'-':'')+'R$ '+(a>=1e6?(a/1e6).toFixed(1).replace('.',',')+' mi':(a>=1e3?(a/1e3).toFixed(a>=1e5?0:1).replace('.',',')+' mil':a.toFixed(0))); }
function dashCor(v,bom,ruim,inverso){ if(v==null) return ''; if(inverso) return v<=bom?'ok':(v<=ruim?'warn':'crit'); return v>=bom?'ok':(v>=ruim?'warn':'crit'); }
function dashDados(){
  var todas=L('obras'), obras=todas.filter(function(o){ return !encerrada(o); }), ver=dashVeValores(), hj=hoje(), mes=hj.slice(0,7);
  var d={n:obras.length, nEnc:todas.length-obras.length, ver:ver, linhas:[], alertas:0, criticos:0};
  var ppcs=[], spis=[], cpis=[], fis=[], gast=[], conf=0, confTot=0, ocAb=0, ocCr=0, ocVenc=0, bac=0, ac=0, ev=0, rec=0, res=0, rl=0, cVenc=0, cVencV=0, cAv=0, cAvV=0, apVenc=0, medAn=0;
  obras.forEach(function(o){
    var oid=o.id, meta=o.metaPPC==null?80:o.metaPPC, ppc=ppcAtual(oid), p=ppc?ppc.ppc*100:null, e=orcVigente(oid)?evm(o):null;
    var ab=byObra('ocorrencias',oid).filter(ocAberta), cr=ab.filter(function(x){ return x.gravidade==='critica'; }).length, ve=ab.filter(vencidaOc).length;
    var al=alertasObra(o), nCrit=al.filter(function(a){ return a.k==='crit'; }).length;
    if(p!=null) ppcs.push(p); if(e&&e.spi!=null) spis.push(e.spi); if(e&&e.cpi!=null) cpis.push(e.cpi);
    if(e&&e.fisPct!=null) fis.push(e.fisPct*100); if(e&&e.gastoPct!=null) gast.push(e.gastoPct*100);
    byObra('fichas',oid).forEach(function(f){ if(f.resultado==='aprovado'||f.resultado==='reprovado'||f.resultado==='reinspecao'){ confTot++; if(f.resultado==='aprovado') conf++; } });
    ocAb+=ab.length; ocCr+=cr; ocVenc+=ve; d.alertas+=al.length; d.criticos+=nCrit;
    if(e){ bac+=e.bac; ev+=e.ev; if(e.ac!=null) ac+=e.ac; }
    if(ver){ var dr=dreObra(oid,'0000-01',mes); rec+=dr.receitaLiquida; res+=dr.resultado; rl+=dr.receitaLiquida;
      if(modAdm(o)){ byObra('contasPagar',oid).forEach(function(c){ if(contaVencida(c)){ cVenc++; cVencV+=c.valor; } else if(contaAVencer(c,7)){ cAv++; cAvV+=c.valor; } });
        byObra('aportes',oid).forEach(function(a){ if(!a.dataRecebida&&a.dataPrevista&&a.dataPrevista<hj) apVenc++; }); } }
    byObra('medicoes',oid).forEach(function(m){ if(m.status==='em_analise') medAn++; });
    var lib=ETAPAS.filter(function(x){ return etapaDoc(oid,x.n).status==='liberada'; }).length;
    d.linhas.push({o:o, ppc:p, meta:meta, spi:e?e.spi:null, cpi:e?e.cpi:null, fis:e&&e.fisPct!=null?e.fisPct*100:(lib/22*100), ab:ab.length, cr:cr, ve:ve, al:al.length, crit:nCrit, lib:lib});
  });
  d.ppc=dashMedia(ppcs); d.spi=dashMedia(spis); d.cpi=dashMedia(cpis); d.fis=dashMedia(fis); d.gasto=dashMedia(gast);
  d.conf=confTot?conf/confTot*100:null; d.ocAb=ocAb; d.ocCr=ocCr; d.ocVenc=ocVenc; d.bac=bac; d.ac=ac; d.ev=ev; d.rec=rec; d.res=res; d.margem=rl>0?res/rl*100:null;
  d.cVenc=cVenc; d.cVencV=cVencV; d.cAv=cAv; d.cAvV=cAvV; d.apVenc=apVenc; d.medAn=medAn;
  var notas=L('prestadores').map(function(p){ return prestNotaMedia(p.id); }); d.nota=dashMedia(notas); d.nNotas=notas.filter(function(x){ return x!=null; }).length;
  var docsOk=0, docsTot=0, mesP=hj.slice(0,7); obras.forEach(function(o){ var ps={}; byObra('contratosPrest',o.id).filter(function(c){ return c.status!=='encerrado'; }).forEach(function(c){ ps[c.prestadorId]=1; }); Object.keys(ps).forEach(function(pid){ docsTot++; if(prestEmDia(o.id,pid,mesP)) docsOk++; }); });
  d.docs=docsTot?docsOk/docsTot*100:null; d.docsTot=docsTot;
  var vencP=0; L('prestadores').forEach(function(p){ var s=validade(p.seguro), t=validade(p.treinamento); if(s.k==='crit'||t.k==='crit') vencP++; }); d.prestVenc=vencP;
  var pes=L('pesquisasSatisfacao'); d.sat=pes.length?mediaPesq(pes,'recomendacao'):null; d.nSat=pes.length;
  var ch=L('chamadosGarantia').filter(chAberto); d.chAb=ch.length; d.chSla=ch.filter(chForaSLA).length;
  return d;
}
function dashKpi(rot,valor,sub,cor,link,dica){
  var t='<div class="kpi'+(cor?' '+cor:'')+'"><div class="kpi-r">'+esc(rot)+(dica?' <span class="kpi-i" title="'+esc(dica)+'" tabindex="0" aria-label="'+esc(dica)+'">?</span>':'')+'</div><div class="kpi-v">'+valor+'</div><div class="kpi-s">'+(sub||'&nbsp;')+'</div></div>';
  return link?'<a class="kpi-a" href="'+link+'">'+t+'</a>':t;
}
function dashFmt1(x){ return x==null?'—':String(Math.round(x*10)/10).replace('.',','); }
function dashPct(x){ return x==null?'—':Math.round(x)+'%'; }
function dashSecao(tit,sub,kpis){ return '<section class="dash-sec"><div class="dash-h"><h2>'+esc(tit)+'</h2><span class="muted small">'+esc(sub)+'</span></div><div class="kpis">'+kpis.join('')+'</div></section>'; }
function dashBarras(d){
  if(!d.linhas.length) return '';
  var h='<section class="dash-sec card pad"><div class="dash-h"><h2>Avanço e PPC por obra</h2><span class="muted small">Avanço físico (barra) e PPC da última semana fechada (marca). Linha tracejada: meta do PPC.</span></div><div class="dbars">';
  d.linhas.forEach(function(l){
    var f=Math.max(0,Math.min(100,l.fis||0)), p=l.ppc==null?null:Math.max(0,Math.min(100,l.ppc)), c=l.ppc==null?'':(l.ppc>=l.meta?'ok':(l.ppc>=l.meta-15?'warn':'crit'));
    h+='<a class="dbar" href="#/obra/'+l.o.id+'/resumo"><span class="dbar-n">'+esc(l.o.nome)+'</span><span class="dbar-t" role="img" aria-label="'+esc(l.o.nome)+': avanço '+Math.round(f)+'%'+(p!=null?', PPC '+Math.round(p)+'%':', sem PPC')+'"><span class="dbar-f" style="width:'+f+'%"></span><span class="dbar-m" style="left:'+l.meta+'%"></span>'+(p!=null?'<span class="dbar-p '+c+'" style="left:'+p+'%"></span>':'')+'</span><span class="dbar-v num">'+Math.round(f)+'%'+(p!=null?' · PPC '+Math.round(p)+'%':'')+'</span></a>';
  });
  return h+'</div></section>';
}
function dashDonut(d){
  var tot=d.ocAb; var crit=d.ocCr, venc=Math.max(0,d.ocVenc-0), norm=Math.max(0,tot-crit);
  if(!tot) return '<section class="dash-sec card pad"><div class="dash-h"><h2>Ocorrências abertas</h2></div><p class="muted">Nenhuma ocorrência aberta nas obras em andamento.</p></section>';
  var R=42, C=2*Math.PI*R, seg=[[crit,'var(--crit)','Críticas'],[norm,'var(--steel)','Demais']], off=0, arcs='';
  seg.forEach(function(s){ if(!s[0]) return; var len=C*s[0]/tot; arcs+='<circle cx="60" cy="60" r="'+R+'" fill="none" stroke="'+s[1]+'" stroke-width="16" stroke-dasharray="'+len+' '+(C-len)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 60 60)"></circle>'; off+=len; });
  return '<section class="dash-sec card pad"><div class="dash-h"><h2>Ocorrências abertas</h2></div><div class="ddon"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="'+tot+' ocorrências abertas, '+crit+' críticas"><circle cx="60" cy="60" r="'+R+'" fill="none" stroke="var(--line2)" stroke-width="16"></circle>'+arcs+'<text x="60" y="58" text-anchor="middle" class="ddon-n">'+tot+'</text><text x="60" y="74" text-anchor="middle" class="ddon-l">abertas</text></svg><ul class="dleg">'
    +'<li><span class="dot crit"></span>Críticas <strong class="num">'+crit+'</strong></li><li><span class="dot steel"></span>Demais <strong class="num">'+norm+'</strong></li><li><span class="dot warn"></span>Com prazo vencido <strong class="num">'+d.ocVenc+'</strong></li></ul></div></section>';
}
function dashTabela(d){
  if(!d.linhas.length) return '';
  var rows=d.linhas.slice().sort(function(a,b){ return (b.crit-a.crit)||(b.al-a.al); }).map(function(l){
    var sc=l.crit?'crit':(l.al?'warn':'ok'), cc=function(v){ return v==null?'':(v>=1?'ok':(v>=0.9?'warn':'crit')); };
    return '<tr><td><a href="#/obra/'+l.o.id+'/resumo"><strong>'+esc(l.o.nome)+'</strong></a><div class="muted tiny">'+esc(l.o.modalidade||'')+'</div></td><td><span class="dot '+sc+'" title="'+(l.crit?'Tem alerta crítico':(l.al?'Tem alertas':'Sem alertas'))+'"></span></td><td class="num">'+l.lib+'/22</td><td class="num"><span class="chip '+(l.ppc==null?'':(l.ppc>=l.meta?'ok':'warn'))+'">'+(l.ppc==null?'—':Math.round(l.ppc)+'%')+'</span></td>'
      +'<td class="num"><span class="chip '+cc(l.spi)+'">'+(l.spi==null?'—':dashFmt1(l.spi))+'</span></td>'+(d.ver?'<td class="num"><span class="chip '+cc(l.cpi)+'">'+(l.cpi==null?'—':dashFmt1(l.cpi))+'</span></td>':'')
      +'<td class="num">'+l.ab+(l.cr?' <span class="chip crit">'+l.cr+' crít.</span>':'')+'</td><td class="num">'+l.al+'</td></tr>';
  }).join('');
  return '<section class="dash-sec card"><div class="card-h"><div><h2>Obras lado a lado</h2><p class="muted small">Ordenadas por gravidade dos alertas. Toque no nome para abrir a obra.</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Obra</th><th></th><th class="num">Etapas</th><th class="num">PPC</th><th class="num">SPI</th>'+(d.ver?'<th class="num">CPI</th>':'')+'<th class="num">Ocorrências</th><th class="num">Alertas</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function vDashboard(){
  var d=dashDados(); if(!d.n&&!d.nEnc) return '';
  if(!d.n) return '<section class="dash-sec card pad"><p class="muted">Todas as obras estão encerradas. Os indicadores mostram obras em andamento.</p></section>';
  var prazo=[
    dashKpi('Obras em andamento', '<span class="num">'+d.n+'</span>', d.nEnc?d.nEnc+' encerrada'+(d.nEnc>1?'s':''):'', ''),
    dashKpi('PPC médio', dashPct(d.ppc), 'Meta '+(d.linhas[0]?d.linhas[0].meta:80)+'%', dashCor(d.ppc,d.linhas[0]?d.linhas[0].meta:80,(d.linhas[0]?d.linhas[0].meta:80)-15), null, 'Pacotes 100% concluídos ÷ pacotes planejados, na última semana fechada de cada obra.'),
    dashKpi('SPI médio', dashFmt1(d.spi), d.spi==null?'sem cronograma e orçamento':(d.spi>=1?'no ritmo ou adiantado':'atrasado'), dashCor(d.spi,1,0.9), null, 'Avanço físico real ÷ avanço planejado. Abaixo de 1 = atraso.'),
    dashKpi('Avanço físico', dashPct(d.fis), d.gasto!=null&&d.ver?'gasto: '+dashPct(d.gasto):'média das obras', ''),
    dashKpi('Medições em análise', '<span class="num">'+d.medAn+'</span>', d.medAn?'esperando decisão':'nenhuma parada', d.medAn?'warn':'ok')
  ];
  var qual=[
    dashKpi('Ocorrências abertas', '<span class="num">'+d.ocAb+'</span>', d.ocCr?d.ocCr+' crítica'+(d.ocCr>1?'s':''):'nenhuma crítica', d.ocCr?'crit':(d.ocAb?'warn':'ok')),
    dashKpi('Apontamentos vencidos', '<span class="num">'+d.ocVenc+'</span>', d.ocVenc?'cobrar os prestadores':'em dia', d.ocVenc?'warn':'ok'),
    dashKpi('Conformidade das fichas', dashPct(d.conf), d.conf==null?'nenhuma ficha inspecionada':'aprovadas ÷ inspecionadas', dashCor(d.conf,90,75), null, 'Fichas de verificação aprovadas sobre as já inspecionadas.'),
    dashKpi('Alertas ativos', '<span class="num">'+d.alertas+'</span>', d.criticos?d.criticos+' crítico'+(d.criticos>1?'s':''):'nenhum crítico', d.criticos?'crit':(d.alertas?'warn':'ok'))
  ];
  var fin=[];
  if(d.ver){
    fin=[
      dashKpi('Orçamento revisado', '<span class="mo">'+dashBrl(d.bac)+'</span>', d.bac?'total das obras com orçamento':'importe o orçamento', ''),
      dashKpi('Custo apropriado', '<span class="mo">'+dashBrl(d.ac)+'</span>', d.bac&&d.ac!=null?dashPct(d.ac/d.bac*100)+' do orçado (Administração)':'obras em Administração', ''),
      dashKpi('CPI médio', dashFmt1(d.cpi), d.cpi==null?'sem custo apropriado':(d.cpi>=1?'dentro do orçado':'acima do orçado'), dashCor(d.cpi,1,0.9), null, 'Valor agregado ÷ custo real. Abaixo de 1 = custando mais que o previsto.'),
      dashKpi('Margem do resultado', d.margem==null?'—':dashPct(d.margem), d.margem==null?'sem lançamentos no DRE':'resultado '+dashBrl(d.res), d.margem==null?'':(d.margem>=0?'ok':'crit'), '#/dre', 'Resultado acumulado ÷ receita líquida (DRE gerencial).'),
      dashKpi('Contas vencidas', '<span class="num">'+d.cVenc+'</span>', d.cVenc?dashBrl(d.cVencV):(d.cAv?d.cAv+' vencem em 7 dias':'nenhuma'), d.cVenc?'crit':(d.cAv?'warn':'ok')),
      dashKpi('Aportes atrasados', '<span class="num">'+d.apVenc+'</span>', d.apVenc?'cobrar o cliente':'em dia', d.apVenc?'warn':'ok')
    ];
  }
  var pres=[
    dashKpi('Nota média dos prestadores', dashFmt1(d.nota), d.nNotas?d.nNotas+' avaliado'+(d.nNotas>1?'s':''):'sem avaliações', dashCor(d.nota,8,6), '#/prestadores'),
    dashKpi('Documentos do mês em dia', dashPct(d.docs), d.docsTot?d.docsTot+' prestador'+(d.docsTot>1?'es':'')+' com contrato':'sem contratos', dashCor(d.docs,90,60), null, 'INSS, FGTS, folha e certidões conferidos no mês.'),
    dashKpi('Seguro ou treinamento vencido', '<span class="num">'+d.prestVenc+'</span>', d.prestVenc?'prestadores a regularizar':'tudo válido', d.prestVenc?'crit':'ok', '#/prestadores')
  ];
  var cli=[
    dashKpi('Satisfação do cliente', dashFmt1(d.sat), d.nSat?d.nSat+' resposta'+(d.nSat>1?'s':'')+' (0 a 10)':'sem respostas ainda', dashCor(d.sat,9,7)),
    dashKpi('Chamados de garantia abertos', '<span class="num">'+d.chAb+'</span>', d.chSla?d.chSla+' fora do prazo':'dentro do prazo', d.chSla?'crit':(d.chAb?'warn':'ok'))
  ];
  return '<div class="dash">'
    +dashSecao('Prazo e execução','Ritmo das obras',prazo)+dashSecao('Qualidade em campo','Ocorrências e fichas',qual)
    +(d.ver?dashSecao('Financeiro','Orçado, custo e resultado',fin):'')
    +'<div class="dash-duo">'+dashBarras(d)+dashDonut(d)+'</div>'
    +dashSecao('Prestadores','Desempenho e documentos',pres)+dashSecao('Cliente','Satisfação e pós-obra',cli)
    +dashTabela(d)+'</div>';
}
COBX.dashDados=dashDados; COBX.vDashboard=vDashboard;
