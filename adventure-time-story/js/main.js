/* main.js - loop render, UI, kamera bebas, kartu judul/akhir, kualitas grafis, rekam video */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT, sfx = JK.sfx, TL = AT.TL;
    const $ = (id) => document.getElementById(id);
    const story = new AT.Story();
    let playing = false, speed = 1, soundOn = true, free = false, started = false, last = 0, dragging = false, dragSeek = false;
    const orbit = { yaw: 0, pitch: 0.25, dist: 1, set: false };
    let lastSub = null, lastAct = -1, bannerTO = 0, toastTO = 0;
    const QUAL = [['HD', 1], ['SD', 0.75], ['LD', 0.5]];
    let qi = 0, slowMs = 0, autoDone = false;

    const optBase = () => ({
        sound: soundOn,
        freeCam: free ? (c) => {
            const d = [c.eye[0] - c.target[0], c.eye[1] - c.target[1], c.eye[2] - c.target[2]];
            if (!orbit.set) { orbit.dist = Math.hypot(d[0], d[1], d[2]); orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.asin(d[1] / orbit.dist); orbit.set = true; }
            const cp = Math.cos(orbit.pitch);
            return { target: c.target, fov: 46, eye: [c.target[0] + orbit.dist * cp * Math.sin(orbit.yaw), Math.max(0.3, c.target[1] + orbit.dist * Math.sin(orbit.pitch)), c.target[2] + orbit.dist * cp * Math.cos(orbit.yaw)] };
        } : null
    });
    let list = [];

    /* ---------- emote: proyeksi posisi dunia -> layar ---------- */
    const emEls = [];
    function project(p, w, h) {
        const VP = AT.lastVP; if (!VP) return null;
        const cx = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], cy = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], cw = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
        if (cw <= 0.1) return null;
        return { x: (cx / cw * 0.5 + 0.5) * w, y: (1 - (cy / cw * 0.5 + 0.5)) * h, cw };
    }
    function drawEmotes() {
        const el = story.emoteList || [], w = innerWidth, h = innerHeight;
        while (emEls.length < el.length) { const d = document.createElement('div'); d.className = 'emote'; document.body.appendChild(d); emEls.push(d); }
        emEls.forEach((d, i) => {
            const e = el[i], pr = e && project(e.pos, w, h);
            if (!pr) { d.style.display = 'none'; return; }
            const sc = Math.max(0.5, Math.min(1.8, 11 / pr.cw)) * e.scale;
            d.style.display = 'block'; d.textContent = e.sym; d.dataset.w = e.who;
            d.style.transform = `translate(${pr.x}px,${pr.y}px) translate(-50%,-50%) scale(${sc})`; d.style.opacity = e.alpha;
        });
    }
    function draw() {
        AT.render(list, story.cam, { outline: true, toon: true, bg: [0.05, 0.04, 0.09] });
        drawEmotes();
        if (rec) composite();
    }

    /* ---------- UI ---------- */
    function toast(msg) { $('toast').textContent = msg; $('toast').classList.add('show'); clearTimeout(toastTO); toastTO = setTimeout(() => $('toast').classList.remove('show'), 2200); }
    function updateUI() {
        const t = story.t, a = story.actAt(t);
        $('time').textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
        if (!dragSeek) $('seek').value = Math.round(t / TL.total * 1000);
        if (a && a.id !== lastAct) {
            lastAct = a.id; $('bnum').textContent = a.id; $('bname').textContent = a.name; $('bsub').textContent = a.sub;
            $('banner').classList.add('show'); clearTimeout(bannerTO); bannerTO = setTimeout(() => $('banner').classList.remove('show'), 3200);
            document.querySelectorAll('#chips button').forEach(b => b.classList.toggle('on', +b.dataset.a === a.id));
        } else if (!a) { lastAct = -1; }
        const s = story.sub(t);
        if (s !== lastSub) {
            lastSub = s;
            if (s) { const w = story.who[s.who]; $('swho').textContent = w[0] ? w[0] + ':' : ''; $('swho').style.color = w[1]; $('stext').textContent = s.text; }
            $('subtitle').classList.toggle('show', !!s);
        }
        $('title').classList.toggle('show', started && t < 3.6);
        $('endcard').classList.toggle('show', t >= TL.total - 0.6);
    }

    function goTo(t) {
        story.seek(Math.max(0, Math.min(TL.total - 0.05, t)), optBase());
        list = story.frame(0, true, Object.assign(optBase(), { silent: true }));
        lastSub = undefined; lastAct = -1; draw(); updateUI();
    }
    function setPlaying(p) { playing = p; $('bPlay').textContent = p ? '⏸' : '▶'; if (!p) { sfx.music(false); sfx.engine(false, 0); } }
    function setQuality(i, quiet) {
        qi = i; AT.quality = QUAL[i][1]; $('bQual').textContent = QUAL[i][0];
        if (!quiet) toast('Kualitas grafis: ' + QUAL[i][0]);
    }

    function loop(ms) {
        requestAnimationFrame(loop);
        const raw = (ms - last) / 1000 || 0, dt = Math.min(0.05, raw); last = ms;
        if (!started) return;
        // otomatis turunkan kualitas bila perangkat lambat (sekali saja, hanya saat memutar)
        if (playing && !autoDone && raw > 0 && raw < 1) {
            slowMs = slowMs * 0.95 + raw * 1000 * 0.05;
            if (slowMs > 34 && qi < QUAL.length - 1 && story.t > 2) { setQuality(qi + 1); slowMs = 16; if (qi === QUAL.length - 1) autoDone = true; }
        }
        if (playing) {
            list = story.step(dt * speed, optBase());
            if (story.t >= TL.total) { setPlaying(false); sfx.music(false); if (rec) stopRec(); }
        } else if (free) list = story.frame(0, true, Object.assign(optBase(), { silent: true }));
        draw(); updateUI();
    }

    /* ---------- rekam video: kanvas 2D gabungan (adegan WebGL + subtitle + banner + emote + kartu) ---------- */
    let rec = null, recCv = null, recCtx = null, recChunks = [];
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function composite() {
        const gl = JK.canvas, w = gl.width, h = gl.height;
        if (recCv.width !== w || recCv.height !== h) { recCv.width = w; recCv.height = h; }
        const c = recCtx, k = w / innerWidth, t = story.t;
        c.drawImage(gl, 0, 0);
        const vg = c.createRadialGradient(w / 2, h * 0.45, h * 0.35, w / 2, h * 0.45, h * 0.95); vg.addColorStop(0, 'rgba(8,4,20,0)'); vg.addColorStop(1, 'rgba(8,4,20,.5)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        (story.emoteList || []).forEach(e => {
            const pr = project(e.pos, innerWidth, innerHeight); if (!pr) return;
            const sc = Math.max(0.5, Math.min(1.8, 11 / pr.cw)) * e.scale * k; c.globalAlpha = e.alpha;
            c.fillStyle = { j: '#ffe066', f: '#8fd3ff', b: '#9cf5c8', t: '#ff9d9d' }[e.who] || '#fff'; c.strokeStyle = '#222'; c.lineWidth = 3 * sc;
            const r = 26 * sc; c.beginPath(); c.arc(pr.x * k, pr.y * k, r, 0, 7); c.fill(); c.stroke();
            c.fillStyle = '#222'; c.font = `900 ${28 * sc}px sans-serif`; c.fillText(e.sym, pr.x * k, pr.y * k + 2 * sc); c.globalAlpha = 1;
        });
        const s = story.sub(t);
        if (s) {
            const wh = story.who[s.who], fs = Math.max(16, Math.min(w, h * 1.7) * 0.026), txt = (wh[0] ? wh[0] + ': ' : '') + s.text;
            c.font = `600 ${fs}px sans-serif`; const tw = Math.min(w * 0.9, c.measureText(txt).width + fs * 2);
            c.fillStyle = 'rgba(10,8,24,.78)'; rr(c, w / 2 - tw / 2, h - fs * 4.2, tw, fs * 2.2, fs * 0.5); c.fill();
            c.fillStyle = '#fff'; c.fillText(txt, w / 2, h - fs * 3.1, tw - fs);
        }
        const a = story.actAt(t);
        if (a && t - a.t < 3.2) {
            const fs = Math.max(14, h * 0.032), txt = a.id + '  ' + a.name + ' — ' + a.sub; c.font = `800 ${fs}px sans-serif`;
            const tw = c.measureText(txt).width + fs * 2; c.fillStyle = 'rgba(20,16,40,.85)'; rr(c, w / 2 - tw / 2, fs, tw, fs * 2.2, fs * 0.6); c.fill();
            c.strokeStyle = '#ffca28'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff'; c.fillText(txt, w / 2, fs * 2.1);
        }
        if (t < 3.6 || t >= TL.total - 0.6) {
            c.fillStyle = 'rgba(8,4,20,.6)'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffca28'; c.shadowColor = '#000'; c.shadowOffsetX = c.shadowOffsetY = 4;
            const big = h * 0.09;
            if (t < 3.6) { c.font = `900 ${big}px sans-serif`; c.fillText('Malam Permainan BMO', w / 2, h * 0.45); c.fillText('yang Kacau', w / 2, h * 0.45 + big * 1.1); c.fillStyle = '#69f0ae'; c.font = `700 ${big * 0.3}px sans-serif`; c.fillText('A D V E N T U R E   T I M E', w / 2, h * 0.3); }
            else { c.font = `900 ${big * 1.3}px sans-serif`; c.fillText('TAMAT', w / 2, h * 0.45); c.fillStyle = '#fff'; c.font = `600 ${big * 0.35}px sans-serif`; c.fillText('Finn · Jake · BMO', w / 2, h * 0.58); }
            c.shadowOffsetX = c.shadowOffsetY = 0;
        }
    }
    function startRec() {
        if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('Browser ini belum mendukung perekaman video'); return; }
        sfx.unlock();
        recCv = document.createElement('canvas'); recCv.width = JK.canvas.width; recCv.height = JK.canvas.height; recCtx = recCv.getContext('2d');
        const vs = recCv.captureStream(30), as = soundOn ? sfx.stream() : null;
        if (as) as.getAudioTracks().forEach(tr => vs.addTrack(tr));
        const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'], mt = types.find(m => MediaRecorder.isTypeSupported(m));
        recChunks = [];
        try { rec = new MediaRecorder(vs, Object.assign({ videoBitsPerSecond: 8e6 }, mt ? { mimeType: mt } : {})); } catch (e) { toast('Gagal memulai perekaman'); rec = null; return; }
        rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
        rec.onstop = () => {
            const blob = new Blob(recChunks, { type: 'video/webm' }), a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'adventure-time-malam-permainan-bmo.webm'; document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Video tersimpan (.webm)');
        };
        goTo(0); rec.start(500); $('bRec').classList.add('rec'); $('bRec').textContent = '⏹'; setPlaying(true); toast('Merekam dari awal… selesai otomatis di akhir cerita');
    }
    function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); rec = null; $('bRec').classList.remove('rec'); $('bRec').textContent = '⏺'; }

    /* ---------- tombol & keyboard ---------- */
    story.acts.forEach(a => { const b = document.createElement('button'); b.textContent = a.id; b.dataset.a = a.id; b.title = a.name + ' — ' + a.sub; b.onclick = () => { goTo(a.t); if (!playing) setPlaying(true); }; $('chips').appendChild(b); });
    $('go').onclick = () => { sfx.unlock(); $('start').classList.add('hide'); started = true; goTo(0); setPlaying(true); };
    $('bPlay').onclick = () => { if (story.t >= TL.total - 0.1) goTo(0); setPlaying(!playing); };
    $('bRestart').onclick = $('again').onclick = () => { goTo(0); setPlaying(true); };
    $('bSpeed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1; $('bSpeed').textContent = speed + '×'; };
    $('bCam').onclick = () => { free = !free; orbit.set = false; $('bCam').style.background = free ? '#ffca28' : ''; };
    $('bSnd').onclick = () => { soundOn = !soundOn; sfx.setOn(soundOn); $('bSnd').textContent = soundOn ? '🔊' : '🔇'; if (!soundOn) sfx.music(false); };
    $('bQual').onclick = () => { autoDone = true; setQuality((qi + 1) % QUAL.length); };
    $('bFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); };
    $('bRec').onclick = () => { if (rec) stopRec(); else startRec(); };
    $('seek').addEventListener('input', () => { dragSeek = true; goTo($('seek').value / 1000 * TL.total); });
    $('seek').addEventListener('change', () => { dragSeek = false; });
    addEventListener('keydown', (e) => {
        if (!started) return;
        if (e.code === 'Space') { e.preventDefault(); $('bPlay').click(); }
        else if (e.key === 'r' || e.key === 'R') $('bRestart').click();
        else if (e.key === 'c' || e.key === 'C') $('bCam').click();
        else if (e.key === 'm' || e.key === 'M') $('bSnd').click();
        else if (e.key === 'q' || e.key === 'Q') $('bQual').click();
        else if (e.key === 'f' || e.key === 'F') $('bFull').click();
        else if (e.key === 'ArrowRight') goTo(story.t + 5);
        else if (e.key === 'ArrowLeft') goTo(story.t - 5);
    });
    const cv = JK.canvas;
    cv.addEventListener('pointerdown', (e) => { if (free) { dragging = true; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointerup', () => dragging = false);
    cv.addEventListener('pointermove', (e) => { if (free && dragging) { orbit.yaw -= e.movementX * 0.007; orbit.pitch = Math.max(-0.1, Math.min(1.4, orbit.pitch + e.movementY * 0.006)); } });
    cv.addEventListener('wheel', (e) => { if (free) { e.preventDefault(); orbit.dist = Math.max(2, Math.min(30, orbit.dist * (1 + e.deltaY * 0.001))); } }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });

    const q = new URLSearchParams(location.search).get('q'); if (q !== null && QUAL[+q]) setQuality(+q, true);
    window.__story = story; window.__goTo = goTo; window.__ready = true;
    goTo(0);
    $('go').disabled = false; $('go').textContent = '▶ Mulai';
    requestAnimationFrame(loop);
})();
