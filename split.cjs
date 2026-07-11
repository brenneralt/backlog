const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf-8');

// Extract CSS
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  fs.writeFileSync('style.css', styleMatch[1].trim());
}

// Extract JS
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.writeFileSync('src/main.js', scriptMatch[1].trim());
}

// Create clean index.html
let cleanHtml = html;
if (styleMatch) {
  cleanHtml = cleanHtml.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/style.css">');
}
if (scriptMatch) {
  cleanHtml = cleanHtml.replace(/<script>[\s\S]*?<\/script>/, '<script type="module" src="/src/main.js"></script>');
}

fs.writeFileSync('index.html', cleanHtml);
console.log('Split successful');
