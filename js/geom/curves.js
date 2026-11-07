(function () {
  "use strict";
  const App = (window.App = window.App || {});
  App.geom = App.geom || {};
  App.geom.curves = App.geom.curves || {};
  const { V3 } = App.math;
  const { gridMesh } = App.geom;

  /* 1. CATMULL-ROM SPLINE 3D */
  function catmullRom(pts) {
    const n = pts.length;
    return (v) => {
      const s = Math.min(Math.max(v, 0), 1) * (n - 1);
      const i = Math.min(Math.floor(s), n - 2);
      const t = s - i;
      const p0 = pts[Math.max(i - 1, 0)],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[Math.min(i + 2, n - 1)];
      return [0, 1, 2].map(
        (k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t),
      );
    };
  }

  /* 2. CUBIC BEZIER 3D */
  function bezier(p, t) {
    const u = 1 - t;
    const a = u * u * u,
      b = 3 * u * u * t,
      c = 3 * u * t * t,
      d = t * t * t;
    return [0, 1, 2].map(
      (k) => a * p[0][k] + b * p[1][k] + c * p[2][k] + d * p[3][k],
    );
  }

  /* 3. TUBE MESH (SWEEP KURVA 3D DENGAN RADIUS VARIABEL) */
  function tubeMesh(
    gl,
    {
      points,
      controlPoints,
      path: customPath,
      radius,
      ref = [0, 0, 1],
      capLen = 0.1,
      uSeg = 14,
      vSeg = 48,
    },
  ) {
    const path =
      customPath ||
      (controlPoints ? (t) => bezier(controlPoints, t) : catmullRom(points));
    const radFn = typeof radius === "function" ? radius : () => radius;
    let len = 0,
      prev = path(0);
    for (let k = 1; k <= 50; k++) {
      const q = path(k / 50);
      len += V3.len(V3.sub(q, prev));
      prev = q;
    }
    const cl = Math.min(0.45, capLen / Math.max(len, 1e-6));
    const remap = (v) => {
      if (v < 0.15) return cl * (v / 0.15);
      if (v > 0.85) return 1 - cl * ((1 - v) / 0.15);
      return cl + (1 - 2 * cl) * ((v - 0.15) / 0.7);
    };
    const capped = (v) => {
      let r = radFn(v);
      if (v < cl) {
        const s = 1 - v / cl;
        r *= Math.sqrt(Math.max(0, 1 - s * s));
      } else if (v > 1 - cl) {
        const s = 1 - (1 - v) / cl;
        r *= Math.sqrt(Math.max(0, 1 - s * s));
      }
      return r;
    };
    // Build frame once per v to share between position and analytic normal
    const frame = (v0) => {
      const v = Math.min(Math.max(remap(Math.min(Math.max(v0, 0), 1)), 0), 1);
      const c = path(v);
      const T = V3.norm(
        V3.sub(path(Math.min(v + 0.002, 1)), path(Math.max(v - 0.002, 0))),
      );
      const Nn = V3.norm(V3.cross(T, ref));
      const B = V3.cross(T, Nn);
      return { v, c, Nn, B };
    };
    return gridMesh(
      gl, uSeg, vSeg,
      (u, v0) => {
        const { v, c, Nn, B } = frame(v0);
        const a = 2 * Math.PI * u, r = capped(v);
        return [
          c[0] + (Math.cos(a) * Nn[0] + Math.sin(a) * B[0]) * r,
          c[1] + (Math.cos(a) * Nn[1] + Math.sin(a) * B[1]) * r,
          c[2] + (Math.cos(a) * Nn[2] + Math.sin(a) * B[2]) * r,
        ];
      },
      // Analytic radial normal — bypasses finite-diff & winding vote entirely
      (u, v0) => {
        const { Nn, B } = frame(v0);
        const a = 2 * Math.PI * u;
        return V3.norm([
          Math.cos(a) * Nn[0] + Math.sin(a) * B[0],
          Math.cos(a) * Nn[1] + Math.sin(a) * B[1],
          Math.cos(a) * Nn[2] + Math.sin(a) * B[2],
        ]);
      },
    );
  }

  /* 3b. BEZIER TUBE MESH (SWEEP KURVA 3D CUBIC BEZIER) */
  function bezierTubeMesh(gl, opt) {
    return tubeMesh(gl, {
      ...opt,
      controlPoints: opt.controlPoints || opt.points,
    });
  }

  /* 4. PERMUKAAN BEZIER PATCH (Mulut pada kontur permukaan) */
  function bezierPatchMesh(
    gl,
    Uc,
    Lc,
    zo,
    FA,
    FB,
    FC,
    isInner = false,
    uSeg = 20,
    vSeg = 6,
  ) {
    return gridMesh(
      gl,
      uSeg,
      vSeg,
      (s, w) => {
        const u = bezier(
          Uc.map((p) => [p[0], p[1], 0]),
          s,
        );
        const l = bezier(
          Lc.map((p) => [p[0], p[1], 0]),
          s,
        );
        const span = isInner ? w : -0.14 + 1.24 * w;
        const x = u[0] + (l[0] - u[0]) * span;
        const y = u[1] + (l[1] - u[1]) * span;
        const zz =
          FC * Math.sqrt(Math.max(0, 1 - (x / FA) ** 2 - (y / FB) ** 2));
        return [x, y, zz + zo];
      },
      (s, w, p) =>
        V3.norm([p[0] / (FA * FA), p[1] / (FB * FB), (p[2] - zo) / (FC * FC)]),
    );
  }

  App.geom.curves = {
    catmullRom,
    bezier,
    tubeMesh,
    bezierTubeMesh,
    bezierPatchMesh,
  };

  window.JK = window.JK || {};
  window.JK.catmullRom = catmullRom;
  window.JK.bezier = bezier;
  window.JK.tubeMesh = (opt) => tubeMesh(window.JK.gl, opt);
  window.JK.bezierTubeMesh = (opt) => bezierTubeMesh(window.JK.gl, opt);
})();
