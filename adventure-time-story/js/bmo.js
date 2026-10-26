/* =====================================================================
   bmo.js - Model BMO (dari main.js BMO): badan rounded-box, layar bertekstur canvas 2D,
   D-pad, tombol, slot kaset, lengan & kaki 2 ruas. Dipasang ke renderer toon bersama.
   Ekspresi layar: 0 senyum, 1 senyum terbuka, 2 kaget, 3 ":3", 4 mati, 5 sedih, 6 boot, 7 senang ^ ^
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT, gl = JK.gl;
    const { Mat4, T, S, mul } = JK;
    const RX = Mat4.rotationX, RY = Mat4.rotationY, RZ = Mat4.rotationZ;

    /* ---------- geometri: {P, N, I} ---------- */
    function roundedBox(w, h, d, r, n) {
        const half = [w / 2, h / 2, d / 2], P = [], N = [], I = [];
        const bp = (hf) => {
            const Lp = [], Rp = [];
            for (let k = n; k >= 0; k--) Lp.push(-(hf - r) - r * Math.tan((k / n) * Math.PI / 4));
            for (let k = 0; k <= n; k++) Rp.push(hf - r + r * Math.tan((k / n) * Math.PI / 4));
            return Lp.concat(Rp);
        };
        const BP = [bp(half[0]), bp(half[1]), bp(half[2])];
        [[1, 2, 0, 1], [1, 2, 0, -1], [0, 2, 1, 1], [0, 2, 1, -1], [0, 1, 2, 1], [0, 1, 2, -1]].forEach(([a, b, c, sign]) => {
            const na = BP[a].length, nb = BP[b].length, base = P.length;
            for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
                const p = [0, 0, 0]; p[a] = BP[a][i]; p[b] = BP[b][j]; p[c] = sign * half[c];
                const inner = [0, 0, 0], dir = [0, 0, 0];
                for (let k = 0; k < 3; k++) { const lim = half[k] - r; inner[k] = Math.max(-lim, Math.min(lim, p[k])); dir[k] = p[k] - inner[k]; }
                const len = Math.hypot(dir[0], dir[1], dir[2]) || 1, nr = [dir[0] / len, dir[1] / len, dir[2] / len];
                P.push([inner[0] + nr[0] * r, inner[1] + nr[1] * r, inner[2] + nr[2] * r]); N.push(nr);
            }
            for (let i = 0; i < na - 1; i++) for (let j = 0; j < nb - 1; j++) {
                const q0 = base + i * nb + j, q1 = q0 + 1, q2 = q0 + nb, q3 = q2 + 1;
                I.push(q0, q1, q2, q1, q3, q2);
            }
        });
        return { P, N, I };
    }
    function ellipsoid(rx, ry, rz, lat, lon) {
        const P = [], N = [], I = [];
        for (let i = 0; i <= lat; i++) {
            const th = i * Math.PI / lat;
            for (let j = 0; j <= lon; j++) {
                const ph = j * 2 * Math.PI / lon, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
                const n = [x / rx, y / ry, z / rz], l = Math.hypot(n[0], n[1], n[2]) || 1;
                P.push([rx * x, ry * y, rz * z]); N.push([n[0] / l, n[1] / l, n[2] / l]);
            }
        }
        for (let a = 0; a < lat; a++) for (let b = 0; b < lon; b++) { const p0 = a * (lon + 1) + b, p2 = p0 + lon + 1; I.push(p0, p0 + 1, p2, p0 + 1, p2 + 1, p2); }
        return { P, N, I };
    }
    // tabung: ujung atas di y=0, memanjang ke bawah sepanjang h (pivot di sendi)
    function cylinder(rT, rB, h, seg) {
        const P = [], N = [], I = [], slope = (rB - rT) / h, sl = Math.sqrt(1 + slope * slope);
        for (let i = 0; i <= seg; i++) {
            const a = i * 2 * Math.PI / seg, c = Math.cos(a), s = Math.sin(a), n = [c / sl, slope / sl, s / sl];
            P.push([rT * c, 0, rT * s]); N.push(n); P.push([rB * c, -h, rB * s]); N.push(n);
        }
        for (let k = 0; k < seg; k++) { const q = k * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
        [[0, rT, 1], [-h, rB, -1]].forEach(cap => {
            const base = P.length; P.push([0, cap[0], 0]); N.push([0, cap[2], 0]);
            for (let m = 0; m <= seg; m++) { const an = m * 2 * Math.PI / seg; P.push([cap[1] * Math.cos(an), cap[0], cap[1] * Math.sin(an)]); N.push([0, cap[2], 0]); }
            for (let t = 0; t < seg; t++) I.push(base, base + 1 + t, base + 2 + t);
        });
        return { P, N, I };
    }
    // prisma poligon cembung (bidang XY, tebal +z) - tombol
    function prism(pts, depth, smooth) {
        const P = [], N = [], I = [], n = pts.length;
        let cx = 0, cy = 0; pts.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= n; cy /= n;
        [[depth, 1], [0, -1]].forEach(cap => {
            const base = P.length; P.push([cx, cy, cap[0]]); N.push([0, 0, cap[1]]);
            pts.forEach(p => { P.push([p[0], p[1], cap[0]]); N.push([0, 0, cap[1]]); });
            for (let i = 0; i < n; i++) I.push(base, base + 1 + i, base + 1 + ((i + 1) % n));
        });
        for (let e = 0; e < n; e++) {
            const p0 = pts[e], p1 = pts[(e + 1) % n], ex = p1[0] - p0[0], ey = p1[1] - p0[1], el = Math.hypot(ex, ey);
            let n0 = [ey / el, -ex / el, 0], n1 = n0;
            if (smooth) {
                const r0 = Math.hypot(p0[0] - cx, p0[1] - cy), r1 = Math.hypot(p1[0] - cx, p1[1] - cy);
                n0 = [(p0[0] - cx) / r0, (p0[1] - cy) / r0, 0]; n1 = [(p1[0] - cx) / r1, (p1[1] - cy) / r1, 0];
            }
            const b = P.length;
            P.push([p0[0], p0[1], 0], [p1[0], p1[1], 0], [p0[0], p0[1], depth], [p1[0], p1[1], depth]); N.push(n0, n1, n0, n1);
            I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
        return { P, N, I };
    }
    const circle = (r, n) => Array.from({ length: n }, (_, i) => [r * Math.cos(i * 2 * Math.PI / n), r * Math.sin(i * 2 * Math.PI / n)]);
    const quadMesh = (w, h) => JK.uploadMesh([[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [-w / 2, h / 2, 0], [w / 2, h / 2, 0]],
        [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]], [0, 1, 2, 1, 3, 2]);

    /* ---------- tekstur layar ---------- */
    const FACE = document.createElement('canvas'); FACE.width = 600; FACE.height = 500;
    const fx = FACE.getContext('2d');
    const BG = '#b4ffc8', INK = '#053728', TONGUE = '#2fb87a', OFFBG = '#0d2a21';
    function drawFace(expr, blink) {
        const W = FACE.width, H = FACE.height;
        fx.fillStyle = expr === 4 ? OFFBG : BG; fx.fillRect(0, 0, W, H);
        fx.fillStyle = INK; fx.strokeStyle = INK; fx.lineCap = 'round';
        if (expr === 4) return;
        if (expr === 6) { fx.font = 'bold 190px monospace'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText('BMO', W / 2, H / 2); return; }
        const eyeY = H * 0.36, eyeX = [W * 0.26, W * 0.74];
        const ew = expr === 2 ? 24 : 19, eh = expr === 2 ? 30 : 24;
        eyeX.forEach(x => {
            fx.beginPath();
            if (blink) { fx.lineWidth = 9; fx.moveTo(x - ew, eyeY); fx.lineTo(x + ew, eyeY); fx.stroke(); }
            else if (expr === 3 || expr === 7) { fx.lineWidth = 10; fx.arc(x, eyeY + 14, ew + 4, Math.PI * 1.1, Math.PI * 1.9); fx.stroke(); }
            else if (expr === 5) { fx.ellipse(x, eyeY + 6, ew, eh - 4, 0, 0, Math.PI * 2); fx.fill(); }
            else { fx.ellipse(x, eyeY, ew, eh, 0, 0, Math.PI * 2); fx.fill(); }
        });
        const mx = W * 0.5, my = H * 0.6;
        if (expr === 0) { fx.lineWidth = 11; fx.beginPath(); fx.arc(mx, my - 60, 120, Math.PI * 0.18, Math.PI * 0.82); fx.stroke(); }
        else if (expr === 1 || expr === 7) {
            fx.beginPath(); fx.moveTo(mx - 130, my - 20); fx.quadraticCurveTo(mx, my + 5, mx + 130, my - 20);
            fx.quadraticCurveTo(mx + 110, my + 100, mx, my + 105); fx.quadraticCurveTo(mx - 110, my + 100, mx - 130, my - 20); fx.fill();
            fx.fillStyle = TONGUE; fx.beginPath(); fx.ellipse(mx, my + 85, 55, 26, 0, Math.PI, 0, true); fx.fill();
        } else if (expr === 2) { fx.beginPath(); fx.ellipse(mx, my + 25, 30, 42, 0, 0, Math.PI * 2); fx.fill(); }
        else if (expr === 5) { fx.lineWidth = 11; fx.beginPath(); fx.arc(mx, my + 95, 95, Math.PI * 1.2, Math.PI * 1.8); fx.stroke(); }
        else { fx.lineWidth = 10; fx.beginPath(); fx.arc(mx - 38, my, 38, 0, Math.PI); fx.arc(mx + 38, my, 38, 0, Math.PI); fx.stroke(); }
    }
    const tex = gl.createTexture();
    let lastKey = '';
    function updateFace(expr, blink) {
        const key = expr + '-' + blink;
        if (key === lastKey) return;
        lastKey = key; drawFace(expr, blink);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, FACE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    /* ---------- bagian model (lokal; pusat badan y=15, kaki sampai y=-9.45) ---------- */
    const C_BODY = [0.27, 0.64, 0.54], C_BEZEL = [0.12, 0.30, 0.27], C_DARK = [0.07, 0.17, 0.16];
    const C_YELLOW = [0.88, 0.72, 0.12], C_RED = [0.80, 0.14, 0.30], C_CYAN = [0.10, 0.68, 0.70], C_GREEN = [0.10, 0.76, 0.14];
    const ZF = 10.35, FOOT = 9.45;
    const mk = AT.mk, up = (g) => AT.upload(g.P, g.N, g.I);
    const stat = [];                       // bagian statis {it, m}
    const add = (geo, col, spec, ow, m, extra) => stat.push({ it: mk(up(geo), col, spec, ow, extra), m });

    add(roundedBox(20, 30, 20, 1.3, 7), C_BODY, 0.2, 0.55, T(0, 15, 0));
    stat.push({ it: mk(quadMesh(16.2, 13.6), C_BEZEL, 0.1, 0), m: T(0, 21.25, ZF) });
    const SCREEN = { mesh: quadMesh(15, 12.5), screen: true, size: [15, 12.5], tex: () => tex, glow: 1.15, ow: 0, alpha: 1, unlit: false, color: [1, 1, 1], spec: 0 };
    stat.push({ it: SCREEN, m: T(0, 21.25, ZF + 0.06) });
    add(roundedBox(8.5, 1.1, 0.5, 0.2, 3), C_DARK, 0, 0.3, T(-3.2, 12.2, ZF + 0.18));
    add(prism(circle(0.45, 20), 0.35, true), C_GREEN, 0.5, 0.2, T(-8, 12.2, ZF + 0.18));
    add(roundedBox(4.6, 1.5, 0.7, 0.3, 3), C_YELLOW, 0.4, 0.3, T(-5.2, 7, ZF + 0.18));
    add(roundedBox(1.5, 4.6, 0.7, 0.3, 3), C_YELLOW, 0.4, 0.3, T(-5.2, 7, ZF + 0.18));
    add(prism([[-1.5, -1.2], [1.5, -1.2], [0, 1.5]], 0.6, false), C_CYAN, 0.5, 0.3, T(2.4, 9.2, ZF + 0.18));
    add(prism(circle(1.5, 32), 0.6, true), C_RED, 0.6, 0.3, T(6.4, 6.4, ZF + 0.18));
    add(prism(circle(0.95, 28), 0.6, true), C_GREEN, 0.6, 0.3, T(2.0, 4.4, ZF + 0.18));
    for (let i = 0; i < 5; i++) add(roundedBox(0.5, 0.7, 6, 0.2, 3), C_DARK, 0, 0.2, T(10, 20 - i * 2.1, 0));

    // anggota badan dinamis (geometri dibuat sekali)
    const AM = {
        shoulder: mk(up(ellipsoid(1, 1, 1, 14, 20)), C_BODY, 0.2, 0.3),
        arm: mk(up(cylinder(0.65, 0.65, 5.5, 20)), C_BODY, 0.2, 0.3),
        arm2: mk(up(cylinder(0.65, 0.65, 5.0, 20)), C_BODY, 0.2, 0.3),
        elbow: mk(up(ellipsoid(0.81, 0.81, 0.81, 12, 16)), C_BODY, 0.2, 0.3),
        hand: mk(up(ellipsoid(1.15, 1.05, 0.9, 14, 20)), C_BODY, 0.2, 0.3),
        thigh: mk(up(cylinder(0.75, 0.75, 4.4, 20)), C_BODY, 0.2, 0.3),
        knee: mk(up(ellipsoid(0.94, 0.94, 0.94, 12, 16)), C_BODY, 0.2, 0.3),
        shin: mk(up(cylinder(0.75, 0.675, 4.4, 20)), C_BODY, 0.2, 0.3),
        foot: mk(up(ellipsoid(1.4, 0.75, 2.4, 14, 20)), C_BODY, 0.2, 0.3)
    };

    /* ---------- pose bantu ---------- */
    const poses = {
        idle: (t) => ({ abdL: 0.45 + 0.08 * Math.sin(t * 2), abdR: 0.45 + 0.08 * Math.sin(t * 2 + 1), swL: 0, swR: 0, elbL: 0.3, elbR: 0.3, legL: 0, legR: 0, kneeL: 0.1, kneeR: 0.1 }),
        walk: (ph) => { const s = Math.sin(ph); return { abdL: 0.35, abdR: 0.35, swL: s * 0.7, swR: -s * 0.7, elbL: 0.5, elbR: 0.5, legL: -s * 0.55, legR: s * 0.55, kneeL: 0.12 + Math.max(0, s) * 0.5, kneeR: 0.12 + Math.max(0, -s) * 0.5, bob: Math.abs(Math.cos(ph)) * 0.5 }; },
        cheer: (t) => ({ abdL: 2.5 + 0.2 * Math.sin(t * 9), abdR: 2.5 + 0.2 * Math.sin(t * 9 + 1.6), swL: 0, swR: 0, elbL: 0.2, elbR: 0.2, legL: 0.1 * Math.sin(t * 9), legR: -0.1 * Math.sin(t * 9), kneeL: 0.2, kneeR: 0.2 }),
        dance: (t) => { const s = Math.sin(t * 6.4); return { abdL: 1.9 + 0.8 * s, abdR: 1.9 - 0.8 * s, swL: 0, swR: 0, elbL: 0.35, elbR: 0.35, legL: 0.5 * s, legR: -0.5 * s, kneeL: 0.15 + 0.4 * Math.max(0, s), kneeR: 0.15 + 0.4 * Math.max(0, -s), bob: Math.abs(s) * 0.6, sway: 0.12 * Math.cos(t * 6.4) }; }
    };

    class BMOActor {
        constructor() { this.reset(); }
        reset() { this.st = { t: 0, nextBlink: 2.2, blinkStart: -9, rnd: AT.seedRand(22) }; this.handW = { L: [0, 0, 0], R: [0, 0, 0] }; this.slotW = [0, 0, 0]; this.headW = [0, 0, 0]; }
        /* c: x,y,z,yaw,scale | expr | pose (hasil poses.*) | hop (loncat) | sway | glow */
        frame(dt, c, list) {
            const s = this.st; s.t += dt;
            const sc = c.scale || 0.034, p = Object.assign(poses.idle(s.t), c.pose || {});
            const hop = (c.hop || 0) + (p.bob || 0) * sc * 10 * 0.0;
            const Pl = Mat4.chain(T(c.x || 0, (c.y || 0) + hop, c.z || 0), RY(c.yaw || 0), RZ((c.sway || 0) + (p.sway || 0)), S(sc, sc, sc), T(0, FOOT + (p.bob || 0), 0));
            if (s.t > s.nextBlink) { s.blinkStart = s.t; s.nextBlink = s.t + 2.5 + s.rnd() * 3; }
            const blink = (s.t - s.blinkStart) < 0.15;
            const expr = c.expr === undefined ? 0 : c.expr;
            updateFace(expr, blink && expr !== 4 && expr !== 6);
            SCREEN.glow = c.glow === undefined ? 1.15 : c.glow;

            stat.forEach(b => list.push([b.it, mul(Pl, b.m), 1]));
            const push = (it, m) => list.push([it, m, 1]);
            for (const sd of [1, -1]) {
                const L = sd > 0 ? 'R' : 'L';
                // lengan
                const up0 = Mat4.chain(Pl, T(sd * 10, 17.5, 0), RZ(sd * p['abd' + L]), RX(p['sw' + L]));
                push(AM.shoulder, mul(Pl, T(sd * 10, 17.5, 0)));
                push(AM.arm, up0);
                const el = mul(up0, T(0, -5.5, 0));
                push(AM.elbow, el);
                const fo = mul(el, mul(RZ(sd * p['elb' + L] * 0.6), RX(-p['elb' + L] * 0.8)));
                push(AM.arm2, fo);
                const hd = mul(fo, T(0, -5.7, 0));
                push(AM.hand, hd);
                this.handW[L] = [hd[12], hd[13], hd[14]];
                // kaki
                const hip = Mat4.chain(Pl, T(sd * 4.5, 0.4, 0), RZ(sd * 0.05), RX(p['leg' + L]));
                push(AM.thigh, hip);
                const kn = mul(hip, T(0, -4.4, 0));
                push(AM.knee, kn);
                const sh = mul(kn, RX(-p['knee' + L]));
                push(AM.shin, sh);
                const an = mul(sh, T(0, -4.4, 0));
                push(AM.foot, mul(an, T(0, -0.3, 1.1)));
            }
            const sl = Mat4.point(Pl, [-3.2, 12.2, ZF + 0.3]); this.slotW = sl;
            this.headW = Mat4.point(Pl, [0, 32, 0]);
            this.Pl = Pl;
            AT.shadow(list, c.x || 0, c.z || 0, 0.55, 0.42);
        }
    }
    BMOActor.poses = poses;
    AT.BMOActor = BMOActor;
})();
