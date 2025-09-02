// This file contains the main plugin code that runs in the Figma environment

figma.showUI(__html__, { width: 800, height: 600 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-from-html') {
    const { html, css } = msg;
    
    // Notify the UI that we're processing
    figma.ui.postMessage({ type: 'processing' });
    
    try {
      // Create Figma elements based on HTML/CSS
      await createFigmaElementsFromHTML(html, css);
      
      // Notify the UI that we're done
      figma.ui.postMessage({ type: 'success' });
    } catch (error) {
      // Notify the UI of any errors
      figma.ui.postMessage({ 
        type: 'error', 
        message: error.message || 'An unknown error occurred'
      });
    }
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Function to create Figma elements from HTML and CSS
async function createFigmaElementsFromHTML(html, css) {
  // Create a frame to contain our elements
  const frame = figma.createFrame();
  frame.name = 'HTML to Figma';
  // Make the top-level frame an auto-layout container (vertical)
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO'; // Hug contents vertically
  frame.counterAxisSizingMode = 'AUTO'; // Hug contents horizontally
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.itemSpacing = 12;
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  
  // Parse the HTML
  const elements = parseHTML(html);
  
  // Process nested elements
  processNestedElements(elements);
  
  // Apply styles from CSS
  applyCSS(elements, css);
  
  // Create Figma elements based on the parsed HTML
  await createElements(frame, elements);
  
  // Select the frame
  figma.currentPage.selection = [frame];
  
  // Zoom to fit the frame
  figma.viewport.scrollAndZoomIntoView([frame]);
}

// Function to process nested elements like <u> and <s> within paragraphs
function processNestedElements(elements) {
  // If spans are already nested inside paragraphs/headings, skip processing
  const hasNestedSpans = (arr) => arr.some(el => {
    if (el.children && el.children.some(c => c.type === 'span')) return true;
    return el.children ? hasNestedSpans(el.children) : false;
  });

  if (hasNestedSpans(elements)) { 
    console.log('Nested spans already present; skipping inline re-attachment');
    return;
  }

  // Legacy fallback: Keep previous behavior if needed (rare).
  console.log('No nested spans detected; keeping content as-is');
}

// Function to parse HTML string into a simple object structure
function parseHTML(html) {
  // Stack-based minimal HTML parser to preserve nesting for div/p/h1-6/span/u/s/strike/del
  const root = { type: 'root', children: [] };
  const stack = [root];

  // Tokenize tags and text
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let lastIndex = 0;
  let match;

  function current() { return stack[stack.length - 1]; }

  function pushNode(node) {
    const parent = current();
    parent.children = parent.children || [];
    parent.children.push(node);
    return node;
  }

  function createNodeFromTag(tagName, attrs) {
    const attributes = parseAttributes(attrs || '');
    switch (true) {
      case /^h[1-6]$/i.test(tagName): {
        const level = parseInt(tagName.substring(1), 10);
        return { type: 'heading', level, attributes, content: '', rawContent: '', children: [] , _tag: tagName.toLowerCase() };
      }
      case tagName.toLowerCase() === 'p':
        return { type: 'paragraph', attributes, content: '', rawContent: '', children: [], _tag: 'p' };
      case tagName.toLowerCase() === 'div':
        return { type: 'div', attributes, content: '', rawContent: '', children: [], _tag: 'div' };
      case ['span','u','s','strike','del'].includes(tagName.toLowerCase()): {
        const node = { type: 'span', attributes, content: '', rawContent: '', children: [], originalTag: tagName.toLowerCase(), _tag: tagName.toLowerCase() };
        // Add decoration style on attributes for u/s/strike/del
        if (node.originalTag === 'u') {
          node.attributes.style = node.attributes.style || {};
          node.attributes.style['text-decoration'] = 'underline';
        } else if (['s','strike','del'].includes(node.originalTag)) {
          node.attributes.style = node.attributes.style || {};
          node.attributes.style['text-decoration'] = 'line-through';
        }
        node.attributes._htmlTag = node.originalTag;
        return node;
      }
      default:
        return { type: 'unknown', attributes, content: '', rawContent: '', children: [], _tag: tagName.toLowerCase() };
    }
  }

  function appendText(text) {
    if (!text) return;
    const node = current();
    const t = text;
    // Append text and create explicit text nodes preserving order
    if (!node) return;
    const textNode = { type: 'text', content: t };
    node.children = node.children || [];
    node.children.push(textNode);
    // Maintain simple content/rawContent for compatibility
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'span' || node.type === 'div') {
      node.content = (node.content || '') + t;
      node.rawContent = (node.rawContent || '') + t;
    }
  }

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, tagNameRaw, attrs] = match;
    const isClosing = full.startsWith('</');
    const tagName = tagNameRaw.toLowerCase();

    // Text between last index and current tag
    const textBetween = html.substring(lastIndex, match.index);
    appendText(textBetween);
    lastIndex = tagRegex.lastIndex;

    if (!isClosing) {
      // Opening tag
      const node = createNodeFromTag(tagName, attrs);
      pushNode(node);
      // Only push non-void tags to stack
      stack.push(node);
    } else {
      // Closing tag: pop until matching tag found
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]._tag === tagName) {
          stack.pop();
          break;
        } else {
          stack.pop();
        }
      }
    }
  }

  // Trailing text after last tag
  appendText(html.substring(lastIndex));

  // Cleanup: remove unknown nodes but keep their children
  function normalize(arr) {
    const out = [];
    for (const el of arr) {
      // Normalize children first if present
      if (el.type === 'unknown') {
        if (el.children && el.children.length) {
          out.push(...normalize(el.children));
        }
        continue;
      }
      if (el.children && el.children.length) {
        el.children = normalize(el.children);
      }
      // Trim content for non-text elements only
      if (el.type !== 'text') {
        if (typeof el.content === 'string') {
          el.content = el.content.replace(/\s+/g, ' ').trim();
        }
        if (typeof el.rawContent === 'string') {
          el.rawContent = el.rawContent.trim();
        }
      }
      // Drop empty paragraphs that only came from stray whitespace
      if (el.type === 'paragraph' && !el.content && (!el.children || el.children.length === 0)) {
        continue;
      }
      // Preserve text node whitespace; do not trim or collapse here to keep spaces around inline tags
      if (el.type === 'text') {
        // keep as-is
      }
      // For headings, ensure level number
      if (el.type === 'heading' && typeof el.level !== 'number') {
        const m = (el._tag || '').match(/h([1-6])/);
        if (m) el.level = parseInt(m[1], 10);
      }
      out.push(el);
    }
    return out;
  }

  const result = normalize(root.children || []);
  return result;
}

