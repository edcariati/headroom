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
