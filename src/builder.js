// this entire section is for the matrices: building, opening, closing. It builds the matrix capability

function buildMatrixGrid() {
  const grid = document.getElementById('matrix-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const rowsInput = document.getElementById('matrix-rows-input');
  const colsInput = document.getElementById('matrix-cols-input');
  const rows = rowsInput ? parseInt(rowsInput.value) || 3 : 3;
  const cols = colsInput ? parseInt(colsInput.value) || 3 : 3;
  
  // Re-flow columns dynamically via style rule binding variables
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.style.minWidth = Math.max(520, cols * 65) + 'px';
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'matrix-cell';
      inp.dataset.r = r;
      inp.dataset.c = c;
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      
      // Bind navigation event listeners immediately during instance compilation
      inp.addEventListener('keydown', handleMatrixKeyboardNav);
      
      grid.appendChild(inp);
    }
  }
}

function openMatrixPanel() {
  const rowsInput = document.getElementById('matrix-rows-input');
  const colsInput = document.getElementById('matrix-cols-input');
  if (rowsInput && !rowsInput.value) rowsInput.value = "3";
  if (colsInput && !colsInput.value) colsInput.value = "3";
  
  buildMatrixGrid();
  document.getElementById('matrix-overlay').classList.add('open');
  enableEditMode();
  
  const first = document.querySelector('#matrix-grid .matrix-cell');
  if (first) {
    first.focus();
  }
}

function closeMatrixPanel() {
  document.getElementById('matrix-overlay').classList.remove('open');
}

function readMatrixFromGrid() {
  const inputs = document.querySelectorAll('#matrix-grid .matrix-cell');
  const rowsInput = document.getElementById('matrix-rows-input');
  const colsInput = document.getElementById('matrix-cols-input');
  const totalRows = rowsInput ? parseInt(rowsInput.value) || 3 : 3;
  const totalCols = colsInput ? parseInt(colsInput.value) || 3 : 3;

  const filled = [];
  inputs.forEach(inp => {
    const val = inp.value.trim();
    if (val !== '') filled.push({ r: +inp.dataset.r, c: +inp.dataset.c, val });
  });
  
  if (!filled.length) return null;

  const lookup = new Map(filled.map(f => [f.r + ',' + f.c, f.val]));
  const rows = [];
  for (let r = 0; r < totalRows; r++) {
    const row = [];
    for (let c = 0; c < totalCols; c++) {
      row.push(lookup.get(r + ',' + c) || '0');
    }
    rows.push(row);
  }
  return rows;
}

function closeMatrixPanel() {
  document.getElementById('matrix-overlay').classList.remove('open');
}

function parseMatrixRows(expr) {
  const s = expr.trim();
  if (!s.startsWith('[[') || !s.endsWith(']]')) return null;
  const rowParts = splitTopLevel(s.slice(1, -1).trim(), ',');
  if (!rowParts.length) return null;
  const rows = [];
  for (const part of rowParts) {
    const p = part.trim();
    if (!p.startsWith('[') || !p.endsWith(']')) return null;
    const cells = splitTopLevel(p.slice(1, -1), ',').map(c => c.trim());
    if (!cells.length || cells.some(c => c === '')) return null;
    rows.push(cells);
  }
  return rows;
}

function maybeSquareMatrixRows(rows) {
  if (rows.length === 1 && rows[0].length > 1) {
    const side = Math.round(Math.sqrt(rows[0].length));
    if (side * side === rows[0].length) {
      const flat = rows[0];
      const square = [];
      for (let i = 0; i < side; i++) square.push(flat.slice(i * side, (i + 1) * side));
      return square;
    }
  }
  if (rows.length > 1 && rows.every(r => r.length === 1)) {
    const side = Math.round(Math.sqrt(rows.length));
    if (side * side === rows.length) {
      const flat = rows.map(r => r[0]);
      const square = [];
      for (let i = 0; i < side; i++) square.push(flat.slice(i * side, (i + 1) * side));
      return square;
    }
  }
  return rows;
}

// next up is for the sidebar

function toggleDebugSidebar() {
  document.getElementById('debug-sidebar').classList.toggle('open');
}

function enableEditMode() {
  const area = document.getElementById('expr-area');
  if (area.classList.contains('mode-view')) {
    area.classList.remove('mode-view');
    document.getElementById('expr-input').focus();
  }
}

function disableEditMode() {
  document.getElementById('expr-area').classList.add('mode-view');
  syncNerdamerToLatexView();
}

