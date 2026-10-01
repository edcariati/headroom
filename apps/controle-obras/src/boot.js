async function boot(){
  applyTheme(); render();
  window.addEventListener('hashchange', render);
  offRegistrarSW();
  await Store.init();
  render();
}
COBX.Store=Store; COBX.Supa=Supa;
if(window.__COB_TEST_HOOK) window.__COB_TEST_HOOK(COBX);
boot();
