/* ================= FASE 3 ================= */
var COMPRA_ST={necessidade:'Necessidade', cotacao:'Cotação', aprovacao:'Aprovação', pedido:'Pedido', entregue:'Entregue', conferido:'Conferido', pago:'Pago'};
var FLUXO_ADM=['necessidade','cotacao','aprovacao','pedido','entregue','conferido','pago'];
var FLUXO_GEST=['necessidade','entregue','conferido'];
var LOC_ST={prevista:'Prevista', ativa:'Ativa', devolvida:'Devolvida'};
var CK_ENTRADA=['Funcionamento testado na entrega','Sem avarias visíveis','Documentos e manual entregues'];
var CK_SAIDA=['Equipamento limpo','Sem avarias novas','Acessórios e combustível devolvidos'];
var UNIDADES=['un','m','m²','m³','kg','saco','barra','lata','cx','vb'];

function brl(x){ return (x==null||x==='')?'—':Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function modAdm(o){ return o.modalidade==='Administração de Obra'; }
function fluxoDe(o){ return modAdm(o)?FLUXO_ADM:FLUXO_GEST; }
function fornNome(id){ var f=id?G('fornecedores',id):null; return f?f.nome:''; }
function fornOptions(blank){ return selOpts(L('fornecedores').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');}).map(function(f){return [f.id,f.nome];}), blank); }
function limiteCompra(c){ return (c.dataUso && c.prazoEntrega!=null && c.prazoEntrega!=='') ? addDays(c.dataUso, -Number(c.prazoEntrega)) : ''; }
function menorCot(c){ var cs=c.cotacoes||[]; if(!cs.length) return null; return cs.reduce(function(m,x){ return x.preco<m.preco?x:m; }, cs[0]); }
function cotEscolhida(c){ return (c.cotacoes||[]).filter(function(x){return x.id===c.escolhida;})[0]||null; }
function valorCompra(c){ if(c.pedido) return c.pedido.total; var e=cotEscolhida(c); if(e) return e.preco; var m=menorCot(c); return m?m.preco:null; }
function nivelCompra(o,total,orcado){
  var motivos=[], mg=o.margemPreco==null?5:o.margemPreco;
  if(orcado!=null && orcado>0 && total>orcado*(1+mg/100)) motivos.push('Acima do orçado em mais de '+mg+'% ('+brl(total)+' contra '+brl(orcado)+').');
  if(o.alcada!=null && total>o.alcada) motivos.push('Acima da alçada de '+brl(o.alcada)+'.');
  return {nivel:motivos.length?3:2, motivos:motivos, semRef:(orcado==null||!(orcado>0)) && o.alcada==null};
}
function compraAtrasadaPedido(c){ var lim=limiteCompra(c); return !!lim && lim<hoje() && ['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0; }
function pedidoAtrasado(c){ return c.status==='pedido' && !!c.pedido && !!c.pedido.entregaPrevista && c.pedido.entregaPrevista<hoje(); }
function nivelDaCompra(o,c){ var e=cotEscolhida(c); return e?nivelCompra(o,e.preco,c.orcado):null; }
function fichaArmaduraOk(oid,n){
  var info=etapaInfo(n); if(!info) return null;
  var idx=-1; info.verif.forEach(function(v,i){ if(idx<0 && /^armadura/i.test(v.item)) idx=i; });
  if(idx<0) return null;
  var f=fichaDoc(oid,n,idx);
  return {ok:!!f && (f.resultado==='aprovado'||f.resultado==='na'), nome:info.verif[idx].item};
}
function travasPedido(o,c){
  var m=[];
  if(!c.aprov) m.push('A compra ainda não tem aprovação registrada.');
  foraEscopoTravas(c).forEach(function(t){ m.push(t); });
  if(c.sobMedida && !c.medidaOk) m.push('Item sob medida: confirme que a medida do vão acabado foi conferida em obra antes de pedir.');
  if(c.concretagem){
    var n=c.etapa||5, fa=fichaArmaduraOk(o.id,n);
    if(fa && !fa.ok) m.push('Concretagem: a ficha “'+fa.nome+'” da etapa '+n+' precisa estar aprovada (vistoria pré-concretagem) antes de agendar o concreto.');
  }
  return m;
}
function setCompra(c,patch,nota){
  var hist=(c.hist||[]);
  if(patch.status && patch.status!==c.status) hist=hist.concat([{de:c.status, para:patch.status, data:new Date().toISOString(), por:Store.uid||null, nota:nota||''}]).slice(-30);
  return Store.set('compras', c.id, Object.assign({}, c, patch, {hist:hist}));
}
function depoisCompra(id,vol){ if(vol){ openCompra(id); return false; } }

/* ---------- estoque ---------- */
function chaveItem(item,un){ return String(item||'').trim().toLowerCase()+'|'+String(un||'').trim().toLowerCase(); }
function saldos(oid){
  var m={};
  byObra('movEstoque',oid).forEach(function(x){
    var k=chaveItem(x.item,x.un); m[k]=m[k]||{item:x.item, un:x.un, saldo:0, entradas:0, saidas:0, perdas:0};
    var q=Number(x.qtd)||0;
    if(x.tipo==='entrada'){ m[k].saldo+=q; m[k].entradas+=q; }
    else { m[k].saldo-=q; if(x.tipo==='perda') m[k].perdas+=q; else m[k].saidas+=q; }
  });
  return Object.keys(m).map(function(k){ return Object.assign({k:k}, m[k]); }).sort(function(a,b){ return a.item.localeCompare(b.item); });
}

/* ---------- locação ---------- */
function locDiasPrev(l){ return Math.max(1, diffDays(l.inicio,l.fimPrevisto)+1); }
function locTotalPrev(l){ return (Number(l.valorDia)||0)*locDiasPrev(l); }
function locApont(l){ var a=l.apontamentos||{}, ds=Object.keys(a); return {n:ds.length, parado:ds.filter(function(d){return a[d].u==='parado';}).length}; }
function locParadoSeguidos(l){
  var a=l.apontamentos||{}, n=0, d=hoje();
  if(!a[d]) d=addDays(d,-1);
  while(a[d] && a[d].u==='parado'){ n++; d=addDays(d,-1); }
  return n;
}
function locAtrasada(l){ return l.status==='ativa' && l.fimPrevisto && l.fimPrevisto<hoje(); }

/* ================= FORNECEDORES ================= */
function vForn(){
  var fs=L('fornecedores').sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'');});
  var head='<div class="row spread"><div><h1>Fornecedores</h1><p class="muted small" style="margin-top:4px">Cadastro usado nas cotações, pedidos e locações de todas as obras.</p></div><button class="btn primary" data-act="forn-novo" data-write>+ Novo fornecedor</button></div>';
  if(!fs.length) return '<div class="wrap">'+head+'<div class="card empty" style="margin-top:18px"><h3>Nenhum fornecedor cadastrado</h3><p>Cadastre os fornecedores de material e de equipamento para montar cotações.</p></div></div>';
  return '<div class="wrap">'+head+'<div class="card tbl-scroll sec" style="margin-top:18px"><table class="tbl"><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Prazo médio</th><th>Compras</th><th></th></tr></thead><tbody>'+fs.map(function(f){
    var n=L('compras').filter(function(c){ return c.pedido && c.pedido.fornecedorId===f.id; }).length;
    return '<tr><td><strong>'+esc(f.nome)+'</strong><div class="tiny muted">'+esc([f.doc,f.contato].filter(Boolean).join(' · '))+'</div></td><td>'+esc(f.categoria||'—')+'</td><td>'+(f.prazoMedio?plural(Number(f.prazoMedio),'dia','dias'):'—')+'</td><td>'+n+'</td><td style="white-space:nowrap"><button class="btn sm" data-act="forn-editar" data-id="'+f.id+'" data-write>Editar</button> <button class="btn sm ghost" data-act="forn-excluir" data-id="'+f.id+'" data-write aria-label="Excluir fornecedor">×</button></td></tr>';
  }).join('')+'</tbody></table></div></div>';
}
function fornForm(f){
  var novo=!f;
  openForm({title:novo?'Novo fornecedor':'Editar fornecedor',
    fields:[{name:'nome',label:'Nome ou razão social',required:true,value:f&&f.nome},
      [{name:'categoria',label:'Categoria',value:f&&f.categoria,ph:'Ex.: Concreto, elétrica, locação'},{name:'doc',label:'CPF ou CNPJ',value:f&&f.doc}],
      [{name:'contato',label:'Contato',value:f&&f.contato,ph:'Telefone ou WhatsApp'},{name:'prazoMedio',label:'Prazo médio de entrega (dias)',type:'number',min:0,step:1,value:f&&f.prazoMedio}]],
    onSubmit:async function(v){
      if(!(v.nome||'').trim()) return 'Informe o nome do fornecedor.';
      await Store.set('fornecedores', f?f.id:nid(), Object.assign({}, f||{}, {nome:v.nome.trim(), categoria:v.categoria||'', doc:v.doc||'', contato:v.contato||'', prazoMedio:v.prazoMedio==null?'':v.prazoMedio}));
    }});
}

/* ================= COMPRAS ================= */
function rotuloAvancar(o,c){
  var adm=modAdm(o);
  if(c.status==='necessidade') return adm?'Iniciar cotação':'Registrar entrega';
  if(c.status==='cotacao') return 'Enviar para aprovação';
  if(c.status==='aprovacao') return c.aprov?'Emitir pedido':'Aprovar';
  if(c.status==='pedido') return 'Registrar entrega';
  if(c.status==='entregue') return 'Conferir recebimento';
  if(c.status==='conferido' && adm) return 'Marcar como pago';
  return '';
}
function kcardCompra(o,c){
  var val=valorCompra(c), lim=limiteCompra(c), atrLim=compraAtrasadaPedido(c), atrEnt=pedidoAtrasado(c), rot=rotuloAvancar(o,c);
  var nv=(c.status==='aprovacao'&&!c.aprov)?nivelDaCompra(o,c):null;
  return '<div class="kcard'+(atrLim||atrEnt?' crit':(c.critico?' importante':''))+'"><button type="button" class="linkbtn" data-act="compra-abrir" data-id="'+c.id+'">'+esc(c.item)+'</button><div class="m">'
    +(c.qtd?'<span class="chip">'+esc(String(c.qtd).replace('.',','))+' '+esc(c.un||'')+'</span>':'')
    +(val!=null?'<span class="chip steel">'+brl(val)+'</span>':'')
    +(c.etapa?'<span class="chip">Etapa '+c.etapa+'</span>':'')
    +(c.critico?'<span class="chip warn">Crítico</span>':'')
    +(lim&&['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0?'<span class="chip '+(atrLim?'crit':'')+'">Pedir até '+fmtC(lim)+'</span>':'')
    +(c.status==='pedido'&&c.pedido&&c.pedido.entregaPrevista?'<span class="chip '+(atrEnt?'crit':'')+'">Entrega '+fmtC(c.pedido.entregaPrevista)+'</span>':'')
    +(nv&&nv.nivel===3?'<span class="chip warn">Precisa do cliente</span>':'')
    +(c.status==='aprovacao'&&c.aprov?'<span class="chip ok">Aprovado (nível '+c.aprov.nivel+')</span>':'')
    +'</div>'+(rot?'<div class="mv"><button class="btn sm primary" data-act="compra-avancar" data-id="'+c.id+'" data-write>'+rot+' →</button></div>':'')+'</div>';
}
function tCompras(o){
  var oid=o.id, fl=fluxoDe(o), cs=byObra('compras',oid), adm=modAdm(o);
  var cols=fl.map(function(st,i){
    var lst=cs.filter(function(c){ return c.status===st || (i===0 && fl.indexOf(c.status)<0); });
    return '<section class="col"><header>'+COMPRA_ST[st]+' <span class="n num">'+lst.length+'</span></header><div class="cards">'+(lst.length?lst.sort(function(a,b){ return (limiteCompra(a)||'9')<(limiteCompra(b)||'9')?-1:1; }).map(function(c){return kcardCompra(o,c);}).join(''):'<p class="muted small" style="padding:8px 4px">Nenhuma</p>')+'</div></section>';
  }).join('');
  var info=adm?'<div class="row" style="gap:6px;margin:12px 0"><span class="chip '+(o.alcada==null?'warn':'steel')+'">Alçada: '+(o.alcada==null?'não definida':brl(o.alcada))+'</span><span class="chip steel">Margem sobre o orçado: '+(o.margemPreco==null?5:o.margemPreco)+'%</span><button class="btn sm ghost" data-act="obra-editar" data-oid="'+oid+'" data-write>Ajustar</button></div>'
    :'<div class="callout" style="margin:12px 0">Neste contrato (Gestão de Obras) a compra é do cliente. A Cariati confere a especificação e o recebimento, mas não cota, pede nem paga.</div>';
  var lista=(ui.cmpVista==='lista'&&cs.length)?comprasLista(o,cs):'';
  return '<div class="sec-h"><div><h2>Compras</h2><p class="muted small">'+(adm?'Da necessidade ao pagamento. Compra fora do orçado ou acima da alçada só segue com aprovação do cliente por escrito.':'Necessidades, entregas e conferência de recebimento.')+'</p></div><button class="btn primary" data-act="compra-nova" data-oid="'+oid+'" data-write>+ Necessidade de compra</button></div>'+info
    +(cs.length?comprasVistaBarra(o,cs)+(lista||'<div class="board">'+cols+'</div>'):'<div class="card empty"><h3>Nenhuma necessidade de compra</h3><p>Registre o que a obra vai precisar, com a data de uso e o prazo de entrega. O app calcula até quando é preciso pedir.</p></div>');
}
function compraForm(oid,c){
  var novo=!c, o=G('obras',oid), adm=modAdm(o);
  var f=[{name:'item',label:'Item',required:true,value:c&&c.item,ph:'Ex.: Concreto usinado fck 30'},
    [{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('—'),value:c&&c.etapa?String(c.etapa):''},{name:'un',label:'Unidade',type:'select',options:UNIDADES.map(function(u){return [u,u];}),value:(c&&c.un)||'un'}],
    [{name:'qtd',label:'Quantidade',type:'number',min:0,step:'any',required:true,value:c&&c.qtd},{name:'dataUso',label:'Data de uso na obra',type:'date',required:true,value:c&&c.dataUso}],
    {name:'prioridade',label:'Prioridade',type:'select',options:[['baixa','Baixa'],['media','Média'],['alta','Alta']],value:(c&&c.prioridade)||'media'},
    [{name:'prazoEntrega',label:'Prazo de entrega (dias)',type:'number',min:0,step:1,value:c&&c.prazoEntrega!=null?c.prazoEntrega:'',hint:'Pedir até = data de uso menos este prazo.'},{name:'critico',label:'Item crítico?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:c&&c.critico?'sim':'nao'}],
    [{name:'sobMedida',label:'Sob medida (esquadria, marcenaria, pedra)?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:c&&c.sobMedida?'sim':'nao'},{name:'concretagem',label:'É concreto para concretagem?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:c&&c.concretagem?'sim':'nao'}]];
  if(adm) f.push([{name:'foraEscopo',label:'Está fora do escopo contratado?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:c&&c.foraEscopo?'sim':'nao',hint:'Fora do escopo só é pedido com aditivo assinado ou autorização de emergência.'},{name:'motivoFora',label:'Se fora do escopo, por quê?',type:'select',options:selOpts(TIPOS_OC.map(function(t){ return [t.k,t.n]; }),'Selecione…'),value:(c&&c.motivoFora)||''}]);
  if(adm) f.push({name:'orcado',label:'Valor orçado (R$, total do item)',type:'number',min:0,step:'0.01',value:c&&c.orcado,hint:'Usado para conferir a margem e a alçada. Depois virá do orçamento importado.'});
  f.push({name:'obs',label:adm?'Especificação e observações':'Especificação a conferir',type:'textarea',rows:2,value:c&&c.obs});
  openForm({title:novo?'Nova necessidade de compra':'Editar necessidade', wide:true, fields:f,
    extra:novo?'':'<button type="button" class="btn danger" data-act="compra-excluir" data-id="'+c.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.item||'').trim()) return 'Informe o item.';
      if(!(v.qtd>0)) return 'Informe a quantidade.';
      if(!v.dataUso) return 'Informe a data de uso.';
      var data=Object.assign({status:'necessidade', cotacoes:[], criadoEm:new Date().toISOString(), por:Store.uid||null}, c||{}, {obraId:oid, codigo:(c&&c.codigo)||proximoCodigoCompra(), prioridade:v.prioridade||'media', item:v.item.trim(), etapa:v.etapa?Number(v.etapa):0, un:v.un, qtd:v.qtd, dataUso:v.dataUso, prazoEntrega:v.prazoEntrega==null?null:v.prazoEntrega, critico:v.critico==='sim', sobMedida:v.sobMedida==='sim', concretagem:v.concretagem==='sim', obs:v.obs||''});
      if(adm) data.orcado=v.orcado==null?null:v.orcado;
      if(adm){ data.foraEscopo=v.foraEscopo==='sim'; data.motivoFora=data.foraEscopo?v.motivoFora:''; if(data.foraEscopo&&!v.motivoFora) return 'Informe por que está fora do escopo.'; }
      await Store.set('compras', c?c.id:nid(), data);
    }});
}
function openCompra(id){
  var c=G('compras',id); if(!c){ closeDlg(); return; }
  var o=G('obras',c.obraId), adm=modAdm(o), lim=limiteCompra(c), esc_=cotEscolhida(c), men=menorCot(c);
  var nv=esc_?nivelCompra(o,esc_.preco,c.orcado):null, rot=rotuloAvancar(o,c), editavel=['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0 && !c.pedido;
  var cotHtml='';
  if(adm){
    var cs=(c.cotacoes||[]).slice().sort(function(a,b){return a.preco-b.preco;});
    cotHtml='<div class="sec-h" style="margin-top:18px"><h3>Cotações</h3>'+(editavel?'<button class="btn sm" data-act="cot-nova" data-id="'+c.id+'" data-write>+ Proposta recebida</button>':'')+'</div>'
      +(cs.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Fornecedor</th><th>Preço total</th><th>Prazo</th><th>Frete</th><th>Condição</th><th></th></tr></thead><tbody>'+cs.map(function(x){
        var best=men&&x.id===men.id, sel=c.escolhida===x.id;
        return '<tr'+(sel?' style="background:var(--steel-soft)"':'')+'><td><strong>'+esc(fornNome(x.fornecedorId)||'Fornecedor removido')+'</strong>'+(best?' <span class="chip ok">Menor preço</span>':'')+(sel?' <span class="chip steel">Escolhida</span>':'')+(x.obs?'<div class="tiny muted">'+esc(x.obs)+'</div>':'')+'</td><td class="num">'+brl(x.preco)+'</td><td>'+(x.prazo!=null&&x.prazo!==''?plural(Number(x.prazo),'dia','dias'):'—')+'</td><td>'+(x.frete?brl(x.frete):'—')+'</td><td>'+esc(x.cond||'—')+'</td><td style="white-space:nowrap">'+(editavel&&!c.aprov?(sel?'':'<button class="btn sm" data-act="cot-escolher" data-id="'+c.id+'" data-cid="'+x.id+'" data-write>Escolher</button> ')+'<button class="btn sm ghost" data-act="cot-excluir" data-id="'+c.id+'" data-cid="'+x.id+'" data-write aria-label="Remover proposta">×</button>':'')+'</td></tr>';
      }).join('')+'</tbody></table></div>'+(esc_&&men&&esc_.id!==men.id?'<p class="small" style="margin-top:8px"><strong>Justificativa para não escolher o menor preço:</strong> '+esc(c.justificativa||'—')+'</p>':''):'<p class="muted small" style="margin-top:6px">Nenhuma proposta ainda. Registre o que cada fornecedor respondeu; o mapa aponta o menor preço.</p>');
  }
  var aprHtml='';
  if(adm && nv){
    aprHtml='<div class="callout'+(c.aprov?' ok':(nv.nivel===3?'':'ok'))+'" style="margin-top:14px"><strong>'+(c.aprov?('Aprovada — nível '+c.aprov.nivel+' em '+fmt(c.aprov.data)+(c.aprov.por==='cliente'?', pelo cliente':', pela Cariati')):('Aprovação necessária: nível '+nv.nivel+(nv.nivel===3?' (cliente, por escrito)':' (Cariati)')))+'</strong>'
      +(nv.motivos.length?'<ul>'+nv.motivos.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul>':'')+(nv.semRef&&!c.aprov?'<p class="small" style="margin-top:6px">Sem valor orçado nem alçada informados: não há referência para conferir. Aprove só se a compra estiver no orçamento.</p>':'')
      +(c.aprov&&c.aprov.ref?'<p class="small" style="margin-top:6px;white-space:pre-wrap">Registro: '+esc(c.aprov.ref)+'</p>':'')+anexosHtml(c.aprov&&c.aprov.anexos)+'</div>';
  }
  var tr=(adm&&c.status==='aprovacao')?travasPedido(o,c):[];
  var trHtml=(adm&&c.status==='aprovacao'&&c.aprov&&tr.length)?'<div class="callout crit" style="margin-top:14px"><strong>Antes de emitir o pedido</strong><ul>'+tr.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul>'+(c.sobMedida&&!c.medidaOk?'<p style="margin-top:8px"><button class="btn sm" data-act="compra-medida" data-id="'+c.id+'" data-write>Confirmar medida conferida em obra</button></p>':'')+'</div>':'';
  var pedHtml=c.pedido?'<div class="callout ok" style="margin-top:14px"><strong>Pedido emitido em '+fmt(c.pedido.data)+'</strong><p class="small">'+esc(fornNome(c.pedido.fornecedorId)||'—')+' · '+brl(c.pedido.total)+' · entrega prevista '+fmt(c.pedido.entregaPrevista)+'</p></div>':'';
  var entHtml=c.entrega?'<div class="callout ok" style="margin-top:14px"><strong>Entrega em '+fmt(c.entrega.data)+'</strong><p class="small">Nota fiscal '+esc(c.entrega.nf||'—')+' · '+esc(String(c.entrega.qtd))+' '+esc(c.un||'')+(c.pedido&&c.pedido.entregaPrevista&&c.entrega.data>c.pedido.entregaPrevista?' · '+plural(diffDays(c.pedido.entregaPrevista,c.entrega.data),'dia','dias')+' de atraso':'')+'</p></div>':'';
  var cfHtml=c.conf?'<div class="callout ok" style="margin-top:14px"><strong>Conferido em '+fmt(c.conf.data)+' por '+esc(Names.get(c.conf.por))+'</strong><p class="small">'+esc(c.conf.criterio||'')+'</p>'+(c.conf.obs?'<p class="small">'+esc(c.conf.obs)+'</p>':'')+thumbs(c.conf.fotos)+'</div>':'';
  var hist=(c.hist||[]).slice().reverse().map(function(h){ return '<li>'+fmt(h.data)+': '+esc(COMPRA_ST[h.de]||'—')+' → <strong>'+esc(COMPRA_ST[h.para]||h.para)+'</strong> por '+esc(Names.get(h.por))+(h.nota?' — '+esc(h.nota):'')+'</li>'; }).join('');
  openDlg('<div class="dlg-h"><h2>'+esc(c.item)+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b">'
    +'<div class="row" style="margin-bottom:10px"><span class="chip steel">'+esc(COMPRA_ST[c.status])+'</span>'+(c.critico?'<span class="chip warn">Crítico</span>':'')+(c.etapa?'<span class="chip">Etapa '+c.etapa+'</span>':'')+(c.sobMedida?'<span class="chip">Sob medida</span>':'')+(c.concretagem?'<span class="chip">Concretagem</span>':'')+'</div>'
    +'<dl class="small" style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0"><dt class="muted">Quantidade</dt><dd style="margin:0">'+esc(String(c.qtd).replace('.',','))+' '+esc(c.un||'')+'</dd><dt class="muted">Uso na obra</dt><dd style="margin:0">'+fmt(c.dataUso)+'</dd><dt class="muted">Pedir até</dt><dd style="margin:0">'+(lim?fmt(lim)+(compraAtrasadaPedido(c)?' — <strong style="color:var(--crit)">atrasado</strong>':''):'—')+'</dd>'+(adm?'<dt class="muted">Orçado</dt><dd style="margin:0">'+brl(c.orcado)+'</dd>':'')+(c.obs?'<dt class="muted">Especificação</dt><dd style="margin:0;white-space:pre-wrap">'+esc(c.obs)+'</dd>':'')+'</dl>'
    +foraEscopoHtml(c,'compras')+cotHtml+aprHtml+trHtml+pedHtml+entHtml+cfHtml
    +(hist?'<h3 style="margin-top:18px">Histórico</h3><ul class="small" style="padding-left:18px">'+hist+'</ul>':'')
    +'</div><div class="dlg-f"><button class="btn danger" data-act="compra-excluir" data-id="'+c.id+'" data-write style="margin-right:auto">Excluir</button><button class="btn" data-act="compra-editar" data-id="'+c.id+'" data-write>Editar</button>'+(rot?'<button class="btn primary" data-act="compra-avancar" data-id="'+c.id+'" data-vol="1" data-write>'+rot+'</button>':'')+'</div>', true);
}
function cotacaoForm(id){
  var c=G('compras',id);
  if(!L('fornecedores').length){ blockDlg('Cadastre fornecedores primeiro',['Abra “Fornecedores” no menu e cadastre quem vai enviar propostas.'],'Sem fornecedores'); return; }
  openForm({title:'Proposta recebida', intro:esc(c.item)+' — '+esc(String(c.qtd))+' '+esc(c.un||''),
    fields:[{name:'fornecedorId',label:'Fornecedor',type:'select',required:true,options:fornOptions('Selecione…')},
      [{name:'preco',label:'Preço total (R$)',type:'number',min:0,step:'0.01',required:true},{name:'prazo',label:'Prazo de entrega (dias)',type:'number',min:0,step:1}],
      [{name:'frete',label:'Frete (R$, se cobrado à parte)',type:'number',min:0,step:'0.01'},{name:'cond',label:'Condição de pagamento',ph:'Ex.: 28 dias'}],
      {name:'obs',label:'Observações',type:'textarea',rows:2}],
    onSubmit:async function(v){
      if(!v.fornecedorId) return 'Escolha o fornecedor.';
      if(!(v.preco>0)) return 'Informe o preço total.';
      var cs=(c.cotacoes||[]).concat([{id:nid(), fornecedorId:v.fornecedorId, preco:v.preco, prazo:v.prazo, frete:v.frete, cond:v.cond||'', obs:v.obs||''}]);
      await setCompra(c, {cotacoes:cs, status:c.status==='necessidade'?'cotacao':c.status}, c.status==='necessidade'?'Primeira proposta registrada':'');
      openCompra(id); return false;
    }});
}
function escolherCotacao(id,cid){
  var c=G('compras',id), men=menorCot(c), x=(c.cotacoes||[]).filter(function(y){return y.id===cid;})[0];
  var fim=function(just){ return setCompra(c,{escolhida:cid, justificativa:just||'', aprov:null}).then(function(){ openCompra(id); }); };
  if(men && x.id!==men.id){
    openForm({title:'Não é o menor preço', intro:'A proposta escolhida ('+brl(x.preco)+') é maior que a menor ('+brl(men.preco)+'). Registre por quê.',
      fields:[{name:'j',label:'Justificativa',type:'textarea',required:true,rows:3,ph:'Ex.: prazo de entrega compatível com a concretagem'}], submit:'Escolher mesmo assim',
      onSubmit:async function(v){ if(!(v.j||'').trim()) return 'Escreva a justificativa.'; await fim(v.j.trim()); return false; }});
  } else fim('');
}
async function compraAvancar(id,vol){
  var c=G('compras',id); if(!c) return; var o=G('obras',c.obraId), adm=modAdm(o);
  if(c.status==='necessidade'){
    if(adm){ await setCompra(c,{status:'cotacao'},'Cotação iniciada'); return depoisCompra(id,vol); }
    return entregaCompraForm(id,vol);
  }
  if(c.status==='cotacao'){
    if(!(c.cotacoes||[]).length){ blockDlg('Falta cotação',['Registre ao menos uma proposta recebida.'],'Não dá para enviar para aprovação'); return; }
    if(!c.escolhida){ blockDlg('Falta escolher a proposta',['Escolha uma das propostas no mapa de cotações.'],'Não dá para enviar para aprovação'); return; }
    await setCompra(c,{status:'aprovacao'},'Enviada para aprovação'); return depoisCompra(id,vol);
  }
  if(c.status==='aprovacao'){
    if(!c.aprov) return aprovarCompra(id,vol);
    var tr=travasPedido(o,c); if(tr.length){ blockDlg('Não é possível emitir o pedido',tr,'Antes de emitir o pedido:'); return; }
    return pedidoForm(id,vol);
  }
  if(c.status==='pedido') return entregaCompraForm(id,vol);
  if(c.status==='entregue') return conferenciaForm(id,vol);
  if(c.status==='conferido' && adm) return pagoForm(id,vol);
}
async function aprovarCompra(id,vol){
  var c=G('compras',id), o=G('obras',c.obraId), e=cotEscolhida(c);
  if(!e){ blockDlg('Falta escolher a proposta',['Escolha a proposta antes de aprovar.'],'Não dá para aprovar'); return; }
  var nv=nivelCompra(o,e.preco,c.orcado);
  if(nv.nivel===2){
    var ok=await confirmDlg('Aprovar compra — nível 2','<p>'+esc(c.item)+': '+brl(e.preco)+' com '+esc(fornNome(e.fornecedorId))+'.</p><p class="small muted" style="margin-top:8px">'+(nv.semRef?'Não há valor orçado nem alçada informados para conferir. Aprove só se a compra estiver no orçamento.':'Dentro do orçado e da alçada: a Cariati aprova e o cliente valida na prestação de contas.')+'</p>','Aprovar',false);
    if(!ok) return;
    await setCompra(c,{aprov:{nivel:2, por:'cariati', data:hoje(), uid:Store.uid||null}},'Aprovada (nível 2)'); toast('Compra aprovada.'); return depoisCompra(id,vol);
  }
  openForm({title:'Aprovação do cliente — nível 3', intro:'<strong>Fora do orçado ou acima da alçada:</strong><ul style="margin:6px 0 0;padding-left:18px">'+nv.motivos.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul>O cliente precisa aprovar por escrito antes do pedido.',
    fields:[{name:'data',label:'Data da aprovação',type:'date',required:true,value:hoje()},{name:'ref',label:'Como o cliente aprovou',type:'textarea',required:true,rows:3,ph:'Ex.: e-mail de 12/03 às 14h, resposta de WhatsApp anexada.'},{name:'anexos',label:'Comprovante (print ou PDF)',type:'anexos',value:[]}],
    submit:'Registrar aprovação',
    onSubmit:async function(v){
      if(!(v.ref||'').trim()) return 'Registre como o cliente aprovou por escrito.';
      await setCompra(c,{aprov:{nivel:3, por:'cliente', data:v.data, ref:v.ref.trim(), anexos:v.anexos||[], uid:Store.uid||null}},'Aprovada pelo cliente (nível 3)');
      if(vol){ openCompra(id); return false; }
    }});
}
function pedidoForm(id,vol){
  var c=G('compras',id), e=cotEscolhida(c);
  var prev=c.dataUso&&c.dataUso>=hoje()?c.dataUso:addDays(hoje(), Number((e&&e.prazo)||c.prazoEntrega||7));
  openForm({title:'Emitir pedido', intro:esc(c.item)+' — '+esc(fornNome(e&&e.fornecedorId)),
    fields:[[{name:'data',label:'Data do pedido',type:'date',required:true,value:hoje()},{name:'entregaPrevista',label:'Entrega prevista',type:'date',required:true,value:prev}],
      {name:'total',label:'Valor do pedido (R$)',type:'number',min:0,step:'0.01',required:true,value:e&&e.preco},{name:'obs',label:'Observações do pedido',type:'textarea',rows:2}],
    submit:'Emitir pedido',
    onSubmit:async function(v){
      var tr=travasPedido(G('obras',c.obraId),c); if(tr.length) return tr[0];
      if(!(v.total>0)) return 'Informe o valor do pedido.';
      await setCompra(c,{status:'pedido', pedido:{data:v.data, fornecedorId:e?e.fornecedorId:'', total:v.total, entregaPrevista:v.entregaPrevista, obs:v.obs||''}},'Pedido emitido');
      await contaDaCompra(id);
      toast('Pedido emitido.'); return depoisCompra(id,vol);
    }});
}
function entregaCompraForm(id,vol){
  var c=G('compras',id);
  openForm({title:'Registrar entrega', intro:esc(c.item),
    fields:[[{name:'data',label:'Data da entrega',type:'date',required:true,value:hoje()},{name:'nf',label:'Nota fiscal',ph:'Número'}],{name:'qtd',label:'Quantidade recebida ('+(c.un||'un')+')',type:'number',min:0,step:'any',required:true,value:c.qtd},{name:'obs',label:'Observações',type:'textarea',rows:2}],
    submit:'Registrar entrega',
    onSubmit:async function(v){
      if(!(v.qtd>0)) return 'Informe a quantidade recebida.';
      await setCompra(c,{status:'entregue', entrega:{data:v.data, nf:v.nf||'', qtd:v.qtd, obs:v.obs||''}},'Entrega registrada'); return depoisCompra(id,vol);
    }});
}
function conferenciaForm(id,vol){
  var c=G('compras',id), o=G('obras',c.obraId), adm=modAdm(o);
  openForm({title:'Conferir recebimento (FVM)', intro:esc(c.item)+' — '+esc(String(c.entrega?c.entrega.qtd:c.qtd))+' '+esc(c.un||'')+(c.obs?'<br><strong>Especificação:</strong> '+esc(c.obs):''),
    fields:[{name:'resultado',label:'Resultado',type:'radio',required:true,options:[['conferido','Conferido: especificação, quantidade e estado corretos'],['recusado','Recusado']],value:''},
      {name:'criterio',label:'Critério conferido',type:'textarea',rows:2,value:'Especificação, quantidade e estado conferidos contra o pedido e a nota fiscal.'},
      {name:'obs',label:'Observações',type:'textarea',rows:2,hint:'Obrigatória se recusado.'},{name:'fotos',label:'Fotos do material e da nota',type:'photos',value:[]}],
    submit:'Registrar conferência',
    onSubmit:async function(v){
      if(!v.resultado) return 'Escolha o resultado da conferência.';
      if(v.resultado==='recusado' && !(v.obs||'').trim()) return 'Descreva o motivo da recusa.';
      if(v.resultado==='conferido'){
        await Store.add('movEstoque',{obraId:c.obraId, item:c.item, un:c.un||'un', tipo:'entrada', qtd:c.entrega?c.entrega.qtd:c.qtd, data:hoje(), etapa:c.etapa||0, compraId:c.id, obs:'Entrada por conferência de recebimento'});
        await setCompra(c,{status:'conferido', conf:{data:hoje(), resultado:'conferido', criterio:v.criterio||'', obs:v.obs||'', fotos:v.fotos||[], por:Store.uid||null}},'Recebimento conferido');
        toast('Recebimento conferido e material lançado no estoque.');
      } else {
        await Store.add('ocorrencias',{obraId:c.obraId, etapa:c.etapa||0, tipo:'falha', gravidade:'importante', local:'', descricao:'Material recusado no recebimento: '+c.item+'. '+v.obs.trim(), prestadorId:'', prazo:addDays(hoje(),3), status:'aberta', criadoEm:new Date().toISOString(), por:Store.uid||null, interacoes:[], fotos:v.fotos||[], origem:'recebimento', reabertas:0});
        await setCompra(c,{status:adm?'pedido':'necessidade', entrega:null, conf:null},'Recebimento recusado: '+v.obs.trim());
        toast('Recusa registrada e ocorrência aberta.');
      }
      return depoisCompra(id,vol);
    }});
}
function pagoForm(id,vol){
  var c=G('compras',id);
  if(c.status!=='conferido'){ blockDlg('Não é possível registrar o pagamento',['O recebimento ainda não foi conferido.'],'Pagamento bloqueado'); return; }
  openForm({title:'Marcar como pago', intro:esc(c.item)+' — '+brl(valorCompra(c)),
    fields:[{name:'data',label:'Data do pagamento',type:'date',required:true,value:hoje()}], submit:'Marcar como pago',
    onSubmit:async function(v){ await setCompra(c,{status:'pago', pagoEm:v.data},'Pagamento registrado'); await baixarConta('compra', id, v.data); return depoisCompra(id,vol); }});
}

/* ================= ESTOQUE ================= */
function tEstoque(o){
  var oid=o.id, ss=saldos(oid), movs=byObra('movEstoque',oid).sort(function(a,b){ return (a.data<b.data?1:(a.data>b.data?-1:0)); }).slice(0,30);
  var head='<div class="sec-h"><div><h2>Estoque da obra</h2><p class="muted small">Entrada automática quando o recebimento é conferido. Saídas por frente ligam a compra ao consumo do serviço.</p></div><div class="row"><button class="btn" data-act="mov-novo" data-oid="'+oid+'" data-t="entrada" data-write>+ Entrada manual</button><button class="btn" data-act="mov-novo" data-oid="'+oid+'" data-t="perda" data-write>Registrar perda</button><button class="btn primary" data-act="mov-novo" data-oid="'+oid+'" data-t="saida" data-write>Registrar saída</button></div></div>';
  if(!ss.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Estoque vazio</h3><p>Os materiais entram aqui quando você confere o recebimento de uma compra. Também dá para lançar uma entrada manual.</p></div>';
  var tab='<div class="card tbl-scroll" style="margin-top:14px"><table class="tbl"><thead><tr><th>Item</th><th>Saldo</th><th>Entradas</th><th>Saídas</th><th>Perdas</th></tr></thead><tbody>'+ss.map(function(s){ return '<tr><td><strong>'+esc(s.item)+'</strong></td><td class="num"><span class="chip '+(s.saldo<=0?'warn':'ok')+'">'+String(Math.round(s.saldo*100)/100).replace('.',',')+' '+esc(s.un)+'</span></td><td class="num">'+String(s.entradas).replace('.',',')+'</td><td class="num">'+String(s.saidas).replace('.',',')+'</td><td class="num">'+(s.perdas?'<span class="chip crit">'+String(s.perdas).replace('.',',')+'</span>':'0')+'</td></tr>'; }).join('')+'</tbody></table></div>';
  var hist='<section class="card" style="margin-top:16px"><div class="card-h"><h2>Últimos movimentos</h2></div>'+movs.map(function(m){ return '<div class="ficha" style="grid-template-columns:1fr auto"><div><strong>'+esc(m.item)+'</strong><div class="tiny muted">'+fmt(m.data)+(m.etapa?' · Etapa '+m.etapa:'')+(m.obs?' · '+esc(m.obs):'')+'</div></div><span class="chip '+(m.tipo==='entrada'?'ok':(m.tipo==='perda'?'crit':'steel'))+'">'+(m.tipo==='entrada'?'+':'−')+String(m.qtd).replace('.',',')+' '+esc(m.un)+' · '+({entrada:'Entrada',saida:'Saída',perda:'Perda'})[m.tipo]+'</span></div>'; }).join('')+'</section>';
  return head+tab+hist;
}
function movForm(oid,tipo){
  var ss=saldos(oid).filter(function(s){ return s.saldo>0; }), titulo={entrada:'Entrada manual', saida:'Saída para a obra', perda:'Perda ou quebra'}[tipo];
  var campos=[];
  if(tipo==='entrada') campos=[{name:'item',label:'Item',required:true},[{name:'qtd',label:'Quantidade',type:'number',min:0,step:'any',required:true},{name:'un',label:'Unidade',type:'select',options:UNIDADES.map(function(u){return [u,u];}),value:'un'}]];
  else {
    if(!ss.length){ blockDlg('Sem saldo em estoque',['Confira o recebimento de uma compra ou lance uma entrada manual.'],'Não há o que retirar'); return; }
    campos=[{name:'chave',label:'Item',type:'select',required:true,options:ss.map(function(s){ return [s.k, s.item+' — saldo '+String(Math.round(s.saldo*100)/100).replace('.',',')+' '+s.un]; })},{name:'qtd',label:'Quantidade',type:'number',min:0,step:'any',required:true}];
  }
  campos.push([{name:'data',label:'Data',type:'date',required:true,value:hoje()},{name:'etapa',label:'Frente (etapa)',type:'select',options:etapaOptions('—')}]);
  campos.push({name:'obs',label:tipo==='perda'?'Motivo da perda':'Observações',type:'textarea',rows:2,required:tipo==='perda'});
  openForm({title:titulo, fields:campos,
    onSubmit:async function(v){
      if(!(v.qtd>0)) return 'Informe a quantidade.';
      if(tipo==='perda' && !(v.obs||'').trim()) return 'Descreva o motivo da perda.';
      var item, un;
      if(tipo==='entrada'){ if(!(v.item||'').trim()) return 'Informe o item.'; item=v.item.trim(); un=v.un; }
      else { var s=ss.filter(function(x){return x.k===v.chave;})[0]; if(!s) return 'Escolha o item.'; if(v.qtd>s.saldo) return 'A quantidade é maior que o saldo ('+String(Math.round(s.saldo*100)/100).replace('.',',')+' '+s.un+').'; item=s.item; un=s.un; }
      await Store.add('movEstoque',{obraId:oid, item:item, un:un, tipo:tipo, qtd:v.qtd, data:v.data, etapa:v.etapa?Number(v.etapa):0, obs:(v.obs||'').trim()});
    }});
}

/* ================= LOCAÇÕES ================= */
function tLocacoes(o){
  var oid=o.id, ls=byObra('locacoes',oid), adm=modAdm(o);
  var head='<div class="sec-h"><div><h2>Locação de equipamentos</h2><p class="muted small">'+(adm?'Aprovação pela alçada, checklist de entrada e devolução e apontamento diário de uso.':'Neste contrato o cliente contrata; a Cariati recomenda e acompanha o uso.')+'</p></div><button class="btn primary" data-act="loc-nova-eq" data-oid="'+oid+'" data-write>+ Locação</button></div>';
  if(!ls.length) return head+'<div class="card empty" style="margin-top:14px"><h3>Nenhuma locação</h3><p>Registre andaime, betoneira, retroescavadeira e outros equipamentos, com período e valor diário.</p></div>';
  var grupos=['ativa','prevista','devolvida'];
  return head+grupos.map(function(st){
    var lst=ls.filter(function(l){return l.status===st;}).sort(function(a,b){return a.inicio<b.inicio?-1:1;}); if(!lst.length) return '';
    return '<div class="sec"><h3 style="margin-bottom:8px">'+LOC_ST[st]+'s <span class="muted num">'+lst.length+'</span></h3><div class="grid cols2">'+lst.map(function(l){ return cardLoc(o,l); }).join('')+'</div></div>';
  }).join('');
}
function cardLoc(o,l){
  var ap=locApont(l), oc=ap.n?ap.parado/ap.n:null, tot=locTotalPrev(l), ps=locParadoSeguidos(l), atr=locAtrasada(l);
  var dias=''; for(var i=13;i>=0;i--){ var d=addDays(hoje(),-i), a=(l.apontamentos||{})[d]; dias+='<i title="'+fmtC(d)+(a?': '+(a.u==='parado'?'parado':'em uso'):': sem apontamento')+'" style="display:inline-block;width:14px;height:14px;border-radius:2px;margin-right:3px;background:'+(a?(a.u==='parado'?'var(--amber-bar)':'var(--ok)'):'var(--surface2)')+';border:1px solid var(--line)"></i>'; }
  var acts='';
  if(l.status==='prevista') acts='<button class="btn sm primary" data-act="loc-ativar" data-id="'+l.id+'" data-write>Receber e ativar</button>';
  if(l.status==='ativa') acts='<button class="btn sm" data-act="loc-apont" data-id="'+l.id+'" data-u="usado" data-write>Em uso hoje</button><button class="btn sm" data-act="loc-apont" data-id="'+l.id+'" data-u="parado" data-write>Parado hoje</button><button class="btn sm primary" data-act="loc-devolver" data-id="'+l.id+'" data-write>Devolver</button>';
  var real=l.status==='devolvida'&&l.devolucao?(Number(l.valorDia)||0)*Math.max(1,diffDays(l.inicio,l.devolucao.data)+1):null;
  return '<article class="card pad"><div class="row spread" style="align-items:flex-start"><div class="grow"><h3>'+esc(l.equipamento)+'</h3><p class="small muted">'+esc(fornNome(l.fornecedorId)||'Fornecedor a definir')+(l.etapa?' · Etapa '+l.etapa:'')+'</p></div><span class="chip '+(l.status==='ativa'?'steel':(l.status==='devolvida'?'ok':''))+'">'+LOC_ST[l.status]+'</span></div>'
    +'<p class="small" style="margin-top:8px">'+fmt(l.inicio)+' a '+fmt(l.fimPrevisto)+' ('+plural(locDiasPrev(l),'dia','dias')+') · '+brl(l.valorDia)+'/dia · previsto '+brl(tot)+(real!=null?' · real '+brl(real):'')+'</p>'
    +'<div class="row" style="margin-top:8px;gap:6px">'+(l.operador?'<span class="chip">Operador habilitado</span>':'')+(atr?'<span class="chip crit">Devolução atrasada</span>':'')+(ps>=2?'<span class="chip warn">Parado há '+plural(ps,'dia','dias')+'</span>':'')+(oc!=null?'<span class="chip '+(oc>0.3?'warn':'')+'">Ociosidade '+pct(oc)+'</span>':'')+(l.aprov?'<span class="chip ok">Aprovada ('+(l.aprov.por==='cliente'?'cliente':'Cariati')+')</span>':'')+'</div>'
    +(l.status==='ativa'||l.status==='devolvida'?'<div style="margin-top:10px" aria-label="Últimos 14 dias de uso">'+dias+'</div><p class="tiny muted">Verde: em uso · amarelo: parado · cinza: sem apontamento (últimos 14 dias)</p>':'')
    +(acts?'<div class="row" style="margin-top:12px;gap:6px">'+acts+'</div>':'')
    +'<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="loc-editar-eq" data-id="'+l.id+'" data-write>Editar</button></div></article>';
}
function locForm(oid,l){
  var novo=!l;
  openForm({title:novo?'Nova locação':'Editar locação',
    fields:[{name:'equipamento',label:'Equipamento',required:true,value:l&&l.equipamento,ph:'Ex.: Betoneira 400 L'},
      [{name:'fornecedorId',label:'Fornecedor',type:'select',options:fornOptions('A definir'),value:l&&l.fornecedorId},{name:'etapa',label:'Etapa',type:'select',options:etapaOptions('—'),value:l&&l.etapa?String(l.etapa):''}],
      [{name:'inicio',label:'Início',type:'date',required:true,value:l&&l.inicio},{name:'fimPrevisto',label:'Devolução prevista',type:'date',required:true,value:l&&l.fimPrevisto}],
      [{name:'valorDia',label:'Valor por dia (R$)',type:'number',min:0,step:'0.01',required:true,value:l&&l.valorDia},{name:'operador',label:'Exige operador habilitado?',type:'radio',options:[['sim','Sim'],['nao','Não']],value:l&&l.operador?'sim':'nao'}],
      {name:'orcado',label:'Valor orçado da locação (R$, opcional)',type:'number',min:0,step:'0.01',value:l&&l.orcado}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="loc-excluir-eq" data-id="'+l.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.equipamento||'').trim()) return 'Informe o equipamento.';
      if(!v.inicio||!v.fimPrevisto) return 'Informe o início e a devolução prevista.';
      if(v.fimPrevisto<v.inicio) return 'A devolução não pode ser antes do início.';
      if(!(v.valorDia>=0) || v.valorDia==null) return 'Informe o valor por dia.';
      await Store.set('locacoes', l?l.id:nid(), Object.assign({status:'prevista', apontamentos:{}, criadoEm:new Date().toISOString()}, l||{}, {obraId:oid, equipamento:v.equipamento.trim(), fornecedorId:v.fornecedorId||'', etapa:v.etapa?Number(v.etapa):0, inicio:v.inicio, fimPrevisto:v.fimPrevisto, valorDia:v.valorDia, operador:v.operador==='sim', orcado:v.orcado==null?null:v.orcado}));
    }});
}
function ckFields(itens,prefixo){ return itens.map(function(t,i){ return {name:prefixo+i,label:t,type:'radio',required:true,options:[['sim','Sim'],['nao','Não']],value:''}; }); }
function ativarLocacao(id){
  var l=G('locacoes',id), o=G('obras',l.obraId), adm=modAdm(o), itens=CK_ENTRADA.concat(l.operador?['Operador habilitado presente']:[]);
  var nv=nivelCompra(o,locTotalPrev(l),l.orcado), campos=ckFields(itens,'e_');
  if(adm){ campos.push({name:'por',label:'Aprovação da locação',type:'radio',required:true,options:[['cariati','Cariati (nível 2)'],['cliente','Cliente, por escrito (nível 3)']],value:nv.nivel===3?'cliente':'cariati'}); campos.push({name:'ref',label:'Registro da aprovação do cliente',type:'textarea',rows:2,hint:'Obrigatório quando aprovada pelo cliente.'}); }
  campos.push({name:'obs',label:'Observações',type:'textarea',rows:2,hint:'Obrigatória se algum item do checklist estiver “Não”.'});
  campos.push({name:'fotos',label:'Fotos do equipamento na entrega',type:'photos',value:[]});
  openForm({title:'Receber e ativar: '+l.equipamento, wide:true,
    intro:adm?(nv.nivel===3?'<strong>Requer o cliente (nível 3):</strong> '+nv.motivos.map(esc).join(' '):'Total previsto '+brl(locTotalPrev(l))+(nv.semRef?'. Sem orçado nem alçada informados para conferir.':'. Dentro do orçado e da alçada.')):'', fields:campos, submit:'Ativar locação',
    onSubmit:async function(v){
      var nao=itens.some(function(_,i){ return v['e_'+i]==='nao'; });
      if(nao && !(v.obs||'').trim()) return 'Explique o item do checklist marcado como “Não”.';
      var aprov=null;
      if(adm){
        if(!v.por) return 'Registre quem aprovou a locação.';
        if(nv.nivel===3 && v.por!=='cliente') return 'Locação fora do orçado ou acima da alçada exige aprovação do cliente.';
        if(v.por==='cliente' && !(v.ref||'').trim()) return 'Registre como o cliente aprovou por escrito.';
        aprov={por:v.por, nivel:v.por==='cliente'?3:2, data:hoje(), ref:(v.ref||'').trim()};
      }
      await Store.set('locacoes', id, Object.assign({}, l, {status:'ativa', aprov:aprov, entrada:{data:hoje(), itens:itens.map(function(t,i){return {t:t, ok:v['e_'+i]==='sim'};}), obs:v.obs||'', fotos:v.fotos||[]}}));
      toast('Locação ativada.');
    }});
}
function devolverLocacao(id){
  var l=G('locacoes',id), campos=ckFields(CK_SAIDA,'s_');
  campos.unshift({name:'data',label:'Data da devolução',type:'date',required:true,value:hoje()});
  campos.push({name:'obs',label:'Observações',type:'textarea',rows:2,hint:'Obrigatória se algum item estiver “Não”.'}); campos.push({name:'fotos',label:'Fotos na devolução',type:'photos',value:[]});
  openForm({title:'Devolver: '+l.equipamento, fields:campos, submit:'Registrar devolução',
    onSubmit:async function(v){
      if(!v.data) return 'Informe a data.';
      var nao=CK_SAIDA.some(function(_,i){ return v['s_'+i]==='nao'; });
      if(nao && !(v.obs||'').trim()) return 'Explique o item marcado como “Não”.';
      await Store.set('locacoes', id, Object.assign({}, l, {status:'devolvida', devolucao:{data:v.data, itens:CK_SAIDA.map(function(t,i){return {t:t, ok:v['s_'+i]==='sim'};}), obs:v.obs||'', fotos:v.fotos||[]}}));
      await contaDaLocacao(id);
      toast('Devolução registrada.');
    }});
}

/* ================= CONTRATOS, FRENTES E DANOS ================= */
function tContratos(o){
  var oid=o.id, cs=byObra('contratosPrest',oid).sort(function(a,b){ return (prestNome(a.prestadorId)||'').localeCompare(prestNome(b.prestadorId)||''); });
  var ts=byObra('termos',oid).sort(function(a,b){ return a.data<b.data?1:-1; }), ds=byObra('danos',oid).sort(function(a,b){ return a.status==='aberta'?-1:1; });
  var cHtml=cs.length?'<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Prestador</th><th>Escopo</th><th>Valor</th><th>Período</th><th>Retenção</th><th></th></tr></thead><tbody>'+cs.map(function(c){
    return '<tr><td><strong>'+esc(prestNome(c.prestadorId)||'Prestador removido')+'</strong>'+(c.status==='encerrado'?' <span class="chip">Encerrado</span>':'')+'</td><td>'+esc(short(c.escopo,70))+(c.criterio?'<div class="tiny muted">Medição: '+esc(short(c.criterio,60))+'</div>':'')+anexosHtml(c.anexos)+'</td><td class="num">'+brl(c.valor)+'</td><td>'+fmtC(c.inicio)+' a '+fmtC(c.fim)+'</td><td>'+(c.retencao!=null&&c.retencao!==''?c.retencao+'%':'—')+'</td><td><button class="btn sm" data-act="ct-editar" data-id="'+c.id+'" data-write>Editar</button></td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted" style="padding:16px">Nenhum contrato de prestador. Registre escopo, valor, critério de medição e retenção.</p>';
  var tHtml=ts.length?ts.map(function(t){
    return '<article class="entry"><div class="row spread"><div class="row"><strong>'+esc(t.frente)+'</strong><span class="chip">'+fmt(t.data)+'</span><span class="chip '+(t.estado==='limpa'?'ok':'warn')+'">'+(t.estado==='limpa'?'Limpa e sem dano':'Com pendências')+'</span></div><button class="btn sm ghost" data-act="termo-editar" data-id="'+t.id+'" data-write>Editar</button></div><p class="small muted" style="margin-top:4px">Sai: '+esc(prestNome(t.saiId)||'—')+' · Entra: '+esc(prestNome(t.entraId)||'—')+'</p>'+(t.pendencias?'<p class="small" style="margin-top:6px;white-space:pre-wrap">'+esc(t.pendencias)+'</p>':'')+thumbs(t.fotos)+'</article>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhum termo de frente. Registre a entrega de cada frente de serviço com fotos do estado em que ela foi recebida.</p>';
  var dHtml=ds.length?ds.map(function(d){
    return '<article class="entry"><div class="row spread"><div class="row"><span class="chip '+(d.status==='aberta'?'crit':'ok')+'">'+({aberta:'Aberto',reparada:'Reparado',rateada:'Rateado'})[d.status]+'</span><strong>'+brl(d.custo)+'</strong><span class="chip">'+esc(d.local||'—')+'</span></div><button class="btn sm ghost" data-act="dano-editar" data-id="'+d.id+'" data-write>Editar</button></div><p style="margin-top:6px;white-space:pre-wrap">'+esc(d.descricao)+'</p><p class="tiny muted">Causador: '+esc(prestNome(d.causadorId)||'A apurar')+(d.prazo?' · prazo '+fmtC(d.prazo):'')+(d.rateio?' · '+esc(d.rateio):'')+'</p>'+thumbs(d.fotos)+'</article>';
  }).join(''):'<p class="muted" style="padding:16px">Nenhum dano registrado.</p>';
  return '<div class="stack"><section class="card"><div class="card-h"><div><h2>Contratos de prestadores</h2><p class="muted small">A medição e o desconto de dano virão da fase de custo.</p></div><button class="btn primary sm" data-act="ct-novo" data-oid="'+oid+'" data-write>+ Contrato</button></div>'+cHtml+'</section>'
    +'<div class="grid cols2"><section class="card"><div class="card-h"><div><h2>Termos de frente</h2></div><button class="btn primary sm" data-act="termo-novo" data-oid="'+oid+'" data-write>+ Termo</button></div>'+tHtml+'</section>'
    +'<section class="card"><div class="card-h"><div><h2>Danos e quebras</h2></div><button class="btn primary sm" data-act="dano-novo" data-oid="'+oid+'" data-write>+ Dano</button></div>'+dHtml+'</section></div></div>';
}
function contratoForm(oid,c){
  var novo=!c, avisou=false;
  openForm({title:novo?'Novo contrato de prestador':'Editar contrato', wide:true,
    fields:[{name:'prestadorId',label:'Prestador',type:'select',required:true,options:prestOptions('Selecione…'),value:c&&c.prestadorId},
      {name:'escopo',label:'Escopo',type:'textarea',required:true,rows:3,value:c&&c.escopo},
      [{name:'valor',label:'Valor do contrato (R$)',type:'number',min:0,step:'0.01',required:true,value:c&&c.valor},{name:'retencao',label:'Retenção (%)',type:'number',min:0,max:100,step:'0.1',value:c&&c.retencao}],
      [{name:'inicio',label:'Início',type:'date',required:true,value:c&&c.inicio},{name:'fim',label:'Fim',type:'date',required:true,value:c&&c.fim}],
      {name:'criterio',label:'Critério de medição',type:'textarea',rows:2,value:c&&c.criterio,ph:'Ex.: por m² de alvenaria executada e aprovada em ficha'},
      {name:'regraDano',label:'Regra de dano',type:'textarea',rows:2,value:c&&c.regraDano,ph:'Ex.: reparo por conta do causador, descontado da medição'},
      {name:'status',label:'Situação',type:'radio',options:[['ativo','Ativo'],['encerrado','Encerrado']],value:(c&&c.status)||'ativo'},
      {name:'anexos',label:'Contrato assinado (foto ou PDF)',type:'anexos',value:(c&&c.anexos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="ct-excluir" data-id="'+c.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!v.prestadorId) return 'Escolha o prestador.';
      if(!(v.escopo||'').trim()) return 'Descreva o escopo.';
      if(!(v.valor>=0)||v.valor==null) return 'Informe o valor.';
      if(!v.inicio||!v.fim) return 'Informe o início e o fim.';
      if(v.fim<v.inicio) return 'O fim não pode ser antes do início.';
      if(novo&&!avisou){ var mn=prestNotaMedia(v.prestadorId); if(mn!=null&&mn<6){ avisou=true; return 'Aviso: '+prestNome(v.prestadorId)+' tem nota média '+String(mn).replace('.',',')+' (abaixo de 6) nas avaliações anteriores. Salve de novo para contratar mesmo assim.'; } }
      await Store.set('contratosPrest', c?c.id:nid(), Object.assign({}, c||{}, {obraId:oid, prestadorId:v.prestadorId, escopo:v.escopo.trim(), valor:v.valor, retencao:v.retencao, inicio:v.inicio, fim:v.fim, criterio:v.criterio||'', regraDano:v.regraDano||'', status:v.status||'ativo', encerradoEm:(v.status==='encerrado')?((c&&c.encerradoEm)||hoje()):'', anexos:v.anexos||[]}));
      if(v.status==='encerrado'&&!(c&&c.status==='encerrado')) toast('Contrato encerrado. Abra a avaliação do prestador na aba Avaliações.');
    }});
}
function termoForm(oid,t){
  var novo=!t;
  openForm({title:novo?'Termo de entrega e recebimento de frente':'Editar termo', wide:true,
    fields:[{name:'frente',label:'Frente de serviço',required:true,value:t&&t.frente,ph:'Ex.: Reboco externo, fachada norte'},
      [{name:'saiId',label:'Prestador que sai',type:'select',options:prestOptions('—'),value:t&&t.saiId},{name:'entraId',label:'Prestador que entra',type:'select',options:prestOptions('—'),value:t&&t.entraId}],
      {name:'data',label:'Data',type:'date',required:true,value:t?t.data:hoje()},
      {name:'estado',label:'Estado em que a frente foi entregue',type:'radio',required:true,options:[['limpa','Limpa e sem dano'],['pendencias','Com pendências']],value:t&&t.estado},
      {name:'pendencias',label:'Pendências',type:'textarea',rows:3,value:t&&t.pendencias,hint:'Obrigatório se houver pendências.'},
      {name:'fotos',label:'Fotos do estado da frente',type:'photos',value:(t&&t.fotos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="termo-excluir" data-id="'+t.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.frente||'').trim()) return 'Informe a frente.';
      if(!v.estado) return 'Diga em que estado a frente foi entregue.';
      if(v.estado==='pendencias' && !(v.pendencias||'').trim()) return 'Descreva as pendências.';
      await Store.set('termos', t?t.id:nid(), Object.assign({}, t||{}, {obraId:oid, frente:v.frente.trim(), saiId:v.saiId||'', entraId:v.entraId||'', data:v.data, estado:v.estado, pendencias:v.pendencias||'', fotos:v.fotos||[]}));
    }});
}
function danoForm(oid,d){
  var novo=!d;
  openForm({title:novo?'Registrar dano':'Editar dano', wide:true,
    fields:[{name:'descricao',label:'O que foi danificado',type:'textarea',required:true,rows:2,value:d&&d.descricao},
      [{name:'local',label:'Local',value:d&&d.local},{name:'causadorId',label:'Causador',type:'select',options:prestOptions('A apurar'),value:d&&d.causadorId}],
      [{name:'custo',label:'Custo do reparo (R$)',type:'number',min:0,step:'0.01',required:true,value:d&&d.custo},{name:'prazo',label:'Prazo do reparo',type:'date',value:d&&d.prazo}],
      {name:'status',label:'Situação',type:'radio',options:[['aberta','Aberto'],['reparada','Reparado'],['rateada','Rateado']],value:(d&&d.status)||'aberta'},
      {name:'rateio',label:'Rateio ou acordo',type:'textarea',rows:2,value:d&&d.rateio},
      {name:'fotos',label:'Fotos',type:'photos',value:(d&&d.fotos)||[]}],
    extra:novo?'':'<button type="button" class="btn danger" data-act="dano-excluir" data-id="'+d.id+'" style="margin-right:auto">Excluir</button>',
    onSubmit:async function(v){
      if(!(v.descricao||'').trim()) return 'Descreva o dano.';
      if(!(v.custo>=0)||v.custo==null) return 'Informe o custo do reparo.';
      await Store.set('danos', d?d.id:nid(), Object.assign({}, d||{}, {obraId:oid, descricao:v.descricao.trim(), local:v.local||'', causadorId:v.causadorId||'', custo:v.custo, prazo:v.prazo||'', status:v.status||'aberta', rateio:v.rateio||'', fotos:v.fotos||[]}));
    }});
}

/* ================= AGENDA, ALERTAS E INDICADORES ================= */
function eventosP3(o,add,b){
  byObra('compras',o.id).forEach(function(c){
    var lim=limiteCompra(c);
    if(lim && ['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0) add(lim,'Pedir até hoje: '+c.item,'suprimentos',b+'compras');
    if(c.status==='pedido' && c.pedido && c.pedido.entregaPrevista) add(c.pedido.entregaPrevista,'Entrega prevista: '+c.item,'suprimentos',b+'compras');
  });
  byObra('locacoes',o.id).forEach(function(l){
    if(l.status==='prevista') add(l.inicio,'Chega o equipamento: '+l.equipamento,'suprimentos',b+'locacoes');
    if(l.status!=='devolvida') add(l.fimPrevisto,'Devolver: '+l.equipamento,'suprimentos',b+'locacoes');
  });
  byObra('contratosPrest',o.id).filter(function(c){return c.status!=='encerrado';}).forEach(function(c){ add(c.fim,'Fim do contrato: '+(prestNome(c.prestadorId)||'prestador'),'prestadores',b+'contratos'); });
  byObra('danos',o.id).filter(function(d){return d.status==='aberta';}).forEach(function(d){ add(d.prazo,'Reparo de dano: '+short(d.descricao,40),'prestadores',b+'contratos'); });
  eventosP4(o,add,b);
  eventosP5(o,add,b); eventosP7(o,add,b);
}
function alertasP3(o){
  var A=[], oid=o.id, base='#/obra/'+oid+'/', hj=hoje();
  var crit=byObra('compras',oid).filter(function(c){ return c.critico && ['necessidade','cotacao','aprovacao'].indexOf(c.status)>=0 && limiteCompra(c) && limiteCompra(c)<=addDays(hj,7); });
  if(crit.length){
    var venc=crit.filter(function(c){return limiteCompra(c)<hj;});
    A.push({k:venc.length?'crit':'warn', t:plural(crit.length,'item crítico chegando','itens críticos chegando')+' à data-limite de pedido sem pedido feito'+(venc.length?' ('+venc.length+' já passou)':'')+': '+crit.slice(0,2).map(function(c){return c.item;}).join(', ')+(crit.length>2?'…':'')+'.', to:base+'compras'});
  }
  var atr=byObra('compras',oid).filter(pedidoAtrasado);
  if(atr.length) A.push({k:'warn', t:plural(atr.length,'pedido com entrega atrasada','pedidos com entrega atrasada')+'. Cobrar o fornecedor.', to:base+'compras'});
  var cli=byObra('compras',oid).filter(function(c){ var nv=c.status==='aprovacao'&&!c.aprov?nivelDaCompra(o,c):null; return nv&&nv.nivel===3; });
  if(cli.length) A.push({k:'warn', t:plural(cli.length,'compra aguardando aprovação do cliente','compras aguardando aprovação do cliente')+' (fora do orçado ou acima da alçada).', to:base+'compras'});
  var lp=byObra('locacoes',oid).filter(function(l){ return l.status==='ativa' && locParadoSeguidos(l)>=2; });
  if(lp.length) A.push({k:'warn', t:'Equipamento parado há mais de um dia: '+lp.map(function(l){return l.equipamento;}).join(', ')+'. Levar para a pauta da reunião semanal.', to:base+'locacoes'});
  var la=byObra('locacoes',oid).filter(locAtrasada);
  if(la.length) A.push({k:'warn', t:plural(la.length,'locação com devolução atrasada','locações com devolução atrasada')+': cada dia extra é cobrado.', to:base+'locacoes'});
  var dn=byObra('danos',oid).filter(function(d){return d.status==='aberta';});
  if(dn.length) A.push({k:'warn', t:plural(dn.length,'dano em aberto','danos em aberto')+', somando '+brl(dn.reduce(function(s,d){return s+(Number(d.custo)||0);},0))+'.', to:base+'contratos'});
  return A.concat(alertasP4(o)).concat(alertasP5(o)).concat(alertasP7(o)).concat(alertasG(o));
}
function indRowsP3(o){
  var oid=o.id, out='', cs=byObra('compras',oid), ls=byObra('locacoes',oid), ts=byObra('termos',oid), ds=byObra('danos',oid);
  var ent=cs.filter(function(c){ return c.entrega && c.pedido && c.pedido.entregaPrevista; });
  if(ent.length){ var no=ent.filter(function(c){return c.entrega.data<=c.pedido.entregaPrevista;}).length; out+=indRow('Compras no prazo','Pedidos entregues na data ÷ pedidos entregues', pct(no/ent.length), no+' de '+ent.length+' pedidos', no/ent.length>=0.9?'ok':'warn'); }
  var dv=cs.filter(function(c){ return c.pedido && c.orcado>0; });
  if(dv.length){ var sp=dv.reduce(function(s,c){return s+c.pedido.total;},0), so=dv.reduce(function(s,c){return s+c.orcado;},0), r=sp/so; out+=indRow('Desvio de compra','Preço pago ÷ preço orçado', Math.round(r*100)+'%', brl(sp)+' pedidos contra '+brl(so)+' orçados', r<=1?'ok':(r<=1+(o.margemPreco==null?5:o.margemPreco)/100?'warn':'crit')); }
  var ap=ls.reduce(function(a,l){ var x=locApont(l); return {n:a.n+x.n, p:a.p+x.parado}; },{n:0,p:0});
  if(ap.n) out+=indRow('Ociosidade de equipamento','Dias parado ÷ dias apontados', pct(ap.p/ap.n), ap.p+' de '+ap.n+' dias apontados', ap.p/ap.n>0.3?'warn':'ok');
  var dev=ls.filter(function(l){return l.status==='devolvida'&&l.devolucao;});
  if(dev.length){ var real=dev.reduce(function(s,l){return s+(Number(l.valorDia)||0)*Math.max(1,diffDays(l.inicio,l.devolucao.data)+1);},0), prev=dev.reduce(function(s,l){return s+locTotalPrev(l);},0); if(prev>0) out+=indRow('Custo de locação','Locação real ÷ locação prevista', Math.round(real/prev*100)+'%', brl(real)+' contra '+brl(prev)+' previstos', real<=prev?'ok':'warn'); }
  if(ts.length){ var lp=ts.filter(function(t){return t.estado==='limpa';}).length; out+=indRow('Frentes entregues limpas e sem dano','Termos sem pendência ÷ termos de frente', pct(lp/ts.length), lp+' de '+ts.length+' termos', lp/ts.length>=0.9?'ok':'warn'); }
  if(ds.length){ var tot=ds.reduce(function(s,d){return s+(Number(d.custo)||0);},0), ab=ds.filter(function(d){return d.status==='aberta';}).length; out+=indRow('Danos e quebras','Número e valor', String(ds.length), brl(tot)+' no total · '+ab+' em aberto', ab?'warn':'ok'); }
  return out+indRowsP4(o)+indRowsP5(o)+indRowsP7(o);
}

var A3={
  'forn-novo':function(){ fornForm(); },
  'forn-editar':function(d){ fornForm(G('fornecedores',d.id)); },
  'forn-excluir':async function(d){ var f=G('fornecedores',d.id); var ok=await confirmDlg('Excluir fornecedor?','<p>“'+esc(f.nome)+'” será removido. Propostas e pedidos que o citam ficam sem nome.</p>','Excluir',true); if(ok) Store.del('fornecedores',d.id); },
  'compra-nova':function(d){ compraForm(d.oid); },
  'compra-abrir':function(d){ openCompra(d.id); },
  'compra-editar':function(d){ var c=G('compras',d.id); compraForm(c.obraId,c); },
  'compra-excluir':async function(d){ var ok=await confirmDlg('Excluir necessidade de compra?','<p>Cotações, aprovação e pedido serão apagados.</p>','Excluir',true); if(ok){ await Store.del('compras',d.id); closeDlg(); } },
  'compra-avancar':function(d){ compraAvancar(d.id, d.vol==='1'); },
  'compra-medida':async function(d){ var c=G('compras',d.id); await setCompra(c,{medidaOk:true},'Medida do vão conferida em obra'); openCompra(d.id); },
  'cot-nova':function(d){ cotacaoForm(d.id); },
  'cot-escolher':function(d){ escolherCotacao(d.id,d.cid); },
  'cot-excluir':async function(d){ var c=G('compras',d.id); var cs=(c.cotacoes||[]).filter(function(x){return x.id!==d.cid;}); await setCompra(c,{cotacoes:cs, escolhida:c.escolhida===d.cid?'':c.escolhida, justificativa:c.escolhida===d.cid?'':c.justificativa, aprov:c.escolhida===d.cid?null:c.aprov}); openCompra(d.id); },
  'mov-novo':function(d){ movForm(d.oid,d.t); },
  'loc-nova-eq':function(d){ locForm(d.oid); },
  'loc-editar-eq':function(d){ var l=G('locacoes',d.id); locForm(l.obraId,l); },
  'loc-excluir-eq':async function(d){ var ok=await confirmDlg('Excluir locação?','<p>Checklists e apontamentos serão apagados.</p>','Excluir',true); if(ok){ await Store.del('locacoes',d.id); closeDlg(); } },
  'loc-ativar':function(d){ ativarLocacao(d.id); },
  'loc-devolver':function(d){ devolverLocacao(d.id); },
  'loc-apont':function(d){ var l=G('locacoes',d.id); var ap=Object.assign({}, l.apontamentos||{}); ap[hoje()]={u:d.u}; Store.set('locacoes', d.id, Object.assign({}, l, {apontamentos:ap})); toast('Hoje: '+(d.u==='parado'?'equipamento parado.':'equipamento em uso.')); },
  'ct-novo':function(d){ contratoForm(d.oid); },
  'ct-editar':function(d){ var c=G('contratosPrest',d.id); contratoForm(c.obraId,c); },
  'ct-excluir':async function(d){ var ok=await confirmDlg('Excluir contrato?','<p>O registro e o anexo serão removidos.</p>','Excluir',true); if(ok){ await Store.del('contratosPrest',d.id); closeDlg(); } },
  'termo-novo':function(d){ termoForm(d.oid); },
  'termo-editar':function(d){ var t=G('termos',d.id); termoForm(t.obraId,t); },
  'termo-excluir':async function(d){ var ok=await confirmDlg('Excluir termo de frente?','<p>O registro e as fotos serão removidos.</p>','Excluir',true); if(ok){ await Store.del('termos',d.id); closeDlg(); } },
  'dano-novo':function(d){ danoForm(d.oid); },
  'dano-editar':function(d){ var x=G('danos',d.id); danoForm(x.obraId,x); },
  'dano-excluir':async function(d){ var ok=await confirmDlg('Excluir registro de dano?','<p>O registro e as fotos serão removidos.</p>','Excluir',true); if(ok){ await Store.del('danos',d.id); closeDlg(); } }
};

