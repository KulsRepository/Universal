// Here I loaded the librariess :$ they are all used here. The matrix and linear algebra are all in core.
const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.js',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Algebra.js',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Calculus.js',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Solve.js',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Extra.js',
];
// Here's the promise wrapper + the error catcher
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
}

// We ensure that everything is loaded before moving on--this was the biggest cause before

async function loadNerdamer() {
  const dot = document.getElementById('dot');
  const txt = document.getElementById('status-text');
  try {
    for (const src of SCRIPTS) await loadScript(src);
    dot.classList.add('ready');
    txt.textContent = 'nerdamer ready';
    document.getElementById('expr-input').disabled = false;
    document.getElementById('run-btn').disabled = false;
  } catch(e) {
    dot.classList.add('error');
    txt.textContent = 'failed to load nerdamer';
  }
}
loadNerdamer();