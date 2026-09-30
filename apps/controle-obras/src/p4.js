/* ================= FASE 4 ================= */
var COBX={};   // funções expostas só para os testes (ver boot.js)
var TIPOS_ITEM={material:'Material', mao_de_obra:'Mão de obra', equipamento:'Equipamento', empreitada:'Empreitada'};
var ADT_TIPO={acrescimo:'Acréscimo', supressao:'Supressão', prazo:'Prazo'};
var ADT_ST={rascunho:'Rascunho', aguardando_cliente:'Aguardando o cliente', assinado:'Assinado', recusado:'Recusado'};

function r2(x){ x=Number(x)||0; return Math.round((x+(x<0?-1:1)*1e-9)*100)/100; }
function semAcento(s){ return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,''); }
function chave(s){ return semAcento(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
function numBR(s){
  var v=String(s==null?'':s).trim().replace(/R\$/i,'').replace(/\s/g,'');
  if(v==='') return NaN;
  if(v.indexOf(',')>=0 && v.indexOf('.')>=0){ v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,''); }
  else if(v.indexOf(',')>=0){ v=v.replace(',','.'); }
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(v)){ v=v.replace(/\./g,''); }
  return /^-?\d*\.?\d+$/.test(v)?Number(v):NaN;
}
function csvParse(texto){
  var t=String(texto||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  var cab=t.split('\n')[0]||'', sep=cab.indexOf(';')>=0?';':(cab.indexOf('\t')>=0?'\t':',');
  var rows=[], row=[], cur='', q=false;
  for(var i=0;i<t.length;i++){
    var c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else if(c==='"') q=true;
    else if(c===sep){ row.push(cur); cur=''; }
    else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else cur+=c;
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(function(r){ return r.some(function(x){ return String(x).trim()!==''; }); });
}
function csvLinha(vals, sep){
  return vals.map(function(v){ v=v==null?'':String(v); return (v.indexOf(sep)>=0||v.indexOf('"')>=0||v.indexOf('\n')>=0)?'"'+v.replace(/"/g,'""')+'"':v; }).join(sep);
}
async function baixar(nome, texto, mime){
  var dl=null; try{ dl=window.claude && await window.claude.use('downloads'); }catch(e){}
  if(dl){ try{ await dl.save({filename:nome, data:texto}); return true; }catch(e){ if(e&&e.code==='declined') return false; } }
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([texto],{type:(mime||'text/plain')+';charset=utf-8'})); a.download=nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000); return true;
}
function tipoItemNorm(s){
  var k=chave(s);
  if(k==='material'||k==='materiais') return 'material';
  if(k==='mao_de_obra'||k==='mao_obra'||k==='mo') return 'mao_de_obra';
  if(k==='equipamento'||k==='equipamentos') return 'equipamento';
  if(k==='empreitada'||k==='empreitadas'||k==='subempreitada') return 'empreitada';
  return '';
}
COBX.r2=r2; COBX.numBR=numBR; COBX.csvParse=csvParse;

/* ---------- orçamento: leitura e validação do CSV ---------- */
var ORC_COLS={codigo:['codigo','cod'], etapa:['etapa'], descricao:['descricao','servico','descricao_do_servico'], unidade:['unidade','un','und'], quantidade:['quantidade','qtd','qtde','quant'], preco_unitario:['preco_unitario','preco_unit','valor_unitario','preco','pu','custo_unitario'], tipo:['tipo','tipo_de_custo'], prestador:['prestador','empreiteiro'], total:['total','valor_total','subtotal']};
var ORC_OBRIG=['codigo','etapa','descricao','unidade','quantidade','preco_unitario','tipo'];
var ORC_MODELO=[['codigo','etapa','descricao','unidade','quantidade','preco_unitario','tipo','prestador','total'],
  ['3.01','3','Terraplanagem: corte e aterro','m³','120','38,50','empreitada','Terraplanagem Silva','4620,00'],
  ['5.02','5','Concreto usinado fck 30 para fundação','m³','18','520,00','material','','9360,00'],
  ['7.01','7','Alvenaria de vedação em bloco cerâmico','m²','240','62,00','mao_de_obra','Alvenaria Souza','14880,00']];

function orcParse(texto){
  var rows=csvParse(texto), rel={erros:[], avisos:[], itens:[], total:0, porEtapa:{}, porTipo:{}, nLinhas:0};
  if(rows.length<2){ rel.erros.push({linha:0, motivo:'O arquivo precisa ter o cabeçalho e ao menos uma linha de item.'}); rel.ok=false; return rel; }
  var hdr=rows[0].map(chave), idx={}, faltam=[];
  Object.keys(ORC_COLS).forEach(function(k){ var i=-1; ORC_COLS[k].forEach(function(a){ if(i<0) i=hdr.indexOf(a); }); idx[k]=i; });
  ORC_OBRIG.forEach(function(k){ if(idx[k]<0) faltam.push(k); });
  if(faltam.length){ rel.erros.push({linha:1, motivo:'Faltam colunas obrigatórias no cabeçalho: '+faltam.join(', ')+'.'}); rel.ok=false; return rel; }
  var prest={}; L('prestadores').forEach(function(p){ prest[chave(p.nome)]=p; });
  var vistos={}, naoAchados={};
  rel.nLinhas=rows.length-1;
  for(var i=1;i<rows.length;i++){
    var r=rows[i], linha=i+1, erros=[];
    var c=function(k){ return idx[k]>=0?String(r[idx[k]]==null?'':r[idx[k]]).trim():''; };
    var cod=c('codigo'), et=c('etapa'), desc=c('descricao'), un=c('unidade'), qtdS=c('quantidade'), puS=c('preco_unitario'), tipoS=c('tipo'), totS=c('total');
    if(!qtdS && !un && !puS && totS){ rel.erros.push({linha:linha, motivo:'Linha resumida (só com total). O orçamento precisa de quantidade, unidade e preço unitário.'}); continue; }
    if(!cod) erros.push('falta o código');
    else if(vistos[cod.toLowerCase()]) erros.push('código “'+cod+'” repetido (também na linha '+vistos[cod.toLowerCase()]+')');
    else vistos[cod.toLowerCase()]=linha;
    var n=numBR(et);
    if(!(n>=1 && n<=22 && n===Math.floor(n))) erros.push('etapa “'+et+'” fora de 1 a 22');
    if(!desc) erros.push('falta a descrição');
    if(!un) erros.push('falta a unidade');
    var q=numBR(qtdS), pu=numBR(puS);
    if(!(q>0)) erros.push('quantidade deve ser maior que zero');
    if(!(pu>=0)) erros.push('preço unitário inválido');
    var tp=tipoItemNorm(tipoS);
    if(!tp) erros.push('tipo “'+tipoS+'” inválido (use material, mao_de_obra, equipamento ou empreitada)');
    var tot=r2(q*pu);
    if(totS!==''){ var t2=numBR(totS); if(isNaN(t2)) erros.push('total inválido'); else if(q>0&&pu>=0&&Math.abs(t2-tot)>0.01) erros.push('total '+brl(t2)+' não bate com quantidade × preço unitário ('+brl(tot)+')'); }
    var pn=c('prestador'), pid='';
    if(pn){ var p=prest[chave(pn)]; if(p) pid=p.id; else naoAchados[pn]=(naoAchados[pn]||[]).concat([linha]); }
    if(erros.length){ rel.erros.push({linha:linha, motivo:erros.join('; ')+'.'}); continue; }
    rel.itens.push({codigo:cod, etapa:n, descricao:desc, unidade:un, quantidade:q, precoUnitario:pu, tipo:tp, prestador:pn, prestadorId:pid, total:tot});
    rel.total=r2(rel.total+tot);
    rel.porEtapa[n]=r2((rel.porEtapa[n]||0)+tot); rel.porTipo[tp]=r2((rel.porTipo[tp]||0)+tot);
  }
  Object.keys(naoAchados).forEach(function(nm){ rel.avisos.push('Prestador “'+nm+'” não está cadastrado (linhas '+naoAchados[nm].join(', ')+'). O item entra sem prestador e não poderá ser medido até você cadastrar o prestador e importar de novo.'); });
  rel.ok=rel.erros.length===0 && rel.itens.length>0;
  return rel;
}
COBX.orcParse=orcParse;

/* ---------- orçamento: versões e leitura ---------- */
function orcVersoes(oid){ return byObra('orcamentos',oid).sort(function(a,b){ return a.versao-b.versao; }); }
function orcVigente(oid){ var v=orcVersoes(oid); return v.length?v[v.length-1]:null; }
function orcItensDe(orc){
  if(!orc) return [];
  var out=[];
  byObra('orcItens',orc.obraId).filter(function(x){ return x.orcId===orc.id; }).sort(function(a,b){ return a.lote-b.lote; }).forEach(function(l){ out=out.concat(l.itens||[]); });
  return out;
}
async function orcSalvar(oid, rel, motivo, origem){
  var vig=orcVigente(oid), versao=(vig?vig.versao:0)+1, id=nid(), lotes=Math.ceil(rel.itens.length/150);
  for(var i=0;i<lotes;i++) await Store.set('orcItens', id+'_'+i, {obraId:oid, orcId:id, lote:i, itens:rel.itens.slice(i*150,(i+1)*150)});
  await Store.set('orcamentos', id, {obraId:oid, versao:versao, data:hoje(), motivo:versao===1?'Orçamento base':motivo, origem:origem||'', total:rel.total, nItens:rel.itens.length, lotes:lotes, porEtapa:rel.porEtapa, porTipo:rel.porTipo, criadoEm:new Date().toISOString(), por:Store.uid||null});
  return id;
}
function orcComparaVersoes(a,b){
  var ia={}, ib={}, novos=[], removidos=[], alterados=[];
  orcItensDe(a).forEach(function(i){ ia[i.codigo]=i; }); orcItensDe(b).forEach(function(i){ ib[i.codigo]=i; });
  Object.keys(ib).forEach(function(k){ if(!ia[k]) novos.push(ib[k]); else { var x=ia[k], y=ib[k]; if(x.quantidade!==y.quantidade||x.precoUnitario!==y.precoUnitario||x.etapa!==y.etapa||x.unidade!==y.unidade||x.descricao!==y.descricao||x.tipo!==y.tipo) alterados.push({antes:x, depois:y}); } });
  Object.keys(ia).forEach(function(k){ if(!ib[k]) removidos.push(ia[k]); });
  return {novos:novos, removidos:removidos, alterados:alterados, dif:r2((b.total||0)-(a.total||0))};
}
COBX.orcComparaVersoes=orcComparaVersoes;

/* ---------- aditivos e orçamento revisado ---------- */
function adtSinal(a){ return a.tipo==='supressao'?-1:1; }
function adtItensTotal(a){ return r2((a.itens||[]).reduce(function(s,i){ return s+r2(i.total); },0)); }
function adtValor(a){ return r2(adtSinal(a)*adtItensTotal(a)); }
function adtDaObra(oid){ return byObra('aditivos',oid).sort(function(a,b){ return a.numero-b.numero; }); }
function adtAssinados(oid){ return adtDaObra(oid).filter(function(a){ return a.status==='assinado'; }); }
function adtEditavel(a){ return !a || a.status==='rascunho'; }
function orcRevisado(oid){
  var v=orcVigente(oid), itens=orcItensDe(v).map(function(i){ return Object.assign({}, i, {origem:'base'}); }), adt=adtAssinados(oid);
  adt.forEach(function(a){
    (a.itens||[]).forEach(function(i,k){
      itens.push({codigo:'A'+a.numero+'.'+(k+1), etapa:Number(i.etapa)||0, descricao:i.descricao, unidade:i.unidade, quantidade:i.quantidade, precoUnitario:i.precoUnitario, tipo:i.tipoItem||'empreitada', prestador:i.prestador||'', prestadorId:i.prestadorId||'', total:r2(adtSinal(a)*i.total), origem:'aditivo', aditivoId:a.id, sinal:adtSinal(a)});
    });
  });
  var porEtapa={}, porTipo={}, total=0;
  itens.forEach(function(i){ var e=i.etapa||0; porEtapa[e]=r2((porEtapa[e]||0)+i.total); porTipo[i.tipo]=r2((porTipo[i.tipo]||0)+i.total); total=r2(total+i.total); });
  var base=v?v.total:0;
  return {versao:v, itens:itens, porEtapa:porEtapa, porTipo:porTipo, total:total, base:base, aditivos:r2(total-base), prazoDias:adt.reduce(function(s,a){ return s+(Number(a.impactoPrazoDias)||0); },0)};
}
COBX.orcRevisado=orcRevisado; COBX.adtValor=adtValor;

var ADT_LINHA='descricao;unidade;quantidade;preco_unitario;etapa;tipo;prestador';
function adtItensTexto(a){ return (a&&a.itens||[]).map(function(i){ return csvLinha([i.descricao,i.unidade,String(i.quantidade).replace('.',','),String(i.precoUnitario).replace('.',','),i.etapa||'',i.tipoItem||'',i.prestador||''],';'); }).join('\n'); }
function adtParseItens(texto){
  var rows=csvParse(ADT_LINHA+'\n'+String(texto||'').replace(/^\s+|\s+$/g,'')).slice(1), itens=[], erros=[];
  var prest={}; L('prestadores').forEach(function(p){ prest[chave(p.nome)]=p; });
  rows.forEach(function(r,k){
    var ln='Item '+(k+1)+': ', c=function(i){ return String(r[i]==null?'':r[i]).trim(); };
    var q=numBR(c(2)), pu=numBR(c(3)), et=c(4)===''?0:numBR(c(4)), tp=c(5)===''?'empreitada':tipoItemNorm(c(5)), pn=c(6), e=[];
    if(!c(0)) e.push('falta a descrição');
    if(!c(1)) e.push('falta a unidade');
    if(!(q>0)) e.push('quantidade deve ser maior que zero');
    if(!(pu>=0)) e.push('preço unitário inválido');
    if(!(et>=0&&et<=22&&et===Math.floor(et))) e.push('etapa deve ser de 1 a 22 (ou vazia)');
    if(!tp) e.push('tipo inválido');
    if(e.length){ erros.push(ln+e.join('; ')+'.'); return; }
    var p=pn?prest[chave(pn)]:null;
    itens.push({descricao:c(0), unidade:c(1), quantidade:q, precoUnitario:pu, total:r2(q*pu), etapa:et, tipoItem:tp, prestador:pn, prestadorId:p?p.id:''});
  });
  return {itens:itens, erros:erros};
}
COBX.adtParseItens=adtParseItens;
function origemAdt(a){
  if(!a.origem) return '';
  if(a.origem.col==='ocorrencias'){ var o=G('ocorrencias',a.origem.id); return 'Ocorrência: '+(o?short(o.descricao,50):'removida'); }
  if(a.origem.col==='materiais'){ var m=G('materiais',a.origem.id); return 'Material: '+(m?m.item:'removido'); }
  return '';
}
function aditivosHtml(o){
  var oid=o.id, lista=adtDaObra(oid), dias=o.diasEscalar==null?7:o.diasEscalar, hj=hoje();
  var linhas=lista.length?lista.map(function(a){
    var esp=a.status==='aguardando_cliente' && a.enviadoEm && diffDays(a.enviadoEm.slice(0,10),hj)>dias;
    var acts='<button class="btn sm ghost" data-act="adt-ver" data-id="'+a.id+'">Ver</button>';
    if(a.status==='rascunho') acts+='<button class="btn sm" data-act="adt-editar" data-id="'+a.id+'" data-write>Editar</button><button class="btn sm primary" data-act="adt-enviar" data-id="'+a.id+'" data-write>Enviar ao cliente</button>';
    if(a.status==='aguardando_cliente') acts+='<button class="btn sm primary" data-act="adt-assinar" data-id="'+a.id+'" data-write>Registrar assinatura</button><button class="btn sm" data-act="adt-recusar" data-id="'+a.id+'" data-write>Recusado</button>';
    return '<tr><td class="num">'+a.numero+'</td><td>'+esc(short(a.descricao,80))+(origemAdt(a)?'<div class="tiny muted">'+esc(origemAdt(a))+'</div>':'')+'</td><td>'+ADT_TIPO[a.tipo]+'</td><td class="num">'+brl(adtValor(a))+'</td><td class="num">'+(a.impactoPrazoDias?a.impactoPrazoDias+' d':'—')+'</td><td><span class="chip '+(a.status==='assinado'?'ok':(a.status==='recusado'?'crit':(esp?'crit':(a.status==='aguardando_cliente'?'warn':''))))+'">'+ADT_ST[a.status]+(esp?' há mais de '+dias+' dias':'')+'</span></td><td style="white-space:nowrap">'+acts+'</td></tr>';
  }).join(''):'<tr><td colspan="7" class="muted" style="padding:16px">Nenhum aditivo. Solicitação do cliente ou imprevisto que muda escopo, prazo ou valor vira aditivo e só vale depois de assinado.</td></tr>';
  return '<section class="card sec"><div class="card-h"><div><h2>Aditivos</h2><p class="muted small">Só aditivo assinado altera o orçamento revisado.</p></div><button class="btn primary sm" data-act="adt-novo" data-oid="'+oid+'" data-write>+ Aditivo</button></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Nº</th><th>Descrição</th><th>Tipo</th><th class="num">Valor</th><th class="num">Prazo</th><th>Situação</th><th></th></tr></thead><tbody>'+linhas+'</tbody></table></div></section>';
}
function aditivoForm(oid, a, pre){
  var novo=!a;
  if(a && !adtEditavel(a)){ blockDlg('Aditivo não pode ser editado',['Aditivo '+ADT_ST[a.status].toLowerCase()+' é imutável. Para corrigir, crie um novo aditivo.'],'Edição bloqueada'); return; }
  pre=pre||{};
  openForm({title:novo?'Novo aditivo':'Editar aditivo nº '+a.numero, wide:true,
    intro:(pre.origem?esc(origemAdt({origem:pre.origem}))+'. ':'')+'Um item por linha, separado por ponto e vírgula: <strong>descrição; unidade; quantidade; preço unitário; etapa; tipo; prestador</strong> (etapa, tipo e prestador são opcionais). Supressão: informe os itens que saem, com valores positivos.',
    fields:[{name:'descricao',label:'Descrição do aditivo',type:'textarea',required:true,rows:2,value:a?a.descricao:(pre.descricao||'')},
      [{name:'tipo',label:'Tipo',type:'radio',required:true,options:Object.keys(ADT_TIPO).map(function(k){ return [k,ADT_TIPO[k]]; }),value:a?a.tipo:(pre.tipo||'acrescimo')},{name:'impactoPrazoDias',label:'Impacto no prazo (dias)',type:'number',step:1,value:a?a.impactoPrazoDias:0}],
      {name:'itens',label:'Itens (quantidade × preço unitário)',type:'textarea',rows:6,value:a?adtItensTexto(a):(pre.itens||''),ph:'Ex.: Contenção em gabião; m³; 42; 310,00; 4; empreitada; Terra Ltda',hint:'Aditivo de prazo puro pode ficar sem itens.'}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="adt-excluir" data-id="'+a.id+'" style="margin-right:auto">Excluir rascunho</button>',
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva o aditivo.';
      if(!v.tipo) return 'Escolha o tipo.';
      var r=adtParseItens(v.itens);
      if(r.erros.length) return r.erros[0]+(r.erros.length>1?' (e mais '+(r.erros.length-1)+')':'');
      if(v.tipo!=='prazo' && !r.itens.length) return 'Informe ao menos um item com quantidade, unidade e preço unitário.';
      if(v.tipo==='prazo' && !(Number(v.impactoPrazoDias)>0)) return 'Aditivo de prazo precisa informar os dias.';
      var num=a?a.numero:adtDaObra(oid).reduce(function(m,x){ return Math.max(m,x.numero); },0)+1;
      var rec=Object.assign({status:'rascunho', criadoEm:new Date().toISOString(), por:Store.uid||null}, a||{}, {obraId:oid, numero:num, descricao:v.descricao.trim(), tipo:v.tipo, origem:a?a.origem:(pre.origem||null), itens:r.itens, impactoPrazoDias:Number(v.impactoPrazoDias)||0});
      rec.valor=adtValor(rec);
      await Store.set('aditivos', a?a.id:nid(), rec);
    }});
}
function aditivoVer(id){
  var a=G('aditivos',id); if(!a) return;
  openDlg('<div class="dlg-h"><h2>Aditivo nº '+a.numero+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<div class="row" style="margin-bottom:8px"><span class="chip '+(a.status==='assinado'?'ok':'')+'">'+ADT_ST[a.status]+'</span><span class="chip">'+ADT_TIPO[a.tipo]+'</span><strong>'+brl(adtValor(a))+'</strong>'+(a.impactoPrazoDias?'<span class="chip warn">+'+a.impactoPrazoDias+' dias de prazo</span>':'')+'</div>'
    +'<p style="white-space:pre-wrap">'+esc(a.descricao)+'</p>'+(origemAdt(a)?'<p class="small muted">'+esc(origemAdt(a))+'</p>':'')
    +((a.itens||[]).length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th>Etapa</th><th class="num">Qtd</th><th class="num">Preço unit.</th><th class="num">Total</th></tr></thead><tbody>'+a.itens.map(function(i){ return '<tr><td>'+esc(i.descricao)+'<div class="tiny muted">'+esc(i.unidade)+' · '+TIPOS_ITEM[i.tipoItem||'empreitada']+(i.prestador?' · '+esc(i.prestador):'')+'</div></td><td>'+(i.etapa||'—')+'</td><td class="num">'+String(i.quantidade).replace('.',',')+'</td><td class="num">'+brl(i.precoUnitario)+'</td><td class="num">'+brl(i.total)+'</td></tr>'; }).join('')+'</tbody></table></div>':'')
    +(a.assinatura?'<div class="callout ok" style="margin-top:12px"><strong>Assinado em '+fmt(a.assinatura.data)+'</strong><p class="small" style="white-space:pre-wrap">'+esc(a.assinatura.ref)+'</p>'+anexosHtml(a.assinatura.anexos)+'</div>':'')
    +(a.status==='recusado'&&a.motivoRecusa?'<div class="callout crit" style="margin-top:12px"><strong>Recusado</strong><p class="small">'+esc(a.motivoRecusa)+'</p></div>':'')
    +'</div><div class="dlg-f"><button class="btn primary" data-close>Fechar</button></div>', true);
}
function adtAssinarForm(id){
  var a=G('aditivos',id);
  openForm({title:'Registrar assinatura do cliente', intro:'Aditivo nº '+a.numero+' — '+esc(short(a.descricao,120))+'. <strong>'+brl(adtValor(a))+'</strong>. Depois de assinado, ele passa a valer no orçamento revisado e não pode mais ser alterado.',
    fields:[{name:'data',label:'Data da assinatura',type:'date',required:true,value:hoje()},{name:'ref',label:'Como o cliente assinou',type:'textarea',required:true,rows:3,ph:'Ex.: aditivo assinado no escritório em 12/03, cópia anexada.'},{name:'anexos',label:'Documento assinado (foto ou PDF)',type:'anexos',value:[]}],
    submit:'Registrar assinatura',
    onSubmit:async function(v){
      if(!(v.ref||'').trim()) return 'Registre como o cliente assinou (obrigatório).';
      if(!v.data) return 'Informe a data.';
      await Store.set('aditivos', id, Object.assign({}, a, {status:'assinado', valor:adtValor(a), assinatura:{data:v.data, ref:v.ref.trim(), anexos:v.anexos||[]}}));
      toast('Aditivo assinado: o orçamento revisado foi atualizado.');
    }});
}
function adtRecusarForm(id){
  var a=G('aditivos',id);
  openForm({title:'Aditivo recusado pelo cliente', fields:[{name:'motivo',label:'Motivo',type:'textarea',required:true,rows:2}], submit:'Registrar recusa',
    onSubmit:async function(v){ if(!(v.motivo||'').trim()) return 'Registre o motivo.'; await Store.set('aditivos', id, Object.assign({}, a, {status:'recusado', motivoRecusa:v.motivo.trim()})); }});
}

/* ---------- aba Orçamento ---------- */
function tOrcamento(o){
  var oid=o.id, v=orcVigente(oid), versoes=orcVersoes(oid), rev=orcRevisado(oid);
  var head='<div class="sec-h"><div><h2>Orçamento</h2><p class="muted small">Orçamento detalhado: toda linha tem quantidade, unidade e preço unitário. A versão 1 (base) nunca é alterada; aditivos assinados entram no orçamento revisado.</p></div><div class="row"><button class="btn" data-act="orc-modelo">Baixar modelo CSV</button><button class="btn primary" data-act="orc-importar" data-oid="'+oid+'" data-write>'+(v?'Importar nova versão':'Importar orçamento')+'</button></div></div>';
  if(!v) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhum orçamento importado</h3><p>Baixe o modelo CSV, preencha (ou exporte do seu sistema de orçamentos no mesmo formato) e importe. O app valida linha por linha antes de aceitar.</p></div>'+aditivosHtml(o);
  var cards='<div class="grid cols3" style="margin-top:14px"><div class="card pad"><div class="small muted">Orçamento base (v'+versoes[0].versao+')</div><div class="num" style="font-size:24px;font-weight:600">'+brl(versoes[0].total)+'</div></div>'
    +(versoes.length>1?'<div class="card pad"><div class="small muted">Versão vigente (v'+v.versao+')</div><div class="num" style="font-size:24px;font-weight:600">'+brl(v.total)+'</div></div>':'')
    +'<div class="card pad"><div class="small muted">Aditivos assinados</div><div class="num" style="font-size:24px;font-weight:600">'+brl(rev.aditivos)+'</div></div>'
    +'<div class="card pad"><div class="small muted">Orçamento revisado</div><div class="num" style="font-size:24px;font-weight:600">'+brl(rev.total)+'</div></div></div>';
  var etapas=Object.keys(rev.porEtapa).map(Number).sort(function(a,b){ return a-b; });
  var tabEt='<section class="card"><div class="card-h"><h2>Por etapa</h2></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th class="num">Base</th><th class="num">Aditivos</th><th class="num">Revisado</th></tr></thead><tbody>'+etapas.map(function(e){
    var base=(v.porEtapa&&v.porEtapa[e])||0, rv=rev.porEtapa[e]||0;
    return '<tr><td>'+(e?e+'. '+esc(etapaInfo(e).nome):'Sem etapa')+'</td><td class="num">'+brl(base)+'</td><td class="num">'+brl(r2(rv-base))+'</td><td class="num"><strong>'+brl(rv)+'</strong></td></tr>';
  }).join('')+'</tbody></table></div></section>';
  var tabTp='<section class="card"><div class="card-h"><h2>Por tipo de custo</h2></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Tipo</th><th class="num">Valor</th><th class="num">%</th></tr></thead><tbody>'+Object.keys(TIPOS_ITEM).filter(function(k){ return rev.porTipo[k]; }).map(function(k){
    return '<tr><td>'+TIPOS_ITEM[k]+'</td><td class="num">'+brl(rev.porTipo[k])+'</td><td class="num">'+(rev.total?Math.round(rev.porTipo[k]/rev.total*1000)/10:0).toString().replace('.',',')+'%</td></tr>';
  }).join('')+'</tbody></table></div></section>';
  var busca=(ui.orcBusca||'').toLowerCase(), fe=ui.orcEtapa||'', ft=ui.orcTipo||'';
  var lista=rev.itens.filter(function(i){ return (!fe||String(i.etapa)===fe) && (!ft||i.tipo===ft) && (!busca||(i.codigo+' '+i.descricao).toLowerCase().indexOf(busca)>=0); });
  var itens='<section class="card sec"><div class="card-h"><h2>Itens do orçamento revisado</h2><span class="chip">'+lista.length+' de '+rev.itens.length+'</span></div>'
    +'<div class="pad row" style="gap:8px"><input data-chg="orc-filtro" data-k="orcBusca" value="'+esc(ui.orcBusca||'')+'" placeholder="Buscar por código ou descrição" aria-label="Buscar item" style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)">'
    +'<select data-chg="orc-filtro" data-k="orcEtapa" aria-label="Filtrar por etapa" style="padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"><option value="">Todas as etapas</option>'+etapas.map(function(e){ return '<option value="'+e+'"'+(fe===String(e)?' selected':'')+'>'+(e?e+'. '+esc(etapaInfo(e).nome):'Sem etapa')+'</option>'; }).join('')+'</select>'
    +'<select data-chg="orc-filtro" data-k="orcTipo" aria-label="Filtrar por tipo" style="padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--surface);color:var(--ink)"><option value="">Todos os tipos</option>'+Object.keys(TIPOS_ITEM).map(function(k){ return '<option value="'+k+'"'+(ft===k?' selected':'')+'>'+TIPOS_ITEM[k]+'</option>'; }).join('')+'</select></div>'
    +'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Código</th><th>Descrição</th><th>Etapa</th><th>Un</th><th class="num">Qtd</th><th class="num">Preço unit.</th><th class="num">Total</th><th>Prestador</th></tr></thead><tbody>'
    +lista.slice(0,300).map(function(i){ return '<tr><td>'+esc(i.codigo)+(i.origem==='aditivo'?' <span class="chip warn">Aditivo</span>':'')+'</td><td>'+esc(i.descricao)+'<div class="tiny muted">'+TIPOS_ITEM[i.tipo]+'</div></td><td>'+(i.etapa||'—')+'</td><td>'+esc(i.unidade)+'</td><td class="num">'+String(i.quantidade).replace('.',',')+'</td><td class="num">'+brl(i.precoUnitario)+'</td><td class="num">'+brl(i.total)+'</td><td>'+esc(prestNome(i.prestadorId)||i.prestador||'—')+'</td></tr>'; }).join('')
    +'</tbody></table></div>'+(lista.length>300?'<p class="small muted pad">Mostrando os 300 primeiros. Use a busca ou os filtros.</p>':'')+'</section>';
  var vers='<section class="card sec"><div class="card-h"><h2>Versões do orçamento</h2></div>'+versoes.slice().reverse().map(function(x,k,arr){
    var ant=versoes.filter(function(y){ return y.versao===x.versao-1; })[0];
    return '<div class="ficha" style="grid-template-columns:1fr auto"><div><strong>Versão '+x.versao+'</strong> '+(x.versao===v.versao?'<span class="chip ok">Vigente</span>':'')+(x.versao===1?'<span class="chip steel">Base, imutável</span>':'')+'<div class="small">'+brl(x.total)+' · '+plural(x.nItens,'item','itens')+' · '+fmt(x.data)+(x.origem?' · origem: '+esc(x.origem):'')+'</div><div class="tiny muted">'+esc(x.motivo||'')+'</div></div><div>'+(ant?'<button class="btn sm" data-act="orc-comparar" data-id="'+x.id+'">Comparar com a v'+ant.versao+'</button>':'')+'</div></div>';
  }).join('')+'</section>';
  return head+cards+'<div class="grid cols2 sec">'+tabEt+tabTp+'</div>'+itens+vers+aditivosHtml(o);
}
function orcRelHtml(rel){
  var h='';
  if(rel.erros.length) h+='<div class="callout crit" style="margin-top:12px"><strong>'+plural(rel.erros.length,'erro bloqueia','erros bloqueiam')+' a importação</strong><ul>'+rel.erros.slice(0,50).map(function(e){ return '<li>'+(e.linha?'Linha '+e.linha+': ':'')+esc(e.motivo)+'</li>'; }).join('')+(rel.erros.length>50?'<li>… e mais '+(rel.erros.length-50)+'.</li>':'')+'</ul></div>';
  if(rel.avisos.length) h+='<div class="callout" style="margin-top:12px"><strong>Avisos (não bloqueiam)</strong><ul>'+rel.avisos.map(function(a){ return '<li>'+esc(a)+'</li>'; }).join('')+'</ul></div>';
  if(rel.itens.length){
    var et=Object.keys(rel.porEtapa).map(Number).sort(function(a,b){ return a-b; });
    h+='<div class="'+(rel.ok?'callout ok':'callout')+'" style="margin-top:12px"><strong>'+plural(rel.itens.length,'linha válida','linhas válidas')+' de '+rel.nLinhas+' · total '+brl(rel.total)+'</strong>'
      +'<div class="small" style="margin-top:6px">Por tipo: '+Object.keys(TIPOS_ITEM).filter(function(k){ return rel.porTipo[k]; }).map(function(k){ return TIPOS_ITEM[k]+' '+brl(rel.porTipo[k]); }).join(' · ')+'</div>'
      +'<div class="small" style="margin-top:4px">Por etapa: '+et.map(function(e){ return e+' → '+brl(rel.porEtapa[e]); }).join(' · ')+'</div></div>';
  }
  return h;
}
function orcImportDlg(oid){
  var vig=orcVigente(oid), prox=(vig?vig.versao:0)+1;
  var html='<form id="orcform"><div class="dlg-h"><h2>'+(vig?'Nova versão do orçamento (v'+prox+')':'Importar orçamento (versão 1, base)')+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<p class="muted small" style="margin-bottom:12px">CSV com as colunas <strong>codigo, etapa, descricao, unidade, quantidade, preco_unitario, tipo</strong> (e, se quiser, <strong>prestador, total</strong>). Aceita ; ou , e decimal com vírgula ou ponto. '+(vig?'A versão anterior é preservada.':'A primeira importação vira o orçamento base e não poderá ser alterada.')+'</p>'
    +(vig?'<div class="fld"><label for="orc_mot">Motivo da nova versão *</label><input id="orc_mot" name="motivo" autocomplete="off"></div>':'')
    +'<div class="fld"><label for="orc_arq">Arquivo CSV</label><input id="orc_arq" type="file" accept=".csv,text/csv,text/plain"></div>'
    +'<div class="fld"><label for="orc_csv">Ou cole o conteúdo do CSV</label><textarea id="orc_csv" rows="6" spellcheck="false"></textarea></div>'
    +'<div class="fld"><label for="orc_ori">Origem do orçamento (opcional)</label><input id="orc_ori" placeholder="Ex.: Vobi, planilha própria" autocomplete="off"></div><div id="orc_rel"></div><div class="err-msg hide" id="orc_err" role="alert"></div></div>'
    +'<div class="dlg-f"><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn" data-orc="validar">Validar</button><button type="button" class="btn primary" data-orc="confirmar" disabled>Confirmar importação</button></div></form>';
  var d=openDlg(html,true), form=$('#orcform',d), rel=null, ta=$('#orc_csv',d), conf=form.querySelector('[data-orc="confirmar"]'), err=$('#orc_err',d);
  var validar=function(){ rel=orcParse(ta.value); $('#orc_rel',d).innerHTML=orcRelHtml(rel); conf.disabled=!rel.ok; };
  $('#orc_arq',d).addEventListener('change', function(e){
    var f=e.target.files&&e.target.files[0]; if(!f) return;
    var lerComo=function(cod){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsText(f,cod); }); };
    lerComo('UTF-8').then(function(t){ return t.indexOf('�')>=0?lerComo('windows-1252'):t; }).then(function(t){ ta.value=t; validar(); });
  });
  form.addEventListener('click', async function(e){
    var b=e.target.closest('[data-orc]'); if(!b) return;
    err.classList.add('hide');
    if(b.dataset.orc==='validar'){ validar(); return; }
    if(b.dataset.orc==='confirmar'){
      if(!rel||!rel.ok) return;
      var mot=vig?(($('#orc_mot',d)||{}).value||'').trim():'';
      if(vig&&!mot){ err.textContent='Informe o motivo da nova versão.'; err.classList.remove('hide'); return; }
      conf.disabled=true;
      try{ await orcSalvar(oid, rel, mot, ($('#orc_ori',d).value||'').trim()); closeDlg(); toast('Orçamento importado (versão '+prox+').'); }
      catch(ex){ conf.disabled=false; err.textContent='Não foi possível importar: '+(ex&&ex.message||'erro'); err.classList.remove('hide'); }
    }
  });
}
function orcCompararDlg(id){
  var b=G('orcamentos',id); if(!b) return;
  var a=orcVersoes(b.obraId).filter(function(x){ return x.versao===b.versao-1; })[0]; if(!a) return;
  var c=orcComparaVersoes(a,b), lim=function(l){ return l.slice(0,40); };
  var li=function(i){ return '<li>'+esc(i.codigo)+' — '+esc(short(i.descricao,60))+' · '+brl(i.total)+'</li>'; };
  openDlg('<div class="dlg-h"><h2>v'+a.versao+' → v'+b.versao+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<p><strong>Diferença de valor total: '+brl(c.dif)+'</strong> ('+brl(a.total)+' → '+brl(b.total)+')</p>'
    +'<h3 style="margin-top:14px">Itens novos ('+c.novos.length+')</h3><ul class="small">'+lim(c.novos).map(li).join('')+'</ul>'
    +'<h3 style="margin-top:14px">Itens removidos ('+c.removidos.length+')</h3><ul class="small">'+lim(c.removidos).map(li).join('')+'</ul>'
    +'<h3 style="margin-top:14px">Itens alterados ('+c.alterados.length+')</h3><ul class="small">'+lim(c.alterados).map(function(x){ return '<li>'+esc(x.depois.codigo)+' — '+esc(short(x.depois.descricao,50))+': '+String(x.antes.quantidade).replace('.',',')+' × '+brl(x.antes.precoUnitario)+' → '+String(x.depois.quantidade).replace('.',',')+' × '+brl(x.depois.precoUnitario)+'</li>'; }).join('')+'</ul></div><div class="dlg-f"><button class="btn primary" data-close>Fechar</button></div>', true);
}
COBX.orcVigente=orcVigente; COBX.orcItensDe=orcItensDe;

/* ---------- ações da fase 4 ---------- */
var A4={
  'orc-modelo':function(){ baixar('modelo-orcamento.csv','﻿'+ORC_MODELO.map(function(l){ return csvLinha(l,';'); }).join('\r\n')+'\r\n','text/csv').then(function(ok){ if(ok) toast('Modelo CSV baixado.'); }); },
  'orc-importar':function(d){ orcImportDlg(d.oid); },
  'orc-comparar':function(d){ orcCompararDlg(d.id); },
  'adt-novo':function(d){ aditivoForm(d.oid); },
  'adt-editar':function(d){ var a=G('aditivos',d.id); aditivoForm(a.obraId,a); },
  'adt-ver':function(d){ aditivoVer(d.id); },
  'adt-enviar':async function(d){ var a=G('aditivos',d.id); if(!(a.itens||[]).length && a.tipo!=='prazo'){ blockDlg('Aditivo sem itens',['Inclua os itens com quantidade e preço unitário antes de enviar.'],'Não dá para enviar'); return; } var ok=await confirmDlg('Enviar ao cliente?','<p>Aditivo nº '+a.numero+': <strong>'+brl(adtValor(a))+'</strong>. Depois de enviado ele não pode mais ser editado.</p>','Marcar como enviado',false); if(ok){ await Store.set('aditivos', d.id, Object.assign({}, a, {status:'aguardando_cliente', enviadoEm:new Date().toISOString()})); toast('Aditivo aguardando o cliente.'); } },
  'adt-assinar':function(d){ adtAssinarForm(d.id); },
  'adt-recusar':function(d){ adtRecusarForm(d.id); },
  'adt-excluir':async function(d){ var a=G('aditivos',d.id); if(!adtEditavel(a)) return; var ok=await confirmDlg('Excluir rascunho?','<p>Só rascunhos podem ser excluídos.</p>','Excluir',true); if(ok){ await Store.del('aditivos',d.id); closeDlg(); } },
  'adt-de-oc':function(d){ var o=G('ocorrencias',d.id); closeDlg(); aditivoForm(o.obraId,null,{origem:{col:'ocorrencias',id:o.id}, descricao:o.descricao, tipo:'acrescimo'}); },
  'adt-de-mat':function(d){ var m=G('materiais',d.id); aditivoForm(m.obraId,null,{origem:{col:'materiais',id:m.id}, descricao:'Material: '+m.item, tipo:'acrescimo'}); }
};
document.addEventListener('change', function(e){
  var el=e.target.closest('[data-chg="orc-filtro"]'); if(!el) return;
  ui[el.dataset.k]=el.value; render();
});

/* ================= MEDIÇÃO ================= */
var MED_ST={rascunho:'Rascunho', em_analise:'Em análise', aprovada:'Aprovada', paga:'Paga'};
var MED_CONTA=['em_analise','aprovada','paga'];   // situações que já contam como medido
function medDaObra(oid){ return byObra('medicoes',oid).sort(function(a,b){ return (a.periodoFim<b.periodoFim?1:(a.periodoFim>b.periodoFim?-1:b.numero-a.numero)); }); }
function medDoContrato(cid){ return L('medicoes').filter(function(m){ return m.contratoId===cid; }); }
function medBruto(m){ return r2((m.itens||[]).reduce(function(s,i){ return s+r2((Number(i.qtdMedida)||0)*i.precoUnitario); },0)); }
function medItensDoPrestador(oid,pid){
  return orcRevisado(oid).itens.filter(function(i){ return i.prestadorId===pid && i.total>0 && i.sinal!==-1; });
}
function medQtdOutras(oid, mid, cod){
  var s=0;
  byObra('medicoes',oid).forEach(function(m){
    if(m.id===mid || MED_CONTA.indexOf(m.status)<0) return;
    (m.itens||[]).forEach(function(i){ if(i.codigo===cod) s+=Number(i.qtdMedida)||0; });
  });
  return Math.round(s*1e6)/1e6;
}
function avancoPrestador(oid,pid){
  var ats=byObra('atividades',oid).filter(function(a){ return a.prestadorId===pid; });
  if(!ats.length) return null;
  var tot=0, acc=0;
  ats.forEach(function(a){ var d=Math.max(1,diffDays(a.inicio,a.fim)+1); tot+=d; acc+=d*(a.avanco||0)/100; });
  return acc/tot;
}
function retidoApontamento(m){
  var crit=byObra('ocorrencias',m.obraId).filter(function(x){ return ocAberta(x) && x.gravidade==='critica' && x.prestadorId===m.prestadorId && x.etapa; });
  var et={}; crit.forEach(function(x){ et[x.etapa]=1; });
  var itens=(m.itens||[]).filter(function(i){ return et[i.etapa] && (Number(i.qtdMedida)||0)>0; });
  return {itens:itens, etapas:Object.keys(et).map(Number).sort(function(a,b){return a-b;}), total:r2(itens.reduce(function(s,i){ return s+r2(i.qtdMedida*i.precoUnitario); },0))};
}
function medCalc(m,o){
  var adm=modAdm(o), bruto=medBruto(m), pct=Number(m.retencaoPct)||0, rap=retidoApontamento(m).total, ret=r2((bruto-rap)*pct/100);
  var desc=r2((m.descontos||[]).reduce(function(s,d){ return s+(Number(d.valor)||0); },0));
  var deduz=r2(ret+desc+rap);
  return {bruto:bruto, retencao:ret, descontos:desc, retidoApontamento:rap, deducoes:deduz, liquido:adm?r2(bruto-deduz):bruto, recomendado:adm?0:deduz};
}
function medTravas(m,o){
  var oid=m.obraId, b=[], av=[], its=(m.itens||[]).filter(function(i){ return (Number(i.qtdMedida)||0)>0; });
  var mes=(m.periodoFim||hoje()).slice(0,7);
  var faltam=DOC_MENSAIS.filter(function(t){ var d=docPrest(oid,m.prestadorId,mes,t.k); return !(d&&d.status==='conferido'); });
  if(faltam.length) b.push({cod:'docs', t:'Documentos de '+mesNome(mes)+' de '+(prestNome(m.prestadorId)||'prestador')+' ainda não conferidos: '+faltam.map(function(t){ return t.n; }).join(', ')+'. Confira na aba Documentos.'});
  its.forEach(function(i){
    var ac=Math.round(((Number(i.qtdAnterior)||0)*0+medQtdOutras(oid,m.id,i.codigo)+i.qtdMedida)*1e6)/1e6;
    if(ac>i.qtdOrcada+1e-9) b.push({cod:'qtd', t:'Item '+i.codigo+': quantidade acumulada '+String(ac).replace('.',',')+' '+i.unidade+' passa da orçada ('+String(i.qtdOrcada).replace('.',',')+'). Excedente: '+String(Math.round((ac-i.qtdOrcada)*1e6)/1e6).replace('.',',')+'.'});
  });
  var ct=G('contratosPrest',m.contratoId), baseCt=ct&&ct.valor>0?ct.valor:medItensDoPrestador(oid,m.prestadorId).reduce(function(s,i){ return s+i.total; },0);
  var medido=medDoContrato(m.contratoId).filter(function(x){ return x.id!==m.id && MED_CONTA.indexOf(x.status)>=0; }).reduce(function(s,x){ return s+medBruto(x); },0)+medBruto(m);
  var pctMed=baseCt>0?medido/baseCt*100:0, avp=avancoPrestador(oid,m.prestadorId), avanco=avp==null?0:avp*100, tol=o.tolerAvanco==null?5:o.tolerAvanco;
  if(pctMed>avanco+tol+1e-9 && !(m.justificativas||[]).some(function(j){ return j.trava==='avanco'; })){
    b.push({cod:'avanco', t:'Medição acumulada de '+(Math.round(pctMed*10)/10).toString().replace('.',',')+'% do contrato passa do avanço registrado no cronograma ('+(Math.round(avanco*10)/10).toString().replace('.',',')+'%) mais a tolerância de '+String(tol).replace('.',',')+' pontos.'+(avp==null?' Não há atividades do prestador no cronograma.':'')+' Registre uma justificativa da engenharia ou atualize o avanço.'});
  }
  var vistas={};
  its.forEach(function(i){
    var n=i.etapa; if(!n||vistas[n]) return; vistas[n]=1;
    var ap=0, rep=0, reins=0, pend=0;
    etapaInfo(n).verif.forEach(function(_,k){ var f=fichaDoc(oid,n,k); if(!f) pend++; else if(f.resultado==='aprovado') ap++; else if(f.resultado==='reprovado') rep++; else if(f.resultado==='reinspecao') reins++; });
    if(rep||reins) b.push({cod:'ficha', t:'Etapa '+n+' ('+etapaInfo(n).nome+'): há ficha de verificação '+(rep?'reprovada':'aguardando reinspeção')+'. Resolva antes de medir.'});
    else if(!ap) b.push({cod:'ficha', t:'Etapa '+n+' ('+etapaInfo(n).nome+'): nenhuma ficha de verificação aprovada. Inspecione ao menos uma ficha antes de medir.'});
    else if(pend) av.push('Etapa '+n+': '+plural(pend,'ficha ainda sem inspeção','fichas ainda sem inspeção')+'.');
  });
  its.forEach(function(i){
    if(!i.aditivoId) return;
    var a=G('aditivos',i.aditivoId);
    if(!a||a.status!=='assinado') b.push({cod:'aditivo', t:'Item '+i.codigo+' vem de um aditivo que não está assinado pelo cliente.'});
  });
  var rap=retidoApontamento(m);
  if(rap.total>0) av.push('Ocorrência crítica aberta do prestador na(s) etapa(s) '+rap.etapas.join(', ')+': '+brl(rap.total)+' ficam retidos até a ocorrência fechar.');
  return {bloqueios:b, avisos:av, pctMedido:pctMed, avanco:avanco};
}
COBX.medCalc=medCalc; COBX.medTravas=medTravas; COBX.medItensDoPrestador=medItensDoPrestador; COBX.avancoPrestador=avancoPrestador;
COBX.G=G; COBX.L=L; COBX.byObra=byObra;

/* ---------- contas a pagar (geração; a tela vem no passo 4) ---------- */
function contaId(origem,id){ return 'cp_'+origem+'_'+id; }
function upsertConta(o, d){
  var id=contaId(d.origem,d.origemId), cur=G('contasPagar',id);
  if(cur && (cur.status==='paga')) return Promise.resolve(id);
  var rec=Object.assign({status:'aberta', pagoEm:'', forma:'', obs:'', vencimento:'', criadoEm:new Date().toISOString(), por:Store.uid||null}, cur||{}, d, {obraId:o.id});
  if(cur && cur.status==='cancelada') rec.status='aberta';
  delete rec.id;
  return Store.set('contasPagar', id, rec).then(function(){ return id; });
}
function baixarConta(origem,origemId,data){
  var c=G('contasPagar',contaId(origem,origemId)); if(!c||c.status==='paga') return Promise.resolve();
  return Store.set('contasPagar', c.id, Object.assign({}, c, {status:'paga', pagoEm:data||hoje()}));
}
COBX.contaId=contaId;

/* ---------- aba Medição ---------- */
function tMedicao(o){
  var oid=o.id, ms=medDaObra(oid), adm=modAdm(o);
  var head='<div class="sec-h"><div><h2>Medição</h2><p class="muted small">'+(adm?'A medição aprovada gera a conta a pagar, com retenção e descontos.':'A Cariati mede e aprova; o cliente paga. Retenção e desconto de dano são recomendações da Cariati ao cliente.')+'</p></div><button class="btn primary" data-act="med-nova" data-oid="'+oid+'" data-write>+ Nova medição</button></div>';
  if(!ms.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhuma medição</h3><p>Escolha o contrato do prestador e o período. Só aparecem para medir os itens do orçamento revisado ligados ao prestador.</p></div>';
  return head+'<div class="card tbl-scroll" style="margin-top:14px"><table class="tbl"><thead><tr><th>Nº</th><th>Prestador</th><th>Período</th><th class="num">Bruto</th><th class="num">'+(adm?'Líquido a pagar':'A pagar (cliente)')+'</th><th>Situação</th><th></th></tr></thead><tbody>'+ms.map(function(m){
    var c=medCalc(m,o), parada=m.status==='em_analise' && m.analiseDesde && diffDays(m.analiseDesde.slice(0,10),hoje())>(o.diasEscalar==null?7:o.diasEscalar);
    return '<tr><td class="num">'+m.numero+'</td><td><strong>'+esc(prestNome(m.prestadorId)||'Prestador removido')+'</strong></td><td>'+fmtC(m.periodoIni)+' a '+fmt(m.periodoFim)+'</td><td class="num">'+brl(c.bruto)+'</td><td class="num"><strong>'+brl(m.status==='rascunho'||m.status==='em_analise'?c.liquido:(m.valorLiquido!=null?m.valorLiquido:c.liquido))+'</strong></td><td><span class="chip '+(m.status==='paga'?'ok':(m.status==='aprovada'?'steel':(parada?'crit':(m.status==='em_analise'?'warn':''))))+'">'+MED_ST[m.status]+(parada?' há muito tempo':'')+'</span></td><td><button class="btn sm" data-act="med-abrir" data-id="'+m.id+'">Abrir</button></td></tr>';
  }).join('')+'</tbody></table></div>';
}
function medNovaForm(oid){
  var o=G('obras',oid), cts=byObra('contratosPrest',oid).filter(function(c){ return c.status!=='encerrado'; });
  if(!cts.length){ blockDlg('Cadastre um contrato de prestador',['A medição é feita sobre o contrato do prestador. Abra “Contratos e frentes” e cadastre o contrato.'],'Sem contrato'); return; }
  if(!orcVigente(oid)){ blockDlg('Importe o orçamento',['A medição usa os itens do orçamento revisado. Abra “Orçamento” e importe o CSV.'],'Sem orçamento'); return; }
  openForm({title:'Nova medição',
    fields:[{name:'contratoId',label:'Contrato',type:'select',required:true,options:selOpts(cts.map(function(c){ return [c.id, (prestNome(c.prestadorId)||'Prestador')+' — '+short(c.escopo,50)]; }),'Selecione…')},
      [{name:'periodoIni',label:'Início do período',type:'date',required:true,value:addDays(hoje(),-30)},{name:'periodoFim',label:'Fim do período',type:'date',required:true,value:hoje()}]],
    submit:'Continuar',
    onSubmit:async function(v){
      var c=G('contratosPrest',v.contratoId); if(!c) return 'Escolha o contrato.';
      if(!v.periodoIni||!v.periodoFim) return 'Informe o período.';
      if(v.periodoFim<v.periodoIni) return 'O fim do período não pode ser antes do início.';
      if(!medItensDoPrestador(oid,c.prestadorId).length) return 'Nenhum item do orçamento está ligado a este prestador. Importe o orçamento com o nome do prestador na coluna “prestador”.';
      var num=medDoContrato(c.id).reduce(function(m,x){ return Math.max(m,x.numero); },0)+1, id=nid();
      await Store.set('medicoes', id, {obraId:oid, contratoId:c.id, prestadorId:c.prestadorId, numero:num, periodoIni:v.periodoIni, periodoFim:v.periodoFim, status:'rascunho', itens:[], retencaoPct:c.retencao==null||c.retencao===''?0:Number(c.retencao), descontos:[], justificativas:[], criadoEm:new Date().toISOString(), por:Store.uid||null, hist:[]});
      setTimeout(function(){ medItensForm(id); }, 30); return false;
    }});
}
function medItensForm(id){
  var m=G('medicoes',id); if(!m) return;
  if(m.status!=='rascunho'){ blockDlg('Medição não pode ser editada',['Medição '+MED_ST[m.status].toLowerCase()+' não aceita alterações.'],'Edição bloqueada'); return; }
  var disp=medItensDoPrestador(m.obraId,m.prestadorId), atual={};
  (m.itens||[]).forEach(function(i){ atual[i.codigo]=i.qtdMedida; });
  var fields=disp.map(function(i,k){
    var ant=medQtdOutras(m.obraId,m.id,i.codigo);
    return {name:'q_'+k, label:i.codigo+' — '+short(i.descricao,60)+' ('+i.unidade+')', type:'number', min:0, step:'any', value:atual[i.codigo]==null?'':atual[i.codigo], hint:'Orçado '+String(i.quantidade).replace('.',',')+' · já medido '+String(ant).replace('.',',')+' · saldo '+String(Math.round((i.quantidade-ant)*1e6)/1e6).replace('.',',')+' · '+brl(i.precoUnitario)+' por '+i.unidade};
  });
  fields.push({name:'retencaoPct',label:'Retenção (%)',type:'number',min:0,max:100,step:'0.1',value:m.retencaoPct,hint:'Vem do contrato; pode ajustar.'});
  openForm({title:'Medição nº '+m.numero+': quantidades do período', wide:true, intro:esc(prestNome(m.prestadorId))+' — '+fmtC(m.periodoIni)+' a '+fmt(m.periodoFim)+'. Informe só o que foi executado no período; deixe em branco o resto.', fields:fields, submit:'Salvar quantidades',
    onSubmit:async function(v){
      var itens=[], excesso=[];
      disp.forEach(function(i,k){
        var q=v['q_'+k]; if(q==null||q===''||q===0) return;
        if(!(q>0)) { excesso.push(i.codigo+': quantidade inválida'); return; }
        var ant=medQtdOutras(m.obraId,m.id,i.codigo);
        if(ant+q>i.quantidade+1e-9) excesso.push(i.codigo+': '+String(q).replace('.',',')+' + '+String(ant).replace('.',',')+' já medidos passa da orçada ('+String(i.quantidade).replace('.',',')+'). Excedente '+String(Math.round((ant+q-i.quantidade)*1e6)/1e6).replace('.',','));
        itens.push({codigo:i.codigo, descricao:i.descricao, unidade:i.unidade, precoUnitario:i.precoUnitario, qtdOrcada:i.quantidade, qtdAnterior:ant, qtdMedida:q, etapa:i.etapa, valor:r2(q*i.precoUnitario), aditivoId:i.aditivoId||''});
      });
      if(excesso.length) return 'Quantidade acima do orçado: '+excesso[0]+(excesso.length>1?' (e mais '+(excesso.length-1)+')':'')+'.';
      if(!itens.length) return 'Informe a quantidade de ao menos um item.';
      var upd=Object.assign({}, m, {itens:itens, retencaoPct:v.retencaoPct==null?0:v.retencaoPct}), c=medCalc(upd,G('obras',m.obraId));
      if(c.liquido<0) return 'Retenções e descontos ('+brl(c.deducoes)+') passam do valor bruto ('+brl(c.bruto)+').';
      upd.valorBruto=c.bruto;
      await Store.set('medicoes', id, upd);
      setTimeout(function(){ medAbrir(id); },30); return false;
    }});
}
function medAbrir(id){
  var m=G('medicoes',id); if(!m){ closeDlg(); return; }
  var o=G('obras',m.obraId), adm=modAdm(o), c=medCalc(m,o), tv=medTravas(m,o), ed=m.status==='rascunho';
  var stx={rascunho:'', em_analise:'', aprovada:'', paga:''}[m.status];
  var itens=(m.itens||[]).length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th class="num">Orçado</th><th class="num">Anterior</th><th class="num">Neste período</th><th class="num">Valor</th></tr></thead><tbody>'+m.itens.map(function(i){ return '<tr><td>'+esc(i.codigo)+' — '+esc(short(i.descricao,50))+'<div class="tiny muted">Etapa '+(i.etapa||'—')+' · '+brl(i.precoUnitario)+'/'+esc(i.unidade)+'</div></td><td class="num">'+String(i.qtdOrcada).replace('.',',')+'</td><td class="num">'+String(medQtdOutras(m.obraId,m.id,i.codigo)).replace('.',',')+'</td><td class="num">'+String(i.qtdMedida).replace('.',',')+'</td><td class="num">'+brl(r2(i.qtdMedida*i.precoUnitario))+'</td></tr>'; }).join('')+'</tbody></table></div>':'<p class="muted small">Nenhuma quantidade lançada ainda.</p>';
  var danos=ed?L('danos').filter(function(d){ return d.obraId===m.obraId && d.causadorId===m.prestadorId && d.status==='aberta' && !(m.descontos||[]).some(function(x){ return x.ref===d.id; }); }):[];
  var ct=G('contratosPrest',m.contratoId);
  var descHtml=((m.descontos||[]).length?'<ul class="small" style="padding-left:18px">'+m.descontos.map(function(d,k){ return '<li>'+({dano:'Dano',adiantamento:'Adiantamento',outro:'Outro'})[d.tipo]+': '+esc(d.descricao||'')+' — <strong>'+brl(d.valor)+'</strong>'+(ed?' <button class="linkbtn" style="display:inline;color:var(--crit)" data-act="med-desc-rem" data-id="'+m.id+'" data-k="'+k+'" data-write aria-label="Remover desconto">×</button>':'')+'</li>'; }).join('')+'</ul>':'<p class="muted small">Nenhum desconto.</p>')
    +(danos.length?'<div class="callout" style="margin-top:8px"><strong>Danos abertos causados por este prestador</strong>'+(ct&&ct.regraDano?'<p class="small">Regra do contrato: '+esc(ct.regraDano)+'</p>':'')+'<ul>'+danos.map(function(d){ return '<li>'+esc(short(d.descricao,60))+' — '+brl(d.custo)+' <button class="btn sm" data-act="med-desc-dano" data-id="'+m.id+'" data-dano="'+d.id+'" data-write>Aplicar desconto</button></li>'; }).join('')+'</ul></div>':'');
  var tvHtml=(tv.bloqueios.length?'<div class="callout crit" style="margin-top:12px"><strong>Travas que impedem a aprovação</strong><ul>'+tv.bloqueios.map(function(b){ return '<li>'+esc(b.t)+'</li>'; }).join('')+'</ul>'+(tv.bloqueios.some(function(b){ return b.cod==='avanco'; })&&m.status!=='paga'&&m.status!=='aprovada'?'<p style="margin-top:8px"><button class="btn sm" data-act="med-justificar" data-id="'+m.id+'" data-write>Registrar justificativa de avanço</button></p>':'')+'</div>':(m.status==='rascunho'||m.status==='em_analise'?'<div class="callout ok" style="margin-top:12px"><strong>Nenhuma trava aberta.</strong></div>':''))
    +(tv.avisos.length&&(m.status==='rascunho'||m.status==='em_analise')?'<div class="callout" style="margin-top:12px"><strong>Avisos</strong><ul>'+tv.avisos.map(function(a){ return '<li>'+esc(a)+'</li>'; }).join('')+'</ul></div>':'')
    +((m.justificativas||[]).length?'<div class="small" style="margin-top:10px"><strong>Justificativas registradas</strong><ul style="padding-left:18px">'+m.justificativas.map(function(j){ return '<li>'+fmt(j.em)+' por '+esc(Names.get(j.por))+': '+esc(j.texto)+'</li>'; }).join('')+'</ul></div>':'');
  var acts='';
  if(m.status==='rascunho') acts='<button class="btn danger" data-act="med-excluir" data-id="'+m.id+'" data-write style="margin-right:auto">Excluir rascunho</button><button class="btn" data-act="med-itens" data-id="'+m.id+'" data-write>Editar quantidades</button><button class="btn primary" data-act="med-enviar" data-id="'+m.id+'" data-write>Enviar para análise</button>';
  if(m.status==='em_analise') acts='<button class="btn" data-act="med-devolver" data-id="'+m.id+'" data-write style="margin-right:auto">Devolver a rascunho</button><button class="btn primary" data-act="med-aprovar" data-id="'+m.id+'" data-write>Aprovar medição</button>';
  if(m.status==='aprovada') acts='<button class="btn primary" data-act="med-pagar" data-id="'+m.id+'" data-write>'+(adm?'Marcar como paga':'Cliente pagou')+'</button>';
  var fin=m.status==='aprovada'||m.status==='paga'?{bruto:m.valorBruto,retencao:m.retencao,desconto:m.descontosValor,rap:m.valorRetidoApontamento,liquido:m.valorLiquido}:{bruto:c.bruto,retencao:c.retencao,desconto:c.descontos,rap:c.retidoApontamento,liquido:c.liquido};
  openDlg('<div class="dlg-h"><h2>Medição nº '+m.numero+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<div class="row" style="margin-bottom:8px"><span class="chip steel">'+MED_ST[m.status]+'</span><strong>'+esc(prestNome(m.prestadorId)||'Prestador')+'</strong><span class="muted small">'+fmt(m.periodoIni)+' a '+fmt(m.periodoFim)+'</span></div>'
    +'<p class="small muted">Acumulado medido do contrato: '+(Math.round(tv.pctMedido*10)/10).toString().replace('.',',')+'% · avanço no cronograma: '+(Math.round(tv.avanco*10)/10).toString().replace('.',',')+'%</p>'
    +itens+'<h3 style="margin-top:14px">Descontos</h3>'+descHtml+(ed?'<p style="margin-top:8px"><button class="btn sm" data-act="med-desc-outro" data-id="'+m.id+'" data-write>+ Adiantamento ou outro desconto</button></p>':'')
    +'<dl class="small" style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;margin:16px 0 0"><dt>Valor bruto medido</dt><dd class="num" style="margin:0">'+brl(fin.bruto)+'</dd>'
    +'<dt>Retenção ('+String(m.retencaoPct||0).replace('.',',')+'%)'+(adm?'':' — recomendada')+'</dt><dd class="num" style="margin:0">− '+brl(fin.retencao)+'</dd>'
    +'<dt>Descontos'+(adm?'':' — recomendados')+'</dt><dd class="num" style="margin:0">− '+brl(fin.desconto)+'</dd>'
    +'<dt>Retido por apontamento crítico'+(adm?'':' — recomendado')+'</dt><dd class="num" style="margin:0">− '+brl(fin.rap)+'</dd>'
    +'<dt><strong>'+(adm?'Líquido a pagar':'A pagar pelo cliente')+'</strong></dt><dd class="num" style="margin:0;font-size:18px"><strong>'+brl(fin.liquido)+'</strong></dd></dl>'
    +(adm?'':'<p class="small muted" style="margin-top:8px">Neste contrato a Cariati não retém nem paga. Recomendação ao cliente: reter '+brl(r2((fin.retencao||0)+(fin.desconto||0)+(fin.rap||0)))+'.</p>')
    +tvHtml
    +(m.analiseDesvio?'<div class="callout" style="margin-top:12px"><strong>Análise do desvio</strong><p class="small" style="white-space:pre-wrap">'+esc(m.analiseDesvio)+'</p></div>':'')
    +'</div><div class="dlg-f">'+acts+'</div>', true);
}
function medAprovar(id){
  var m=G('medicoes',id), o=G('obras',m.obraId);
  if(m.status!=='em_analise'){ blockDlg('Não é possível aprovar',['Só uma medição em análise pode ser aprovada.'],'Aprovação bloqueada'); return; }
  var tv=medTravas(m,o);
  if(tv.bloqueios.length){ blockDlg('Não é possível aprovar a medição', tv.bloqueios.map(function(b){ return b.t; }), 'Antes de aprovar:'); return; }
  var c=medCalc(m,o), ev=evm(o), abaixo=(ev.spi!=null&&ev.spi<1)||(modAdm(o)&&ev.cpi!=null&&ev.cpi<1);
  var fim=async function(analise){
    var upd=Object.assign({}, m, {status:'aprovada', aprovadaPor:Store.uid||null, aprovadaEm:new Date().toISOString(), valorBruto:c.bruto, retencao:c.retencao, descontosValor:c.descontos, valorRetidoApontamento:c.retidoApontamento, valorLiquido:c.liquido, hist:(m.hist||[]).concat([{de:m.status, para:'aprovada', data:new Date().toISOString(), por:Store.uid||null}]).slice(-20)});
    if(analise) upd.analiseDesvio=analise;
    await Store.set('medicoes', id, upd);
    if(modAdm(o)) await upsertConta(o, {origem:'medicao', origemId:id, descricao:'Medição nº '+m.numero+' — '+(prestNome(m.prestadorId)||'prestador'), credorTipo:'prestador', credorId:m.prestadorId, valor:c.liquido, retencao:c.retencao, desconto:r2(c.descontos+c.retidoApontamento)});
    toast('Medição aprovada.'+(modAdm(o)?' Conta a pagar gerada.':' O cliente foi informado no relatório.'));
    setTimeout(function(){ medAbrir(id); },30);
  };
  if(abaixo){
    openForm({title:'Desvio de custo ou prazo', intro:'<strong>'+(ev.cpi!=null&&ev.cpi<1&&modAdm(o)?'CPI '+String(Math.round(ev.cpi*100)/100).replace('.',','):'')+(ev.spi!=null&&ev.spi<1?' SPI '+String(Math.round(ev.spi*100)/100).replace('.',','):'')+'</strong> abaixo de 1. Registre a causa e lembre-se de avisar o cliente.',
      fields:[{name:'analise',label:'Análise da causa do desvio',type:'textarea',required:true,rows:3}], submit:'Aprovar com análise',
      onSubmit:async function(v){ if(!(v.analise||'').trim()) return 'Registre a análise da causa do desvio.'; await fim(v.analise.trim()); return false; }});
    return;
  }
  confirmDlg('Aprovar medição nº '+m.numero+'?','<p>'+esc(prestNome(m.prestadorId))+': <strong>'+brl(c.liquido)+'</strong>'+(modAdm(o)?' líquido a pagar (gera a conta a pagar).':' a pagar pelo cliente.')+'</p><p class="small muted" style="margin-top:8px">Depois de aprovada, a medição não pode ser alterada.</p>','Aprovar',false).then(function(ok){ if(ok) fim(''); });
}
function medJustificarForm(id){
  var m=G('medicoes',id);
  openForm({title:'Justificativa de avanço', intro:'A medição passa do avanço registrado no cronograma. A engenharia explica e a justificativa fica registrada com autor e data.',
    fields:[{name:'texto',label:'Justificativa',type:'textarea',required:true,rows:3,ph:'Ex.: avanço não lançado no cronograma; fiscalização em campo confirma a execução.'}], submit:'Registrar justificativa',
    onSubmit:async function(v){ if(!(v.texto||'').trim()) return 'Escreva a justificativa.'; await Store.set('medicoes', id, Object.assign({}, m, {justificativas:(m.justificativas||[]).concat([{trava:'avanco', texto:v.texto.trim(), por:Store.uid||null, em:hoje()}])})); setTimeout(function(){ medAbrir(id); },30); return false; }});
}
function medDescOutroForm(id){
  var m=G('medicoes',id);
  openForm({title:'Adiantamento ou outro desconto', fields:[{name:'tipo',label:'Tipo',type:'radio',required:true,options:[['adiantamento','Adiantamento'],['outro','Outro']],value:'adiantamento'},{name:'descricao',label:'Descrição',required:true},{name:'valor',label:'Valor (R$)',type:'number',min:0,step:'0.01',required:true}], submit:'Aplicar',
    onSubmit:async function(v){ if(!(v.descricao||'').trim()) return 'Descreva o desconto.'; if(!(v.valor>0)) return 'Informe o valor.'; await Store.set('medicoes', id, Object.assign({}, m, {descontos:(m.descontos||[]).concat([{tipo:v.tipo, ref:'', valor:r2(v.valor), descricao:v.descricao.trim()}])})); setTimeout(function(){ medAbrir(id); },30); return false; }});
}
Object.assign(A4,{
  'med-nova':function(d){ medNovaForm(d.oid); },
  'med-abrir':function(d){ medAbrir(d.id); },
  'med-itens':function(d){ medItensForm(d.id); },
  'med-enviar':async function(d){
    var m=G('medicoes',d.id); if(!(m.itens||[]).length){ blockDlg('Medição vazia',['Lance a quantidade de ao menos um item.'],'Não dá para enviar'); return; }
    await Store.set('medicoes', d.id, Object.assign({}, m, {status:'em_analise', analiseDesde:new Date().toISOString(), hist:(m.hist||[]).concat([{de:'rascunho', para:'em_analise', data:new Date().toISOString(), por:Store.uid||null}]).slice(-20)}));
    toast('Medição enviada para análise.'); medAbrir(d.id);
  },
  'med-devolver':async function(d){ var m=G('medicoes',d.id); await Store.set('medicoes', d.id, Object.assign({}, m, {status:'rascunho', analiseDesde:''})); medAbrir(d.id); },
  'med-aprovar':function(d){ medAprovar(d.id); },
  'med-pagar':async function(d){
    var m=G('medicoes',d.id), o=G('obras',m.obraId);
    var ok=await confirmDlg(modAdm(o)?'Marcar como paga?':'Registrar pagamento do cliente?','<p>Medição nº '+m.numero+': <strong>'+brl(m.valorLiquido)+'</strong>.</p>',modAdm(o)?'Marcar como paga':'Registrar',false); if(!ok) return;
    await Store.set('medicoes', d.id, Object.assign({}, m, {status:'paga', pagaEm:hoje()}));
    if(modAdm(o)) await baixarConta('medicao', d.id, hoje());
    toast('Pagamento registrado.'); medAbrir(d.id);
  },
  'med-excluir':async function(d){ var m=G('medicoes',d.id); if(m.status!=='rascunho') return; var ok=await confirmDlg('Excluir rascunho?','<p>Só rascunhos podem ser excluídos.</p>','Excluir',true); if(ok){ await Store.del('medicoes',d.id); closeDlg(); } },
  'med-justificar':function(d){ medJustificarForm(d.id); },
  'med-desc-dano':async function(d){ var m=G('medicoes',d.id), dn=G('danos',d.dano); if(!dn) return; await Store.set('medicoes', d.id, Object.assign({}, m, {descontos:(m.descontos||[]).concat([{tipo:'dano', ref:dn.id, valor:r2(dn.custo), descricao:short(dn.descricao,60)}])})); medAbrir(d.id); },
  'med-desc-outro':function(d){ medDescOutroForm(d.id); },
  'med-desc-rem':async function(d){ var m=G('medicoes',d.id); var ds=(m.descontos||[]).slice(); ds.splice(Number(d.k),1); await Store.set('medicoes', d.id, Object.assign({}, m, {descontos:ds})); medAbrir(d.id); }
});

/* ================= CONTAS A PAGAR, APORTES E FLUXO DE CAIXA ================= */
var CONTA_ST={aberta:'Aberta', paga:'Paga', cancelada:'Cancelada'};
var CONTA_ORIGEM={medicao:'Medição', compra:'Compra', locacao:'Locação', outro:'Avulsa'};
var FORMAS_PAG=['Pix','Transferência','Boleto','Dinheiro','Cheque','Outra'];

function vencDaCond(cond, base){ var m=/(\d+)\s*dias?/i.exec(String(cond||'')); return (m&&base)?addDays(base,Number(m[1])):''; }
function contaDaCompra(id){
  var c=G('compras',id); if(!c||!c.pedido) return Promise.resolve();
  var o=G('obras',c.obraId); if(!o||!modAdm(o)) return Promise.resolve();
  var e=cotEscolhida(c), venc=vencDaCond(e&&e.cond, c.pedido.entregaPrevista);
  var d={origem:'compra', origemId:id, descricao:'Compra: '+c.item, credorTipo:'fornecedor', credorId:c.pedido.fornecedorId||'', valor:r2(c.pedido.total), retencao:0, desconto:0};
  var cur=G('contasPagar',contaId('compra',id)); if(!cur||!cur.vencimento) d.vencimento=venc;
  return upsertConta(o,d);
}
function locValorReal(l){ return r2((Number(l.valorDia)||0)*Math.max(1,diffDays(l.inicio,(l.devolucao&&l.devolucao.data)||l.fimPrevisto)+1)); }
function contaDaLocacao(id){
  var l=G('locacoes',id); if(!l||l.status!=='devolvida') return Promise.resolve();
  var o=G('obras',l.obraId); if(!o||!modAdm(o)) return Promise.resolve();
  return upsertConta(o,{origem:'locacao', origemId:id, descricao:'Locação: '+l.equipamento, credorTipo:'fornecedor', credorId:l.fornecedorId||'', valor:locValorReal(l), retencao:0, desconto:0});
}
COBX.vencDaCond=vencDaCond; COBX.locValorReal=locValorReal;

function contaVencida(c){ return c.status==='aberta' && c.vencimento && c.vencimento<hoje(); }
function contaAVencer(c,dias){ return c.status==='aberta' && c.vencimento && c.vencimento>=hoje() && c.vencimento<=addDays(hoje(),dias||7); }
function contasDaObra(oid){ return byObra('contasPagar',oid).sort(function(a,b){ return (a.vencimento||'9')<(b.vencimento||'9')?-1:1; }); }
function credorNome(c){ return c.credorTipo==='prestador'?prestNome(c.credorId):(c.credorTipo==='fornecedor'?fornNome(c.credorId):'')||c.credorNome||''; }
function origemConferida(c){
  if(c.origem==='compra'){ var x=G('compras',c.origemId); return !!x && (x.status==='conferido'||x.status==='pago'); }
  if(c.origem==='medicao'){ var m=G('medicoes',c.origemId); return !!m && (m.status==='aprovada'||m.status==='paga'); }
  if(c.origem==='locacao'){ var l=G('locacoes',c.origemId); return !!l && l.status==='devolvida'; }
  return true;
}
function mesDe(s){ return s?String(s).slice(0,7):''; }
function fluxoCaixa(oid){
  var contas=byObra('contasPagar',oid).filter(function(c){ return c.status!=='cancelada'; }), aps=byObra('aportes',oid), M={}, semData={n:0,valor:0};
  var at=function(m){ return M[m]||(M[m]={mes:m,aportePrev:0,aporteRec:0,desembPrev:0,desembReal:0}); };
  aps.forEach(function(a){ if(a.dataPrevista&&a.valorPrevisto) at(mesDe(a.dataPrevista)).aportePrev=r2(at(mesDe(a.dataPrevista)).aportePrev+Number(a.valorPrevisto)); if(a.dataRecebida&&a.valorRecebido) at(mesDe(a.dataRecebida)).aporteRec=r2(at(mesDe(a.dataRecebida)).aporteRec+Number(a.valorRecebido)); });
  contas.forEach(function(c){
    if(c.vencimento) at(mesDe(c.vencimento)).desembPrev=r2(at(mesDe(c.vencimento)).desembPrev+c.valor); else if(c.status==='aberta'){ semData.n++; semData.valor=r2(semData.valor+c.valor); }
    if(c.status==='paga'&&c.pagoEm) at(mesDe(c.pagoEm)).desembReal=r2(at(mesDe(c.pagoEm)).desembReal+c.valor);
  });
  var ms=Object.keys(M).sort(), atual=hoje().slice(0,7), acum=0, out=[];
  if(ms.length){ for(var m=ms[0]; m<=ms[ms.length-1]; m=mesAdd(m,1)) at(m); ms=Object.keys(M).sort(); }
  ms.forEach(function(m){ var x=M[m], passado=m<=atual; x.saldoMes=passado?r2(x.aporteRec-x.desembReal):r2(x.aportePrev-x.desembPrev); acum=r2(acum+x.saldoMes); x.saldoAcum=acum; x.realizado=passado; out.push(x); });
  return {meses:out, semData:semData};
}
COBX.fluxoCaixa=fluxoCaixa;
function desembolsoCliente(oid){
  var o=G('obras',oid), M={};
  byObra('medicoes',oid).forEach(function(m){
    var mes=mesDe(m.periodoFim); if(!mes) return; var x=M[mes]||(M[mes]={mes:mes,aprovadas:0,aAprovar:0}), c=medCalc(m,o);
    if(m.status==='aprovada'||m.status==='paga') x.aprovadas=r2(x.aprovadas+(m.valorLiquido!=null?m.valorLiquido:c.liquido)); else x.aAprovar=r2(x.aAprovar+c.liquido);
  });
  return Object.keys(M).sort().map(function(k){ return M[k]; });
}
COBX.desembolsoCliente=desembolsoCliente;

/* ---------- gráfico SVG genérico (barras e linhas) ---------- */
function svgGrafico(cfg){
  var W=Math.max(520,cfg.labels.length*(cfg.largBarra||56)+90), H=cfg.altura||240, L0=64, R=14, T=14, B=34, iw=W-L0-R, ih=H-T-B, n=cfg.labels.length;
  var todos=[0]; (cfg.barras||[]).concat(cfg.linhas||[]).forEach(function(s){ s.v.forEach(function(x){ if(x!=null) todos.push(x); }); });
  var mn=Math.min.apply(null,todos), mx=Math.max.apply(null,todos); if(mx===mn) mx=mn+1;
  var pad=(mx-mn)*0.06; if(mx>0) mx+=pad; if(mn<0) mn-=pad;
  var Y=function(v){ return T+ih-(v-mn)/(mx-mn)*ih; }, gw=iw/Math.max(1,n), fmtv=cfg.fmt||function(v){ return String(Math.round(v)); };
  var g='';
  for(var k=0;k<=4;k++){ var v=mn+(mx-mn)*k/4, y=Y(v); g+='<line x1="'+L0+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" class="lob-grid"/><text x="'+(L0-6)+'" y="'+(y+4)+'" text-anchor="end" class="lob-t">'+esc(fmtv(v))+'</text>'; }
  g+='<line x1="'+L0+'" x2="'+(W-R)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--ink3)" stroke-width="1"/>';
  var nb=(cfg.barras||[]).length, bw=Math.min(22,gw*0.72/Math.max(1,nb));
  (cfg.barras||[]).forEach(function(s,si){ s.v.forEach(function(x,i){ if(x==null) return; var cx=L0+gw*i+gw/2, bx=cx-(nb*bw)/2+si*bw, y0=Y(0), y1=Y(x); g+='<rect x="'+bx+'" y="'+Math.min(y0,y1)+'" width="'+(bw-2)+'" height="'+Math.max(1,Math.abs(y0-y1))+'" rx="2" fill="'+s.cor+'"'+(s.opaco?' opacity=".45"':'')+'><title>'+esc(s.nome+' — '+cfg.labels[i]+': '+fmtv(x))+'</title></rect>'; }); });
  (cfg.linhas||[]).forEach(function(s){
    var pts=[]; s.v.forEach(function(x,i){ if(x!=null) pts.push((L0+gw*i+gw/2)+','+Y(x)); });
    if(pts.length>1) g+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+s.cor+'" stroke-width="2.5"'+(s.tracejado?' stroke-dasharray="6 4"':'')+'/>';
    s.v.forEach(function(x,i){ if(x!=null) g+='<circle cx="'+(L0+gw*i+gw/2)+'" cy="'+Y(x)+'" r="3" fill="'+s.cor+'"><title>'+esc(s.nome+' — '+cfg.labels[i]+': '+fmtv(x))+'</title></circle>'; });
  });
  var passo=Math.ceil(n/Math.max(1,Math.floor(iw/46)));
  cfg.labels.forEach(function(lb,i){ if(i%passo===0) g+='<text x="'+(L0+gw*i+gw/2)+'" y="'+(H-12)+'" text-anchor="middle" class="lob-t">'+esc(lb)+'</text>'; });
  var leg='<div class="legenda" style="margin-top:6px">'+(cfg.barras||[]).concat(cfg.linhas||[]).map(function(s){ return '<span><i style="background:'+s.cor+';border-color:'+s.cor+'"></i>'+esc(s.nome)+'</span>'; }).join('')+'</div>';
  return '<div style="overflow-x:auto"><svg class="lob" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+esc(cfg.titulo||'Gráfico')+'">'+g+'</svg></div>'+leg;
}
function kfmt(v){ var a=Math.abs(v); return (v<0?'−':'')+(a>=1000000?(Math.round(a/1e5)/10).toString().replace('.',',')+' mi':(a>=1000?(Math.round(a/100)/10).toString().replace('.',',')+' mil':String(Math.round(a)))); }
function mesCurto(m){ var N=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; return N[Number(m.slice(5))-1]+'/'+m.slice(2,4); }
COBX.svgGrafico=svgGrafico;

/* ---------- aba Financeiro ---------- */
function tFinanceiro(o){
  var oid=o.id, adm=modAdm(o);
  if(!adm){
    var ds=desembolsoCliente(oid);
    var head='<div class="sec-h"><div><h2>Desembolso previsto do cliente</h2><p class="muted small">Neste contrato o cliente paga os prestadores. Aqui ficam as medições aprovadas e a aprovar, por mês.</p></div></div>';
    if(!ds.length) return head+custoPainelHtml(o)+'<div class="card empty sec"><h3>Nenhuma medição ainda</h3><p>Quando houver medições, o desembolso previsto aparece aqui.</p></div>';
    return head+custoPainelHtml(o)+'<section class="card sec pad">'+svgGrafico({titulo:'Desembolso previsto do cliente por mês', labels:ds.map(function(x){ return mesCurto(x.mes); }), barras:[{nome:'Medições aprovadas',cor:'var(--steel)',v:ds.map(function(x){ return x.aprovadas; })},{nome:'A aprovar',cor:'var(--amber-bar)',v:ds.map(function(x){ return x.aAprovar; })}], fmt:kfmt})+'</section>'
      +'<div class="card tbl-scroll sec"><table class="tbl"><thead><tr><th>Mês</th><th class="num">Aprovadas</th><th class="num">A aprovar</th><th class="num">Total</th></tr></thead><tbody>'+ds.map(function(x){ return '<tr><td>'+mesNome(x.mes)+'</td><td class="num">'+brl(x.aprovadas)+'</td><td class="num">'+brl(x.aAprovar)+'</td><td class="num"><strong>'+brl(r2(x.aprovadas+x.aAprovar))+'</strong></td></tr>'; }).join('')+'</tbody></table></div>';
  }
  var contas=contasDaObra(oid), f=ui.finFiltro||'abertas', fl={todas:contas, abertas:contas.filter(function(c){ return c.status==='aberta'; }), vencidas:contas.filter(contaVencida), avencer:contas.filter(function(c){ return contaAVencer(c,7); }), pagas:contas.filter(function(c){ return c.status==='paga'; }), canceladas:contas.filter(function(c){ return c.status==='cancelada'; })}[f]||contas;
  var abertas=contas.filter(function(c){ return c.status==='aberta'; }), soma=function(l){ return r2(l.reduce(function(s,c){ return s+c.valor; },0)); };
  var cards='<div class="grid cols3"><div class="card pad"><div class="small muted">Em aberto</div><div class="num" style="font-size:24px;font-weight:600">'+brl(soma(abertas))+'</div><div class="tiny muted">'+plural(abertas.length,'conta','contas')+'</div></div>'
    +'<div class="card pad"><div class="small muted">Vencidas</div><div class="num" style="font-size:24px;font-weight:600;color:'+(contas.some(contaVencida)?'var(--crit)':'inherit')+'">'+brl(soma(contas.filter(contaVencida)))+'</div></div>'
    +'<div class="card pad"><div class="small muted">A vencer em 7 dias</div><div class="num" style="font-size:24px;font-weight:600">'+brl(soma(contas.filter(function(c){ return contaAVencer(c,7); })))+'</div></div></div>';
  var filtros='<div class="row" style="gap:6px;margin:12px 0">'+[['abertas','Abertas'],['vencidas','Vencidas'],['avencer','A vencer em 7 dias'],['pagas','Pagas'],['canceladas','Canceladas'],['todas','Todas']].map(function(x){ return '<button class="btn sm'+(f===x[0]?' primary':'')+'" data-act="fin-filtro" data-f="'+x[0]+'">'+x[1]+'</button>'; }).join('')+'</div>';
  var tab=fl.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Conta</th><th>Credor</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>'+fl.map(function(c){
    var acts='<button class="btn sm ghost" data-act="conta-editar" data-id="'+c.id+'" data-write>Editar</button>';
    if(c.status==='aberta') acts='<button class="btn sm primary" data-act="conta-paga" data-id="'+c.id+'" data-write>Marcar paga</button>'+acts+'<button class="btn sm ghost" data-act="conta-cancelar" data-id="'+c.id+'" data-write>Cancelar</button>';
    return '<tr><td>'+esc(c.descricao)+'<div class="tiny muted">'+CONTA_ORIGEM[c.origem]+(c.retencao?' · retenção '+brl(c.retencao):'')+(c.desconto?' · descontos '+brl(c.desconto):'')+(c.obs?' · '+esc(short(c.obs,50)):'')+'</div></td><td>'+esc(credorNome(c)||'—')+'</td><td>'+(c.vencimento?fmt(c.vencimento):'<span class="chip warn">Sem vencimento</span>')+'</td><td class="num">'+brl(c.valor)+'</td><td><span class="chip '+(c.status==='paga'?'ok':(c.status==='cancelada'?'':(contaVencida(c)?'crit':'steel')))+'">'+(contaVencida(c)?'Vencida':CONTA_ST[c.status])+'</span>'+(c.status==='paga'?'<div class="tiny muted">'+fmt(c.pagoEm)+(c.forma?' · '+esc(c.forma):'')+'</div>':'')+(c.status==='cancelada'&&c.motivoCancelamento?'<div class="tiny muted">'+esc(short(c.motivoCancelamento,50))+'</div>':'')+'</td><td style="white-space:nowrap">'+acts+'</td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted pad">Nenhuma conta nesta lista.</p>';
  var aps=byObra('aportes',oid).sort(function(a,b){ return (a.dataPrevista||'9')<(b.dataPrevista||'9')?-1:1; });
  var apHtml=aps.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Aporte</th><th>Previsto</th><th class="num">Valor previsto</th><th>Recebido</th><th class="num">Valor recebido</th><th></th></tr></thead><tbody>'+aps.map(function(a){
    var atr=!a.dataRecebida && a.dataPrevista && a.dataPrevista<hoje();
    return '<tr><td>'+esc(a.descricao)+(a.obs?'<div class="tiny muted">'+esc(short(a.obs,60))+'</div>':'')+'</td><td>'+fmt(a.dataPrevista)+(atr?' <span class="chip crit">Atrasado</span>':'')+'</td><td class="num">'+brl(a.valorPrevisto)+'</td><td>'+(a.dataRecebida?fmt(a.dataRecebida):'—')+'</td><td class="num">'+(a.valorRecebido!=null&&a.valorRecebido!==''?brl(a.valorRecebido):'—')+'</td><td style="white-space:nowrap">'+(a.dataRecebida?'':'<button class="btn sm primary" data-act="aporte-receber" data-id="'+a.id+'" data-write>Registrar recebimento</button>')+'<button class="btn sm ghost" data-act="aporte-editar" data-id="'+a.id+'" data-write>Editar</button></td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted pad">Nenhum aporte cadastrado. Registre quando o cliente vai depositar e quanto.</p>';
  var fx=fluxoCaixa(oid), fxHtml='';
  if(fx.meses.length){
    var neg=fx.meses.filter(function(m){ return m.saldoAcum<0; });
    fxHtml='<section class="card sec"><div class="card-h"><div><h2>Fluxo de caixa mensal</h2><p class="muted small">Meses até o atual usam o realizado (recebido − pago); meses futuros usam o previsto.</p></div>'+(neg.length?'<span class="chip crit">Saldo negativo em '+plural(neg.length,'mês','meses')+'</span>':'')+'</div><div class="pad">'
      +svgGrafico({titulo:'Fluxo de caixa mensal da obra', labels:fx.meses.map(function(m){ return mesCurto(m.mes); }), barras:[{nome:'Aportes (recebido ou previsto)',cor:'var(--ok)',v:fx.meses.map(function(m){ return m.realizado?m.aporteRec:m.aportePrev; })},{nome:'Desembolso (pago ou previsto)',cor:'var(--amber-bar)',v:fx.meses.map(function(m){ return m.realizado?m.desembReal:m.desembPrev; })}], linhas:[{nome:'Saldo acumulado',cor:'var(--steel)',v:fx.meses.map(function(m){ return m.saldoAcum; })}], fmt:kfmt})
      +'</div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Mês</th><th class="num">Aportes previstos</th><th class="num">Aportes recebidos</th><th class="num">Desembolso previsto</th><th class="num">Desembolso pago</th><th class="num">Saldo do mês</th><th class="num">Saldo acumulado</th></tr></thead><tbody>'+fx.meses.map(function(m){ return '<tr'+(m.saldoAcum<0?' style="background:var(--crit-soft)"':'')+'><td>'+mesNome(m.mes)+'</td><td class="num">'+brl(m.aportePrev)+'</td><td class="num">'+brl(m.aporteRec)+'</td><td class="num">'+brl(m.desembPrev)+'</td><td class="num">'+brl(m.desembReal)+'</td><td class="num">'+brl(m.saldoMes)+'</td><td class="num"><strong'+(m.saldoAcum<0?' style="color:var(--crit)"':'')+'>'+brl(m.saldoAcum)+'</strong></td></tr>'; }).join('')+'</tbody></table></div>'
      +(fx.semData.n?'<p class="small muted pad">'+plural(fx.semData.n,'conta sem vencimento','contas sem vencimento')+' ('+brl(fx.semData.valor)+') não entra no fluxo até o vencimento ser informado.</p>':'')+'</section>';
  }
  return '<div class="sec-h"><div><h2>Financeiro</h2><p class="muted small">Contas a pagar geradas por medições, pedidos de compra e locações devolvidas, aportes do cliente e fluxo de caixa.</p></div><div class="row"><button class="btn" data-act="aporte-novo" data-oid="'+oid+'" data-write>+ Aporte</button><button class="btn primary" data-act="conta-nova" data-oid="'+oid+'" data-write>+ Conta avulsa</button></div></div>'
    +'<div style="margin-top:14px">'+cards+'</div>'+custoPainelHtml(o)+'<section class="card sec"><div class="card-h"><h2>Contas a pagar</h2></div><div class="pad" style="padding-bottom:0">'+filtros+'</div>'+tab+'</section>'
    +'<section class="card sec"><div class="card-h"><h2>Aportes do cliente</h2></div>'+apHtml+'</section>'+fxHtml;
}
function contaNovaForm(oid){
  openForm({title:'Conta avulsa', intro:'Para despesas que não vêm de medição, compra ou locação.',
    fields:[{name:'descricao',label:'Descrição',required:true},{name:'credorNome',label:'Credor'},[{name:'valor',label:'Valor (R$)',type:'number',min:0,step:'0.01',required:true},{name:'vencimento',label:'Vencimento',type:'date'}],{name:'obs',label:'Observações',type:'textarea',rows:2}],
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva a conta.'; if(!(v.valor>0)) return 'Informe o valor.';
      var o=G('obras',oid), oi=nid(); await upsertConta(o,{origem:'outro', origemId:oi, descricao:v.descricao.trim(), credorTipo:'', credorId:'', credorNome:(v.credorNome||'').trim(), valor:r2(v.valor), retencao:0, desconto:0, vencimento:v.vencimento||'', obs:v.obs||''});
    }});
}
function contaEditarForm(id){
  var c=G('contasPagar',id), livre=c.origem==='outro', trav=c.status==='paga';
  openForm({title:'Editar conta', intro:esc(c.descricao)+(livre?'':' — valor vem da origem ('+CONTA_ORIGEM[c.origem]+') e não é editável aqui.'),
    fields:(livre?[{name:'descricao',label:'Descrição',required:true,value:c.descricao},{name:'valor',label:'Valor (R$)',type:'number',min:0,step:'0.01',required:true,value:c.valor}]:[]).concat([{name:'vencimento',label:'Vencimento',type:'date',value:c.vencimento},{name:'obs',label:'Observações',type:'textarea',rows:2,value:c.obs}]),
    onSubmit:async function(v){
      if(trav) return 'Conta paga não pode ser alterada.';
      var upd=Object.assign({}, c, {vencimento:v.vencimento||'', obs:v.obs||''});
      if(livre){ if(!(v.valor>0)) return 'Informe o valor.'; upd.descricao=(v.descricao||'').trim()||c.descricao; upd.valor=r2(v.valor); }
      delete upd.id; await Store.set('contasPagar', id, upd);
    }});
}
function contaPagaForm(id){
  var c=G('contasPagar',id);
  if(!origemConferida(c)){ blockDlg('Não é possível registrar o pagamento',[{compra:'O recebimento da compra ainda não foi conferido.',medicao:'A medição ainda não foi aprovada.',locacao:'O equipamento ainda não foi devolvido.'}[c.origem]||'A origem da conta ainda não foi conferida.'],'Pagamento bloqueado'); return; }
  openForm({title:'Marcar como paga', intro:esc(c.descricao)+' — <strong>'+brl(c.valor)+'</strong>',
    fields:[[{name:'data',label:'Data do pagamento',type:'date',required:true,value:hoje()},{name:'forma',label:'Forma',type:'select',options:FORMAS_PAG.map(function(f){ return [f,f]; }),value:'Pix'}]], submit:'Marcar como paga',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      var upd=Object.assign({}, c, {status:'paga', pagoEm:v.data, forma:v.forma||''}); delete upd.id; await Store.set('contasPagar', id, upd);
      if(c.origem==='compra'){ var x=G('compras',c.origemId); if(x&&x.status==='conferido') await setCompra(x,{status:'pago', pagoEm:v.data},'Pagamento registrado pela conta'); }
      if(c.origem==='medicao'){ var m=G('medicoes',c.origemId); if(m&&m.status==='aprovada') await Store.set('medicoes', m.id, Object.assign({}, m, {status:'paga', pagaEm:v.data})); }
      toast('Pagamento registrado.');
    }});
}
function contaCancelarForm(id){
  var c=G('contasPagar',id);
  openForm({title:'Cancelar conta', intro:esc(c.descricao)+' — '+brl(c.valor), fields:[{name:'motivo',label:'Motivo do cancelamento',type:'textarea',required:true,rows:2}], submit:'Cancelar conta',
    onSubmit:async function(v){ if(!(v.motivo||'').trim()) return 'Informe o motivo do cancelamento.'; var upd=Object.assign({}, c, {status:'cancelada', motivoCancelamento:v.motivo.trim(), canceladaEm:hoje()}); delete upd.id; await Store.set('contasPagar', id, upd); }});
}
function aporteForm(oid,a,receber){
  var novo=!a;
  openForm({title:receber?'Registrar recebimento do aporte':(novo?'Novo aporte do cliente':'Editar aporte'),
    fields:(receber?[]:[{name:'descricao',label:'Descrição',required:true,value:a&&a.descricao,ph:'Ex.: 2º aporte — fundação'},[{name:'valorPrevisto',label:'Valor previsto (R$)',type:'number',min:0,step:'0.01',required:true,value:a&&a.valorPrevisto},{name:'dataPrevista',label:'Data prevista',type:'date',required:true,value:a&&a.dataPrevista}]]).concat([[{name:'valorRecebido',label:'Valor recebido (R$)',type:'number',min:0,step:'0.01',value:a?(a.valorRecebido!=null?a.valorRecebido:(receber?a.valorPrevisto:'')):''},{name:'dataRecebida',label:'Data do recebimento',type:'date',value:a&&a.dataRecebida?a.dataRecebida:(receber?hoje():'')}]]).concat(receber?[]:[{name:'obs',label:'Observações',type:'textarea',rows:2,value:a&&a.obs}]),
    extra:novo||receber?'':'<button type="button" class="btn danger" data-act="aporte-excluir" data-id="'+a.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!receber){ if(!(v.descricao||'').trim()) return 'Descreva o aporte.'; if(!(v.valorPrevisto>0)) return 'Informe o valor previsto.'; if(!v.dataPrevista) return 'Informe a data prevista.'; }
      if((v.valorRecebido>0)!==!!v.dataRecebida) return 'Informe o valor e a data do recebimento juntos.';
      var rec=Object.assign({}, a||{}, {obraId:oid}); if(!receber){ rec.descricao=v.descricao.trim(); rec.valorPrevisto=r2(v.valorPrevisto); rec.dataPrevista=v.dataPrevista; rec.obs=v.obs||''; }
      rec.valorRecebido=v.valorRecebido>0?r2(v.valorRecebido):null; rec.dataRecebida=v.dataRecebida||'';
      delete rec.id; await Store.set('aportes', a?a.id:nid(), rec);
    }});
}
Object.assign(A4,{
  'fin-filtro':function(d){ ui.finFiltro=d.f; render(); },
  'conta-nova':function(d){ contaNovaForm(d.oid); },
  'conta-editar':function(d){ contaEditarForm(d.id); },
  'conta-paga':function(d){ contaPagaForm(d.id); },
  'conta-cancelar':function(d){ contaCancelarForm(d.id); },
  'aporte-novo':function(d){ aporteForm(d.oid); },
  'aporte-editar':function(d){ var a=G('aportes',d.id); aporteForm(a.obraId,a); },
  'aporte-receber':function(d){ var a=G('aportes',d.id); aporteForm(a.obraId,a,true); },
  'aporte-excluir':async function(d){ var ok=await confirmDlg('Excluir aporte?','<p>O registro será removido do fluxo de caixa.</p>','Excluir',true); if(ok){ await Store.del('aportes',d.id); closeDlg(); } }
});

