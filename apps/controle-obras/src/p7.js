/* ================= FASE 7B — PÓS-OBRA: garantias, chamados, visitas e satisfação ================= */
var A7={};
var POS_SISTEMAS=['Hidráulica','Elétrica','Impermeabilização','Esquadrias','Pintura','Revestimentos','Cobertura','Áreas externas'];
var URG={critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa'};
var CH_ST={aberto:'Aberto', em_triagem:'Em triagem', visita_agendada:'Visita agendada', em_atendimento:'Em atendimento', resolvido:'Resolvido', negado:'Negado'};
var PARECER={coberto:'Coberto pela garantia', nao_coberto:'Não coberto', parcial:'Parcialmente coberto'};
var MARCOS=[30,90,180];
var NOTAS_PESQ=[['recomendacao','Você recomendaria a Cariati? (0 a 10)'],['qualidade','Qualidade da obra'],['prazo','Cumprimento do prazo'],['comunicacao','Comunicação'],['limpeza','Limpeza e organização']];
// Valores PROVISÓRIOS (dias): a Cariati define. Editáveis em Pós-obra > Chamados > Prazos de atendimento.
var SLA_PADRAO={critica:{resp:1,res:3}, alta:{resp:3,res:10}, media:{resp:7,res:30}, baixa:{resp:15,res:60}};
function slaCfg(){ var d=G('config','sla_garantia'), m={}; Object.keys(SLA_PADRAO).forEach(function(k){ m[k]=Object.assign({}, SLA_PADRAO[k], d&&d.valores&&d.valores[k]||{}); }); return m; }
function prazosPadrao(){ var d=G('config','garantia_prazos'); return (d&&d.linhas)||[]; }
function checklistVisita(){ var d=G('config','posobra_checklist'); return (d&&d.itens&&d.itens.length)?d.itens:POS_SISTEMAS.slice(); }
function ehCliente(){ return Store.papel==='cliente'; }
function entregue(o){ return !!(o&&o.entregueEm); }
function addMeses(s,n){ var p=String(s).slice(0,10).split('-').map(Number), d=new Date(p[0],p[1]-1+n,1), ult=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(p[2],ult)); return iso(d); }
function garantiaFim(g){ return g.inicio&&g.meses>0?addMeses(g.inicio,Number(g.meses)):''; }
function diasAte(s){ return s?diffDays(hoje(),s):null; }
function chAberto(c){ return c.status!=='resolvido' && c.status!=='negado'; }
function chDias(c){ return diffDays((c.criadoEm||hoje()).slice(0,10), hoje()); }
// Fora do prazo: sem resposta além do prazo de 1ª resposta, ou sem resolução além do prazo de resolução
function chForaSLA(c){
  if(!chAberto(c)||!c.criadoEm) return false;
  var d=chDias(c), resp=c.slaRespDias==null?3:c.slaRespDias, res=c.slaResDias==null?30:c.slaResDias;
  return (c.status==='aberto' && d>resp) || d>res;
}
function visitaProxima(v){ if(v.status!=='pendente'||!v.dataPrevista) return false; var d=diasAte(v.dataPrevista); return d>=0&&d<=7; }
function pesqBaixa(p){ var n=p.notas&&p.notas.recomendacao; return n!=null&&n!==''&&Number(n)<7; }

