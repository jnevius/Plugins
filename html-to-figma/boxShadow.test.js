    const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { console, __result: null, __html__: '<div></div>', figma: { showUI:()=>{}, ui:{ onmessage:null, postMessage:()=>{} } } };
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { parseBoxShadowCSS: (typeof parseBoxShadowCSS!=="undefined"?parseBoxShadowCSS:globalThis.parseBoxShadowCSS), parseColor: (typeof parseColor!=="undefined"?parseColor:globalThis.parseColor) };', sandbox);
const { parseBoxShadowCSS } = sandbox.__result;

function assert(cond, msg){ if(!cond) throw new Error(msg); }

const cases = [
  '0 4px 12px rgba(0,0,0,0.2)',
  'inset 1px 2px 3px rgba(50,50,50,0.4)',
  '#000 0 2px 6px',
  '2px 2px 4px #ff0000, inset 0 1px 2px rgba(0,0,0,0.5)'
];

for (const c of cases) {
  const effects = parseBoxShadowCSS(c);
  assert(Array.isArray(effects) && effects.length >= 1, 'effects expected');
  for (const e of effects) {
    assert(['DROP_SHADOW','INNER_SHADOW'].includes(e.type), 'valid effect type');
    assert(typeof e.offset.x === 'number' && typeof e.offset.y === 'number', 'numeric offset');
    assert(typeof e.radius === 'number', 'numeric radius');
    assert(e.color && typeof e.color.r === 'number' && typeof e.color.g === 'number' && typeof e.color.b === 'number', 'color present');
  }
}

console.log('boxShadow tests passed');