// Function to parse HTML attributes
function parseAttributes(attributeString) {
  const attributes = {};
  
  // Extract class
  const classMatch = attributeString.match(/class=["']([^"']*)["']/);
  if (classMatch) {
    attributes.class = classMatch[1].split(' ');
  }
  
  // Extract id
  const idMatch = attributeString.match(/id=["']([^"']*)["']/);
  if (idMatch) {
    attributes.id = idMatch[1];
  }
  
  // Extract style
  const styleMatch = attributeString.match(/style=["']([^"']*)["']/);
  if (styleMatch) {
    attributes.style = parseInlineStyle(styleMatch[1]);
  }
  
  // Store HTML tag name for special elements (for text-decoration handling)
  if (attributeString.includes('data-tag=')) {
    const tagNameMatch = attributeString.match(/data-tag=["']([^"']*)["']/);
    if (tagNameMatch) {
      attributes._htmlTag = tagNameMatch[1];
    }
  }
  
  return attributes;
}

// Function to parse inline CSS styles
function parseInlineStyle(styleString) {
  const styles = {};
  
  const declarations = styleString.split(';');
  
  for (const declaration of declarations) {
    const [property, value] = declaration.split(':').map(part => part.trim());
    
    if (property && value) {
      styles[property] = value;
    }
  }
  
  return styles;
}