// This part finds the innermost bracket by creating a matched object data structure based on bracket count through regex.
// I fixed it to be able to go down the amount of brackets for as many brackets as possible; so the issue of unnecessary brackets is no more !!!
// this works in volatile memory as it is the whole purpose of the project: being client side
// This essentially runs the math commands in order when they are nested. the nested commands result becomes the input of the nester command.
function findInnermostCommand(str) {
  const regex = /\b(integrate|differentiate|diff|expand|factor|simplify|solve|invert|transpose|determinant|det|dot)\(/gi;
  let match;
  const matches = [];
  // this stores the regex matches above found in the code in a match list
  while ((match = regex.exec(str)) !== null) {
    matches.push({
      name: match[1],
      index: match.index,
      openParenthesisIndex: match.index + match[0].length - 1
    });
  }
  // this uses the matches to find the depth
  for (let m of matches) {
    let depth = 1;
    let j = m.openParenthesisIndex + 1;
    //this closes the total commands when depth hits 0
    while (j < str.length && depth > 0) {
      if (str[j] === '(') depth++;
      else if (str[j] === ')') depth--;
      if (depth === 0) break;
      j++;
    }
    if (depth === 0) {
      m.closeParenthesisIndex = j;
      m.fullMatch = str.slice(m.index, j + 1);
      m.args = str.slice(m.openParenthesisIndex + 1, j);
    } else {
      m.invalid = true;
    }
  }
  
  const validMatches = matches.filter(m => !m.invalid);
  if (validMatches.length === 0) return null;
  
  for (let m of validMatches) {
    let isInnermost = true;
    for (let other of validMatches) {
      if (other !== m && other.index > m.openParenthesisIndex && other.index < m.closeParenthesisIndex) {
        isInnermost = false;
        break;
      }
    }
    if (isInnermost) return m;
  }
  return null;
}
// Trig functions fail to give readable results as nerdamer tackles them numerically.

function tryInterceptTrigEquations(rawInput) {
  const clean = rawInput.trim();
  
  const generalTrigRegex = /^solve\(\s*(sin|cos|tan|csc|sec|cot)\(\s*([a-zA-Z0-9_\+\-\*\s\/\^()]+)\s*\)\s*=\s*([a-zA-Z0-9_\+\-\*\s\/\^()]+)\s*,\s*([a-zA-Z])\s*\)$/i;
  const match = clean.match(generalTrigRegex);
  
  if (match) {
    const func = match[1].toLowerCase();
    const innerArg = match[2].trim(); 
    const rightSide = match[3].trim(); 
    const targetVar = match[4].trim();
    
    try {
      let numVal = parseFloat(nerdamer(rightSide).evaluate().toString());
      
      if (!isNaN(numVal)) {
        if (((func === 'sin' || func === 'cos') && Math.abs(numVal) > 1) ||
            ((func === 'csc' || func === 'sec') && Math.abs(numVal) < 1) ||
            ((func === 'csc' || func === 'sec') && numVal === 0)) {
          return {
            isIntercepted: true,
            data: {
              raw: clean,
              steps: [
                {
                  label: `Analytic Domain Check: ${func}(${innerArg}) = ${rightSide}`,
                  note: `Checked trigonometric restrictions: value lines cannot intersect outside real amplitude range`,
                  result: "No Real Solutions"
                }
              ],
              finalResult: "[]",
              customLatexResult: "\\text{No Real Solutions}",
              finalLabel: "no solution",
              finalNote: "outside domain bounds",
              error: null
            }
          };
        }
      }
      
      if (numVal === 0) {
        let algebraicTarget = "";
        let displayRule = "";
        
        if (func === 'sin' || func === 'tan') {
          algebraicTarget = "pi * k";
          displayRule = `${func}(u) = 0 ⟹ u = πk`;
        } else if (func === 'cos' || func === 'cot') {
          algebraicTarget = "pi/2 + pi * k";
          displayRule = `${func}(u) = 0 ⟹ u = π/2 + πk`;
        } else {
          return { isIntercepted: false };
        }
        
        let calculatedClosure = "";
        
        if (innerArg === targetVar) {
          calculatedClosure = algebraicTarget;
        } else {
          const eqToSolve = `(${innerArg}) - (${algebraicTarget})`;
          const resolvedObj = nerdamer.solveEquations(eqToSolve, targetVar);
          calculatedClosure = Array.isArray(resolvedObj) ? resolvedObj.map(s => s.toString()).join(', ') : resolvedObj.toString();
        }
        
        return {
          isIntercepted: true,
          data: {
            raw: clean,
            steps: [
              {
                label: `Analytic Intercept: ${func}(${innerArg}) = 0`,
                note: "Applied periodic transcendental root rule: " + displayRule,
                result: `${innerArg} = ${algebraicTarget}`
              }
            ],
            finalResult: calculatedClosure + "  [for k in Z]",
            customLatexResult: toLatex(calculatedClosure) + ",\\quad k \\in \\mathbb{Z}",
            finalLabel: "periodic solution",
            finalNote: "solved analytically",
            error: null
          }
        };
      }
      
    } catch (err) {
      return { isIntercepted: false };
    }
  }
  
  return { isIntercepted: false };
}

// This auto closes unclosed parentheses

function balanceParentheses(inputString) {
  let openCount = 0;
  let closeCount = 0;
  
  for (let char of inputString) {
    if (char === '(') openCount++;
    if (char === ')') closeCount++;
  }
  
  if (openCount > closeCount) {
    return inputString + ')'.repeat(openCount - closeCount);
  }
  
  return inputString;
}

// This coordinates the pipeline :) with this we can choose when to use which function

function computeResult(raw) {
  let steps = [], finalResult = null, finalLabel = null, finalNote = null, error = null;
  
  const processedRaw = balanceParentheses(raw);
  
  const interceptCheck = tryInterceptTrigEquations(processedRaw);
  if (interceptCheck.isIntercepted) {
    return interceptCheck.data;
  }
  
  try {
    let workingString = processedRaw.trim();
    
    let safety = 0;
    // following is a command to prevent infinite loops + the main way we resolve everything within parentheses
    // The while loop solves expressions
    while (safety++ < 30) {
      let match = findInnermostCommand(workingString);
      if (!match) break; 

      let fullMatchString = match.fullMatch;
      let cmdName = match.name; 
      let cmd = cmdName.toLowerCase();
      let argumentsPayload = match.args;

      let resolvedCmdKey = cmd;
      if (cmd === 'differentiate') resolvedCmdKey = 'diff';
      if (cmd === 'det') resolvedCmdKey = 'determinant';

      // this lets us separate different parameters from one another
      let argsArray = splitTopLevel(argumentsPayload, ',');
      let coreMath = argsArray[0].trim();
      let extraVar = 'x'; 

      if (argsArray.length > 1) {
        extraVar = argsArray[1].trim();
      }

      let evaluationInput = (cmd === 'dot') ? argumentsPayload : coreMath;
      let evaluationResult = executeSingleCommand(resolvedCmdKey, evaluationInput, extraVar);

      const labelArgs = cmd === 'dot'
        ? argumentsPayload
        : (coreMath + (argsArray.length > 1 ? ', ' + extraVar : ''));

      steps.push({
        label: `${cmdName}(${labelArgs})`,
        note: `${getCleanEnglishIntentName(resolvedCmdKey)} calculated`,
        result: evaluationResult
      });

      // this is where we replace the string with the results :)
      workingString = workingString.replace(fullMatchString, evaluationResult);
    }

    // this if command solves equations, it comes after the expressions as first the experessions are handled and then the equations.
    // TLDR: The while loop resolves all individual expressions and sums them up, the if loop deals with their equalities.
    if (workingString.includes('=')) {
      const sides = workingString.split('=');
      workingString = `(${sides[0]}) - (${sides[1]})`;
      finalResult = Array.isArray(nerdamer.solveEquations(workingString, 'x')) 
        ? nerdamer.solveEquations(workingString, 'x').map(s => nerdamer(s).toString()).join(', ') 
        : nerdamer.solveEquations(workingString, 'x').toString();
      finalLabel = 'solve';
      finalNote = 'equation solved';
    } else {
      try {
        finalResult = nerdamer(workingString).toString();
      } catch(innerErr) {
        finalResult = workingString;
      }
      finalLabel = `nerdamer evaluation`;
      finalNote = 'evaluated';
    }

  } catch(e) {
    error = e.message;
  }
  return { raw: processedRaw, steps, finalResult, finalLabel, finalNote, error };
}

// verifies empty inputs in either arrays or strings, this is purposely matrix scalable :)
function isEmptySolution(str) {
  return /^\[\s*\]$/.test((str || '').trim()) || (str || '').trim() === '';
}

function handleRun(e) {
  if (e) e.stopPropagation();
  const raw = document.getElementById('expr-input').value.trim();
  if (!raw) return;
  const data = computeResult(raw);
  renderEntry(data);
  
  document.getElementById('expr-input').value = '';
  disableEditMode();
}

// for the UI
const supDigits = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
function toSup(n) { return String(n).split('').map(c => supDigits[c] || c).join(''); }

// this is also required for the significant figures, dont change as if it changes the whole sig figs program can have issues
function fmtNumber(numStr, sf) {
  const digits = numStr.replace(/[^0-9]/g, '');
  if (digits.length < SF_TRIGGER) return numStr;

  const n = parseFloat(numStr);
  if (!isFinite(n)) return numStr;
  if (n === 0) return '0';

  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / Math.pow(10, exp);
  const rounded = parseFloat(mantissa.toPrecision(sf));
  let mStr = rounded.toPrecision(sf).replace(/\.?0+$/, '');
  if (exp === 0) return mStr;
  return mStr + '×10' + toSup(exp);
}

// especially for future use when I'll want to add numbering axes of geometric problems.
function fmtResult(str, sf) {
  return str.replace(/(?<![a-zA-Z_])(-?\d+(?:\.\d+)?|\d*\.\d+)(?![a-zA-Z_])/g, (match) => {
    return fmtNumber(match, sf);
  });
}