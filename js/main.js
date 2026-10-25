/* main.js - loop render, UI, kamera bebas */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT, sfx = JK.sfx, TL = AT.TL;
    const $ = (id) => document.getElementById(id);
    const story = new AT.Story();
    let playing = false, speed = 1, soundOn = true, free = false, started = false, last = 0, dragging = false;
    const orbit = { yaw: 0, pitch: 0.25, dist: 1, set: false };
    let lastSub = null, lastAct = -1, bannerTO = 0;

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
    function draw() { AT.render(list, story.cam, { outline: true, toon: true, bg: [0.05, 0.04, 0.09] }); }

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
    }
    let dragSeek = false;

    function goTo(t) {
        story.seek(Math.max(0, Math.min(TL.total - 0.05, t)), optBase());
        list = story.frame(0, true, Object.assign(optBase(), { silent: true }));
        lastSub = undefined; lastAct = -1; draw(); updateUI();
    }
    function setPlaying(p) { playing = p; $('bPlay').textContent = p ? '⏸' : '▶'; if (!p) { sfx.music(false); sfx.engine(false, 0); } }

    function loop(ms) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ms - last) / 1000 || 0); last = ms;
        if (!started) return;
        if (playing) {
            list = story.step(dt * speed, optBase());
            if (story.t >= TL.total) { setPlaying(false); sfx.music(false); }
        } else if (free) list = story.frame(0, true, Object.assign(optBase(), { silent: true }));
        draw(); updateUI();
    }

    /* ---- UI ---- */
    story.acts.forEach(a => { const b = document.createElement('button'); b.textContent = a.id; b.dataset.a = a.id; b.title = a.name + ' — ' + a.sub; b.onclick = () => { goTo(a.t); if (!playing) setPlaying(true); }; $('chips').appendChild(b); });
    $('go').onclick = () => { sfx.unlock(); $('start').classList.add('hide'); started = true; goTo(0); setPlaying(true); };
    $('bPlay').onclick = () => { if (story.t >= TL.total - 0.1) goTo(0); setPlaying(!playing); };
    $('bRestart').onclick = () => { goTo(0); setPlaying(true); };
    $('bSpeed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1; $('bSpeed').textContent = speed + '×'; };
    $('bCam').onclick = () => { free = !free; orbit.set = false; $('bCam').style.background = free ? '#ffca28' : ''; };
    $('bSnd').onclick = () => { soundOn = !soundOn; sfx.setOn(soundOn); $('bSnd').textContent = soundOn ? '🔊' : '🔇'; if (!soundOn) sfx.music(false); };
    $('seek').addEventListener('input', () => { dragSeek = true; goTo($('seek').value / 1000 * TL.total); });
    $('seek').addEventListener('change', () => { dragSeek = false; });
    addEventListener('keydown', (e) => {
        if (!started) return;
        if (e.code === 'Space') { e.preventDefault(); $('bPlay').click(); }
        else if (e.key === 'r' || e.key === 'R') $('bRestart').click();
        else if (e.key === 'c' || e.key === 'C') $('bCam').click();
        else if (e.key === 'm' || e.key === 'M') $('bSnd').click();
        else if (e.key === 'ArrowRight') goTo(story.t + 5);
        else if (e.key === 'ArrowLeft') goTo(story.t - 5);
    });
    const cv = JK.canvas;
    cv.addEventListener('pointerdown', (e) => { if (free) { dragging = true; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointerup', () => dragging = false);
    cv.addEventListener('pointermove', (e) => { if (free && dragging) { orbit.yaw -= e.movementX * 0.007; orbit.pitch = Math.max(-0.1, Math.min(1.4, orbit.pitch + e.movementY * 0.006)); } });
    cv.addEventListener('wheel', (e) => { if (free) { e.preventDefault(); orbit.dist = Math.max(2, Math.min(30, orbit.dist * (1 + e.deltaY * 0.001))); } }, { passive: false });

    window.__story = story; window.__goTo = goTo; window.__ready = true;
    goTo(0);
    requestAnimationFrame(loop);
})();
