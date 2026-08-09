// build-css.js
// ─────────────────────────────────────────────────────────────
// 폴더의 모든 *-nude.css 를 자동 수집해 cleancss로 압축한다.
// build-html.js 와 동일한 패턴 방식 → CSS 파일이 늘어도 목록 수정 불필요
// (예전엔 package.json build:css 에 파일을 하나씩 나열해서 thanks 계열이
//  빠지는 누락이 있었음. 이 스크립트로 대체하면 그런 누락이 원천 차단됨).
//
// 사용법: node build-css.js
//   css/*-nude.css → css/*.css (-nude 뗀 이름)로 각각 출력.
// ─────────────────────────────────────────────────────────────
const { execSync } = require("child_process");
const path = require("path");
const glob = require("glob");

// css/ 폴더의 모든 -nude.css 수집 (thanks-*-nude.css 같은 다중 하이픈도 포함)
const files = glob.sync("css/*-nude.css");

if (!files.length) {
  console.log("⚠️  css/ 에서 *-nude.css 를 찾지 못했습니다.");
  process.exit(0);
}

files.forEach(file => {
  const base = path.basename(file);
  // -nude.css → .css
  const outName = base.replace("-nude.css", ".css");
  const outPath = path.join(path.dirname(file), outName);

  console.log(`➡️  압축: ${file} → ${outPath}`);
  execSync(`cleancss -O2 -o ${outPath} ${file}`, { stdio: "inherit" });
});

console.log("✅ CSS auto build 완료 (nude 패턴)");