/* ---------- entrega da obra: cria garantias (prazos padrão) e as 3 visitas ---------- */
function posEntregaForm(oid){
  var o=G('obras',oid), pp=prazosPadrao();
  openForm({title:entregue(o)?'Corrigir a data de entrega':'Registrar entrega da obra',
    intro:'A garantia só começa a correr depois da entrega. '+(pp.length?'Serão criadas '+pp.length+' garantias com os prazos padrão cadastrados. ':'Ainda não há prazos de garantia padrão cadastrados: cadastre-os (Pós-obra > Garantias) para que sejam criados automaticamente. ')+'As visitas de 30, 90 e 180 dias entram na agenda.',
    fields:[{name:'data',label:'Data da entrega',type:'date',required:true,value:(o&&o.entregueEm)||hoje()}], submit:'Registrar',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data da entrega.';
      var cur=G('obras',oid); await Store.set('obras', oid, Object.assign({}, cur, {entregueEm:v.data}));
      for(var i=0;i<pp.length;i++){ var ex=G('garantias',oid+'_g'+i); await Store.set('garantias', oid+'_g'+i, Object.assign({}, ex||{}, {obraId:oid, sistema:pp[i].sistema, inicio:v.data, meses:Number(pp[i].meses), fim:addMeses(v.data,Number(pp[i].meses)), auto:true})); }
      for(var j=0;j<MARCOS.length;j++){ var m=MARCOS[j], vx=G('visitasPosObra',oid+'_v'+m); if(vx&&vx.status==='realizada') continue; await Store.set('visitasPosObra', oid+'_v'+m, Object.assign({}, vx||{}, {obraId:oid, marco:m, status:'pendente', dataPrevista:addDays(v.data,m)})); }
      toast('Entrega registrada. Garantias e visitas atualizadas.');
    }});
}
function prazosForm(){
  var pp=prazosPadrao();
  openForm({title:'Prazos de garantia padrão', intro:'Um sistema por linha, no formato “sistema; meses”. Use os prazos do Termo de Garantia da Cariati: o aplicativo não sugere valores.',
    fields:[{name:'texto',label:'Sistemas e prazos',type:'textarea',value:pp.map(function(l){ return l.sistema+'; '+l.meses; }).join('\n'),ph:'Hidráulica; 12\nElétrica; 12'}],
    onSubmit:async function(v){
      var linhas=[], erros=[];
      String(v.texto||'').split(/\r?\n/).forEach(function(l,i){ if(!l.trim()) return; var p=l.split(/[;\t]/), m=Number(String(p[1]||'').replace(',','.')); if(!p[0].trim()||!(m>0)) erros.push('Linha '+(i+1)+': use “sistema; meses” com meses maior que zero.'); else linhas.push({sistema:p[0].trim(), meses:m}); });
      if(erros.length) return erros.slice(0,4).join(' ');
      await Store.set('config','garantia_prazos',{linhas:linhas}); toast('Prazos salvos.');
    }});
}
function garantiaForm(oid,g){
  var o=G('obras',oid);
  openForm({title:g?'Editar garantia':'Nova garantia', fields:[{name:'sistema',label:'Sistema ou item',required:true,value:g&&g.sistema,ph:'Ex.: Impermeabilização da laje',hint:'Sugestões: '+POS_SISTEMAS.join(', ')},[{name:'inicio',label:'Início',type:'date',required:true,value:(g&&g.inicio)||(o&&o.entregueEm)||''},{name:'meses',label:'Prazo (meses)',type:'number',min:1,required:true,value:g&&g.meses}]],
    onSubmit:async function(v){
      if(!entregue(G('obras',oid))) return 'A garantia só começa a correr depois da entrega. Registre a entrega da obra primeiro.';
      if(!(v.sistema||'').trim()) return 'Informe o sistema ou item.'; if(!v.inicio) return 'Informe o início.'; if(!(v.meses>0)) return 'Informe o prazo em meses.';
      var rec=Object.assign({}, g||{}, {obraId:oid, sistema:v.sistema.trim(), inicio:v.inicio, meses:Number(v.meses)}); rec.fim=garantiaFim(rec); delete rec.id;
      await Store.set('garantias', g?g.id:nid(), rec);
    }});
}
function tGarantias(o){
  var oid=o.id, gs=byObra('garantias',oid).sort(function(a,b){ return (a.fim||'9')<(b.fim||'9')?-1:1; }), pp=prazosPadrao(), cli=ehCliente();
  var bar=cli?'':'<div class="row" style="gap:6px">'+(entregue(o)?'':'')+'<button class="btn" data-act="pos-entrega" data-oid="'+oid+'" data-write>'+(entregue(o)?'Corrigir data de entrega':'Registrar entrega')+'</button><button class="btn" data-act="pos-prazos" data-write>Prazos padrão</button><button class="btn primary" data-act="gar-nova" data-oid="'+oid+'" data-write>+ Garantia</button></div>';
  var h='<div class="sec-h"><div><h2>Garantias</h2><p class="muted small">'+(entregue(o)?'Obra entregue em '+fmt(o.entregueEm)+'.':'A obra ainda não foi entregue: a garantia só corre depois da entrega.')+'</p></div>'+bar+'</div>';
  if(!cli&&!pp.length) h+='<div class="callout warn sec"><strong>Nenhum prazo padrão cadastrado.</strong> Informe os prazos do Termo de Garantia da Cariati em “Prazos padrão”. O aplicativo não assume prazos nem afirma o que a lei exige.</div>';
  if(!gs.length) return h+'<div class="card sec empty"><h3>Nenhuma garantia registrada</h3><p>Registre a entrega da obra para criar as garantias dos prazos padrão.</p></div>';
  return h+'<section class="card sec tbl-scroll"><table class="tbl"><thead><tr><th>Sistema</th><th>Início</th><th class="num">Prazo</th><th>Vence em</th><th>Situação</th><th></th></tr></thead><tbody>'+gs.map(function(g){
    var d=diasAte(g.fim), k=d==null?'':(d<0?'':(d<=30?'crit':(d<=60?'warn':'ok'))), sit=d==null?'—':(d<0?'Vencida':(d===0?'Vence hoje':'Faltam '+plural(d,'dia','dias')));
    return '<tr><td><strong>'+esc(g.sistema)+'</strong></td><td>'+fmt(g.inicio)+'</td><td class="num">'+esc(String(g.meses))+' meses</td><td>'+fmt(g.fim)+'</td><td><span class="chip '+k+'">'+sit+'</span></td><td>'+(cli?'':'<button class="btn sm ghost" data-act="gar-editar" data-id="'+g.id+'" data-write>Editar</button>')+'</td></tr>';
  }).join('')+'</tbody></table></section>';
}

