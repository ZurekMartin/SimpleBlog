(() => {
  const root = document.documentElement;
  root.classList.add('js');
  let saved = null;
  try { saved = localStorage.getItem('sb-theme'); } catch {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
})();
