// Wispr Guru demo: ask by voice (Web Speech, hold to talk) or by typing; a second cursor points at
// the control in the pretend app and a step card walks you through, advancing on "done", on a click
// of the right control, or going back / re-pointing on "back" / "where?".
(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const T = (t) => $(`[data-t="${t}"]`)

  const fileMenu = $('#file-menu'), exportMenu = $('#export-menu'), title = T('titleline')
  const guru = $('#guru'), ring = $('#ring'), cursor = $('#cursor'), card = $('#card')
  const input = $('#card-input')

  // ── the pretend app's own behaviour ──
  function closeMenus() { fileMenu.hidden = exportMenu.hidden = true; T('file').setAttribute('aria-expanded', 'false') }
  function toast(text) {
    const el = $('#toast'); el.textContent = text; el.hidden = false
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600)
  }
  const app = {
    file() { const open = fileMenu.hidden; closeMenus(); fileMenu.hidden = !open; T('file').setAttribute('aria-expanded', String(open)) },
    export() { exportMenu.hidden = false },
    pdf() { closeMenus(); toast('Saved “Launch notes.pdf” to Downloads') },
    word() { closeMenus(); toast('Saved “Launch notes.docx”') },
    txt() { closeMenus(); toast('Saved “Launch notes.txt”') },
    titleline() { title.classList.add('sel') },
    bold() { if (title.classList.contains('sel')) title.classList.toggle('bold'); T('bold').classList.toggle('on', title.classList.contains('bold')) },
    center() { if (title.classList.contains('sel')) title.classList.toggle('center'); T('center').classList.toggle('on', title.classList.contains('center')) },
    share() { toast('Share link copied') },
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')
    if (!t || !t.closest('.win')) { if (!e.target.closest('.drop, .card, .ask')) closeMenus(); return }
    if (app[t.dataset.t]) app[t.dataset.t]()
    if (t.dataset.t !== 'file' && t.dataset.t !== 'export' && !t.closest('.drop')) closeMenus()
    onAppClick(t.dataset.t)
  })

  // ── scripted tasks ──
  const TASKS = {
    export: {
      name: 'Export as a PDF',
      steps: [
        { t: 'file', say: 'Open the File menu', detail: 'Top left of the window.', done: () => !fileMenu.hidden },
        { t: 'export', say: 'Choose “Export as”', detail: 'It opens a short list of formats.', done: () => !exportMenu.hidden },
        { t: 'pdf', say: 'Pick PDF', detail: 'It saves straight to Downloads.', done: () => false },
      ],
    },
    title: {
      name: 'Bold, centered title',
      steps: [
        { t: 'titleline', say: 'Click the title to select it', detail: '“Launch notes”, at the top.', done: () => title.classList.contains('sel') },
        { t: 'bold', say: 'Press B for bold', done: () => title.classList.contains('bold') },
        { t: 'center', say: 'Now press Center', detail: 'The three-line button.', done: () => title.classList.contains('center') },
      ],
    },
    share: {
      name: 'Find Share',
      steps: [{ t: 'share', say: 'It’s this one, top right', detail: 'Share copies a link to the doc.', done: () => false }],
    },
  }
  function intent(text) {
    const s = text.toLowerCase()
    if (/pdf|export|save (it )?as|download/.test(s)) return 'export'
    if (/bold|cent(er|re)|title|heading|middle/.test(s)) return 'title'
    if (/share|send (it|this)|link/.test(s)) return 'share'
    return null
  }

  // ── the guide ──
  let task = null, i = 0, raf = 0, dragged = false
  function start(key) {
    task = TASKS[key]; i = 0; dragged = false
    if (key === 'title') { title.classList.remove('sel', 'bold', 'center'); T('bold').classList.remove('on'); T('center').classList.remove('on') }
    closeMenus()
    // start the cursor from the ask bar, so it visibly travels to the target
    const a = $('#ask').getBoundingClientRect()
    cursor.style.transition = 'none'; cursor.style.transform = `translate(${a.left + 40}px, ${a.top}px)`
    void cursor.offsetWidth; cursor.style.transition = ''
    $('.desk').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    show()
  }
  function stop(msg) {
    task = null; cancelAnimationFrame(raf); guru.classList.remove('on'); card.hidden = true
    if (msg) toast(msg)
  }
  function step() { return task && task.steps[i] }
  function show() {
    const s = step(); if (!s) return
    $('#card-task').textContent = '· ' + task.name
    $('#card-n').textContent = `${i + 1} of ${task.steps.length}`
    $('#card-say').textContent = s.say
    $('#card-detail').textContent = s.detail || ''
    $('[data-r="back"]').disabled = i === 0
    $('[data-r="next"]').textContent = i === task.steps.length - 1 ? 'Finish' : 'Done'
    input.value = ''
    card.hidden = false; guru.classList.add('on')
    cancelAnimationFrame(raf); follow()
    setTimeout(() => input.focus({ preventScroll: true }), 350)
  }
  // Re-read the target every frame, so the pointer follows scrolling, resizing and menus opening.
  function follow() {
    const s = step(); if (!s) return
    const el = T(s.t)
    const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null
    if (r) {
      Object.assign(ring.style, { left: r.left - 5 + 'px', top: r.top - 5 + 'px', width: r.width + 10 + 'px', height: r.height + 10 + 'px' })
      cursor.style.transform = `translate(${r.right - Math.min(10, r.width / 3)}px, ${r.bottom - Math.min(8, r.height / 3)}px)`
      if (!dragged && innerWidth > 720) dock(r)
    }
    raf = requestAnimationFrame(follow)
  }
  function dock(r) {
    const w = card.offsetWidth, h = card.offsetHeight, gap = 46
    const floor = Math.min(innerHeight, $('.ask').getBoundingClientRect().top) - 10   // keep the ask bar clear
    let x = r.right + gap, y = r.top + r.height / 2 - h / 2
    if (x + w > innerWidth - 12) x = r.left - gap - w
    if (x < 12) {   // wide target: hang off the cursor's side, below it, else above it
      x = Math.min(Math.max(12, r.right - w + 30), innerWidth - w - 12)
      y = r.bottom + gap
      if (y + h > floor) y = r.top - gap - h
    }
    y = Math.min(Math.max(12, y), Math.max(12, floor - h))
    // never cover the target
    if (x < r.right + 6 && x + w > r.left - 6 && y < r.bottom + 6 && y + h > r.top - 6) y = Math.max(12, r.top - gap - h)
    card.style.left = x + 'px'; card.style.top = y + 'px'
  }
  function next() {
    if (!task) return
    const s = step()
    // "done" said before doing it: do it for them, so the walk-through always lands
    if (!s.done() && app[s.t]) { app[s.t](); onAppClick(s.t, true) }
    if (i >= task.steps.length - 1) { const n = task.name; return stop(n === 'Find Share' ? 'That’s Share. Ask for anything else.' : $('#toast').hidden ? 'Done: ' + n.toLowerCase() + '.' : null) }
    i++; show()
  }
  function back() { if (task && i > 0) { i--; show() } }
  function where() {
    guru.classList.remove('wiggle'); void guru.offsetWidth; guru.classList.add('wiggle')
    const s = step(); $('#card-detail').textContent = 'Here, where the orange cursor is pointing. ' + (s.detail || '')
  }
  function onAppClick(t, fromGuru) {
    const s = step(); if (!s || fromGuru) return
    if (t === s.t) setTimeout(() => {
      if (!task) return
      if (i >= task.steps.length - 1) return next()
      if (s.done()) { i++; show() }
    }, 120)
  }

  // reply words, same rules as the real mod
  function reply(raw) {
    const t = raw.toLowerCase().trim().replace(/[.!?,]+$/, '')
    if (!t || /^(done|next|ok(ay)?|got it|yep|yes|did it|continue|finished|cool|sure)\b/.test(t)) return next()
    if (/^(go )?back|previous|undo/.test(t)) return back()
    if (/where|can'?t find|don'?t see|can'?t see|lost/.test(t)) return where()
    if (/^(stop|cancel|quit|never ?mind)/.test(t)) return stop('Stopped.')
    const k = intent(t); if (k) return start(k)
    $('#card-detail').textContent = 'Say “done” when you’ve done it, “where?” if you can’t see it, or “back”.'
  }

  // ── asking ──
  function ask(text) {
    const k = intent(text)
    if (k) return start(k)
    toast('This demo knows three: export a PDF, a bold centered title, and Share.')
  }
  $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#ask').value.trim(); if (v) ask(v) })
  $$('.chip').forEach((c) => c.addEventListener('click', () => { $('#ask').value = c.dataset.ask; ask(c.dataset.ask) }))
  $('#card-form').addEventListener('submit', (e) => { e.preventDefault(); reply(input.value) })
  $$('[data-r]').forEach((b) => b.addEventListener('click', () => ({ next, back, where })[b.dataset.r]()))
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && task) stop() })

  // ── voice: hold the button (or Space outside a text box) to talk; Wispr users can just dictate ──
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const mic = $('#mic')
  let rec = null, heard = ''
  function listen() {
    if (!SR) { toast('Voice needs Chrome or Safari here. Typing works too.'); return }
    if (rec) return
    heard = ''; rec = new SR(); rec.interimResults = true; rec.lang = 'en-US'
    rec.onresult = (e) => {
      heard = [...e.results].map((r) => r[0].transcript).join(' ')
      ;(task ? input : $('#ask')).value = heard
    }
    rec.onend = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); if (heard.trim()) task ? reply(heard) : ask(heard) }
    rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Mic is blocked. Type instead.') }
    try { rec.start(); mic.setAttribute('aria-pressed', 'true') } catch { rec = null }
  }
  function release() { if (rec) rec.stop() }
  mic.addEventListener('pointerdown', (e) => { e.preventDefault(); listen() })
  ;['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => mic.addEventListener(ev, release))
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && !e.target.closest('input, textarea, select, button')) { e.preventDefault(); listen() }
  })
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') release() })

  // ── drag the card anywhere (by its body, not its field or buttons) ──
  let drag = null
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, button, form') || innerWidth <= 720) return
    const r = card.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    card.classList.add('drag'); card.setPointerCapture(e.pointerId)
  })
  card.addEventListener('pointermove', (e) => {
    if (!drag) return
    dragged = true
    card.style.left = Math.min(Math.max(0, e.clientX - drag.dx), innerWidth - card.offsetWidth) + 'px'
    card.style.top = Math.min(Math.max(0, e.clientY - drag.dy), innerHeight - card.offsetHeight) + 'px'
  })
  card.addEventListener('pointerup', () => { drag = null; card.classList.remove('drag') })

  // ── copy the install line ──
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($(b.dataset.copy).textContent); b.textContent = 'Copied' } catch { b.textContent = 'Select it' }
    setTimeout(() => (b.textContent = 'Copy'), 1600)
  }))

  // deep link: /wispr-guru/?try=export
  const q = new URLSearchParams(location.search).get('try')
  if (q && TASKS[q]) setTimeout(() => start(q), 600)
})()
