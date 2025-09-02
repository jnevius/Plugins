const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { console, __result: null, __html__: '<div></div>', figma: { showUI:()=>{}, loadFontAsync: async ()=>{}, ui:{ onmessage:null, postMessage:()=>{} } } };
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { applyStylesToFigmaElement, parseLetterSpacingCSS };', sandbox);
const { applyStylesToFigmaElement, parseLetterSpacingCSS } = sandbox.__result;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Parser checks
const p1 = parseLetterSpacingCSS('normal');
assert(p1.unit === 'NORMAL', 'normal -> NORMAL');
const p2 = parseLetterSpacingCSS('2px');
assert(p2.unit === 'PIXELS' && Math.abs(p2.value - 2) < 0.001, '2px parsed');
const p3 = parseLetterSpacingCSS('0.1em');
assert(p3.unit === 'PERCENT' && Math.abs(p3.value - 10) < 0.001, 'em -> percent');

// Apply checks
(async () => {
  const text = { type: 'TEXT', characters: 'Hello', letterSpacing: undefined, fontName: { family: 'Inter', style: 'Regular' } };
  await applyStylesToFigmaElement(text, { 'letter-spacing': '3px' });
  assert(text.letterSpacing && text.letterSpacing.unit === 'PIXELS' && Math.abs(text.letterSpacing.value - 3) < 0.001, 'applied 3px letter-spacing');

  const text2 = { type: 'TEXT', characters: 'Hello', letterSpacing: undefined, fontName: { family: 'Inter', style: 'Regular' } };
  await applyStylesToFigmaElement(text2, { 'letter-spacing': '0.2em' });
  assert(text2.letterSpacing && text2.letterSpacing.unit === 'PERCENT' && Math.abs(text2.letterSpacing.value - 20) < 0.001, 'applied 0.2em as 20%');
  console.log('letterSpacing tests passed');
})();
