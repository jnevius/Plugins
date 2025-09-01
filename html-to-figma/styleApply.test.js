// Test applyCSS with flex selectors without using Figma API.
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { console, __result: null, __html__: '<div></div>', figma: { showUI:()=>{}, ui:{ onmessage:null, postMessage:()=>{} } } };
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { parseHTML, applyCSS };', sandbox);
const { parseHTML, applyCSS } = sandbox.__result;

const html = `<div id="flexbox"><div class="item"><p>Hi</p></div><div class="item">Bye</div></div>`;
const css = `#flexbox{display:flex;flex-direction:column;gap:12px;justify-content:center;align-items:flex-start;} .item{width:100px;}`;

const ast = parseHTML(html);
applyCSS(ast, css);

const root = ast.find(n => n.type === 'div' && n.attributes && n.attributes.id === 'flexbox');
if (!root) throw new Error('flexbox root not found');
if (!root.styles || root.styles.display !== 'flex') throw new Error('display:flex not applied');
if (root.styles['flex-direction'] !== 'column') throw new Error('flex-direction not applied');
if (root.styles['gap'] !== '12px' && root.styles['gap'] !== '12') throw new Error('gap not applied');
console.log('styleApply tests passed');
