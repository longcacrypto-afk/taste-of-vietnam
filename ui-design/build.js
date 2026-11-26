// =============================================================================
// BUNDLER FOR 99-SCREEN UI/UX STUDIO & LIVE MODULE ACTION RUNNER (M1-M20)
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');
const thumbsDir = path.join(__dirname, 'assets', 'thumbs_hq');

const shellHtml = fs.readFileSync(path.join(srcDir, 'app_shell.html'), 'utf8');

// 1. Load all 34 ChatGPT HQ JPEGs as base64 data URIs
const imagesMap = {};
for (const file of fs.readdirSync(thumbsDir).sort()) {
  const m = file.match(/^uid_(\d+)\.jpg$/);
  if (m) {
    const b64 = fs.readFileSync(path.join(thumbsDir, file)).toString('base64');
    imagesMap[m[1]] = `data:image/jpeg;base64,${b64}`;
  }
}

// 2. Concatenate all JS modules
const jsFiles = [
  'ui_kit.js',
  'screens_m1_m2.js',
  'screens_m3_m4_m5_m8.js',
  'screens_web_m6_m7.js',
  'screens_m9_m10_expansion.js'
];

const scriptsBlock = jsFiles
  .map(f => `<script>\n${fs.readFileSync(path.join(srcDir, f), 'utf8')}\n</script>`)
  .join('\n');

const bundled = shellHtml
  .replace('/*__IMAGES_DATA_PLACEHOLDER__*/ {}', JSON.stringify(imagesMap))
  .replace('<!--/*__SCREENS_JS_PLACEHOLDER__*/-->', scriptsBlock)
  .replace('<!--/*__PRODUCT_RUNTIME__*/-->', () => `<script>\n${['admin_dish_forms.js', 'admin_place_forms.js', 'admin_rbac_audit.js', 'admin_forms.js', 'product_runtime.js'].map(f => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n')}\n</script>`);

const outIndex = path.join(__dirname, 'index.html');
fs.writeFileSync(outIndex, bundled, 'utf8');
console.log(`✔ Bundled 99-Screen UI/UX Studio (${(bundled.length / 1024 / 1024).toFixed(2)} MB) to ${path.relative(process.cwd(), outIndex) || outIndex}.`);

// Optional extra copy (e.g. a local preview folder): UI_BUILD_ARTIFACT=/path/to/file.html npm run build:ui
const outArtifact = process.env.UI_BUILD_ARTIFACT;
if (outArtifact) {
  fs.mkdirSync(path.dirname(outArtifact), { recursive: true });
  fs.writeFileSync(outArtifact, bundled, 'utf8');
  console.log(`✔ Also wrote ${outArtifact}`);
}
