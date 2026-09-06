  const cube = document.getElementById('cube');
  const cubeReflect = document.getElementById('cubeReflect');
  const cubeRow = document.getElementById('cubeRow');
  const capTitle = document.getElementById('capTitle');
  const capSub = document.getElementById('capSub');
  const dots = document.getElementById('dots').children;
  const centerEl = document.getElementById('center');
  const reflectionEl = document.getElementById('reflection');
  const detailView = document.getElementById('detailView');
  const tapHint = document.getElementById('tapHint');
  const scene = document.getElementById('logoScene');
  const roomMenu = document.getElementById('roomMenu');
  const roomDetail = document.getElementById('roomDetail');
  const detailBack = document.getElementById('detailBack');
  const rdTitle = document.getElementById('rdTitle');
  const rdDesc = document.getElementById('rdDesc');
  const contactPanel = document.getElementById('contactPanel');
  const contactPhoneRow = document.getElementById('contactPhoneRow');
  const contactPhoneLabel = document.getElementById('contactPhoneLabel');
  const contactLocationRow = document.getElementById('contactLocationRow');

  const faces = [
    { key:'LOGO',    title:'TYVO MEDIA', sub:'Advertising & content production — Tabriz' },
    { key:'RENTAL',  title:'RENTAL',     sub:'3 White Box studios + equipment rental' },
    { key:'MEDIA',   title:'MEDIA',      sub:'Content · photography · branding & graphics' },
    { key:'EVENTS',  title:'EVENTS',     sub:'Events & workshops' }
  ];

  const rooms = [
    { name:'White Box A', nameFa:'باکس سفید A', featured:true,  tag:'Largest', desc:'Our biggest studio — spacious enough for full productions and group shoots.' },
    { name:'White Box B', nameFa:'باکس سفید B', featured:false, desc:'Balanced light and space for product and portrait work.' },
    { name:'White Box C', nameFa:'باکس سفید C', featured:false, desc:'Compact and efficient — ideal for quick shoots and content batches.' },
    { name:'Red Rock',    nameFa:'رد راک',       featured:false, desc:'A bold, textured red-rock backdrop for editorial and fashion shoots.' },
    { name:'Podcast Room',nameFa:'اتاق پادکست',   featured:false, desc:'Acoustically treated space built for podcast and audio recording.' },
    { name:'Cafe',        nameFa:'کافه',          featured:false, desc:'A relaxed cafe-styled setting for lifestyle content and casual meetings.' },
    { name:'Conference Room', nameFa:'اتاق کنفرانس', featured:false, desc:'A professional space for meetings, panels and presentations.' }
  ];

  // build glass menu
  roomMenu.innerHTML = rooms.map((r, i) =>
    `<div class="room-row${r.featured ? ' featured' : ''}" data-index="${i}">
       <span class="name">${r.name}${r.tag ? `<span class="tag">${r.tag}</span>` : ''}</span>
       <span class="chev">›</span>
     </div>`
  ).join('');

  // Fetch real space ids from the backend so the booking flow can submit a
  // real space_id (the static `rooms` array above only drives the cube UI
  // and has no id of its own). Matched by English name, same set seeded by
  // prisma/seed.js — see notes there.
  fetch('/api/spaces')
    .then(res => res.ok ? res.json() : Promise.reject(new Error('spaces fetch failed: ' + res.status)))
    .then(spaces => {
      rooms.forEach(r => {
        const match = spaces.find(s => s.name === r.name);
        if (match) r.id = match.id;
      });
    })
    .catch(err => console.error('[cube-nav] failed to load space ids:', err));

  let rotation = 0; // LOGO panel is the default entry point
  let dragging = false;
  let startX = 0, startY = 0;
  let moved = 0;
  let expanded = false;      // cube shrunk (menu or detail showing)
  let showingDetail = false; // which sub-view inside expanded state

  // --- Fix 5: Android back button / gesture nav (History API) ---
  // Shared across both script blocks (classic scripts share global scope).
  window.__tyvoSuppressHistory = false;
  window.__tyvoPushState = function (state) {
    if (window.__tyvoSuppressHistory) return;
    history.pushState(state, '');
  };
  history.replaceState({ v: 'cube' }, '');

  function setTransform(rot, animate){
    cube.style.transition = animate ? 'transform 480ms cubic-bezier(.22,.61,.36,1)' : 'none';
    cubeReflect.style.transition = cube.style.transition;
    const t = `rotateX(-10deg) rotateY(${rot}deg)`;
    cube.style.transform = t;
    cubeReflect.style.transform = t;
  }
  function indexFromRotation(rot){
    let idx = Math.round(-rot / 90) % faces.length;
    idx = ((idx % faces.length) + faces.length) % faces.length;
    return idx;
  }
  function currentFaceKey(){ return faces[indexFromRotation(rotation)].key; }

  // --- Contact panel: logo-panel-only, delayed reveal, re-triggers each visit ---
  let contactPanelTimer = null;
  let wasOnLogo = false;
  function updateContactPanel(idx){
    const isLogo = (idx === 0);
    if (isLogo && !wasOnLogo){
      // just arrived at the logo panel — reset to hidden, schedule the quiet delayed reveal
      contactPanel.classList.remove('show');
      clearTimeout(contactPanelTimer);
      contactPanelTimer = setTimeout(() => contactPanel.classList.add('show'), 1050);
    } else if (!isLogo){
      contactPanel.classList.remove('show');
      clearTimeout(contactPanelTimer);
    }
    wasOnLogo = isLogo;
  }

  function updateUI(idx){
    const f = faces[idx];
    capTitle.textContent = f.title;
    capSub.textContent = f.sub;
    tapHint.classList.toggle('show', f.key === 'RENTAL' && !expanded);
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i === idx);
    updateContactPanel(idx);
  }
  function snapTo(rot){
    rotation = rot;
    setTransform(rotation, true);
    updateUI(indexFromRotation(rotation));
  }

  function showMenu(){
    showingDetail = false;
    roomMenu.style.display = 'block';
    roomDetail.classList.remove('show');
    window.__tyvoPushState({ v: 'menu' });
  }
  let currentRoomIndex = null;
  function showRoom(i){
    showingDetail = true;
    currentRoomIndex = i;
    const r = rooms[i];
    rdTitle.textContent = r.name;
    rdDesc.textContent = r.desc;
    roomMenu.style.display = 'none';
    roomDetail.classList.add('show');
    window.__tyvoPushState({ v: 'detail', room: i });
  }

  function openDetail(){
    expanded = true;
    cubeRow.classList.add('expanded');
    centerEl.classList.add('hide-chrome');
    reflectionEl.classList.add('hide');
    tapHint.classList.remove('show');
    detailView.classList.add('open');
    showMenu();
  }
  function closeDetail(){
    expanded = false;
    cubeRow.classList.remove('expanded');
    centerEl.classList.remove('hide-chrome');
    reflectionEl.classList.remove('hide');
    detailView.classList.remove('open');
    updateUI(indexFromRotation(rotation));
  }

  roomMenu.addEventListener('click', e => {
    const row = e.target.closest('.room-row');
    if (!row) return;
    showRoom(parseInt(row.dataset.index, 10));
  });
  // Fix 5: "back to spaces" is a backward action — route it through the
  // History API so hardware/gesture back stays in sync with in-app back.
  detailBack.addEventListener('click', () => history.back());

  let activePointerId = null;

  function pointerDown(x, y, id){
    dragging = true; startX = x; startY = y; moved = 0;
    activePointerId = id;
    cube.classList.add('dragging');
    setTransform(rotation, false);
  }
  function pointerMove(x){
    if (!dragging || expanded) return;
    const dx = x - startX;
    moved = Math.max(moved, Math.abs(dx));
    setTransform(rotation + dx * 0.35, false);
  }
  function pointerUp(x){
    if (!dragging) return;
    dragging = false;
    cube.classList.remove('dragging');
    const dx = x - startX;

    if (expanded){
      if (moved < 6) history.back();
      return;
    }
    if (moved < 6){
      if (currentFaceKey() === 'RENTAL') openDetail();
      else setTransform(rotation, true);
      return;
    }
    const target = Math.round((rotation + dx * 0.35) / 90) * 90;
    snapTo(target);
  }

  scene.addEventListener('pointerdown', e => { scene.setPointerCapture(e.pointerId); pointerDown(e.clientX, e.clientY, e.pointerId); });
  scene.addEventListener('pointermove', e => { if (e.pointerId !== activePointerId) return; pointerMove(e.clientX); });
  scene.addEventListener('pointerup',   e => { if (e.pointerId !== activePointerId) return; pointerUp(e.clientX); activePointerId = null; });
  scene.addEventListener('pointercancel', () => { dragging = false; cube.classList.remove('dragging'); activePointerId = null; });

  // --- Desktop: scroll-wheel-driven rotation (fix brief v1 #5) ---
  // Touch/drag behavior above is untouched; this only adds a new input path
  // for non-touch (mouse/trackpad) devices. Each wheel "tick" snaps one face.
  const isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  let wheelCooldown = false;
  const WHEEL_THRESHOLD = 12;   // ignore tiny/inertial noise
  const WHEEL_COOLDOWN_MS = 520; // matches the 480ms snap transition + margin

  scene.addEventListener('wheel', e => {
    if (!isFinePointer) return;
    if (expanded) return; // don't rotate while menu/detail is open
    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
    e.preventDefault();
    if (wheelCooldown) return;
    wheelCooldown = true;
    const dir = e.deltaY > 0 ? -90 : 90; // scroll down -> next face, scroll up -> previous face
    snapTo(rotation + dir);
    setTimeout(() => { wheelCooldown = false; }, WHEEL_COOLDOWN_MS);
  }, { passive: false });

  // --- Contact panel actions ---
  const CONTACT_PHONE = '+98 914 263 8005';
  const CONTACT_MAP_URL = 'https://maps.app.goo.gl/Mj5R1vUiVF6vNrya9';
  let phoneCopyTimer = null;

  contactPhoneRow.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_PHONE);
    } catch (err) {
      console.warn('[contact panel] clipboard write failed:', err);
    }
    contactPhoneRow.classList.add('copied');
    contactPhoneLabel.textContent = 'کپی شد ✓';
    clearTimeout(phoneCopyTimer);
    phoneCopyTimer = setTimeout(() => {
      contactPhoneRow.classList.remove('copied');
      contactPhoneLabel.textContent = CONTACT_PHONE;
    }, 1500);
  });

  contactLocationRow.addEventListener('click', () => {
    window.open(CONTACT_MAP_URL, '_blank');
  });

  setTransform(rotation, false);
  updateUI(indexFromRotation(rotation));
