# HTML to Figma Plugin

A Figma plugin that allows you to create designs from HTML and CSS markup. This plugin provides a simple code editor interface where you can write HTML and CSS, then converts that markup into Figma elements.

## Features

- HTML editor with syntax highlighting
- CSS editor with syntax highlighting
- Converts basic HTML elements to Figma layers
- Applies CSS styling to Figma elements
- Simple and intuitive UI
- Top-level frame uses vertical Auto Layout for natural stacking
- Flexbox mapping for divs with display:flex (direction, alignment, gap)

## Supported HTML Elements

Currently, the plugin supports the following HTML elements:

- Headings (`<h1>` through `<h6>`)
- Paragraphs (`<p>`)
- Divs (`<div>`)

## Supported CSS Properties

The plugin supports the following CSS properties:

- `color` (text color)
- `background-color`
- `font-size`
- `font-weight`
- `line-height` (normal, px, %, unitless multiplier)
- `letter-spacing` (normal, px, em/rem as percent)
- `width` and `height` (for divs)
- `border`
- `border-radius`
- `padding`
- `margin`
- `text-align` (left, center, right)
- `opacity`
- `text-decoration` (underline, line-through)
- `box-shadow` (maps to Figma effects)
- `display` (block, inline, flex, none)

## Installation

1. Download or clone this repository
2. In Figma, go to Plugins > Development > Import plugin from manifest...
3. Select the `manifest.json` file from this repository

## Usage

1. In Figma, right-click and select Plugins > HTML to Figma
2. Enter your HTML in the left editor
3. Enter your CSS in the right editor
4. Click "Create Design" to generate Figma elements based on your markup

## Example

HTML:
```html
<h1>Hello Figma</h1>
<p>This is a paragraph with <span style="text-decoration: underline;">underlined</span> text.</p>
<div>This is a styled div</div>
<p>This is a paragraph of text.</p>
<div class="box">This is a styled div</div>
```

CSS:
```css
h1 {
  color: #ff0000;
  font-size: 32px;
  text-align: center;
}

p {
  color: #333333;
  font-size: 16px;
  opacity: 0.9;
  line-height: 1.6;
  letter-spacing: 0.1em; /* 10% in Figma */
}

.box {
  background-color: #e0f7fa;
  border: 2px solid #00bcd4;
  border-radius: 8px;
  padding: 16px;
  margin: 20px;
  width: 200px;
  height: 100px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
```

## Limitations

- The plugin currently uses a simplified HTML and CSS parser, so complex markup may not work correctly
- Complex selectors and cascading order are simplified; specificity is basic
- Limited CSS properties are supported
- The plugin does not support JavaScript or interactive elements

## Future Improvements

- Support for more HTML elements
- Support for nested elements
- Better CSS parsing and application
- Support for more CSS properties
- Preview functionality
- Error highlighting in the code editors

## License

MIT