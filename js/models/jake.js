(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.actors = App.actors || {};

  const { Mat4, V3, T: translate, S: scale, mul: multiply } = App.math;
  const { MeshCache } = App.gfx;
  const { quadrics, curves } = App.geom;
  const { solveTwoBoneIK, orientLimb } = App.anim;

  const rotateX = Mat4.rotationX;
  const rotateY = Mat4.rotationY;
  const rotateZ = Mat4.rotationZ;

  function hexToRgb(hexColor) {
    const value = parseInt(hexColor.slice(1), 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  const COLORS = {
    body: hexToRgb("#faba2b"),
    eyeRim: hexToRgb("#0a080a"),
    eyeWhite: hexToRgb("#ffffff"),
  };

  const SHADE_COLOR = [0.66, 0.54, 0.58];

  const RIGHT = 1;
  const LEFT = -1;
  const BOTH_SIDES = [RIGHT, LEFT];

  // Membuat satu nilai per sisi, urutannya sama dengan BOTH_SIDES
  const forBothSides = (createValue) => BOTH_SIDES.map(createValue);

  // Dimensi kontur tubuh Jake (ellipsoid)
  const BODY = {
    baseY: 1.55,
    height: 3.2,
    maxRadius: 1.3,
    depth: 0.9,
  };

  const BODY_TOP_Y = BODY.baseY + BODY.height;
  const EYE = { x: 0.58, y: BODY_TOP_Y - 0.75 };
  const NOSE_Y = EYE.y - 0.25;

  const calculateBodyRadius = (yLocal) => {
    const normalizedY = Math.min(Math.max(yLocal / BODY.height, 0), 1);
    const symmetricY = 2 * normalizedY - 1;
    const ellipseFactor = Math.sqrt(Math.max(0, 1 - symmetricY * symmetricY));
    return BODY.maxRadius * ellipseFactor;
  };

  const calculateBodyDepthZ = (x, y) => {
    const radius = calculateBodyRadius(y - BODY.baseY);
    const quotient = 1 - (x * x) / (radius * radius);
    return quotient > 0 ? radius * BODY.depth * Math.sqrt(quotient) : 0;
  };

  // Parameter anggota badan
  const ARM = {
    lengthUpper: 1,
    lengthForearm: 1,
    shoulderX: 0.75,
    shoulderY: BODY.baseY + 0.45 * BODY.height,
  };

  const LEG = {
    x: 0.65,
    topY: 1.9,
    length: 1.7,
    radius: 0.15,
    thighLength: 0.85,
    shinLength: 0.85,
  };

  const ARM_SCALE = 2.24; // dipendekkan 20% secara menyeluruh (sebelumnya 2.8)

  const FINGER_OFFSETS_X = [-0.035, 0, 0.035];
  const FINGER_LENGTH_SCALES = [1, 1.1, 1.1];

  const EYE_Z_OFFSET = calculateBodyDepthZ(EYE.x, EYE.y) - 0.08;
  const NOSE_Z = calculateBodyDepthZ(0, NOSE_Y) + 0.02;

  // Transformasi lokal tetap, dihitung sekali saat modul dimuat
  const LOCAL_TRANSFORMS = {
    ground: translate(0, 0, 0),

    body: translate(0, BODY.baseY + BODY.height / 2, 0),

    hipSocket: forBothSides((side) => translate(side * LEG.x, 0, 0)),
    leg: multiply(
      translate(0, LEG.topY, 0),
      scale(LEG.radius, LEG.length, LEG.radius),
    ),
    thigh: translate(0, -LEG.thighLength / 2, 0),
    shin: translate(0, -LEG.shinLength / 2, 0),
    ankle: translate(0, -LEG.shinLength, 0),
    foot: multiply(translate(0, 0.2, 0.15), scale(0.2, 0.15, 0.35)),

    eyeSocket: forBothSides((side) =>
      translate(side * EYE.x, EYE.y, EYE_Z_OFFSET),
    ),
    eyeRim: multiply(translate(0, 0, -0.05), scale(0.47, 0.47, 0.3)),
    eyeWhite: scale(0.4, 0.4, 0.3),

    // Hidung (elliptic paraboloid): alas menempel di badan, diputar menghadap +Z
    nose: multiply(translate(0, NOSE_Y, NOSE_Z), rotateX(Math.PI / 2)),

    // Ekor kerucut kuadrik tajam di belakang badan
    tail: Mat4.chain(
      translate(0, 2.15, -0.68),
      rotateX(Math.PI - 0.45),
      scale(0.14, 0.14, 0.52),
    ),

    upperArm: translate(0.0, -0.26, 0),
    forearm: translate(0, -0.2, 0),
    // Rotasi Y ±90° agar telapak menghadap ke badan (posisi tetap/diam untuk jalan maupun lari)
    hand: forBothSides((side) => multiply(translate(0, -0.42, 0), rotateY(side * Math.PI / 2))),

    // Pangkal jari = titik putar jari
    fingerBase: FINGER_OFFSETS_X.map((offsetX) => translate(offsetX, -0.05, 0)),
    fingerShape: FINGER_LENGTH_SCALES.map((lengthScale) =>
      multiply(scale(1, lengthScale, 1), translate(0, -0.03, 0)),
    ),
    // Posisi jempol yang sesuai di sisi telapak
    thumb: forBothSides((side) =>
      multiply(
        translate(-side * 0.045, 0.01, 0.01),
        multiply(rotateZ(-side * 0.8), translate(0, -0.025, 0)),
      ),
    ),
  };

  let sharedMeshes = null;

  // Membuat semua mesh sekali saja, lalu dipakai ulang oleh semua instance
  function initMeshes(gl) {
    if (sharedMeshes) return sharedMeshes;

    // Urutan parameter: radius x/y/z, eksponen lintang, eksponen bujur,
    // segmen keliling, segmen vertikal, rentang lintang (0 = dasar, 1 = puncak)
    const superellipsoid = (
      radiusX,
      radiusY,
      radiusZ,
      latitudeExponent,
      longitudeExponent,
      segmentsAround,
      segmentsVertical,
      latitudeStart = 0,
      latitudeEnd = 1,
    ) =>
      MeshCache.get(
        `superellipsoid_${radiusX}_${radiusY}_${radiusZ}_${latitudeExponent}_${longitudeExponent}_${segmentsAround}_${segmentsVertical}_${latitudeStart}_${latitudeEnd}`,
        () =>
          quadrics.superellipsoidMesh(
            gl,
            radiusX,
            radiusY,
            radiusZ,
            latitudeExponent,
            longitudeExponent,
            segmentsAround,
            segmentsVertical,
            latitudeStart,
            latitudeEnd,
          ),
      );

    const ellipsoid = (
      radiusX,
      radiusY,
      radiusZ,
      segmentsAround = 36,
      segmentsVertical = 24,
    ) =>
      MeshCache.get(
        `ellipsoid_${radiusX}_${radiusY}_${radiusZ}_${segmentsAround}_${segmentsVertical}`,
        () =>
          quadrics.ellipsoidMesh(
            gl,
            radiusX,
            radiusY,
            radiusZ,
            segmentsAround,
            segmentsVertical,
          ),
      );

    const createPart = (mesh, color, specular = 0.1, outlineWidth = 0.5) => ({
      mesh,
      color,
      spec: specular,
      ow: outlineWidth,
      unlit: false,
      alpha: 1,
      shade: SHADE_COLOR,
    });

    const getSurfacePoint = (x, y, zOffset = 0.16) => [
      x,
      y,
      calculateBodyDepthZ(x, y) + zOffset,
    ];

    const jowlPoints = [
      getSurfacePoint(-0.32, EYE.y - 0.55),
      getSurfacePoint(-0.32, EYE.y - 0.3),
      getSurfacePoint(-0.16, EYE.y - 0.1),
      getSurfacePoint(0.16, EYE.y - 0.1),
      getSurfacePoint(0.32, EYE.y - 0.3),
      getSurfacePoint(0.32, EYE.y - 0.55),
    ];

    const mouthControlPoints = [
      getSurfacePoint(-0.2, EYE.y - 0.38, 0.05),
      getSurfacePoint(-0.14, EYE.y - 0.52, 0.05),
      getSurfacePoint(0.14, EYE.y - 0.52, 0.05),
      getSurfacePoint(0.2, EYE.y - 0.38, 0.05),
    ];

    const createEarPoints = (side) => [
      [side * 0.8, BODY_TOP_Y - 0.4, 0],
      [side * 1.05, BODY_TOP_Y - 0.55, 0],
      [side * 1.2, BODY_TOP_Y - 0.72, 0],
      [side * 1.3, BODY_TOP_Y - 0.88, 0],
    ];

    sharedMeshes = {
      // Badan utama (ellipsoid kuadrik)
      body: createPart(
        MeshCache.get("body_jake_ellipsoid", () =>
          quadrics.ellipsoidMesh(
            gl,
            BODY.maxRadius,
            BODY.height / 2,
            BODY.maxRadius * BODY.depth,
            72,
            48,
          ),
        ),
        COLORS.body,
        0,
        1.0,
      ),
      eyeRim: createPart(
        MeshCache.get("sphere_jake", () => quadrics.sphereMesh(gl, 32, 24)),
        COLORS.eyeRim,
        0,
        0,
      ),
      eyeWhite: createPart(
        MeshCache.get("sphere_jake", () => quadrics.sphereMesh(gl, 32, 24)),
        COLORS.eyeWhite,
        0.1,
        0,
      ),
      // Hidung = elliptic paraboloid sejati
      nose: createPart(
        MeshCache.get("nose_jake_para", () =>
          quadrics.ellipticParaboloidMesh(gl, 0.16, 0.1, 0.1, 24, 10),
        ),
        COLORS.eyeRim,
        0.4,
        0,
      ),
      // Pipi / moncong (sweep tabung melintasi spline)
      jowl: createPart(
        MeshCache.get("jowl_jake2", () =>
          curves.tubeMesh(gl, {
            points: jowlPoints,
            radius: () => 0.115,
            capLen: 0.15,
          }),
        ),
        COLORS.body,
        0,
        0.5,
      ),
      // Mulut garis senyum (3D Bezier curve)
      mouth: createPart(
        MeshCache.get("mouth_jake_bezier", () =>
          curves.bezierTubeMesh(gl, {
            controlPoints: mouthControlPoints,
            radius: 0.025,
            capLen: 0.03,
            uSeg: 12,
            vSeg: 32,
          }),
        ),
        COLORS.eyeRim,
        0.1,
        0,
      ),
      ear: forBothSides((side) =>
        createPart(
          MeshCache.get(side === RIGHT ? "earR_jake2" : "earL_jake2", () =>
            curves.tubeMesh(gl, {
              points: createEarPoints(side),
              radius: (factor) => 0.14 * (1 - 0.3 * factor),
              capLen: 0.14,
            }),
          ),
          COLORS.body,
          0,
          0.6,
        ),
      ),
      // Ekor kerucut kuadrik (cone) tajam
      tail: createPart(
        MeshCache.get("tail_jake_cone", () => quadrics.coneMesh(gl, 20, 8)),
        COLORS.body,
        0,
        0.5,
      ),
      // Kaki tabung silindris
      leg: createPart(
        MeshCache.get("limb_jake2", () =>
          curves.tubeMesh(gl, {
            points: [
              [0, 0, 0],
              [0, -0.5, 0],
              [0, -1, 0],
            ],
            radius: () => 1,
            capLen: 0.03,
            uSeg: 16,
            vSeg: 40,
          }),
        ),
        COLORS.body,
        0,
        0.7,
      ),
      // Paha dan betis (segmen kaki yang dipisah oleh sendi lutut IK)
      thigh: createPart(
        superellipsoid(LEG.radius, LEG.thighLength / 2, LEG.radius, 0.2, 1, 16, 8),
        COLORS.body,
        0,
        0.7,
      ),
      shin: createPart(
        superellipsoid(LEG.radius, LEG.shinLength / 2, LEG.radius, 0.2, 1, 16, 8),
        COLORS.body,
        0,
        0.7,
      ),
      knee: createPart(
        ellipsoid(LEG.radius, LEG.radius, LEG.radius, 16, 10),
        COLORS.body,
        0,
        0.7,
      ),
      foot: createPart(
        MeshCache.get("sphere_jake", () => quadrics.sphereMesh(gl, 32, 24)),
        COLORS.body,
        0,
        0.7,
      ),

      shoulder: createPart(
        ellipsoid(0.05, 0.075, 0.05, 20, 12),
        COLORS.body,
        0,
        0.5,
      ),
      upperArm: createPart(
        superellipsoid(0.05, 0.24, 0.05, 0.2, 1, 16, 8),
        COLORS.body,
        0,
        0.5,
      ),
      elbow: createPart(
        ellipsoid(0.05, 0.05, 0.05, 16, 10),
        COLORS.body,
        0,
        0.5,
      ),
      forearm: createPart(
        superellipsoid(0.05, 0.2, 0.05, 0.2, 1, 16, 8),
        COLORS.body,
        0,
        0.5,
      ),
      palm: createPart(
        superellipsoid(0.05, 0.06, 0.03, 0.5, 0.5, 20, 12),
        COLORS.body,
        0,
        0.4,
      ),
      finger: createPart(
        superellipsoid(0.01, 0.03, 0.01, 0.5, 1, 10, 6),
        COLORS.body,
        0,
        0.4,
      ),
      thumb: createPart(
        superellipsoid(0.01, 0.03, 0.014, 0.5, 1, 10, 6),
        COLORS.body,
        0,
        0.4,
      ),
    };

    return sharedMeshes;
  }

  class JakeActor {
    constructor() {
      this.state = { elapsedTime: 0 };
    }

    frame(deltaTime, pose, drawList) {
      this.state.elapsedTime += deltaTime;
      const parts = initMeshes(window.JK.gl);
      const addPart = (part, matrix) => drawList.push([part, matrix, 1]);

      const uniformScale = pose.scale || 0.42;
      const placement = multiply(
        pose.placeMat ||
          Mat4.chain(
            translate(pose.x || 0, pose.y || 0, pose.z || 0),
            rotateY(pose.yaw || 0),
            scale(uniformScale, uniformScale, uniformScale),
          ),
        LOCAL_TRANSFORMS.ground,
      );

      // Badan (ellipsoid kuadrik)
      addPart(parts.body, multiply(placement, LOCAL_TRANSFORMS.body));

      // Kaki dan telapak kaki (dengan sendi lutut IK two-bone)
      BOTH_SIDES.forEach((side, sideIndex) => {
        const legSwing = side === RIGHT ? pose.lr || 0 : pose.ll || 0;
        const kneeBend = Math.max(0, side === RIGHT ? pose.kr || 0 : pose.kl || 0);

        // Hip socket dalam ruang lokal placement
        const hipSocketPos = [side * LEG.x, LEG.topY, 0];
        // Target ankle: diayun di bidang sagital dan ditekuk oleh lutut
        const totalLegLen = LEG.thighLength + LEG.shinLength;
        const effectiveLen = totalLegLen * (1 - 0.25 * Math.sin(kneeBend / 2));
        const ankleTarget = [
          hipSocketPos[0],
          hipSocketPos[1] - Math.cos(legSwing) * effectiveLen,
          Math.sin(legSwing) * effectiveLen - Math.sin(kneeBend) * LEG.shinLength * 0.5,
        ];

        // Pole vector lutut mengarah ke depan (+Z)
        const kneePole = [0, 0, 1];

        const legIK = solveTwoBoneIK(
          hipSocketPos,
          ankleTarget,
          kneePole,
          LEG.thighLength,
          LEG.shinLength,
        );

        const thighFrame = multiply(
          placement,
          orientLimb(hipSocketPos, V3.sub(legIK.E, hipSocketPos)),
        );
        const shinFrame = multiply(
          placement,
          orientLimb(legIK.E, V3.sub(legIK.H, legIK.E)),
        );

        addPart(parts.thigh, multiply(thighFrame, LOCAL_TRANSFORMS.thigh));
        addPart(parts.knee, shinFrame);
        addPart(parts.shin, multiply(shinFrame, LOCAL_TRANSFORMS.shin));

        // Telapak kaki di ujung betis
        const ankleFrame = multiply(shinFrame, LOCAL_TRANSFORMS.ankle);
        addPart(parts.foot, multiply(ankleFrame, multiply(translate(0, 0, 0.15), scale(0.2, 0.15, 0.35))));
      });

      // Mata (kiri dan kanan)
      BOTH_SIDES.forEach((side, sideIndex) => {
        const eyeFrame = multiply(
          placement,
          LOCAL_TRANSFORMS.eyeSocket[sideIndex],
        );
        addPart(parts.eyeRim, multiply(eyeFrame, LOCAL_TRANSFORMS.eyeRim));
        addPart(parts.eyeWhite, multiply(eyeFrame, LOCAL_TRANSFORMS.eyeWhite));
      });

      // Hidung (elliptic paraboloid)
      addPart(parts.nose, multiply(placement, LOCAL_TRANSFORMS.nose));

      // Moncong, senyum mulut, dan telinga
      addPart(parts.jowl, placement);
      addPart(parts.mouth, placement);
      BOTH_SIDES.forEach((side, sideIndex) => {
        addPart(parts.ear[sideIndex], placement);
      });

      // Ekor kerucut di belakang badan
      addPart(parts.tail, multiply(placement, LOCAL_TRANSFORMS.tail));

      // Lengan (IK)
      const armScaledPlacement = multiply(
        placement,
        scale(ARM_SCALE, ARM_SCALE, ARM_SCALE),
      );
      let placementInverse = null;

      BOTH_SIDES.forEach((side, sideIndex) => {
        const shoulderPosition = [
          (side * 1.7 * ARM.shoulderX) / ARM_SCALE,
          ARM.shoulderY / ARM_SCALE,
          0,
        ];
        const armTarget = pose[side === RIGHT ? "armR" : "armL"];

        let handTarget;
        if (armTarget && armTarget.w) {
          placementInverse = placementInverse || Mat4.invert(placement);
          handTarget = Mat4.point(placementInverse, armTarget.w).map(
            (coord) => coord / ARM_SCALE,
          );
        } else if (armTarget && armTarget.l) {
          handTarget = armTarget.l.map((coord) => coord / ARM_SCALE);
        } else {
          handTarget = [shoulderPosition[0] + side, shoulderPosition[1], 0]; 
        }

        const elbowPole = (armTarget && armTarget.pole) || [0, 0, -1];
        const arm = solveTwoBoneIK(shoulderPosition, handTarget, elbowPole);

        const upperArmFrame = multiply(
          armScaledPlacement,
          orientLimb(shoulderPosition, V3.sub(arm.E, shoulderPosition)),
        );
        const forearmFrame = multiply(
          armScaledPlacement,
          orientLimb(arm.E, V3.sub(arm.H, arm.E)),
        );

        addPart(parts.shoulder, upperArmFrame);
        addPart(
          parts.upperArm,
          multiply(upperArmFrame, LOCAL_TRANSFORMS.upperArm),
        );
        addPart(parts.elbow, forearmFrame);
        addPart(
          parts.forearm,
          multiply(forearmFrame, LOCAL_TRANSFORMS.forearm),
        );

        // Tangan dan jari
        const handFrame = multiply(forearmFrame, LOCAL_TRANSFORMS.hand[sideIndex]);
        addPart(parts.palm, handFrame);

        LOCAL_TRANSFORMS.fingerBase.forEach((fingerBase, fingerIndex) => {
          addPart(
            parts.finger,
            multiply(
              multiply(handFrame, fingerBase),
              LOCAL_TRANSFORMS.fingerShape[fingerIndex],
            ),
          );
        });

        addPart(
          parts.thumb,
          multiply(handFrame, LOCAL_TRANSFORMS.thumb[sideIndex]),
        );
      });

      window.AT.shadow(
        drawList,
        placement[12],
        placement[14],
        0.8 * uniformScale,
        0.62 * uniformScale,
      );
    }
  }

  App.actors.JakeActor = JakeActor;
  window.AT = window.AT || {};
  window.AT.JakeActor = JakeActor;
})();
