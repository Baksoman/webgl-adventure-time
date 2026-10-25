/* =====================================================================
   engine.js - Renderer bersama + utilitas (easing, keyframe, mesh helper).
   Semua karakter (Jake / Finn / BMO) dan properti ruangan menghasilkan daftar
   [item, matriks, skalaOutline, ctx] yang digambar sekali per frame di sini
   dengan shader toon + outline "inverted hull" milik Jake.
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, { gl, U, aPos, aNorm, Mat4, V3 } = JK;
    const AT = window.AT = {};

    /* ---------------- utilitas matematika ---------------- */
    const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
    const lerp = (a, b, t) => a + (b - a) * t;
    const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);               // 0..1 di rentang [a,b]
    const smooth = (x) => x * x * (3 - 2 * x);
    const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10);                // smootherstep
    const lerpV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    // keyframe: keys = [[t, v0, v1, ...], ...] -> vektor pada waktu t. mode: 'ease' | 'lin'
    function kf(keys, t, mode) {
        if (t <= keys[0][0]) return keys[0].slice(1);
        const last = keys[keys.length - 1];
        if (t >= last[0]) return last.slice(1);
        let i = 0;
        while (keys[i + 1][0] < t) i++;
        const a = keys[i], b = keys[i + 1];
        let u = (t - a[0]) / (b[0] - a[0]);
        if (mode !== 'lin') u = smooth(u);
        return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
    }
    // sudut hadap (yaw) dari vektor gerak (dx,dz) - arah +z lokal -> dunia
    const heading = (dx, dz) => Math.atan2(dx, dz);
    const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
    // matriks penempatan standar: geser + putar yaw + skala seragam
    const place = (x, y, z, yaw, s) => Mat4.chain(Mat4.translation(x, y, z), Mat4.rotationY(yaw || 0), Mat4.scaling(s || 1, s || 1, s || 1));
    Object.assign(AT, { clamp, lerp, seg, smooth, ease, lerpV, kf, heading, angLerp, place });

    /* ---------------- item & mesh helper ---------------- */
    const SHADE = JK.cfg.SHADE_WARM;
    // item = deskriptor bahan yang dipakai drawItem (mirip item di scene.js Jake)
    AT.mk = (mesh, color, spec = 0.1, ow = 0.5, extra) =>
        Object.assign({ mesh, color, spec, ow, unlit: false, alpha: 1, shade: SHADE }, extra);

    // Bagi triangle winding supaya menghadap sesuai normal (dipakai mesh buatan sendiri, mis. BMO)
    AT.upload = (P, N, I) => {
        const idx = I.slice();
        for (let i = 0; i < idx.length; i += 3) {
            const a = idx[i], b = idx[i + 1], c = idx[i + 2];
            const g = V3.cross(V3.sub(P[b], P[a]), V3.sub(P[c], P[a]));
            const nv = V3.add(V3.add(N[a], N[b]), N[c]);
            if (V3.dot(g, nv) < 0) { idx[i + 1] = c; idx[i + 2] = b; }
        }
        return JK.uploadMesh(P, N, idx);
    };

    // bayangan bulat lembut di lantai
    const shadowMesh = JK.sphereMesh(14, 8);
    const SH_IT = { mesh: shadowMesh, color: [0.03, 0.02, 0.05], spec: 0, ow: 0, unlit: true, alpha: 0.28, shade: SHADE };
    AT.shadow = (list, x, z, rx, rz, a, y) => {
        const it = a === undefined ? SH_IT : Object.assign({}, SH_IT, { alpha: a });
        list.push([it, Mat4.chain(Mat4.translation(x, y || 0, z), Mat4.scaling(rx, 0.02, rz))]);
    };

    /* ---------------- program layar BMO (tekstur + garis scan CRT) ---------------- */
    function sh(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
        return s;
    }
    const scr = gl.createProgram();
    gl.attachShader(scr, sh(gl.VERTEX_SHADER, `
        attribute vec3 aPosition; attribute vec3 aNormal;
        uniform mat4 uModelMatrix, uViewMatrix, uProjectionMatrix; uniform vec2 uSize; varying vec2 vUV;
        void main(){ vUV = aPosition.xy / uSize + 0.5; gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0); }`));
    gl.attachShader(scr, sh(gl.FRAGMENT_SHADER, `
        precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uGlow;
        void main(){ vec3 c = texture2D(uTex, vUV).rgb;
            c *= 0.93 + 0.07 * sin(vUV.y * 300.0);
            c *= 1.0 - 0.32 * pow(length(vUV - 0.5) * 1.3, 2.0);
            gl_FragColor = vec4(c * uGlow, 1.0); }`));
    gl.bindAttribLocation(scr, 0, 'aPosition'); gl.bindAttribLocation(scr, 1, 'aNormal');
    gl.linkProgram(scr);
    const SU = {};
    ['uModelMatrix', 'uViewMatrix', 'uProjectionMatrix', 'uSize', 'uTex', 'uGlow'].forEach(n => { SU[n] = gl.getUniformLocation(scr, n); });
    const main = gl.getParameter(gl.CURRENT_PROGRAM);

    let curView = null, curProj = null, outlineW = 0.022;

    function drawScreen(it, model) {
        gl.useProgram(scr);
        gl.uniformMatrix4fv(SU.uModelMatrix, false, model);
        gl.uniformMatrix4fv(SU.uViewMatrix, false, curView);
        gl.uniformMatrix4fv(SU.uProjectionMatrix, false, curProj);
        gl.uniform2fv(SU.uSize, it.size);
        gl.uniform1f(SU.uGlow, it.glow === undefined ? 1.15 : it.glow);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, it.tex());
        gl.uniform1i(SU.uTex, 0);
        gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, it.mesh.pBuf); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, it.mesh.nBuf); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, it.mesh.iBuf);
        gl.drawElements(gl.TRIANGLES, it.mesh.count, gl.UNSIGNED_SHORT, 0);
        gl.useProgram(main);
    }

    function drawItem(it, model, outlinePass, os, ctx) {
        if (it.screen) { if (!outlinePass) drawScreen(it, model); return; }
        gl.uniformMatrix4fv(U.uModelMatrix, false, model);
        gl.uniformMatrix3fv(U.uNormalMatrix, false, Mat4.normalMatrix(model));
        gl.uniform1f(U.uOutline, outlinePass ? it.ow * outlineW * (os || 1) : 0.0);
        gl.uniform1f(U.uIsOutline, outlinePass ? 1.0 : 0.0);
        gl.uniform3fv(U.uColor, it.color);
        gl.uniform1f(U.uSpec, it.spec);
        gl.uniform1f(U.uUnlit, it.unlit ? 1.0 : 0.0);
        gl.uniform1f(U.uAlpha, it.alpha);
        gl.uniform3fv(U.uShade, it.shade || SHADE);
        const cuts = (outlinePass && it.cuts && ctx) ? (typeof it.cuts === 'function' ? it.cuts(ctx) : it.cuts) : [];
        gl.uniform4fv(U.uCutA, cuts[0] || [0, 0, 0, 0]);
        gl.uniform4fv(U.uCutB, cuts[1] || [0, 0, 0, 0]);
        const m = it.mesh;
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pBuf); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nBuf); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.iBuf);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
        JK.stats.draws++;
    }

    function resize() {
        const c = JK.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    /* ---------------- render satu frame ----------------
       cam = { eye, target, fov(derajat) }, opt = { outline, toon, bg } */
    AT.render = function (list, cam, opt) {
        resize();
        const canvas = JK.canvas, aspect = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        const bg = opt.bg || [0.05, 0.04, 0.08];
        gl.clearColor(bg[0], bg[1], bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const view = Mat4.lookAt(cam.eye, cam.target, [0, 1, 0]);
        // untuk layar tinggi/sempit (mobile) lebarkan fov agar ruangan tetap muat
        const fov = cam.fov * (aspect < 1.2 ? Math.min(1.7, 1.2 / aspect) : 1);
        const proj = Mat4.perspective(fov * Math.PI / 180, aspect, 0.3, 140);
        curView = view; curProj = proj;
        const dist = V3.len(V3.sub(cam.eye, cam.target));
        outlineW = 0.022 * (dist / 12);

        gl.useProgram(main);
        const lv = V3.norm([0.45, 0.9, 0.85]);
        const lightW = [0, 1, 2].map(i => view[i * 4] * lv[0] + view[i * 4 + 1] * lv[1] + view[i * 4 + 2] * lv[2]);
        gl.uniformMatrix4fv(U.uViewMatrix, false, view);
        gl.uniformMatrix4fv(U.uProjectionMatrix, false, proj);
        gl.uniform3fv(U.uLightDir, lightW);
        gl.uniform3fv(U.uEye, cam.eye);
        gl.uniform1f(U.uToon, opt.toon ? 1.0 : 0.0);
        gl.uniform1f(U.uRim, 0.8);

        if (opt.outline) {
            gl.disable(gl.BLEND);
            gl.cullFace(gl.FRONT);
            gl.depthFunc(gl.LESS);
            for (let i = 0; i < list.length; i++) { const e = list[i], it = e[0]; if (it.ow > 0 && !it.unlit && !it.screen) drawItem(it, e[1], true, e[2], e[3]); }
        }
        gl.cullFace(gl.BACK);
        gl.depthFunc(gl.LEQUAL);
        for (let i = 0; i < list.length; i++) {
            const e = list[i], it = e[0];
            if (it.alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
            else { gl.disable(gl.BLEND); gl.depthMask(true); }
            drawItem(it, e[1], false, e[2], e[3]);
        }
        gl.depthMask(true);
        // matriks untuk proyeksi layar (dipakai UI bila perlu)
        AT.lastVP = Mat4.multiply(proj, view);
    };
})();
