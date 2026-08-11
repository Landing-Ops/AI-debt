/* =====================================================================
   traffic.js — 유입경로·광고분석 파라미터 파싱·저장 (읽기 전용 소스)
   ---------------------------------------------------------------------
   [역할]
   랜딩 도착 시 1회, URL 파라미터를 파싱해 규칙대로 변환하고
   sessionStorage(키: traffic)에 저장한다. 이후 진단·결과·팝업 화면은
   URL을 보지 않고 이 저장값만 참조한다(화면 이동 중 파라미터 누락 방지).

   [광고 분석용 필드 — 나중에 마케터용 분석 페이지/매체 API 연동 대비]
   지금은 한글로 저장(광고주·마케터가 바로 보기 좋게). 값은 준비되는 대로 채움.
   ┌─ URL 파라미터 → 저장 필드 → (나중에 매체 API 연동 시 대응할 UTM 표준) ─┐
   │  mp → media    유입매체     ↔ utm_source   (메타/구글/네이버SA…)          │
   │  rg → region   유입지역     ↔ (커스텀)     (서울/부산/전국…)              │
   │  ag → age      연령         ↔ (커스텀)     (20대/30대/40대…)              │
   │  ad → ad       광고소재     ↔ utm_content  (소재ID, 예: A_변제금)         │
   │  cp → campaign 캠페인       ↔ utm_campaign (예: 8월_변제금강조)           │
   │  st → adset    광고세트     ↔ (커스텀)     (타겟그룹, 예: 리타겟팅)       │
   │  lp → lp       랜딩버전     ↔ (커스텀)     (A안/B안, A/B테스트용)          │
   │  kw → keyword  키워드       ↔ utm_term     (검색광고 유입 키워드)         │
   │  (자동)device  디바이스     ↔ (커스텀)     (모바일/PC, 브라우저 감지)     │
   └──────────────────────────────────────────────────────────────────────┘
   ★ API 연동 시점에는 위 UTM 표준 파라미터(utm_source 등)를 그대로 읽도록
     확장하면 매체 리포트와 자동 매칭됨. 지금은 짧은 커스텀 파라미터 사용.

   [파싱 규칙]
   - media·region·age: 화이트리스트에 있는 값만 인정, 한글로 변환(오염 방지)
   - ad·campaign·adset·lp·keyword: 화이트리스트 없이 들어온 값 그대로 신뢰
   - device: URL 아닌 브라우저 userAgent로 자동 판별

   [OFF 방법]
   index.html에서 이 <script> 태그만 제거하면 됨. 저장값이 없으면
   이후 화면은 기본값('직접유입' 등)으로 폴백하도록 설계할 것.

   [URL 파라미터 넣는 법 — 광고 세팅할 때 랜딩 주소 뒤에 붙이기]
   첫 파라미터 앞엔 ?, 그 다음부터는 & 로 이어붙임. 순서는 상관없음.
   필요한 것만 골라 붙이면 됨(안 붙인 건 빈 값으로 저장).

   · 메타 광고, 서울 타겟, 20~65세, A소재:
     ...?mp=meta&rg=seoul&ag=2065&ad=A_변제금

   · 구글 광고, 전국, 30~50세, 8월 캠페인:
     ...?mp=google&rg=all&ag=3050&cp=8월_변제금강조

   · 네이버SA 검색광고, 키워드까지:
     ...?mp=naversa&rg=seoul&kw=개인회생&ad=B_후기

   · 랜딩 A/B 테스트(같은 광고, 랜딩만 다르게):
     ...?mp=meta&ad=A_변제금&lp=A안   /   ...?mp=meta&ad=A_변제금&lp=B안

   · 풀 세팅(광고세트·랜딩버전까지 전부):
     ...?mp=meta&rg=gyeonggi&ag=2040&ad=C_압류&cp=9월캠페인&st=리타겟팅&lp=B안

   ※ 값 설명: mp=매체(meta/google/naversa…), rg=지역(seoul/busan/all…),
     ag=연령(4자리, 2065→20~65세), ad=소재ID, cp=캠페인, st=광고세트,
     lp=랜딩버전, kw=키워드. device(모바일/PC)는 URL 없이 자동 판별.
     한글·공백이 값에 들어가도 브라우저가 자동 인코딩하니 그냥 써도 됨.
===================================================================== */
(function () {
  'use strict';

  var KEY = 'traffic';   // ★ footer 계열의 'footer_media'와 분리 — 겹치지 않게

  /* =====================================================================
     [sid] 익명 세션 ID 발급 — 퍼널 추적용 (읽기 전용 꼬리표)
     ---------------------------------------------------------------------
     · 랜딩 진입 시 1회 발급해 sessionStorage('sid')에 저장. 세션(탭) 단위.
     · uid(리드 제출 시 발급되는 기능 키)와 완전 별개 — sid는 판정·인증·
       픽셀 어디에도 안 쓰이는 순수 추적용. 유실돼도 리드 저장엔 영향 없음.
     · ★ URL 파라미터 유무와 무관하게 무조건 실행(직접 유입도 sid가 있어야
       퍼널이 이어짐). 그래서 아래 traffic 파싱 분기보다 먼저, 여기서 처리.
     · 이미 있으면 유지(진단 중 화면 이동·새로고침에도 같은 sid 보존).
  ===================================================================== */
  (function ensureSid() {
    try {
      var sid = sessionStorage.getItem('sid');
      if (!sid) {
        sid = 'sid_' + Date.now().toString(36) + '_' +
              Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('sid', sid);
      }
    } catch (e) {}
  })();

  /* ---------- 화이트리스트 (미리 정한 값만 인정) ---------- */
  var MEDIA_MAP = {
    meta:'메타', facebook:'페이스북', insta:'인스타', instagram:'인스타',
    google:'구글', youtube:'유튜브', tiktok:'틱톡',
    carrot:'당근', kakao:'카카오',kakaobiz:'카카오-비즈',kakaodipl:'카카오-디플', naversa:'네이버SA', naverda:'네이버DA',
    direct:'테스트 유입'
  };
  var REGION_MAP = {
    all:'전국', seoul:'서울', busan:'부산', daegu:'대구', incheon:'인천',
    gwangju:'광주', daejeon:'대전', ulsan:'울산', sejong:'세종',
    gyeonggi:'경기', gangwon:'강원', chungbuk:'충북', chungnam:'충남',
    jeonbuk:'전북', jeonnam:'전남', gyeongbuk:'경북', gyeongnam:'경남', jeju:'제주'
  };

  /* 연령: 매체·지역과 달리 화이트리스트 안 씀(타겟이 범위라 자유). ★규칙 = 4자리 숫자.
     ag=2065 → '20~65세', ag=2040 → '20~40세' (앞2·뒤2로 쪼갬).
     4자리 숫자가 아니면(다른 형식) 들어온 값 원문 그대로 신뢰. */
  function parseAge(v) {
    if (!v) return '';
    if (/^\d{4}$/.test(v)) return v.slice(0, 2) + '~' + v.slice(2) + '세';
    return v;   // 규칙 밖 값은 원문 유지
  }

  var qs = new URLSearchParams(location.search);
  function pick(name){ return (qs.get(name) || '').trim().toLowerCase(); }
  function raw(name){ return (qs.get(name) || '').trim(); }   // 대소문자 유지

  /* ---------- 화이트리스트 대상 (오염 방지) ---------- */
  var mpRaw = pick('mp');   // 매체
  var rgRaw = pick('rg');   // 지역

  /* ---------- 원문 신뢰 대상 (마케터가 자유롭게 지정) ---------- */
  var agRaw = raw('ag');    // 연령 (4자리 숫자 → 범위 변환, 그 외 원문)
  var adRaw = raw('ad');    // 광고소재 ID
  var cpRaw = raw('cp');    // 캠페인
  var stRaw = raw('st');    // 광고세트
  var lpRaw = raw('lp');    // 랜딩버전
  var kwRaw = raw('kw');    // 키워드

  /* ---------- 디바이스 자동 감지 (URL 아님, 브라우저 판별) ---------- */
  function detectDevice() {
    var ua = (navigator.userAgent || '').toLowerCase();
    return /mobile|android|iphone|ipad|ipod/.test(ua) ? '모바일' : 'PC';
  }

  // URL에 광고 파라미터가 하나라도 있으면 파싱해 저장, 없으면(재방문 등) 이전 값 재사용
  var hasParam = mpRaw || rgRaw || agRaw || adRaw || cpRaw || stRaw || lpRaw || kwRaw;

  if (hasParam) {
    var traffic = {
      media:    MEDIA_MAP[mpRaw]  || '직접유입',
      region:   REGION_MAP[rgRaw] || '전국',
      age:      parseAge(agRaw),
      ad:       adRaw || '',
      campaign: cpRaw || '',
      adset:    stRaw || '',
      lp:       lpRaw || '',
      keyword:  kwRaw || '',
      device:   detectDevice()
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(traffic)); } catch (e) {}
  } else {
    /* 광고 파라미터가 전혀 없는 직접 유입: 최소한 디바이스는 남겨둠.
       (기존 저장값이 있으면 건드리지 않고, 없을 때만 기본 객체 생성) */
    var existing = null;
    try { existing = sessionStorage.getItem(KEY); } catch (e) {}
    if (!existing) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          media:'직접유입', region:'전국', age:'', ad:'',
          campaign:'', adset:'', lp:'', keyword:'', device: detectDevice()
        }));
      } catch (e) {}
    }
  }

  /* =====================================================================
     [퍼널 핑] window.trackStep — 단계 도달을 worker /step으로 전송
     ---------------------------------------------------------------------
     · sendBeacon으로 비동기 전송(페이지 이탈해도 전송 보장, 응답 안 기다림).
     · sid는 sessionStorage에서 읽음. sid 없으면(예외) 조용히 스킵.
     · 어느 페이지든 traffic.js가 로드돼 있으므로 window.trackStep 호출 가능
       (index CTA·diagnosis 문항에서 이 함수만 부르면 됨).
     · 실패해도 무시 — 추적은 부가기능, 본 기능(진단·리드)에 영향 없어야 함.
  ===================================================================== */
  var STEP_URL = 'https://ai-debt.softman007.workers.dev/step';

  function getSid() {
    try { return sessionStorage.getItem('sid') || ''; } catch (e) { return ''; }
  }
  function getTrafficObj() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }

  function trackStep(step, extra) {
    var sid = getSid();
    if (!sid || !step) return;
    var payload = { sid: sid, step: step };
    if (extra) { for (var k in extra) if (extra.hasOwnProperty(k)) payload[k] = extra[k]; }
    try {
      var blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(STEP_URL, blob);
      } else {
        // sendBeacon 미지원 폴백 — keepalive fetch
        fetch(STEP_URL, { method: 'POST', body: JSON.stringify(payload), keepalive: true }).catch(function(){});
      }
    } catch (e) {}
  }
  window.trackStep = trackStep;   // 다른 스크립트(index CTA·diagnosis)에서 호출

  /* [enter 핑] 랜딩 진입 1회 — sid 행 생성 + 유입정보 저장.
     traffic.js는 index·diagnosis·result 3곳에 로드되므로, '랜딩에서만 1회'를
     세션 플래그로 보장(진단·결과 재로드 때 enter 중복 발사 방지). */
  (function fireEnterOnce() {
    try {
      if (sessionStorage.getItem('sid_entered')) return;   // 이미 이 세션에서 enter 보냄
      sessionStorage.setItem('sid_entered', '1');
      trackStep('enter', { traffic: getTrafficObj() });
    } catch (e) {}
  })();

})();