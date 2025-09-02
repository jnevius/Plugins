const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/code.js', 'utf8');
const sandbox = { console, __result: null, __html__: '<div></div>', figma: { showUI:()=>{}, loadFontAsync: async ()=>{}, ui:{ onmessage:null, postMessage:()=>{} } } };
vm.createContext(sandbox);
vm.runInContext(code + '\n__result = { applyStylesToFigmaElement };', sandbox);
const { applyStylesToFigmaElement } = sandbox.__result;

(async () => {
  const text = { type: 'TEXT', characters: 'Hello\nWorld', lineHeight: undefined, fontName: { family: 'Inter', style: 'Regular' } };
  await applyStylesToFigmaElement(text, { 'line-height': '180%' });
  if (!text.lineHeight || text.lineHeight.unit !== 'PERCENT' || Math.abs(text.lineHeight.value - 180) > 0.001) {
    throw new Error('Expected lineHeight 180% on TEXT');
  }
  const text2 = { type: 'TEXT', characters: 'Hi', lineHeight: undefined, fontName: { family: 'Inter', style: 'Regular' } };
  await applyStylesToFigmaElement(text2, { 'line-height': '20px' });
  if (!text2.lineHeight || text2.lineHeight.unit !== 'PIXELS' || Math.abs(text2.lineHeight.value - 20) > 0.001) {
    throw new Error('Expected lineHeight 20px on TEXT');
  }
  console.log('lineHeight tests passed');
})();
