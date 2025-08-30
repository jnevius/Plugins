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
  
  // Apply styles from CSS
  applyCSS(elements, css);
  
  // Create Figma elements based on the parsed HTML
  await createElements(frame, elements);
  
  // Select the frame
  figma.currentPage.selection = [frame];
  
  // Zoom to fit the frame
  figma.viewport.scrollAndZoomIntoView([frame]);
}

// Function to parse HTML string into a simple object structure
function parseHTML(html) {
  // This is a simplified parser for demonstration
  // In a real implementation, you would use a proper HTML parser
  
  // For now, we'll just extract some basic elements
  const elements = [];
  
  // Extract headings
  const headingRegex = /<h([1-6])([^>]*)>([^<]*)<\/h\1>/g;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1];
    const content = match[3].trim();
    
    elements.push({
      type: 'heading',
      level: parseInt(level),
      content: content,
      attributes: parseAttributes(match[2])
    });
  }
  
  // Extract paragraphs
  const paragraphRegex = /<p([^>]*)>([^<]*)<\/p>/g;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    const content = match[2].trim();
    
    elements.push({
      type: 'paragraph',
      content: content,
      attributes: parseAttributes(match[1])
    });
  }
  
  // Extract divs
  const divRegex = /<div([^>]*)>([^<]*)<\/div>/g;
  
  while ((match = divRegex.exec(html)) !== null) {
    const content = match[2].trim();
    
    elements.push({
      type: 'div',
      content: content,
      attributes: parseAttributes(match[1])
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
    const typeRules = rules.filter(rule => rule.selector === element.type);
    
    for (const rule of typeRules) {
      if (!element.styles) {
        element.styles = {};
      }
      // Merge rule styles into element styles without using spread operator
      Object.assign(element.styles, rule.styles);
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
      }
    }
    
    rules.push({
      selector: selector,
      styles: styles
    });
  }
  
  return rules;
}

// Function to create Figma elements based on parsed HTML
async function createElements(parent, elements) {
  for (const element of elements) {
    let figmaElement;
    
    // Create element based on type
    switch (element.type) {
      case 'heading':
      case 'paragraph':
        figmaElement = figma.createText();
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        figmaElement.characters = element.content;
        
        // Apply heading-specific styles
        if (element.type === 'heading') {
          const fontSize = 24 - (element.level - 1) * 2; // h1: 24px, h2: 22px, etc.
          figmaElement.fontSize = fontSize;
          await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
          figmaElement.fontName = { family: 'Inter', style: 'Bold' };
        }
        break;
        
      case 'div':
        figmaElement = figma.createFrame();
        figmaElement.name = 'div';
        figmaElement.resize(200, 100);
        
        // Add text if there's content
        if (element.content) {
          const text = figma.createText();
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
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
    applyStylesToFigmaElement(figmaElement, element.styles);
    
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
function applyStylesToFigmaElement(figmaElement, styles) {
  if (!styles) return;
  
  // Apply color
  if (styles.color && figmaElement.type === 'TEXT') {
    const rgb = parseColor(styles.color);
    if (rgb) {
      figmaElement.fills = [{
        type: 'SOLID',
        color: rgb
      }];
    }
  }
  
  // Apply background color for frames
  if (styles['background-color'] && figmaElement.type === 'FRAME') {
    const rgb = parseColor(styles['background-color']);
    if (rgb) {
      figmaElement.fills = [{
        type: 'SOLID',
        color: rgb
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
  
  // Apply opacity
  if (styles['opacity']) {
    const opacity = parseFloat(styles['opacity']);
    if (!isNaN(opacity) && opacity >= 0 && opacity <= 1) {
      figmaElement.opacity = opacity;
    }
  }
  
  // Apply text decoration
  if (styles['text-decoration'] && figmaElement.type === 'TEXT') {
    if (styles['text-decoration'] === 'underline') {
      figmaElement.textDecoration = 'UNDERLINE';
    } else if (styles['text-decoration'] === 'line-through') {
      figmaElement.textDecoration = 'STRIKETHROUGH';
    }
  }
}

// Function to parse color strings into RGB values
function parseColor(colorString) {
  // Handle hex colors
  if (colorString.startsWith('#')) {
    const hex = colorString.substring(1);
    
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
  }
  
  // Handle rgb() colors
  const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]) / 255;
    const g = parseInt(rgbMatch[2]) / 255;
    const b = parseInt(rgbMatch[3]) / 255;
    
    return { r, g, b };
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