/* ================= COMPROMETIDO, APROPRIADO E PAGO ================= */
// Cada valor passa por um caminho só: comprometido (ainda a executar) → apropriado (executado) → pago.
// Assim nada é contado duas vezes; "exposição" = comprometido + apropriado.
function repartir(valor, pesos){
  var ks=Object.keys(pesos).filter(function(k){ return pesos[k]>0; }), tot=ks.reduce(function(s,k){ return s+pesos[k]; },0), out={};
  if(!ks.length||!(valor>0)){ if(valor) out[0]=r2(valor); return out; }
  var soma=0, maior=ks[0];
  ks.forEach(function(k){ out[k]=r2(valor*pesos[k]/tot); soma=r2(soma+out[k]); if(pesos[k]>pesos[maior]) maior=k; });
  out[maior]=r2(out[maior]+valor-soma);
  return out;
}
function custoEtapa(oid){
  var o=G('obras',oid), adm=modAdm(o), rev=orcRevisado(oid), E={};
  var at=function(n){ n=Number(n)||0; return E[n]||(E[n]={etapa:n, orcado:0, comprometido:0, apropriado:0, pago:0}); };
  Object.keys(rev.porEtapa).forEach(function(n){ at(n).orcado=rev.porEtapa[n]; });
  var add=function(n,campo,v){ var x=at(n); x[campo]=r2(x[campo]+v); };
  if(adm){
    byObra('compras',oid).forEach(function(c){
      if(!c.pedido) return; var v=r2(c.pedido.total), n=c.etapa||0;
      if(c.status==='pedido'||c.status==='entregue') add(n,'comprometido',v);
      else if(c.status==='conferido'||c.status==='pago'){ add(n,'apropriado',v); if(c.status==='pago') add(n,'pago',v); }
    });
    byObra('locacoes',oid).forEach(function(l){
      var n=l.etapa||0;
      if(l.status==='prevista'||l.status==='ativa') add(n,'comprometido',locTotalPrev(l));
      else if(l.status==='devolvida'){
        add(n,'apropriado',locValorReal(l));
        var cp=G('contasPagar',contaId('locacao',l.id)); if(cp&&cp.status==='paga') add(n,'pago',cp.valor);
      }
    });
  }
  var meds=byObra('medicoes',oid), medidoPor={};
  meds.forEach(function(m){
    if(m.status!=='aprovada'&&m.status!=='paga') return;
    var porEt={}, bruto=0; (m.itens||[]).forEach(function(i){ var v=r2((Number(i.qtdMedida)||0)*i.precoUnitario); porEt[i.etapa||0]=r2((porEt[i.etapa||0]||0)+v); bruto=r2(bruto+v); });
    Object.keys(porEt).forEach(function(n){ add(n,'apropriado',porEt[n]); });
    medidoPor[m.contratoId]=r2((medidoPor[m.contratoId]||0)+bruto);
    if(m.status==='paga'){ var part=repartir(m.valorLiquido!=null?m.valorLiquido:bruto, porEt); Object.keys(part).forEach(function(n){ add(n,'pago',part[n]); }); }
  });
  byObra('contratosPrest',oid).forEach(function(c){
    if(c.status==='encerrado') return;
    var saldo=r2(Math.max(0,(Number(c.valor)||0)-(medidoPor[c.id]||0))); if(!saldo) return;
    var pesos={}; medItensDoPrestador(oid,c.prestadorId).forEach(function(i){ pesos[i.etapa||0]=(pesos[i.etapa||0]||0)+i.total; });
    var part=repartir(saldo,pesos); Object.keys(part).forEach(function(n){ add(n,'comprometido',part[n]); });
  });
  var lista=Object.keys(E).map(Number).sort(function(a,b){ return (a||99)-(b||99); }).map(function(n){ var x=E[n]; x.exposicao=r2(x.comprometido+x.apropriado); x.acima=x.orcado>0&&x.exposicao>x.orcado+0.005; x.semOrcamento=x.orcado<=0&&x.exposicao>0; return x; });
  var tot={orcado:0, comprometido:0, apropriado:0, pago:0};
  lista.forEach(function(x){ ['orcado','comprometido','apropriado','pago'].forEach(function(k){ tot[k]=r2(tot[k]+x[k]); }); }); tot.exposicao=r2(tot.comprometido+tot.apropriado);
  return {etapas:lista, total:tot};
}
COBX.custoEtapa=custoEtapa; COBX.repartir=repartir;
function custoPainelHtml(o){
  var c=custoEtapa(o.id), adm=modAdm(o);
  if(!c.etapas.length) return '';
  var pc=function(x,base){ return base>0?Math.round(x/base*100)+'%':'—'; };
  return '<section class="card sec"><div class="card-h"><div><h2>Orçado × comprometido × apropriado × pago</h2><p class="muted small">Cada valor passa por um caminho só, sem contar duas vezes: <strong>comprometido</strong> = pedidos ainda não conferidos, locações em curso e saldo dos contratos ainda não medido; <strong>apropriado</strong> = compras conferidas, medições aprovadas e locações devolvidas; <strong>pago</strong> = o que já saiu.'+(adm?'':' Neste contrato só entram contratos e medições (compras e locações são do cliente).')+'</p></div></div>'
    +'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th class="num">Orçado</th><th class="num">Comprometido</th><th class="num">Apropriado</th><th class="num">Pago</th><th class="num">Exposição</th><th class="num">% do orçado</th></tr></thead><tbody>'
    +c.etapas.map(function(x){ return '<tr'+(x.acima?' style="background:var(--crit-soft)"':'')+'><td>'+(x.etapa?x.etapa+'. '+esc(etapaInfo(x.etapa).nome):'Sem etapa')+(x.acima?' <span class="chip crit">Acima do orçado</span>':'')+(x.semOrcamento?' <span class="chip warn">Sem orçamento</span>':'')+'</td><td class="num">'+brl(x.orcado)+'</td><td class="num">'+brl(x.comprometido)+'</td><td class="num">'+brl(x.apropriado)+'</td><td class="num">'+brl(x.pago)+'</td><td class="num"><strong>'+brl(x.exposicao)+'</strong></td><td class="num">'+pc(x.exposicao,x.orcado)+'</td></tr>'; }).join('')
    +'<tr style="font-weight:600"><td>Total</td><td class="num">'+brl(c.total.orcado)+'</td><td class="num">'+brl(c.total.comprometido)+'</td><td class="num">'+brl(c.total.apropriado)+'</td><td class="num">'+brl(c.total.pago)+'</td><td class="num">'+brl(c.total.exposicao)+'</td><td class="num">'+pc(c.total.exposicao,c.total.orcado)+'</td></tr></tbody></table></div></section>';
}

