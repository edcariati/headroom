/* ================= FASE 7C — MODO OFFLINE PARA OBRA SEM SINAL =================
   Princípios (docs/offline/desenho.md):
   - leitura offline do que já foi carregado; escrita offline só na lista permitida, em fila;
   - nada vale como "salvo" antes de o servidor confirmar: offline o texto é "guardado no aparelho";
   - transições sensíveis (liberar, aprovar, pagar, emitir, encerrar, tudo em R$) só online;
   - um banco por usuário no aparelho; apagado ao sair. Sem sincronização em segundo plano (iPhone não tem). */
var OFF_VALIDADE_DIAS=14;                                   // provisório: cache sem sincronizar vale 14 dias
var OFF_SET_OK=['diarios','fichas','pacotes','movEstoque'];  // coleções que aceitam criar/editar offline
var OFF_PATCH={compras:['status','entrega','conf','hist'], locacoes:['status','apontamentos','entrada','devolucao']};
var OFF_ST={compras:['entregue','conferido','pedido','necessidade'], locacoes:['ativa','devolvida']};
var OFF_CACHE_DIAS_MS=OFF_VALIDADE_DIAS*86400000;
var OFF_ACOES_ONLINE=/^(adt-|orc-importar|ref-importar|med-|conta-|cot-|aporte-|lanc-|despesa-|cc-|emp-|rel-(emitir|enviar|retificar|criar|valid|excluir|fotos|texto)|p0-(ajuste|mapa|mapa-padrao|ref)|obra-(encerrar|reabrir|excluir|nova|editar)|etapa-mover|enc-justificar|licao-|av-|sug-|base-congelar|cham-|gar-|pos-|vis-fazer|pesq-|compra-(editar|excluir|nova|medida)|cot-|loc-(excluir|excluir-eq|nova-eq|editar-eq|novas)|ct-|dano-|forn-|prest-|mat-|rfi-|ata-|acao-(ok|nova|editar|excluir)|trein-|doc-|docmes|termo-|serv-|ativ-|ev-|pac-(editar|excluir|novo|levar)|oc-(mover|excluir)|dia-excluir|nuvem-(desconectar|enviar-local)|hist-restaurar)/;
var OFF_ROTULO={etapa:'liberar ou mover etapa', adt:'aditivos', med:'medição', conta:'contas a pagar', cot:'cotações e compras', aporte:'aportes', lanc:'lançamentos do DRE', despesa:'despesas do DRE', rel:'relatório ao cliente', obra:'cadastro e encerramento da obra', cham:'chamados de garantia', gar:'garantias', pos:'pós-obra', orc:'orçamento', av:'avaliações', p0:'ajuste do P0'};

