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
  frame.resize(800, 600);
  
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
  // First, find all inline elements (spans, u, s, etc.)
  const inlineElements = elements.filter(el => 
    el.type === 'span' && (el.originalTag === 'u' || el.originalTag === 's' || 
                          el.originalTag === 'strike' || el.originalTag === 'del'));
  
  console.log(`Found ${inlineElements.length} inline elements to process:`, 
              inlineElements.map(el => `<${el.originalTag}>${el.content}</${el.originalTag}>`));
  
  // Then find their parent elements (paragraphs, headings, etc.)
  for (const element of elements) {
    if (element.type === 'paragraph' || element.type === 'heading') {
      if (element.rawContent) {
        // Check if this element contains any of our inline elements
        for (const inline of inlineElements) {
          // If the inline element's content is found in this element's raw content
          if (element.rawContent.includes(inline.content)) {
            // Add the inline element as a child of this element
            if (!element.children) {
              element.children = [];
            }
            element.children.push(inline);
            
            console.log(`Added ${inline.originalTag} element with content "${inline.content}" as child of ${element.type}`);
            
            // Mark the inline element to be removed from the main elements array
            inline._processed = true;
          }
        }
      }
    }
  }
  
  // Remove processed inline elements from the main array
  let removedCount = 0;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i]._processed) {
      elements.splice(i, 1);
      removedCount++;
    }
  }
  
  console.log(`Removed ${removedCount} processed inline elements from main array`);
}

// Function to parse HTML string into a simple object structure
function parseHTML(html) {
  // This is a simplified parser for demonstration
  // In a real implementation, you would use a proper HTML parser
  
  // For now, we'll just extract some basic elements
  const elements = [];
  
  // Extract headings
  const headingRegex = /<h([1-6])([^>]*)>(.*?)<\/h\1>/gs;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1];
    const content = match[3].trim();
    const rawContent = match[3]; // Keep the raw content for parsing nested elements
    
    elements.push({
      type: 'heading',
      level: parseInt(level),
      content: content,
      rawContent: rawContent,
      attributes: parseAttributes(match[2])
    });
  }
  
  // Extract paragraphs
  const paragraphRegex = /<p([^>]*)>(.*?)<\/p>/gs;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    const content = match[2].trim();
    const rawContent = match[2]; // Keep the raw content for parsing nested elements
    
    // Check for inline styling within paragraph content
    const hasInlineStyles = /<span|<u>|<s>|<strike>|<del>/.test(rawContent);
    
    // For paragraphs with inline styles, we need to preserve the raw content
    // but also strip tags for the main content display if it has inline styles
    const strippedContent = hasInlineStyles ? content.replace(/<[^>]*>|<\/[^>]*>/g, '') : content;
    
    elements.push({
      type: 'paragraph',
      content: strippedContent,
      rawContent: rawContent,
      hasInlineStyles: hasInlineStyles,
      attributes: parseAttributes(match[1])
    });
    
    console.log(`Parsed paragraph: "${strippedContent}" with raw content: "${rawContent}"`);
  }
  
  // Extract divs
  const divRegex = /<div([^>]*)>(.*?)<\/div>/gs;
  
  while ((match = divRegex.exec(html)) !== null) {
    const content = match[2].trim();
    const rawContent = match[2]; // Keep the raw content for parsing nested elements
    
    elements.push({
      type: 'div',
      content: content,
      rawContent: rawContent,
      attributes: parseAttributes(match[1])
    });
  }
  
  // Extract spans and inline elements (u, s, strike, del) for styling
  const inlineRegex = /<(span|u|s|strike|del)([^>]*)>(.*?)<\/\1>/gs;
  
  while ((match = inlineRegex.exec(html)) !== null) {
    const tagName = match[1];
    const content = match[3].trim();
    const rawContent = match[3]; // Keep the raw content for parsing nested elements
    
    console.log(`Found inline element: <${tagName}>${content}</${tagName}>`);
    
    // Create attributes object
    const attributes = parseAttributes(match[2]);
    
    // For u, s, strike, and del tags, add text-decoration style
    if (tagName === 'u') {
      if (!attributes.style) attributes.style = {};
      attributes.style['text-decoration'] = 'underline';
      console.log(`Added underline style to <u> tag with content: "${content}"`);
    } else if (['s', 'strike', 'del'].includes(tagName)) {
      if (!attributes.style) attributes.style = {};
      attributes.style['text-decoration'] = 'line-through';
      console.log(`Added line-through style to <${tagName}> tag with content: "${content}"`);
    }
    
    // Add a data attribute to track the original HTML tag
    attributes._htmlTag = tagName;
    
    elements.push({
      type: 'span',
      content: content,
      rawContent: rawContent,
      attributes: attributes,
      originalTag: tagName // Store the original tag name for reference
    });
  }
  
  return elements;
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
        
        // Check if this element has nested children (like <u> or <s> tags)
        if (element.children && element.children.length > 0) {
          console.log(`Processing ${element.type} with ${element.children.length} nested elements`);
          
          // Create a rich text version with spans for each nested element
          let richText = element.content;
          
          // Set the full text content first
          figmaElement.characters = richText;
          
          // Ensure font is loaded before applying text decorations
          try {
            await figma.loadFontAsync(figmaElement.fontName || { family: 'Inter', style: 'Regular' });
          } catch (e) {
            console.error(`Error loading font: ${e.message}`);
          }
          
          // Apply text decorations to each child's range
          for (const child of element.children) {
            if (child.originalTag) {
              // Find the position of the child content in the parent content
              const startIndex = richText.indexOf(child.content);
              if (startIndex !== -1) {
                const endIndex = startIndex + child.content.length;
                
                try {                  
                  if (child.originalTag === 'u') {
                    // Apply underline to just this range
                    figmaElement.setRangeTextDecoration(startIndex, endIndex, 'UNDERLINE');
                    console.log(`Applied UNDERLINE to range ${startIndex}-${endIndex} in ${element.type} with content "${child.content}"`);
                  } else if (['s', 'strike', 'del'].includes(child.originalTag)) {
                    // Apply strikethrough to just this range
                    figmaElement.setRangeTextDecoration(startIndex, endIndex, 'STRIKETHROUGH');
                    console.log(`Applied STRIKETHROUGH to range ${startIndex}-${endIndex} in ${element.type} with content "${child.content}"`);
                  }
                } catch (e) {
                  console.error(`Error applying text decoration to range: ${e.message}`);
                }
              } else {
                console.error(`Could not find "${child.content}" in parent text "${richText}"`);
              }
            }
          }
        } else {
          // No nested elements, just set the content directly
          figmaElement.characters = element.content;
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
        
        // Add text if there's content
        if (element.content) {
          const text = figma.createText();
          // Font should already be loaded from the preload step
          text.characters = element.content;
          figmaElement.appendChild(text);
          text.x = 10;
          text.y = 10;
        }
        break;
        
      default:
        continue; // Skip unknown elements
    }
    
    // Apply styles
    await applyStylesToFigmaElement(figmaElement, element.styles);
    
    // Add to parent
    parent.appendChild(figmaElement);
    
    // Position elements with a simple layout
    if (parent.children.length > 1) {
      const previousElement = parent.children[parent.children.length - 2];
      figmaElement.y = previousElement.y + previousElement.height + 20;
    } else {
      figmaElement.y = 20;
    }
    figmaElement.x = 20;
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