// Function to apply CSS to parsed HTML elements
function applyCSS(elements, css) {
  // This is a simplified CSS parser for demonstration
  // In a real implementation, you would use a proper CSS parser
  
  // Parse CSS rules
  const rules = parseCSS(css);
  
  // Apply rules to elements
  for (const element of elements) {
    // Initialize styles object if it doesn't exist
    if (!element.styles) {
      element.styles = {};
    }
    
    // Apply CSS to nested children recursively
    if (element.children && element.children.length > 0) {
      applyCSS(element.children, css);
    }
    
    // Apply rules based on element type
    // Handle both exact matches and tag selectors (like 'p', 'h1', etc.)
    const typeRules = rules.filter(rule => {
      // Check for exact match with element.type
      if (rule.selector === element.type) {
        return true;
      }
      
      // Check for tag selectors (e.g., 'p', 'h1', etc.)
      // For paragraph elements, match 'p' selector
      if (element.type === 'paragraph' && rule.selector === 'p') {
        return true;
      }
      
      // For heading elements, match 'h1', 'h2', etc. selectors
      if (element.type === 'heading' && rule.selector === `h${element.level}`) {
        return true;
      }
      
      // For span elements, match 'span' selector
      if (element.type === 'span' && rule.selector === 'span') {
        return true;
      }
      
      // For div elements, match 'div' selector
      if (element.type === 'div' && rule.selector === 'div') {
        return true;
      }
      
      return false;
    });
    
    for (const rule of typeRules) {
      if (!element.styles) {
        element.styles = {};
      }
      // Merge rule styles into element styles without using spread operator
      Object.assign(element.styles, rule.styles);
      console.log(`Applied ${rule.selector} styles to ${element.type} element:`, rule.styles);
    }
    
    // Apply rules based on class
    if (element.attributes && element.attributes.class) {
      for (const className of element.attributes.class) {
        const classRules = rules.filter(rule => rule.selector === '.' + className);
        
        for (const rule of classRules) {
          if (!element.styles) {
            element.styles = {};
          }
          // Merge rule styles into element styles without using spread operator
          Object.assign(element.styles, rule.styles);
        }
      }
    }
    
    // Apply rules based on id
    if (element.attributes && element.attributes.id) {
      const idRules = rules.filter(rule => rule.selector === '#' + element.attributes.id);
      
      for (const rule of idRules) {
        if (!element.styles) {
          element.styles = {};
        }
        // Merge rule styles into element styles without using spread operator
        Object.assign(element.styles, rule.styles);
      }
    }
    
    // Apply inline styles
    if (element.attributes && element.attributes.style) {
      if (!element.styles) {
        element.styles = {};
      }
      // Merge inline styles into element styles without using spread operator
      Object.assign(element.styles, element.attributes.style);
    }
  }
}

// Function to parse CSS string into a simple object structure
function parseCSS(css) {
  // This is a simplified parser for demonstration
  // In a real implementation, you would use a proper CSS parser
  
  const rules = [];
  
  // Extract rules
  const ruleRegex = /([^{]*)\{([^}]*)\}/g;
  let match;
  
  while ((match = ruleRegex.exec(css)) !== null) {
    const selector = match[1].trim();
    const styleString = match[2].trim();
    
    const styles = {};
    
    const declarations = styleString.split(';');
    
    for (const declaration of declarations) {
      const [property, value] = declaration.split(':').map(part => part.trim());
      
      if (property && value) {
        styles[property] = value;
        
        // Log text-decoration styles for debugging
        if (property === 'text-decoration') {
          console.log(`Found text-decoration in CSS for selector '${selector}':`, value);
        }
      }
    }
    
    rules.push({
      selector: selector,
      styles: styles
    });
    
    console.log(`Parsed CSS rule for selector '${selector}':`, styles);
  }
  
  return rules;
}

