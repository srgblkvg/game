// scripts/build-icons.js — вырезает только используемые иконки из game-icons
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const iconsJson = path.join(__dirname, '..', 'node_modules', '@iconify-json', 'game-icons', 'icons.json');
const outJson = path.join(__dirname, '..', 'src', 'icons-filtered.json');

const full = JSON.parse(fs.readFileSync(iconsJson, 'utf8'));

// Собираем все упоминания game-icons:имя из исходников
const used = new Set();
function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!/\.[tj]sx?$/.test(entry.name)) continue;
        const content = fs.readFileSync(p, 'utf8');
        for (const m of content.matchAll(/game-icons:([a-z0-9-]+)/g)) {
            used.add(m[1]);
        }
    }
}
walk(srcDir);

// Добавляем алиасы (iconify использует их для поиска)
const aliases = full.aliases || {};
const neededAliases = {};
for (const [alias, target] of Object.entries(aliases)) {
    if (used.has(alias) || used.has(target)) {
        neededAliases[alias] = target;
        used.add(target);
    }
}

// Фильтруем иконки
const filtered = {
    prefix: full.prefix,
    icons: {},
    width: full.width,
    height: full.height,
};
if (Object.keys(neededAliases).length > 0) {
    filtered.aliases = neededAliases;
}

for (const name of used) {
    if (full.icons[name]) {
        filtered.icons[name] = full.icons[name];
    } else {
        console.warn(`Icon not found in game-icons: ${name}`);
    }
}

fs.writeFileSync(outJson, JSON.stringify(filtered));
console.log(`Filtered: ${Object.keys(full.icons).length} → ${Object.keys(filtered.icons).length} icons`);
console.log(`Output: ${outJson}`);