var Off={
  db:null, uid:null, fila:[], fotos:{}, urls:{}, ultimaSync:null, sincronizando:false, offlineBoot:false, vSW:null, swNova:null, tSujo:null, erroBanco:'',
  /* ---------- rede ---------- */
  semRede:function(){ return (typeof navigator!=='undefined' && navigator.onLine===false) || this.offlineBoot; },
  ativo:function(){ return Store.backend==='supabase' && Supa.v2() && !!this.db; },
  redeFalhou:function(e){ var m=((e&&e.message)||'')+' '+((e&&e.code)||''); return /failed to fetch|networkerror|network request failed|load failed|fetch failed|sem internet|offline/i.test(m) || (e && e.name==='TypeError'); },
  /* ---------- IndexedDB ---------- */
  nomeBanco:function(uid){ return 'cob-'+uid; },
  req:function(r){ return new Promise(function(ok,ko){ r.onsuccess=function(){ ok(r.result); }; r.onerror=function(){ ko(r.error||new Error('indexeddb')); }; }); },
  abrir:function(uid){
    var self=this;
    return new Promise(function(ok,ko){
      var idb=window.indexedDB; if(!idb){ ko(new Error('Este navegador não guarda dados offline.')); return; }
      var r=idb.open(self.nomeBanco(uid),1);
      r.onupgradeneeded=function(){ var d=r.result; d.createObjectStore('cache',{keyPath:'col'}); d.createObjectStore('fila',{keyPath:'opId'}); d.createObjectStore('fotos',{keyPath:'id'}); d.createObjectStore('meta',{keyPath:'k'}); };
      r.onsuccess=function(){ self.db=r.result; self.uid=uid; ok(); };
      r.onerror=function(){ ko(r.error); };
      r.onblocked=function(){ ko(new Error('Banco do aparelho bloqueado.')); };
    });
  },
  tx:function(loja,modo){ return this.db.transaction(loja,modo||'readonly').objectStore(loja); },
  get:function(loja,k){ return this.req(this.tx(loja).get(k)); },
  todos:function(loja){ return this.req(this.tx(loja).getAll()); },
  put:function(loja,v){ return this.req(this.tx(loja,'readwrite').put(v)); },
  apagar:function(loja,k){ return this.req(this.tx(loja,'readwrite').delete(k)); },
  limparLoja:function(loja){ return this.req(this.tx(loja,'readwrite').clear()); },
  /* ---------- sessão local (para abrir sem internet) ---------- */
  sessaoLocal:function(){ try{ return JSON.parse(localStorage.getItem('cob.off.sessao')||'null'); }catch(e){ return null; } },
  guardarSessao:function(){ try{ localStorage.setItem('cob.off.sessao', JSON.stringify({uid:Supa.uid(), email:Supa.email(), papel:Supa.papel, nome:Supa.nome||'', url:(Supa.cfg||{}).url||''})); }catch(e){} },
  esquecerSessao:function(){ try{ localStorage.removeItem('cob.off.sessao'); }catch(e){} },
  /* ---------- início ---------- */
  iniciar:async function(uid){
    try{ await this.abrir(uid); }catch(e){ this.erroBanco=e.message||'erro'; this.db=null; return false; }
    this.fila=(await this.todos('fila')).sort(function(a,b){ return a.ordem-b.ordem; });
    var fs=await this.todos('fotos'); var self=this; fs.forEach(function(f){ self.fotos[f.id]=f; try{ self.urls[f.id]=URL.createObjectURL(f.blob); }catch(e){} });
    var m=await this.get('meta','sync'); this.ultimaSync=m?m.em:null;
    this.guardarSessao();
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
    var rec=function(){ self.aoVoltarRede(); };
    window.addEventListener('online', rec);
    window.addEventListener('offline', function(){ scheduleRender(); });
    this.timer=setInterval(function(){ if(!self.semRede()) self.sincronizar(); }, 30000);
    return true;
  },
  /* ---------- cache de leitura ---------- */
  salvarCache:async function(){
    if(!this.db) return; var agora=new Date().toISOString();
    for(var i=0;i<COLS.length;i++){
      var c=COLS[i], docs=[]; Store.data[c].forEach(function(d,id){ docs.push([id,d,Supa.vers[c+'/'+id]||null]); });
      await this.put('cache',{col:c, docs:docs, em:agora});
    }
    await this.put('meta',{k:'sync', em:agora}); this.ultimaSync=agora;
  },
  sujo:function(){ var self=this; if(!this.db||this.tSujo) return; this.tSujo=setTimeout(function(){ self.tSujo=null; self.salvarCache().catch(function(){}); }, 5000); },
  restaurarCache:async function(){
    var cs=await this.todos('cache'), mais=null;
    cs.forEach(function(x){ Store.data[x.col]=new Map(x.docs.map(function(d){ if(d[2]) Supa.vers[x.col+'/'+d[0]]=d[2]; return [d[0],d[1]]; })); if(!mais||x.em<mais) mais=x.em; });
    return mais;
  },
  /* ---------- classificar o que pode ir para a fila ---------- */
  diff:function(a,b){ a=a||{}; b=b||{}; var ks={}; Object.keys(a).concat(Object.keys(b)).forEach(function(k){ ks[k]=1; }); return Object.keys(ks).filter(function(k){ return JSON.stringify(a[k])!==JSON.stringify(b[k]); }); },
  motivo:function(c){ var r=OFF_ROTULO[c]; return 'esta ação ('+(COL_NOMES[c]||c)+') precisa ser conferida pelo servidor e/ou envolve valores em R$'+(r?'':'')+', e por isso só vale com internet'; },
  classificar:function(c,id,rec,old){
    var papel=Store.papel, dif=this.diff(old,rec);
    if(c==='compras'||c==='locacoes'){
      var perm=OFF_PATCH[c], fora=dif.filter(function(k){ return perm.indexOf(k)<0 && k!=='_opId'; });
      if(!old||fora.length) return {ok:false, motivo:'compras e locações só podem ser alteradas offline no recebimento, na conferência e nos apontamentos do equipamento; o resto envolve valores em R$ e só vale com internet'};
      var st=rec.status; if(dif.indexOf('status')>=0 && OFF_ST[c].indexOf(st)<0) return {ok:false, motivo:'esta mudança de situação precisa do servidor'};
      var patch={}; dif.forEach(function(k){ if(perm.indexOf(k)>=0) patch[k]=rec[k]; });
      return {ok:true, tipo:'rpc', fn:'campo_patch', args:{tab:c, rid:id, patch:patch}};
    }
    if(OFF_SET_OK.indexOf(c)>=0) return {ok:true, tipo:'set'};
    if(c==='ocorrencias'){
      if(!old) return {ok:true, tipo:'set'};
      var f2=dif.filter(function(k){ return k!=='interacoes'&&k!=='prazo'; });
      if(f2.length) return {ok:false, motivo:'só dá para abrir ocorrência e registrar contato sem internet; mudar a situação ou outros dados precisa do servidor'};
      return this.anexo(c,id,rec,old,dif)||{ok:true, tipo:'set'};
    }
    if(c==='acoes'){
      if(old && dif.length===1 && dif[0]==='interacoes'){ var a=this.anexo(c,id,rec,old,dif); if(a) return a; }
      return {ok:false, motivo:'sem internet só dá para registrar contato nas ações'};
    }
    return {ok:false, motivo:this.motivo(c)};
  },
  anexo:function(c,id,rec,old,dif){
    if(dif.length!==1||dif[0]!=='interacoes') return null;
    var a=old.interacoes||[], b=rec.interacoes||[]; if(b.length<=a.length || JSON.stringify(b.slice(0,a.length))!==JSON.stringify(a)) return null;
    return {ok:true, tipo:'anexar', itens:b.slice(a.length)};
  },
  // sessão expirou ou foi revogada (internet ok, mas sem login): o cache de leitura é apagado; a fila fica guardada
  sessaoExpirada:async function(sc){
    var ses=this.sessaoLocal(); if(!ses||!window.indexedDB) return;
    try{ await this.abrir(ses.uid); await this.limparLoja('cache'); await this.put('meta',{k:'sync', em:null}); this.fila=(await this.todos('fila')); this.precisaLogin=this.fila.length>0; this.db.close(); this.db=null; }catch(e){}
  },
  /* ---------- fila ---------- */
  proxOrdem:function(){ return this.fila.reduce(function(m,o){ return Math.max(m,o.ordem); },0)+1; },
  novoOp:function(base){ return Object.assign({opId:nid()+Math.random().toString(36).slice(2,8), ordem:this.proxOrdem(), estado:'pendente', tentativas:0, erro:'', criadoEm:new Date().toISOString()}, base); },
  gravarOp:async function(op){ var i=this.fila.findIndex(function(x){ return x.opId===op.opId; }); if(i<0) this.fila.push(op); else this.fila[i]=op; await this.put('fila',JSON.parse(JSON.stringify(op))); },
  tirarOp:async function(op){ this.fila=this.fila.filter(function(x){ return x.opId!==op.opId; }); await this.apagar('fila',op.opId); },
  enfileirar:async function(cl,c,id,rec,old){
    if(cl.tipo==='set'){
      var ja=this.fila.filter(function(o){ return o.tipo==='set'&&o.c===c&&o.id===id&&o.estado==='pendente'; })[0];
      if(ja){ ja.rec=rec; await this.gravarOp(ja); return; }
      await this.gravarOp(this.novoOp({tipo:'set', c:c, id:id, rec:rec, base:old?(Supa.vers[c+'/'+id]||null):null}));
    } else if(cl.tipo==='anexar'){
      for(var i=0;i<cl.itens.length;i++) await this.gravarOp(this.novoOp({tipo:'anexar', c:c, id:id, campo:'interacoes', item:cl.itens[i]}));
    } else if(cl.tipo==='rpc'){
      var ja2=this.fila.filter(function(o){ return o.tipo==='rpc'&&o.c===c&&o.id===id&&o.estado==='pendente'; })[0];
      if(ja2){ ja2.args.patch=Object.assign({}, ja2.args.patch, cl.args.patch); await this.gravarOp(ja2); return; }
      await this.gravarOp(this.novoOp({tipo:'rpc', c:c, id:id, fn:cl.fn, args:cl.args}));
    }
    toast('Guardado no aparelho, aguardando envio. Abra o aplicativo onde houver sinal para enviar.');
    scheduleRender();
  },
  /* ---------- fotos ---------- */
  guardarFoto:async function(blob,zona,oid){
    var t=(blob&&blob.type)||'', ext=t==='application/pdf'?'pdf':(t==='image/png'?'png':(t==='image/webp'?'webp':'jpg'));
    if(navigator.storage&&navigator.storage.estimate){ try{ var e=await navigator.storage.estimate(); if(e&&e.quota&&e.usage!=null&&(e.quota-e.usage)<(blob.size||0)*2+5*1024*1024){ var er=new Error('Pouco espaço livre no aparelho para guardar a foto. Libere espaço e tente de novo.'); er.code='sem_espaco'; throw er; } }catch(x){ if(x.code==='sem_espaco') throw x; } }
    var id='f'+nid()+Math.random().toString(36).slice(2,6), path=(oid||Supa.obraDoContexto()||'sem-obra')+'/'+(zona||'campo')+'/'+hoje().slice(0,7)+'/'+id+'.'+ext;
    var f={id:id, blob:blob, path:path, tipo:t||'application/octet-stream', criadaEm:new Date().toISOString()};
    await this.put('fotos',f); this.fotos[id]=f; try{ this.urls[id]=URL.createObjectURL(blob); }catch(e){}
    return {id:'off:'+id};
  },
  fotoUrl:function(ref){ var id=String(ref).slice(4); return this.urls[id]||''; },
  trocarRefs:function(obj,de,para){ var s=JSON.stringify(obj); return JSON.parse(s.split(de).join(para)); },
  subirFotos:async function(){
    var ids=Object.keys(this.fotos), self=this;
    for(var i=0;i<ids.length;i++){
      var f=this.fotos[ids[i]];
      var up=await Supa.cli.storage.from(BUCKET).upload(f.path, f.blob, {contentType:f.tipo, upsert:false});
      if(up.error && !/already exists|duplicate|resource already|409/i.test((up.error.message||'')+(up.error.statusCode||''))) sbErr(up);   // já enviada antes (resposta perdida): conta como enviada
      var de='off:'+f.id, para='sb:'+f.path;
      for(var j=0;j<this.fila.length;j++){ var op=this.fila[j]; if(JSON.stringify(op).indexOf(de)>=0){ var novo=this.trocarRefs(op,de,para); Object.assign(op,novo); await this.gravarOp(op); } }
      COLS.forEach(function(c){ Store.data[c].forEach(function(d,k){ if(JSON.stringify(d).indexOf(de)>=0) Store.data[c].set(k, self.trocarRefs(d,de,para)); }); });
      await this.apagar('fotos',f.id); delete this.fotos[f.id];
    }
  },
  /* ---------- envio ---------- */
  traduzErro:function(e){
    var m=(e&&e.message)||'erro';
    if(/row-level security|permission denied|42501|Sem permissão|Sem acesso/i.test(m)) return 'Seu perfil não tem permissão para esta alteração.';
    if(/Transição|não permitida/i.test(m)) return 'Esta mudança de situação não é permitida para o seu perfil.';
    if(/não encontrado/i.test(m)) return 'O registro foi removido no servidor.';
    return m;
  },
  enviarOp:async function(op){
    var cli=Supa.cli;
    if(op.tipo==='set'){
      var rec=Object.assign({}, op.rec, {_opId:op.opId}), oid=op.c==='obras'?op.id:(rec.obraId||null), r;
      if(op.base){
        r=await cli.from(op.c).update({dados:rec, obra_id:oid}).eq('id',op.id).eq('versao',op.base).select('versao');
        if(r.error) throw this.erroDe(r.error);
        if(!r.data||!r.data.length) return await this.conflito(op);
        Supa.vers[op.c+'/'+op.id]=r.data[0].versao; return 'ok';
      }
      r=await cli.from(op.c).insert({id:op.id, obra_id:oid, dados:rec}).select('versao');
      if(r.error){
        if(r.error.code==='23505'){ var ex=await cli.from(op.c).select('id,dados,versao').eq('id',op.id), x=ex.data&&ex.data[0]; if(x&&x.dados&&x.dados._opId===op.opId) return 'ok'; return await this.conflito(op); }
        throw this.erroDe(r.error);
      }
      if(r.data&&r.data[0]) Supa.vers[op.c+'/'+op.id]=r.data[0].versao; return 'ok';
    }
    if(op.tipo==='anexar'){
      var ra=await cli.rpc('anexar_item', {tab:op.c, rid:op.id, campo:op.campo, item:op.item, p_op:op.opId}); if(ra.error) throw this.erroDe(ra.error); return 'ok';
    }
    if(op.tipo==='rpc'){
      var rr=await cli.rpc(op.fn, Object.assign({}, op.args, {p_op:op.opId})); if(rr.error) throw this.erroDe(rr.error); return 'ok';
    }
    throw new Error('Operação desconhecida');
  },
  erroDe:function(er){ var e=new Error(er.message||'erro'); e.code=er.code; return e; },
  conflito:async function(op){
    var r=await Supa.cli.from(op.c).select('id,dados,versao,excluido_em').eq('id',op.id), x=r.data&&r.data[0];
    op.estado='conflito'; op.servidor=x&&!x.excluido_em?{dados:x.dados, versao:x.versao}:null; op.erro=x&&!x.excluido_em?'Outra pessoa alterou este registro enquanto você estava sem internet.':'Este registro foi removido no servidor.';
    return 'conflito';
  },
  sincronizar:async function(manual){
    if(this.sincronizando||!this.ativo()||this.semRede()) return;
    this.sincronizando=true; scheduleRender();
    var parou=false;
    try{
      if(Object.keys(this.fotos).length) await this.subirFotos();
      var lista=this.fila.filter(function(o){ return o.estado==='pendente'; });
      for(var i=0;i<lista.length;i++){
        var op=lista[i]; op.estado='enviando'; op.tentativas++;
        try{
          var r=await this.enviarOp(op);
          if(r==='ok'){ await this.tirarOp(op); } else { await this.gravarOp(op); }
        }catch(e){
          if(this.redeFalhou(e)){ op.estado='pendente'; await this.gravarOp(op); parou=true; break; }
          op.estado='erro'; op.erro=this.traduzErro(e); await this.gravarOp(op);
        }
      }
      if(!parou){
        await Store.carregarTudoV2(); await this.salvarCache();
        if(manual) toast(this.pendentes()?'Sincronizado, mas há itens que precisam da sua atenção.':'Tudo enviado.');
      }
    }catch(e){ if(!this.redeFalhou(e)) toast('Não foi possível sincronizar: '+this.traduzErro(e), true); }
    this.sincronizando=false; scheduleRender();
  },
  aoVoltarRede:async function(){
    scheduleRender();
    if(this.offlineBoot){ await this.reconectar(); return; }
    await this.sincronizar();
  },
  // abriu sem internet e a internet voltou: tenta recuperar a sessão e sincronizar
  reconectar:async function(){
    var st=await Supa.start(Supa.cfg||Supa.config());
    if(st==='ok'){ this.offlineBoot=false; Store.uid=Supa.uid(); Store.papel=Supa.papel; await this.sincronizar(); await Store.subscribeSupaV2(); await this.salvarCache(); if(typeof Notif!=='undefined') Notif.iniciar(); this.guardarSessao(); scheduleRender(); }
    else if(st==='login'){ this.precisaLogin=true; scheduleRender(); }
  },
  pendentes:function(){ return this.fila.filter(function(o){ return o.estado!=='enviado'; }).length+Object.keys(this.fotos).length; },
  /* ---------- resolver conflito / erro ---------- */
  manterMinha:async function(id){
    var op=this.fila.filter(function(o){ return o.opId===id; })[0]; if(!op) return;
    if(op.tipo==='set'){ op.base=op.servidor?op.servidor.versao:null; if(!op.servidor) op.base=null; }
    op.estado='pendente'; op.erro=''; delete op.servidor; await this.gravarOp(op); scheduleRender(); this.sincronizar(true);
  },
  manterServidor:async function(id){
    var op=this.fila.filter(function(o){ return o.opId===id; })[0]; if(!op) return;
    if(op.servidor){ Store.data[op.c].set(op.id, op.servidor.dados); Supa.vers[op.c+'/'+op.id]=op.servidor.versao; } else { Store.data[op.c].delete(op.id); }
    await this.tirarOp(op); scheduleRender(); this.sujo();
  },
  tentarDeNovo:async function(id){ var op=this.fila.filter(function(o){ return o.opId===id; })[0]; if(!op) return; op.estado='pendente'; op.erro=''; await this.gravarOp(op); this.sincronizar(true); },
  /* ---------- sair ---------- */
  limparTudo:async function(){
    var uid=this.uid, self=this;
    try{ if(this.db){ this.db.close(); } }catch(e){}
    this.db=null; this.fila=[]; this.fotos={}; Object.keys(this.urls).forEach(function(k){ try{ URL.revokeObjectURL(self.urls[k]); }catch(e){} }); this.urls={};
    if(uid && window.indexedDB){ await new Promise(function(ok){ var r=window.indexedDB.deleteDatabase(self.nomeBanco(uid)); r.onsuccess=r.onerror=r.onblocked=function(){ ok(); }; }); }
    this.esquecerSessao();
  }
};
COBX.Off=Off;

