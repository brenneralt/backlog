const fs = require('fs');

const code = fs.readFileSync('src/main.js', 'utf-8');
const lines = code.split('\n');

const functions = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^(?:\s*)(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
  if (match) {
    functions.push({ name: match[1], line: i + 1 });
  }
}

fs.writeFileSync('functions.json', JSON.stringify(functions, null, 2));
console.log(`Found ${functions.length} functions.`);
