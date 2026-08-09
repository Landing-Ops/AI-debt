// obfuscate.js
// ─────────────────────────────────────────────────────────────
// ★ 이 스크립트는 JS 파일만 난독화한다.
//   CSS는 cleancss(build:css), HTML은 build-html.js(build:html)가 따로 담당.
//   obf.config.js 의 files 배열(-nude.js 목록)을 읽어 파일별 프리셋으로 난독화.
//   설정은 전부 obf.config.js 에서 — 이 파일은 한 번 만들면 건드릴 일 없다.
//
// 사용법:
//   node obfuscate.js                → config 의 모든 JS 파일
//   node obfuscate.js --only=partner → src 경로에 'partner' 포함된 것만
//   node obfuscate.js --skip=verdicts → 'verdicts' 포함된 것 제외
//   (--only / --skip 은 '포함 여부' 매칭. 정확한 파일명 전체를 칠 필요 없음)
// ─────────────────────────────────────────────────────────────
const fs = require('fs');
const JSObfuscator = require('javascript-obfuscator');
const { presets, files } = require('./obf.config.js');

// -nude.js → .js
function outName(src) {
  return src.replace(/-nude\.js$/, '.js');
}

// CLI 필터 파싱 (--only= / --skip=)
const args = process.argv.slice(2);
const onlyArg = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
const skipArg = (args.find(a => a.startsWith('--skip=')) || '').split('=')[1];

let targets = files;
if (onlyArg) targets = targets.filter(f => f.src.includes(onlyArg));
if (skipArg) targets = targets.filter(f => !f.src.includes(skipArg));

if (!targets.length) {
  console.log('⚠️  처리할 파일이 없습니다.');
  process.exit(0);
}

for (const item of targets) {
  const { src, preset, reason } = item;
  const out = outName(src);

  if (!fs.existsSync(src)) {
    console.log(`❌  없음: ${src}`);
    continue;
  }

  const opts = presets[preset];
  if (!opts) {
    console.log(`❌  알 수 없는 preset '${preset}': ${src}`);
    continue;
  }

  const code = fs.readFileSync(src, 'utf8');
  const result = JSObfuscator.obfuscate(code, opts).getObfuscatedCode();
  fs.writeFileSync(out, result, 'utf8');

  console.log(`✔  [${preset.padEnd(6)}] ${src} → ${out}  (${reason || ''})`);
}

console.log('\n✅ JS 난독화 완료');