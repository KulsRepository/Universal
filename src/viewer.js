function syncNerdamerToLatexView() {
  const rawStr = document.getElementById('expr-input').value;
  
  document.getElementById('expr-input-debug').value = rawStr;
  
  const view = document.getElementById('expr-view-container');
  if (!rawStr.trim()) {
    view.innerHTML = '<span class="expr-view-placeholder">type or use the keyboard below…</span>';
    return;
  }
  
  const latex = mapNerdamerToLatexPrompt(rawStr);
  
  view.innerHTML = '';
  const mathSpan = document.createElement('span');
  try {
    katex.render(latex, mathSpan, { throwOnError: false, displayMode: false });
    view.appendChild(mathSpan);
  } catch(e) {
    view.textContent = rawStr;
  }
}

buildKeyboard();

function matrixRowsToLatex(rows) {
  const cell = (c) => {
    try { return nerdamer(c).toTeX(); } catch(e) { return convertToLatex(c); }
  };
  return '\\begin{pmatrix}'
    + rows.map(row => row.map(cell).join(' & ')).join(' \\\\ ')
    + '\\end{pmatrix}';
}

// Makes it LaTeX -> user readable. We want both a LaTeX version AND a "normal" text one which we can use as an input
function toLatex(expr) {
  if (!expr || typeof expr !== 'string') return '';
  let s = expr.trim();

  if (s === 'No Real Solutions') return '\\text{No Real Solutions}';

  const matrixRows = parseMatrixRows(s);
  if (matrixRows) {
    return matrixRowsToLatex(maybeSquareMatrixRows(matrixRows));
  }

  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1).trim();
  }
  if (s === '') return '\\varnothing';

  const parts = splitTopLevel(s, ',');
  if (parts.length > 1) {
    return parts.map(p => {
      try { return nerdamer(p.trim()).toTeX(); } catch(e) { return convertToLatex(p.trim()); }
    }).join(',\\;');
  }

  try {
    return nerdamer(s).toTeX();
  } catch(e) {
    return convertToLatex(s);
  }
}

function convertToLatex(s) {
  s = convertFractions(s);
  s = convertPowers(s);

  const funcMap = [
    ['asin',     '\\arcsin '],
    ['acos',     '\\arccos '],
    ['atan',     '\\arctan '],
    ['sinh',     '\\sinh '],
    ['cosh',     '\\cosh '],
    ['tanh',     '\\tanh '],
    ['sin',      '\\sin '],
    ['cos',      '\\cos '],
    ['tan',      '\\tan '],
    ['cot',      '\\cot '],
    ['sec',      '\\sec '],
    ['csc',      '\\csc '],
    ['ln',       '\\ln '],
    ['log',      '\\log '],
  ];
  s = s.replace(/sqrt\(([^()]+)\)/g, function(_, inner) { return '\\sqrt{' + inner + '}'; });
  s = s.replace(/abs\(([^()]+)\)/g, function(_, inner) { return '\\left|' + inner + '\\right|'; });
  for (var fi = 0; fi < funcMap.length; fi++) {
    var fname = funcMap[fi][0];
    var flatex = funcMap[fi][1];
    s = s.replace(new RegExp(fname + '(?=[^a-zA-Z]|$)', 'g'), flatex);
  }

  s = s.replace(/([a-zA-Z0-9})\]])\*([a-zA-Z0-9({\\])/g, function(_, a, b) {
    if (/[a-zA-Z]/.test(a) && /[a-zA-Z]/.test(b)) return a + ' ' + b;
    if (/[0-9]/.test(a) && /[a-zA-Z]/.test(b)) return a + ' ' + b;
    return a + ' \\cdot ' + b;
  });

  s = s.replace(/\bpi\b/g, '\\pi ');
  s = s.replace(/\bInfinity\b/g, '\\infty ');
  s = s.replace(/\binf\b/g, '\\infty ');

  return s;
}

function convertPowers(s) {
  return s.replace(/\^(\(([^()]*(\([^()]*\))*[^()]*)\)|\w+)/g, function(match, full) {
    var inner = full.charAt(0) === '(' ? full.slice(1, -1) : full;
    return '^{' + inner + '}';
  });
}

