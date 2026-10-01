function matrixToNerdamerString(rows) {
  return 'matrix(' + rows.map(row => '[' + row.join(',') + ']').join(',') + ')';
}

/* next up is the tokenizer: */

function insertNerdamerToken(text, moveDelta) {
  const inp = document.getElementById('expr-input');
  
  const start = inp.selectionStart || 0;
  const end = inp.selectionEnd || 0;
  const val = inp.value;
  
  inp.value = val.slice(0, start) + text + val.slice(end);
  const newPos = start + text.length + moveDelta;
  inp.setSelectionRange(newPos, newPos);
  
  syncNerdamerToLatexView();
}

document.getElementById('expr-input').addEventListener('input', syncNerdamerToLatexView);

// Also asked Gemini for help here: this lets users see what they wrote in LaTeX

function mapNerdamerToLatexPrompt(str) {
  if (!str) return '';
  
  let out = tokenizeExpr(str);
  out = convertToLatex(out);

  out = out.replace(/\bintegrate\s*/gi, '\\int ');
  out = out.replace(/\bdifferentiate\s*/gi, '\\frac{d}{dx} ');
  out = out.replace(/\bwith respect to\s+([a-z])/gi, ' \\,d$1');
  out = out.replace(/\bfor\s+([a-z])/gi, '_{[$1]}');
  out = out.replace(/\bexpand\s*/gi, '\\text{expand }');
  out = out.replace(/\bfactor\s*/gi, '\\text{factor }');
  out = out.replace(/\bsimplify\s*/gi, '\\text{simplify }');
  out = out.replace(/\bsolve\s*/gi, '\\text{solve }');
  out = out.replace(/\binvert\s*/gi, '\\text{invert} ');
  out = out.replace(/\btranspose\s*/gi, '\\text{transpose} ');
  out = out.replace(/\bdeterminant\s*/gi, '\\det ');
  out = out.replace(/\bdet\s*/gi, '\\det ');
  out = out.replace(/\bmatrix\s*/gi, '\\text{matrix} ');
  out = out.replace(/\bdot\s*/gi, '\\text{dot} ');
  
  return out;
}

function tokenize(expr) {
  let out = '';
  let i = 0;
  const s = expr;
  while (i < s.length) {
    if (s[i] === ' ') { out += ' '; i++; continue; }
    const wordMatch = s.slice(i).match(/^[A-Za-z]{2,}/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (KNOWN_NAMES.has(word.toLowerCase())) {
        out += word;
        i += word.length;
        continue;
      }
      let matched = false;
      for (let len = word.length - 1; len >= 2; len--) {
        const prefix = word.slice(0, len).toLowerCase();
        if (KNOWN_NAMES.has(prefix)) {
          out += word.slice(0, len);
          const rest = word.slice(len);
          if (rest.length > 0) out += '*' + tokenize(rest);
          matched = true;
          i += word.length;
          break;
        }
      }
      if (matched) continue;
      out += word.split('').join('*');
      i += word.length;
      continue;
    }
    const numMatch = s.slice(i).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      const num = numMatch[0];
      out += num;
      i += num.length;
      if (i < s.length && /[A-Za-z]/.test(s[i])) out += '*';
      continue;
    }
    if (/[A-Za-z]/.test(s[i])) {
      if (out.length > 0 && /\d$/.test(out)) out += '*';
      out += s[i];
      i++;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

const META_WORDS = new Set([
  'integrate','differentiate','diff','derivative','expand','factor','simplify','solve',
  'with','respect','to','for','of','in','terms','dx','dy','dt','dz',
  'partfrac','gcd','and','by',
  'matrix','invert','transpose','determinant','det','dot','vector','cross','size',
]);
// this part actually maps it out with regex, this is the preprocessor to the tokenizer
function tokenizeExpr(str) {
  return str.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part)) return part;
    if (META_WORDS.has(part.toLowerCase())) return part;
    if (/^\d+(\.\d+)?$/.test(part)) return part;
    return tokenize(part);
  }).join('');
}

/* ========================================================================================
  WORK-IN-PROGRESS MODULE: EXECUTION INTERCEPT MATRIX
========================================================================================
Nerdamer has a bug when factoring expressions that are raised to a power.
For example (3x^2 + 3)^2 should factor to: 9(1 + x^2)^2 but Nerdamer incorrectly returns:
3(1 + x^2)^2

because it loses part of the outer coefficient during factorization :p

To avoid this, expressions containing exponentiation ('^') are expanded
before factoring. Converting the expression into a plain polynomial form
prevents the coefficient-loss bug and allows factorization to proceed
correctly.
========================================================================================
*/
function executeSingleCommand(intent, mathExpr, variable = 'x') {
  if (intent === 'integrate') {
    return nerdamer(`integrate(${mathExpr}, ${variable})`).toString();
  } else if (intent === 'diff') {
    return nerdamer(`diff(${mathExpr}, ${variable})`).toString();
  } else if (intent === 'expand') {
    return nerdamer(`expand(${mathExpr})`).toString();
  } else if (intent === 'factor') {
        // WIP: Detects exponentials
    if (mathExpr.includes('^')) {
      // Step A: take the tokenz and put them in a polynomial as this lets them be treated
      let fullyExpandedPolynomial = nerdamer(`expand(${mathExpr})`).toString();
      // Step B: pass it back to factor
      return nerdamer(`factor(${fullyExpandedPolynomial})`).toString();
    }
    // Default safe route for "normal" unpowered factors
    return nerdamer(`factor(${mathExpr})`).toString();
  } else if (intent === 'simplify') {
    return nerdamer(`simplify(${mathExpr})`).toString();
  } else if (intent === 'solve') {
    let equation = mathExpr;
    if (equation.includes('=')) {
      const sides = equation.split('=');
      equation = `(${sides[0]}) - (${sides[1]})`;
    }
    let rawSolutions = nerdamer.solveEquations(equation, variable);
    return Array.isArray(rawSolutions) ? rawSolutions.map(sol => nerdamer(sol).toString()).join(', ') : nerdamer(rawSolutions).toString();
  } else if (intent === 'invert') {
    return nerdamer(`invert(${mathExpr})`).toString();
  } else if (intent === 'transpose') {
    return nerdamer(`transpose(${mathExpr})`).toString();
  } else if (intent === 'determinant' || intent === 'det') {
    return nerdamer(`determinant(${mathExpr})`).toString();
  } else if (intent === 'dot') {
    return nerdamer(`dot(${mathExpr})`).toString();
  }
  return nerdamer(mathExpr).toString();
}

function getCleanEnglishIntentName(rawCommand) {
  const dictionary = { 
    'integrate': 'Integral', 
    'diff': 'Derivative', 
    'differentiate': 'Derivative',
    'expand': 'Expansion', 
    'factor': 'Factorization', 
    'simplify': 'Simplification', 
    'solve': 'Resolution',
    'invert': 'Matrix inversion',
    'transpose': 'Transpose',
    'determinant': 'Determinant',
    'det': 'Determinant',
    'dot': 'Dot product'
  };
  return dictionary[rawCommand.toLowerCase()] || rawCommand;
}
