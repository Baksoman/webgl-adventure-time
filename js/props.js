/* =====================================================================
   props.js - Interior rumah pohon + properti cerita (rak, meja, kaset, perapian, boneka wind-up).
   Semua posisi/animasi properti adalah FUNGSI dari waktu cerita t, jadi restart & seek selalu konsisten.
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT;
    const { Mat4, V3, T, S, mul } = JK;
    const { clamp, lerp, seg, ease, smooth, mk } = AT;
    const RX = Mat4.rotationX, RY = Mat4.rotationY, RZ = Mat4.rotationZ;

    /* ---------- jadwal cerita (detik) - dipakai story.js juga ---------- */
    const TL = AT.TL = {
        total: 168,
        a1: 4, a2: 30, a3: 58, a4: 84, a5: 112, a6: 136, end: 164,
        grab: 40.2, fall: 42.0, hamStart: 60.0, toyPop: 86.0, snatch: 88.6, runEnd: 111.5,
        swing: 123.0, toyHit: 123.35, pick: 134.0, attach: 141.2, launch: 142.2, arrive: 147.0, insert: 148.8, dance: 150
    };
    const L = AT.L = {
        shelf: { x: 4.6, z: -7.5 }, table: { x: 0.6, z: -5.45, hw: 1.7, hd: 0.85, top: 1.75 },
        fire: { x: -6.2, z: -7.7 }, legFR: [2.15, -4.75]
    };

    /* ---------- mesh dasar ---------- */
    const boxM = JK.gridMesh(24, 18, JK.shapeFn({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n: 7, m: 7 }));
    const roundM = JK.gridMesh(24, 18, JK.shapeFn({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n: 3.2, m: 5 }));
    const sphM = JK.sphereMesh(20, 14);
    const cylM = JK.gridMesh(24, 10, (u, v) => { const a = 2 * Math.PI * u; return [Math.cos(a), v * 2 - 1, Math.sin(a)]; }, (u, v, p) => [p[0], 0, p[2]]);
    const capM = JK.gridMesh(24, 4, (u, v) => { const a = 2 * Math.PI * u, r = v; return [r * Math.cos(a), 1, r * Math.sin(a)]; }, () => [0, 1, 0]);
    const WOOD = [0.55, 0.37, 0.21], WOOD2 = [0.42, 0.27, 0.15], STONE = [0.52, 0.5, 0.54], DARK = [0.08, 0.06, 0.07];

    const stat = [], shelfStat = [];
    const B = (arr, mesh, x, y, z, sx, sy, sz, col, ow, extra) => arr.push({ it: mk(mesh, col, 0.05, ow === undefined ? 0.4 : ow, extra), m: mul(T(x, y, z), S(sx, sy, sz)) });
    const box = (x, y, z, sx, sy, sz, col, ow, ex) => B(stat, boxM, x, y, z, sx, sy, sz, col, ow, ex);
    const sph = (x, y, z, sx, sy, sz, col, ow, ex) => B(stat, sphM, x, y, z, sx, sy, sz, col, ow, ex);
    const cyl = (x, y, z, r, hh, col, ow, ex, arr) => B(arr || stat, cylM, x, y, z, r, hh, r, col, ow, ex);

    /* --- lantai, dinding --- */
    box(0, -0.25, -1, 9.7, 0.25, 7.3, [0.45, 0.29, 0.17], 0);
    for (let i = -8; i <= 8; i++) box(i * 1.1, 0.0, -1, 0.025, 0.012, 7.3, [0.28, 0.17, 0.1], 0);
    box(0, 5, -8.35, 9.7, 5.2, 0.2, [0.58, 0.4, 0.25], 0);
    for (let x = -8.5; x <= 8.5; x += 1.15) box(x, 5, -8.13, 0.025, 5.1, 0.02, [0.38, 0.25, 0.15], 0);
    box(-9.7, 5, -1, 0.2, 5.2, 7.4, [0.5, 0.34, 0.21], 0);
    box(9.7, 5, -1, 0.2, 5.2, 7.4, [0.5, 0.34, 0.21], 0);
    [-6.6, -3, 1].forEach(z => box(0, 9.7, z, 9.7, 0.22, 0.22, WOOD2, 0.3));
    /* --- jendela malam --- */
    box(-1.6, 5.7, -8.12, 1.0, 1.0, 0.06, WOOD2, 0.3);
    box(-1.6, 5.7, -8.06, 0.88, 0.88, 0.02, [0.05, 0.09, 0.24], 0, { unlit: true });
    box(-1.6, 5.7, -8.04, 0.04, 0.88, 0.02, WOOD2, 0); box(-1.6, 5.7, -8.04, 0.88, 0.04, 0.02, WOOD2, 0);
    sph(-1.25, 6.1, -8.03, 0.2, 0.2, 0.03, [0.98, 0.96, 0.8], 0, { unlit: true });
    [[-1.95, 6.2], [-1.9, 5.5], [-1.4, 5.35], [-2.1, 5.85], [-1.0, 5.6]].forEach(p => sph(p[0], p[1], -8.03, 0.03, 0.03, 0.02, [1, 1, 0.9], 0, { unlit: true }));
    /* --- perapian --- */
    box(L.fire.x, 1.25, L.fire.z, 1.75, 1.25, 0.65, STONE, 0.35);
    box(L.fire.x, 0.75, L.fire.z + 0.66, 0.95, 0.65, 0.03, DARK, 0);
    box(L.fire.x, 2.65, L.fire.z + 0.3, 2.05, 0.14, 0.85, WOOD, 0.4);
    box(L.fire.x, 6.2, L.fire.z - 0.2, 0.95, 3.6, 0.4, STONE, 0.3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) box(L.fire.x - 1.2 + c * 0.8 + (r % 2) * 0.35, 0.3 + r * 0.55, L.fire.z + 0.67, 0.34, 0.2, 0.02, [0.42, 0.4, 0.44], 0);
    B(stat, cylM, L.fire.x - 0.25, 0.25, L.fire.z + 0.45, 0.14, 0.45, 0.14, WOOD2, 0.3);
    stat[stat.length - 1].m = mul(T(L.fire.x - 0.1, 0.17, L.fire.z + 0.5), mul(RZ(Math.PI / 2), S(0.13, 0.5, 0.13)));
    /* --- tangga ke lantai atas --- */
    for (let i = 0; i < 6; i++) { const top = (i + 1) * 0.5; box(8.4, top / 2, -1.2 - i * 1.05, 1.2, top / 2, 0.52, [0.5, 0.33, 0.19], 0.4); }
    box(8.4, 1.5, -7.4, 1.2, 1.5, 0.95, [0.46, 0.3, 0.17], 0.4);
    box(7.25, 3.9, -7.4, 0.07, 0.9, 0.07, WOOD2, 0.3); box(7.25, 4.75, -4.0, 0.06, 0.06, 3.5, WOOD2, 0.3); box(7.25, 3.9, -1.0, 0.07, 0.9, 0.07, WOOD2, 0.3);
    /* --- karpet, kantong kacang, peti --- */
    sph(-1.5, 0.02, -1.0, 3.2, 0.03, 2.2, [0.68, 0.24, 0.24], 0);
    sph(-1.5, 0.03, -1.0, 2.5, 0.03, 1.65, [0.92, 0.72, 0.38], 0);
    sph(-1.5, 0.04, -1.0, 1.7, 0.03, 1.1, [0.68, 0.24, 0.24], 0);
    B(stat, roundM, -8.1, 0.6, -2.3, 0.9, 0.6, 0.9, [0.3, 0.5, 0.75], 0.4);
    box(-8.5, 0.55, -4.9, 0.55, 0.55, 0.55, WOOD, 0.4); box(-8.45, 1.5, -4.9, 0.4, 0.4, 0.4, [0.85, 0.7, 0.3], 0.4);
    /* --- rak tinggi (bergoyang) --- */
    const sx = L.shelf.x, sz = L.shelf.z;
    box(2.95, 3.2, sz, 0.09, 3.3, 0.52, WOOD2, 0.4, null); shelfStat.push(stat.pop());
    box(6.25, 3.2, sz, 0.09, 3.3, 0.52, WOOD2, 0.4); shelfStat.push(stat.pop());
    box(sx, 3.2, sz - 0.52, 1.7, 3.3, 0.04, [0.4, 0.26, 0.15], 0); shelfStat.push(stat.pop());
    [0.08, 1.6, 3.2, 4.8, 6.45].forEach(y => { box(sx, y, sz, 1.7, 0.07, 0.52, WOOD, 0.4); shelfStat.push(stat.pop()); });
    const sBook = (x, y, w, h, col) => { box(x, y + h, sz + 0.05, w, h, 0.32, col, 0.3); shelfStat.push(stat.pop()); };
    [[3.3, 1.67, 0.1, 0.55, [0.7, 0.2, 0.2]], [3.52, 1.67, 0.1, 0.48, [0.2, 0.45, 0.7]], [3.74, 1.67, 0.1, 0.52, [0.3, 0.6, 0.3]], [3.96, 1.67, 0.1, 0.45, [0.8, 0.65, 0.2]], [4.4, 1.67, 0.12, 0.5, [0.55, 0.3, 0.6]],
    [5.4, 1.67, 0.1, 0.5, [0.7, 0.2, 0.2]], [5.62, 1.67, 0.1, 0.46, [0.25, 0.5, 0.55]], [3.4, 0.15, 0.4, 0.3, [0.4, 0.3, 0.2]], [5.5, 0.15, 0.5, 0.35, [0.5, 0.5, 0.55]]]
        .forEach(b => sBook(b[0], b[1], b[2], b[3], b[4]));
    // pot tanaman statis di rak tengah + benda di rak paling atas (kaset duduk di sini)
    sph(3.5, 3.55, sz, 0.28, 0.28, 0.28, [0.3, 0.6, 0.3], 0.4); shelfStat.push(stat.pop());
    /* --- meja (dinamis) --- */
    const TB = L.table;
    const TABLE_TOP = mk(boxM, [0.58, 0.39, 0.22], 0.05, 0.4), LEG = mk(boxM, WOOD2, 0.05, 0.4);

    /* ---------- benda jatuh dari rak ---------- */
    const g = 14;
    const FALL = [
        { it: mk(cylM, [0.8, 0.22, 0.2], 0.1, 0.5), kind: 'cyl', s: [0.36, 0.3, 0.36], from: [3.45, 4.84 + 0.3, sz], to: [1.9, TB.top + 0.3, -5.55], d: 0 },
        { it: mk(boxM, [0.3, 0.5, 0.75], 0.05, 0.5), s: [0.3, 0.18, 0.24], from: [4.2, 3.26 + 0.18, sz], to: [4.4, 0.18, -5.7], d: 0.18, spin: 3 },
        { it: mk(sphM, [0.35, 0.65, 0.35], 0.2, 0.5), s: [0.34, 0.34, 0.34], from: [5.3, 4.84 + 0.34, sz], to: [5.7, 0.34, -5.3], d: 0.3, spin: 2 },
        { it: mk(boxM, [0.95, 0.8, 0.3], 0.1, 0.5), s: [0.24, 0.28, 0.24], from: [5.8, 3.26 + 0.28, sz], to: [5.0, 0.28, -6.1], d: 0.45, spin: 4 },
        { it: mk(roundM, [0.75, 0.5, 0.25], 0.05, 0.5), s: [0.3, 0.2, 0.3], from: [4.7, 4.84 + 0.2, sz], to: [3.7, 0.2, -4.7], d: 0.6, spin: 5 }
    ];
    function fallState(f, t) {
        const t0 = TL.fall + f.d, dt = t - t0;
        if (dt < 0) return { p: f.from, a: 0 };
        const tl = Math.sqrt(2 * Math.max(0.01, f.from[1] - f.to[1]) / g);
        const k = Math.min(dt, tl) / tl;
        const x = lerp(f.from[0], f.to[0], k), z = lerp(f.from[2], f.to[2], k);
        let y = f.from[1] - 0.5 * g * Math.min(dt, tl) ** 2;
        if (dt > tl) y = f.to[1] + 0.35 * Math.exp(-4 * (dt - tl)) * Math.abs(Math.sin(8 * (dt - tl)));
        return { p: [x, y, z], a: f.spin ? f.spin * Math.min(dt, tl + 0.4) : 0, land: tl };
    }
    const heavyLand = TL.fall + FALL[0].d + Math.sqrt(2 * (FALL[0].from[1] - FALL[0].to[1]) / g);
    TL.hit = heavyLand;

    /* ---------- meja: kemiringan sebagai fungsi waktu ---------- */
    const H1 = TL.hamStart + 1.85 + 0.05, H2 = TL.hamStart + 3.6 + 1.85 + 0.05;
    function tilt(t) {
        let v = 0;
        v += 0.32 * ease(seg(t, TL.hit, TL.hit + 0.25));
        v -= 0.15 * ease(seg(t, H1, H1 + 0.3));
        v -= 0.17 * ease(seg(t, H2, H2 + 0.3));
        if (t > H2) v += 0.02 * Math.exp(-6 * (t - H2)) * Math.sin(30 * (t - H2));
        return Math.max(0, v);
    }
    AT.tableTilt = tilt;
    // sekeliling hit: goyang tipis di bawah meja saat benda mendarat
    function shelfShake(t) {
        const a = seg(t, 40.4, 41.0) * (1 - seg(t, 43.4, 44.6));
        return a * 0.045 * Math.sin(t * 38);
    }

    /* ---------- kaset ---------- */
    const CASE_BODY = mk(roundM, [0.5, 0.55, 0.6], 0.2, 0.45), CASE_LAB = mk(boxM, [0.95, 0.8, 0.25], 0.1, 0), CASE_DK = mk(boxM, DARK, 0, 0), CASE_GN = mk(boxM, [0.2, 0.8, 0.3], 0.2, 0);
    function drawCassette(list, p, rz, ry, sc) {
        const base = Mat4.chain(T(p[0], p[1], p[2]), RY(ry || 0), RZ(rz || 0), S(sc || 1, sc || 1, sc || 1));
        const add = (it, m) => list.push([it, mul(base, m), 1]);
        add(CASE_BODY, S(0.34, 0.45, 0.07));
        add(CASE_LAB, mul(T(0, 0.12, 0.07), S(0.25, 0.17, 0.01)));
        add(CASE_GN, mul(T(-0.12, 0.12, 0.085), S(0.04, 0.04, 0.01)));
        add(CASE_DK, mul(T(0, -0.4, 0.04), S(0.22, 0.05, 0.03)));
    }

    /* ---------- boneka wind-up ---------- */
    // jalur lari: poligon kasar -> Catmull-Rom -> panjang busur
    const WP = [[3.9, -5.0], [5.8, -2.6], [4.6, 0.8], [1.2, 2.4], [-2.5, 2.2], [-6.2, 0.6], [-6.8, -2.6], [-3.6, -3.4], [0.5, -2.2], [3.5, -0.4], [6.0, 1.8], [3.0, 3.6], [-1.5, 3.8], [-5.6, 2.6], [-7.2, -1.2], [-5.6, -3.8], [-3.4, -5.4], [-6.0, -6.1]];
    const pathFn = JK.catmullRom(WP.map(p => [p[0], 0, p[1]]));
    const PN = 900, PT = [], PS = [0];
    for (let i = 0; i <= PN; i++) { PT.push(pathFn(i / PN)); if (i) PS.push(PS[i - 1] + Math.hypot(PT[i][0] - PT[i - 1][0], PT[i][2] - PT[i - 1][2])); }
    const PLEN = PS[PN];
    function pathAt(s) {
        s = clamp(s, 0, PLEN);
        let lo = 0, hi = PN; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PS[m] <= s) lo = m; else hi = m; }
        const u = (s - PS[lo]) / Math.max(1e-6, PS[hi] - PS[lo]);
        return [lerp(PT[lo][0], PT[hi][0], u), lerp(PT[lo][2], PT[hi][2], u), PT[hi][0] - PT[lo][0], PT[hi][2] - PT[lo][2]];
    }
    const RUN0 = TL.snatch, RUN1 = TL.runEnd;
    // posisi/arah boneka di jalur: s(t) linear. Mengembalikan {x,z,yaw,s}
    AT.toyRun = (t) => {
        const s = PLEN * clamp((t - RUN0) / (RUN1 - RUN0), 0, 1);
        const p = pathAt(s);
        return { x: p[0], z: p[1], yaw: Math.atan2(p[2], p[3]), dist: s, speed: PLEN / (RUN1 - RUN0) };
    };
    AT.PATH_LEN = PLEN;

    const TT = { body: mk(boxM, [0.62, 0.7, 0.82], 0.3, 0.5), belly: mk(boxM, [0.85, 0.32, 0.28], 0.2, 0.4), head: mk(roundM, [0.78, 0.82, 0.9], 0.3, 0.5),
        eyeW: mk(sphM, [1, 1, 1], 0.2, 0), eyeD: mk(sphM, DARK, 0, 0), foot: mk(boxM, [0.85, 0.32, 0.28], 0.1, 0.4), key: mk(boxM, [0.95, 0.75, 0.2], 0.4, 0.4), x: mk(boxM, DARK, 0, 0),
        arm: mk(cylM, [0.62, 0.7, 0.82], 0.2, 0.3), ant: mk(cylM, [0.85, 0.32, 0.28], 0.1, 0.3), bulb: mk(sphM, [0.95, 0.85, 0.3], 0.5, 0.3), cheek: mk(sphM, [0.95, 0.5, 0.5], 0, 0) };
    // keadaan boneka: {pos, yaw, ph (fase langkah), key (sudut kunci), hop, flip, vis, scale, dizzy}
    function toyState(t) {
        const popP = [4.4, -5.9], dropP = [4.0, -5.1];
        if (t < TL.toyPop) return null;
        if (t < TL.snatch) {
            const u = seg(t, TL.toyPop, TL.toyPop + 1.1);
            const x = lerp(popP[0], dropP[0], u), z = lerp(popP[1], dropP[1], u);
            const hop = Math.sin(Math.PI * u) * 1.4;
            return { x, y: hop, z, yaw: Math.atan2(-0.4, 0.5) + (t > TL.toyPop + 1.1 ? Math.sin(t * 9) * 0.1 : 0) + 3.14 * (1 - u) * 0, ph: t * 11 * (u >= 1 ? 0 : 1), key: t * 6, scale: ease(seg(t, TL.toyPop, TL.toyPop + 0.4)), flip: 0, chuckle: t > TL.toyPop + 1.1 };
        }
        if (t < TL.runEnd) {
            const r = AT.toyRun(t);
            return { x: r.x, y: Math.abs(Math.sin(r.dist * 3.2)) * 0.12, z: r.z, yaw: r.yaw, ph: r.dist * 3.2, key: t * 14, scale: 1, flip: 0 };
        }
        const cx = -6.0, cz = -6.1;
        if (t < TL.toyHit) {            // terpojok: gemetar & menoleh
            const k = t - TL.runEnd;
            return { x: cx + Math.sin(t * 40) * 0.03, y: Math.abs(Math.sin(t * 9)) * 0.1, z: cz, yaw: 1.5 + Math.sin(t * 3) * 0.6, ph: 0, key: t * 10, scale: 1, flip: 0, panic: true };
        }
        const u = t - TL.toyHit, land = 1.1;
        const toX = -5.2, toZ = -3.6;
        if (u < land) {                 // terlempar parabola + berputar
            const k = u / land;
            return { x: lerp(cx, toX, k), y: 4 * 2.6 * k * (1 - k) + 0.1, z: lerp(cz, toZ, k), yaw: 1.5 + u * 8, ph: u * 20, key: 10 * u, scale: 1, flip: k * Math.PI * 3, down: false };
        }
        const d = u - land;             // telentang, kunci melambat lalu berhenti
        const keyEnd = 4.2;
        const key = (d < keyEnd) ? 14 * (d - d * d / (2 * keyEnd)) : 14 * keyEnd / 2;
        const wig = d < 4.5 ? Math.sin(d * 14) * (1 - d / 4.5) : 0;
        return { x: toX, y: 0.3, z: toZ, yaw: 0.6, ph: wig * 3, key, scale: 1, flip: Math.PI, down: true, dead: d > 0.8 };
    }
    AT.toyState = toyState;
    function drawToy(list, st) {
        const base = Mat4.chain(T(st.x, st.y, st.z), RY(st.yaw), RX(st.flip), S(st.scale, st.scale, st.scale));
        const add = (it, m) => list.push([it, mul(base, m), 1]);
        const sw = Math.sin(st.ph);
        add(TT.body, mul(T(0, 0.58, 0), S(0.26, 0.26, 0.2)));
        add(TT.belly, mul(T(0, 0.5, 0.185), S(0.2, 0.1, 0.03)));
        add(TT.head, mul(T(0, 1.0, 0.02), S(0.24, 0.2, 0.2)));
        add(TT.ant, Mat4.segment([0, 1.18, 0], [0, 1.42, 0], 0.025)); list[list.length - 1][1] = mul(base, Mat4.segment([0, 1.18, 0], [0, 1.4, 0], 0.025));
        add(TT.bulb, mul(T(0, 1.44, 0), S(0.06, 0.06, 0.06)));
        add(TT.cheek, mul(T(-0.17, 0.94, 0.17), S(0.045, 0.03, 0.02))); add(TT.cheek, mul(T(0.17, 0.94, 0.17), S(0.045, 0.03, 0.02)));
        const dead = st.dead;
        [-1, 1].forEach(s => {
            if (dead) {
                add(TT.x, mul(T(s * 0.1, 1.03, 0.2), mul(RZ(0.78), S(0.06, 0.012, 0.01)))); add(TT.x, mul(T(s * 0.1, 1.03, 0.2), mul(RZ(-0.78), S(0.06, 0.012, 0.01))));
            } else {
                add(TT.eyeW, mul(T(s * 0.1, 1.03, 0.17), S(0.07, 0.08, 0.05)));
                add(TT.eyeD, mul(T(s * 0.1 + Math.sin(st.yaw * 0) * 0.01, 1.03, 0.215), S(0.03, 0.035, 0.02)));
            }
            // lengan
            add(TT.arm, Mat4.segment([s * 0.27, 0.7, 0], [s * 0.38, 0.48 + 0.1 * Math.sin(st.ph + s), 0.1 + 0.08 * s * sw], 0.04));
            list[list.length - 1][1] = mul(base, Mat4.segment([s * 0.27, 0.7, 0], [s * 0.38, 0.48 + 0.1 * Math.sin(st.ph + s), 0.1 + 0.08 * s * sw], 0.04));
            // kaki bergantian
            const lift = Math.max(0, s * sw) * 0.14, fz = s * sw * 0.12;
            add(TT.foot, mul(T(s * 0.13, 0.12 + lift, 0.04 + fz), S(0.1, 0.07, 0.15)));
            add(TT.arm, Mat4.segment([s * 0.13, 0.19 + lift, fz], [s * 0.13, 0.36, 0], 0.045));
            list[list.length - 1][1] = mul(base, Mat4.segment([s * 0.13, 0.19 + lift, fz], [s * 0.13, 0.36, 0], 0.045));
        });
        // kunci putar di punggung
        const kb = mul(base, mul(T(0, 0.62, -0.26), RZ(st.key)));
        list.push([TT.key, mul(kb, S(0.03, 0.03, 0.08)), 1]);
        list.push([TT.key, mul(kb, mul(T(0, 0, -0.1), S(0.2, 0.06, 0.02))), 1]);
        list.push([TT.key, mul(kb, mul(T(0, 0, -0.1), S(0.06, 0.2, 0.02))), 1]);
    }

    /* ---------- fungsi per-frame ---------- */
    const FL = [mk(sphM, [1.0, 0.55, 0.1], 0, 0, { unlit: true }), mk(sphM, [1.0, 0.8, 0.2], 0, 0, { unlit: true }), mk(sphM, [1.0, 0.3, 0.05], 0, 0, { unlit: true })];
    const GLOW = mk(sphM, [1.0, 0.55, 0.2], 0, 0, { unlit: true, alpha: 0.14 });
    const STAR = [];

    // A = { jakeHandL, jakeHandR, finnHandR, nose, bmoHandR, bmoSlot }
    function cassettePos(t, A) {
        const shelfP = [4.45, 4.8 + 0.45 + 0.02, sz + 0.1];
        let p = shelfP, rz = 0, sc = 1, ry = 0, show = true;
        const hold = (a, b, u) => V3.lerp(a, b, ease(clamp(u, 0, 1)));
        if (t < TL.grab - 0.6) return { p, rz, sc, ry };
        if (t < TL.snatch) {
            const hand = t < 55.5 ? A.jakeHandR : A.jakeHandL;
            p = hold(shelfP, hand, (t - (TL.grab - 0.6)) / 0.6);
            if (t > 55.5 && t < 56) p = hold(A.jakeHandR, A.jakeHandL, (t - 55.5) / 0.5);
            return { p: V3.add(p, [0, 0.1, 0.05]), rz: -0.15, sc, ry: 0 };
        }
        const toy = toyState(t);
        if (t < TL.toyHit) {
            const hp = toy ? [toy.x, toy.y + 1.15, toy.z] : p;
            return { p: hold(V3.add(A.jakeHandL, [0, 0.1, 0.05]), hp, (t - TL.snatch) / 0.4), rz: 0.1, sc, ry: toy ? toy.yaw : 0 };
        }
        if (t < TL.pick) {
            const u = t - TL.toyHit, k = clamp(u / 1.1, 0, 1);
            const st = toy;
            const from = [-6.0, 1.15, -6.1], to = [-4.85, 0.07, -3.6];
            const pos = [lerp(from[0], to[0], k), lerp(from[1], to[1], k) + 4 * 2.2 * k * (1 - k) * (k < 1 ? 1 : 0), lerp(from[2], to[2], k)];
            if (k >= 1) { const b = u - 1.1; pos[1] = 0.07 + 0.3 * Math.exp(-5 * b) * Math.abs(Math.sin(9 * b)); }
            return { p: pos, rz: k < 1 ? u * 9 : (Math.PI / 2 - 0.1), sc, ry: 0.4, flat: k >= 1 };
        }
        if (t < TL.attach) return { p: hold([-4.85, 0.1, -3.6], V3.add(A.finnHandR, [0, 0.15, 0.1]), (t - TL.pick) / 1.2), rz: lerp(Math.PI / 2, 0.15, ease(clamp((t - TL.pick) / 1.2, 0, 1))), sc, ry: 0 };
        if (t < TL.arrive) {
            const fh = V3.add(A.finnHandR, [0, 0.15, 0.1]);
            return { p: hold(fh, V3.add(A.nose, [0, 0.0, 0]), (t - TL.attach) / 0.5), rz: 0, sc: 1, ry: 0, onNose: t > TL.attach + 0.5 };
        }
        if (t < TL.arrive + 0.8) return { p: hold(A.nose, A.bmoHandR, (t - TL.arrive) / 0.8), rz: 0.2, sc, ry: 0, hopArc: true };
        if (t < TL.insert) return { p: hold(A.bmoHandR, A.bmoSlot, (t - TL.arrive - 0.8) / (TL.insert - TL.arrive - 0.8)), rz: 0, sc: 0.8, ry: 0, hopArc: true };
        return { p: V3.add(A.bmoSlot, [0, 0, -0.02]), rz: 0, sc: 0.8, ry: 0, inserted: true };
    }
    AT.cassettePos = cassettePos;

    function frame(t, list, A) {
        stat.forEach(b => list.push([b.it, b.m, 1]));
        // goyangan rak
        const sa = shelfShake(t);
        const shM = Mat4.chain(T(sx, 0, sz), RZ(sa), RX(sa * 0.6), T(-sx, 0, -sz));
        shelfStat.forEach(b => list.push([b.it, mul(shM, b.m), 1]));
        // benda di rak yang BELUM jatuh ikut bergoyang, yang sudah jatuh mengikuti fisika
        FALL.forEach(f => {
            const st = fallState(f, t);
            const base = t < TL.fall + f.d ? mul(shM, T(st.p[0], st.p[1], st.p[2])) : T(st.p[0], st.p[1], st.p[2]);
            list.push([f.it, mul(base, mul(RZ(st.a), mul(RX(st.a * 0.5), S(f.s[0], f.s[1], f.s[2])))), 1]);
        });
        // kaki depan-kanan: sebagai fungsi tilt
        const tl = tilt(t), px = TB.x - TB.hw, py = TB.top;
        const topM = Mat4.chain(T(px, py, 0), RZ(-tl), T(-px, -py, 0), T(TB.x, TB.top - 0.1, TB.z), S(TB.hw, 0.1, TB.hd));
        list.push([TABLE_TOP, topM, 1]);
        const lx = [TB.x - TB.hw + 0.15, TB.x + TB.hw - 0.15], lz = [TB.z - TB.hd + 0.15, TB.z + TB.hd - 0.15];
        const drop = (TB.hw * 2) * Math.sin(tl);
        lx.forEach((x, i) => lz.forEach((z, j) => {
            const right = i === 1, front = j === 1;
            if (right && front) return;
            const len = (right ? TB.top - 0.1 - drop * 0.95 : TB.top - 0.1);
            list.push([LEG, mul(T(x, len / 2, z), S(0.09, len / 2, 0.09)), 1]);
        }));
        // kaki depan-kanan: berdiri / tergeletak / sedang dipalu masuk
        const w = clamp(1 - tl / 0.32, 0, 1);
        const stand = [lx[1], (TB.top - 0.1 - drop * 0.95) / 2, lz[1]], lying = [2.95, 0.1, -4.3];
        const c = V3.lerp(lying, stand, w);
        const ang = (Math.PI / 2) * (1 - w);
        const legLen = (TB.top - 0.1 - drop * 0.95) / 2;
        list.push([LEG, Mat4.chain(T(c[0], Math.max(c[1], 0.1), c[2]), RY(0.5 * (1 - w)), RZ(ang), S(0.09, legLen, 0.09)), 1]);
        // api perapian
        FL.forEach((it, i) => {
            const fl = 0.85 + 0.25 * Math.sin(t * (11 + i * 4) + i * 2);
            list.push([it, mul(T(L.fire.x - 0.3 + i * 0.3, 0.45 + 0.1 * fl, L.fire.z + 0.74), S(0.22 * fl, 0.38 * fl + 0.08 * i, 0.08)), 1]);
        });
        list.push([GLOW, mul(T(L.fire.x, 0.02, -5.6), S(2.6 + 0.2 * Math.sin(t * 7), 0.02, 1.7)), 1]);
        // kaset
        const cs = cassettePos(t, A);
        drawCassette(list, cs.p, cs.rz, cs.ry, cs.sc);
        if (!(cs.p[1] > 0)) { /* aman */ }
        AT.shadow(list, cs.p[0], cs.p[2], 0.28, 0.12, 0.18);
        // boneka
        const ts = toyState(t);
        if (ts && ts.scale > 0.01) { drawToy(list, ts); AT.shadow(list, ts.x, ts.z, 0.38 * ts.scale, 0.26 * ts.scale, 0.25); }
        FALL.forEach(f => { const s2 = fallState(f, t); if (t > TL.fall + f.d) AT.shadow(list, s2.p[0], s2.p[2], f.s[0] * 1.2, f.s[2] * 1.2, 0.22); });
    }
    AT.Props = { frame, TL };
})();
