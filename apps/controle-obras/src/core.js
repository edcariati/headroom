var ETAPAS = PROTO.etapas, FASES = PROTO.fases;

/* ---------- constantes ---------- */
var STATUS = {nao_iniciada:'Não iniciada', em_execucao:'Em execução', aguardando_vistoria:'Aguardando vistoria', liberada:'Liberada'};
var STATUS_ORDER = ['nao_iniciada','em_execucao','aguardando_vistoria','liberada'];
var GRAV = {critica:'Crítica', importante:'Importante', simples:'Simples'};
var OC_STATUS = {aberta:'Aberta', em_correcao:'Em correção', aguardando_reinspecao:'Aguardando reinspeção', fechada:'Fechada'};
var OC_ORDER = ['aberta','em_correcao','aguardando_reinspecao','fechada'];
var CAUSAS = {cliente:'Cliente', fornecedor:'Fornecedor', producao:'Produção', projeto:'Projeto', clima:'Clima', retrabalho:'Retrabalho'};
var CLIMA = ['Sol','Nublado','Chuva fraca','Chuva forte'];
var RESULT = {aprovado:'Aprovado', reprovado:'Reprovado', reinspecao:'Aguardando reinspeção', na:'Não se aplica'};
var CANAIS = ['WhatsApp','Telefone','Presencial','E-mail','Reunião'];
var TIPOLOGIAS = ['Casa térrea','Sobrado','Casa de 3 andares'];
var MODALIDADES = ['Gestão de Obras','Administração de Obra'];
var TIPOS_OC = [
  {k:'apontamento', n:'Apontamento da engenharia', ex:'Serviço fora do projeto ou da norma, encontrado em vistoria.', adt:'Não gera aditivo, salvo se o erro estava no projeto.'},
  {k:'cliente', n:'Solicitação do cliente', ex:'Mudança de acabamento, layout ou pontos elétricos, ampliação, troca de material.', adt:'Gera aditivo quando altera escopo, prazo ou valor. Aprovar por escrito antes de executar.'},
  {k:'vizinho', n:'Reclamação ou solicitação de vizinho', ex:'Poeira, ruído, trincas, escoamento de água, invasão de divisa, caminhões e horário.', adt:'Depende: gera aditivo se exigir serviço fora do escopo.'},
  {k:'orgao', n:'Exigência de órgão ou concessionária', ex:'Fiscalização, embargo, adequações para o habite-se, exigência de ligações.', adt:'Gera aditivo quando fora do escopo contratado.'},
  {k:'imprevisto', n:'Imprevisto de campo', ex:'Solo diferente da sondagem, rocha, lençol freático, tubulação não cadastrada, chuva forte.', adt:'Gera aditivo por condição extemporânea.'},
  {k:'falha', n:'Falha de projeto ou de fornecedor', ex:'Erro ou incompatibilidade de projeto, atraso ou defeito de material.', adt:'Depende da responsabilidade prevista em contrato.'}
];