/* ================= FÍSICO-FINANCEIRO, CURVAS S E INDICADORES ================= */
function janelaEtapa(oid,n){
  var ats=byObra('atividades',oid).filter(function(a){ return a.etapa===n; }); if(!ats.length) return null;
  var ini=ats[0].inicio, fim=ats[0].fim; ats.forEach(function(a){ if(a.inicio<ini) ini=a.inicio; if(a.fim>fim) fim=a.fim; });
  return {ini:ini, fim:fim, dias:Math.max(1,diffDays(ini,fim)+1)};
}
function fisicoEtapa(oid,n){
  var ats=byObra('atividades',oid).filter(function(a){ return a.etapa===n; }), e=etapaDoc(oid,n);
  if(e.status==='liberada') return {v:1, semAtividades:!ats.length, liberada:true};
  if(!ats.length) return {v:0, semAtividades:true, liberada:false};
  var tot=0, acc=0; ats.forEach(function(a){ var d=Math.max(1,diffDays(a.inicio,a.fim)+1); tot+=d; acc+=d*(a.avanco||0)/100; });
  return {v:acc/tot, semAtividades:false, liberada:false};
}
function pvAte(oid,data,rev){
  rev=rev||orcRevisado(oid); var pv=0, sem=[];
  Object.keys(rev.porEtapa).forEach(function(k){
    var n=Number(k), orc=rev.porEtapa[k]; if(!n||!(orc>0)) return;
    var j=janelaEtapa(oid,n); if(!j){ sem.push(n); return; }
    pv+=orc*Math.max(0,Math.min(1,(diffDays(j.ini,data)+1)/j.dias));
  });
  return {pv:r2(pv), semCronograma:sem};
}
function evm(o){
  var oid=o.id, rev=orcRevisado(oid), bac=rev.total, p=pvAte(oid,hoje(),rev), ev=0, semFis=[];
  Object.keys(rev.porEtapa).forEach(function(k){
    var n=Number(k), orc=rev.porEtapa[k]; if(!n||!(orc>0)) return;
    var f=fisicoEtapa(oid,n); if(f.semAtividades&&!f.liberada) semFis.push(n); ev+=orc*f.v;
  });
  ev=r2(ev);
  var adm=modAdm(o), ac=adm?custoEtapa(oid).total.apropriado:null;
  var cpi=(adm&&ac>0)?ev/ac:null, spi=p.pv>0?ev/p.pv:null;
  return {bac:bac, pv:p.pv, ev:ev, ac:ac, cpi:cpi, spi:spi, eac:(cpi&&cpi>0)?r2(bac/cpi):null, fisPct:bac>0?ev/bac:null, gastoPct:(adm&&bac>0)?ac/bac:null, semCronograma:p.semCronograma, semFisico:semFis};
}
COBX.evm=evm; COBX.fisicoEtapa=fisicoEtapa; COBX.pvAte=pvAte;
function corIdx(x){ return x==null?'':(x>=1?'ok':(x>=0.9?'warn':'crit')); }

