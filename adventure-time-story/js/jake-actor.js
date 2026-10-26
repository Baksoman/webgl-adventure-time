/* =====================================================================
   jake-actor.js - JakeActor: membungkus logika frame() dari main.js Jake yang lama menjadi
   objek yang bisa diperintah oleh storyline (posisi, gerak, aksi, mode, ekspresi, jangkauan tangan).
   Seluruh animasi, morph mode, lengan "mie", ekspresi & partikel tetap memakai kode Jake asli.
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT;
    const { Mat4, V3, T, S, mul, clamp, sstep, lerpArr, lerp1, MODE_NAMES, MODES, BODY, LEG_X, HIP_Y, ANKLE_Y, LEG_L,
        ANIMS, ACTION_ARMS, EXPR, AUTO_EXPR, composePoses, mixPoses, stepSpring, items, morphBody, mixMats, eyeDims,
        EYE_FR, mouthBlend, mouthMesh, mouthItem, puffs, pushArm, tailPivot, particles, sfx } = JK;
    const BLACK = JK.cfg.BLACK, MOUTH_RED = JK.cfg.MOUTH_RED;
    const TAU = Math.PI * 2;

    const scaleAbout = (a, k) => Mat4.chain(T(a[0], a[1], a[2]), S(k, k, k), T(-a[0], -a[1], -a[2]));

    // model matrix tiap item (sama seperti main.js lama; item 'world' ikut matriks penempatan)
    function modelOf(it, c) {
        if (it.dyn) { const m = it.dyn(c); return (m && it.group === 'world') ? mul(c.Place, m) : m; }
        if (it.mode) {
            const k = c.m[it.mode];
            return k < 0.02 ? null : mul(JK.popM(c, k, it.anchor), it.m);
        }
        if (it.fade) {
            const k = 1 - sstep(0, 0.35, c.mw);
            if (k < 0.03) return null;
            const base = it.group === 'tail' ? c.tail : c.Bm;
            const inner = it.hinge ? mul(Mat4.chain(T(it.hinge[0], it.hinge[1], it.hinge[2]), Mat4.rotationZ(c.earA[it.hs]),
                T(-it.hinge[0], -it.hinge[1], -it.hinge[2])), it.m) : it.m;
            return mul(base, mul(scaleAbout(it.fade, k), inner));
        }
        switch (it.group) {
            case 'body': return mul(c.Bm, it.m);
            case 'tail': return mul(c.tail, it.m);
            case 'legL': return mul(c.legM[-1], it.m);
            case 'legR': return mul(c.legM[1], it.m);
            case 'footL': return mul(c.footM[-1], it.m);
            case 'footR': return mul(c.footM[1], it.m);
            default: return it.m;
        }
    }

    function legMatrices(sd, leg, g, wx, drop, k) {
        const [swing, lift, pitch] = leg;
        const x = sd * LEG_X, a = -swing;
        const hip = [x, HIP_Y, 0], ankle0 = [x, ANKLE_Y, 0];
        const ankle1 = [x, HIP_Y - LEG_L * Math.cos(a), -LEG_L * Math.sin(a)];
        const legM0 = Mat4.chain(T(0, lift, 0), T(hip[0], hip[1], hip[2]), Mat4.rotationX(a), T(-hip[0], -hip[1], -hip[2]));
        const footM0 = Mat4.chain(T(0, lift, 0), T(ankle1[0], ankle1[1], ankle1[2]), Mat4.rotationX(pitch), T(-ankle0[0], -ankle0[1], -ankle0[2]));
        const dx = sd * LEG_X * (wx - 1);
        const ly = Math.max(0.25, (HIP_Y - drop - ANKLE_Y) / LEG_L);
        const G = S(g, g, g);
        const legAdj = Mat4.chain(G, T(dx, 0, 0), T(0, ANKLE_Y, 0), S(1, ly, 1), T(0, -ANKLE_Y, 0));
        const shrL = Mat4.chain(T(x, HIP_Y, 0), S(k, k, k), T(-x, -HIP_Y, 0));
        const shrF = Mat4.chain(T(x, 0.3, 0.2), S(k, k, k), T(-x, -0.3, -0.2));
        return { legM: mul(legAdj, mul(shrL, legM0)), footM: Mat4.chain(G, T(dx, 0, 0), shrF, footM0) };
    }

    class JakeActor {
        constructor(scale) { this.sc = scale || 0.55; this.reset(); }

        reset() {
            const s = this.st = {
                rnd: AT.seedRand(33), time: 0, wl: { idle: 1, walk: 0, dance: 0 }, wa: { none: 1, hammer: 0, mace: 0 },
                tall: 0, tallV: 0, md: {}, mdV: {}, mdT: {}, roll: 0, poof: 0, modeSpin: 0, modeSpinV: 0,
                ew: { normal: 1, senang: 0, marah: 0, sedih: 0, kaget: 0, ngambek: 0 },
                earS: { '-1': { x: 0, v: 0 }, '1': { x: 0, v: 0 } }, tailS: { x: 0, v: 0 }, armS: { L: null, R: null },
                prevHead: null, prevLift: { '-1': 0, '1': 0 }, prevImpact: 0, prevBallOn: false, prevSsl: 0,
                shake: 0, burst: false, acc: {}, nextBlink: 2.5, blinkStart: -10, lastMouthK: [], mode: 'jake', tallT: 0
            };
            MODE_NAMES.forEach(n => { s.md[n] = 0; s.mdV[n] = 0; s.mdT[n] = 0; });
            this.hand = { L: [0, 0, 0], R: [0, 0, 0] };
            this.nose = [0, 0, 0];
            this.head = [0, 0, 0];
            this.impact = false;          // true pada frame ketika palu menghantam
        }

        /* c = perintah dari storyline:
           x,y,z,yaw | loco | action | actClock | locoClock | mode | tall | expr | rocketDir | rocketFace |
           placeMat (menimpa penempatan, mis. dipegang Finn) | swing (kemiringan pedang) |
           reachL/reachR = {p:[x,y,z] dunia, k:0..1} | silent | sound */
        frame(dt, c, list) {
            const s = this.st, sc = c.scaleMul ? this.sc * c.scaleMul : this.sc, silent = !!c.silent;
            s.time += dt;
            const kw = Math.min(1, dt * 7);
            const loco = c.loco || 'idle', act = c.action || 'none';
            for (const a in s.wl) s.wl[a] += ((a === loco ? 1 : 0) - s.wl[a]) * kw;
            for (const a in s.wa) s.wa[a] += ((a === act ? 1 : 0) - s.wa[a]) * kw;

            const clockFor = (a, isAct) => isAct ? (c.actClock !== undefined ? c.actClock : s.time)
                : (a === 'walk' && c.locoClock !== undefined ? c.locoClock : s.time);
            const mixLayer = (weights, skip, isAct) => {
                const lst = []; let sum = 0;
                for (const a in weights) { if (a === skip || weights[a] <= 0.002) continue; lst.push([weights[a], ANIMS[a](clockFor(a, isAct))]); sum += weights[a]; }
                lst.forEach(x => { x[0] /= sum || 1; });
                return lst.length ? mixPoses(lst) : null;
            };
            const PL = mixLayer(s.wl, null, false), PA = mixLayer(s.wa, 'none', true);
            const actW = clamp(1 - s.wa.none, 0, 1);
            const armW = { L: 0, R: 0 }; let sumA = 0;
            for (const a in s.wa) { if (a === 'none' || !ACTION_ARMS[a]) continue; sumA += s.wa[a]; armW.L += s.wa[a] * (ACTION_ARMS[a].L ? 1 : 0); armW.R += s.wa[a] * (ACTION_ARMS[a].R ? 1 : 0); }
            armW.L /= sumA || 1; armW.R /= sumA || 1;
            const P = composePoses(PL, PA, actW, armW, s.wl.walk + s.wl.dance);

            /* ---- ekspresi ---- */
            const exprTarget = c.expr || (c.action && AUTO_EXPR[c.action]) || (s.wl.dance > 0.5 ? 'senang' : 'normal');
            const ke = Math.min(1, dt * 7);
            for (const n in s.ew) s.ew[n] += ((n === exprTarget ? 1 : 0) - s.ew[n]) * ke;
            const manual = !!c.expr && c.expr !== 'normal';
            const exprAmt = clamp(1 - s.ew.normal, 0, 1) * (manual ? 1 : 0.75);
            let we = 0, exE = 0, exM = 0, exS = 0, lidW = 0, angW = 0;
            for (const n in EXPR) {
                if (n === 'normal') continue;
                const w = s.ew[n], X = EXPR[n];
                we += w; exE += w * X.eye; exM += w * X.mouth; exS += w * X.smile; lidW += w * X.lid; angW += w * X.lid * X.ang;
            }
            if (we > 1e-3) { P.eye = lerp1(P.eye, exE / we, exprAmt); P.mouth = lerp1(P.mouth, exM / we, exprAmt); P.smile = lerp1(P.smile, exS / we, exprAmt); }
            const exprLid = lidW * (manual ? 1 : 0.75);
            const exprAng = lidW > 1e-3 ? angW / lidW : 0;

            /* ---- gerak sekunder lengan (pegas siku) ---- */
            const springArm = (key, target) => {
                let sp = s.armS[key];
                if (!sp || sp.x.length !== target.length) sp = s.armS[key] = { x: target.slice(), v: target.map(() => 0) };
                const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
                for (let i = 0; i < target.length; i++) {
                    if (i < 3 || i >= 9) { sp.x[i] = target[i]; sp.v[i] = 0; continue; }
                    for (let k2 = 0; k2 < n; k2++) { sp.v[i] += ((target[i] - sp.x[i]) * 150 - sp.v[i] * 14) * h; sp.x[i] += sp.v[i] * h; }
                }
                return sp.x.slice();
            };
            P.armL = springArm('L', P.armL);
            P.armR = springArm('R', P.armR);

            /* ---- MODE (mobil / pedang / bola / roket) ---- */
            const want = c.mode || 'jake';
            if (want !== s.mode) {
                s.mode = want;
                MODE_NAMES.forEach(n => { s.mdT[n] = n === want ? 1 : 0; });
                if (silent) { MODE_NAMES.forEach(n => { s.md[n] = s.mdT[n]; s.mdV[n] = 0; }); }
                else { s.poof = 1; s.burst = true; sfx.poof(); s.modeSpinV = c.noSpin ? 0 : 16; }
            }
            MODE_NAMES.forEach(n => {
                const so = { x: s.md[n], v: s.mdV[n] };
                stepSpring(so, 'x', 'v', s.mdT[n], 45, 8, dt);
                s.md[n] = so.x; s.mdV[n] = so.v;
            });
            s.poof *= Math.exp(-dt * 2.2);
            s.modeSpinV *= Math.exp(-dt * 2.6);
            s.modeSpin += s.modeSpinV * dt;
            if (s.modeSpinV < 1.5) {
                const near = Math.round(s.modeSpin / TAU) * TAU;
                s.modeSpin += (near - s.modeSpin) * Math.min(1, dt * 5);
                if (s.modeSpinV < 0.05 && Math.abs(s.modeSpin - near) < 0.01) s.modeSpin = 0;
            }
            const mE = {}; let mwSum = 0;
            MODE_NAMES.forEach(n => { mE[n] = clamp(s.md[n], 0, 1.12); mwSum += mE[n]; });
            const mw = clamp(mwSum, 0, 1);
            const wts = [1 - mwSum, ...MODE_NAMES.map(n => mE[n])];
            ['bob', 'lean', 'twist', 'sway', 'squash'].forEach(k => { P[k] *= 1 - mw; });
            P.twist += s.modeSpin;
            morphBody(mE);

            const tt = s.time;
            let hover = 0, tiltM = 0, yawM = 0, pitchM = 0, sqM = 0;
            hover += mE.car * 0.02 * Math.sin(tt * 26);
            yawM += mE.car * 0.04 * Math.sin(tt * 0.9);
            // pedang: kalau dipegang Finn (placeMat) tidak melayang sendiri, hanya mengikuti ayunan
            const held = !!c.placeMat;
            const ssl = tt % 5.0;
            if (held) { tiltM += mE.sword * (c.swing || 0); }
            else {
                const slash = ssl < 0.3 ? -1.9 * (1 - Math.pow(1 - ssl / 0.3, 3)) : (ssl < 1.3 ? -1.9 * (1 - sstep(0.3, 1.3, ssl)) : 0);
                hover += mE.sword * (0.75 + 0.18 * Math.sin(tt * 2.0));
                tiltM += mE.sword * (0.20 + slash);
                yawM += mE.sword * 0.45 * Math.sin(tt * 0.7);
            }
            const ballH = 1.3 * Math.abs(Math.sin(tt * 3.0));
            sqM += mE.ball * (ballH < 0.14 ? -0.28 * (1 - ballH / 0.14) : 0.06 * Math.min(1, ballH));
            hover += mE.ball * (ballH + 1.55 * (ballH < 0.14 ? -0.28 * (1 - ballH / 0.14) : 0.06 * Math.min(1, ballH)));
            yawM += mE.ball * 0.2 * Math.sin(tt * 1.5);
            let Mrk = null;                                            // orientasi roket mengikuti arah terbang
            if (c.rocketDir && mE.rocket > 0.01) {
                const d = V3.norm(c.rocketDir), rf = c.rocketFace || [0, 0.6, 0.8];
                let f = V3.sub(rf, V3.mul(d, V3.dot(rf, d)));
                f = V3.len(f) < 0.2 ? [0, 0, 1] : V3.norm(f);
                const X = V3.cross(d, f);
                const R = Mat4.fromBasis([0, 0, 0], X, d, f);
                Mrk = Mat4.chain(T(0, 2.0, 0), R, T(0, -2.0, 0));
                // goyang halus supaya terlihat melaju
            } else {
                pitchM += mE.rocket * (Math.PI / 2 + 0.05 * Math.sin(tt * 5.0));
                tiltM += mE.rocket * (Math.PI + 0.05 * Math.cos(tt * 4.3));
                hover += mE.rocket * (0.4 + 0.1 * Math.sin(tt * 4.0));
            }
            P.squash += sqM;
            let Mm = Mat4.chain(T(0, hover, 0), T(0, 1.4, 0), Mat4.rotationZ(tiltM), Mat4.rotationY(yawM), Mat4.rotationX(pitchM), T(0, -1.4, 0));
            if (Mrk) Mm = mul(Mm, mul(Mrk, T(0, 0, 0)));

            /* ---- memanjang (tall) ---- */
            const tallT = c.tall ? 1 : 0;
            stepSpring(s, 'tall', 'tallV', tallT, 60, 7, dt);
            const g = 1;
            const w = clamp(s.tall, -0.3, 1.3) * (1 - mw);
            const wx = 1 - 0.38 * w, wy = 1 + 1.6 * w, wz = 1 - 0.3 * w;
            const drop = -0.5 * w;
            const roar = clamp(Math.abs(s.tallV) / 2.0, 0, 1);
            P.mouth = Math.max(P.mouth, 0.35 + 0.65 * roar);
            P.smile = P.smile + (0.2 - P.smile) * roar;
            P.eye *= 1 + 0.12 * roar;
            P.squash += 0.08 * clamp(s.tallV / 2.0, -1, 1);
            s.roll += 0;   // roda diputar dari story lewat c.roll
            const roll = c.roll || 0;

            /* ---- kedip ---- */
            let blink = 1;
            if (s.time > s.nextBlink) { s.blinkStart = s.time; s.nextBlink = s.time + 2.5 + s.rnd() * 3; }
            const bp = (s.time - s.blinkStart) / 0.16;
            if (bp >= 0 && bp <= 1) blink = 1 - 0.92 * Math.sin(Math.PI * bp);

            /* ---- matriks utama ---- */
            const Place = c.placeMat || Mat4.chain(T(c.x || 0, c.y || 0, c.z || 0), Mat4.rotationY(c.yaw || 0), S(sc, sc, sc));
            const sq = P.squash;
            const Bp = Mat4.chain(T(0, P.bob, 0), T(0, BODY.base, 0), Mat4.rotationY(P.twist), Mat4.rotationX(P.lean), Mat4.rotationZ(P.sway),
                S(1 - 0.5 * sq, 1 + sq, 1 - 0.5 * sq), T(0, -BODY.base, 0));
            const Wm = Mat4.chain(T(0, -drop, 0), T(0, BODY.base, 0), S(wx, wy, wz), T(0, -BODY.base, 0));
            const Bm = Mat4.chain(Place, Bp, Mm, Wm);
            const Brig = Mat4.chain(Place, Bp, Mm);
            const wfn = (p) => [p[0] * wx, BODY.base + (p[1] - BODY.base) * wy - drop, p[2] * wz];

            const legK = 1 - sstep(0, 0.55, mw);
            const L = legMatrices(-1, P.legL, g, wx, drop, legK), R = legMatrices(1, P.legR, g, wx, drop, legK);
            L.legM = mul(Place, L.legM); L.footM = mul(Place, L.footM); R.legM = mul(Place, R.legM); R.footM = mul(Place, R.footM);

            const headW = Mat4.point(Bm, [0, 4.3, 0]);
            this.head = headW;
            let hv = [0, 0, 0];
            if (s.prevHead && dt > 1e-4) hv = headW.map((v, i) => clamp((v - s.prevHead[i]) / dt, -12, 12));
            s.prevHead = headW;
            [-1, 1].forEach(sd => { const tgt = clamp((-0.11 * hv[0] + sd * 0.05 * hv[1]) / Math.max(sc * 2, 1), -0.8, 0.8); stepSpring(s.earS[sd], 'x', 'v', tgt, 90, 7, dt); });
            stepSpring(s.tailS, 'x', 'v', P.tail, 70, 4.5, dt);

            const modeLid = sstep(0.25, 0.8, mE.car * JK.MODE_LID.car + mE.sword * (JK.MODE_LID.sword || 0));
            const exprLidK = exprLid * (1 - mw);
            const lidCover = Math.max(modeLid, exprLidK);
            const lidAng = (0.5 * modeLid + exprAng * exprLidK) / Math.max(1e-3, modeLid + exprLidK);

            const ctx = {
                Bm, Place, eye: Math.max(0.05, P.eye) * blink,
                mouth: clamp(P.mouth, 0, 1), smile: clamp(P.smile, -1, 1),
                dist: 0, impact: P.impact, bubble: 0,
                g, wx, drop, gs: 1, m: mE, t: s.time, mw, wts, legK, roll, poof: s.poof,
                lidK: lidCover, lidAng, zw: {},
                earA: { '-1': s.earS['-1'].x, '1': s.earS['1'].x },
                impactPos: [0, 0, 0],
                legM: { '-1': L.legM, '1': R.legM }, footM: { '-1': L.footM, '1': R.footM },
                tail: Mat4.chain(Bm, T(tailPivot[0], tailPivot[1], tailPivot[2]), Mat4.rotationY(s.tailS.x), T(-tailPivot[0], -tailPivot[1], -tailPivot[2]))
            };
            ctx.eyeD = eyeDims(wts);
            ctx.eyeE = { '-1': mixMats(EYE_FR['-1'], wts), '1': mixMats(EYE_FR['1'], wts) };
            ctx.mp = MODES.map((m, i) => i === 0 ? { open: ctx.mouth, smile: ctx.smile } : JK.MODE_FACE[m]);
            ctx.openB = wts.reduce((a, w2, i) => a + w2 * ctx.mp[i].open, 0);
            ctx.impactPos = Mat4.point(Bm, [1.0, 0.9, 3.1]); ctx.impactPos[1] = 0;
            puffs.forEach(pf => { pf.alpha = 0.7 * clamp(ctx.poof * 1.4, 0, 1); });

            /* ---- efek partikel & suara (dilewati saat "silent") ---- */
            this.impact = false;
            if (!silent) {
                const gE = sc * 1.8;
                const Wp = (pt) => Mat4.point(Bm, pt);
                const tick = (key, period) => { s.acc[key] = (s.acc[key] || 0) + dt; if (s.acc[key] >= period) { s.acc[key] = 0; return true; } return false; };
                const ring = (x, z, r, n, size) => {
                    for (let i = 0; i < n; i++) {
                        const a = i * 2 * Math.PI / n;
                        particles.emit('dust', x + Math.cos(a) * r, 0.08, z + Math.sin(a) * r, 1, { size, vx: Math.cos(a) * 1.4 * gE, vz: Math.sin(a) * 1.4 * gE, sx: 0.2, sz: 0.2, sy: 0.4 });
                    }
                };
                [-1, 1].forEach(sd => {
                    const lift = (sd < 0 ? P.legL : P.legR)[1];
                    if (s.wl.walk + s.wl.dance > 0.3 && mw < 0.3 && s.prevLift[sd] > 0.05 && lift <= 0.05) {
                        const fp = Mat4.point(Place, [sd * LEG_X, 0.08, 0.45]);
                        particles.emit('dust', fp[0], 0.05, fp[2], 2, { size: 0.09 * gE, sx: 0.4, sy: 0.3, sz: 0.4 });
                    }
                    s.prevLift[sd] = lift;
                });
                if (P.impact > 0.01 && s.prevImpact <= 0.01) {
                    const ip = ctx.impactPos;
                    ring(ip[0], ip[2], 0.3 * gE, 10, 0.12 * gE);
                    particles.emit('spark', ip[0], 0.2, ip[2], 14, { size: 0.07, sx: 1.8, sy: 2.4, sz: 1.8 });
                    sfx.bonk(); sfx.thud(0.8); s.shake = Math.max(s.shake, 0.18);
                    this.impact = true;
                }
                s.prevImpact = P.impact;
                if (mE.car > 0.7 && tick('exh', 0.07)) {
                    const e = Wp([0.9, 0.55, -1.55]);
                    particles.emit('smoke', e[0], e[1], e[2], 1, { size: 0.08 * gE, vy: 0.4, vz: -0.4, sx: 0.2, sz: 0.2, sy: 0.3 });
                    [-1, 1].forEach(sd => { const d = Wp([sd * 1.7, 0.12, -1.3]); particles.emit('dust', d[0], d[1], d[2], 1, { size: 0.09 * gE, sx: 0.3, sz: 0.3, sy: 0.3 }); });
                }
                sfx.engine(c.sound !== false && mE.car > 0.6, 1);
                if (mE.rocket > 0.4) {
                    const tail = Wp([0, -0.55, 0]), back = Wp([0, -1.5, 0]);
                    const dir = V3.norm(V3.sub(tail, back)), speed = (3 + 2 * mE.rocket);
                    particles.emit('flame', tail[0], tail[1], tail[2], 2 + Math.round(2 * mE.rocket),
                        { size: 0.16 * gE, vx: dir[0] * speed, vy: dir[1] * speed, vz: dir[2] * speed, sx: 0.4, sy: 0.4, sz: 0.4 });
                    if (tick('rsfx', 0.5)) sfx.whoosh();
                }
                const ballLand = mE.ball > 0.5 && ballH < 0.12;
                if (ballLand && !s.prevBallOn) { const b = Wp([0, 0.1, 0]); ring(b[0], b[2], 0.6 * gE, 8, 0.1 * gE); sfx.thud(0.5); sfx.boing(2); }
                s.prevBallOn = ballLand;
                if (!held && ssl < s.prevSsl && mE.sword > 0.5) sfx.whoosh();
                s.prevSsl = ssl;
                if (mE.sword > 0.5 && (held ? Math.abs(c.swing || 0) > 0.6 : ssl < 0.9)) { const tip = Wp([-0.5, 7.5, 0]); particles.emit('spark', tip[0], tip[1], tip[2], 2, { size: 0.06, sx: 0.8, sy: 0.8, sz: 0.8 }); }
                if (s.burst) { s.burst = false; const c0 = Wp([0, 2.4, 0]); particles.emit('spark', c0[0], c0[1], c0[2], 26, { size: 0.08, sx: 2.2, sy: 2.2, sz: 2.2 }); }
                if (s.ew.sedih > 0.5 && mw < 0.3 && tick('tear', 0.14)) { [-1, 1].forEach(sd => { const e = Wp([sd * 0.7, 3.85, 0.95]); particles.emit('sweat', e[0], e[1], e[2], 1, { size: 0.05 * gE, vy: 0.2, sx: 0.15, sz: 0.05, sy: 0.1 }); }); }
            } else { s.burst = false; s.prevImpact = P.impact; }

            // mulut dinamis
            const mk = [ctx.mouth, ctx.smile, ...wts];
            if (mk.some((v, i) => s.lastMouthK[i] === undefined || Math.abs(v - s.lastMouthK[i]) > 1e-4)) {
                const gm = mouthBlend(ctx);
                JK.updateMesh(mouthMesh, gm.P, gm.N);
                s.lastMouthK = mk;
            }
            mouthItem.color = lerpArr(BLACK, MOUTH_RED, sstep(0.06, 0.22, ctx.openB));
            s.shake *= Math.exp(-dt * 6);
            this.shake = s.shake;

            /* ---- tangan menjangkau titik dunia (mis. rak atas) ---- */
            const invBrig = (c.reachL || c.reachR) ? Mat4.invert(Brig) : null;
            const reach = (sd, r) => {
                if (!r || r.k < 0.01) return null;
                const f = sd < 0 ? P.armL : P.armR;
                const normal = [0, 1, 2, 3].map(i => wfn([f[i * 3] * sd, f[i * 3 + 1], f[i * 3 + 2]]));
                const tg = Mat4.point(invBrig, r.p);
                const sho = wfn([sd * 1.1, 3.25, 0.05]);
                const side = r.bow === undefined ? 0.5 : r.bow;
                const p1 = V3.add(V3.lerp(sho, tg, 0.33), [sd * side, 0, 0.1]), p2 = V3.add(V3.lerp(sho, tg, 0.7), [sd * side * 0.4, 0, 0.1]);
                const ctrl = [sho, p1, p2, tg];
                return ctrl.map((q, i) => V3.lerp(normal[i], q, r.k)).flat();
            };
            const ovL = reach(-1, c.reachL), ovR = reach(1, c.reachR);

            /* ---- kumpulkan objek ---- */
            items.forEach(it => {
                if (it.skip) return;
                if (it.vis && !it.vis(ctx)) return;
                const m = modelOf(it, ctx);
                if (m) list.push([it, m, 1, ctx]);
            });
            const endL = pushArm(list, -1, P, Brig, wfn, mw, s.time, ovL);
            const endR = pushArm(list, 1, P, Brig, wfn, mw, s.time, ovR);
            if (endL) this.hand.L = Mat4.point(Brig, endL);
            if (endR) this.hand.R = Mat4.point(Brig, endR);
            this.nose = Mat4.point(Bm, [0, 4.55, 0]);
            this.Bm = Bm; this.Place = Place; this.mE = mE; this.mw = mw;
        }
    }
    AT.JakeActor = JakeActor;
})();
