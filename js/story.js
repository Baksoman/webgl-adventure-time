/* =====================================================================
   story.js - "Malam Permainan BMO yang Kacau": timeline 6 babak.
   Semua gerak karakter adalah fungsi waktu cerita t (deterministik), sehingga
   tombol restart / lompat babak / geser progress selalu menghasilkan adegan yang sama.
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT, sfx = JK.sfx, particles = JK.particles;
    const { Mat4, V3 } = JK;
    const { clamp, lerp, seg, ease, smooth, kf, angLerp } = AT;
    const TL = AT.TL, L = AT.L;
    const T = Mat4.translation, RY = Mat4.rotationY;

    /* ---------------- babak ---------------- */
    const ACTS = [
        { id: 1, t: TL.a1, name: 'Pembuka', sub: 'Idle → Jalan' },
        { id: 2, t: TL.a2, name: 'Mencari Kaset', sub: 'Memanjang' },
        { id: 3, t: TL.a3, name: 'Beres-beres Cepat', sub: 'Palu' },
        { id: 4, t: TL.a4, name: 'Gangguan Kecil', sub: 'Bola & Mobil' },
        { id: 5, t: TL.a5, name: 'Puncak', sub: 'Pedang' },
        { id: 6, t: TL.a6, name: 'Penutup', sub: 'Roket + Dansa' }
    ];

    /* ---------------- subtitle [mulai, selesai, siapa, teks] ---------------- */
    const WHO = { n: ['', '#ffffff'], f: ['Finn', '#4fc3f7'], j: ['Jake', '#ffca28'], b: ['BMO', '#69f0ae'], t: ['Boneka', '#ff8a80'] };
    const SUBS = [
        [4.2, 8.6, 'n', 'Malam hari di rumah pohon. Finn dan Jake bersantai di ruang utama…'],
        [9.4, 11.6, 'b', '*bip bip* …BMO menyala!'],
        [12.2, 16.2, 'b', 'Finn! Jake! Ayo main game malam ini!'],
        [16.5, 18.6, 'f', 'Algebraic! Ayo main, BMO!'],
        [18.8, 21.0, 'j', 'Yuhuu! Aku sudah siap!'],
        [21.3, 25.2, 'b', 'Tapi… kaset game favorit BMO hilang entah ke mana.'],
        [25.5, 28.0, 'f', 'Hilang? Tenang, kita cari bareng!'],
        [28.3, 30.6, 'j', 'Ikuti aku! Aku punya firasat.'],
        [31.2, 34.2, 'b', 'Itu dia! Kasetku di rak paling atas!'],
        [34.5, 36.8, 'f', 'Terlalu tinggi… Jake, bisa bantu?'],
        [37.0, 39.6, 'j', 'Jurus melar… hnnnggg!'],
        [40.4, 42.0, 'j', 'Dapat! …eh? Kok goyang?'],
        [42.3, 45.6, 'n', 'Rak bergoyang dan seluruh isinya berjatuhan!'],
        [46.0, 48.6, 'b', 'Aaa! Meja BMO patah kakinya!'],
        [49.0, 52.0, 'f', 'Waduh. Jake, kita butuh palu!'],
        [52.4, 56.0, 'j', 'Palu? Siap! Kecilkan badan dulu…'],
        [58.8, 61.0, 'j', 'Mode palu: ON!'],
        [62.4, 64.8, 'f', 'Aku tahan kakinya! Pukul lagi!'],
        [66.0, 68.4, 'n', 'Beres! Mejanya tegak kembali.'],
        [69.4, 72.8, 'b', 'Mejanya bagus lagi! Kamu hebat, Jake!'],
        [73.2, 76.6, 'f', 'Nah, kasetnya sudah ketemu. Ayo kita main!'],
        [77.0, 80.0, 'j', 'Hehe… tentu. Nih, ada di tanganku.'],
        [80.4, 85.0, 'b', 'Hei… tumpukan barang itu kok bergerak?'],
        [86.4, 88.4, 'n', 'Boneka wind-up nakal muncul dari tumpukan!'],
        [88.8, 91.0, 't', 'Tik-tik-tik! Kasetnya kubawa~'],
        [91.2, 93.4, 'j', 'Hei! Kembalikan kasetnya!'],
        [93.8, 96.2, 'f', 'Kejar dia, Jake! Jadi bola!'],
        [96.6, 99.6, 'j', 'Boing! Boing! Boing!'],
        [101.0, 103.8, 'j', 'Terlalu lambat? Mode balapan! Vroom!'],
        [106.0, 110.0, 'b', 'Dia lari ke pojok perapian!'],
        [112.0, 114.4, 'f', 'Dia terpojok! Jake, jadi pedang!'],
        [114.6, 117.2, 'j', 'Pedang? Keren banget! POOF!'],
        [118.4, 121.0, 'j', 'Ayunkan aku, Finn!'],
        [121.2, 123.0, 'f', 'Terima inilah… YAAAH!'],
        [123.5, 125.8, 'n', 'BOINGGG! (komikal, bukan serius)'],
        [126.0, 129.6, 't', 'tik… tik… ti…………'],
        [129.8, 132.4, 'j', 'Pertarungan selesai. Hehe.'],
        [132.6, 135.0, 'b', 'Kasetku ketemu lagi!'],
        [135.4, 139.0, 'f', 'Nih, BMO. Tapi biar seru, kita kirim lewat jalur ekspres.'],
        [139.3, 141.6, 'j', 'Jalur ekspres? ROKET!'],
        [141.8, 143.0, 'f', '3… 2… 1…'],
        [147.0, 149.0, 'b', 'Tangkap! Hore, kasetnya kembali!'],
        [149.6, 152.5, 'b', 'Sekarang… PESTA JOGET!'],
        [152.8, 160.0, 'n', 'Jake berdansa. Finn dan BMO ikut bergoyang.']
    ].map(s => ({ t0: s[0], t1: s[1], who: s[2], text: s[3] }));
    const BLIP = { f: 330, j: 220, b: 520, t: 700, n: 0 };

    /* ---------------- jalur karakter ---------------- */
    function Track(keys) {
        const step = 1 / 60, n = Math.ceil(TL.total / step) + 2, D = new Float32Array(n);
        const p = (t) => kf(keys, t);
        let prev = p(0);
        for (let i = 1; i < n; i++) { const q = p(i * step); D[i] = D[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
        return {
            pos: p,
            dist: (t) => { const f = clamp(t / step, 0, n - 2), i = Math.floor(f); return lerp(D[i], D[i + 1], f - i); },
            speed: (t) => { const a = p(t - 0.06), b = p(t + 0.06); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.12; },
            dir: (t) => { const a = p(t - 0.06), b = p(t + 0.06); return Math.atan2(b[0] - a[0], b[1] - a[1]); }
        };
    }
    const FINN = Track([[0, 1.3, -0.9], [22.2, 1.3, -0.9], [29.6, 5.8, -4.9], [57, 5.8, -4.9], [60, 2.9, -4.3], [111.5, 2.9, -4.3], [113, 2.4, -3.8], [118, -3.4, -5.9], [121.5, -3.4, -5.9], [123, -4.7, -5.9], [127, -4.7, -5.9], [131, -4.3, -3.3], [141, -4.3, -3.3], [149, -2.2, 0.7]]);
    const JAKE = Track([[0, 2.6, -0.5], [22.4, 2.6, -0.5], [30.2, 3.4, -5.4], [56, 3.4, -5.4], [59.2, 3.02, -6.14], [88, 3.02, -6.14], [126.4, -3.0, -4.7], [131, -3.0, -4.7], [137, -3.3, -2.4], [149, 0.2, 0.7]]);
    const BMO = Track([[0, -6.5, -4.6], [11.8, -6.5, -4.6], [19, -0.2, -0.8], [22.8, -0.2, -0.8], [29.8, 4.7, -4.9], [57, 4.7, -4.9], [60, 4.9, -3.4], [112, 4.9, -3.4], [118, -1.0, -3.0], [134, -1.0, -3.0], [139, 1.9, -0.6], [149, 2.0, 0.6]]);
    const YAW = {
        f: [[0, -0.7], [22, -0.7], [29, 0.0], [57, 0], [60, -1.5], [86, -1.5], [88.6, -0.9], [111, -0.9], [112.6, -1.57], [127, -1.57], [131, -1.9], [135, 0.2], [149, 0]],
        j: [[0, -0.7], [22, -0.7], [29, 0.0], [58, 0.0], [59.6, -0.9], [86, -0.9], [88.5, 0.8], [89.4, 0.8]],
        b: [[0, 0.8], [12.5, 1.4], [19, 1.5], [22.5, 1.5], [29, 0.0], [58, 0], [60, -0.9], [112, -0.9], [118, 0.3], [134, 0.3], [139, -0.6], [149, -0.3]]
    };
    const yawKey = (k, t) => kf(YAW[k], t, 'lin')[0];

    /* ---------------- rentang ekspresi ---------------- */
    const JEXPR = [[0, 3, 'senang'], [18.8, 21.2, 'senang'], [31, 34, 'kaget'], [37, 40.4, 'marah'], [40.4, 41.6, 'senang'], [41.8, 46, 'kaget'], [52.4, 56, 'senang'],
        [58.8, 60.2, 'marah'], [68, 78, 'senang'], [86.2, 88.4, 'kaget'], [88.6, 92, 'marah'], [92, 100, 'senang'], [100, 111, 'marah'], [114, 118, 'senang'], [118, 124, 'marah'],
        [125, 133, 'senang'], [139, 143, 'kaget'], [143, 147, 'senang'], [150, 166, 'senang']];
    const BEXPR = [[0, 9, 4], [9, 9.18, 6], [9.18, 9.36, 4], [9.36, 9.6, 6], [9.6, 9.72, 4], [9.72, 10.0, 6], [10, 11.6, 0], [11.6, 21.0, 0], [21, 26, 5], [26, 31, 0], [31, 36.5, 2], [36.5, 41, 0], [41.5, 49, 2],
        [49, 58, 5], [58, 68, 2], [68, 80, 7], [80, 88, 2], [88, 106, 2], [106, 111, 5], [111, 123, 2], [123, 131, 1], [131, 136, 7], [136, 147, 0], [147, 149, 2], [149, 170, 7]];
    const lookup = (arr, t, d) => { for (const r of arr) if (t >= r[0] && t < r[1]) return r[2]; return d; };

    /* ---------------- kamera ---------------- */
    const CAM = [
        [0, 0, 7, 16, 0, 2.8, -3], [4, -1, 4.8, 10.5, 0.5, 2.4, -2], [8.8, -4, 3.5, 5.5, -5.5, 1.5, -4.5], [11.8, -3.5, 3.2, 4.5, -4, 1.2, -3.5],
        [15.5, -1.2, 3.0, 4.2, -0.5, 1.5, -1], [21, 1.5, 3.4, 5.5, 1.2, 1.7, -1], [24, 3, 4.8, 9, 3, 1.8, -3], [30.2, 4.3, 4.4, 3.2, 4.3, 2.4, -6],
        [36, 4.2, 4.6, 3.3, 4.3, 3.8, -6.5], [40.4, 4.7, 5.2, 2.4, 4.4, 5.0, -7], [43, 3.5, 4.2, 6.3, 3.6, 2.6, -6], [48, 2.6, 3.8, 5.5, 2.5, 1.5, -5.4], [56, 3.4, 3.4, 2.2, 3.2, 1.4, -5.3],
        [59.6, 5.0, 2.9, 0.6, 2.7, 1.0, -5.0], [67.8, 5.2, 2.7, 0.4, 2.6, 1.1, -5.0], [70, 3.4, 3.6, 3.4, 3.0, 1.9, -4.6], [80, 3.8, 3.2, 2.2, 3.9, 1.5, -5.4], [86.5, 2.6, 2.6, -0.4, 3.9, 0.8, -5.5],
        [89.4, 1.0, 5.6, 10, 1.0, 1.0, -3], [100, 0.6, 6.4, 9.5, -1.0, 0.8, -2], [108, -1.5, 4.2, 4.5, -4.2, 0.8, -4], [111.5, -2.2, 2.8, -0.5, -5.2, 1.0, -5.6],
        [116, -0.5, 3.2, -1.8, -4.4, 1.9, -5.9], [121, -1.0, 2.6, -2.4, -5.0, 2.0, -6.0], [123.4, -2.4, 2.0, -3.2, -5.7, 1.4, -6.0], [127, -1.2, 3.4, 3.2, -4.4, 1.2, -4.4],
        [133, -2.5, 3.6, 2.2, -4.5, 1.1, -3.4], [138, -1.8, 3.8, 2.8, -3.6, 2.0, -2.0], [141.5, -1.5, 2.8, 1.8, -3.3, 1.8, -2.4], [148, 1.0, 3.2, 5, 1.7, 1.2, -0.6],
        [150.5, 0.6, 4.2, 9.5, 0.2, 1.8, -0.5], [158, 0.6, 3.0, 6.2, 0.2, 1.7, 0.2], [165, 0.5, 4.8, 12, 0.2, 2.3, -0.5], [168, 0.5, 5.2, 13, 0.2, 2.4, -0.5]
    ];

    /* ---------------- rocket ---------------- */
    const RK = [[-3.3, 1.0, -2.4], [-2.3, 5.6, -1.4], [0.2, 4.6, 1.6], [1.55, 1.45, -0.3]];
    const bez = (p, u) => { const m = 1 - u; return [0, 1, 2].map(k => m * m * m * p[0][k] + 3 * m * m * u * p[1][k] + 3 * m * u * u * p[2][k] + u * u * u * p[3][k]); };
    const bezD = (p, u) => { const m = 1 - u; return [0, 1, 2].map(k => 3 * m * m * (p[1][k] - p[0][k]) + 6 * m * u * (p[2][k] - p[1][k]) + 3 * u * u * (p[3][k] - p[2][k])); };

    /* ---------------- pedang dipegang Finn ---------------- */
    function swordPhi(t) {
        if (t < 120.4) return 0.55;
        if (t < 122.8) return lerp(0.55, -0.6, ease(seg(t, 120.4, 122.8)));
        if (t < 123.35) return lerp(-0.6, 2.2, ease(seg(t, 122.8, 123.35)));
        return lerp(2.2, 0.9, ease(seg(t, 124.2, 126.0)));
    }

    /* =====================================================================
       STORY
       ===================================================================== */
    class Story {
        constructor() {
            this.jake = new AT.JakeActor(0.55); this.finn = new AT.FinnActor(); this.bmo = new AT.BMOActor();
            this.t = 0; this.shake = 0; this.hyS = { f: 0, j: 0, b: 0 }; this.nextBlip = 0; this.prevT = 0; this.evDone = {};
            this.cam = { eye: [0, 7, 16], target: [0, 2.8, -3], fov: 42 };
            this.acts = ACTS; this.subs = SUBS; this.who = WHO;
        }
        reset() { this.jake.reset(); this.finn.reset(); this.bmo.reset(); this.t = 0; this.prevT = 0; this.shake = 0; this.hyS = { f: 0, j: 0, b: 0 }; sfx.engine(false, 0); sfx.music(false); }
        sub(t) { for (const s of SUBS) if (t >= s.t0 && t < s.t1) return s; return null; }
        actAt(t) { let a = null; for (const x of ACTS) if (t >= x.t) a = x; return a; }

        /* ---- peristiwa satu-kali (suara & guncangan) saat waktu melintasi t ---- */
        events(a, b) {
            const x = (t, fn) => { if (a < t && b >= t) fn(); };
            x(9.0, () => sfx.boot()); x(10.0, () => sfx.pop()); x(21.4, () => sfx.sad());
            x(34.4, () => sfx.gasp()); x(37.4, () => sfx.boing(1.2)); x(40.6, () => sfx.clunk && sfx.clunk());
            x(TL.hit, () => { sfx.crash(); this.shake = 0.5; }); x(TL.fall + 0.3, () => sfx.thud(0.6)); x(TL.fall + 0.55, () => sfx.thud(0.5));
            x(51.0, () => sfx.boing(0.8)); x(TL.hamStart + 1.9, () => { this.shake = 0.25; }); x(TL.hamStart + 5.5, () => { this.shake = 0.25; });
            x(67.5, () => sfx.tada()); x(TL.toyPop, () => sfx.sproing()); x(TL.snatch, () => sfx.zap());
            x(TL.toyHit, () => { sfx.bonk(); sfx.sproing(); this.shake = 0.45; }); x(TL.toyHit + 1.1, () => sfx.thud(0.5));
            x(TL.launch, () => sfx.rocket()); x(TL.arrive, () => sfx.tada()); x(TL.insert, () => sfx.ding());
            x(TL.dance, () => sfx.music(true)); x(TL.end + 1, () => sfx.music(false));
        }

        /* ---- bangun perintah aktor pada waktu t ---- */
        frame(dt, silent, opt) {
            const t = this.t, A = this._anchors || { jakeHandL: [3, 2, -5], jakeHandR: [3, 2, -5], finnHandR: [0, 1, 0], nose: [0, 1, 0], bmoHandR: [0, 1, 0], bmoSlot: [0, 1, 0] };
            const spk = this.sub(t);
            const fP = FINN.pos(t), jP = JAKE.pos(t), bP = BMO.pos(t);
            const toy = AT.toyState(t);
            const jc = { silent, sound: opt.sound }, fc = {}, bc = {};

            /* ----- Finn ----- */
            const fsp = FINN.speed(t);
            fc.x = fP[0]; fc.z = fP[1];
            let fyaw = yawKey('f', t); const fmv = smooth(seg(fsp, 0.3, 0.9));
            fyaw = angLerp(fyaw, FINN.dir(t), fmv);
            fc.yaw = fyaw;
            if (fsp > 0.3) fc.walkPh = FINN.dist(t) * 1.9;
            fc.mouth = spk && spk.who === 'f' ? 1 + 0.9 * Math.abs(Math.sin(t * 14)) : 1;

            /* ----- BMO ----- */
            const bsp = BMO.speed(t);
            bc.x = bP[0]; bc.z = bP[1];
            bc.yaw = angLerp(yawKey('b', t), BMO.dir(t), smooth(seg(bsp, 0.3, 0.9)));
            bc.pose = bsp > 0.3 ? AT.BMOActor.poses.walk(BMO.dist(t) * 9.5) : AT.BMOActor.poses.idle(t);
            let be = lookup(BEXPR, t, 0);
            if (spk && spk.who === 'b' && (be === 0 || be === 7)) be = Math.sin(t * 15) > 0 ? 1 : 0;
            bc.expr = be;
            bc.glow = t < 9 ? 0.4 : 1.15;
            const hopWin = (t > 31 && t < 34) || (t > 69 && t < 73) || (t > 132 && t < 135) || (t > 147 && t < 149);
            if (hopWin) bc.hop = Math.abs(Math.sin(t * 8)) * 0.1;
            if ((t > 31 && t < 34.5) || (t > 69 && t < 73) || (t > 147 && t < 149.6)) bc.pose = Object.assign({}, bc.pose, AT.BMOActor.poses.cheer(t));
            if (t >= TL.dance) { bc.pose = AT.BMOActor.poses.dance(t); bc.hop = Math.abs(Math.sin(t * 6.4)) * 0.06; }
            if (t > 85 && t < 89) bc.pose = Object.assign({}, bc.pose, { abdL: 1.0, abdR: 1.0 });   // kaget

            /* ----- Jake: posisi & gerak dasar ----- */
            const jsp = JAKE.speed(t);
            jc.x = jP[0]; jc.z = jP[1]; jc.y = 0;
            jc.yaw = angLerp(yawKey('j', t), JAKE.dir(t), smooth(seg(jsp, 0.3, 0.9)));
            jc.loco = jsp > 0.3 ? 'walk' : 'idle';
            jc.locoClock = JAKE.dist(t) * 0.6;
            const ex = lookup(JEXPR, t, 'normal'); jc.expr = ex;
            if (t >= TL.dance) jc.loco = 'dance';

            // Act 2: memanjang & menjangkau kaset
            jc.tall = t > 36.3 && t < 51.5;
            if (t > 37.0 && t < 49) {
                const k = ease(seg(t, 37.0, 39.4)) * (1 - ease(seg(t, 46.5, 49)));
                const shelfP = [4.45, 5.27, L.shelf.z + 0.1], carry = [3.9, 4.7, -5.7];
                jc.reachR = { p: V3.lerp(shelfP, carry, ease(seg(t, 40.4, 42.0))), k, bow: 0.3 };
            }
            // Act 3: palu
            if (t > 59.4 && t < 67.3) { jc.action = 'hammer'; jc.actClock = Math.max(0, t - TL.hamStart); }
            if (t >= 59.2 && t < 88.5) jc.yaw = -0.9 + (t < 62 ? 0 : 0);
            if (t >= 69 && t < 85.5) jc.yaw = -0.9 + 0.5 * ease(seg(t, 69, 72));

            /* ----- Act 4: kejar boneka (bola → mobil) ----- */
            let chasePos = null;
            if (t >= 89.4 && t < TL.a5 + 6) {
                const lag = t < 100 ? 1.7 : lerp(1.3, 0.5, seg(t, 100, 111.5));
                const run = AT.toyRun(Math.min(t - lag, TL.runEnd - 0.55));
                const k = ease(seg(t, 89.4, 91.2));
                chasePos = { x: lerp(jP[0], run.x, k), z: lerp(jP[1], run.z, k), yaw: run.yaw, dist: run.dist };
            }
            if (t >= 89.4 && t < 100.4) { jc.mode = 'ball'; }
            if (t >= 100.4 && t < 117) { jc.mode = 'car'; jc.noSpin = false; }
            if (chasePos && t < 117) {
                jc.x = chasePos.x; jc.z = chasePos.z; jc.yaw = chasePos.yaw; jc.loco = 'idle';
                jc.roll = chasePos.dist / 0.3;
                jc.expr = t < 100.4 ? 'senang' : 'marah';
            }

            /* ----- Act 5: pedang dipegang Finn ----- */
            if (t >= 117 && t < 126.4) {
                jc.mode = 'sword';
                const phi = swordPhi(t), fy = fc.yaw;
                const cy = Math.cos(fy), sy = Math.sin(fy);
                const loc = (x, y, z) => [fc.x + x * cy + z * sy, y, fc.z - x * sy + z * cy];
                const dl = [0, Math.cos(phi), Math.sin(phi)];
                const d = V3.norm([dl[0] * cy + dl[2] * sy, dl[1], -dl[0] * sy + dl[2] * cy]);
                const H = loc(0.18, 1.75, 0.72), H2 = V3.sub(H, V3.mul(d, 0.38));
                fc.armR = { w: H, pole: [0.6, -0.3, -0.5] }; fc.armL = { w: H2, pole: [-0.6, -0.3, -0.5] };
                const face = V3.norm([0.1, 0.25, 1]);
                let f = V3.sub(face, V3.mul(d, V3.dot(face, d))); f = V3.norm(f);
                const sc = 0.55 * 0.9;
                jc.placeMat = Mat4.chain(T(H[0], H[1], H[2]), Mat4.fromBasis([0, 0, 0], V3.cross(d, f), d, f), Mat4.scaling(sc, sc, sc), T(0, -1.3, 0));
                jc.swing = 0;
                jc.expr = t > 122.6 ? 'marah' : 'ngambek';
                fc.lean = 0.1 + 0.35 * ease(seg(t, 122.8, 123.35)) * (1 - ease(seg(t, 124, 125.5)));
                fc.mouth = t > 122.7 && t < 124 ? 2.2 : fc.mouth;
            }

            /* ----- Finn: gestur lain ----- */
            if (t > 33 && t < 37.5) fc.armR = { w: [4.6, 5.1, -6.8], pole: [0.5, 0.6, -0.2] };
            if (t > 33 && t < 37.5) { fc.hp = -0.3; }
            if (t > 59.5 && t < 68) {   // menahan kaki meja, tersentak tiap pukulan
                const leg = [2.15, 1.55, -4.75];
                fc.armR = { w: V3.add(leg, [0.12, 0, 0.1]), pole: [0.3, -0.5, 0.2] }; fc.armL = { w: V3.add(leg, [0.12, 0.25, -0.05]), pole: [-0.2, -0.5, -0.2] };
                const h1 = TL.hamStart + 1.9, h2 = TL.hamStart + 5.5;
                const flinch = Math.max(Math.exp(-(t - h1) * 6) * (t > h1), Math.exp(-(t - h2) * 6) * (t > h2));
                fc.hp = -0.4 * flinch; fc.lean = 0.25 + 0.2 * flinch; fc.mouth = 1.5 * flinch + 1;
            }
            if (t > 70 && t < 78) { fc.armR = { l: [0.6, 2.5, 0.2], pole: [0.5, 0.3, -0.5] }; fc.hy = 0.0; }          // jempol/hore
            if (t > 129 && t < 133) fc.armR = { l: [0.55, 1.85, 0.4], pole: [0.5, -0.2, -0.5] };
            if (t > 132.4 && t < 135) {  // ambil kaset di lantai
                const k = ease(seg(t, 132.4, 133.6)) * (1 - ease(seg(t, 134.1, 135.2)));
                fc.lean = 1.05 * k; fc.armR = { w: V3.lerp([fc.x - 0.4, 1.4, fc.z], [-4.85, 0.2, -3.6], k), pole: [0.4, -0.2, 0.3] };
            }
            if (t >= 135 && t < TL.attach + 0.6) fc.armR = { l: [0.55, 2.05, 0.55], pole: [0.5, 0.0, -0.4] };
            if (t > TL.attach + 0.6 && t < TL.arrive) fc.armR = { l: [0.62, 2.55, 0.15], pole: [0.5, 0.2, -0.4] };
            if (t >= TL.dance) {
                const s = Math.sin(t * 6.4), c2 = Math.cos(t * 6.4);
                fc.armR = { l: [0.55, 2.3 + 0.35 * s, 0.1], pole: [0.5, 0.3, -0.4] }; fc.armL = { l: [-0.55, 2.3 - 0.35 * s, 0.1], pole: [-0.5, 0.3, -0.4] };
                fc.bob = Math.abs(s) * 0.07; fc.twist = 0.25 * c2; fc.lr = 0.3 * s; fc.ll = -0.3 * s; fc.sway = 0.07 * s; fc.mouth = 1.8;
            }
            if (fc.x !== undefined && t > 60 && t < 67.5) fc.yaw = -1.3;

            /* ----- Act 6: roket ----- */
            let rocketPos = null, rocketDir = null;
            if (t >= 139 && t < 147.45) {
                jc.mode = 'rocket';
                jc.x = RK[0][0]; jc.z = RK[0][2]; jc.y = 0.0;
                jc.yaw = 0; jc.loco = 'idle'; jc.expr = t < 142.2 ? 'kaget' : 'senang';
                let d = [0, 1, 0.02], pos = V3.add(RK[0], [0, 0, 0]);
                if (t >= TL.launch) {
                    const u = ease(clamp((t - TL.launch) / (TL.arrive - TL.launch), 0, 1)) * 0.985 + 0.0;
                    pos = bez(RK, u); d = V3.norm(bezD(RK, Math.max(0.001, u)));
                    pos = V3.add(pos, [0, 0, 0]);
                } else {
                    const lift = 0.06 * Math.sin(t * 20) * seg(t, TL.launch - 1, TL.launch);
                    pos = [RK[0][0], RK[0][1] + lift, RK[0][2]];
                }
                rocketPos = pos; rocketDir = d;
                jc.rocketDir = d; jc.rocketFace = [0.3, 0.4, 1];
                jc.x = pos[0]; jc.y = pos[1] - 1.1; jc.z = pos[2];
                if (t >= TL.arrive) jc.y = lerp(pos[1] - 1.1, 0, seg(t, TL.arrive, TL.arrive + 0.5));
            }
            if (t >= 147.45 && t < TL.dance) {
                jc.x = RK[3][0] - 0.2; jc.z = RK[3][2] + 0.7; jc.yaw = -0.5; jc.loco = 'idle';
            }

            /* ----- tatapan kepala ----- */
            const pos3 = { f: [fc.x, fc.z], j: [jc.x, jc.z], b: [bc.x, bc.z] };
            const lookAtWho = (k, myYaw, myPos) => {
                let tgt = null;
                if (spk && spk.who !== k && pos3[spk.who]) tgt = pos3[spk.who];
                else if (toy && t > 86 && t < 124) tgt = [toy.x, toy.z];
                let want = 0;
                if (tgt) want = clamp(angLerp(0, Math.atan2(tgt[0] - myPos[0], tgt[1] - myPos[1]) - myYaw, 1), -1.1, 1.1);
                this.hyS[k] += (want - this.hyS[k]) * Math.min(1, dt * 6);
                return this.hyS[k];
            };
            if (fc.hy === undefined) fc.hy = lookAtWho('f', fc.yaw, pos3.f);
            const bHead = lookAtWho('b', bc.yaw, pos3.b);
            if (!jc.placeMat) { /* kepala Jake mengikuti badan */ }
            if (bHead) bc.sway = (bc.sway || 0) + 0; // BMO tidak punya leher; hanya menoleh badan sedikit
            if (spk && spk.who === 'j' && jc.expr === 'normal') jc.expr = 'senang';

            /* ----- jalankan aktor ----- */
            const listA = [], listP = [];
            this.jake.frame(dt, jc, listA);
            this.finn.frame(dt, fc, listA);
            this.bmo.frame(dt, bc, listA);
            this._anchors = {
                jakeHandL: this.jake.hand.L, jakeHandR: this.jake.hand.R, finnHandR: this.finn.handW.R, nose: this.jake.nose,
                bmoHandR: this.bmo.handW.R, bmoSlot: this.bmo.slotW
            };
            AT.Props.frame(t, listP, this._anchors);
            if (!silent) { if (dt > 0) particles.step(dt); }
            particles.push(listA);

            /* ----- suara bicara (blip) ----- */
            if (!silent && dt > 0 && spk && BLIP[spk.who] && t >= this.nextBlip && t - spk.t0 < 2.6 && opt.sound !== false) {
                sfx.blip(BLIP[spk.who] * (0.9 + Math.random() * 0.25), 0.05);
                this.nextBlip = t + 0.1 + Math.random() * 0.06;
            }
            if (!silent && toy && t > TL.snatch && t < TL.runEnd && dt > 0 && Math.sin(t * 22) > 0.97) sfx.tick();

            /* ----- kamera ----- */
            const k = kf(CAM, t);
            let eye = k.slice(0, 3), target = k.slice(3, 6);
            if (rocketPos && t >= TL.launch - 0.2 && t < TL.arrive + 0.6) {
                const w = smooth(seg(t, TL.launch - 0.2, TL.launch + 0.5)) * (1 - smooth(seg(t, TL.arrive - 0.4, TL.arrive + 0.6)));
                eye = V3.lerp(eye, V3.add(rocketPos, [-2.6, 1.6, 5.2]), w); target = V3.lerp(target, rocketPos, w);
            }
            if (t > 89.4 && t < 112.5) {
                const w = smooth(seg(t, 89.4, 91)) * (1 - smooth(seg(t, 110.5, 112.5)));
                const tp = [jc.x, 0.7, jc.z], ey = [jc.x + 3.5, 5.2, jc.z + 9.5];
                eye = V3.lerp(eye, [Math.min(8, Math.max(-8, ey[0])), ey[1], Math.min(7.5, ey[2])], w); target = V3.lerp(target, tp, w);
            }
            this.shake *= Math.exp(-dt * 5);
            const sh = (this.shake + this.jake.shake) * (dt > 0 ? 1 : 0);
            if (sh > 0.003) { eye = [eye[0] + (Math.random() - 0.5) * sh, eye[1] + (Math.random() - 0.5) * sh, eye[2]]; }
            this.cam = { eye, target, fov: 42 };
            if (opt.freeCam) this.cam = opt.freeCam(this.cam);

            return listP.concat(listA);
        }

        /* ---- maju satu langkah waktu (dt detik cerita) ---- */
        step(dt, opt) {
            const a = this.t; this.t = Math.min(TL.total, this.t + dt);
            if (!opt.silent) this.events(a, this.t);
            return this.frame(dt, !!opt.silent, opt);
        }

        /* ---- lompat ke waktu t: reset lalu "panaskan" 2 detik terakhir tanpa suara ---- */
        seek(t, opt) {
            this.reset();
            const start = Math.max(0, t - 2.2);
            this.t = start;
            let list = null;
            while (this.t < t - 1e-6) { const d = Math.min(1 / 30, t - this.t); this.t += d; list = this.frame(d, true, Object.assign({}, opt, { silent: true })); }
            this.prevT = this.t;
        }
    }
    AT.Story = Story;
    AT.ACTS = ACTS;
})();