function planoMensal(oid,rev){
  var M={};
  Object.keys(rev.porEtapa).forEach(function(k){
    var n=Number(k), orc=rev.porEtapa[k]; if(!n||!(orc>0)) return; var j=janelaEtapa(oid,n); if(!j) return;
    var dia_=orc/j.dias; for(var d=j.ini,i=0;i<j.dias;i++,d=addDays(d,1)){ var m=d.slice(0,7); M[m]=(M[m]||0)+dia_; }
  });
  return M;
}
function eventosCusto(oid){
  var o=G('obras',oid), adm=modAdm(o), ev=[];
  if(adm){
    byObra('compras',oid).forEach(function(c){
      if(!c.pedido) return; if(c.status==='conferido'||c.status==='pago') ev.push({data:(c.conf&&c.conf.data)||c.pedido.data, valor:r2(c.pedido.total), tipo:'apropriado'});
      if(c.status==='pago') ev.push({data:c.pagoEm||(c.conf&&c.conf.data)||c.pedido.data, valor:r2(c.pedido.total), tipo:'pago'});
    });
    byObra('locacoes',oid).forEach(function(l){
      if(l.status!=='devolvida') return; ev.push({data:(l.devolucao&&l.devolucao.data)||l.fimPrevisto, valor:locValorReal(l), tipo:'apropriado'});
      var cp=G('contasPagar',contaId('locacao',l.id)); if(cp&&cp.status==='paga') ev.push({data:cp.pagoEm, valor:cp.valor, tipo:'pago'});
    });
  }
  byObra('medicoes',oid).forEach(function(m){
    if(m.status==='aprovada'||m.status==='paga') ev.push({data:(m.aprovadaEm||m.periodoFim).slice(0,10), valor:m.valorBruto!=null?m.valorBruto:medBruto(m), tipo:'apropriado'});
    if(m.status==='paga') ev.push({data:m.pagaEm||m.periodoFim, valor:m.valorLiquido!=null?m.valorLiquido:medBruto(m), tipo:'pago'});
  });
  return ev.filter(function(x){ return x.data; });
}
function curvasS(o){
  var oid=o.id, rev=orcRevisado(oid), bac=rev.total, atual=hoje().slice(0,7), datas=[hoje()], ev=eventosCusto(oid), plano=planoMensal(oid,rev);
  ev.forEach(function(x){ datas.push(x.data); });
  byObra('atividades',oid).forEach(function(a){ datas.push(a.inicio); datas.push(a.fim); });
  ETAPAS.forEach(function(e){ var d=etapaDoc(oid,e.n); if(d.status==='liberada'&&d.liberadaEm) datas.push(d.liberadaEm); });
  datas=datas.filter(Boolean).sort(); var meses=[]; for(var m=datas[0].slice(0,7), fim=datas[datas.length-1].slice(0,7); m<=fim && meses.length<72; m=mesAdd(m,1)) meses.push(m);
  var acc=0, planAcum=meses.map(function(m){ acc+=(plano[m]||0); return r2(acc); });
  var lib={}, parcial=0;
  ETAPAS.forEach(function(e){ var n=e.n, orc=rev.porEtapa[n]; if(!(orc>0)) return; var f=fisicoEtapa(oid,n), d=etapaDoc(oid,n); if(f.liberada){ var mm=(d.liberadaEm||hoje()).slice(0,7); lib[mm]=(lib[mm]||0)+orc; } else parcial+=orc*f.v; });
  var la=0, realAcum=meses.map(function(m){ la+=(lib[m]||0); return m>atual?null:r2(la+(m===atual?parcial:0)); });
  var somaTipo=function(tipo){ var por={}; ev.filter(function(x){ return x.tipo===tipo; }).forEach(function(x){ var m=x.data.slice(0,7); por[m]=(por[m]||0)+x.valor; }); var a=0; return meses.map(function(m){ a+=(por[m]||0); return m>atual?null:r2(a); }); };
  return {meses:meses, bac:bac, fisPlan:planAcum.map(function(v){ return bac>0?Math.min(100,v/bac*100):0; }), fisReal:realAcum.map(function(v){ return v==null||!(bac>0)?null:v/bac*100; }), custoPlan:planAcum, apropriado:somaTipo('apropriado'), pago:somaTipo('pago')};
}
COBX.curvasS=curvasS;