/* ---------- Store: ponto único de decisão (fila, bloqueio explicado, reversão) ---------- */
Store.tentaOffline=function(c,id,rec,old){
  // devolve null = seguir o caminho normal; Promise = tratado aqui
  var camposo=Store.papel==='campo' && (c==='compras'||c==='locacoes');
  if(!Off.ativo()) return null;
  var offline=Off.semRede();
  if(!offline && !camposo) return null;
  var cl=Off.classificar(c,id,rec,old);
  if(!cl.ok){
    if(offline){ // reverte a alteração local e explica
      if(old) Store.data[c].set(id,old); else Store.data[c].delete(id); scheduleRender();
      toast('Sem internet: '+cl.motivo+'. Nada foi alterado.', true); return Promise.resolve(false);
    }
    return null;
  }
  if(offline) return Off.enfileirar(cl,c,id,rec,old);
  // campo, online: grava só pela função do servidor (a RLS não deixa gravar a tabela)
  if(cl.tipo==='rpc'){
    var op=Off.novoOp({tipo:'rpc', c:c, id:id, fn:cl.fn, args:cl.args});
    return Supa.cli.rpc(op.fn, Object.assign({}, op.args, {p_op:op.opId})).then(function(r){ if(r.error){ var e=new Error(r.error.message); e.code=r.error.code; throw e; } if(!r.error) Supa.recarregarCampo(c); }).catch(function(e){
      if(Off.redeFalhou(e)) return Off.enfileirar(cl,c,id,rec,old);
      if(old) Store.data[c].set(id,old); scheduleRender(); Store.fail(e);
    });
  }
  return null;
};
Supa.recarregarCampo=async function(c){ if(Store.papel!=='campo') return; try{ await Store.carregarColecaoV2(c); }catch(e){} };

