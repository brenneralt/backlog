const fs = require('fs');

const lines = fs.readFileSync('src/main.js', 'utf-8').split('\n');

// Helper to get chunk
function getChunk(startRegex, endRegex) {
    let startIdx = lines.findIndex(l => startRegex.test(l));
    let endIdx = lines.findIndex((l, i) => i > startIdx && endRegex.test(l));
    if (endIdx === -1) endIdx = lines.length;
    return lines.slice(startIdx, endIdx).join('\n');
}

// 1. Extract Store
const storeChunk = lines.slice(1, 71).join('\n');
const storeContent = storeChunk
    .replace('const S = {', 'export const S = {')
    .replace('function saveSess()', 'export function saveSess()')
    .replace('function loadSess()', 'export function loadSess()')
    .replace('function loadPosterCache()', 'export function loadPosterCache()')
    .replace('function savePosterCache()', 'export function savePosterCache()')
    .replace('function loadRatingsCache()', 'export function loadRatingsCache()')
    .replace('function saveRatingsCache()', 'export function saveRatingsCache()');

fs.mkdirSync('src/infrastructure', { recursive: true });
fs.writeFileSync('src/infrastructure/store.js', storeContent);

console.log('Store extracted.');