const SF_TRIGGER = 7;
// this ensures fractions are simplified, added a stopper haha
function convertFractions(s) {
  var changed = true, iterations = 0;
  while (changed && iterations++ < 20) {
    var next = replaceFraction(s);
    changed = (next !== s);
    s = next;
  }
  return s;
}
// nerdamer has a difficult time splitting all nominator/denom inputs
function replaceFraction(s) {
  for (var i = 0; i < s.length; i++) {
    if (s[i] === '/') {
      var num = extractLeft(s, i);
      var den = extractRight(s, i);
      if (num && den) {
        var before = s.slice(0, i - num.raw.length);
        var after  = s.slice(i + 1 + den.raw.length);
        return before + '\\frac{' + num.inner + '}{' + den.inner + '}' + after;
      }
    }
  }
  return s;
}

// these two add on top of that by ensuring that the boundaries of the nominator on the left of / and the denom on its right are recognized
function extractLeft(s, slashPos) {
  var i = slashPos - 1;
  if (i < 0) return null;
  if (s[i] === ')') {
    var depth = 0;
    while (i >= 0) {
      if (s[i] === ')') depth++;
      else if (s[i] === '(') { depth--; if (depth === 0) break; }
      i--;
    }
    var raw = s.slice(i, slashPos);
    return { raw: raw, inner: raw.slice(1, -1) };
  }
  var end = slashPos;
  while (i >= 0 && /[a-zA-Z0-9._]/.test(s[i])) i--;
  var raw = s.slice(i + 1, slashPos);
  if (!raw) return null;
  return { raw: raw, inner: raw };
}

function extractRight(s, slashPos) {
  var i = slashPos + 1;
  if (i >= s.length) return null;
  if (s[i] === '(') {
    var depth = 0, start = i;
    while (i < s.length) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) break; }
      i++;
    }
    var raw = s.slice(start, i);
    return { raw: raw, inner: raw.slice(1, -1) };
  }
  var start = i;
  while (i < s.length && /[a-zA-Z0-9._]/.test(s[i])) i++;
  var raw = s.slice(start, i);
  if (!raw) return null;
  return { raw: raw, inner: raw };
}

// standard JS split functions absolutely broke the program, had to ask Gemini to help me with this :)
function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(' || str[i] === '[') depth++;
    else if (str[i] === ')' || str[i] === ']') depth--;
    if (str[i] === sep && depth === 0) { parts.push(cur); cur = ''; }
    else cur += str[i];
  }
  if (cur) parts.push(cur);
  return parts;
}