/* ---------- service worker, instalação e aviso de versão nova ---------- */
function offRegistrarSW(){
  if(!('serviceWorker' in navigator)) return;
  if(!(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')) return;
  navigator.serviceWorker.register('sw.js').then(function(reg){
    var avisa=function(w){ if(w && navigator.serviceWorker.controller){ Off.swNova=w; scheduleRender(); } };
    if(reg.waiting) avisa(reg.waiting);
    reg.addEventListener('updatefound', function(){ var w=reg.installing; if(!w) return; w.addEventListener('statechange', function(){ if(w.state==='installed') avisa(w); }); });
    setInterval(function(){ try{ reg.update(); }catch(e){} }, 3600000);
  }).catch(function(){});
  var recarregou=false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){ if(recarregou) return; recarregou=true; location.reload(); });
}
function offEhIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent||'') || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }
function offInstalado(){ return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true; }

/* ---------- faixa de estado (sempre visível) ---------- */
function bannerOffline(){
  if(!Off.ativo() && !Off.offlineBoot) return '';
  var n=Off.pendentes(), h='', off=Off.semRede();
  var sync=Off.ultimaSync?'última sincronização: '+quandoAviso(Off.ultimaSync):'ainda não sincronizado';
  if(off) h+='<div class="banner" style="background:#fff3cd"><strong>Sem internet.</strong> Você pode seguir nas tarefas de campo (diário, fichas, ocorrências, pacotes, recebimento, estoque, locações); o que você registrar fica guardado no aparelho e é enviado quando houver sinal. Ações com valores, aprovações e liberações só funcionam com internet. · '+esc(sync)+'</div>';
  if(n) h+='<div class="banner"><strong>'+plural(n,'alteração aguardando envio','alterações aguardando envio')+'.</strong> '+(off?'Abra o aplicativo onde houver sinal para enviar. ':'')+esc(sync)+' · <a href="#/pendencias">Ver pendências</a>'+(off?'':' <button class="btn sm" data-act="off-sync">'+(Off.sincronizando?'Enviando…':'Sincronizar agora')+'</button>')+'</div>';
  else if(!off && Off.ultimaSync) h+='<div class="banner" style="background:transparent;border:0;padding:4px 16px" title="Tudo enviado"><span class="muted small">Tudo enviado · '+esc(sync)+'</span></div>';
  if(Off.precisaLogin) h+='<div class="banner"><strong>Sua sessão expirou.</strong> Suas alterações continuam guardadas no aparelho. <button class="btn sm" data-act="off-entrar">Entrar de novo para enviar</button></div>';
  if(Off.swNova) h+='<div class="banner"><strong>Há uma versão nova do aplicativo.</strong> <button class="btn sm primary" data-act="off-atualizar">Atualizar agora</button></div>';
  if(offEhIOS() && !offInstalado()) h+='<div class="banner"><strong>No iPhone, instale o aplicativo na tela inicial</strong> (Compartilhar → Adicionar à Tela de Início). Sem isso o Safari pode apagar os dados guardados para uso offline.</div>';
  return h;
}