/* ---------- chamados de assistência técnica ---------- */
function chamadoForm(oid,c){
  var pr=L('prestadores').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); }), cli=ehCliente();
  openForm({title:c?'Editar chamado':'Novo chamado de garantia', intro:cli?'Conte o que está acontecendo. A equipe da Cariati responde dentro do prazo de atendimento.':'Registre o chamado em nome do cliente (telefone, WhatsApp, visita).',
    fields:[[{name:'sistema',label:'Sistema',required:true,value:c&&c.sistema,ph:'Ex.: Hidráulica'},{name:'ambiente',label:'Ambiente',value:c&&c.ambiente,ph:'Ex.: Banheiro da suíte'}],
      {name:'descricao',label:'O que está acontecendo',type:'textarea',required:true,value:c&&c.descricao},
      [{name:'urgencia',label:'Urgência',type:'select',options:Object.keys(URG).map(function(k){ return [k,URG[k]]; }),value:(c&&c.urgencia)||'media'}].concat(cli?[]:[{name:'prestadorId',label:'Prestador responsável',type:'select',options:selOpts(pr.map(function(p){ return [p.id,p.nome]; }),'—'),value:c&&c.prestadorId}]),
      {name:'fotos',label:'Fotos',type:'photos',value:(c&&c.fotos)||[]}],
    onSubmit:async function(v){
      if(!(v.sistema||'').trim()) return 'Informe o sistema.'; if(!(v.descricao||'').trim()) return 'Descreva o problema.';
      var sla=slaCfg()[v.urgencia]||slaCfg().media;
      var rec=c?Object.assign({}, c):{obraId:oid, status:'aberto', abertoPor:cli?'cliente':'equipe', abertoPorUid:Store.uid||null, criadoEm:new Date().toISOString(), hist:[{acao:'aberto', data:new Date().toISOString(), por:Store.uid||null}]};
      Object.assign(rec,{sistema:v.sistema.trim(), ambiente:v.ambiente||'', descricao:v.descricao.trim(), urgencia:v.urgencia, fotos:v.fotos||[]});
      if(!cli) rec.prestadorId=v.prestadorId||'';
      if(!c){ rec.slaRespDias=sla.resp; rec.slaResDias=sla.res; }
      delete rec.id; await Store.set('chamadosGarantia', c?c.id:nid(), rec); toast(c?'Chamado atualizado.':'Chamado aberto. Você será avisado das respostas.');
    }});
}
function chHist(c,acao,extra){ return (c.hist||[]).concat([Object.assign({acao:acao, data:new Date().toISOString(), por:Store.uid||null}, extra||{})]).slice(-40); }
function parecerForm(id){
  var c=G('chamadosGarantia',id);
  openForm({title:'Parecer da garantia', intro:'Diga se o problema é coberto. “Não coberto” encerra o chamado como negado e exige a justificativa.',
    fields:[{name:'parecer',label:'Parecer',type:'select',required:true,options:Object.keys(PARECER).map(function(k){ return [k,PARECER[k]]; }),value:c.parecer||'coberto'},{name:'justificativa',label:'Justificativa',type:'textarea',value:c.justificativa||'',hint:'Obrigatória quando não coberto.'}],
    onSubmit:async function(v){
      if(v.parecer==='nao_coberto' && !(v.justificativa||'').trim()) return 'Explique por que não é coberto: a justificativa é obrigatória.';
      var upd=Object.assign({}, c, {parecer:v.parecer, justificativa:(v.justificativa||'').trim(), hist:chHist(c,'parecer:'+v.parecer)}); delete upd.id;
      if(v.parecer==='nao_coberto'){ upd.status='negado'; upd.encerradoEm=hoje(); } else if(c.status==='aberto'||c.status==='em_triagem'||c.status==='negado'){ upd.status='em_atendimento'; delete upd.encerradoEm; }
      await Store.set('chamadosGarantia', id, upd); toast('Parecer registrado.');
    }});
}
function visitaChamadoForm(id){
  var c=G('chamadosGarantia',id);
  openForm({title:'Agendar visita de assistência', fields:[[{name:'data',label:'Data',type:'date',required:true},{name:'hora',label:'Hora',type:'time',value:'09:00'}]],
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      var upd=Object.assign({}, c, {status:'visita_agendada', visitaData:v.data, hist:chHist(c,'visita_agendada',{em:v.data})}); delete upd.id;
      await Store.set('chamadosGarantia', id, upd);
      await Store.add('eventos',{obraId:c.obraId, titulo:'Visita de assistência: '+short(c.sistema+(c.ambiente?' — '+c.ambiente:''),60), tipo:'Vistoria', area:'engenharia', data:v.data, hora:v.hora||'09:00', status:'agendado', reag:0, chamadoId:id});
      toast('Visita agendada e incluída na agenda.');
    }});
}
async function lancarCustoGarantia(c,id,valor){
  var o=G('obras',c.obraId), rs=['Custo de garantia registrado.'];
  await Store.set('chamadosCustos', id, {obraId:c.obraId, chamadoId:id, valor:r2(valor), data:hoje()});
  if(o&&o.empresaId){ await Store.set('lancamentos', 'gar_'+id, {empresaId:o.empresaId, obraId:c.obraId, competencia:hoje().slice(0,7), categoria:'custo_direto', subcategoria:'Garantia', valor:r2(valor), descricao:'Garantia: '+short(c.sistema+' — '+(c.descricao||''),80), origem:'garantia', chamadoId:id, anexos:[], criadoEm:new Date().toISOString(), por:Store.uid||null}); rs.push('Entrou no DRE como custo direto do mês atual.'); }
  else rs.push('A obra não tem empresa: o custo ficou no chamado, mas não foi ao DRE.');
  toast(rs.join(' '));
}
function resolverForm(id){
  var c=G('chamadosGarantia',id);
  if(c.parecer!=='coberto'&&c.parecer!=='parcial'){ toast('Registre o parecer (coberto ou parcial) antes de resolver.', true); return; }
  openForm({title:'Resolver chamado', intro:'Depois de resolvido, o cliente confirma no portal. O custo do reparo vai para o DRE como custo direto do mês atual; meses já emitidos não são alterados.',
    fields:[{name:'obs',label:'O que foi feito',type:'textarea',required:true},{name:'custo',label:'Custo do reparo (R$, se houve)',type:'number',min:0,step:'0.01'},{name:'fotos',label:'Fotos do reparo',type:'photos',value:[]}],
    onSubmit:async function(v){
      if(!(v.obs||'').trim()) return 'Descreva o que foi feito.';
      var upd=Object.assign({}, c, {status:'resolvido', resolvidoEm:hoje(), solucao:v.obs.trim(), fotosReparo:v.fotos||[], hist:chHist(c,'resolvido')}); delete upd.id; delete upd.aceiteCliente;
      await Store.set('chamadosGarantia', id, upd);
      if(v.custo>0) await lancarCustoGarantia(c,id,v.custo); else toast('Chamado resolvido. Aguardando a confirmação do cliente.');
    }});
}
function aceiteForm(id){
  openForm({title:'A resolução ficou boa?', intro:'Confirme se o problema foi resolvido. Se não foi, explique: o chamado volta para atendimento.',
    fields:[{name:'aceito',label:'Resolvido?',type:'select',options:[['sim','Sim, foi resolvido'],['nao','Não, ainda há problema']],value:'sim'},{name:'texto',label:'Comentário',type:'textarea'}],
    onSubmit:async function(v){
      var ok=v.aceito==='sim'; if(!ok&&!(v.texto||'').trim()) return 'Explique o que ainda não foi resolvido.';
      if(Store.backend==='supabase'){ try{ sbErr(await Supa.cli.rpc('aceitar_chamado',{rid:id, aceito:ok, texto:v.texto||''})); await Supa.recarregar('chamadosGarantia',id); }catch(e){ return 'Não foi possível registrar: '+(e.message||'erro'); } }
      else { var c=G('chamadosGarantia',id), upd=Object.assign({}, c, {aceiteCliente:{aceito:ok, texto:v.texto||'', data:hoje(), por:Store.uid||null}}); if(!ok) upd.status='em_atendimento'; delete upd.id; await Store.set('chamadosGarantia', id, upd); }
      toast(ok?'Obrigado! Chamado confirmado como resolvido.':'Registramos que ainda há problema. A equipe vai retomar.');
    }});
}
function slaForm(){
  var s=slaCfg(), f=[];
  Object.keys(URG).forEach(function(k){ f.push([{name:'r_'+k,label:URG[k]+': 1ª resposta (dias)',type:'number',min:0,value:s[k].resp},{name:'s_'+k,label:URG[k]+': resolução (dias)',type:'number',min:1,value:s[k].res}]); });
  openForm({title:'Prazos de atendimento (SLA)', intro:'Valores provisórios: a Cariati define. Valem para os chamados novos.', fields:f,
    onSubmit:async function(v){
      var val={}; Object.keys(URG).forEach(function(k){ val[k]={resp:Number(v['r_'+k]), res:Number(v['s_'+k])}; if(!(val[k].res>=val[k].resp)) val.__erro=URG[k]; });
      if(val.__erro) return 'Em “'+val.__erro+'” a resolução não pode ser menor que a primeira resposta.';
      await Store.set('config','sla_garantia',{valores:val}); toast('Prazos de atendimento salvos.');
    }});
}
function tChamados(o){
  var oid=o.id, cli=ehCliente(), cs=byObra('chamadosGarantia',oid).sort(function(a,b){ return (b.criadoEm||'')<(a.criadoEm||'')?-1:1; });
  var h='<div class="sec-h"><div><h2>Chamados de garantia</h2><p class="muted small">'+(cli?'Abra um chamado quando algo precisar de assistência e acompanhe o andamento.':'Assistência técnica depois da entrega: parecer, visita, reparo e confirmação do cliente.')+'</p></div><div class="row" style="gap:6px">'+(cli?'':'<button class="btn" data-act="pos-sla" data-write>Prazos de atendimento</button>')+'<button class="btn primary" data-act="cham-novo" data-oid="'+oid+'" data-own>+ '+(cli?'Abrir chamado':'Chamado')+'</button></div></div>';
  if(!cs.length) return h+'<div class="card sec empty"><h3>Nenhum chamado</h3><p>Quando algo precisar de assistência, abra um chamado aqui.</p></div>';
  return h+cs.map(function(c){
    var fora=chForaSLA(c), cus=!cli?G('chamadosCustos',c.id):null, ac=c.aceiteCliente;
    var b='';
    if(!cli){
      if(chAberto(c)){
        b+='<button class="btn sm" data-act="cham-parecer" data-id="'+c.id+'" data-write>Parecer</button> ';
        if(c.status!=='resolvido'&&c.status!=='negado') b+='<button class="btn sm" data-act="cham-visita" data-id="'+c.id+'" data-write>Agendar visita</button> <button class="btn sm primary" data-act="cham-resolver" data-id="'+c.id+'" data-write>Resolver</button> ';
      }
      b+='<button class="btn sm ghost" data-act="cham-editar" data-id="'+c.id+'" data-write>Editar</button>';
    } else if(c.status==='resolvido'&&!ac) b='<button class="btn sm primary" data-act="cham-aceite" data-id="'+c.id+'" data-own>Confirmar resolução</button>';
    return '<section class="card sec pad"><div class="row spread"><div><strong>'+esc(c.sistema)+(c.ambiente?' — '+esc(c.ambiente):'')+'</strong><div class="row" style="gap:6px;margin-top:4px"><span class="chip '+(c.status==='resolvido'?'ok':(c.status==='negado'?'':(fora?'crit':'steel')))+'">'+CH_ST[c.status]+'</span><span class="chip">'+esc(URG[c.urgencia]||'Média')+'</span>'+(fora?'<span class="chip crit">Fora do prazo</span>':'')+(c.abertoPor==='cliente'?'<span class="chip">Aberto pelo cliente</span>':'')+'</div></div><div style="white-space:nowrap">'+b+'</div></div>'
      +'<p style="margin-top:8px">'+esc(c.descricao)+'</p>'
      +'<p class="muted small" style="margin-top:6px">Aberto em '+fmt((c.criadoEm||'').slice(0,10))+(c.visitaData?' · Visita em '+fmt(c.visitaData):'')+(c.parecer?' · Parecer: '+esc(PARECER[c.parecer]):'')+(c.justificativa?' — '+esc(c.justificativa):'')+'</p>'
      +(c.solucao?'<p class="small" style="margin-top:6px"><strong>Solução:</strong> '+esc(c.solucao)+'</p>':'')
      +(ac?'<p class="small" style="margin-top:6px"><span class="chip '+(ac.aceito?'ok':'crit')+'">'+(ac.aceito?'Cliente confirmou':'Cliente contestou')+'</span> '+esc(ac.texto||'')+'</p>':'')
      +(cus?'<p class="small muted" style="margin-top:6px">Custo do reparo: '+brl(cus.valor)+'</p>':'')+'</section>';
  }).join('');
}

