const fs = require("fs");
const src = fs.readFileSync("src/routes/guild.ts", "utf8");
let depth = 0;
let inStr = false, inTpl = false, inLineComment = false, inBlockComment = false;
let prev = '';
for (let i = 0; i < src.length; i++) {
  const ch = src[i];
  const pair = prev + ch;
  if (inLineComment && ch === '\n') { inLineComment = false; prev = ch; continue; }
  if (inBlockComment && pair === '*/') { inBlockComment = false; prev = ''; continue; }
  if (!inStr && !inTpl && !inLineComment && !inBlockComment) {
    if (pair === '//') inLineComment = true;
    else if (pair === '/*') inBlockComment = true;
    else if (ch === '`') inTpl = true;
    else if (ch === "'") inStr = true;
    else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
  } else if (inTpl && ch === '`' && prev !== '\\') {
    inTpl = false;
  } else if (inStr && (ch === "'" || ch === '"') && prev !== '\\') {
    inStr = false;
  }
  prev = ch;
}
console.log("Depth:", depth);
if (depth > 0) console.log("Missing", depth, "closing braces");
else if (depth < 0) console.log("Extra", -depth, "closing braces");
else console.log("BALANCED!");