function quadroAcompanhamento(o){
  var oid=o.id, c=custoEtapa(oid), out=[];
  c.etapas.forEach(function(x){
    if(!x.etapa||!(x.orcado>0)) return;
    var f=fisicoEtapa(oid,x.etapa), fis=f.v*100, fin=x.apropriado/x.orcado*100;
    out.push({etapa:x.etapa, fis:fis, fin:fin, semAtividades:f.semAtividades&&!f.liberada, alerta:fin-fis>10});
  });
  return out;
}
function quadroPrestadores(o){
  var oid=o.id, out=[];
  byObra('contratosPrest',oid).forEach(function(c){
    if(!(Number(c.valor)>0)) return;
    var medido=medDoContrato(c.id).filter(function(m){ return m.status==='aprovada'||m.status==='paga'; }).reduce(function(s,m){ return s+(m.valorBruto!=null?m.valorBruto:medBruto(m)); },0);
    var av=avancoPrestador(oid,c.prestadorId), fis=av==null?null:av*100, fin=medido/c.valor*100;
    out.push({prestadorId:c.prestadorId, fis:fis, fin:fin, alerta:fis!=null&&fin-fis>10});
  });
  return out;
}
COBX.quadroAcompanhamento=quadroAcompanhamento;
function tFisFin(o){
  var oid=o.id, adm=modAdm(o), e=evm(o), cv=curvasS(o), fm=function(x){ return x==null?'—':String(Math.round(x*100)/100).replace('.',','); };
  if(!(e.bac>0)) return '<div class="sec-h"><div><h2>Físico-financeiro</h2></div></div><div class="card empty" style="margin-top:14px"><h3>Sem orçamento</h3><p>Importe o orçamento (aba Orçamento) para ver as curvas S e os indicadores de custo e prazo.</p></div>';
  var card=function(t,v,sub,k){ return '<div class="card pad"><div class="small muted">'+t+'</div><div class="num" style="font-size:24px;font-weight:600'+(k==='crit'?';color:var(--crit)':(k==='warn'?';color:var(--amber)':''))+'">'+v+'</div><div class="tiny muted">'+sub+'</div></div>'; };
  var cards='<div class="grid cols3">'+card('Orçamento revisado (BAC)',brl(e.bac),'Base + aditivos assinados','')
    +card('Valor planejado até hoje (PV)',brl(e.pv),'Distribuição linear pelo cronograma','')
    +card('Valor agregado (EV)',brl(e.ev),'Orçado × físico realizado','')
    +(adm?card('Custo real (AC)',brl(e.ac),'Apropriado até hoje',''):'')
    +(adm?card('CPI (EV ÷ AC)',fm(e.cpi),e.cpi==null?'Sem custo apropriado ainda':(e.cpi>=1?'Custo dentro do valor agregado':'Custando mais do que o executado'),corIdx(e.cpi)):'')
    +card('SPI (EV ÷ PV)',fm(e.spi),e.spi==null?'Sem cronograma com orçamento':(e.spi>=1?'No prazo ou adiantado':'Atrasado em relação ao plano'),corIdx(e.spi))
    +(adm?card('Custo final previsto (EAC)',e.eac==null?'—':brl(e.eac),'BAC ÷ CPI',e.eac!=null&&e.eac>e.bac?'warn':''):'')+'</div>';
  var avisos=[]; if(e.semCronograma.length) avisos.push('Orçamento sem cronograma nas etapas: '+e.semCronograma.join(', ')+'. Elas ficam fora do valor planejado; cadastre atividades no cronograma.'); if(e.semFisico.length) avisos.push('Etapas com orçamento e sem atividades (físico contado como 0%): '+e.semFisico.join(', ')+'.');
  var avHtml=avisos.length?'<div class="callout" style="margin-top:14px"><strong>Atenção aos dados</strong><ul>'+avisos.map(function(a){ return '<li>'+esc(a)+'</li>'; }).join('')+'</ul></div>':'';
  var lb=cv.meses.map(mesCurto), pctf=function(v){ return Math.round(v)+'%'; };
  var g1=svgGrafico({titulo:'Curva S física: planejado e realizado', labels:lb, linhas:[{nome:'Físico planejado',cor:'var(--steel)',tracejado:true,v:cv.fisPlan},{nome:'Físico realizado',cor:'var(--ok)',v:cv.fisReal}], fmt:pctf});
  var g2=svgGrafico({titulo:'Curva S de custo: planejado, apropriado e pago', labels:lb, linhas:[{nome:'Custo planejado',cor:'var(--steel)',tracejado:true,v:cv.custoPlan},{nome:'Apropriado',cor:'var(--amber-bar)',v:cv.apropriado},{nome:'Pago',cor:'var(--ok)',v:cv.pago}], fmt:kfmt});
  var fx=fluxoCaixa(oid), ds=desembolsoCliente(oid), meses3;
  var g3;
  if(adm){ g3=fx.meses.length?svgGrafico({titulo:'Aportes mensais do cliente', labels:fx.meses.map(function(m){ return mesCurto(m.mes); }), barras:[{nome:'Aporte previsto',cor:'var(--steel)',opaco:true,v:fx.meses.map(function(m){ return m.aportePrev; })},{nome:'Aporte recebido',cor:'var(--ok)',v:fx.meses.map(function(m){ return m.aporteRec; })}], fmt:kfmt}):'<p class="muted small">Nenhum aporte cadastrado (aba Financeiro).</p>'; }
  else { g3=ds.length?svgGrafico({titulo:'Desembolso previsto do cliente por mês', labels:ds.map(function(x){ return mesCurto(x.mes); }), barras:[{nome:'Medições aprovadas',cor:'var(--steel)',v:ds.map(function(x){ return x.aprovadas; })},{nome:'A aprovar',cor:'var(--amber-bar)',v:ds.map(function(x){ return x.aAprovar; })}], fmt:kfmt}):'<p class="muted small">Nenhuma medição ainda.</p>'; }
  var qa=quadroAcompanhamento(o), qp=quadroPrestadores(o);
  var barra=function(v){ return '<div class="hbar" style="grid-template-columns:1fr;padding:0"><div class="t"><i style="width:'+Math.max(0,Math.min(100,v))+'%"></i></div></div>'; };
  var quadro='<section class="card sec"><div class="card-h"><div><h2>Acompanhamento: físico × financeiro</h2><p class="muted small">Financeiro adiante do físico em mais de 10 pontos é sinal de alerta (pagando mais do que foi feito).</p></div></div><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Etapa</th><th style="min-width:110px">Físico</th><th style="min-width:110px">Financeiro (apropriado ÷ orçado)</th><th></th></tr></thead><tbody>'
    +(qa.length?qa.map(function(x){ return '<tr'+(x.alerta?' style="background:var(--crit-soft)"':'')+'><td>'+x.etapa+'. '+esc(etapaInfo(x.etapa).nome)+'</td><td>'+Math.round(x.fis)+'%'+(x.semAtividades?' <span class="chip warn">sem atividades</span>':'')+barra(x.fis)+'</td><td>'+Math.round(x.fin)+'%'+barra(x.fin)+'</td><td>'+(x.alerta?'<span class="chip crit">Financeiro adiante do físico</span>':'')+'</td></tr>'; }).join(''):'<tr><td colspan="4" class="muted" style="padding:16px">Sem etapas orçadas.</td></tr>')
    +'</tbody></table></div>'
    +(qp.length?'<div class="card-h" style="border-top:1px solid var(--line2)"><h3>Por prestador (medido ÷ contrato × avanço no cronograma)</h3></div><div class="tbl-scroll"><table class="tbl"><tbody>'+qp.map(function(x){ return '<tr'+(x.alerta?' style="background:var(--crit-soft)"':'')+'><td>'+esc(prestNome(x.prestadorId)||'Prestador')+'</td><td>Físico '+(x.fis==null?'—':Math.round(x.fis)+'%')+'</td><td>Financeiro '+Math.round(x.fin)+'%</td><td>'+(x.alerta?'<span class="chip crit">Financeiro adiante do físico</span>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>':'')+'</section>';
  return '<div class="sec-h"><div><h2>Físico-financeiro</h2><p class="muted small">Curvas S e indicadores de valor agregado. O peso de cada etapa é o seu valor orçado; o planejado é distribuído dia a dia pelo cronograma.</p></div></div><div style="margin-top:14px">'+cards+'</div>'+avHtml
    +'<section class="card sec pad"><h3 style="margin-bottom:8px">Curva S física</h3>'+g1+'<p class="tiny muted">O realizado soma as etapas liberadas (no mês da liberação) e, no mês atual, o avanço das etapas em andamento.</p></section>'
    +'<section class="card sec pad"><h3 style="margin-bottom:8px">Curva S de custo</h3>'+g2+'</section>'
    +'<section class="card sec pad"><h3 style="margin-bottom:8px">'+(adm?'Aportes do cliente por mês':'Desembolso previsto do cliente por mês')+'</h3>'+g3+'</section>'+quadro;
}
