async function boot(){
  applyTheme(); render();
  window.addEventListener('hashchange', render);
  await Store.init();
  render();
}
boot();
