/* ================= NUVEM, LOGIN E HISTÓRICO ================= */
var COL_NOMES={obras:'Obra', etapas:'Etapa', atividades:'Atividade', pacotes:'Pacote semanal', diarios:'Diário', fichas:'Ficha de verificação', ocorrencias:'Ocorrência', prestadores:'Prestador', eventos:'Agenda', atas:'Ata', acoes:'Ação', docsLegais:'Documento legal', docsPrest:'Documento de prestador', rfis:'Consulta técnica', materiais:'Material', locs:'Local', servicos:'Serviço', treinamentos:'Treinamento', fornecedores:'Fornecedor', compras:'Compra', movEstoque:'Estoque', locacoes:'Locação', contratosPrest:'Contrato', termos:'Termo', danos:'Dano', orcamentos:'Orçamento (versão)', orcItens:'Itens do orçamento', aditivos:'Aditivo', medicoes:'Medição', contasPagar:'Conta a pagar', aportes:'Aporte do cliente', empresas:'Empresa', contratosCliente:'Contrato do cliente', lancamentos:'Lançamento', relatorios:'Relatório mensal', avaliacoes:'Avaliação de prestador', licoes:'Lição aprendida', config:'Configuração'};
var hist={rows:null, carregando:false, erro:'', obra:'', colecao:''};

