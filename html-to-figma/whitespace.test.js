const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { console, __result: null, __html__: '<div></div>', figma: { showUI:()=>{}, ui:{ onmessage:null, postMessage:()=>{} } } };
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { parseHTML };', sandbox);
const { parseHTML } = sandbox.__result;

function reconstruct(node){
  let s = '';
  const walk = (n)=>{
    if (n.type === 'text') s += n.content;
    else if (n.type === 'span') {
      if (n.children && n.children.length) n.children.forEach(walk);
      else s += n.content || '';
    } else if (n.children) n.children.forEach(walk);
  };
  (node.children||[]).forEach(walk);
  return s;
}

const html = '<p>This text has <u>HTML underline</u> tag</p>\n<p>This text has <s>HTML strikethrough</s> tag</p>';
const ast = parseHTML(html);
const p1 = ast.find(n=>n.type==='paragraph');
if(!p1) throw new Error('paragraph not found');
const s1 = reconstruct(p1);
if (!s1.includes('has ') || !s1.includes(' underline') || !s1.includes(' underline')) throw new Error('spacing missing around first inline span: '+JSON.stringify(s1));
if (!/has\sHTML/.test(s1)) throw new Error('missing space before inline content');
if (!/underline\stag/.test(s1)) throw new Error('missing space after inline content');
console.log('whitespace tests passed');
