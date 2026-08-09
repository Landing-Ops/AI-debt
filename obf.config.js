// obf.config.js
// ─────────────────────────────────────────────────────────────
// ★ 이 설정은 JS 파일만 난독화한다 (obfuscate.js 전용).
//   CSS는 cleancss(build:css), HTML은 build-html.js(build:html)가 따로 처리.
//   여기 files 배열에는 -nude.js 파일만 넣는다.
//
// 난독화 강도 프리셋 정의 + 파일별 매핑.
// ★ 파일 추가 / 제외 / 강도변경은 전부 이 파일에서만 한다.
//
// [이 프로젝트 방침] 핵심 계산 로직은 이미 서버(Cloudflare Worker)로 옮겨
//   프론트 JS엔 민감 로직이 거의 없다. 그래서 난독화는 '보호'보다 '안 깨지게'가
//   우선 → 전반적으로 약하게. 강하게 걸면 form.submit·sendBeacon·이벤트 콜백·
//   fetch 계열이 깨지므로, 파일 성격에 맞는 최소 강도만 적용한다.
// ─────────────────────────────────────────────────────────────

// [공통] 모든 프리셋이 상속하는 베이스
const BASE = {
  compact: true,
  simplify: true,
  target: 'browser',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  identifierNamesGenerator: 'mangled',
};

// [MINIMAL] light 로도 깨지는 파일용 — 문자열/구조 일절 안 건드림
//   · string-array 자체를 OFF → 문자열이 원본 그대로 남음 (base64 디코더 없음)
//   · 변수/함수명만 mangle. -nude.js(난독화 0) 바로 위 단계.
//   · CustomEvent 문자열·이벤트명이 base64 디코딩에서 깨지는 파일에 사용
const MINIMAL = {
  compact: true,
  simplify: true,
  target: 'browser',
  identifierNamesGenerator: 'mangled',
  stringArray: false,          // ★ 핵심: 문자열 배열/인코딩 전부 없음
  selfDefending: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  splitStrings: false,
  numbersToExpressions: false,
};

// [LIGHT] 깨지기 쉬운 파일용 — 문자열만 가리고 구조는 안 건드림
//   · self-defending / control-flow / dead-code 전부 OFF
//   · form.submit(), iframe 미러링, fetch/sendBeacon 계열에 안전
const LIGHT = {
  ...BASE,
  stringArrayThreshold: 0.75,
  selfDefending: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  splitStrings: false,
  numbersToExpressions: false,
};

// [MEDIUM] 일반 파일용 — 구조 변형 넣되 위험 옵션은 절제
const MEDIUM = {
  ...BASE,
  stringArrayThreshold: 1,
  splitStrings: true,
  splitStringsChunkLength: 8,
  numbersToExpressions: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,   // 용량 대비 효용 낮아 기본 OFF
  selfDefending: false,       // 디버깅 방해 크므로 heavy 에서만
};

// [HEAVY] 핵심 로직 보호용 — 최고 강도
//   · 노출되면 안 되는 파일에만. 이 프로젝트는 로직이 서버에 있어 거의 안 씀.
const HEAVY = {
  ...BASE,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 5,
  numbersToExpressions: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.8,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  selfDefending: true,
};

// ─────────────────────────────────────────────────────────────
// 파일별 매핑
//   preset: 'minimal' | 'light' | 'medium' | 'heavy'
//   · 파일 추가: files 배열에 { src, preset, reason } 한 줄 추가
//   · 파일 제외: 해당 항목 삭제 (또는 빌드 시 --skip=키워드)
//   · reason 은 "왜 이 강도인지" 근거 — 나중 유지보수용이니 꼭 남길 것
// ─────────────────────────────────────────────────────────────
module.exports = {
  presets: { minimal: MINIMAL, light: LIGHT, medium: MEDIUM, heavy: HEAVY },

  files: [
    // ── index.html (랜딩) ──
    {
      src: 'js/traffic-nude.js',
      preset: 'minimal',
      reason: 'URL 파라미터 파싱 + sessionStorage 저장. 이벤트/전송 없어 light도 되나, 프로젝트 방침(위험군 전부 minimal 통일)에 맞춰 minimal.'
    },
    {
      src: 'js/review-slider-nude.js',
      preset: 'medium',
      reason: '순수 UI 슬라이더(드래그·transform). 외부 통신 없어 구조변형 넣어도 무방 → medium.'
    },

    // ── diagnosis.html (진단) ──
    {
      src: 'js/diagnosis-nude.js',
      preset: 'minimal',
      reason: 'sessionStorage 저장 + pushState/popstate 히스토리 제어 + 이벤트 위임. result.js가 light(base64)에서 깨진 전례 → 문자열인코딩 위험 회피 위해 minimal.'
    },

    // ── result.html (결과) ──
    {
      src: 'js/result-nude.js',
      preset: 'minimal',
      reason: 'fetch(/calc) 응답으로 화면 렌더 + Chart.js + 팝업 제어. light(base64 문자열인코딩)에서 o[ai(...)][ai(...)] is not a function 에러로 계산 멈춤 → string-array 통째 OFF → minimal (실측 확정).'
    },
    {
      src: 'js/lead-form-nude.js',
      preset: 'minimal',
      reason: 'OTP 인증·리드 제출 fetch + 전화검증 + submitPartnerForm 호출. 전송/콜백 많음. result.js가 light(base64)에서 is-not-a-function으로 깨진 전례 → 같은 위험이라 minimal.'
    },
    {
      src: 'js/partner-form-nude.js',
      preset: 'minimal',
      reason: 'iframe form.submit() 미러링. 구조변형은 물론 문자열 인코딩도 전송 깨뜨릴 수 있어 최저강도 → minimal.'
    },

    // ── thanks.html (땡큐) ──
    {
      src: 'js/thanks-uid-resolver-nude.js',
      preset: 'minimal',
      reason: 'fetch(/lookup) + CustomEvent dispatch. light(base64)도 이벤트명 문자열 깨뜨려 charAt 에러 → string-array 통째 OFF → minimal.'
    },
    {
      src: 'js/thanks-countdown-nude.js',
      preset: 'minimal',
      reason: 'resolver의 CustomEvent를 addEventListener로 수신해 boot. 구조변형·문자열인코딩이 이벤트 바인딩 깨뜨려 타이머 미작동 → minimal. (UI라 노출 손해 적음)'
    },
    {
      src: 'js/thanks-tracking-nude.js',
      preset: 'minimal',
      reason: 'sendBeacon 트래킹 + CustomEvent 수신. result.js가 light(base64)에서 깨진 전례 → 문자열인코딩 위험 회피 위해 minimal.'
    },
    {
      src: 'js/thanks-review-cards-nude.js',
      preset: 'minimal',
      reason: 'light(base64)에서 브라우저 charAt 에러 다수. string-array 통째 OFF 필요 → minimal. (UI라 노출 손해 적음)'
    },
    {
      src: 'js/thanks-verdicts-nude.js',
      preset: 'heavy',
      reason: '단순 마퀴(복제+CSS변수). 외부통신·이벤트콜백 없어 뭘 걸어도 안 깨짐 → 강도 올려도 무방.'
    },
  ],
};