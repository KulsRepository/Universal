// Following is the match keyboard UI
const KB_LAYOUT = [
  {
    label: 'Operations',
    keys: [
      { display: '\\int dx',      insert: 'integrate()',                       cls: 'op wide', move: -1 },
      { display: '\\frac{d}{dx}', insert: 'differentiate()',                   cls: 'op wide', move: -1 },
      { display: '\\frac{\\partial}{\\partial x}', insert: 'differentiate(, y)', cls: 'op wide', move: -5 },
      { display: '\\text{expand}',  insert: 'expand()',                          cls: 'op wide', move: -1 },
      { display: '\\text{factor}',  insert: 'factor()',                          cls: 'op wide', move: -1 },
      { display: '\\text{simplify}',insert: 'simplify()',                        cls: 'op wide', move: -1 },
      { display: '\\text{solve}',   insert: 'solve(=0, x)',                      cls: 'op wide', move: -6 },
    ]
  },
  {
    label: 'Matrices',
    keys: [
      { display: '\\begin{pmatrix}\\square\\end{pmatrix}', action: 'matrix-panel', cls: 'op wide' },
      { display: '\\text{invert}',    insert: 'invert()',       cls: 'op', move: -1 },
      { display: '\\text{transpose}', insert: 'transpose()',    cls: 'op', move: -1 },
      { display: '\\det',             insert: 'determinant()',  cls: 'op', move: -1 },
      { display: '\\text{dot}',       insert: 'dot(,)',         cls: 'op', move: -1 },
    ]
  },
  {
    label: 'Functions',
    keys: [
      { display: '\\sin(\\square)', insert: 'sin()',  move: -1 },
      { display: '\\cos(\\square)', insert: 'cos()',  move: -1 },
      { display: '\\tan(\\square)', insert: 'tan()',  move: -1 },
      { display: '\\ln(\\square)',  insert: 'ln()',   move: -1 },
      { display: '\\log(\\square)', insert: 'log()',  move: -1 },
      { display: '\\sqrt{\\square}',insert: 'sqrt()', move: -1 },
      { display: '|\\square|',     insert: 'abs()',  move: -1 },
      { display: 'e^{\\square}',      insert: 'e^()',   move: -1 },
    ]
  },
  {
    label: 'Constants & variables',
    keys: [
      { display: '\\pi', insert: 'pi' },
      { display: 'e',    insert: 'e' },
      { display: 'i',    insert: 'i' },
      { display: 'x',    insert: 'x' },
      { display: 'y',    insert: 'y' },
      { display: 't',    insert: 't' },
      { display: 'n',    insert: 'n' },
    ]
  },
  {
    label: 'Operators',
    keys: [
      { display: 'x^n',     insert: '^()',    move: -1 },
      { display: '\\times', insert: '*' },
      { display: '\\div',   insert: '/' },
      { display: '+',       insert: '+' },
      { display: '-',       insert: '-' },
      { display: '( )',     insert: '()',     move: -1 },
      { display: '=',       insert: ' = ' },
    ]
  },
];
// This iterates through the map above to generate symbolic buttons with KaTeX
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  KB_LAYOUT.forEach(group => {
    const lbl = document.createElement('div');
    lbl.className = 'kb-group-label';
    lbl.textContent = group.label;
    kb.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'kb-row';
    group.keys.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'kb-btn ' + (k.cls || '');
      
      if (k.display.includes('\\') || k.display.includes('^')) {
        try {
          katex.render(k.display, btn, { throwOnError: false });
        } catch(e) {
          btn.textContent = k.display;
        }
      } else {
        btn.textContent = k.display;
      }

      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        if (k.action === 'matrix-panel') openMatrixPanel();
        else insertNerdamerToken(k.insert, k.move || 0);
      });
      row.appendChild(btn);
    });
    kb.appendChild(row);
  });
}

// I asked Gemini to help me with this part to better my app. This ensures good typing.
// This part essentially finds the index of the cursor and places inside tokens (e.g. sin())

const MATRIX_GRID_SIZE = 10;

function handleMatrixKeyboardNav(e) {
  const cell = e.target;
  const r = parseInt(cell.dataset.r);
  const c = parseInt(cell.dataset.c);
  
  const rowsInput = document.getElementById('matrix-rows-input');
  const colsInput = document.getElementById('matrix-cols-input');
  const totalRows = rowsInput ? parseInt(rowsInput.value) || 3 : 3;
  const totalCols = colsInput ? parseInt(colsInput.value) || 3 : 3;
  
  let targetR = r;
  let targetC = c;
  
  if (e.key === 'ArrowUp') {
    targetR = r - 1;
  } else if (e.key === 'ArrowDown') {
    targetR = r + 1;
  } else if (e.key === 'ArrowLeft') {
    // Only hop cells if the caret is at the absolute start of the input text string
    if (cell.selectionStart === 0) {
      targetC = c - 1;
      if (targetC < 0 && targetR > 0) {
        targetC = totalCols - 1;
        targetR--;
      }
    } else {
      return; 
    }
  } else if (e.key === 'ArrowRight') {
    // Only hop cells if the caret reaches the absolute end of the input text string
    if (cell.selectionEnd === cell.value.length) {
      targetC = c + 1;
      if (targetC >= totalCols && targetR < totalRows - 1) {
        targetC = 0;
        targetR++;
      }
    } else {
      return;
    }
  } else {
    return;
  }
  
  // Apply safe index bounds guard checks before dispatching focus transitions
  if (targetR >= 0 && targetR < totalRows && targetC >= 0 && targetC < totalCols) {
    e.preventDefault();
    const nextInp = document.querySelector(`#matrix-grid .matrix-cell[data-r="${targetR}"][data-c="${targetC}"]`);
    if (nextInp) {
      nextInp.focus();
      nextInp.select(); // Highlight cell contents instantly for hyper-fast workspace overrides
    }
  }
}

function confirmMatrixInput() {
  const rows = readMatrixFromGrid();
  if (!rows) { closeMatrixPanel(); return; }
  insertNerdamerToken(matrixToNerdamerString(rows), 0);
  closeMatrixPanel();
}

function setExpr(el) {
  const rawCommand = el.getAttribute('onclick').match(/'(.*?)'/)[1] || el.textContent;
  document.getElementById('expr-input').value = rawCommand;
  syncNerdamerToLatexView();
}

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('matrix-overlay');
  if (overlay.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); closeMatrixPanel(); return; }
    if (e.key === 'Enter' && e.target.classList.contains('matrix-cell')) {
      e.preventDefault();
      confirmMatrixInput();
      return;
    }
  }
  if (e.key === 'Enter') {
    handleRun();
  }
});
// Here we made the Lexical tool that makes Universal as strong as it is. This is the tokenizer which is for now mostly native to server-side CAS.
// Users can write a variety of inputs which will work
const KNOWN_NAMES = new Set([
  'sin','cos','tan','cot','sec','csc',
  'asin','acos','atan','acot','asec','acsc',
  'sinh','cosh','tanh','coth','sech','csch',
  'asinh','acosh','atanh',
  'sqrt','cbrt','abs','exp','log','ln',
  'floor','ceil','round','sign',
  'pi','inf','infinity',
  'integrate','diff','differentiate','expand','factor','simplify','solve','partfrac','gcd',
  'matrix','invert','transpose','determinant','det','dot','vector','imatrix','cross','size',
]);