/* ---------- visitas de 30, 90 e 180 dias ---------- */
function visitaForm(id){
  var v0=G('visitasPosObra',id), itens=checklistVisita(), o=G('obras',v0.obraId);
  var f=[{name:'data',label:'Data da visita',type:'date',required:true,value:hoje()}];
  itens.forEach(function(it,i){ f.push([{name:'r'+i,label:it,type:'select',options:[['ok','Sem problema'],['pend','Com pendência'],['na','Não se aplica']],value:'ok'},{name:'o'+i,label:'Observação',value:''}]); });
  f.push({name:'obs',label:'Resumo para o cliente',type:'textarea'}); f.push({name:'fotos',label:'Fotos',type:'photos',value:[]});
  openForm({title:'Visita de '+v0.marco+' dias', intro:'Cada item com pendência vira um chamado de garantia. O resumo e as fotos aparecem no portal do cliente.', fields:f, submit:'Concluir visita',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      var check=itens.map(function(it,i){ return {item:it, res:v['r'+i], obs:(v['o'+i]||'').trim()}; }), pend=check.filter(function(c){ return c.res==='pend'; });
      if(pend.some(function(c){ return !c.obs; })) return 'Descreva cada pendência no campo de observação.';
      await Store.set('visitasPosObra', id, Object.assign({}, v0, {status:'realizada', dataRealizada:v.data, checklist:check, obs:(v.obs||'').trim(), fotos:v.fotos||[], por:Store.uid||null}));
      for(var i=0;i<pend.length;i++){ var sla=slaCfg().media; await Store.set('chamadosGarantia', 'vis_'+id+'_'+i, {obraId:v0.obraId, sistema:pend[i].item, ambiente:'', descricao:'Pendência da visita de '+v0.marco+' dias: '+pend[i].obs, urgencia:'media', status:'aberto', abertoPor:'equipe', criadoEm:new Date().toISOString(), slaRespDias:sla.resp, slaResDias:sla.res, origemVisita:id, fotos:[], hist:[{acao:'aberto', data:new Date().toISOString(), por:Store.uid||null}]}); }
      toast('Visita registrada.'+(pend.length?' '+plural(pend.length,'pendência virou chamado.','pendências viraram chamados.'):''));
    }});
}
function checklistForm(){
  openForm({title:'Itens do checklist de visita', intro:'Um item por linha.', fields:[{name:'texto',label:'Itens',type:'textarea',value:checklistVisita().join('\n')}],
    onSubmit:async function(v){ var it=String(v.texto||'').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean); if(!it.length) return 'Informe ao menos um item.'; await Store.set('config','posobra_checklist',{itens:it}); toast('Checklist salvo.'); }});
}
function tVisitas(o){
  var oid=o.id, cli=ehCliente(), vs=byObra('visitasPosObra',oid).sort(function(a,b){ return a.marco-b.marco; });
  var h='<div class="sec-h"><div><h2>Visitas pós-obra</h2><p class="muted small">Visitas de 30, 90 e 180 dias depois da entrega.</p></div>'+(cli?'':'<button class="btn" data-act="pos-checklist" data-write>Itens do checklist</button>')+'</div>';
  if(cli) vs=vs.filter(function(v){ return v.status==='realizada'; });
  if(!vs.length) return h+'<div class="card sec empty"><h3>'+(cli?'Nenhuma visita realizada ainda':'Nenhuma visita prevista')+'</h3><p>'+(cli?'Depois de cada visita, o resumo aparece aqui.':'Registre a entrega da obra (aba Garantias) para criar as visitas.')+'</p></div>';
  return h+vs.map(function(v){
    var d=diasAte(v.dataPrevista), pend=(v.checklist||[]).filter(function(c){ return c.res==='pend'; });
    return '<section class="card sec pad"><div class="row spread"><div><strong>Visita de '+v.marco+' dias</strong><div class="muted small">Prevista para '+fmt(v.dataPrevista)+(v.dataRealizada?' · realizada em '+fmt(v.dataRealizada):'')+'</div></div><div>'+(v.status==='realizada'?'<span class="chip ok">Realizada</span>':'<span class="chip '+(d!=null&&d<0?'crit':(d!=null&&d<=7?'warn':'steel'))+'">'+(d!=null&&d<0?'Atrasada':'Pendente')+'</span> '+(cli?'':'<button class="btn sm primary" data-act="vis-fazer" data-id="'+v.id+'" data-write>Registrar visita</button>'))+'</div></div>'
      +(v.status==='realizada'?'<p style="margin-top:8px">'+(esc(v.obs)||'<span class="muted">Sem resumo.</span>')+'</p><p class="small muted" style="margin-top:6px">'+(pend.length?plural(pend.length,'pendência','pendências')+': '+pend.map(function(c){ return esc(c.item); }).join(', '):'Nenhuma pendência.')+'</p>':'')+'</section>';
  }).join('');
}

