/* =====================================================================
   lead-form.js — 결과페이지 팝업(리드 모달) 전송 + 번호인증(OTP)
   ---------------------------------------------------------------------
   [역할]
   결과페이지에서 이미 진단(Q1~Q7)을 마친 사용자가 블록7 CTA로 여는
   리드 모달의 검증·OTP·전송 담당. 진단 답변 8개는 window.JINDAN.answers
   (result.js가 노출)에서 가져오고, 팝업에선 이름·연락처·통화시간·문의사항만
   추가로 받는다. 계산 결과(탕감률 등)는 전송하지 않는다.

   [기존 hopeworkout 폼과의 차이]
   · 진단값(소득·채무·재산·담보 등)은 이미 sessionStorage에 있음 → 폼에서 안 받음
   · 전화번호 단일 입력칸(lead-phone) — 기존 3분할(phone1/2/3) 아님
   · OTP UI는 lead-otp-slot(빈 div)에 삽입
   · 트래픽 SOURCE는 traffic.js가 저장한 sessionStorage('traffic')에서 읽음

   ★배포 전 반드시 교체할 값 (아래 CONFIG):
     OTP_API_URL, WEBAPP2_URL — 이 프로젝트 전용 구글시트로 새로 배포한 GAS
     THANKYOU_URL — 이 프로젝트 땡큐페이지 주소
   ===================================================================== */
