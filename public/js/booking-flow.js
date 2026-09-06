  /* ================================================================
     BOOKING FLOW CONTROLLER — Gate 02 continuation
     ================================================================ */
  (function(){
    const i18n = {
      fa: {
        stepDate:'تاریخ و ساعت', stepInfo:'اطلاعات شما', stepReview:'بازبینی',
        stepDateEyebrow:'رزرو فضا', stepDateSub:'یک تاریخ و ساعت مناسب برای بازدید یا شروع پروداکشن انتخاب کنید.',
        labelTime:'ساعت',
        stepInfoEyebrow:'مرحله ۲ از ۳', stepInfoTitle:'اطلاعات تماس', stepInfoSub:'برای هماهنگی نهایی، این اطلاعات رو وارد کنید.',
        fieldName:'نام و نام‌خانوادگی', fieldPhone:'شماره موبایل', fieldEmail:'ایمیل (اختیاری)',
        fieldEmailHint:'برای ارسال فاکتور و یادآوری استفاده می‌شود.', fieldNotes:'توضیحات (اختیاری)',
        phonePlaceholder:'۰۹۱۲ ۳۴۵ ۶۷۸۹', phoneError:'شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود',
        edit:'ویرایش',
        stepReviewEyebrow:'مرحله ۳ از ۳', stepReviewTitle:'بازبینی نهایی', stepReviewSub:'قبل از ثبت، اطلاعات زیر رو بررسی کنید.',
        revSpace:'فضا', revDate:'تاریخ و ساعت', revName:'نام', revPhone:'موبایل', revEmail:'ایمیل', revNotes:'توضیحات',
        confirmTitle:'رزرو شما ثبت شد', confirmSub:'به‌زودی از طریق تماس یا پیامک هماهنگ می‌کنیم.',
        btnNext:'ادامه', btnConfirm:'تأیید و ثبت رزرو', btnDone:'بازگشت به صفحه اصلی',
        notSet:'—', back:'بازگشت',
        weekdays:['یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'],
        weekdaysShort:['ی','د','س','چ','پ','ج','ش'],
        months:['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر']
      },
      en: {
        stepDate:'Date & time', stepInfo:'Your info', stepReview:'Review',
        stepDateEyebrow:'Book a space', stepDateSub:'Pick a date and time that works for your visit or shoot.',
        labelTime:'Time',
        stepInfoEyebrow:'Step 2 of 3', stepInfoTitle:'Contact info', stepInfoSub:'We\u2019ll use this to confirm the details with you.',
        fieldName:'Full name', fieldPhone:'Mobile number', fieldEmail:'Email (optional)',
        fieldEmailHint:'Used to send your invoice and reminders.', fieldNotes:'Notes (optional)',
        phonePlaceholder:'09xx xxx xxxx', phoneError:'Mobile number must be 11 digits starting with 09',
        edit:'Edit',
        stepReviewEyebrow:'Step 3 of 3', stepReviewTitle:'Review & confirm', stepReviewSub:'Check the details below before submitting.',
        revSpace:'Space', revDate:'Date & time', revName:'Name', revPhone:'Mobile', revEmail:'Email', revNotes:'Notes',
        confirmTitle:'Your reservation is booked', confirmSub:'We\u2019ll reach out by phone or SMS to confirm the details.',
        btnNext:'Continue', btnConfirm:'Confirm reservation', btnDone:'Back to home',
        notSet:'\u2014', back:'Back',
        weekdays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
        weekdaysShort:['SUN','MON','TUE','WED','THU','FRI','SAT'],
        months:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      }
    };
    const faDigitMap = ['\u06f0','\u06f1','\u06f2','\u06f3','\u06f4','\u06f5','\u06f6','\u06f7','\u06f8','\u06f9'];
    function toFaDigits(v){ return String(v).replace(/[0-9]/g, d => faDigitMap[d]); }

    const reserveBtn = document.getElementById('reserveBtn');
    const bookingFlow = document.getElementById('bookingFlow');
    const bfBack = document.getElementById('bfBack');
    const bfBackLabel = document.getElementById('bfBackLabel');
    const langFa = document.getElementById('langFa');
    const langEn = document.getElementById('langEn');
    const bfSteps = document.getElementById('bfSteps');
    const bfFooter = document.getElementById('bfFooter');
    const bfNext = document.getElementById('bfNext');
    const bfRoomTitle = document.getElementById('bfRoomTitle');
    const calPrev = document.getElementById('calPrev');
    const calNext = document.getElementById('calNext');
    const calMonthLabel = document.getElementById('calMonthLabel');
    const calWeekdays = document.getElementById('calWeekdays');
    const calGrid = document.getElementById('calGrid');
    const bfTimes = document.getElementById('bfTimes');
    const bfSummary1 = document.getElementById('bfSummary1');
    const bfRef = document.getElementById('bfRef');
    const bfBody = document.querySelector('.bf-body');
    const fName = document.getElementById('fName');
    const fPhone = document.getElementById('fPhone');
    const fPhoneError = document.getElementById('fPhoneError');
    const fEmail = document.getElementById('fEmail');
    const fEmailHint = document.getElementById('fEmailHint');
    const fNotes = document.getElementById('fNotes');
    const fNotesCount = document.getElementById('fNotesCount');
    const revSpace = document.getElementById('revSpace');
    const revDate = document.getElementById('revDate');
    const revName = document.getElementById('revName');
    const revPhone = document.getElementById('revPhone');
    const revEmail = document.getElementById('revEmail');
    const revNotes = document.getElementById('revNotes');

    /* ----------------------------------------------------------------
       Jalali (Shamsi) <-> Gregorian conversion (fix brief v1 #2)
       Standard public-domain astronomical algorithm (Borkowski), same
       math used by jalaali-js. Dates are always STORED in Gregorian
       (as native JS Date objects); this is used purely for FA display.
       ---------------------------------------------------------------- */
    function jDiv(a, b){ return ~~(a / b); }
    function jMod(a, b){ return a - ~~(a / b) * b; }
    function jalCal(jy){
      const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
      const bl = breaks.length; let gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, leap, n, i;
      for (i = 1; i < bl; i += 1){
        jm = breaks[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ = leapJ + jDiv(jump, 33) * 8 + jDiv(jMod(jump, 33), 4);
        jp = jm;
      }
      n = jy - jp;
      leapJ = leapJ + jDiv(n, 33) * 8 + jDiv(jMod(n, 33) + 3, 4);
      if (jMod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
      const leapG = jDiv(gy, 4) - jDiv((jDiv(gy, 100) + 1) * 3, 4) - 150;
      const march = 20 + leapJ - leapG;
      if (jump - n < 6) n = n - jump + jDiv(jump, 33) * 33;
      leap = jMod(jMod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
      return { leap, gy, march };
    }
    function g2d(gy, gm, gd){
      let d = jDiv((gy + jDiv(gm - 8, 6) + 100100) * 1461, 4) + jDiv(153 * jMod(gm + 9, 12) + 2, 5) + gd - 34840408;
      d = d - jDiv(jDiv(gy + 100100 + jDiv(gm - 8, 6), 100) * 3, 4) + 752;
      return d;
    }
    function d2g(jdn){
      let j = 4 * jdn + 139361631;
      j = j + jDiv(jDiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
      const i = jDiv(jMod(j, 1461), 4) * 5 + 308;
      const gd = jDiv(jMod(i, 153), 5) + 1;
      const gm = jMod(jDiv(i, 153), 12) + 1;
      const gy = jDiv(j, 1461) - 100100 + jDiv(8 - gm, 6);
      return { gy, gm, gd };
    }
    function j2d(jy, jm, jd){
      const r = jalCal(jy);
      return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jDiv(jm, 7) * (jm - 7) + jd - 1;
    }
    function d2j(jdn){
      let gy = d2g(jdn).gy, jy = gy - 621;
      const r = jalCal(jy);
      const jdn1f = g2d(gy, 3, r.march);
      let k = jdn - jdn1f, jm, jd;
      if (k >= 0){
        if (k <= 185) return { jy, jm: 1 + jDiv(k, 31), jd: jMod(k, 31) + 1 };
        k -= 186;
      } else {
        jy -= 1; k += 179;
        if (r.leap === 1) k += 1;
      }
      jm = 7 + jDiv(k, 30);
      jd = jMod(k, 30) + 1;
      return { jy, jm, jd };
    }
    function toJalaali(gy, gm, gd){ return d2j(g2d(gy, gm, gd)); }
    function toGregorianJ(jy, jm, jd){ return d2g(j2d(jy, jm, jd)); }
    function isLeapJalaaliYear(jy){ return jalCal(jy).leap === 0; }
    function jalaaliMonthLength(jy, jm){
      if (jm <= 6) return 31;
      if (jm <= 11) return 30;
      return isLeapJalaaliYear(jy) ? 30 : 29;
    }
    function dateFromJalaali(jy, jm, jd){
      const g = toGregorianJ(jy, jm, jd);
      return new Date(g.gy, g.gm - 1, g.gd);
    }
    const shamsiMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

    let bfLang = 'fa';
    let bfStep = 1;
    let currentRoom = null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayJalaali = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    // Gregorian nav state (used in EN mode) and Jalali nav state (used in FA mode) —
    // kept independent since EN currently stays Gregorian per the brief (flagged as
    // an open question for the product owner rather than assumed).
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let viewJY = todayJalaali.jy;
    let viewJM = todayJalaali.jm;
    let selectedDate = null;
    let selectedTime = null;
    const disabledTimes = new Set(['12:00', '17:00']);
    const timeSlots = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    const MAX_MONTHS_AHEAD = 3;

    function sameDay(a, b){ return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    function formattedDateTime(t){
      if (!selectedDate || !selectedTime) return t.notSet;
      const time = bfLang === 'fa' ? toFaDigits(selectedTime) : selectedTime;
      if (bfLang === 'fa'){
        const j = toJalaali(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
        const wd = t.weekdays[selectedDate.getDay()];
        return `${wd} ${toFaDigits(j.jd)} ${shamsiMonths[j.jm - 1]} \u00b7 ${time}`;
      }
      const wd = t.weekdays[selectedDate.getDay()];
      return `${wd} ${selectedDate.getDate()} ${t.months[selectedDate.getMonth()]} \u00b7 ${time}`;
    }

    function renderCalendar(){
      if (bfLang === 'fa') renderCalendarJalali(); else renderCalendarGregorian();
    }

    function buildWeekdayHeader(labels){
      calWeekdays.innerHTML = '';
      labels.forEach(w => { const s = document.createElement('span'); s.textContent = w; calWeekdays.appendChild(s); });
    }

    // ---- FA: Shamsi calendar, week starts Saturday ----
    const faWeekdaysShort = ['ش','ی','د','س','چ','پ','ج']; // شنبه یکشنبه دوشنبه سه‌شنبه چهارشنبه پنج‌شنبه جمعه
    function renderCalendarJalali(){
      calMonthLabel.textContent = `${shamsiMonths[viewJM - 1]} ${toFaDigits(viewJY)}`;
      buildWeekdayHeader(faWeekdaysShort);

      calGrid.innerHTML = '';
      const firstDate = dateFromJalaali(viewJY, viewJM, 1);
      const startOffset = (firstDate.getDay() + 1) % 7; // remap Sun(0)..Sat(6) -> Sat(0)..Fri(6)
      const daysInMonth = jalaaliMonthLength(viewJY, viewJM);
      const prevJY = viewJM === 1 ? viewJY - 1 : viewJY;
      const prevJM = viewJM === 1 ? 12 : viewJM - 1;
      const daysInPrevMonth = jalaaliMonthLength(prevJY, prevJM);
      const nextJY = viewJM === 12 ? viewJY + 1 : viewJY;
      const nextJM = viewJM === 12 ? 1 : viewJM + 1;

      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      for (let i = 0; i < totalCells; i++){
        const dayNum = i - startOffset + 1;
        const cell = document.createElement('div');
        let cellDate, jd, muted = false;
        if (dayNum < 1){ jd = daysInPrevMonth + dayNum; cellDate = dateFromJalaali(prevJY, prevJM, jd); muted = true; }
        else if (dayNum > daysInMonth){ jd = dayNum - daysInMonth; cellDate = dateFromJalaali(nextJY, nextJM, jd); muted = true; }
        else { jd = dayNum; cellDate = dateFromJalaali(viewJY, viewJM, jd); }

        cell.className = 'cal-cell';
        if (muted) cell.classList.add('muted');
        if (cellDate < today) cell.classList.add('past');
        if (sameDay(cellDate, today)) cell.classList.add('today');
        if (sameDay(cellDate, selectedDate)) cell.classList.add('sel');

        cell.innerHTML = `<span class="n">${toFaDigits(jd)}</span>`;
        if (!muted && cellDate >= today){
          cell.addEventListener('click', () => { selectedDate = cellDate; renderCalendar(); updateNextButton(); });
        }
        calGrid.appendChild(cell);
      }

      const minMonth = todayJalaali.jy * 12 + todayJalaali.jm;
      const curMonth = viewJY * 12 + viewJM;
      calPrev.disabled = curMonth <= minMonth;
      calNext.disabled = curMonth >= minMonth + MAX_MONTHS_AHEAD;
    }

    // ---- EN: Gregorian calendar, week starts Sunday (unchanged; see brief note) ----
    function renderCalendarGregorian(){
      const t = i18n.en;
      calMonthLabel.textContent = `${t.months[viewMonth]} ${viewYear}`;
      buildWeekdayHeader(t.weekdaysShort);

      calGrid.innerHTML = '';
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startOffset = firstOfMonth.getDay(); // 0 = Sunday
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      for (let i = 0; i < totalCells; i++){
        const dayNum = i - startOffset + 1;
        const cell = document.createElement('div');
        let cellDate, muted = false;
        if (dayNum < 1){ cellDate = new Date(viewYear, viewMonth - 1, daysInPrevMonth + dayNum); muted = true; }
        else if (dayNum > daysInMonth){ cellDate = new Date(viewYear, viewMonth + 1, dayNum - daysInMonth); muted = true; }
        else { cellDate = new Date(viewYear, viewMonth, dayNum); }

        cell.className = 'cal-cell';
        if (muted) cell.classList.add('muted');
        if (cellDate < today) cell.classList.add('past');
        if (sameDay(cellDate, today)) cell.classList.add('today');
        if (sameDay(cellDate, selectedDate)) cell.classList.add('sel');

        cell.innerHTML = `<span class="n">${cellDate.getDate()}</span>`;
        if (!muted && cellDate >= today){
          cell.addEventListener('click', () => { selectedDate = cellDate; renderCalendar(); updateNextButton(); });
        }
        calGrid.appendChild(cell);
      }

      const minMonth = today.getFullYear() * 12 + today.getMonth();
      const curMonth = viewYear * 12 + viewMonth;
      calPrev.disabled = curMonth <= minMonth;
      calNext.disabled = curMonth >= minMonth + MAX_MONTHS_AHEAD;
    }

    calPrev.addEventListener('click', () => {
      if (bfLang === 'fa'){ viewJM--; if (viewJM < 1){ viewJM = 12; viewJY--; } }
      else { viewMonth--; if (viewMonth < 0){ viewMonth = 11; viewYear--; } }
      renderCalendar();
    });
    calNext.addEventListener('click', () => {
      if (bfLang === 'fa'){ viewJM++; if (viewJM > 12){ viewJM = 1; viewJY++; } }
      else { viewMonth++; if (viewMonth > 11){ viewMonth = 0; viewYear++; } }
      renderCalendar();
    });

    function renderTimes(){
      bfTimes.innerHTML = '';
      timeSlots.forEach(tm => {
        const disabled = disabledTimes.has(tm);
        const div = document.createElement('div');
        div.className = 'bf-time' + (selectedTime === tm ? ' sel' : '') + (disabled ? ' disabled' : '');
        div.textContent = bfLang === 'fa' ? toFaDigits(tm) : tm;
        if (!disabled) div.addEventListener('click', () => { selectedTime = tm; renderTimes(); updateNextButton(); });
        bfTimes.appendChild(div);
      });
    }

    function updateSummary(){
      const t = i18n[bfLang];
      bfSummary1.innerHTML = `${currentRoom ? (bfLang === 'fa' ? currentRoom.nameFa : currentRoom.name) : ''}<small>${formattedDateTime(t)}</small>`;
    }

    function updateReview(){
      const t = i18n[bfLang];
      revSpace.textContent = currentRoom ? (bfLang === 'fa' ? currentRoom.nameFa : currentRoom.name) : t.notSet;
      revDate.textContent = formattedDateTime(t);
      revName.textContent = fName.value.trim() || t.notSet;
      revPhone.textContent = fPhone.value.trim() || t.notSet;
      revEmail.textContent = fEmail.value.trim() || t.notSet;
      revNotes.textContent = fNotes.value.trim() || t.notSet;
    }

    /* ---- contact form validation (fix brief v1 #3) ---- */
    const faArDigits = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
                          '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    function normalizeDigits(s){ return s.replace(/[۰-۹٠-٩]/g, d => faArDigits[d] !== undefined ? faArDigits[d] : d); }
    function isValidIranPhone(v){ return /^09\d{9}$/.test(v); }

    function validatePhoneUI(){
      const t = i18n[bfLang];
      const v = fPhone.value.trim();
      const showError = v !== '' && !isValidIranPhone(v);
      fPhone.classList.toggle('error', showError);
      fPhoneError.style.display = showError ? 'block' : 'none';
      fPhoneError.textContent = showError ? t.phoneError : '';
    }

    function validateEmailUI(){
      const t = i18n[bfLang];
      const v = fEmail.value.trim();
      const looksInvalid = v !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      fEmailHint.textContent = looksInvalid ? (bfLang === 'fa' ? 'فرمت ایمیل صحیح نیست' : 'Email format looks invalid') : t.fieldEmailHint;
      fEmailHint.classList.toggle('bf-hint-error', looksInvalid);
    }

    function updateNextButton(){
      const t = i18n[bfLang];
      if (bfStep === 1){ bfNext.textContent = t.btnNext; bfNext.disabled = !(selectedDate && selectedTime); }
      else if (bfStep === 2){ bfNext.textContent = t.btnNext; bfNext.disabled = !(fName.value.trim() && isValidIranPhone(fPhone.value.trim())); }
      else if (bfStep === 3){ bfNext.textContent = t.btnConfirm; bfNext.disabled = false; }
      else if (bfStep === 4){ bfNext.textContent = t.btnDone; bfNext.disabled = false; }
    }

    function applyLang(){
      const t = i18n[bfLang];
      bookingFlow.setAttribute('dir', bfLang === 'fa' ? 'rtl' : 'ltr');
      bookingFlow.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t[el.dataset.i18n] || ''; });
      bfBackLabel.textContent = t.back;
      langFa.classList.toggle('active', bfLang === 'fa');
      langEn.classList.toggle('active', bfLang === 'en');
      if (currentRoom) bfRoomTitle.textContent = bfLang === 'fa' ? currentRoom.nameFa : currentRoom.name;
      renderCalendar();
      renderTimes();
      updateSummary();
      updateReview();
      fPhone.placeholder = t.phonePlaceholder;
      validatePhoneUI();
      validateEmailUI();
      updateNextButton();
    }

    let bookingDepth = 0; // history entries pushed since the flow was opened this session

    function showStep(n){
      bfStep = n;
      document.querySelectorAll('.bf-screen').forEach((el, idx) => el.classList.toggle('active', idx + 1 === n));
      document.querySelectorAll('.bf-step').forEach(el => {
        const s = parseInt(el.dataset.step, 10);
        el.classList.toggle('active', s === n);
        el.classList.toggle('done', s < n);
      });
      bfSteps.style.display = n <= 3 ? 'flex' : 'none';
      if (n === 2) updateSummary();
      if (n === 3){ updateReview(); bfSubmitError.style.display = 'none'; }
      updateNextButton();
      bfBody.scrollTop = 0;
      if (!window.__tyvoSuppressHistory){
        window.__tyvoPushState({ v: 'bstep', room: currentRoomIndex, step: n });
        bookingDepth++;
      }
    }

    function openBookingFlow(room){
      currentRoom = room;
      viewYear = today.getFullYear(); viewMonth = today.getMonth();
      viewJY = todayJalaali.jy; viewJM = todayJalaali.jm;
      selectedDate = null; selectedTime = null;
      fName.value = ''; fPhone.value = ''; fEmail.value = ''; fNotes.value = '';
      fNotesCount.textContent = '0';
      fPhone.classList.remove('error'); fPhoneError.style.display = 'none';
      bookingFlow.classList.add('open');
      bookingDepth = 0;
      applyLang();
      showStep(1);
      const themeMeta = document.getElementById('themeColorMeta');
      if (themeMeta) themeMeta.setAttribute('content', '#FFECD3');
    }
    function closeBookingFlow(){
      bookingFlow.classList.remove('open');
      const themeMeta = document.getElementById('themeColorMeta');
      if (themeMeta) themeMeta.setAttribute('content', '#B52524');
    }

    reserveBtn.addEventListener('click', () => {
      if (typeof currentRoomIndex === 'number' && rooms[currentRoomIndex]) openBookingFlow(rooms[currentRoomIndex]);
    });

    // Fix 5: back button always defers to the History API so hardware/gesture
    // back stays in sync with the in-app control (step N -> N-1, or close the
    // flow entirely from step 1 / the confirmation screen).
    bfBack.addEventListener('click', () => history.back());

    langFa.addEventListener('click', () => { if (bfLang !== 'fa'){ bfLang = 'fa'; applyLang(); } });
    langEn.addEventListener('click', () => { if (bfLang !== 'en'){ bfLang = 'en'; applyLang(); } });

    fName.addEventListener('input', updateNextButton);
    fPhone.addEventListener('input', () => {
      const normalized = normalizeDigits(fPhone.value);
      if (normalized !== fPhone.value) fPhone.value = normalized;
      validatePhoneUI();
      updateNextButton();
    });
    fEmail.addEventListener('input', validateEmailUI);
    fNotes.addEventListener('input', () => { fNotesCount.textContent = fNotes.value.length; });

    bookingFlow.querySelectorAll('[data-goto]').forEach(el => {
      el.addEventListener('click', () => showStep(parseInt(el.dataset.goto, 10)));
    });

    const bfSubmitError = document.getElementById('bfSubmitError');

    function bookingErrorMessage(status, serverError){
      if (status === 409) return bfLang === 'fa' ? 'این بازه دیگر در دسترس نیست. لطفاً زمان دیگری انتخاب کنید.' : 'This slot is no longer available. Please pick another time.';
      if (status === 400) return bfLang === 'fa' ? 'اطلاعات وارد شده نامعتبر است. لطفاً بررسی کنید.' : 'Some of the submitted info is invalid. Please check and try again.';
      return bfLang === 'fa' ? 'خطا در ارتباط با سرور. دوباره تلاش کنید.' : 'Something went wrong. Please try again.';
    }

    async function submitBooking(){
      bfSubmitError.style.display = 'none';
      if (!currentRoom || !currentRoom.id){
        bfSubmitError.textContent = bfLang === 'fa' ? 'خطا در بارگذاری اطلاعات فضا. لطفاً صفحه را رفرش کنید.' : 'Failed to load space info. Please refresh the page.';
        bfSubmitError.style.display = 'block';
        return;
      }

      const [hh, mm] = selectedTime.split(':').map(Number);
      const startDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hh, mm);

      const originalLabel = bfNext.textContent;
      bfNext.disabled = true;
      bfNext.textContent = bfLang === 'fa' ? 'در حال ثبت...' : 'Submitting...';

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            space_id: currentRoom.id,
            start_at: startDateTime.toISOString(),
            customer_name: fName.value.trim(),
            customer_phone: fPhone.value.trim(),
            customer_email: fEmail.value.trim() || undefined,
            notes: fNotes.value.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok){
          bfSubmitError.textContent = bookingErrorMessage(res.status, data.error);
          bfSubmitError.style.display = 'block';
          return;
        }
        bfRef.textContent = data.reference_code;
        showStep(4);
      } catch (err) {
        bfSubmitError.textContent = bookingErrorMessage(0);
        bfSubmitError.style.display = 'block';
      } finally {
        bfNext.disabled = false;
        bfNext.textContent = originalLabel;
      }
    }

    bfNext.addEventListener('click', () => {
      if (bfStep === 1) showStep(2);
      else if (bfStep === 2) showStep(3);
      else if (bfStep === 3){
        submitBooking();
      }
      else if (bfStep === 4){
        // "Done" finishes the flow — unwind the history stack back to the
        // 'detail' entry that existed before booking started, so a later
        // hardware back doesn't replay through stale booking-step states.
        if (bookingDepth > 0) history.go(-bookingDepth);
        else closeBookingFlow();
      }
    });

    /* ----------------------------------------------------------------
       Fix 5: popstate handler — reconstructs whichever app state the
       user navigated to (hardware/gesture back, or forward). Reuses the
       exact same functions as the in-app controls so behavior matches
       exactly; __tyvoSuppressHistory prevents re-pushing while restoring.
       ---------------------------------------------------------------- */
    window.addEventListener('popstate', (e) => {
      window.__tyvoSuppressHistory = true;
      const s = e.state || { v: 'cube' };

      if (s.v === 'cube'){
        closeBookingFlow();
        if (expanded) closeDetail();
      } else if (s.v === 'menu'){
        closeBookingFlow();
        if (!expanded) openDetail(); else showMenu();
      } else if (s.v === 'detail'){
        closeBookingFlow();
        if (!expanded) openDetail();
        showRoom(s.room);
      } else if (s.v === 'bstep'){
        if (!expanded) openDetail();
        showRoom(s.room);
        if (!bookingFlow.classList.contains('open')) openBookingFlow(rooms[s.room]);
        showStep(s.step);
        bookingDepth = s.step;
      }

      window.__tyvoSuppressHistory = false;
    });
  })();