/* ---------- utilitários ---------- */
function $(s, el){ return (el||document).querySelector(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function pad(n){ return String(n).padStart(2,'0'); }
function iso(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function hoje(){ return iso(new Date()); }
function parse(s){ var p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); }
function addDays(s,n){ var d=parse(s); d.setDate(d.getDate()+n); return iso(d); }
function diffDays(a,b){ return Math.round((parse(b)-parse(a))/86400000); }
function segunda(s){ var d=parse(s); d.setDate(d.getDate()-((d.getDay()+6)%7)); return iso(d); }
function fmt(s){ if(!s) return '—'; var p=String(s).slice(0,10).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function fmtC(s){ if(!s) return '—'; var p=String(s).slice(0,10).split('-'); return p[2]+'/'+p[1]; }
function pct(x){ return x==null?'—':Math.round(x*100)+'%'; }
function nid(){ return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function plural(n,s,p){ return n+' '+(n===1?s:p); }

var renderTimer=null;
function scheduleRender(){ if(renderTimer) return; renderTimer=requestAnimationFrame(function(){ renderTimer=null; if(window.__render) window.__render(); }); }

function toast(msg, err){
  var box=document.getElementById('toast'); if(!box) return;
  var d=document.createElement('div'); if(err) d.className='err'; d.textContent=msg; box.appendChild(d);
  setTimeout(function(){ d.remove(); }, 4600);
}

/* ---------- Supabase (nuvem) ---------- */
var BUCKET='obras-arquivos';
function sbErr(r){ if(r&&r.error){ var e=new Error(r.error.message||'erro'); e.code=r.error.code||r.error.statusCode||'supabase'; throw e; } return r; }
var Supa={ cli:null, cfg:null, session:null,
  config:function(){
    var c=null; try{ c=JSON.parse(localStorage.getItem('cob.supa')||'null'); }catch(e){}
    if(!c && window.COB_SUPABASE) c=window.COB_SUPABASE;
    return (c && c.url && c.key)?{url:String(c.url).replace(/\/+$/,''), key:String(c.key)}:null;
  },
  saveConfig:function(c){ try{ if(c) localStorage.setItem('cob.supa', JSON.stringify(c)); else localStorage.removeItem('cob.supa'); }catch(e){} },
  start:async function(cfg){
    if(!window.supabase || !window.supabase.createClient) return 'sem_biblioteca';
    this.cfg=cfg;
    try{ this.cli=window.supabase.createClient(cfg.url, cfg.key, {auth:{persistSession:true, storageKey:'cob.supa.sessao'}}); }catch(e){ return 'config_invalida'; }
    var r; try{ r=await this.cli.auth.getSession(); }catch(e){ return 'offline'; }
    this.session=r&&r.data&&r.data.session;
    if(!this.session) return 'login';
    this.perfil();
    return 'ok';
  },
  email:function(){ return this.session&&this.session.user?this.session.user.email:''; },
  uid:function(){ return this.session&&this.session.user?this.session.user.id:null; },
  perfil:function(){
    var u=this.session.user, md=u.user_metadata||{};
    this.cli.from('perfis').upsert({id:u.id, email:u.email, nome:md.nome||md.name||String(u.email||'').split('@')[0], atualizado_em:new Date().toISOString()}).then(function(){}, function(){});
  },
  adapter:function(){
    var cli=this.cli;
    return { doc:function(p){ var i=p.indexOf('/'), c=p.slice(0,i), id=p.slice(i+1); return {
      set:function(rec){ return cli.from('registros').upsert({colecao:c, id:id, dados:rec}).then(sbErr); },
      delete:function(){ return cli.from('registros').delete().match({colecao:c, id:id}).then(sbErr); }
    }; } };
  },
  userShim:function(){
    var self=this;
    return { profiles:async function(ids){
      var r=sbErr(await self.cli.from('perfis').select('id,nome,email').in('id', ids)), out={}, me=self.uid();
      (r.data||[]).forEach(function(p){ out[p.id]={name:p.nome||p.email, isMe:p.id===me}; });
      return out;
    } };
  },
  assets:function(){
    var self=this;
    return { upload:async function(blob){
      var t=(blob&&blob.type)||'', ext=t==='application/pdf'?'pdf':(t==='image/png'?'png':(t==='image/webp'?'webp':'jpg'));
      var path=(self.uid()||'anon')+'/'+hoje().slice(0,7)+'/'+nid()+Math.random().toString(36).slice(2,8)+'.'+ext;
      sbErr(await self.cli.storage.from(BUCKET).upload(path, blob, {contentType:t||'application/octet-stream', upsert:false}));
      return {id:'sb:'+path};
    } };
  },
  publicUrl:function(path){ var c=this.cfg||this.config(); return c?c.url+'/storage/v1/object/public/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/'):''; },
  upsertMany:async function(rows){
    for(var i=0;i<rows.length;i+=400){ sbErr(await this.cli.from('registros').upsert(rows.slice(i,i+400))); }
  }
};
function blobUrl(id){ id=String(id||''); return id.indexOf('sb:')===0?Supa.publicUrl(id.slice(3)):'/_blob/'+id; }

/* ---------- armazenamento ---------- */
var COLS=['obras','etapas','atividades','pacotes','diarios','fichas','ocorrencias','prestadores','eventos','atas','acoes','docsLegais','docsPrest','rfis','materiais','locs','servicos','treinamentos','fornecedores','compras','movEstoque','locacoes','contratosPrest','termos','danos','orcamentos','orcItens','aditivos','medicoes','contasPagar','aportes','empresas','contratosCliente','lancamentos','relatorios','avaliacoes','licoes','config'];
var Store={
  mode:'boot', db:null, data:{}, uid:null, writable:true, user:null, q:new Map(), unsubs:[],
  init:async function(){
    var self=this; COLS.forEach(function(c){ self.data[c]=new Map(); });
    var db=null, user=null;
    try{ if(window.claude && window.claude.use){ db=await window.claude.use('db'); user=await window.claude.use('user'); } }catch(e){}
    this.user=user;
    if(user){
      try{ this.uid=await user.id(); }catch(e){}
      try{ var w=await user.can('data.write'); if(w===false) this.writable=false; }catch(e){}
    }
    if(db){ this.db=db; this.mode='db'; this.backend='claude'; await this.subscribeAll(); return; }
    var sc=Supa.config();
    if(sc){
      var st=await Supa.start(sc);
      if(st==='login'){ this.mode='login'; return; }
      if(st==='ok'){
        this.db=Supa.adapter(); this.mode='db'; this.backend='supabase';
        this.uid=Supa.uid(); this.user=Supa.userShim();
        await this.subscribeSupa(); return;
      }
      this.supaErro=st;
    }
    this.mode='local'; this.backend='local'; this.loadLocal();
  },
  subscribeSupa:async function(){
    var self=this;
    var ch=Supa.cli.channel('registros-app').on('postgres_changes', {event:'*', schema:'public', table:'registros'}, function(p){
      if(p.eventType==='DELETE'){ var o=p.old||{}; if(o.colecao && self.data[o.colecao]) self.data[o.colecao].delete(o.id); }
      else { var n=p.new||{}; if(n.colecao && self.data[n.colecao]) self.data[n.colecao].set(n.id, n.dados||{}); }
      scheduleRender();
    }).subscribe();
    this.unsubs.push(function(){ Supa.cli.removeChannel(ch); });
    var from=0, step=1000;
    while(true){
      var r=await Supa.cli.from('registros').select('colecao,id,dados').order('colecao').order('id').range(from, from+step-1);
      if(r.error){ toast('Não foi possível carregar os dados da nuvem ('+(r.error.code||r.error.message)+').', true); break; }
      r.data.forEach(function(x){ if(self.data[x.colecao]) self.data[x.colecao].set(x.id, x.dados||{}); });
      if(r.data.length<step) break; from+=step;
    }
  },
  subscribeAll:function(){
    var self=this;
    return new Promise(function(resolve){
      var pending=COLS.length;
      function done(){ pending--; if(pending===0) resolve(); }
      COLS.forEach(function(c){
        var first=true;
        var u=self.db.collection(c).onSnapshot(function(snap){
          var m=new Map(); snap.docs.forEach(function(d){ if(d.exists) m.set(d.id,d.data()); });
          self.data[c]=m;
          if(first){ first=false; done(); } else scheduleRender();
        }, function(err){
          if(first){ first=false; done(); }
          toast('Conexão com os dados interrompida ('+(err&&err.code||'erro')+'). Recarregue a página.', true);
        });
        self.unsubs.push(u);
      });
      setTimeout(function(){ if(pending>0){ pending=-99; resolve(); } }, 12000);
    });
  },
  loadLocal:function(){ var self=this; COLS.forEach(function(c){ try{ var raw=localStorage.getItem('cob.'+c); if(raw) self.data[c]=new Map(JSON.parse(raw)); }catch(e){} }); },
  saveLocal:function(c){ try{ localStorage.setItem('cob.'+c, JSON.stringify(Array.from(this.data[c].entries()))); }catch(e){ toast('Não foi possível salvar neste navegador.', true); } },
  enqueue:function(key, fn){
    var self=this, prev=this.q.get(key)||Promise.resolve();
    var next=prev.catch(function(){}).then(fn);
    this.q.set(key,next);
    next.then(function(){ if(self.q.get(key)===next) self.q.delete(key); }, function(){ if(self.q.get(key)===next) self.q.delete(key); });
    return next;
  },
  fail:function(e){ toast('Não foi possível salvar'+(e&&e.code?' ('+e.code+')':'')+'. Confira sua conexão e tente de novo.', true); },
  set:function(c,id,data){
    var self=this;
    if(!this.writable){ toast('Seu acesso é somente leitura.', true); return Promise.resolve(); }
    var rec=clone(data); delete rec.id;
    this.data[c].set(id,rec); scheduleRender();
    if(this.mode==='db'){ return this.enqueue(c+'/'+id, function(){ return self.db.doc(c+'/'+id).set(rec); }).catch(function(e){ self.fail(e); }); }
    this.saveLocal(c); return Promise.resolve();
  },
  patch:function(c,id,fields){ var cur=this.data[c].get(id)||{}; return this.set(c,id,Object.assign({},cur,fields)); },
  add:function(c,data){ var id=nid(); this.set(c,id,data); return id; },
  del:function(c,id){
    var self=this;
    if(!this.writable){ toast('Seu acesso é somente leitura.', true); return Promise.resolve(); }
    this.data[c].delete(id); scheduleRender();
    if(this.mode==='db'){ return this.enqueue(c+'/'+id, function(){ return self.db.doc(c+'/'+id).delete(); }).catch(function(e){ self.fail(e); }); }
    this.saveLocal(c); return Promise.resolve();
  }
};

var Names={ map:{}, pending:new Set(), t:null,
  get:function(id){
    if(!id) return 'Alguém';
    if(this.map[id]) return this.map[id];
    if(!this.pending.has(id)){ this.pending.add(id); this.soon(); }
    return 'Alguém';
  },
  soon:function(){
    var self=this; if(this.t) return;
    this.t=setTimeout(async function(){
      self.t=null; var ids=Array.from(self.pending); self.pending.clear();
      var u=Store.user; if(!u||!u.profiles||!ids.length) return;
      try{
        var ps=await u.profiles(ids), ch=false;
        ids.forEach(function(i){ var p=ps[i]; if(p){ self.map[i]=p.isMe?'você':(p.name||'Alguém'); ch=true; } });
        if(ch) scheduleRender();
      }catch(e){}
    }, 60);
  }
};

/* ---------- acesso a dados ---------- */
function L(c){ var out=[]; Store.data[c].forEach(function(d,id){ out.push(Object.assign({},d,{id:id})); }); return out; }
function G(c,id){ var d=Store.data[c].get(id); return d?Object.assign({},d,{id:id}):null; }
function byObra(c,oid){ return L(c).filter(function(x){ return x.obraId===oid; }); }
function etapaInfo(n){ return ETAPAS.filter(function(e){ return e.n===n; })[0]; }
function faseDe(n){ return FASES.filter(function(f){ return f.etapas.indexOf(n)>=0; })[0]; }
function etapaDoc(oid,n){ return G('etapas',oid+'_'+n) || {id:oid+'_'+n, obraId:oid, n:n, status:'nao_iniciada', hist:[], condicoesOk:false}; }
function fichaDoc(oid,n,i){ return G('fichas',oid+'_'+n+'_'+i); }
function prestNome(id){ var p=id?G('prestadores',id):null; return p?p.nome:''; }

/* ---------- regras de negócio ---------- */
function ocAberta(o){ return o.status!=='fechada'; }
function vencidaOc(o){ return ocAberta(o) && o.prazo && o.prazo<hoje(); }
function atrasoOc(o){ return vencidaOc(o)?diffDays(o.prazo,hoje()):0; }
function idadeOc(o){ return diffDays((o.criadoEm||hoje()).slice(0,10), hoje()); }

function fichasResumo(oid,n){
  var v=etapaInfo(n).verif, r={total:v.length, aprov:0, rep:0, reins:0, pend:0};
  v.forEach(function(_,i){
    var f=fichaDoc(oid,n,i);
    if(!f) r.pend++;
    else if(f.resultado==='aprovado'||f.resultado==='na') r.aprov++;
    else if(f.resultado==='reprovado') r.rep++;
    else r.reins++;
  });
  return r;
}
function podeIniciar(oid,n){
  var m=[];
  if(n>1){ var p=etapaDoc(oid,n-1); if(p.status!=='liberada') m.push('A etapa '+(n-1)+' ('+etapaInfo(n-1).nome+') ainda não foi liberada em vistoria.'); }
  return {ok:m.length===0, motivos:m};
}
function podeLiberar(oid,n){
  var m=[], e=etapaDoc(oid,n), info=etapaInfo(n);
  info.verif.forEach(function(v,i){
    var f=fichaDoc(oid,n,i);
    if(!f) m.push('Ficha sem inspeção: '+v.item+'.');
    else if(f.resultado==='reprovado') m.push('Ficha reprovada: '+v.item+'.');
    else if(f.resultado==='reinspecao') m.push('Ficha aguardando reinspeção: '+v.item+'.');
  });
  var crit=byObra('ocorrencias',oid).filter(function(o){ return o.etapa===n && o.gravidade==='critica' && ocAberta(o); });
  if(crit.length) m.push(plural(crit.length,'ocorrência crítica aberta','ocorrências críticas abertas')+' nesta etapa.');
  if(!e.condicoesOk) m.push('Condições de liberação da etapa ainda não confirmadas.');
  return {ok:m.length===0, motivos:m};
}
function conformidade(oid){
  var fs=byObra('fichas',oid).filter(function(f){ return f.primeira==='ok'||f.primeira==='nok'; });
  if(!fs.length) return null;
  return fs.filter(function(f){ return f.primeira==='ok'; }).length/fs.length;
}
function semanaInfo(oid,semana){
  var ps=byObra('pacotes',oid).filter(function(p){ return p.semana===semana; });
  var ok=ps.filter(function(p){ return p.concluido===true; }).length;
  var pend=ps.filter(function(p){ return p.concluido!==true && p.concluido!==false; }).length;
  return {semana:semana, ps:ps, tot:ps.length, ok:ok, pend:pend, ppc:ps.length?ok/ps.length:null};
}
function ppcHist(oid,n){
  var cur=segunda(hoje()), out=[];
  for(var i=n-1;i>=0;i--) out.push(semanaInfo(oid, addDays(cur,-7*i)));
  return out;
}
function semanasFechadas(oid){ return ppcHist(oid,8).filter(function(w){ return w.tot>0 && w.pend===0; }); }
function ppcAtual(oid){ var h=semanasFechadas(oid); return h.length?h[h.length-1]:null; }
function ppcAbaixo2(oid,meta){
  var h=semanasFechadas(oid); if(h.length<2) return false;
  return h[h.length-1].ppc*100<meta && h[h.length-2].ppc*100<meta;
}
function atAtrasada(a){ return a.fim<hoje() && (a.avanco||0)<100; }
function avancoCron(oid){
  var ats=byObra('atividades',oid); if(!ats.length) return null;
  var tot=0, acc=0;
  ats.forEach(function(a){ var d=Math.max(1,diffDays(a.inicio,a.fim)+1); tot+=d; acc+=d*(a.avanco||0)/100; });
  return acc/tot;
}
function validade(s){
  if(!s) return {k:'', t:'Sem data'};
  var d=diffDays(hoje(),s);
  if(d<0) return {k:'crit', t:'Vencido em '+fmt(s)};
  if(d<=30) return {k:'warn', t:'Vence em '+d+(d===1?' dia':' dias')};
  return {k:'ok', t:'Válido até '+fmt(s)};
}
function prestBloqueado(p){ return validade(p.seguro).k==='crit' || validade(p.treinamento).k==='crit' || L('treinamentos').some(function(t){ return t.prestadorId===p.id && t.validade && validade(t.validade).k==='crit'; }); }

function alertasObra(o){
  var A=[], oid=o.id, base='#/obra/'+oid+'/';
  var meta=o.metaPPC==null?80:o.metaPPC, dias=o.diasEscalar==null?7:o.diasEscalar;
  var ocs=byObra('ocorrencias',oid).filter(ocAberta);
  var crit=ocs.filter(function(x){ return x.gravidade==='critica'; });
  if(crit.length) A.push({k:'crit', t:plural(crit.length,'ocorrência crítica aberta','ocorrências críticas abertas')+': a etapa afetada não pode ser liberada.', to:base+'ocorrencias'});
  var venc=ocs.filter(vencidaOc);
  if(venc.length){
    var esc_=venc.filter(function(x){ return atrasoOc(x)>dias; });
    A.push({k:esc_.length?'crit':'warn', t:plural(venc.length,'apontamento vencido','apontamentos vencidos')+(esc_.length?'; '+plural(esc_.length,'está','estão')+' há mais de '+dias+' dias e deve(m) ir à diretoria.':'. Cobrar o prestador.'), to:base+'ocorrencias'});
  }
  if(ppcAbaixo2(oid,meta)) A.push({k:'warn', t:'PPC abaixo da meta de '+meta+'% em duas semanas seguidas: replanejar e avisar o cliente.', to:base+'semana'});
  var atr=byObra('atividades',oid).filter(atAtrasada);
  if(atr.length) A.push({k:'warn', t:plural(atr.length,'atividade atrasada','atividades atrasadas')+' no cronograma.', to:base+'cronograma'});
  return A.concat(alertasP2(o));
}

/* ---------- diálogos e formulários ---------- */
function dlgEl(){ return document.getElementById('dlg'); }
function openDlg(html, wide){
  var d=dlgEl(); d.className=wide?'wide':''; d.innerHTML=html;
  if(!d.open) d.showModal();
  return d;
}
function closeDlg(){ var d=dlgEl(); if(d.open) d.close(); }

function fldHtml(f){
  var id='f_'+f.name, v=f.value, lab='', ctl='', hint=f.hint?'<div class="hint">'+esc(f.hint)+'</div>':'';
  var grp=(f.type==='radio'||f.type==='photos'||f.type==='efetivo'||f.type==='anexos');
  if(f.label) lab=grp?'<div class="lb">'+esc(f.label)+(f.required?' *':'')+'</div>':'<label for="'+id+'">'+esc(f.label)+(f.required?' *':'')+'</label>';
  var req=f.required?' required':'';
  if(f.type==='textarea') ctl='<textarea id="'+id+'" name="'+f.name+'" rows="'+(f.rows||3)+'"'+req+' placeholder="'+esc(f.ph||'')+'">'+esc(v||'')+'</textarea>';
  else if(f.type==='select') ctl='<select id="'+id+'" name="'+f.name+'"'+req+'>'+(f.options||[]).map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(v==null?'':v)?' selected':'')+(o[2]?' disabled':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select>';
  else if(f.type==='radio') ctl='<div class="seg-opts">'+(f.options||[]).map(function(o){ return '<label><input type="radio" name="'+f.name+'" value="'+esc(o[0])+'"'+(String(o[0])===String(v==null?'':v)?' checked':'')+req+'> '+esc(o[1])+'</label>'; }).join('')+'</div>';
  else if(f.type==='photos') ctl='<input type="file" name="'+f.name+'_new" accept="image/*" multiple><div class="thumbs edit" data-photos="'+f.name+'">'+(v||[]).map(function(x){ return '<span class="rm" data-id="'+esc(x)+'"><img src="'+esc(blobUrl(x))+'" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:4px;border:1px solid var(--line)"><button type="button" class="x" data-rm="'+esc(x)+'" aria-label="Remover foto">×</button></span>'; }).join('')+'</div>';
  else if(f.type==='anexos') ctl='<input type="file" name="'+f.name+'_new" accept="image/*,application/pdf" multiple><div class="row" data-anex="'+f.name+'" style="gap:6px;margin-top:8px">'+(v||[]).map(function(x){ return '<span class="chip" data-id="'+esc(x.id)+'">'+esc(short(x.n||'Arquivo',26))+' <button type="button" class="linkbtn" style="display:inline;color:var(--crit)" data-rmx="'+esc(x.id)+'" aria-label="Remover arquivo">×</button></span>'; }).join('')+'</div>';
  else if(f.type==='efetivo') ctl='<div data-efet="'+f.name+'">'+(v&&v.length?v:[{}]).map(function(r){ return efRow(f,r); }).join('')+'</div><button type="button" class="btn sm" data-addrow="'+f.name+'">+ Adicionar prestador</button>';
  else ctl='<input id="'+id+'" name="'+f.name+'" type="'+(f.type||'text')+'" value="'+esc(v==null?'':v)+'"'+req+(f.min!=null?' min="'+f.min+'"':'')+(f.max!=null?' max="'+f.max+'"':'')+(f.step?' step="'+f.step+'"':'')+' placeholder="'+esc(f.ph||'')+'"'+(f.type==='number'?' inputmode="decimal"':'')+'>';
  return '<div class="fld" data-fld="'+f.name+'">'+lab+ctl+hint+'</div>';
}
function efRow(f,r){
  return '<div class="efet-row"><select name="ef_p">'+(f.options||[]).map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0]===r.p?' selected':'')+(o[2]?' disabled':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select><input name="ef_q" type="number" min="1" step="1" inputmode="numeric" value="'+esc(r.q||1)+'" aria-label="Quantidade"><button type="button" class="btn ghost sm" data-delrow aria-label="Remover linha">×</button></div>';
}

var _assets;
async function getAssets(){
  if(_assets!==undefined) return _assets;
  if(Store.backend==='supabase'){ _assets=Supa.assets(); return _assets; }
  try{ _assets=(window.claude && await window.claude.use('assets')) || null; }catch(e){ _assets=null; }
  return _assets;
}
async function shrink(file){
  try{
    var bmp=await createImageBitmap(file);
    var s=Math.min(1, 1600/Math.max(bmp.width,bmp.height));
    var c=document.createElement('canvas'); c.width=Math.round(bmp.width*s); c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    var b=await new Promise(function(r){ c.toBlob(r,'image/jpeg',0.8); });
    return b||file;
  }catch(e){ return file; }
}
async function uploadFiles(files){
  var out=[]; if(!files||!files.length) return out;
  var a=await getAssets();
  if(!a){ toast('O envio de fotos não está disponível para o seu acesso.', true); return out; }
  for(var i=0;i<files.length;i++){
    try{ var b=await shrink(files[i]); var r=await a.upload(b); out.push(r.id); }
    catch(e){ toast('Falha ao enviar uma foto ('+(e&&e.code||'erro')+').', true); }
  }
  return out;
}

async function uploadAnexos(files){
  var out=[]; if(!files||!files.length) return out;
  var a=await getAssets();
  if(!a){ toast('O envio de arquivos não está disponível para o seu acesso.', true); return out; }
  for(var i=0;i<files.length;i++){
    try{ var f=files[i], pdf=f.type==='application/pdf', b=pdf?f:await shrink(f); var r=await a.upload(b); out.push({id:r.id, n:f.name, pdf:pdf}); }
    catch(e){ toast('Falha ao enviar um arquivo ('+(e&&e.code||'erro')+').', true); }
  }
  return out;
}

function openForm(cfg){
  var flat=[]; (cfg.fields||[]).forEach(function(f){ if(Array.isArray(f)) f.forEach(function(x){ flat.push(x); }); else flat.push(f); });
  var body=(cfg.fields||[]).map(function(f){ return Array.isArray(f)?'<div class="fld2">'+f.map(fldHtml).join('')+'</div>':fldHtml(f); }).join('');
  var html='<form id="dform"><div class="dlg-h"><h2>'+esc(cfg.title)+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div>'
    +'<div class="dlg-b">'+(cfg.intro?'<p class="muted small" style="margin-bottom:14px">'+cfg.intro+'</p>':'')+body+'<div class="err-msg hide" id="derr" role="alert"></div></div>'
    +'<div class="dlg-f">'+(cfg.extra||'')+'<button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary" id="dsub">'+esc(cfg.submit||'Salvar')+'</button></div></form>';
  var d=openDlg(html, cfg.wide);
  var form=$('#dform',d), photos={};
  flat.forEach(function(f){ if(f.type==='photos') photos[f.name]=(f.value||[]).slice(); });
  var anex={}; flat.forEach(function(f){ if(f.type==='anexos') anex[f.name]=(f.value||[]).slice(); });
  form.addEventListener('click', function(e){
    var rm=e.target.closest('[data-rm]');
    if(rm){ var holder=rm.closest('[data-photos]'); var nm=holder.dataset.photos; photos[nm]=photos[nm].filter(function(x){ return x!==rm.dataset.rm; }); rm.closest('.rm').remove(); return; }
    var rmx=e.target.closest('[data-rmx]');
    if(rmx){ var h2=rmx.closest('[data-anex]'); var nm2=h2.dataset.anex; anex[nm2]=anex[nm2].filter(function(x){ return x.id!==rmx.dataset.rmx; }); rmx.closest('.chip').remove(); return; }
    var add=e.target.closest('[data-addrow]');
    if(add){
      var f=flat.filter(function(x){ return x.name===add.dataset.addrow; })[0];
      var holder2=form.querySelector('[data-efet="'+add.dataset.addrow+'"]');
      var tmp=document.createElement('div'); tmp.innerHTML=efRow(f,{}); holder2.appendChild(tmp.firstChild); return;
    }
    var del=e.target.closest('[data-delrow]');
    if(del){ var row=del.closest('.efet-row'); if(row.parentNode.children.length>1) row.remove(); }
  });
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var err=$('#derr',form), btn=$('#dsub',form);
    err.classList.add('hide');
    btn.disabled=true; var old=btn.textContent; btn.textContent='Salvando…';
    try{
      var fd=new FormData(form), vals={};
      for(var i=0;i<flat.length;i++){
        var f=flat[i];
        if(f.type==='photos'){
          var inp=form.querySelector('input[name="'+f.name+'_new"]');
          var novos=await uploadFiles(inp&&inp.files);
          vals[f.name]=photos[f.name].concat(novos);
        } else if(f.type==='anexos'){
          var inpA=form.querySelector('input[name="'+f.name+'_new"]');
          var novosA=await uploadAnexos(inpA&&inpA.files);
          vals[f.name]=anex[f.name].concat(novosA);
        } else if(f.type==='efetivo'){
          var rows=Array.prototype.slice.call(form.querySelectorAll('[data-efet="'+f.name+'"] .efet-row'));
          vals[f.name]=rows.map(function(r){ return {p:r.querySelector('[name="ef_p"]').value, q:Number(r.querySelector('[name="ef_q"]').value)||1}; }).filter(function(r){ return r.p; });
        } else {
          var v=fd.get(f.name);
          if(f.type==='number') v=(v===''||v==null)?null:Number(v);
          vals[f.name]=v;
        }
      }
      var res=await cfg.onSubmit(vals);
      if(typeof res==='string'){ err.textContent=res; err.classList.remove('hide'); btn.disabled=false; btn.textContent=old; return; }
      if(res!==false) closeDlg();
    }catch(ex){
      err.textContent='Não foi possível salvar: '+(ex&&ex.message||'erro inesperado'); err.classList.remove('hide');
      btn.disabled=false; btn.textContent=old;
    }
  });
  var first=form.querySelector('input:not([type=hidden]),select,textarea'); if(first && cfg.focus!==false) setTimeout(function(){ try{ first.focus(); }catch(e){} },30);
  return d;
}
function confirmDlg(title, msg, okLabel, danger){
  return new Promise(function(res){
    var d=openDlg('<div class="dlg-h"><h2>'+esc(title)+'</h2></div><div class="dlg-b">'+msg+'</div><div class="dlg-f"><button class="btn" data-x="0">Cancelar</button><button class="btn '+(danger?'danger':'primary')+'" data-x="1">'+esc(okLabel||'Confirmar')+'</button></div>');
    var h=function(e){ var b=e.target.closest('[data-x]'); if(!b) return; d.removeEventListener('click',h); d.removeEventListener('close',c); closeDlg(); res(b.dataset.x==='1'); };
    var c=function(){ d.removeEventListener('click',h); res(false); };
    d.addEventListener('click',h); d.addEventListener('close',c,{once:true});
  });
}
function blockDlg(title, motivos, intro){
  openDlg('<div class="dlg-h"><h2>'+esc(title)+'</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b"><div class="callout crit"><strong>'+esc(intro||'Bloqueado pelo protocolo')+'</strong><ul>'+motivos.map(function(m){ return '<li>'+esc(m)+'</li>'; }).join('')+'</ul></div></div><div class="dlg-f"><button class="btn primary" data-close>Entendi</button></div>');
}
function lightbox(id){
  openDlg('<div class="dlg-h"><h2>Foto</h2><button type="button" class="btn ghost ico" data-close aria-label="Fechar">✕</button></div><div class="dlg-b lightbox"><img src="'+esc(blobUrl(id))+'" alt="Foto registrada em campo"></div>', true);
}
function thumbs(ids){
  if(!ids||!ids.length) return '';
  return '<div class="thumbs">'+ids.map(function(i){ return '<button type="button" data-act="foto" data-id="'+esc(i)+'" aria-label="Ampliar foto"><img loading="lazy" src="'+esc(blobUrl(i))+'" alt=""></button>'; }).join('')+'</div>';
}