/* ---------- página de pendências ---------- */
function opRotulo(op){
  var nome=COL_NOMES[op.c]||op.c, r=op.rec||{}, a=op.args||{}, t={set:'Gravar', anexar:'Acrescentar contato', rpc:'Atualizar'}[op.tipo];
  var det=op.tipo==='set'?(r.item||r.titulo||r.descricao||r.texto||r.nome||''):(op.tipo==='anexar'?(op.item&&op.item.texto||''):(a.patch&&a.patch.status?'situação → '+a.patch.status:''));
  return t+' · '+nome+(det?': '+short(String(det),70):'');
}
function vPendencias(){
  var h='<div class="wrap"><div class="sec-h"><div><h1>Pendências de sincronização</h1><p class="muted" style="margin-top:4px">O que foi feito no aparelho e ainda não foi confirmado pelo servidor.</p></div>'+(Off.semRede()?'':'<button class="btn" data-act="off-sync">'+(Off.sincronizando?'Enviando…':'Sincronizar agora')+'</button>')+'</div>';
  var fotos=Object.keys(Off.fotos).length;
  if(!Off.fila.length&&!fotos) return h+'<div class="card sec empty"><h3>Nada pendente</h3><p>Tudo o que você fez foi confirmado pelo servidor.</p></div></div>';
  if(fotos) h+='<div class="callout warn sec">'+plural(fotos,'foto aguardando envio','fotos aguardando envio')+'. Elas sobem sozinhas quando houver sinal.</div>';
  var EST={pendente:['warn','Aguardando envio'], enviando:['steel','Enviando…'], erro:['crit','Erro'], conflito:['crit','Conflito']};
  return h+'<section class="card sec"><ul class="hist">'+Off.fila.map(function(op){
    var e=EST[op.estado]||EST.pendente, extra='', bt='';
    if(op.estado==='conflito'){
      var minha=op.rec||{}, srv=op.servidor&&op.servidor.dados;
      var ch=srv?Off.diff(srv,minha).filter(function(k){ return k!=='_opId'&&k!=='id'; }).slice(0,6):[];
      extra='<div class="d">'+esc(op.erro)+'</div>'+(ch.length?'<div class="d">Diferenças: '+ch.map(function(k){ return '<strong>'+esc(k)+'</strong> — sua versão: '+esc(short(JSON.stringify(minha[k]),60))+' · servidor: '+esc(short(JSON.stringify(srv[k]),60)); }).join('<br>')+'</div>':'');
      bt='<button class="btn sm primary" data-act="off-minha" data-id="'+op.opId+'">Manter a minha</button> <button class="btn sm" data-act="off-servidor" data-id="'+op.opId+'">Manter a do servidor</button>';
    } else if(op.estado==='erro'){ extra='<div class="d">'+esc(op.erro)+'</div>'; bt='<button class="btn sm" data-act="off-retry" data-id="'+op.opId+'">Tentar de novo</button> <button class="btn sm ghost" data-act="off-servidor" data-id="'+op.opId+'">Descartar</button>'; }
    return '<li><div class="q">'+quandoAviso(op.criadoEm)+'</div><div><div class="row" style="gap:6px"><span class="chip '+e[0]+'">'+e[1]+'</span></div><div style="margin-top:4px;font-weight:500">'+esc(opRotulo(op))+'</div>'+extra+'</div><div class="row">'+bt+'</div></li>';
  }).join('')+'</ul></section></div>';
}
var AOff={
  'off-sync':function(){ Off.sincronizar(true); },
  'off-minha':function(d){ Off.manterMinha(d.id); },
  'off-servidor':async function(d){ var ok=await confirmDlg('Descartar a sua versão?','<p>A sua alteração será descartada e vale o que está no servidor.</p>','Descartar',true); if(ok){ closeDlg(); Off.manterServidor(d.id); } },
  'off-retry':function(d){ Off.tentarDeNovo(d.id); },
  'off-atualizar':function(){ if(Off.swNova) Off.swNova.postMessage({tipo:'ATUALIZAR'}); },
  'off-entrar':function(){ location.reload(); }
};
/* bloqueio explicado, antes de executar a ação */
function offBloqueia(act){
  if(!Off.semRede()||!Off.ativo()&&!Off.offlineBoot) return false;
  if(!OFF_ACOES_ONLINE.test(act||'')) return false;
  var pre=String(act).split('-')[0];
  toast('Sem internet: esta ação precisa de conexão porque '+(OFF_ROTULO[pre]?'envolve '+OFF_ROTULO[pre]+', que ':'')+'envolve valores em R$, aprovação ou liberação e só vale depois de conferida pelo servidor. Tente de novo com internet.', true);
  return true;
}