/* ---------- satisfação do cliente ---------- */
function pesqId(oid,m){ return oid+'_'+m; }
function pesquisasPedidas(o){
  var out=[]; if(!entregue(o)) return out;
  out.push('entrega'); byObra('visitasPosObra',o.id).forEach(function(v){ if(v.status==='realizada') out.push(v.marco); });
  return out.filter(function(m){ return !G('pesquisasSatisfacao',pesqId(o.id,m)); });
}
function pesquisaForm(oid,m){
  var f=NOTAS_PESQ.map(function(n){ return {name:n[0],label:n[1],type:'number',min:0,max:10,required:true}; }); f.push({name:'comentario',label:'Comentário (opcional)',type:'textarea'});
  openForm({title:'Como foi? '+(m==='entrega'?'Entrega da obra':'Visita de '+m+' dias'), intro:'Notas de 0 a 10. Sua resposta ajuda a Cariati a melhorar e só pode ser enviada uma vez.', fields:f, submit:'Enviar respostas',
    onSubmit:async function(v){
      var notas={}; for(var i=0;i<NOTAS_PESQ.length;i++){ var k=NOTAS_PESQ[i][0], n=Number(v[k]); if(v[k]===''||v[k]==null||isNaN(n)||n<0||n>10) return 'Dê uma nota de 0 a 10 em “'+NOTAS_PESQ[i][1]+'”.'; notas[k]=n; }
      await Store.set('pesquisasSatisfacao', pesqId(oid,m), {obraId:oid, marco:m, notas:notas, comentario:(v.comentario||'').trim(), respondidaEm:new Date().toISOString(), por:Store.uid||null}); toast('Obrigado pela sua resposta!');
    }});
}
function mediaPesq(lista,k){ var v=lista.map(function(p){ return Number(p.notas&&p.notas[k]); }).filter(function(n){ return !isNaN(n); }); return v.length?r2(v.reduce(function(s,x){ return s+x; },0)/v.length):null; }
function distPesq(lista){ var d={det:0,neu:0,pro:0}; lista.forEach(function(p){ var n=Number(p.notas&&p.notas.recomendacao); if(isNaN(n)) return; if(n<=6) d.det++; else if(n<=8) d.neu++; else d.pro++; }); return d; }
function tSatisfacao(o){
  var oid=o.id, cli=ehCliente(), ps=byObra('pesquisasSatisfacao',oid), ped=pesquisasPedidas(o), h='<div class="sec-h"><div><h2>Satisfação do cliente</h2><p class="muted small">'+(cli?'Sua opinião depois da entrega e de cada visita.':'Notas de 0 a 10 dadas pelo cliente no portal.')+'</p></div></div>';
  if(cli){
    h+=ped.length?ped.map(function(m){ return '<section class="card sec pad row spread"><div><strong>'+(m==='entrega'?'Entrega da obra':'Visita de '+m+' dias')+'</strong><div class="muted small">Conte como foi.</div></div><button class="btn primary" data-act="pesq-responder" data-oid="'+oid+'" data-marco="'+m+'" data-own>Responder</button></section>'; }).join(''):'<div class="card sec empty"><h3>Nada para responder agora</h3><p>Quando houver uma nova pesquisa, ela aparece aqui.</p></div>';
    return h;
  }
  var todos=L('pesquisasSatisfacao'), mesmaTip=todos.filter(function(p){ var ob=G('obras',p.obraId); return ob&&ob.tipologia===o.tipologia; });
  var rows=['entrega'].concat(MARCOS).map(function(m){ var p=ps.filter(function(x){ return String(x.marco)===String(m); })[0]; return '<tr><td>'+(m==='entrega'?'Entrega':m+' dias')+'</td>'+(p?NOTAS_PESQ.map(function(n){ return '<td class="num">'+p.notas[n[0]]+'</td>'; }).join('')+'<td>'+esc(p.comentario||'')+'</td>':'<td colspan="'+(NOTAS_PESQ.length+1)+'" class="muted">Ainda não respondida</td>')+'</tr>'; }).join('');
  h+='<section class="card sec tbl-scroll"><table class="tbl"><thead><tr><th>Momento</th>'+NOTAS_PESQ.map(function(n){ return '<th class="num">'+esc(n[1].replace(/ \(.*\)/,'').replace('Você recomendaria a Cariati?','Recomendação'))+'</th>'; }).join('')+'<th>Comentário</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
  var cmp=function(nome,l){ var d=distPesq(l); return '<tr><td>'+nome+'</td><td class="num">'+l.length+'</td><td class="num">'+(mediaPesq(l,'recomendacao')==null?'—':String(mediaPesq(l,'recomendacao')).replace('.',','))+'</td><td class="num">'+d.pro+'</td><td class="num">'+d.neu+'</td><td class="num">'+d.det+'</td></tr>'; };
  h+='<section class="card sec"><div class="card-h"><div><h3>Indicador: satisfação do cliente</h3><p class="muted small">Média da nota de recomendação. Promotores 9–10, neutros 7–8, detratores 0–6.</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th></th><th class="num">Respostas</th><th class="num">Média</th><th class="num">Promotores</th><th class="num">Neutros</th><th class="num">Detratores</th></tr></thead><tbody>'+cmp('Esta obra',ps)+cmp('Mesma tipologia ('+esc(o.tipologia||'—')+')',mesmaTip)+cmp('Todas as obras',todos)+'</tbody></table></div></section>';
  var ev=['entrega'].concat(MARCOS).map(function(m){ var l=todos.filter(function(p){ return String(p.marco)===String(m); }); return m+':'+(mediaPesq(l,'recomendacao')==null?'—':mediaPesq(l,'recomendacao')); });
  h+='<p class="muted small">Evolução da média geral (entrega · 30 · 90 · 180 dias): '+ev.map(function(x){ var p=x.split(':'); return (p[0]==='entrega'?'entrega':p[0]+'d')+' '+String(p[1]).replace('.',','); }).join(' · ')+'</p>';
  return h;
}