function runDiagnosticSuite() {
  console.log("%c--- DIAGNOSTIC PIPELINE SUITE INITIATED ---", "color: #e11d48; font-weight: bold;");
  
  const testCases = [
    { name: "1", input: "solve(diff((5x^3+9x^1)^7)=x^3, x)" },
    { name: "2", input: "solve(cos(x) = 0, x)" },
    { name: "3", input: "factor((3*x^2+3)^2)" },
    { name: "4", input: "expand(differentiate(((3*x^2+3*x)^3)))" },
    { name: "5", input: "solve(2*x - 4 = 0, x)" },
    { name: "6", input: "solve(sin(x) = 3, x)"},
    { name: "7", input: "expand((9x^3+7x^5)^1)"}
  ];

  testCases.forEach((tc, idx) => {
    try {
      const out = computeResult(tc.input);
      console.log(`[CASE ${idx + 1}] ${tc.name}\nInput: ${tc.input}\nOutput Result: ${out.finalResult}`);
      
      // Inject directly into the real application results panel layout
      renderEntry(out);
    } catch (e) {
      console.error(`[CASE ${idx + 1}] ${tc.name} Exploded:`, e);
    }
  });

  console.log("%c--- DIAGNOSTIC PIPELINE SUITE COMPLETED ---", "color: #ef4444; font-weight: bold;");
  alert("Diagnostics execution complete! All simulation responses have been loaded directly into the main view.");
}
/** ======================================================================================== **/
// KaTeX is LaTeX for JS :)
function renderKatex(exprStr, displayMode, targetSF) {
  const span = document.createElement('span');
  span.className = 'katex-wrap';
  try {
    katex.render(toLatex(fmtResult(exprStr, targetSF)), span, {
      displayMode: !!displayMode,
      throwOnError: false,
      trust: false,
    });
  } catch(e) {
    span.textContent = exprStr;
  }
  return span;
}
// in case of too many significant figures
function triggersSFNotation(data) {
  const check = (str) => {
    if (!str) return false;
    const matches = str.match(/\d+/g);
    if (!matches) return false;
    return matches.some(m => m.length >= SF_TRIGGER);
  };
  if (check(data.finalResult)) return true;
  return data.steps.some(s => check(s.result));
}
// last layer of the code :) the code is mixed up between the layers to make people have to study it if they want to do smt similar.
function getCleanTextCopyValue(rawOutputString) {
  try {
     return nerdamer(rawOutputString).toExpression().toString();
  } catch(e) {
     return rawOutputString;
  }
}
// I asked gemini to help me with renderEntry; It is arguably the biggest function in this code:
/*
TLDR: it essentially handles the entry into the prompt.

It assigns an onclick listener so that we can copy preset functions to the input -> this tends to break between updates.
It handles LaTeX when typing into the prompt.
It handles the significant figures issues with a per-answer slider.


*/
function renderEntry(data) {
  document.getElementById('empty-msg')?.remove();
  const hist = document.getElementById('history');
  
  const el = document.createElement('div');
  el.className = 'entry';

  el.style.cursor = 'pointer';
  el.title = 'Click to edit this entry';
  el.onclick = () => {
    document.getElementById('expr-input').value = data.raw;
    syncNerdamerToLatexView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const queryDiv = document.createElement('div');
  queryDiv.className = 'entry-query';
  
  const mathSpan = document.createElement('span');
  try {
      katex.render(mapNerdamerToLatexPrompt(data.raw), mathSpan, { throwOnError: false });
  } catch(e) {
      mathSpan.textContent = data.raw;
  }
  queryDiv.appendChild(mathSpan);
  el.appendChild(queryDiv);

  let instanceSF = 3; 
  const parsedTriggersSlider = triggersSFNotation(data);

  let sliderContainer = null;
  if (parsedTriggersSlider) {
    sliderContainer = document.createElement('div');
    sliderContainer.className = 'sf-slider-wrap';
    sliderContainer.innerHTML = `
      <span style="font-size:0.72rem; color:var(--faint); flex-shrink:0;">significant figures</span>
      <input type="range" min="1" max="10" value="${instanceSF}" step="1" style="flex:1; max-width:180px; accent-color:var(--accent);" />
      <span class="sf-display" style="font-size:0.82rem; color:var(--accent); min-width:14px; font-weight:500;">${instanceSF}</span>
      <span style="font-size:0.72rem; color:var(--faint);">— updates long number lengths above</span>
    `;
    el.appendChild(sliderContainer);
  }

  const stepsWrapper = document.createElement('div');
  el.appendChild(stepsWrapper);

  const finalWrapper = document.createElement('div');
  el.appendChild(finalWrapper);
  // this function specifically creates the layout of the steps of the calculation -> WIP it will become more pedagogical later.
  function updateCardDisplays() {
    stepsWrapper.innerHTML = '';
    finalWrapper.innerHTML = '';

    if (data.steps.length > 0) {
      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'steps';
      data.steps.forEach((s, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'step';

        const numEl = document.createElement('div');
        numEl.className = 'step-num';
        numEl.textContent = i + 1;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'step-body';

        const cmdEl = document.createElement('div');
        cmdEl.className = 'step-cmd';
        cmdEl.textContent = s.label;

        const resEl = document.createElement('div');
        resEl.className = 'step-result-latex';
        const eqSpan = document.createElement('span');
        eqSpan.style.cssText = 'color:var(--faint);font-size:0.85rem;margin-right:4px;';
        eqSpan.textContent = '=';
        resEl.appendChild(eqSpan);
        resEl.appendChild(renderKatex(s.result, false, instanceSF));

        const noteEl = document.createElement('div');
        noteEl.className = 'step-note';
        noteEl.textContent = s.note;

        bodyEl.appendChild(cmdEl);
        bodyEl.appendChild(resEl);
        bodyEl.appendChild(noteEl);
        stepEl.appendChild(numEl);
        stepEl.appendChild(bodyEl);
        stepsDiv.appendChild(stepEl);
      });
      stepsWrapper.appendChild(stepsDiv);
    }
  // this evaluates whether the answer has a null solution or encountered an error -> if so it presents it. It also loads custom results.
    if (data.error) {
      const errEl = document.createElement('div');
      errEl.className = 'entry-error';
      errEl.textContent = '✗ ' + data.error;
      finalWrapper.appendChild(errEl);
    } else {
      const noSolution = isEmptySolution(data.finalResult);
      const finalRow = document.createElement('div');
      finalRow.className = 'final-row';
      finalRow.style.flexDirection = 'column';
      finalRow.style.alignItems = 'flex-start';
      finalRow.style.gap = '6px';

      const labelEl = document.createElement('span');
      labelEl.className = 'final-label';
      labelEl.textContent = data.steps.length > 0 ? 'final' : 'result';
      finalRow.appendChild(labelEl);

      if (noSolution) {
        const nsEl = document.createElement('div');
        nsEl.className = 'no-solution';
        nsEl.textContent = 'No closed-form solution found.';
        finalRow.appendChild(nsEl);
      } else {
        const resEl = document.createElement('div');
        resEl.className = 'final-result-latex';
        
        if (data.customLatexResult) {
          const customSpan = document.createElement('span');
          try {
            katex.render(data.customLatexResult, customSpan, { displayMode: true, throwOnError: false });
            resEl.appendChild(customSpan);
          } catch(e) {
            resEl.appendChild(renderKatex(data.finalResult, true, instanceSF));
          }
        } else {
          resEl.appendChild(renderKatex(data.finalResult, true, instanceSF));
        }
        finalRow.appendChild(resEl);
      }
      finalWrapper.appendChild(finalRow);
    }
  }

  if (sliderContainer) {
    const sliderInput = sliderContainer.querySelector('input[type="range"]');
    const sliderDisplay = sliderContainer.querySelector('.sf-display');
    sliderInput.addEventListener('input', (e) => {
      instanceSF = parseInt(e.target.value);
      sliderDisplay.textContent = instanceSF;
      updateCardDisplays();
    });
  }

  updateCardDisplays();
  // Finally we can present the steps and the final solution
  const textMathItems = [];
  data.steps.forEach((s, i) => {
    textMathItems.push({ label: 'step ' + (i+1), text: s.label + ' = ' + getCleanTextCopyValue(s.result) });
  });
  if (!data.error) {
    textMathItems.push({ label: 'result', text: isEmptySolution(data.finalResult) ? 'No solution found.' : getCleanTextCopyValue(data.finalResult) });
  }

  const toggle = document.createElement('div');
  toggle.className = 'text-math-toggle';
  toggle.innerHTML = '<span class="arrow">▶</span> text math';
  const body = document.createElement('div');
  body.className = 'text-math-body';

  textMathItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'text-math-item';
    const lbl = document.createElement('span');
    lbl.className = 'text-math-label';
    lbl.textContent = item.label;
    const code = document.createElement('span');
    code.className = 'text-math-code';
    code.textContent = item.text;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'copy';
    btn.onclick = (ev) => {
      ev.stopPropagation(); 
      navigator.clipboard.writeText(item.text).then(() => {
        btn.textContent = 'copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1500);
      });
    };
    row.appendChild(lbl);
    row.appendChild(code);
    row.appendChild(btn);
    body.appendChild(row);
  });

  toggle.onclick = (ev) => {
    // to not get issues with the onclick actions :)
    ev.stopPropagation(); 
    toggle.classList.toggle('open');
    body.classList.toggle('visible');
  };

  el.appendChild(toggle);
  el.appendChild(body);
  hist.insertBefore(el, hist.firstChild);
}