// Function to create Figma elements based on parsed HTML
async function createElements(parent, elements) {
  // Pre-load fonts to avoid issues with text decoration and other text properties
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    console.log('Successfully pre-loaded fonts');
  } catch (e) {
    console.error('Error pre-loading fonts:', e);
  }
  
  for (const element of elements) {
    let figmaElement;
    
    // Create element based on type
    switch (element.type) {
      case 'heading':
      case 'paragraph':
        figmaElement = figma.createText();
        // Build text from ordered children (text nodes and span nodes)
        let richText = '';
        const ranges = [];
        const visit = (nodes) => {
          for (const n of nodes || []) {
            if (n.type === 'text') {
              richText += n.content;
            } else if (n.type === 'span') {
              const start = richText.length;
              if (n.children && n.children.length) visit(n.children);
              else richText += n.content || '';
              const end = richText.length;
              ranges.push({ start, end, tag: n.originalTag });
            } else if (n.children && n.children.length) {
              visit(n.children);
            }
          }
        };
        if (element.children && element.children.length) {
          visit(element.children);
          // Fallback if no text nodes were present
          if (!richText) richText = element.content || '';
        } else {
          richText = element.content || '';
        }

        figmaElement.characters = richText;
        // Ensure font is loaded before applying text decorations
        try {
          await figma.loadFontAsync(figmaElement.fontName || { family: 'Inter', style: 'Regular' });
        } catch (e) {
          console.error(`Error loading font: ${e.message}`);
        }
        // Apply decorations from computed ranges
        for (const r of ranges) {
          try {
            if (r.tag === 'u') {
              figmaElement.setRangeTextDecoration(r.start, r.end, 'UNDERLINE');
            } else if (['s', 'strike', 'del'].includes(r.tag)) {
              figmaElement.setRangeTextDecoration(r.start, r.end, 'STRIKETHROUGH');
            }
          } catch (e) {
            console.error('Error applying range decoration:', e);
          }
        }
        
        // Apply heading-specific styles
        if (element.type === 'heading') {
          const fontSize = 24 - (element.level - 1) * 2; // h1: 24px, h2: 22px, etc.
          figmaElement.fontSize = fontSize;
          figmaElement.fontName = { family: 'Inter', style: 'Bold' };
        }
        break;
        
      case 'span':
        // Only create standalone spans if they're not nested within another element
        figmaElement = figma.createText();
        figmaElement.characters = element.content;
        
        // Set the name based on the original tag if available
        if (element.originalTag) {
          figmaElement.name = `span-${element.originalTag}`;
          console.log(`Created standalone span element from <${element.originalTag}> tag with content:`, element.content);
          
          // Apply text decoration based on the original tag
          if (element.originalTag === 'u') {
            try {
              await figma.loadFontAsync(figmaElement.fontName);
              figmaElement.textDecoration = 'UNDERLINE';
              console.log('Applied UNDERLINE decoration to standalone span');
            } catch (e) {
              console.error('Error applying underline to span:', e);
            }
          } else if (['s', 'strike', 'del'].includes(element.originalTag)) {
            try {
              await figma.loadFontAsync(figmaElement.fontName);
              figmaElement.textDecoration = 'STRIKETHROUGH';
              console.log('Applied STRIKETHROUGH decoration to standalone span');
            } catch (e) {
              console.error('Error applying strikethrough to span:', e);
            }
          }
        } else {
          figmaElement.name = 'span';
          console.log('Created standalone span element with content:', element.content);
        }
        break;
        
      case 'div':
        figmaElement = figma.createFrame();
        figmaElement.name = 'div';
        figmaElement.resize(200, 100);
        
        // Check if this div should be a flex container
        if (element.styles && element.styles['display'] === 'flex') {
          const dir = (element.styles['flex-direction'] || 'row').toLowerCase();
          figmaElement.layoutMode = dir === 'column' ? 'VERTICAL' : 'HORIZONTAL';
          figmaElement.primaryAxisSizingMode = 'AUTO';
          figmaElement.counterAxisSizingMode = 'AUTO';
          // Map alignments
          const justify = (element.styles['justify-content'] || 'flex-start').toLowerCase();
          const align = (element.styles['align-items'] || 'stretch').toLowerCase();
          const mapPrimary = {
            'flex-start': 'MIN', 'start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'end': 'MAX', 'space-between': 'SPACE_BETWEEN'
          };
          const mapCounter = { 'flex-start': 'MIN', 'start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'end': 'MAX', 'baseline': 'BASELINE' };
          figmaElement.primaryAxisAlignItems = mapPrimary[justify] || 'MIN';
          let counter = mapCounter[align] || 'MIN';
          // CSS 'stretch' is not a valid enum; emulate via children sizing
          if (align === 'stretch') {
            counter = 'MIN';
            try { figmaElement.setPluginData('align_items', 'stretch'); } catch (e) {}
          }
          figmaElement.counterAxisAlignItems = counter;
          try { figmaElement.setPluginData('flex_direction', dir); } catch (e) {}
          // gap
          const gap = parseInt(element.styles['gap'] || element.styles['column-gap'] || element.styles['row-gap'] || '10');
          if (!isNaN(gap)) figmaElement.itemSpacing = gap;
          console.log('Created div as a flex container');
        }
        
        // Add text if there's content
        if (element.content && element.content.trim() !== '') {
          const text = figma.createText();
          // Font should already be loaded from the preload step
          text.characters = element.content;
          figmaElement.appendChild(text);
          text.x = 10;
          text.y = 10;
        }
        
        // Process nested children if any
        if (element.children && element.children.length > 0) {
          console.log(`Processing ${element.children.length} nested elements in div`);
          // Recursively create child elements
          await createElements(figmaElement, element.children);
        }
        break;
        
      default:
        continue; // Skip unknown elements
    }
    
    // Apply styles
    await applyStylesToFigmaElement(figmaElement, element.styles);
    
    // Add to parent
    parent.appendChild(figmaElement);
    
    // Resize parent frame to fit content if it's a flex container
    if (parent.layoutMode) {
      // Auto-layout will handle sizing
      parent.resize(parent.width, parent.height);
    }
    
    // Position elements based on their display property and parent's layout
    if (element.styles && element.styles['display']) {
      const displayValue = element.styles['display'].toLowerCase().trim();
      
      // For display:none, we've already set visibility to false
      if (displayValue === 'none') {
        // No need to position hidden elements
        console.log('Skipping positioning for hidden element');
      } else if (parent.layoutMode) {
        // If parent has a layout mode set, let auto-layout handle positioning
        console.log(`Element will be positioned by parent's ${parent.layoutMode} layout`);
      } else {
        // Default positioning for elements without specific layout handling
        if (parent.children.length > 1) {
          const previousElement = parent.children[parent.children.length - 2];
          figmaElement.y = previousElement.y + previousElement.height + 20;
        } else {
          figmaElement.y = 20;
        }
        figmaElement.x = 20;
      }
    } else {
      // Default positioning for elements without display property
      if (parent.children.length > 1) {
        const previousElement = parent.children[parent.children.length - 2];
        figmaElement.y = previousElement.y + previousElement.height + 20;
      } else {
        figmaElement.y = 20;
      }
      figmaElement.x = 20;
    }

    // If parent is a flex container with align-items: stretch, emulate stretch by filling cross axis
    if (parent.type === 'FRAME' && parent.layoutMode) {
      const flexDir = parent.getPluginData && parent.getPluginData('flex_direction');
      const alignItems = parent.getPluginData && parent.getPluginData('align_items');
      if (alignItems === 'stretch') {
        if (flexDir === 'row') {
          // Fill vertical
          if ('layoutSizingVertical' in figmaElement) figmaElement.layoutSizingVertical = 'FILL';
        } else if (flexDir === 'column') {
          // Fill horizontal
          if ('layoutSizingHorizontal' in figmaElement) figmaElement.layoutSizingHorizontal = 'FILL';
        }
      }
    }
  }
}