/* ---------- incidência de garantia por sistema (alimenta lições e o P0) ---------- */
function garantiaInc(){
  var obrasEnt=L('obras').filter(entregue), por={};
  L('chamadosGarantia').forEach(function(c){
    var k=(c.sistema||'—').trim(), x=por[k]||(por[k]={sistema:k, chamados:0, cobertos:0, obras:{}, custo:0});
    x.chamados++; if(c.parecer==='coberto'||c.parecer==='parcial') x.cobertos++; x.obras[c.obraId]=1;
    var cu=G('chamadosCustos',c.id); if(cu) x.custo=r2(x.custo+(Number(cu.valor)||0));
  });
  return {entregues:obrasEnt.length, linhas:Object.keys(por).map(function(k){ var x=por[k]; return {sistema:x.sistema, chamados:x.chamados, cobertos:x.cobertos, obras:Object.keys(x.obras).length, custo:x.custo}; }).sort(function(a,b){ return b.chamados-a.chamados||a.sistema.localeCompare(b.sistema); })};
}
COBX.garantiaInc=garantiaInc;
function garantiaIncHtml(){
  var g=garantiaInc(); if(!g.linhas.length) return '';
  return '<section class="card sec"><div class="card-h"><div><h2>Incidência de garantia por sistema</h2><p class="muted small">Chamados de todas as obras. Serve de lição para o preço inicial e para os cuidados de execução de cada sistema ('+plural(g.entregues,'obra entregue','obras entregues')+').</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Sistema</th><th class="num">Chamados</th><th class="num">Cobertos</th><th class="num">Obras com chamado</th><th class="num">Custo dos reparos</th></tr></thead><tbody>'+g.linhas.map(function(l){ return '<tr><td>'+esc(l.sistema)+'</td><td class="num">'+l.chamados+'</td><td class="num">'+l.cobertos+'</td><td class="num">'+l.obras+(g.entregues?' de '+g.entregues:'')+'</td><td class="num">'+brl(l.custo)+'</td></tr>'; }).join('')+'</tbody></table></div></section>';
}

