// Lightweight test of parseHTML structure (run via node). This doesn't touch Figma APIs.
const fs = require('fs');
const vm = require('vm');

// Load code.js into a VM and extract parseHTML
const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { 
  console, 
  __result: null,
  __html__: '<div></div>',
  figma: {
    showUI: () => {},
    ui: { onmessage: null, postMessage: () => {} }
  }
};
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { parseHTML };', sandbox);
const { parseHTML } = sandbox.__result;

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

const html = `
<div class="outer">
  <div id="flexbox">
    <p>First <u>under</u> item</p>
    <p><s>Struck</s> second item</p>
  </div>
  <div class="inner2">
    <p>Another <span>paragraph</span></p>
  </div>
</div>`;

const ast = parseHTML(html);
console.log('AST:', JSON.stringify(ast, null, 2));

// Root should have a top-level div
assert(ast.length === 1 && ast[0].type === 'div', 'Top-level div expected');
const outer = ast[0];
assert(outer.children && outer.children.length >= 2, 'Outer should have child divs');
const flexbox = outer.children.find(c => c.type === 'div' && c.attributes && c.attributes.id === 'flexbox');
assert(flexbox, 'Flexbox div found');
assert(flexbox.children.some(c => c.type === 'paragraph'), 'Flexbox contains paragraphs');

const p1 = flexbox.children.find(c => c.type === 'paragraph');
assert(p1.content.includes('First under item') || p1.rawContent.includes('First'), 'Paragraph text captured');

const inner2 = outer.children.find(c => c.type === 'div' && c.attributes && c.attributes.class && c.attributes.class.includes('inner2'));
assert(inner2, 'inner2 div found');
assert(inner2.children.some(c => c.type === 'paragraph'), 'inner2 contains a paragraph');

console.log('parseHTML tests passed');