// Function to apply styles to Figma elements
async function applyStylesToFigmaElement(figmaElement, styles) {
  if (!styles) return;
  
  // Load fonts for text elements before applying styles
  if (figmaElement.type === 'TEXT') {
    try {
      await figma.loadFontAsync(figmaElement.fontName || { family: 'Inter', style: 'Regular' });
    } catch (e) {
      console.error('Error loading font:', e);
    }
  }
  
  // Apply color
  if (styles.color && figmaElement.type === 'TEXT') {
    const colorResult = parseColor(styles.color);
    if (colorResult) {
      // Extract opacity if present in the color
      if (colorResult.opacity !== undefined && !styles.opacity) {
        try {
          figmaElement.opacity = colorResult.opacity;
          console.log(`Applied opacity from color: ${colorResult.opacity}`);
        } catch (e) {
          console.error(`Error applying opacity from color: ${e.message}`);
        }
      }
      
      // Apply the color (without the opacity property)
      const { r, g, b } = colorResult;
      figmaElement.fills = [{
        type: 'SOLID',
        color: { r, g, b }
      }];
    }
  }
  
  // Apply background color for frames
  if (styles['background-color'] && figmaElement.type === 'FRAME') {
    const colorResult = parseColor(styles['background-color']);
    if (colorResult) {
      // Extract opacity if present in the color
      if (colorResult.opacity !== undefined && !styles.opacity) {
        try {
          figmaElement.opacity = colorResult.opacity;
          console.log(`Applied opacity from background-color: ${colorResult.opacity}`);
        } catch (e) {
          console.error(`Error applying opacity from background-color: ${e.message}`);
        }
      }
      
      // Apply the color (without the opacity property)
      const { r, g, b } = colorResult;
      figmaElement.fills = [{
        type: 'SOLID',
        color: { r, g, b }
      }];
    }
  }
  
  // Apply box-shadow (maps to Figma effects: DROP_SHADOW/INNER_SHADOW)
  if (styles['box-shadow']) {
    const value = styles['box-shadow'].trim();
    try {
      if (value.toLowerCase() === 'none') {
        figmaElement.effects = [];
      } else {
        const parser = (typeof parseBoxShadowCSS !== 'undefined') ? parseBoxShadowCSS : (typeof globalThis !== 'undefined' ? globalThis.parseBoxShadowCSS : undefined);
        const effects = parser ? parser(value) : [];
        if (effects && effects.length) {
          figmaElement.effects = effects;
        }
      }
    } catch (e) {
      console.error('Error applying box-shadow:', e);
    }
  }

  // Apply font size
  if (styles['font-size'] && figmaElement.type === 'TEXT') {
    const fontSize = parseInt(styles['font-size']);
    if (!isNaN(fontSize)) {
      figmaElement.fontSize = fontSize;
    }
  }
  
  // Apply font weight
  if (styles['font-weight'] && figmaElement.type === 'TEXT') {
    const fontWeight = styles['font-weight'];
    if (fontWeight === 'bold' || parseInt(fontWeight) >= 700) {
      figmaElement.fontName = { family: 'Inter', style: 'Bold' };
    } else if (fontWeight === 'normal' || parseInt(fontWeight) < 700) {
      figmaElement.fontName = { family: 'Inter', style: 'Regular' };
    }
  }
  
  // Apply width and height for frames
  if (figmaElement.type === 'FRAME') {
    if (styles.width) {
      const width = parseInt(styles.width);
      if (!isNaN(width)) {
        figmaElement.resize(width, figmaElement.height);
      }
    }
    
    if (styles.height) {
      const height = parseInt(styles.height);
      if (!isNaN(height)) {
        figmaElement.resize(figmaElement.width, height);
      }
    }
  }
  
  // Apply border
  if (styles.border) {
    const borderParts = styles.border.split(' ');
    if (borderParts.length >= 3) {
      const borderWidth = parseInt(borderParts[0]);
      const borderColor = parseColor(borderParts[2]);
      
      if (!isNaN(borderWidth) && borderColor) {
        figmaElement.strokes = [{
          type: 'SOLID',
          color: borderColor
        }];
        figmaElement.strokeWeight = borderWidth;
      }
    }
  }
  
  // Apply border radius
  if (styles['border-radius'] && figmaElement.type === 'FRAME') {
    const borderRadius = parseInt(styles['border-radius']);
    if (!isNaN(borderRadius)) {
      figmaElement.cornerRadius = borderRadius;
    }
  }
  
  // Apply padding
  if (styles['padding'] && figmaElement.type === 'FRAME') {
    const padding = parseInt(styles['padding']);
    if (!isNaN(padding)) {
      figmaElement.paddingLeft = padding;
      figmaElement.paddingRight = padding;
      figmaElement.paddingTop = padding;
      figmaElement.paddingBottom = padding;
    }
  }
  
  // Apply margin (by adjusting position)
  if (styles['margin'] && figmaElement.type === 'FRAME') {
    const margin = parseInt(styles['margin']);
    if (!isNaN(margin)) {
      figmaElement.x += margin;
      figmaElement.y += margin;
    }
  }
  
  // Apply display property
  if (styles['display']) {
    const displayValue = styles['display'].toLowerCase().trim();
    console.log(`Applying display: ${displayValue} to ${figmaElement.type} element`);
    
    // Handle different display values
    switch (displayValue) {
      case 'block':
        // For block elements, ensure they take full width of parent
        if (figmaElement.type === 'FRAME') {
          // Set width to fill parent container
          figmaElement.layoutSizingHorizontal = 'FILL';
          // Add some margin for visual separation
          figmaElement.layoutMode = 'VERTICAL';
          figmaElement.itemSpacing = 10;
          console.log('Applied block display style');
        } else if (figmaElement.type === 'TEXT') {
          // For text elements we don't have access to the parent here.
          // Avoid referencing an undefined `parent`. If block sizing is
          // required for text, it should be handled by the caller (createElements)
          // where the parent frame is available.
          console.log('Block sizing for TEXT skipped here (parent not available)');
        }
        break;
        
      case 'inline':
        // For inline elements, they should flow horizontally
        if (figmaElement.type === 'FRAME') {
          figmaElement.layoutMode = 'HORIZONTAL';
          figmaElement.layoutSizingHorizontal = 'HUG';
          figmaElement.layoutSizingVertical = 'HUG';
          figmaElement.itemSpacing = 5;
          console.log('Applied inline display style');
        }
        break;
        
      case 'flex':
        // For flex elements, set up a flex container
        if (figmaElement.type === 'FRAME') {
          figmaElement.layoutMode = 'HORIZONTAL';
          figmaElement.primaryAxisSizingMode = 'AUTO';
          figmaElement.counterAxisSizingMode = 'AUTO';
          figmaElement.primaryAxisAlignItems = 'MIN';
          figmaElement.counterAxisAlignItems = 'MIN';
          figmaElement.itemSpacing = 10;
          console.log('Applied flex display style');
        }
        break;
        
      case 'none':
        // For display:none, hide the element
        figmaElement.visible = false;
        console.log('Applied display:none (element hidden)');
        break;
        
      default:
        console.warn(`Unsupported display value: ${displayValue}`);
    }
  }
  
  // Apply text alignment
  if (styles['text-align'] && figmaElement.type === 'TEXT') {
    const alignment = styles['text-align'];
    if (alignment === 'center') {
      figmaElement.textAlignHorizontal = 'CENTER';
    } else if (alignment === 'right') {
      figmaElement.textAlignHorizontal = 'RIGHT';
    } else if (alignment === 'left') {
      figmaElement.textAlignHorizontal = 'LEFT';
    }
  }
  
  // Apply opacity with proper error handling
  if (styles.opacity) {
    try {
      // Parse opacity value and ensure it's between 0 and 1
      let opacityValue = parseFloat(styles.opacity);
      
      // Handle percentage values (e.g., "50%")
      if (styles.opacity.includes('%')) {
        opacityValue = parseFloat(styles.opacity) / 100;
      }
      
      // Clamp value between 0 and 1
      opacityValue = Math.max(0, Math.min(1, opacityValue));
      
      // Apply opacity to the element
      figmaElement.opacity = opacityValue;
      console.log(`Applied opacity: ${opacityValue} to element`);
    } catch (e) {
      console.error(`Error applying opacity: ${e.message}`);
    }
  }
  
  // Apply text decoration - enhanced to handle all text elements including spans
  if (styles['text-decoration'] && figmaElement.type === 'TEXT') {
    try {
      // Ensure font is loaded before applying text decoration
      await figma.loadFontAsync(figmaElement.fontName);
      
      const decoration = styles['text-decoration'].toLowerCase().trim();
      console.log(`Applying text-decoration '${decoration}' to ${figmaElement.type} element with content: '${figmaElement.characters}'`);
      
      // Handle compound values like "underline solid red"
      if (decoration.includes('underline')) {
        figmaElement.textDecoration = 'UNDERLINE';
        console.log('Applied UNDERLINE decoration to', figmaElement.name || 'text element');
      } else if (decoration.includes('line-through') || decoration.includes('strikethrough')) {
        figmaElement.textDecoration = 'STRIKETHROUGH';
        console.log('Applied STRIKETHROUGH decoration to', figmaElement.name || 'text element');
      } else if (decoration === 'none') {
        figmaElement.textDecoration = 'NONE';
        console.log('Removed text decoration from', figmaElement.name || 'text element');
      } else {
        console.warn(`Unsupported text-decoration value: ${decoration}`);
      }
    } catch (e) {
      console.error('Error applying text decoration:', e);
      // Try to load a fallback font and apply decoration again
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        figmaElement.fontName = { family: 'Inter', style: 'Regular' };
        
        const decoration = styles['text-decoration'].toLowerCase().trim();
        if (decoration.includes('underline')) {
          figmaElement.textDecoration = 'UNDERLINE';
        } else if (decoration.includes('line-through') || decoration.includes('strikethrough')) {
          figmaElement.textDecoration = 'STRIKETHROUGH';
        } else if (decoration === 'none') {
          figmaElement.textDecoration = 'NONE';
        }
      } catch (fallbackError) {
        console.error('Failed to apply text decoration with fallback font:', fallbackError);
      }
    }
  }
  
  // Special handling for spans that represent HTML elements with inherent text decoration
  if (figmaElement.type === 'TEXT' && figmaElement.name === 'span') {
    try {
      await figma.loadFontAsync(figmaElement.fontName);
      
      // Check if this span represents a special HTML element
      if (styles && styles._htmlTag) {
        if (styles._htmlTag === 'u') {
          figmaElement.textDecoration = 'UNDERLINE';
          console.log('Applied UNDERLINE to span representing <u> element');
        } else if (['s', 'strike', 'del'].includes(styles._htmlTag)) {
          figmaElement.textDecoration = 'STRIKETHROUGH';
          console.log('Applied STRIKETHROUGH to span representing <s>, <strike>, or <del> element');
        }
      }
    } catch (e) {
      console.error('Error applying special text decoration to span:', e);
    }
  }