/* ---------- indicadores, alertas e agenda do pós-obra ---------- */
function alertasP7(o){
  var A=[], oid=o.id, base='#/obra/'+oid+'/';
  var gs=byObra('garantias',oid).filter(function(g){ var d=diasAte(g.fim); return d!=null&&d>=0&&d<=60; });
  if(gs.length) A.push({k:gs.some(function(g){ return diasAte(g.fim)<=30; })?'crit':'warn', t:plural(gs.length,'garantia vence','garantias vencem')+' em até 60 dias: '+gs.map(function(g){ return g.sistema; }).slice(0,4).join(', ')+'.', to:base+'garantias'});
  var cs=byObra('chamadosGarantia',oid).filter(chAberto), fo=cs.filter(chForaSLA);
  if(fo.length) A.push({k:'crit', t:plural(fo.length,'chamado de garantia fora do prazo','chamados de garantia fora do prazo')+'.', to:base+'chamados'});
  else if(cs.length) A.push({k:'warn', t:plural(cs.length,'chamado de garantia aberto','chamados de garantia abertos')+'.', to:base+'chamados'});
  var vs=byObra('visitasPosObra',oid).filter(visitaProxima);
  if(vs.length) A.push({k:'warn', t:plural(vs.length,'visita pós-obra','visitas pós-obra')+' nos próximos 7 dias.', to:base+'visitas'});
  var vp=byObra('visitasPosObra',oid).filter(function(v){ return v.status==='pendente'&&v.dataPrevista&&v.dataPrevista<hoje(); });
  if(vp.length) A.push({k:'warn', t:plural(vp.length,'visita pós-obra atrasada','visitas pós-obra atrasadas')+'.', to:base+'visitas'});
  var bx=byObra('pesquisasSatisfacao',oid).filter(pesqBaixa);
  if(bx.length) A.push({k:'warn', t:'Cliente respondeu a pesquisa com nota abaixo de 7: entender o motivo.', to:base+'satisfacao'});
  return A;
}
function eventosP7(o,add,b){
  var oid=o.id;
  byObra('visitasPosObra',oid).filter(function(v){ return v.status==='pendente'&&v.dataPrevista; }).forEach(function(v){ add(v.dataPrevista,'Visita pós-obra de '+v.marco+' dias','engenharia',b+'visitas'); });
  byObra('garantias',oid).filter(function(g){ return g.fim; }).forEach(function(g){ add(g.fim,'Fim da garantia: '+short(g.sistema,40),'engenharia',b+'garantias'); });
}
function indRowsP7(o){
  var out='', cs=byObra('chamadosGarantia',o.id), ab=cs.filter(chAberto), ps=byObra('pesquisasSatisfacao',o.id);
  if(cs.length) out+=indRow('Chamados de garantia','Chamados abertos (fora do prazo em destaque)', String(ab.length), ab.filter(chForaSLA).length?plural(ab.filter(chForaSLA).length,'fora do prazo','fora do prazo'):(ab.length?'Dentro do prazo':'Nenhum aberto'), ab.filter(chForaSLA).length?'crit':(ab.length?'warn':'ok'));
  if(ps.length){ var m=mediaPesq(ps,'recomendacao'); out+=indRow('Satisfação do cliente','Média da nota de recomendação (0 a 10)', String(m).replace('.',','), plural(ps.length,'resposta','respostas'), m>=9?'ok':(m>=7?'warn':'crit')); }
  return out;
}