(function () {
  'use strict';

  var modal = document.querySelector('[data-rz="lead-modal"]');
  if (!modal) return;

  /* ============ CONFIG — 배포 전 교체 ============ */
  var OTP_API_URL  = 'https://ai-debt.softman007.workers.dev/otp';   // 3단계: Workers /otp (GAS 웹앱1 대체 — 콜드스타트 없음)
  var WEBAPP2_URL  = 'https://script.google.com/macros/s/AKfycbzA7H33-PUzlk1XUyk00nfJRefIVwtCPIlzAXK_PvXDTozOSehIk7bACcmKoPwcDNZs/exec';   // 웹앱2: submit(중복체크·uid발급·저장)
  var THANKYOU_URL = 'thanks-nude.html';   // ★ 배포 전: 파일명. 도메인 정해지면 실제 주소로 교체

  /* ============ 유입경로(SOURCE) — traffic.js가 저장한 값 재사용 ============ */
  function getSource() {
    try {
      var t = JSON.parse(sessionStorage.getItem('traffic') || '{}');
      var s = [t.media, t.region, t.age].filter(Boolean).join('-');
      return s || '직접유입';
    } catch (e) { return '직접유입'; }
  }

  /* ============ 진단 답변 8개 — result.js가 노출한 window.JINDAN ============ */
  function getDiagnosis() {
    var a = (window.JINDAN && window.JINDAN.answers) || {};
    // sessionStorage 폴백 (혹시 전역 노출 전이면)
    function pick(k) {
      if (a[k] != null && a[k] !== '') return a[k];
      try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; }
    }
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

  /* ============ 필드 참조 ============ */
  var $ = function (sel) { return modal.querySelector('[data-rz="' + sel + '"]'); };
  var nameEl     = $('lead-name');
  var phoneEl    = $('lead-phone');
  var verifySlot = $('lead-verify-slot');
  var otpSlot    = $('lead-otp-slot');
  var calltimeEl = $('lead-calltime');
  var messageEl  = $('lead-message');
  var agreeEl    = $('lead-agree');
  var submitBtn  = $('lead-submit');

  var isPhoneVerified = false;
  var codeSent = false;

  /* ============ OTP UI 삽입 ============
     · 인증번호 받기 버튼 → 연락처 우측(verify-slot)
     · 인증번호 입력칸 → 연락처 아래(otp-slot, 발송 후 표시) */
  var otpCodeEl = null, otpActionBtn = null, otpMsg = null;
  if (verifySlot) {
    verifySlot.innerHTML =
      '<button type="button" class="lead__verify" data-otp-action>인증번호 받기</button>';
    otpActionBtn = verifySlot.querySelector('[data-otp-action]');
  }
  if (otpSlot) {
    otpSlot.innerHTML =
      '<input class="lead__input" data-otp-code type="text" maxlength="6" inputmode="numeric" ' +
        'pattern="[0-9]*" autocomplete="off" placeholder="인증번호 6자리" />' +
      '<p class="lead__otp-msg" data-otp-msg></p>';
    otpCodeEl = otpSlot.querySelector('[data-otp-code]');
    otpMsg    = otpSlot.querySelector('[data-otp-msg]');
    otpSlot.style.display = 'none';   // 발송 전 숨김 → doSend 성공 시 표시
  }

  function setOtpMsg(text, color) {
    if (!otpMsg) return;
    otpMsg.textContent = text || '';
    otpMsg.style.color = color || '';
  }

  var OTP_TIMEOUT_MS = 15000;   // OTP 발송/검증 최대 대기 (Workers는 콜드스타트 없음 — Solapi 발송 지연 대비 여유값)

  function callOtpApi(payload) {
    // AbortController로 타임아웃 — 응답이 안 오면 무한 대기 대신 .catch로 떨어뜨림
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, OTP_TIMEOUT_MS) : null;
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },   // Workers는 CORS 열려있어 json 정석 사용(GAS땐 우회로 text/plain)
      body: JSON.stringify(payload)
    };
    if (controller) opts.signal = controller.signal;
    return fetch(OTP_API_URL, opts)
      .then(function (r) { if (timer) clearTimeout(timer); return r.json(); })
      .catch(function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* 전화번호 11자리 추출 (하이픈 제거) */
  function getValidPhoneDigits() {
    var d = ((phoneEl && phoneEl.value) || '').replace(/\D/g, '');
    return /^010\d{8}$/.test(d) ? d : '';
  }
  function getCode() {
    return ((otpCodeEl && otpCodeEl.value) || '').replace(/\D/g, '');
  }

  function refreshOtpButton() {
    if (!otpActionBtn) return;
    if (isPhoneVerified) {
      otpActionBtn.textContent = '인증 완료';
      otpActionBtn.className = 'lead__verify is-done';
      otpActionBtn.disabled = true;
      return;
    }
    otpActionBtn.disabled = false;
    if (codeSent && getCode().length === 6) {
      otpActionBtn.textContent = '인증번호 확인';
      otpActionBtn.className = 'lead__verify is-verify';   // 6자리 입력완료 → 확인 대기(색 변화)
    } else {
      otpActionBtn.textContent = codeSent ? '인증번호 재발송' : '인증번호 받기';
      otpActionBtn.className = 'lead__verify';
    }
  }

  function doSend() {
    var phone = getValidPhoneDigits();
    if (!phone) { alert('휴대폰 번호를 정확히 입력해주세요.'); return; }
    otpActionBtn.disabled = true;
    setOtpMsg('인증번호 발송 중...', '');
    callOtpApi({ action: 'send', phone: phone })
      .then(function (res) {
        if (res.ok) {
          codeSent = true;
          if (otpSlot) otpSlot.style.display = '';   // 인증번호 입력칸 표시
          setOtpMsg('인증번호를 발송했습니다. (3분 이내 입력)', '#1a7f37');
          alert('핸드폰 문자로 [인증번호]가 전송되었습니다.\n6자리를 입력하고 [인증번호 확인]을 눌러주세요.');
          if (otpCodeEl) otpCodeEl.focus();
        } else {
          alert(res.message || '발송에 실패했습니다. 다시 시도해주세요.');
          setOtpMsg(res.message || '발송에 실패했습니다.', '#d33');
        }
      })
      .catch(function () {
        alert('네트워크 오류로 발송에 실패했습니다. 다시 시도해주세요.');
        setOtpMsg('네트워크 오류로 발송에 실패했습니다.', '#d33');
      })
      .then(function () { refreshOtpButton(); });
  }

  function doVerify() {
    var phone = getValidPhoneDigits();
    var code = getCode();
    if (code.length !== 6) { alert('인증번호 6자리를 입력해주세요.'); return; }
    otpActionBtn.disabled = true;
    setOtpMsg('확인 중...', '');
    callOtpApi({ action: 'verify', phone: phone, code: code })
      .then(function (res) {
        if (res.ok) {
          isPhoneVerified = true;
          if (otpCodeEl) otpCodeEl.disabled = true;
          if (phoneEl) {                              // 인증 후 번호 잠금
            phoneEl.readOnly = true;
            phoneEl.classList.add('is-locked');
          }
          setOtpMsg('', '');
          alert('인증이 완료되었습니다.');
          refreshOtpButton();
          updateSubmit();
        } else {
          alert(res.message || '인증에 실패했습니다.');
          setOtpMsg(res.message || '인증에 실패했습니다.', '#d33');
          refreshOtpButton();
        }
      })
      .catch(function () {
        setOtpMsg('확인에 실패했습니다. 다시 시도해주세요.', '#d33');
        alert('네트워크 오류로 확인에 실패했습니다. 다시 시도해주세요.');
        refreshOtpButton();
      });
  }

  if (otpActionBtn) {
    otpActionBtn.addEventListener('click', function () {
      if (isPhoneVerified) return;
      if (codeSent && getCode().length === 6) doVerify();
      else doSend();
    });
  }
  if (otpCodeEl) {
    otpCodeEl.addEventListener('input', function () {
      otpCodeEl.value = otpCodeEl.value.replace(/\D/g, '').slice(0, 6);
      refreshOtpButton();
    });
  }
  // 전화번호 바뀌면 인증 초기화 + 하이픈 자동
  if (phoneEl) {
    phoneEl.addEventListener('input', function () {
      // 하이픈 자동 (010-0000-0000)
      var v = phoneEl.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 7)      v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7);
      else if (v.length > 3) v = v.slice(0,3) + '-' + v.slice(3);
      phoneEl.value = v;
      // 인증 초기화
      if (!isPhoneVerified && !codeSent) return;
      isPhoneVerified = false;
      codeSent = false;
      phoneEl.classList.remove('is-locked');
      if (otpCodeEl) { otpCodeEl.disabled = false; otpCodeEl.value = ''; }
      setOtpMsg('번호가 변경되어 다시 인증이 필요합니다.', '#d33');
      refreshOtpButton();
      updateSubmit();
    });
  }
  refreshOtpButton();

  /* ============ 제출 버튼 활성/검증 ============ */
  function validate() {
    var name = ((nameEl && nameEl.value) || '').trim();
    var phone = getValidPhoneDigits();
    var calltime = ((calltimeEl && calltimeEl.value) || '').trim();
    var agreed = agreeEl ? agreeEl.checked : true;

    if (!/^[가-힣]{2,}$/.test(name)) return { ok: false, msg: '성함을 입력해주세요.' };
    if (!phone)                     return { ok: false, msg: '연락처를 정확히 입력해주세요.' };
    if (!isPhoneVerified)           return { ok: false, msg: '휴대폰 인증을 완료해주세요.' };
    if (!calltime)                  return { ok: false, msg: '통화 가능 시간을 선택해주세요.' };
    if (!agreed)                    return { ok: false, msg: '개인정보 수집 및 이용에 동의해주세요.' };
    return { ok: true, msg: '내 탕감률 정확히 확인하기' };
  }
  function updateSubmit() {
    if (!submitBtn) return;
    var r = validate();
    submitBtn.disabled = !r.ok;
    submitBtn.style.opacity = r.ok ? '' : '.55';
    submitBtn.style.cursor = r.ok ? 'pointer' : 'default';
  }
  [nameEl, phoneEl, calltimeEl, agreeEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', updateSubmit);
    el.addEventListener('change', updateSubmit);
  });
  updateSubmit();

  /* ============ 웜업 — 모달 열릴 때 GAS 콜드스타트 완화 ============
     웹앱2(제출) + 웹앱1(OTP) 둘 다 미리 깨움. OTP는 콜드스타트로 인한
     "네트워크 오류로 발송 실패"가 첫 방문자에게 뜨는 걸 막는 게 핵심. */
  var warmed = false;
  function warmUp() {
    if (warmed) return;
    warmed = true;
    // 웹앱2 웜업 (JSONP ping)
    if (WEBAPP2_URL.indexOf('REPLACE') !== 0) {
      var cb = 'warmCb_' + Date.now();
      window[cb] = function () { delete window[cb]; };
      var s = document.createElement('script');
      s.src = WEBAPP2_URL + '?action=ping&callback=' + cb;
      s.onerror = function () { delete window[cb]; };
      document.body.appendChild(s);
    }
    // (3단계) Workers는 콜드스타트가 없어 웜업이 사실상 불필요.
    // GAS 시절 흔적 유지 겸, worker 헬스체크(루트)만 가볍게 한 번 — 응답 무시.
    try {
      fetch('https://ai-debt.softman007.workers.dev/', { method: 'GET', mode: 'no-cors', cache: 'no-store' })
        .catch(function () {});
    } catch (e) {}
  }
  if (nameEl) nameEl.addEventListener('focus', warmUp, { once: true });

  /* ============ 제출 파라미터 (진단8 + 팝업5 + 소스) ============ */
  function buildSubmitParams(requestId) {
    var dg = getDiagnosis();
    var params = {
      action: 'submit',
      // 진단 입력값 8
      region: dg.region, marital: dg.marital, dependents: dg.dependents,
      income: dg.income, assets: dg.assets, secured: dg.secured,
      immunity: dg.immunity, debt: dg.debt,
      // 팝업 입력값 5
      name: ((nameEl && nameEl.value) || '').trim(),
      phone: getValidPhoneDigits(),
      phoneCheck: isPhoneVerified ? '번호인증 완료' : '번호인증 미완료',
      calltime: ((calltimeEl && calltimeEl.value) || '').trim(),
      message: ((messageEl && messageEl.value) || '').trim(),
      // 메타
      source: getSource(),
      requestId: requestId
    };
    return new URLSearchParams(params);
  }

  /* ============ 전송 (웹앱2 JSONP + 재시도) ============ */
  var SUBMIT_TIMEOUT_MS = 25000;
  var SUBMIT_MAX_ATTEMPTS = 2;

  /* 제출 로딩 오버레이 (전송 중 화면 덮기 + 중복클릭 방지) */
  var submitOverlay = document.getElementById('submit-loading-overlay');
  function showLoadingOverlay() { if (submitOverlay) submitOverlay.style.display = 'flex'; }
  function hideLoadingOverlay() { if (submitOverlay) submitOverlay.style.display = 'none'; }

  function resetSubmit() {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    submitBtn.textContent = '내 탕감률 정확히 확인하기';
    submitBtn.style.opacity = '';
    submitBtn.style.cursor = 'pointer';
  }

  function attemptSubmit(attemptNo, requestId) {
    var cbName = 'leadSubmitCb_' + Date.now() + '_' + attemptNo;
    var script = document.createElement('script');
    var settled = false;

    function cleanup() {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[cbName];
    }
    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true; cleanup();
      if (attemptNo < SUBMIT_MAX_ATTEMPTS) attemptSubmit(attemptNo + 1, requestId);
      else { hideLoadingOverlay(); alert('네트워크 지연으로 접수가 지연되고 있습니다. 잠시 후 다시 시도해주세요.'); resetSubmit(); }
    }, SUBMIT_TIMEOUT_MS);

    window[cbName] = function (data) {
      if (settled) return;
      settled = true; clearTimeout(timeoutId); cleanup();
      hideLoadingOverlay();   // 응답 도착 → 결과 안내 직전 오버레이 제거
      if (data && data.ok) {
        // ★ 성공 시 이 번호의 requestId 정리 — 뒤로가기 후 같은 번호 재제출 시
        //   기존 requestId 재사용으로 중복체크가 우회되는 것을 방지(새 id 발급되게).
        try {
          var doneKey = 'lead_req_' + getValidPhoneDigits();
          sessionStorage.removeItem(doneKey);
        } catch (e) {}
        try { sessionStorage.setItem('lead_name', ((nameEl && nameEl.value) || '').trim()); } catch (e) {}
        window.location.href = THANKYOU_URL + '?uid=' + data.uid;
      } else if (data && data.reason === 'duplicate') {
        alert('이미 접수된 번호입니다. 신청이 불가합니다.'); resetSubmit();
      } else {
        alert('접수 처리 중 오류가 발생했습니다. 다시 시도해주세요.'); resetSubmit();
      }
    };

    var params = buildSubmitParams(requestId);
    params.append('callback', cbName);
    script.src = WEBAPP2_URL + '?' + params.toString();
    script.onerror = function () {
      if (settled) return;
      settled = true; clearTimeout(timeoutId); cleanup();
      if (attemptNo < SUBMIT_MAX_ATTEMPTS) attemptSubmit(attemptNo + 1, requestId);
      else { hideLoadingOverlay(); alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.'); resetSubmit(); }
    };
    document.body.appendChild(script);
  }

  /* ============ 제출 클릭 ============ */
  if (submitBtn) submitBtn.addEventListener('click', function () {
    var r = validate();
    if (!r.ok) { alert(r.msg); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중입니다...';
    submitBtn.style.cursor = 'default';

    showLoadingOverlay();   // 클릭 즉시 오버레이 표시 (재시도 중에도 유지)

    // ★ 제휴사 폼 동시 전송 — partner-form.js 있을 때만 (웹앱2보다 먼저)
    if (typeof window.submitPartnerForm === 'function') {
      window.submitPartnerForm();
    }

    // requestId 전화번호별 세션 보관 (재시도 시 같은 id로 중복 차단 회피)
    var phoneKey = getValidPhoneDigits();
    var storeKey = 'lead_req_' + phoneKey;
    var requestId = null;
    try { requestId = sessionStorage.getItem(storeKey); } catch (e) {}
    if (!requestId) {
      requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem(storeKey, requestId); } catch (e) {}
    }
    attemptSubmit(1, requestId);
  });
})();