// Function to parse color strings into RGB values and extract opacity
function parseColor(colorString) {
  if (!colorString) return null;
  
  // Normalize color string
  colorString = colorString.toLowerCase().trim();
  
  // Handle hex colors
  if (colorString.startsWith('#')) {
    let hex = colorString.substring(1);
    
    // Handle #RGB format
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      
      return { r, g, b };
    }
    
    // Handle #RRGGBB format
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      
      return { r, g, b };
    }
    
    // Handle #RRGGBBAA format
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const a = parseInt(hex.substring(6, 8), 16) / 255;
      
      return { r, g, b, opacity: a };
    }
  }
  
  // Handle rgb() colors
  const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]) / 255;
    const g = parseInt(rgbMatch[2]) / 255;
    const b = parseInt(rgbMatch[3]) / 255;
    
    return { r, g, b };
  }
  
  // Handle rgba() colors and extract opacity
  const rgbaMatch = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]) / 255;
    const g = parseInt(rgbaMatch[2]) / 255;
    const b = parseInt(rgbaMatch[3]) / 255;
    const alpha = parseFloat(rgbaMatch[4]);
    
    // Return both RGB values and opacity
    return { r, g, b, opacity: alpha };
  }
  
  // Handle named colors (simplified)
  const namedColors = {
    'black': { r: 0, g: 0, b: 0 },
    'white': { r: 1, g: 1, b: 1 },
    'red': { r: 1, g: 0, b: 0 },
    'green': { r: 0, g: 1, b: 0 },
    'blue': { r: 0, g: 0, b: 1 },
    'yellow': { r: 1, g: 1, b: 0 },
    'cyan': { r: 0, g: 1, b: 1 },
    'magenta': { r: 1, g: 0, b: 1 },
    'gray': { r: 0.5, g: 0.5, b: 0.5 }
  };
  
  if (namedColors[colorString.toLowerCase()]) {
    return namedColors[colorString.toLowerCase()];
  }
  
  // Default to black if color can't be parsed
  return { r: 0, g: 0, b: 0 };
}
// End of parseColor function