Object.assign(A7,{
  'pos-entrega':function(d){ posEntregaForm(d.oid); },
  'pos-prazos':function(){ prazosForm(); },
  'pos-sla':function(){ slaForm(); },
  'pos-checklist':function(){ checklistForm(); },
  'gar-nova':function(d){ garantiaForm(d.oid); },
  'gar-editar':function(d){ var g=G('garantias',d.id); garantiaForm(g.obraId,g); },
  'cham-novo':function(d){ chamadoForm(d.oid); },
  'cham-editar':function(d){ var c=G('chamadosGarantia',d.id); chamadoForm(c.obraId,c); },
  'cham-parecer':function(d){ parecerForm(d.id); },
  'cham-visita':function(d){ visitaChamadoForm(d.id); },
  'cham-resolver':function(d){ resolverForm(d.id); },
  'cham-aceite':function(d){ aceiteForm(d.id); },
  'vis-fazer':function(d){ visitaForm(d.id); },
  'pesq-responder':function(d){ pesquisaForm(d.oid, d.marco==='entrega'?'entrega':Number(d.marco)); }
});
COBX.posEntregaForm=posEntregaForm; COBX.garantiaForm=garantiaForm; COBX.chamadoForm=chamadoForm; COBX.parecerForm=parecerForm; COBX.resolverForm=resolverForm; COBX.visitaForm=visitaForm; COBX.pesquisaForm=pesquisaForm; COBX.aceiteForm=aceiteForm; COBX.chForaSLA=chForaSLA; COBX.addMeses=addMeses; COBX.slaCfg=slaCfg; COBX.pesquisasPedidas=pesquisasPedidas; COBX.prazosPadrao=prazosPadrao;
