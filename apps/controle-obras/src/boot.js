async function boot(){
  applyTheme(); render();
  window.addEventListener('hashchange', render);
  await Store.init();
  render();
}
if(window.__COB_TEST_HOOK) window.__COB_TEST_HOOK(COBX);
boot();