// Function to parse CSS box-shadow into Figma effect objects (top-level)
function parseBoxShadowCSS(shadowString) {
  // Split multiple shadows by commas not inside parentheses
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < shadowString.length; i++) {
    const ch = shadowString[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(shadowString.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(shadowString.slice(start));

  const effects = [];

  for (let raw of parts) {
    let str = raw.trim();
    if (!str) continue;

    let inset = false;
    // detect inset anywhere
    if (/\binset\b/i.test(str)) {
      inset = true;
      str = str.replace(/\binset\b/i, '').trim();
    }

    // Extract color (rgba(), rgb(), hex, or named)
    let colorMatch = str.match(/rgba?\([^\)]+\)/i);
    let colorString = null;
    if (colorMatch) {
      colorString = colorMatch[0];
      str = (str.slice(0, colorMatch.index) + str.slice(colorMatch.index + colorMatch[0].length)).trim();
    } else {
      const hexMatch = str.match(/#[0-9a-fA-F]{3,8}\b/);
      if (hexMatch) {
        colorString = hexMatch[0];
        str = (str.slice(0, hexMatch.index) + str.slice(hexMatch.index + hexMatch[0].length)).trim();
      } else {
        // Try last token as named color
        const tokensTmp = str.split(/\s+/);
        const last = tokensTmp[tokensTmp.length - 1];
        if (last && parseColor(last)) {
          colorString = last;
          tokensTmp.pop();
          str = tokensTmp.join(' ');
        }
      }
    }

    // Remaining string contains offsets/blur/spread
    const tokens = str.split(/\s+/).filter(Boolean);
    const toNumber = (v) => {
      if (!v) return 0;
      const m = String(v).match(/-?\d*\.?\d+/);
      return m ? parseFloat(m[0]) : 0;
    };

    const offsetX = toNumber(tokens[0]);
    const offsetY = toNumber(tokens[1]);
    const blur = toNumber(tokens[2]);
    // spread is tokens[3], but Figma API may not expose it uniformly; omit for safety

    const col = parseColor(colorString || 'rgba(0,0,0,0.25)') || { r: 0, g: 0, b: 0, opacity: 0.25 };
    const effectColor = { r: col.r, g: col.g, b: col.b, a: col.opacity !== undefined ? col.opacity : 1 };

    effects.push({
      type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      visible: true,
      color: effectColor,
      blendMode: 'NORMAL',
      offset: { x: offsetX, y: offsetY },
      radius: blur
    });
  }

  return effects;
}

// Expose helpers when running outside Figma (tests)
try {
  if (typeof globalThis !== 'undefined') {
    if (typeof globalThis.parseBoxShadowCSS === 'undefined') globalThis.parseBoxShadowCSS = parseBoxShadowCSS;
    if (typeof globalThis.parseColor === 'undefined') globalThis.parseColor = parseColor;
  }
} catch (e) {}

} // End of createFigmaElementsFromHTML function

// End of file