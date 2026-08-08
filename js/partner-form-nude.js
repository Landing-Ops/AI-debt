/* =====================================================================
   partner-form.js — 제휴사(리플 / 변호사 이정용 법률사무소) 폼 동시 전송
   ---------------------------------------------------------------------
   [역할]
   1) 화면에 보이지 않는 제휴사 전송용 <form>과 <iframe>을 문서에 심는다.
   2) 우리 리드팝업 입력값 + 진단답변(sessionStorage)을 제휴사 폼에
      실시간 미러링해둔다.
   3) window.submitPartnerForm() 함수를 전역에 노출한다.
      → lead-form.js 의 제출 핸들러가 (있으면) 이 함수를 호출한다.

   [AI진단 구조에 맞춘 변경점 — 기존 랜딩 버전과 다른 점]
   - 폼 컨테이너: [data-form="lead"]  →  [data-rz="lead-modal"] (결과페이지 팝업)
   - 전화번호   : 3분할(phone1/2/3)  →  단일칸(lead-phone) → 코드에서 010 / 중간4 / 끝4 로 쪼갬
   - 소득·채무·지역 등 진단값은 팝업에 없음 → sessionStorage(q_income·q_debt…)에서 읽음
   - item2(한줄문의)에 진단값 + 통화시간 + 문의사항을 ' / '로 이어붙여 전달

   [동작 원리 — 기존과 동일]
   - 제휴사 서버는 CORS 때문에 fetch/XHR 불가. 네이티브 <form> POST는 CORS 대상 아님 → 그대로 전송.
   - form target을 숨긴 iframe으로 → 응답이 iframe에서 소비되고 우리 페이지는 이동 안 함.
   - 사용자 브라우저가 직접 전송 → 제휴사 서버에 실제 사용자 IP 기록(우리 서버 경유 시 동일 IP 어뷰징 오인).

   [연동 OFF 방법]
   - result.html 에서 이 파일의 <script> 태그만 제거하면 된다.
     lead-form.js 는 window.submitPartnerForm 존재 여부를 확인 후 호출하므로,
     파일이 없어도 우리 폼 로직은 정상 동작한다.
===================================================================== */
(function () {
  'use strict';

  /* ---------- 제휴사 설정 (기존과 동일) ---------- */
  var PARTNER_ACTION  = 'https://replyalba.com/proc/submit.frm.php';
  var PARTNER_CODE    = 'RMUPQLZwb8';   // 판매자(본인) 식별 고정값
  var PARTNER_AD_DATA = '_frm';         // 고정값
  // ridx: 제휴사가 페이지 로드 시 발급하는 내부 추적값.
  //       빈 값으로 보내도 정상 접수됨을 실측 확인 → 빈 값 고정.
  var PARTNER_RIDX    = '';

  /* ---------- 우리 리드팝업 참조 (결과페이지) ---------- */
  var modal = document.querySelector('[data-rz="lead-modal"]');
  if (!modal) return;   // 팝업 없으면(=결과페이지 아님) 아무것도 안 함

  var $ = function (sel) { return modal.querySelector('[data-rz="' + sel + '"]'); };
  var nameEl     = $('lead-name');
  var phoneEl    = $('lead-phone');      // 단일 입력칸 (예: 01072750841)
  var calltimeEl = $('lead-calltime');
  var messageEl  = $('lead-message');

  /* ---------- 진단답변 읽기 (sessionStorage, lead-form.js getDiagnosis와 동일 키) ---------- */
  function pick(k) {
    try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function getDiagnosis() {
    return {
      region:     pick('q_region'),
      marital:    pick('q_marital'),
      dependents: pick('q_dependents'),
      income:     pick('q_income'),
      assets:     pick('q_assets'),
      secured:    pick('q_secured'),
      immunity:   pick('q_immunity'),
      debt:       pick('q_debt')
    };
  }

  /* =====================================================================
     1) 숨긴 제휴사 폼 + iframe 생성 (display:none, DOM엔 실제 존재)
  ===================================================================== */
  var wrap = document.createElement('div');
  wrap.style.display = 'none';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<iframe name="partner_hidden_iframe" id="partner_hidden_iframe"></iframe>' +
    '<form id="partnerForm" method="post" target="partner_hidden_iframe" action="' + PARTNER_ACTION + '">' +
      '<input type="hidden" name="adData"   value="' + PARTNER_AD_DATA + '">' +
      '<input type="hidden" name="name"     value="">' +
      '<input type="hidden" name="hp1"      value="010">' +
      '<input type="hidden" name="hp2"      value="">' +
      '<input type="hidden" name="hp3"      value="">' +
      '<input type="hidden" name="item2"    value="">' +
      '<input type="hidden" name="contents" value="">' +
      '<input type="hidden" name="agree1"   value="on">' +
      '<input type="hidden" name="code"     value="' + PARTNER_CODE + '">' +
      '<input type="hidden" name="ridx"     value="' + PARTNER_RIDX + '">' +
    '</form>';
  document.body.appendChild(wrap);

  var partnerForm = document.getElementById('partnerForm');
  var p = function (name) { return partnerForm.querySelector('[name="' + name + '"]'); };

  /* =====================================================================
     2) 우리 값 → 제휴사 폼 실시간 미러링
  ===================================================================== */
  function val(el) { return (el && el.value || '').trim(); }

  // 단일 전화번호(01072750841) → 3분할(hp1=010, hp2=7275, hp3=0841)
  function splitPhone() {
    var digits = ((phoneEl && phoneEl.value) || '').replace(/\D/g, '').slice(0, 11);
    // 010 + 중간4 + 끝4  (총 11자리 기준. 10자리면 중간3으로 유연 처리)
    if (digits.length === 11) {
      return { hp1: digits.slice(0, 3), hp2: digits.slice(3, 7), hp3: digits.slice(7) };
    }
    if (digits.length === 10) {
      return { hp1: digits.slice(0, 3), hp2: digits.slice(3, 6), hp3: digits.slice(6) };
    }
    // 그 외(입력 중) — 앞3/나머지 반반 정도로 임시 분할
    return { hp1: digits.slice(0, 3) || '010', hp2: digits.slice(3, 7), hp3: digits.slice(7) };
  }

  // 제휴사엔 소득/채무 등 개별 칸이 없으므로 item2(한줄문의) 한 칸에 모아 전달.
  // 진단값 + 통화시간 + 문의사항을 ' / '로 이어붙임.
  //
  // ★현재 첫 전송 테스트: 문의사항 줄만 활성, 나머지는 // 로 꺼둠(배관 확인용).
  //   실제 운영 시 → 아래 줄들의 // 를 지워서 전체 전송.
  function buildItem2() {
    var dg = getDiagnosis();
    var parts = [];

    if (dg.region)       parts.push('거주지역-' + dg.region);
    if (dg.marital)      parts.push('혼인여부-' + dg.marital);
    if (dg.dependents)   parts.push('부양가족-' + dg.dependents);
    if (dg.income)       parts.push('월소득-' + dg.income);
    if (dg.debt)         parts.push('총채무-' + dg.debt);
    if (dg.assets)       parts.push('재산-' + dg.assets);
    if (dg.secured)      parts.push('담보·체납-' + dg.secured);
    if (dg.immunity)     parts.push('면책이력-' + dg.immunity);
    if (val(calltimeEl)) parts.push('통화가능시간-' + val(calltimeEl));
    if (val(messageEl))  parts.push('문의사항-' + val(messageEl));

    return parts.join(' / ');
  }

  function syncToPartnerForm() {
    var ph = splitPhone();
    p('name').value  = val(nameEl);
    p('hp1').value   = ph.hp1 || '010';
    p('hp2').value   = ph.hp2;
    p('hp3').value   = ph.hp3;
    p('item2').value = buildItem2();
    // contents(궁금하신점)는 제휴사 랜딩에 노출 안 되는 필드라 미사용
  }

  // 팝업 입력요소 변경 감지 → 실시간 동기화
  [nameEl, phoneEl, calltimeEl, messageEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', syncToPartnerForm);
    el.addEventListener('change', syncToPartnerForm);
  });

  syncToPartnerForm();   // 초기 1회 (자동완성 대비)

  /* =====================================================================
     3) 전역 함수 노출 — lead-form.js 가 제출 직전 호출
  ===================================================================== */
  window.submitPartnerForm = function () {
    try {
      syncToPartnerForm();     // 제출 직전 최신값으로 한 번 더 동기화
      partnerForm.submit();    // 숨긴 iframe으로 전송 (페이지 이동 없음)
    } catch (err) {
      // 제휴사 전송 실패가 우리 폼 접수를 막아서는 안 되므로 조용히 넘어감
      console.error('[partner-form] 전송 실패:', err);
    }
  };
})();