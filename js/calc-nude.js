/* =====================================================================
   calc.js — 개인회생 탕감액 계산 엔진 (순수 로직)
   ---------------------------------------------------------------------
   [역할]
   sessionStorage의 진단 답변(8개)을 받아 신청가능 여부 판정 + 탕감액 계산.
   화면 렌더와 분리된 순수 함수. window.JindanCalc.run() 하나만 노출.
   생계비·지역주거비 데이터는 living-cost.js(window.LIVING_COST)에서 읽음.

   [입력] 진단 답변 객체 (문자열 → 숫자 변환은 내부에서)
     q_region q_marital q_dependents q_income q_assets
     q_secured q_immunity q_debt

   ─────────────────────────────────────────────────────────────────────
   [신청불가 필터 — 6개, 하나라도 걸리면 verdict:'reject']

     ① 5년 내 면책이력 있음      q_immunity === '있음'          → 'immunity'
     ② 담보·체납 세금만 있음     q_secured  === '담보·체납만'    → 'secured'
     ③ 총채무 2,000만원 미만     q_debt < 20,000,000            → 'debt_min'
     ⑤ 재산 ≥ 채무               assets >= debt                 → 'over_asset'
     ⑥ 총채무 15억 초과          q_debt > 1,500,000,000         → 'debt_max'
     ④ 가용소득 0 이하           월소득 ≤ 합산생계비            → 'no_usable_income'

     ①②③⑤⑥은 계산 전 판정, ④는 생계비 산정 후 판정(가구원수·지역 필요).
     ⑤ 근거: 재산이 채무 이상이면 '지급불능'이 아니라 회생 대상 아님(법원 기각
             리스크). 이론상 이자면제형 회생은 가능하나, DB 판매가 목적인 우리
             모델에선 매입처(법무사)가 '재산≥채무' DB를 환불조건으로 못박아
             팔리지 않음 → 수집 안 하고 불가 처리(업계 표준). 재산=채무도 포함.
     ⑥ 근거: 법정 한도(무담보 10억/담보 15억) 초과 → 일반회생 대상.
             진단은 총채무만 받으므로 총액 15억으로 단순화.
     ④ 근거: 월소득이 (지역주거비 포함) 합산생계비 이하면 변제 재원(가용소득)이
             없어 회생 불가(실무상 파산 대상). 이 필터가 없으면 소득<생계비
             케이스가 '가용소득 0 → 탕감률 100%'로 잘못 나오던 결함을 막음.

   ─────────────────────────────────────────────────────────────────────
   [계산식 — 통과 시. ★이자 포함 방식]

     가구원수   = 1(본인) + 부양가족수     ("4명+" → 5인 구간 고정)
     생계비     = LIVING_COST[가구원수]    (2026 중위소득 60%, living-cost.js)
     지역주거비 = 권역한도 × 50%           (지역 보정 ⑧. living-cost.js)
                  q_region(17시도) → 권역(1~4) → 가구원수별 한도 × housingRate.
                  실제 월세를 안 받으므로 '평균 개념'으로 한도의 50%만 가산.
                  미매핑·빈 지역이면 0(안전). ★생계비 속 기본주거비와는
                  별개인 '추가주거비 인정 한도'만 더함(이중계산 아님).
     합산생계비 = 생계비 + 지역주거비       ← 실제 공제액(가용소득 계산 기준)
     가용소득   = 월소득 − 합산생계비        (④필터 통과 → 항상 양수)

     원금     = 입력 채무(q_debt)
     예상이자 = 원금 × 연 12% × 3년 (단리)   ← 개인회생 시 100% 면제
     총채무   = 원금 + 예상이자

     [법정변제액 3종 — 실제 법원은 셋 중 최댓값. 채무자회생법 614조]
       ⓐ 소득기준변제액 = 가용소득 × 36개월
       ⓑ 재산기준변제액 = 재산액                    (청산가치보장, 614조 1항 4호)
       ⓒ 최저변제액     = 원금 5,000만원 미만 → 원금 × 5%
                          원금 5,000만원 이상 → 원금 × 3% + 100만원
                          (상한 3,000만원)         (최저변제액, 614조 2항 3호)
       법정변제액 = max(ⓐ, ⓑ, ⓒ)

     회생 변제금 = min(법정변제액, 원금)    ← 이자 면제, 원금 초과 변제 없음
     예상탕감액   = 총채무 − 회생 변제금     (= 면제이자 + 원금탕감분)
     예상탕감률   = 예상탕감액 ÷ 총채무      (이자 포함 분모 → 최소 26% 항상 잡힘)

     결정요인(factor) = ⓐ·ⓑ·ⓒ 중 최댓값이 무엇이냐로 3분기 (원금 상한 前 값으로 판정)
       'income'  : ⓐ 소득기준이 최대 (가용소득 충분) — 블록5 상승 게이지
       'asset'   : ⓑ 재산기준이 최대 (청산가치 큼)   — 블록5 상승 게이지
       'minimum' : ⓒ 최저변제액이 최대 (소득·재산 모두 적음)
                   → 탕감률 92~97%로 이미 최상위. 블록5는 '상위 N%' 게이지 +
                     방어·확인 카피(더 올림 아님). upliftTarget은 null.

   ─────────────────────────────────────────────────────────────────────
   [변제기간 — factor × 밴드로 6갈래. MONTHS=36, MONTHS_MAX=60]

     ★수학적으로 딱 6갈래(각 factor당 2밴드):
       [income]  36개월 정확  /  36개월 미만(단축)   — 60초과 구조적 불가능
       [asset]   37~60개월    /  60개월 초과(overCap)— 36이내 수학적 불가능
       [minimum] 37~60개월    /  60개월 초과(overCap)— 36이내 수학적 불가능
     (재산·최저가 이기려면 회생변제금 > 가용×36이어야 하므로, 나누면 항상
      37개월↑. 36이내로 떨어지면 소득기준이 이겨 factor=income이 됨.)

     [income] 기본 36개월. 단, 법정변제액 ≥ 원금이면(원금 조기완납)
              n = ⌈원금 ÷ 월가용소득⌉ 로 단축(상한 36). shortened=true.
     [asset/minimum] needMonths = ⌈회생변제금 ÷ 월가용소득⌉.
              60개월 이하 → 그 개월수. 60 초과 → months=60 + overCap=true
              (현재 소득만으론 기간 내 완납 불가 → 재산처분 등 상담 유도).

     ★월 변제액 = min(가용소득, 회생변제금)  — 세 factor 공통.
       매달 가용소득 전액 투입이 실제 법원 방식(마지막 달만 잔액 정산).
       회생변제금÷months로 나누면 needMonths 올림(ceil) 탓에 가용소득과
       미세하게 어긋나므로, 가용소득으로 고정 → 블록1 월변제 = 블록2
       가용소득이 원 단위까지 항상 일치.

   ─────────────────────────────────────────────────────────────────────
   [블록5 '탕감률 상승 여지' 목표치 — 결과페이지 전환 장치]

     목표치 = min(현재탕감률 + 올림폭, 90)       ← 90% 상한 절대 우선
       올림폭 캡: 소득기준 +27%p / 재산기준 +21%p
       예) 소득 60%→87%, 68%→90%(캡), 75%→90%(상한우선)
           재산 60%→81%, 69%→90%
       minimum은 별도('상위 N%' 방어형) → upliftTarget=null.

   ─────────────────────────────────────────────────────────────────────
   [단순화 정책]
     실제 개인회생 완전판 공식(12개월 급여평균·4대보험 공제·배우자 재산
     기여도·라이프니츠 할인·면제재산·변제기간 연장 등)은 브라우저 8문항으로
     추정 불가 → 미반영(의도적). 관대하게 계산해 리드 확보, 정밀계산은 상담
     유도(결과페이지 블록5). 완전판 공식에서 '가용소득 0 불가'(④),
     '최저변제액 하한'(ⓒ), '지역 추가주거비'(⑧) 세 조각만 차용.
===================================================================== */
(function () {
  'use strict';

  var MONTHS = 36;                       // 변제기간 기본 36개월
  var MONTHS_MAX = 60;                    // 법정 최대 변제기간 60개월 (초과 시 재산처분 등 상담)
  var DEBT_MIN = 20000000;               // 신청 최소 채무액 2,000만원
  var DEBT_MAX = 1500000000;             // 개인회생 한도 — 총채무 15억 초과 시 일반회생 대상
                                         // (실제는 무담보10억/담보15억이나, 진단은 총액만
                                         //  받으므로 총채무 15억으로 단순화. 초고액자는 극소수)

  /* 예상이자 — 입력받은 채무를 '원금'으로 보고, 개시 전 이자를 추정.
     회생 신청자는 카드론·대부업 등 고금리 비중이 높아 연 12%로 잡음
     (1금융 5%대보다 높고 법정최고 20%보다 낮은 현실선). 단리 × 3년.
     개인회생 시 이자는 100% 면제되므로 이 이자 전액이 탕감액에 잡힘 */
  var INTEREST_RATE = 0.12;              // 연 12%
  var INTEREST_YEARS = 3;                // 3년(36개월) 기준
  function estInterest(principal) {
    return Math.round(principal * INTEREST_RATE * INTEREST_YEARS);
  }

  /* 최저변제액 하한선 (채무자회생법 제614조 2항 3호)
     변제총액은 [소득기준·재산기준·최저변제액] 중 최댓값으로 결정.
     법조문상 '채권자 이의 시' 조건부지만 실무상 사실상 전원 적용 →
     하한선으로 모두에게 적용. 실제로 이 값이 이기는 건 소득·재산이
     모두 적은 소수 케이스뿐(대다수는 소득/재산기준이 더 큼) */
  var MIN_REPAY_CAP = 30000000;          // 최저변제액 상한 3,000만원
  var MIN_REPAY_THRESHOLD = 50000000;    // 채무 5,000만원 기준
  function minRepay(debt) {
    var v = debt < MIN_REPAY_THRESHOLD
      ? debt * 0.05                      // 5천만 미만: 5%
      : debt * 0.03 + 1000000;           // 5천만 이상: 3% + 100만원
    return Math.min(v, MIN_REPAY_CAP);   // 상한 3,000만원
  }

  /* 블록5 '탕감률 상승 여지' — 최대 목표치 산정 규칙
     현재 탕감률에 최대 올림폭을 더하되, 90% 상한을 절대 안 넘김(상한 우선).
     올림폭 캡: 소득기준 27%p / 재산기준 21%p */
  var UPLIFT_CAP = 90;                   // 상한(%) — 절대 안 넘음
  var UPLIFT_ADD = { income: 27, asset: 21 };   // 최대 올림폭(%p)

  function upliftTarget(ratePct, factor) {
    var add = UPLIFT_ADD[factor] || UPLIFT_ADD.income;
    return Math.min(ratePct + add, UPLIFT_CAP);  // min(현재+캡, 90)
  }

  /* 부양가족수 응답('0'~'4+') → 가구원수(본인 포함) */
  function householdSize(dependentsRaw) {
    var dep;
    if (dependentsRaw === '4+') dep = 4;           // "4명+" → 본인+4 = 5인
    else dep = parseInt(dependentsRaw, 10) || 0;
    var size = 1 + dep;                            // 본인 포함
    return size;
  }

  /* 생계비 조회 (5인 이상은 cap 값으로 통일) */
  function livingCost(size) {
    var t = window.LIVING_COST;
    var cap = t.cap || 5;
    var key = size >= cap ? cap : size;
    return t.byHousehold[key];
  }

  /* 지역 추가주거비 조회 — 권역 한도 × housingRate(50%)
     q_region(17개 시도) → 권역(1~4) → 가구원수별 한도 → ×비율
     매핑/한도 없으면 0 반환(안전). 5인 이상은 cap(=4or5)로 통일 */
  function housingCost(region, size) {
    var t = window.LIVING_COST;
    if (!t.housingByZone || !t.regionZone) return 0;   // 데이터 없으면 가산 0
    var zone = t.regionZone[region];
    if (!zone) return 0;                               // 미매핑 지역 → 0
    var cap = t.cap || 5;
    var key = size >= cap ? cap : size;
    var limit = t.housingByZone[zone] && t.housingByZone[zone][key];
    if (!limit) return 0;
    return Math.round(limit * (t.housingRate || 0));   // 한도 × 비율(50%)
  }

  /* 숫자 파싱 (sessionStorage는 순수 숫자문자열로 저장돼 있음) */
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  /* =====================================================================
     메인: 답변 → 판정 + 계산결과
  ===================================================================== */
  function run(a) {
    var income = num(a.q_income);
    var assets = num(a.q_assets);
    var debt   = num(a.q_debt);

    /* ---------- 1단계: 신청불가 필터 (선행 5개 — 계산 불필요) ---------- */
    var rejectReasons = [];
    if (a.q_immunity === '있음')          rejectReasons.push('immunity');    // ① 5년내 면책이력
    if (a.q_secured === '담보·체납만')     rejectReasons.push('secured');     // ② 담보·체납만
    if (debt < DEBT_MIN)                  rejectReasons.push('debt_min');    // ③ 2천만 미만
    if (debt > DEBT_MAX)                  rejectReasons.push('debt_max');    // ⑥ 15억 초과(일반회생 대상)
    if (assets >= debt)                   rejectReasons.push('over_asset');  // ⑤ 재산≥채무(지급불능 아님)

    if (rejectReasons.length) {
      return { verdict: 'reject', reasons: rejectReasons };
    }

    /* ---------- 2단계: 생계비 산정 ---------- */
    var size    = householdSize(a.q_dependents);
    var baseCost = livingCost(size);                    // 순수 중위소득60% 생계비
    var housing  = housingCost(a.q_region, size);       // 지역 추가주거비(한도×50%)
    var cost     = baseCost + housing;                  // 실제 공제 생계비(합산)

    /* ---------- 필터 ④: 가용소득 없음 (월소득 ≤ 합산생계비) ----------
       월소득이 (지역주거비 포함) 합산생계비 이하면 가용소득이 0 → 변제
       재원이 없어 개인회생 자체가 불가(실무상 파산 대상). 이 필터가 없으면
       소득<생계비 케이스가 '가용소득 0 → 재산기준 → 탕감률 100%'로 잘못
       나오던 결함을 막음. ※ 지역 주거비 포함 합산 기준이라 수도권은 문턱↑ */
    var usable  = income - cost;                        // 가용소득(음수 가능)
    if (usable <= 0) {
      return { verdict: 'reject', reasons: ['no_usable_income'] };
    }

    /* ---------- 3~7단계: 계산 (이자 포함 방식) ----------
       입력 채무(debt)를 '원금'으로 보고, 예상이자를 더해 '총채무'를 만든다.
       개인회생은 이자 100% 면제 → 아무리 많이 갚아도 상한은 '원금'.
       탕감액·탕감률은 (원금+이자) 기준으로 산정 → 이자 면제분이 항상 탕감에 잡힘.
       (똑생 등 벤치마킹 대상과 동일한 구조) */
    var principal = debt;                            // 원금 = 입력 채무
    var interest  = estInterest(principal);          // 예상이자(면제 대상)
    var totalDebt = principal + interest;            // 총채무

    var byIncome = usable * MONTHS;                  // 소득기준변제액
    var byAsset  = assets;                           // 재산기준변제액
    var byMin    = minRepay(principal);              // 최저변제액(원금 기준 하한)

    // 법정 변제액 = 세 값 중 최댓값 (실제 법원 공식)
    var legalRepay = Math.max(byIncome, byAsset, byMin);

    /* 결정요인 플래그(블록5 버전 분기) — 3분기. 원금 상한 적용 前 값으로 판정
       (누가 변제액을 결정했는지가 블록5 메시지를 정하므로) */
    var factor;
    if (byMin >= byIncome && byMin >= byAsset)      factor = 'minimum';
    else if (byIncome >= byAsset)                    factor = 'income';
    else                                             factor = 'asset';

    /* 회생 변제금 = min(법정변제액, 원금) — 이자 면제, 원금 초과 변제 없음.
       법정변제액이 원금을 넘으면(고소득 등) 원금 100% 변제 + 기간 단축 */
    var repay   = Math.min(legalRepay, principal);

    /* 변제기간 산정 — factor별로 다름
       [income] 가용소득으로 변제 → 기본 36개월. 법정변제액≥원금이면 단축(원금 조기완납)
       [asset/minimum] 회생변제금(재산·최저)을 가용소득으로 나눠 필요개월 산출.
                       60개월(법정 최대) 이하면 그 개월수, 초과면 '재산 처분 등 상담 필요'
       필요개월 = ⌈회생변제금 ÷ 월가용소득⌉. 가용소득 극소면 개월수 폭증 → overCap */
    var months = MONTHS;
    var shortened = false;
    var overCap = false;                      // 60개월(법정 최대) 초과 → 상담 필요
    var needMonths = null;                     // 실제 필요 개월수(참고용)

    if (factor === 'income') {
      // 소득기준: 원금 조기완납 시 단축
      if (legalRepay >= principal && usable > 0) {
        months = Math.ceil(principal / usable);
        if (months > MONTHS) months = MONTHS;
        shortened = months < MONTHS;
      }
    } else {
      // 재산기준·최저변제액: 회생변제금을 가용소득으로 나눠 필요개월
      needMonths = usable > 0 ? Math.ceil(repay / usable) : Infinity;
      if (needMonths <= MONTHS) {
        months = needMonths;                   // 36개월 이내로 가능
      } else if (needMonths <= MONTHS_MAX) {
        months = needMonths;                   // 36~60개월 (연장으로 가능)
      } else {
        months = MONTHS_MAX;                   // 60개월 초과 → 상한 표시 + 상담
        overCap = true;
      }
    }

    /* 월 변제액 — 세 factor 공통: 매달 가용소득 전액 투입(실제 법원 방식).
       월변제 = min(가용소득, 회생변제금). 마지막 달만 잔액 정산.
       회생변제금÷months로 나누면 needMonths 올림(ceil) 탓에 가용소득과
       미세하게 어긋나므로(예 5천만÷17=294만 ≠ 가용296만), 가용소득으로 고정해
       블록1 월변제와 블록2 가용소득이 항상 일치하게 함.
       (income 일반케이스는 회생변제금=가용×36이라 어차피 가용소득과 같음) */
    var monthly = Math.min(usable, repay);

    var reduced = Math.max(0, totalDebt - repay);    // 예상탕감액(= 면제이자 + 원금탕감분)
    var rate    = totalDebt > 0 ? reduced / totalDebt : 0;   // 예상탕감률(총채무 기준)

    // 블록5 상승 목표치 — 소득/재산 버전만 사용(minimum은 '상위 N%'라 별도)
    var ratePct = Math.round(rate * 1000) / 10;      // 소수1자리 %
    var upTarget = (factor === 'minimum')
      ? null
      : upliftTarget(ratePct, factor);

    return {
      verdict: 'accept',
      factor: factor,
      upliftTarget: upTarget,
      household: size,
      livingCost: cost,               // 합산 생계비(순수+지역) — 가용소득 계산 기준
      baseCost: baseCost,             // 순수 중위소득60% 생계비 (블록2 '생계비' 줄)
      housing: housing,               // 지역 추가주거비(한도×50%) (블록2 '지역 주거비' 줄)
      region: a.q_region || '',       // 거주 지역명 (블록2 지역 주거비 줄 라벨)
      income: income,
      assets: assets,
      principal: principal,           // 원금(= 입력 채무)
      interest: interest,             // 예상이자(면제 대상)
      debt: totalDebt,                // 총채무(원금+이자) — 탕감률 분모
      usable: usable,
      minRepay: byMin,                // 최저변제액 (블록2 minimum 카드용)
      repay: repay,                   // 회생 변제금(원금 상한)
      reduced: reduced,               // 예상 탕감액(이자면제 + 원금탕감)
      rate: rate,                     // 예상 탕감률(총채무 기준)
      monthly: monthly,               // 월 변제액
      months: months,                 // 변제기간(단축 시 <36, 초과 시 60)
      shortened: shortened,            // 기간 단축 여부(income)
      overCap: overCap,                // 60개월 초과 여부(asset/minimum → 상담 필요)
      needMonths: needMonths           // 실제 필요 개월수(참고, Infinity 가능)
    };
  }

  window.JindanCalc = {
    run: run,
    DEBT_MIN: DEBT_MIN,
    MONTHS: MONTHS
  };
})();