function vLogin(){
  var c=Supa.cfg||{};
  return '<div class="wrap"><div class="login"><p class="brand" style="font-size:22px;margin-bottom:14px">Cariati<span>·Obras</span></p>'
    +'<form class="card" id="flogin"><h2 style="margin-bottom:6px">Entrar</h2><p class="muted small" style="margin-bottom:16px">Use o e-mail e a senha cadastrados pela Cariati.</p>'
    +'<div class="fld"><label for="lg_e">E-mail</label><input id="lg_e" name="email" type="email" autocomplete="username" required></div>'
    +'<div class="fld"><label for="lg_s">Senha</label><input id="lg_s" name="senha" type="password" autocomplete="current-password" required></div>'
    +'<div class="err-msg hide" id="lg_err" role="alert"></div>'
    +'<div class="row spread" style="margin-top:8px"><button type="button" class="btn ghost sm" data-act="login-esqueci">Esqueci a senha</button><button type="submit" class="btn primary">Entrar</button></div></form>'
    +'<div class="row spread muted tiny" style="margin-top:12px;gap:6px"><span>Banco: <code class="k">'+esc((c.url||'').replace(/^https:\/\//,''))+'</code></span><button type="button" class="btn ghost sm" data-act="nuvem-desconectar">Trocar de banco</button></div></div></div>';
}

function vNuvem(){
  var c=Supa.config()||{}, sb=Store.backend==='supabase', h='';
  h+='<div class="wrap"><h1>Nuvem</h1><p class="muted" style="margin-top:4px">Onde os dados das obras ficam guardados.</p>';
  if(sb) h+='<div class="callout ok sec"><strong>Conectado ao Supabase.</strong> Os dados são compartilhados com a equipe, as fotos ficam no armazenamento da nuvem e cada alteração vai para o <a href="#/historico">histórico</a>.<br><span class="small">Você entrou como <strong>'+esc(Supa.email())+'</strong>.</span></div>';
  else if(Store.backend==='claude') h+='<div class="callout ok sec">Rodando dentro do Claude, com o banco do Artifact.</div>';
  else h+='<div class="callout sec"><strong>Modo local.</strong> Os dados ficam só neste navegador. Conecte ao Supabase para compartilhar com a equipe e guardar o histórico.'+(Store.supaErro?'<br><span class="small">Última tentativa de conexão falhou: '+esc({sem_biblioteca:'a biblioteca do Supabase não carregou (confira a internet)', config_invalida:'endereço ou chave inválidos', offline:'sem conexão com o servidor'}[Store.supaErro]||Store.supaErro)+'.</span>':'')+'</div>';

  h+='<section class="card sec"><div class="card-h"><h2>Conexão com o Supabase</h2></div><form id="fnuvem" class="pad">'
    +'<div class="fld"><label for="nv_u">URL do projeto</label><input id="nv_u" name="url" type="url" placeholder="https://xxxxxxxx.supabase.co" value="'+esc(c.url||'')+'" required><div class="hint">Supabase → Project Settings → API → Project URL.</div></div>'
    +'<div class="fld"><label for="nv_k">Chave pública (anon / publishable)</label><input id="nv_k" name="key" type="text" autocomplete="off" spellcheck="false" placeholder="eyJhbGciOi… ou sb_publishable_…" value="'+esc(c.key||'')+'" required><div class="hint">Use só a chave pública. Nunca a service_role/secret.</div></div>'
    +'<div class="row" style="justify-content:flex-end">'+(c.url?'<button type="button" class="btn danger" data-act="nuvem-desconectar">Desconectar</button>':'')+'<button type="submit" class="btn primary">Salvar e conectar</button></div></form></section>';

  if(sb){
    var locais=contarLocais();
    h+='<section class="card sec"><div class="card-h"><h2>Trazer dados para a nuvem</h2></div><div class="pad stack">'
      +'<div class="row spread"><div class="grow"><strong>Dados deste navegador</strong><p class="muted small">'+(locais?plural(locais,'registro salvo','registros salvos')+' em modo local neste aparelho.':'Nenhum dado local encontrado neste aparelho.')+'</p></div><button class="btn" data-act="nuvem-enviar-local"'+(locais?'':' disabled')+'>Enviar para a nuvem</button></div>'
      +'<div class="row spread"><div class="grow"><strong>Arquivo exportado (.json)</strong><p class="muted small">Cópia gerada pelo botão Exportar, aqui ou no Artifact do Claude.</p></div><label class="btn">Importar arquivo<input type="file" accept="application/json,.json" data-chg="importar" hidden></label></div>'
      +'</div></section>'
      +'<section class="card sec"><div class="card-h"><h2>Sessão</h2></div><div class="pad row spread"><span class="muted">'+esc(Supa.email())+'</span><button class="btn" data-act="nuvem-sair">Sair</button></div></section>';
  } else if(!c.url){
    h+='<section class="card sec pad"><h3>Como criar o banco</h3><ol class="small" style="margin:8px 0 0;padding-left:18px;line-height:1.7">'
      +'<li>Crie um projeto grátis em <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>'
      +'<li>No <strong>SQL Editor</strong>, rode o arquivo <code class="k">supabase/schema.sql</code> que está junto do aplicativo.</li>'
      +'<li>Em <strong>Authentication → Users</strong>, cadastre o e-mail e a senha de cada pessoa da equipe.</li>'
      +'<li>Copie a URL e a chave pública em <strong>Project Settings → API</strong> e cole acima.</li></ol></section>';
  }
  return h+'</div>';
}
function contarLocais(){ var n=0; COLS.forEach(function(c){ try{ var raw=localStorage.getItem('cob.'+c); if(raw) n+=JSON.parse(raw).length; }catch(e){} }); return n; }

function histLabel(c, d, id){
  d=d||{};
  if(c==='etapas'){ var e=etapaInfo(Number(d.n)); return 'Etapa '+(d.n||'')+(e?' — '+e.nome:''); }
  if(c==='fichas' && d.n){ var e2=etapaInfo(Number(d.n)); var v=e2&&e2.verif&&e2.verif[Number(d.i)]; return (v?v.item:'Ficha')+' (etapa '+d.n+')'; }
  return d.nome||d.titulo||d.item||d.descricao||d.assunto||d.pauta||d.trabalhador||d.norma||d.tipo||id;
}
function histResumo(x){
  var a=x.dados_antes||{}, b=x.dados_depois||{}, out=[];
  if(x.acao!=='alterado') return '';
  if(a.status!==b.status && (a.status||b.status)) out.push('situação: '+(a.status||'—').replace(/_/g,' ')+' → '+(b.status||'—').replace(/_/g,' '));
  var ks={}; Object.keys(a).concat(Object.keys(b)).forEach(function(k){ ks[k]=1; });
  var mud=Object.keys(ks).filter(function(k){ return k!=='status' && JSON.stringify(a[k])!==JSON.stringify(b[k]); });
  if(mud.length) out.push('campos alterados: '+mud.slice(0,6).join(', ')+(mud.length>6?'…':''));
  return out.join(' · ');
}
async function carregarHist(){
  if(hist.carregando) return; hist.carregando=true; hist.erro=''; scheduleRender();
  try{
    if(Supa.v2()){
      var ra=sbErr(await Supa.cli.from('auditoria').select('id,tabela,registro_id,acao,antes,depois,user_id,em').order('em',{ascending:false}).limit(500)), AC2={insert:'criado', update:'alterado', excluir:'excluido'};
      hist.rows=(ra.data||[]).map(function(x){ return {hid:x.id, colecao:x.tabela, registro_id:x.registro_id, acao:AC2[x.acao]||'alterado', dados_antes:x.antes?x.antes.dados:null, dados_depois:x.depois?x.depois.dados:null, feito_em:x.em, feito_por_email:x.user_id?String(x.user_id).slice(0,8):'sistema'}; });
    } else {
      var r=sbErr(await Supa.cli.from('registros_historico').select('*').order('feito_em',{ascending:false}).limit(500));
      hist.rows=r.data||[];
    }
  }catch(e){ hist.erro=e.message||'erro'; hist.rows=hist.rows||[]; }
  hist.carregando=false; scheduleRender();
}
function vSemAcesso(){
  return '<div class="wrap"><div class="login"><p class="brand" style="font-size:22px;margin-bottom:14px">Cariati<span>·Obras</span></p><div class="card empty"><h3>Seu acesso ainda não foi liberado</h3><p>Você entrou como '+esc(Supa.email())+', mas a diretoria ainda não definiu o seu perfil. Fale com a Cariati.</p><button class="btn" data-act="nuvem-sair">Sair</button></div></div></div>';
}
function vHistorico(){
  if(Store.backend!=='supabase') return '<div class="wrap"><div class="card empty"><h3>Histórico disponível na nuvem</h3><p>Conecte o aplicativo ao Supabase para registrar quem alterou o quê. <a href="#/nuvem">Conectar</a></p></div></div>';
  if(hist.rows===null && !hist.carregando) setTimeout(carregarHist,0);
  var obras=L('obras').sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
  var rows=(hist.rows||[]).filter(function(x){
    var d=x.dados_depois||x.dados_antes||{};
    if(hist.obra && !(d.obraId===hist.obra || (x.colecao==='obras' && x.registro_id===hist.obra))) return false;
    if(hist.colecao && x.colecao!==hist.colecao) return false;
    return true;
  });
  var h='<div class="wrap"><div class="sec-h"><div><h1>Histórico</h1><p class="muted" style="margin-top:4px">Tudo o que foi criado, alterado ou excluído, com quem fez e quando.</p></div><button class="btn" data-act="hist-atualizar">Atualizar</button></div>'
    +'<div class="row sec" style="margin-top:14px"><div class="fld" style="margin:0;min-width:220px"><select data-chg="hist-obra" aria-label="Filtrar por obra"><option value="">Todas as obras</option>'+obras.map(function(o){ return '<option value="'+esc(o.id)+'"'+(hist.obra===o.id?' selected':'')+'>'+esc(o.nome)+'</option>'; }).join('')+'</select></div>'
    +'<div class="fld" style="margin:0;min-width:200px"><select data-chg="hist-col" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>'+Object.keys(COL_NOMES).map(function(k){ return '<option value="'+k+'"'+(hist.colecao===k?' selected':'')+'>'+esc(COL_NOMES[k])+'</option>'; }).join('')+'</select></div></div>';
  if(hist.erro) h+='<div class="callout crit sec">Não foi possível carregar o histórico: '+esc(hist.erro)+'</div>';
  if(hist.rows===null || (hist.carregando && !hist.rows.length)) return h+'<div class="card sec"><p class="empty">Carregando histórico…</p></div></div>';
  if(!rows.length) return h+'<div class="card sec empty"><h3>Nada registrado ainda</h3><p>As próximas alterações aparecem aqui.</p></div></div>';
  var AC={criado:['ok','Criado'], alterado:['steel','Alterado'], excluido:['crit','Excluído']};
  h+='<section class="card sec"><ul class="hist">'+rows.map(function(x){
    var d=x.dados_depois||x.dados_antes||{}, ac=AC[x.acao]||['','?'], dt=new Date(x.feito_em);
    var quando=pad(dt.getDate())+'/'+pad(dt.getMonth()+1)+'/'+dt.getFullYear()+' '+pad(dt.getHours())+':'+pad(dt.getMinutes());
    var ob=d.obraId?G('obras',d.obraId):null, res=histResumo(x);
    var pode=x.acao!=='criado' && x.dados_antes && Store.writable && !Supa.v2();
    return '<li><div class="q">'+quando+'<br>'+esc(x.feito_por_email||'sistema')+'</div>'
      +'<div><div class="row" style="gap:6px"><span class="chip '+ac[0]+'">'+ac[1]+'</span><span class="chip">'+esc(COL_NOMES[x.colecao]||x.colecao)+'</span></div>'
      +'<div style="margin-top:4px;font-weight:500">'+esc(short(histLabel(x.colecao,d,x.registro_id),90))+'</div>'
      +(ob?'<div class="d">'+esc(ob.nome)+'</div>':'')+(res?'<div class="d">'+esc(res)+'</div>':'')+'</div>'
      +'<div class="row">'+(pode?'<button class="btn sm" data-write data-act="hist-restaurar" data-hid="'+x.hid+'">Restaurar versão anterior</button>':'')+'</div></li>';
  }).join('')+'</ul></section>'+(hist.rows.length>=500?'<p class="muted small" style="margin-top:8px">Mostrando as 500 alterações mais recentes.</p>':'');
  return h+'</div>';
}

async function importarDados(colecoes, origem){
  var rows=[];
  COLS.forEach(function(c){
    var v=colecoes[c]; if(!v) return;
    var lista=Array.isArray(v)?v:[];
    lista.forEach(function(it){
      var id, d;
      if(Array.isArray(it)){ id=it[0]; d=it[1]; } else { id=it.id; d=Object.assign({},it); delete d.id; }
      if(id) rows.push({colecao:c, id:String(id), dados:d||{}});
    });
  });
  if(!rows.length){ toast('Nenhum registro encontrado em '+origem+'.', true); return; }
  var ok=await confirmDlg('Enviar '+plural(rows.length,'registro','registros')+'?','<p>Os dados de '+esc(origem)+' vão para a nuvem. Registros com o mesmo identificador serão substituídos, e a versão anterior fica no histórico.</p>','Enviar');
  if(!ok) return;
  try{
    await Supa.upsertMany(rows);
    rows.forEach(function(r){ Store.data[r.colecao].set(r.id, r.dados); });
    hist.rows=null; scheduleRender(); toast(plural(rows.length,'registro enviado','registros enviados')+' para a nuvem.');
  }catch(e){ toast('Falha ao enviar ('+(e.code||e.message)+').', true); }
}

var ANuvem={
  'nuvem-desconectar':async function(){
    var ok=await confirmDlg('Desconectar da nuvem?','<p>Este aparelho volta ao modo local. Os dados na nuvem continuam guardados.</p>','Desconectar',true);
    if(!ok) return;
    try{ if(Supa.cli) await Supa.cli.auth.signOut(); }catch(e){}
    Supa.saveConfig(null); location.hash='#/nuvem'; location.reload();
  },
  'aviso-lido':function(d){ Notif.marcar([Number(d.id)]); },
  'aviso-abrir':function(d){ Notif.marcar([Number(d.id)]); },
  'avisos-todos':function(){ Notif.marcar(Notif.rows.filter(function(n){ return !n.lida_em; }).map(function(n){ return n.id; })); },
  'nuvem-sair':async function(){ try{ await Supa.cli.auth.signOut(); }catch(e){} location.reload(); },
  'nuvem-enviar-local':function(){
    var cols={}; COLS.forEach(function(c){ try{ var raw=localStorage.getItem('cob.'+c); if(raw) cols[c]=JSON.parse(raw); }catch(e){} });
    importarDados(cols, 'este navegador');
  },
  'hist-atualizar':function(){ carregarHist(); },
  'hist-restaurar':async function(d){
    var x=(hist.rows||[]).filter(function(r){ return String(r.hid)===String(d.hid); })[0]; if(!x||!x.dados_antes) return;
    var ok=await confirmDlg('Restaurar versão anterior?','<p>“'+esc(short(histLabel(x.colecao,x.dados_antes,x.registro_id),80))+'” volta a ficar como estava antes desta alteração. A versão atual continua no histórico.</p>','Restaurar');
    if(!ok) return;
    await Store.set(x.colecao, x.registro_id, x.dados_antes); toast('Versão restaurada.'); setTimeout(carregarHist, 400);
  },
  'login-esqueci':async function(){
    var em=(($('#lg_e')||{}).value||'').trim(); if(!em){ toast('Digite seu e-mail primeiro.', true); return; }
    var r=await Supa.cli.auth.resetPasswordForEmail(em, {redirectTo:location.href.split('#')[0]});
    toast(r.error?'Não foi possível enviar ('+r.error.message+').':'Enviamos um link para redefinir a senha.', !!r.error);
  }
};
document.addEventListener('submit', async function(e){
  var f=e.target;
  if(f.id==='flogin'){
    e.preventDefault();
    var err=$('#lg_err'), btn=f.querySelector('[type=submit]'); err.classList.add('hide'); btn.disabled=true;
    var r=await Supa.cli.auth.signInWithPassword({email:f.email.value.trim(), password:f.senha.value});
    if(r.error){ btn.disabled=false; err.textContent=/invalid/i.test(r.error.message)?'E-mail ou senha incorretos.':r.error.message; err.classList.remove('hide'); return; }
    location.reload();
  }
  if(f.id==='fnuvem'){
    e.preventDefault();
    var url=f.url.value.trim().replace(/\/+$/,''), key=f.key.value.trim();
    if(!/^https:\/\/.+/.test(url)){ toast('A URL precisa começar com https://', true); return; }
    if(/service_role|sb_secret_/.test(key) || (function(){ try{ return JSON.parse(atob(key.split('.')[1])).role==='service_role'; }catch(x){ return false; } })()){ toast('Essa é a chave secreta. Use a chave pública (anon/publishable).', true); return; }
    Supa.saveConfig({url:url, key:key, esquema:(Supa.config()||{}).esquema||'v1'}); location.hash='#/painel'; location.reload();
  }
});
document.addEventListener('change', function(e){
  var el=e.target;
  if(el.matches('[data-chg="hist-obra"]')){ hist.obra=el.value; render(); }
  else if(el.matches('[data-chg="hist-col"]')){ hist.colecao=el.value; render(); }
  else if(el.matches('[data-chg="importar"]')){
    var file=el.files&&el.files[0]; if(!file) return;
    file.text().then(function(t){ var j=JSON.parse(t); importarDados(j.colecoes||j, file.name); }).catch(function(){ toast('Arquivo inválido.', true); });
    el.value='';
  }
});


/* ---------- central de avisos (notificações dentro do app; esquema v2) ---------- */
var Notif={ rows:[], ok:false, erro:'',
  ativo:function(){ return Store.backend==='supabase' && Supa.v2(); },
  naoLidas:function(){ return this.rows.filter(function(n){ return !n.lida_em; }).length; },
  carregar:async function(){
    try{
      var r=sbErr(await Supa.cli.from('notificacoes').select('id,tipo,titulo,corpo,link,critico,criada_em,lida_em').order('criada_em',{ascending:false}).limit(100));
      this.rows=r.data||[]; this.ok=true; this.erro='';
    }catch(e){ this.erro=e.message||'erro'; }
    scheduleRender();
  },
  iniciar:function(){
    if(!this.ativo()) return;
    var self=this, ch=Supa.cli.channel('avisos-app').on('postgres_changes', {event:'*', schema:'public', table:'notificacoes'}, function(){ self.carregar(); }).subscribe();
    Store.unsubs.push(function(){ Supa.cli.removeChannel(ch); });
    return this.carregar();
  },
  marcar:async function(ids){
    if(!ids.length) return;
    var agora=new Date().toISOString();
    this.rows.forEach(function(n){ if(ids.indexOf(n.id)>=0) n.lida_em=agora; });
    scheduleRender();
    try{ sbErr(await Supa.cli.from('notificacoes').update({lida_em:agora}).in('id', ids)); }
    catch(e){ toast('Não foi possível marcar como lido. Tente de novo.', true); this.carregar(); }
  }
};
function sinoAvisos(r){
  if(!Notif.ativo()) return '';
  var n=Notif.naoLidas();
  return '<a class="btn ghost sm" href="#/avisos"'+(r&&r.view==='avisos'?' aria-current="page"':'')+' title="Avisos" aria-label="Avisos'+(n?', '+n+' não lidos':'')+'">🔔'+(n?' <span class="chip crit" style="margin-left:2px">'+n+'</span>':'')+'</a>';
}
function quandoAviso(iso){ var d=new Date(iso); return isNaN(d)?'':pad(d.getDate())+'/'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
function vAvisos(){
  if(!Notif.ativo()) return '<div class="wrap"><div class="card empty"><h3>Avisos disponíveis na nuvem</h3><p>Conecte o aplicativo ao Supabase para receber avisos das obras. <a href="#/nuvem">Conectar</a></p></div></div>';
  var h='<div class="wrap"><div class="sec-h"><div><h1>Avisos</h1><p class="muted" style="margin-top:4px">O que precisa da sua atenção nas obras. Cada aviso aparece uma vez.</p></div>'
    +(Notif.naoLidas()?'<button class="btn" data-act="avisos-todos">Marcar tudo como lido</button>':'')+'</div>';
  if(Notif.erro) h+='<div class="callout crit sec">Não foi possível carregar os avisos: '+esc(Notif.erro)+'</div>';
  if(!Notif.ok && !Notif.erro) return h+'<div class="card sec"><p class="empty">Carregando avisos…</p></div></div>';
  if(!Notif.rows.length) return h+'<div class="card sec empty"><h3>Nenhum aviso por enquanto</h3><p>Quando algo vencer ou ficar crítico, aparece aqui.</p></div></div>';
  return h+'<section class="card sec"><ul class="hist">'+Notif.rows.map(function(n){
    return '<li><div class="q">'+quandoAviso(n.criada_em)+'</div><div><div class="row" style="gap:6px">'+(n.critico?'<span class="chip crit">Crítico</span>':'')+(n.lida_em?'':'<span class="chip steel">Novo</span>')+'</div>'
      +'<div style="margin-top:4px;font-weight:'+(n.lida_em?'400':'600')+'">'+esc(n.titulo)+'</div>'+(n.corpo?'<div class="d">'+esc(n.corpo)+'</div>':'')+'</div>'
      +'<div class="row">'+(n.link?'<a class="btn sm" href="'+esc(n.link)+'" data-act="aviso-abrir" data-id="'+n.id+'">Abrir</a>':'')+(n.lida_em?'':'<button class="btn sm ghost" data-act="aviso-lido" data-id="'+n.id+'">Lido</button>')+'</div></li>';
  }).join('')+'</ul></section></div>';
}
