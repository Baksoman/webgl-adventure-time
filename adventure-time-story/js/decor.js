/* =====================================================================
   decor.js - detail tambahan ruangan: bingkai foto, jam dinding berayun, lampu gantung,
   lampu hias berkedip, bendera, tirai, tanaman, gitar viola Jake, pedang Finn, tumpukan koin,
   lampu lantai, kardus pizza, kaset berserakan, debu melayang, cahaya bulan, sarang laba-laba.
   AT.Decor.frame(t, list) dipanggil tiap frame (semua fungsi dari waktu t).
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT;
    const { Mat4, V3, T, S, mul } = JK;
    const { mk } = AT;
    const RX = Mat4.rotationX, RY = Mat4.rotationY, RZ = Mat4.rotationZ;
    const sin = Math.sin, cos = Math.cos, PI = Math.PI, L = AT.L;

    const boxM = JK.gridMesh(20, 14, JK.shapeFn({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n: 7, m: 7 }));
    const roundM = JK.gridMesh(20, 14, JK.shapeFn({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n: 3.2, m: 5 }));
    const sphM = JK.sphereMesh(16, 12);
    const cylM = JK.gridMesh(20, 8, (u, v) => { const a = 2 * PI * u; return [cos(a), v * 2 - 1, sin(a)]; }, (u, v, p) => [p[0], 0, p[2]]);
    const cylZ = JK.gridMesh(14, 4, (u, v) => { const a = 2 * PI * u; return [cos(a), sin(a), v]; }, (u, v, p) => [p[0], p[1], 0]);
    const coneM = JK.gridMesh(16, 6, (u, v) => { const a = 2 * PI * u, r = 1 - v; return [r * cos(a), v * 2 - 1, r * sin(a)]; }, (u, v, p) => [p[0], 0.5, p[2]]);

    const WOOD = [0.55, 0.37, 0.21], WOOD2 = [0.42, 0.27, 0.15], DARK = [0.1, 0.07, 0.08];
    const st = [];       // statis
    const add = (mesh, col, m, o) => { o = o || {}; st.push([mk(mesh, col, o.spec === undefined ? 0.08 : o.spec, o.ow === undefined ? 0.35 : o.ow, o.ex), m]); };
    const box = (x, y, z, sx, sy, sz, col, o) => add(boxM, col, mul(T(x, y, z), S(sx, sy, sz)), o);
    const sph = (x, y, z, sx, sy, sz, col, o) => add(sphM, col, mul(T(x, y, z), S(sx, sy, sz)), o);
    const cyl = (x, y, z, r, hh, col, o) => add(cylM, col, mul(T(x, y, z), S(r, hh, r)), o);
    const rod = (a, b, r, col, o) => add(cylZ, col, Mat4.segment(a, b, r), o);

    /* ---------- bingkai foto dinding belakang ---------- */
    const frame = (x, y, w, h, bg, art) => {
        box(x, y, -8.1, w + 0.12, h + 0.12, 0.06, WOOD2);
        box(x, y, -8.05, w, h, 0.03, bg, { ow: 0, spec: 0.02 });
        art(x, y, w, h);
    };
    // 1) potret Finn (topi putih) & Jake (kuning)
    frame(-3.9, 5.3, 0.95, 0.75, [0.55, 0.78, 0.92], (x, y) => {
        sph(x - 0.2, y - 0.05, -8.02, 0.17, 0.2, 0.02, [0.97, 0.78, 0.6], { ow: 0 });
        sph(x - 0.2, y + 0.12, -8.0, 0.2, 0.15, 0.02, [1, 1, 1], { ow: 0 });
        sph(x + 0.22, y - 0.08, -8.02, 0.22, 0.25, 0.02, [0.95, 0.76, 0.2], { ow: 0 });
        box(x - 0.2, y - 0.3, -8.02, 0.12, 0.1, 0.02, [0.3, 0.55, 0.9], { ow: 0 });
    });
    // 2) bintang & bulan
    frame(-3.9, 3.9, 0.6, 0.55, [0.08, 0.12, 0.3], (x, y) => {
        sph(x - 0.1, y + 0.05, -8.02, 0.12, 0.12, 0.02, [1, 0.95, 0.7], { ow: 0, ex: { unlit: true } });
        sph(x + 0.12, y - 0.1, -8.02, 0.03, 0.03, 0.02, [1, 1, 1], { ow: 0, ex: { unlit: true } });
        sph(x + 0.15, y + 0.15, -8.02, 0.025, 0.025, 0.02, [1, 1, 1], { ow: 0, ex: { unlit: true } });
    });
    // 3) peta harta karun
    frame(-0.2, 3.6, 0.85, 0.6, [0.9, 0.82, 0.58], (x, y) => {
        box(x - 0.15, y + 0.05, -8.02, 0.3, 0.012, 0.01, [0.6, 0.35, 0.2], { ow: 0 });
        box(x + 0.12, y - 0.1, -8.02, 0.012, 0.18, 0.01, [0.6, 0.35, 0.2], { ow: 0 });
        box(x + 0.2, y - 0.2, -8.02, 0.07, 0.012, 0.01, [0.85, 0.15, 0.15], { ow: 0 });
        box(x + 0.2, y - 0.2, -8.02, 0.012, 0.07, 0.01, [0.85, 0.15, 0.15], { ow: 0 });
    });
    // poster permainan BMO
    frame(1.55, 4.4, 0.55, 0.8, [0.2, 0.62, 0.52], (x, y) => {
        box(x, y + 0.2, -8.02, 0.38, 0.3, 0.012, [0.7, 0.92, 0.82], { ow: 0 });
        sph(x - 0.1, y + 0.2, -8.01, 0.04, 0.04, 0.02, DARK, { ow: 0 }); sph(x + 0.1, y + 0.2, -8.01, 0.04, 0.04, 0.02, DARK, { ow: 0 });
        box(x, y - 0.22, -8.02, 0.1, 0.1, 0.012, [0.9, 0.3, 0.3], { ow: 0 });
        sph(x + 0.18, y - 0.25, -8.02, 0.05, 0.05, 0.012, [0.3, 0.5, 0.95], { ow: 0 });
    });

    /* ---------- pedang Finn di dudukan dinding (dekat tangga) ---------- */
    box(-8.0, 3.05, -8.05, 1.05, 0.09, 0.1, WOOD2); box(-8.0, 3.95, -8.05, 1.05, 0.09, 0.1, WOOD2);
    box(-8.0, 3.5, -8.0, 0.07, 0.7, 0.05, [0.78, 0.84, 0.95], { spec: 0.4 });
    box(-8.0, 3.28, -8.0, 0.3, 0.06, 0.07, [0.5, 0.35, 0.2]);

    /* ---------- viola Jake di dudukan ---------- */
    (() => {
        const bx = 3.4, bz = -3.0, base = Mat4.chain(T(bx, 0, bz), RY(-0.25));
        const p = (m, mesh, col, o) => add(mesh, col, mul(base, m), o);
        p(mul(T(0, 0.04, 0), S(0.5, 0.04, 0.4)), boxM, WOOD2);
        p(mul(T(0, 0.8, 0), mul(RZ(0.12), S(0.28, 0.5, 0.1))), roundM, [0.85, 0.5, 0.2], { spec: 0.3 });
        p(mul(T(0.07, 1.65, 0), mul(RZ(0.12), S(0.04, 0.55, 0.035))), boxM, [0.25, 0.15, 0.1]);
        p(mul(T(0.11, 2.3, 0), S(0.07, 0.1, 0.05)), roundM, [0.3, 0.18, 0.1]);
    })();

    /* ---------- tanaman pot ---------- */
    const plant = (x, z, s) => {
        cyl(x, 0.3 * s, z, 0.32 * s, 0.3 * s, [0.75, 0.4, 0.25]);
        const lc = [[0.2, 0.62, 0.3], [0.28, 0.72, 0.35], [0.16, 0.5, 0.26]];
        for (let i = 0; i < 7; i++) {
            const a = i * 0.9, h = (0.7 + 0.22 * (i % 3)) * s;
            add(roundM, lc[i % 3], Mat4.chain(T(x, 0.6 * s, z), RY(a), RZ(0.55 + 0.1 * (i % 2)), T(0, h * 0.4, 0), S(0.1 * s, h * 0.5, 0.2 * s)));
        }
    };
    plant(-8.7, -0.6, 1.0); plant(7.0, 0.4, 0.8); plant(-2.9, -7.4, 0.9);

    /* ---------- lampu lantai ---------- */
    cyl(-9.0, 0.05, 1.4, 0.3, 0.05, [0.25, 0.22, 0.28]);
    cyl(-9.0, 1.5, 1.4, 0.04, 1.5, [0.3, 0.28, 0.32]);
    add(coneM, [1.0, 0.82, 0.5], mul(T(-9.0, 3.2, 1.4), S(0.5, 0.3, 0.5)), { ow: 0.3, ex: { unlit: true } });

    /* ---------- tumpukan koin & harta Finn-Jake ---------- */
    (() => {
        for (let i = 0; i < 16; i++) {
            const a = i * 2.4, r = 0.12 + 0.4 * ((i * 37) % 10) / 10 * (1 - i / 22), y = 0.04 + 0.1 * (16 - i) / 16;
            add(cylM, [1, 0.8 - (i % 3) * 0.05, 0.2], mul(T(-8.0 + r * cos(a), y, -6.9 + r * sin(a)), mul(RX(0.2 * sin(i)), S(0.11, 0.025, 0.11))), { spec: 0.5, ow: 0.2 });
        }
        sph(-8.0, 0.12, -6.9, 0.45, 0.14, 0.45, [0.95, 0.76, 0.2], { spec: 0.5, ow: 0.25 });
        box(-7.4, 0.2, -6.5, 0.3, 0.2, 0.2, [0.45, 0.28, 0.15]);
        sph(-7.4, 0.42, -6.5, 0.3, 0.1, 0.2, [0.95, 0.76, 0.2], { ow: 0.2 });
    })();

    /* ---------- kardus pizza, bantal, kaset-kaset berserakan ---------- */
    box(-7.4, 0.07, -0.9, 0.5, 0.07, 0.5, [0.8, 0.65, 0.45]); box(-7.4, 0.2, -0.9, 0.5, 0.07, 0.5, [0.84, 0.68, 0.48]); box(-7.4, 0.33, -0.9, 0.5, 0.07, 0.5, [0.8, 0.65, 0.45]);
    add(roundM, [0.85, 0.35, 0.45], Mat4.chain(T(-5.0, 0.15, 1.3), RY(0.5), S(0.55, 0.15, 0.55)));
    add(roundM, [0.35, 0.65, 0.8], Mat4.chain(T(4.4, 0.15, -1.7), RY(-0.4), S(0.5, 0.14, 0.5)));
    [[-3.6, 0.5, 0.5, [0.8, 0.2, 0.2]], [-3.1, 0.2, 1.1, [0.2, 0.5, 0.8]], [3.2, 1.4, -0.5, [0.3, 0.7, 0.35]], [-4.4, 1.6, 2.2, [0.9, 0.7, 0.2]]].forEach(c => {
        add(roundM, c[3], Mat4.chain(T(c[0], 0.05, c[1]), RY(c[2]), S(0.17, 0.035, 0.12)), { ow: 0.3 });
        box(c[0], 0.085, c[1], 0.1, 0.004, 0.06, [0.92, 0.9, 0.8], { ow: 0 });
    });
    // balok mainan + bebek karet
    box(-5.6, 0.12, 2.0, 0.12, 0.12, 0.12, [0.9, 0.3, 0.3]); box(-5.35, 0.12, 2.1, 0.12, 0.12, 0.12, [0.3, 0.5, 0.9]); box(-5.5, 0.34, 2.05, 0.12, 0.12, 0.12, [0.95, 0.8, 0.2]);
    sph(2.0, 0.15, 1.5, 0.17, 0.14, 0.2, [1, 0.88, 0.2]); sph(2.0, 0.34, 1.57, 0.1, 0.1, 0.1, [1, 0.88, 0.2]); box(2.0, 0.33, 1.7, 0.05, 0.02, 0.05, [1, 0.5, 0.1]);

    /* ---------- meja samping + lilin ---------- */
    box(-9.0, 0.9, -3.6, 0.45, 0.07, 0.45, WOOD); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => box(-9.0 + s[0] * 0.36, 0.45, -3.6 + s[1] * 0.36, 0.04, 0.45, 0.04, WOOD2));
    cyl(-9.0, 1.12, -3.6, 0.07, 0.15, [0.95, 0.92, 0.85]);

    /* ---------- jendela bundar dinding kiri + tirai ---------- */
    add(cylZ, WOOD2, mul(T(-9.55, 5.0, -3.0), mul(RY(PI / 2), S(0.9, 0.9, 0.12))));
    add(cylZ, [0.05, 0.1, 0.26], mul(T(-9.5, 5.0, -3.0), mul(RY(PI / 2), S(0.78, 0.78, 0.04))), { ow: 0, ex: { unlit: true } });
    box(-9.45, 5.0, -3.0, 0.03, 0.78, 0.04, WOOD2, { ow: 0 }); box(-9.45, 5.0, -3.0, 0.03, 0.04, 0.78, WOOD2, { ow: 0 });
    box(-1.6, 6.85, -8.0, 1.35, 0.05, 0.05, WOOD2);

    /* ---------- bendera segitiga di atas tangga & dinding kanan ---------- */
    const FL_COL = [[0.9, 0.3, 0.3], [0.95, 0.8, 0.25], [0.3, 0.6, 0.9], [0.4, 0.75, 0.4]];

    /* ---------- sarang laba-laba pojok ---------- */
    for (let i = 0; i < 5; i++) {
        const a = i / 4 * (PI / 2);
        rod([9.55, 9.55, -8.2], [9.55 - 1.3 * cos(a), 9.55 - 1.3 * sin(a), -8.2], 0.008, [0.9, 0.9, 0.95], { ow: 0, ex: { unlit: true } });
    }
    [0.5, 0.9].forEach(k => rod([9.55 - 1.3 * k, 9.55, -8.2], [9.55, 9.55 - 1.3 * k, -8.2], 0.008, [0.9, 0.9, 0.95], { ow: 0, ex: { unlit: true } }));

    /* ---------- dinamis: item bersama ---------- */
    const CLOCK_FACE = mk(cylZ, [0.96, 0.93, 0.85], 0.1, 0.4), CLOCK_RIM = mk(cylZ, WOOD2, 0.1, 0.4), HAND = mk(boxM, DARK, 0, 0), PEND = mk(cylM, [0.85, 0.7, 0.2], 0.4, 0.3), BOB = mk(sphM, [0.9, 0.75, 0.25], 0.5, 0.3);
    const BULB = [0, 1, 2, 3, 4, 5].map(i => mk(sphM, [[1, 0.35, 0.35], [1, 0.85, 0.3], [0.4, 0.8, 1], [0.5, 1, 0.5], [1, 0.5, 0.9], [1, 0.7, 0.3]][i], 0, 0, { unlit: true }));
    const HALO = mk(sphM, [1, 0.9, 0.6], 0, 0, { unlit: true, alpha: 0.045 });
    const WIRE = mk(boxM, [0.12, 0.1, 0.12], 0, 0), LAMPSH = mk(coneM, [0.95, 0.75, 0.35], 0.1, 0.4);
    const LAMPG = mk(sphM, [1, 0.85, 0.5], 0, 0, { unlit: true, alpha: 0.035 }), FLAG = mk(boxM, [1, 1, 1], 0, 0.3);
    const BEAM = mk(cylZ, [0.75, 0.85, 1.0], 0, 0, { unlit: true, alpha: 0.06 });
    const MOTE = mk(sphM, [1, 0.95, 0.8], 0, 0, { unlit: true, alpha: 0.5 });
    const CURT = mk(boxM, [0.7, 0.25, 0.3], 0.05, 0.3), CNDL = mk(sphM, [1, 0.7, 0.2], 0, 0, { unlit: true });
    const STARS = [[-1.95, 6.2], [-1.9, 5.5], [-1.4, 5.35], [-2.1, 5.85], [-1.0, 5.6], [-1.75, 5.2], [-1.2, 6.25]].map((p, i) => ({ p, it: mk(sphM, [1, 1, 0.9], 0, 0, { unlit: true }) }));
    const SWING = (t, f, a, ph) => a * sin(t * f + (ph || 0));

    // cahaya lembut: beberapa lapis bola transparan makin besar -> tepi halus (tanpa cakram bertepi tegas)
    const glow = (list, it, m, r) => { for (let k = 1; k <= 5; k++) { const q = k / 5; list.push([it, mul(m, S(r * q, r * q, r * q)), 1]); } };
    // cahaya hangat di lantai (kolam cahaya perapian yang berkedip + lampu) - lapisan tipis tanpa tepi tegas
    const POOL = mk(sphM, [1.0, 0.55, 0.2], 0, 0, { unlit: true, alpha: 0.04 }), POOL2 = mk(sphM, [1.0, 0.85, 0.5], 0, 0, { unlit: true, alpha: 0.03 });
    const poolL = (list, it, x, z, rx, rz) => { for (let k = 1; k <= 6; k++) { const q = k / 6; list.push([it, mul(T(x, 0.03, z), S(rx * q, 0.02, rz * q)), 1]); } };
    function frameFn(t, list) {
        st.forEach(e => list.push([e[0], e[1], 1]));

        /* jam dinding + bandul */
        const cx = 0.5, cy = 6.3, cz = -8.05;
        list.push([CLOCK_RIM, mul(T(cx, cy, cz), S(0.62, 0.62, 0.08)), 1]);
        list.push([CLOCK_FACE, mul(T(cx, cy, cz + 0.06), S(0.52, 0.52, 0.04)), 1]);
        const ha = -t * 0.1, ma = -t * 1.2;
        list.push([HAND, Mat4.chain(T(cx, cy, cz + 0.12), RZ(ma), T(0, 0.19, 0), S(0.02, 0.2, 0.01)), 1]);
        list.push([HAND, Mat4.chain(T(cx, cy, cz + 0.12), RZ(ha), T(0, 0.12, 0), S(0.03, 0.13, 0.01)), 1]);
        const pa = SWING(t, 3.2, 0.32);
        const pb = Mat4.chain(T(cx, cy - 0.65, cz + 0.05), RZ(pa));
        list.push([PEND, mul(pb, mul(T(0, -0.5, 0), S(0.015, 0.5, 0.015))), 1]);
        list.push([BOB, mul(pb, mul(T(0, -1.05, 0), S(0.11, 0.11, 0.04))), 1]);

        /* lampu hias berkedip: kabel menggantung (kurva) di dinding belakang */
        const N = 22;
        let prev = null;
        for (let i = 0; i <= N; i++) {
            const u = i / N, x = -9.4 + 18.8 * u, y = 8.35 - 0.9 * sin(PI * u) * (1 + 0.08 * sin(t * 0.8 + u * 5));
            const p = [x, y, -8.05];
            if (prev) list.push([WIRE, Mat4.segment(prev, p, 0.012), 1]);
            if (i % 2 === 1) {
                const tw = 0.7 + 0.3 * sin(t * (2 + (i % 5)) + i * 1.3), b = BULB[i % 6];
                list.push([b, mul(T(x, y - 0.12, -8.0), S(0.09 * tw, 0.12 * tw, 0.09 * tw)), 1]);
                glow(list, HALO, T(x, y - 0.12, -7.9), 0.34 * tw);
            }
            prev = p;
        }
        // lampu hias kedua di dinding kanan -> tangga (diagonal)
        /* lampu gantung dari balok (ayun pelan) */
        const la = SWING(t, 1.1, 0.045), lamp = Mat4.chain(T(-3.0, 9.6, -3.0), RZ(la), RX(la * 0.6));
        list.push([WIRE, mul(lamp, mul(T(0, -0.85, 0), S(0.015, 0.85, 0.015))), 1]);
        list.push([LAMPSH, mul(lamp, mul(T(0, -1.85, 0), S(0.5, 0.35, 0.5))), 1]);
        const flick = 0.9 + 0.1 * sin(t * 13) * sin(t * 7.3);
        glow(list, LAMPG, mul(lamp, T(0, -2.1, 0)), 1.7 * flick);
        list.push([CNDL, mul(lamp, mul(T(0, -1.95, 0), S(0.12, 0.12, 0.12))), 1]);

        /* bendera di dinding kanan (bergoyang dengan gelombang) */
        for (let i = 0; i < 9; i++) {
            const u = i / 8, x = 9.4, z = -7.6 + 6.4 * u, y = 7.1 - 0.5 * sin(PI * u);
            const sw = 0.18 * sin(t * 2.2 + i * 0.7);
            list.push([mk_flag(i), Mat4.chain(T(x - 0.05, y - 0.22, z), RX(sw), S(0.03, 0.26, 0.2)), 1]);
        }

        /* tirai jendela belakang bergoyang halus */
        [-1, 1].forEach(s => {
            const sw = 0.03 * sin(t * 0.9 + s);
            list.push([CURT, Mat4.chain(T(-1.6 + s * 0.76, 6.85, -8.0), RZ(sw * s), T(0, -0.85, 0), S(0.17, 0.85, 0.05)), 1]);
        });

        /* bintang jendela berkedip */
        STARS.forEach((s, i) => { const k = 0.55 + 0.45 * sin(t * (1.5 + i * 0.4) + i * 2); list.push([s.it, mul(T(s.p[0], s.p[1], -8.02), S(0.035 * k + 0.012, 0.035 * k + 0.012, 0.02)), 1]); });

        /* lilin + lampu lantai bersinar */
        const cf = 0.85 + 0.2 * sin(t * 17) * sin(t * 5);
        list.push([CNDL, mul(T(-9.0, 1.33, -3.6), S(0.045 * cf, 0.1 * cf, 0.045 * cf)), 1]);
        glow(list, HALO, T(-9.0, 1.4, -3.6), 0.9 * cf);
        glow(list, LAMPG, T(-9.0, 2.9, 1.4), 1.6);

        const fl = 0.9 + 0.1 * sin(t * 9) * sin(t * 4.1) + 0.05 * sin(t * 23);
        poolL(list, POOL, L.fire.x + 0.2, L.fire.z + 3.1, 4.2 * fl, 2.4 * fl);
        poolL(list, POOL2, -9.0, 1.4, 1.8, 1.8);
        // bayangan lembut di bawah perabot
        [[-8.1, -2.3, 1.1, 1.1, 0.3], [-8.5, -4.9, 0.75, 0.75, 0.28], [4.6, -7.1, 2.0, 0.8, 0.3], [-8.7, -0.6, 0.55, 0.55, 0.25], [7.0, 0.4, 0.5, 0.5, 0.25], [-2.9, -7.4, 0.5, 0.5, 0.25], [-9.0, 1.4, 0.35, 0.35, 0.3], [-8.0, -6.9, 0.7, 0.6, 0.25], [3.4, -3.0, 0.45, 0.4, 0.28]]
            .forEach(q => AT.shadow(list, q[0], q[1], q[2], q[3], q[4]));
        /* sorot cahaya bulan dari jendela ke lantai */
        list.push([BEAM, Mat4.segment([-1.6, 5.2, -8.0], [-4.2, 0.05, -2.5], 1.1), 1]);

        /* debu melayang */
        for (let i = 0; i < 26; i++) {
            const a = i * 12.9898, x = ((sin(a) * 43758.5) % 1 + 1) % 1, y = ((sin(a * 1.7) * 21345.3) % 1 + 1) % 1, z = ((sin(a * 2.3) * 9731.1) % 1 + 1) % 1;
            const px = -8 + 16 * x + 0.5 * sin(t * 0.3 + i), py = 0.8 + 6 * y + 0.4 * sin(t * 0.5 + i * 2) + 0.15 * ((t * 0.1 + i * 0.07) % 1), pz = -7 + 8 * z + 0.4 * cos(t * 0.27 + i);
            list.push([MOTE, mul(T(px, py, pz), S(0.025, 0.025, 0.025)), 1]);
        }
    }
    const flagIts = FL_COL.map(c => mk(boxM, c, 0, 0.3));
    function mk_flag(i) { return flagIts[i % flagIts.length]; }

    AT.Decor = { frame: frameFn };
})();
