(function () {
  "use strict";
  const App = (window.App = window.App || {});
  App.geom = App.geom || {};
  const V3 = App.math.V3;

  function gridIndices(P, N, uSeg, vSeg) {
    const idx = [];
    const stride = uSeg + 1;
    const pushTri = (a, b, c) => {
      const g = V3.cross(V3.sub(P[b], P[a]), V3.sub(P[c], P[a]));
      const navg = V3.add(V3.add(N[a], N[b]), N[c]);
      if (V3.dot(g, navg) < 0) idx.push(a, c, b);
      else idx.push(a, b, c);
    };
    for (let j = 0; j < vSeg; j++) {
      for (let i = 0; i < uSeg; i++) {
        const a = j * stride + i,
          b = a + 1,
          c = a + stride,
          d = c + 1;
        pushTri(a, c, b);
        pushTri(b, c, d);
      }
    }
    return idx;
  }

  function gridData(uSeg, vSeg, fn, analyticNormal) {
    const P = [],
      N = [];
    const e = 1e-4;
    let vote = 0;

    for (let j = 0; j <= vSeg; j++) {
      const v = j / vSeg;
      const vc = Math.min(Math.max(v, 0.003), 0.997);
      const ring = [];
      for (let i = 0; i <= uSeg; i++) {
        const u = i / uSeg;
        const p = fn(u, v);
        let n;
        if (analyticNormal) {
          n = analyticNormal(u, v, p);
        } else {
          const du = V3.sub(fn(u + e, vc), fn(u - e, vc));
          const dv = V3.sub(fn(u, vc + e), fn(u, vc - e));
          n = V3.norm(V3.cross(du, dv));
        }
        P.push(p);
        N.push(n);
        if (i < uSeg) ring.push(p);
      }
      if (!analyticNormal && j > 0 && j < vSeg) {
        const c = [0, 0, 0];
        ring.forEach((p) => {
          c[0] += p[0];
          c[1] += p[1];
          c[2] += p[2];
        });
        const k = 1 / ring.length;
        const center = [c[0] * k, c[1] * k, c[2] * k];
        for (let i = 0; i < uSeg; i++) {
          const idx = j * (uSeg + 1) + i;
          vote += V3.dot(N[idx], V3.sub(P[idx], center));
        }
      }
    }
    if (vote < 0) {
      for (let i = 0; i < N.length; i++) N[i] = V3.mul(N[i], -1);
    }
    return { P, N, idx: gridIndices(P, N, uSeg, vSeg) };
  }

  function fillBuffers(P, N) {
    const pos = new Float32Array(P.length * 3);
    const nor = new Float32Array(N.length * 3);
    P.forEach((p, i) => {
      pos[i * 3] = p[0];
      pos[i * 3 + 1] = p[1];
      pos[i * 3 + 2] = p[2];
    });
    N.forEach((n, i) => {
      nor[i * 3] = n[0];
      nor[i * 3 + 1] = n[1];
      nor[i * 3 + 2] = n[2];
    });
    return { pos, nor };
  }

  function uploadMesh(gl, P, N, idx, dynamic = false) {
    if (P.length > 65535)
      throw new Error("Mesh terlalu besar untuk indeks 16-bit");
    const { pos, nor } = fillBuffers(P, N);
    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

    const pBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, usage);

    const nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, nor, usage);

    const iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(idx),
      gl.STATIC_DRAW,
    );

    return { pBuf, nBuf, iBuf, count: idx.length };
  }

  function gridMesh(gl, uSeg, vSeg, fn, analyticNormal) {
    const g = gridData(uSeg, vSeg, fn, analyticNormal);
    return uploadMesh(gl, g.P, g.N, g.idx);
  }

  App.geom.gridIndices = gridIndices;
  App.geom.gridData = gridData;
  App.geom.fillBuffers = fillBuffers;
  App.geom.uploadMesh = uploadMesh;
  App.geom.gridMesh = gridMesh;

  window.JK = window.JK || {};
  window.JK.gridIndices = gridIndices;
  window.JK.gridData = gridData;
  window.JK.fillBuffers = fillBuffers;
  window.JK.uploadMesh = (P, N, idx, dyn) =>
    uploadMesh(window.JK.gl, P, N, idx, dyn);
  window.JK.gridMesh = (u, v, f, an) => gridMesh(window.JK.gl, u, v, f, an);
})();
