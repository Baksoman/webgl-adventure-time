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
    skin: hexToRgb("#f8cfb0"),
    limbSkin: hexToRgb("#f4d2b8"),
    hat: hexToRgb("#f2f3f7"),
    shirt: hexToRgb("#1a8ee0"),
    shorts: hexToRgb("#1b55c2"),
    sock: hexToRgb("#ffffff"),
    shoe: hexToRgb("#131316"),
    backpackGreen: hexToRgb("#4fae3a"),
    backpackLightGreen: hexToRgb("#a6e48f"),
    backpackStrap: hexToRgb("#7fd04c"),
    mouthInner: hexToRgb("#8a1f2b"),
    nearBlack: hexToRgb("#0c0c0e"),
  };

  const SHADE_COLOR = [0.66, 0.54, 0.58];

  const RIGHT = 1;
  const LEFT = -1;
  const BOTH_SIDES = [RIGHT, LEFT];

  // Membuat satu nilai per sisi, urutannya sama dengan BOTH_SIDES
  const forBothSides = (createValue) => BOTH_SIDES.map(createValue);

  const HIP_PIVOT_HEIGHT = 1.5;
  const NECK_PIVOT_HEIGHT = 2.2;
  const SHOULDER = { x: 0.39, y: 2.15 };

  // Dimensi segmen kaki untuk IK dua tulang
  const LEG_IK = {
    hipX: 0.29,
    hipY: HIP_PIVOT_HEIGHT + 0.05, // dalam koordinat lokal relatif placement
    thighLength: 0.56,
    shinLength: 0.56,
  };

  // Garis pembagi warna tas (0 = dasar, 1 = puncak)
  const BACKPACK_COLOR_SPLIT = 0.52;

  const FACE_RADII = { x: 0.26, y: 0.22, z: 0.11 };
  const MOUTH = {
    centerY: -0.065,
    halfWidth: 0.085,
    openingHeight: 0.025,
    outlineThickness: 0.002,
  };
  // Titik kontrol Bezier setinggi 1.33 x tinggi membuat puncak kurva tepat setinggi itu
  const BEZIER_CONTROL_SCALE = 1.33;

  const HAT_EAR = {
    x: 0.27,
    y: 2.74,
    radius: 0.07,
    height: 0.1,
    capHeight: 0.045,
  };

  const FINGER_OFFSETS_X = [-0.035, 0, 0.035];
  const FINGER_LENGTH_SCALES = [1, 1.1, 1.1];

  // Transformasi lokal tetap, dihitung sekali saat modul dimuat
  const LOCAL_TRANSFORMS = {
    // Agar telapak sepatu menapak tepat di y = 0
    ground: translate(0, -0.215, 0),

    hipPivot: translate(0, HIP_PIVOT_HEIGHT, 0),
    hipPivotInverse: translate(0, -HIP_PIVOT_HEIGHT, 0),
    hipSocket: forBothSides((side) => translate(side * 0.29, 0.05, 0)),
    thigh: translate(0, -LEG_IK.thighLength / 2, 0),
    shin: translate(0, -LEG_IK.shinLength / 2, 0),
    shorts: translate(0, -0.175, 0),
    ankle: translate(0, -LEG_IK.shinLength, 0),
    shoe: translate(0, -0.1, 0.05),

    torso: translate(0, 1.88, 0),
    backpack: translate(0, 2, -0.35),
    backpackDetail: translate(0, 2.15, -0.52),
    backpackStrap: forBothSides((side) =>
      multiply(translate(side * 0.38, 2.1, -0.13), rotateY(side * 0.2)),
    ),

    sleeve: translate(0, -0.085, 0),
    upperArm: translate(0, -0.335, 0),
    forearm: translate(0, -0.2, 0),
    hand: translate(0, -0.42, 0),
    // Pangkal jari = titik putar jari
    fingerBase: FINGER_OFFSETS_X.map((offsetX) => translate(offsetX, -0.05, 0)),
    fingerShape: FINGER_LENGTH_SCALES.map((lengthScale) =>
      multiply(scale(1, lengthScale, 1), translate(0, -0.03, 0)),
    ),
    thumb: forBothSides((side) =>
      multiply(
        translate(side * 0.045, 0.01, 0.01),
        multiply(rotateZ(side * 0.8), translate(0, -0.025, 0)),
      ),
    ),

    neckPivot: translate(0, NECK_PIVOT_HEIGHT, 0),
    neckPivotInverse: translate(0, -NECK_PIVOT_HEIGHT, 0),
    hat: translate(0, 2.48, 0),
    hatEarBase: forBothSides((side) =>
      translate(side * HAT_EAR.x, HAT_EAR.y, 0),
    ),
    hatEarCap: forBothSides((side) =>
      translate(side * HAT_EAR.x, HAT_EAR.y + HAT_EAR.height, 0),
    ),

    face: translate(0, 2.45, 0.18),
    eye: forBothSides((side) => translate(side * 0.1, 0.07, 0.085)),
    mouthPivot: translate(0, MOUTH.centerY, 0),
    mouthPivotInverse: translate(0, -MOUTH.centerY, 0),
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

    // Oval = dua kurva Bezier (atas dan bawah) yang bertemu di kedua sisi
    const createOvalCurves = (halfWidth, height) => {
      const peakOffset = BEZIER_CONTROL_SCALE * height;
      const baseY = MOUTH.centerY;
      return {
        upper: [
          [-halfWidth, baseY],
          [-halfWidth, baseY + peakOffset],
          [halfWidth, baseY + peakOffset],
          [halfWidth, baseY],
        ],
        lower: [
          [-halfWidth, baseY],
          [-halfWidth, baseY - peakOffset],
          [halfWidth, baseY - peakOffset],
          [halfWidth, baseY],
        ],
      };
    };
    const mouthInnerOval = createOvalCurves(
      MOUTH.halfWidth,
      MOUTH.openingHeight,
    );
    const mouthOutlineOval = createOvalCurves(
      MOUTH.halfWidth + MOUTH.outlineThickness,
      MOUTH.openingHeight + MOUTH.outlineThickness,
    );

    sharedMeshes = {
      leg: createPart(
        superellipsoid(0.05, 0.415, 0.05, 0.2, 1, 16, 10),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      // Paha dan betis (segmen kaki yang dipisah oleh sendi lutut IK)
      thigh: createPart(
        superellipsoid(0.05, LEG_IK.thighLength / 2, 0.05, 0.2, 1, 16, 10),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      shin: createPart(
        superellipsoid(0.05, LEG_IK.shinLength / 2, 0.05, 0.2, 1, 16, 10),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      knee: createPart(
        ellipsoid(0.05, 0.05, 0.05, 16, 10),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      sock: createPart(
        superellipsoid(0.055, 0.1, 0.055, 0.2, 1, 20, 10),
        COLORS.sock,
        0.1,
        0.45,
      ),
      // Ellipsoid yang diskala lonjong ke depan (sumbu Z)
      shoe: createPart(
        ellipsoid(0.08, 0.06, 0.15),
        COLORS.shoe,
        0.4,
        0.45,
      ),
      shorts: createPart(
        MeshCache.get("hyp_short", () =>
          quadrics.hyperboloidMesh(gl, 0.05, 0.05, 0.3, 0.4),
        ),
        COLORS.shorts,
        0.1,
        0.55,
      ),
      pelvis: createPart(
        superellipsoid(0.39, 0.12, 0.21, 0.9, 1),
        COLORS.shorts,
        0.1,
        0.55,
      ),

      torso: createPart(
        superellipsoid(0.4, 0.38, 0.22, 0.18, 1, 36, 14),
        COLORS.shirt,
        0.1,
        0.55,
      ),
      // Dua mesh tas dengan rentang lintang berurutan, menyambung di cincin yang sama
      backpackUpper: createPart(
        superellipsoid(
          0.4,
          0.37,
          0.2,
          0.85,
          0.85,
          32,
          14,
          BACKPACK_COLOR_SPLIT,
          1,
        ),
        COLORS.backpackLightGreen,
        0.1,
        0.55,
      ),
      backpackLower: createPart(
        superellipsoid(
          0.4,
          0.37,
          0.2,
          0.85,
          0.85,
          32,
          14,
          0,
          BACKPACK_COLOR_SPLIT,
        ),
        COLORS.backpackGreen,
        0.1,
        0.55,
      ),
      backpackDetail: createPart(
        ellipsoid(0.04, 0.04, 0.05),
        COLORS.nearBlack,
        0.2,
        0.5,
      ),
      backpackStrap: createPart(
        MeshCache.get("torus_strap", () =>
          quadrics.torusMesh(gl, 0.2, 0.15, 0.03),
        ),
        COLORS.backpackStrap,
        0.2,
        0.36,
      ),

      shoulder: createPart(
        ellipsoid(0.05, 0.075, 0.05, 20, 12),
        COLORS.shirt,
        0.1,
        0.45,
      ),
      sleeve: createPart(
        superellipsoid(0.05, 0.09, 0.05, 0.2, 1, 20, 8),
        COLORS.shirt,
        0.1,
        0.45,
      ),
      upperArm: createPart(
        superellipsoid(0.05, 0.17, 0.05, 0.2, 1, 16, 8),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      elbow: createPart(
        ellipsoid(0.05, 0.05, 0.05, 16, 10),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      forearm: createPart(
        superellipsoid(0.05, 0.2, 0.05, 0.2, 1, 16, 8),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      palm: createPart(
        superellipsoid(0.05, 0.06, 0.03, 0.5, 0.5, 20, 12),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      finger: createPart(
        superellipsoid(0.01, 0.03, 0.01, 0.5, 1, 10, 6),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      thumb: createPart(
        superellipsoid(0.01, 0.03, 0.014, 0.5, 1, 10, 6),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),

      neck: createPart(
        superellipsoid(0.09, 0.1, 0.09, 0.3, 1, 16, 8),
        COLORS.limbSkin,
        0.1,
        0.36,
      ),
      hat: createPart(
        superellipsoid(0.36, 0.3, 0.22, 0.22, 0.7, 40, 56),
        COLORS.hat,
        0.25,
        0.64,
      ),
      // Telinga topi = tabung silinder di bawah + kubah paraboloid di atas
      hatEarBase: createPart(
        MeshCache.get("ear_base_cyl", () =>
          quadrics.cylinderYMesh(gl, HAT_EAR.radius, HAT_EAR.height, 28, 4),
        ),
        COLORS.hat,
        0.25,
        0.55,
      ),
      hatEarCap: createPart(
        MeshCache.get("ear_cap_para", () =>
          quadrics.ellipticParaboloidMesh(
            gl,
            HAT_EAR.radius,
            HAT_EAR.radius,
            HAT_EAR.capHeight,
            28,
            12,
          ),
        ),
        COLORS.hat,
        0.25,
        0.55,
      ),

      face: createPart(
        ellipsoid(FACE_RADII.x, FACE_RADII.y, FACE_RADII.z, 40, 24),
        COLORS.skin,
        0.2,
        0.45,
      ),
      eye: createPart(
        ellipsoid(0.022, 0.034, 0.025, 12, 8),
        COLORS.nearBlack,
        0.6,
        0,
      ),
      mouthOutline: createPart(
        MeshCache.get("patch_mout", () =>
          curves.bezierPatchMesh(
            gl,
            mouthOutlineOval.upper,
            mouthOutlineOval.lower,
            0.004,
            FACE_RADII.x,
            FACE_RADII.y,
            FACE_RADII.z,
            true, // tanpa pelebaran span, karena tepi sudah lebih besar
          ),
        ),
        COLORS.nearBlack,
        0,
        0,
      ),
      mouthInner: createPart(
        MeshCache.get("patch_min", () =>
          curves.bezierPatchMesh(
            gl,
            mouthInnerOval.upper,
            mouthInnerOval.lower,
            0.012,
            FACE_RADII.x,
            FACE_RADII.y,
            FACE_RADII.z,
            true,
          ),
        ),
        COLORS.mouthInner,
        0.2,
        0,
      ),
    };

    return sharedMeshes;
  }

  class FinnActor {
    constructor() {
      this.state = { elapsedTime: 0 };
    }

    frame(deltaTime, pose, drawList) {
      this.state.elapsedTime += deltaTime;
      const parts = initMeshes(window.JK.gl);
      const addPart = (part, matrix) => drawList.push([part, matrix, 1]);

      const uniformScale = pose.scale || 1;
      const placement = multiply(
        pose.placeMat ||
          Mat4.chain(
            translate(pose.x || 0, pose.y || 0, pose.z || 0),
            rotateY(pose.yaw || 0),
            scale(uniformScale, uniformScale, uniformScale),
          ),
        LOCAL_TRANSFORMS.ground,
      );

      const hipRoot = multiply(
        placement,
        multiply(translate(0, pose.bob || 0, 0), LOCAL_TRANSFORMS.hipPivot),
      );
      const torsoFrame = Mat4.chain(
        hipRoot,
        rotateY(pose.twist || 0),
        rotateX(pose.lean || 0),
        rotateZ(pose.sway || 0),
        LOCAL_TRANSFORMS.hipPivotInverse,
      );

      addPart(parts.pelvis, hipRoot);
      BOTH_SIDES.forEach((side, sideIndex) => {
        const legSwing = side === RIGHT ? pose.lr || 0 : pose.ll || 0;
        const kneeBend = Math.max(0, side === RIGHT ? pose.kr || 0 : pose.kl || 0);

        // Posisi hip socket dalam ruang lokal (relatif terhadap hipRoot)
        const hipSocketPos = [side * LEG_IK.hipX, 0, 0];

        // Target ankle: diayun di bidang sagital (rotasi X -> Y & Z) dan ditekuk oleh lutut
        const totalLegLen = LEG_IK.thighLength + LEG_IK.shinLength;
        const effectiveLen = totalLegLen * (1 - 0.25 * Math.sin(kneeBend / 2));
        const defaultAnkleLocal = [
          hipSocketPos[0],
          -Math.cos(legSwing) * effectiveLen,
          Math.sin(legSwing) * effectiveLen - Math.sin(kneeBend) * LEG_IK.shinLength * 0.5,
        ];

        // Pole vector lutut mengarah ke depan (+Z)
        const kneePole = [0, 0, 1];

        const legIK = solveTwoBoneIK(
          hipSocketPos,
          defaultAnkleLocal,
          kneePole,
          LEG_IK.thighLength,
          LEG_IK.shinLength,
        );

        // Frame paha: dari hip socket ke lutut
        const thighFrame = multiply(
          hipRoot,
          orientLimb(hipSocketPos, V3.sub(legIK.E, hipSocketPos)),
        );
        // Frame betis: dari lutut ke ankle
        const shinFrame = multiply(
          hipRoot,
          orientLimb(legIK.E, V3.sub(legIK.H, legIK.E)),
        );

        addPart(parts.thigh, multiply(thighFrame, LOCAL_TRANSFORMS.thigh));
        addPart(parts.knee, shinFrame);
        addPart(parts.shin, multiply(shinFrame, LOCAL_TRANSFORMS.shin));
        addPart(parts.shorts, multiply(thighFrame, LOCAL_TRANSFORMS.shorts));

        // Ankle = ujung betis
        const ankleFrame = multiply(shinFrame, LOCAL_TRANSFORMS.ankle);
        addPart(parts.sock, ankleFrame);
        addPart(parts.shoe, multiply(ankleFrame, LOCAL_TRANSFORMS.shoe));
      });

      addPart(parts.torso, multiply(torsoFrame, LOCAL_TRANSFORMS.torso));
      const backpackFrame = multiply(torsoFrame, LOCAL_TRANSFORMS.backpack);
      addPart(parts.backpackUpper, backpackFrame);
      addPart(parts.backpackLower, backpackFrame);
      addPart(
        parts.backpackDetail,
        multiply(torsoFrame, LOCAL_TRANSFORMS.backpackDetail),
      );
      BOTH_SIDES.forEach((side, sideIndex) => {
        addPart(
          parts.backpackStrap,
          multiply(torsoFrame, LOCAL_TRANSFORMS.backpackStrap[sideIndex]),
        );
      });

      let torsoFrameInverse = null;
      BOTH_SIDES.forEach((side, sideIndex) => {
        const shoulderPosition = [side * SHOULDER.x, SHOULDER.y, 0];
        const armTarget = pose[side === RIGHT ? "armR" : "armL"];

        let handTarget;
        if (armTarget && armTarget.w) {
          torsoFrameInverse = torsoFrameInverse || Mat4.invert(torsoFrame);
          handTarget = Mat4.point(torsoFrameInverse, armTarget.w);
        } else if (armTarget && armTarget.l) {
          handTarget = armTarget.l;
        } else {
          handTarget = [
            shoulderPosition[0] + side * 0.1,
            shoulderPosition[1] - 0.9,
            shoulderPosition[2] + 0.03,
          ];
        }
        const elbowPole = (armTarget && armTarget.pole) || [
          side * 0.5,
          -0.3,
          -0.7,
        ];

        const arm = solveTwoBoneIK(shoulderPosition, handTarget, elbowPole);
        const upperArmFrame = multiply(
          torsoFrame,
          orientLimb(shoulderPosition, V3.sub(arm.E, shoulderPosition)),
        );
        const forearmFrame = multiply(
          torsoFrame,
          orientLimb(arm.E, V3.sub(arm.H, arm.E)),
        );

        addPart(parts.shoulder, upperArmFrame);
        addPart(parts.sleeve, multiply(upperArmFrame, LOCAL_TRANSFORMS.sleeve));
        addPart(
          parts.upperArm,
          multiply(upperArmFrame, LOCAL_TRANSFORMS.upperArm),
        );
        addPart(parts.elbow, forearmFrame);
        addPart(
          parts.forearm,
          multiply(forearmFrame, LOCAL_TRANSFORMS.forearm),
        );

        const handFrame = multiply(forearmFrame, LOCAL_TRANSFORMS.hand);
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

      const headFrame = Mat4.chain(
        torsoFrame,
        LOCAL_TRANSFORMS.neckPivot,
        rotateY(pose.hy || 0),
        rotateZ(pose.ht || 0),
        rotateX(pose.hp || 0),
        LOCAL_TRANSFORMS.neckPivotInverse,
      );
      addPart(parts.neck, multiply(headFrame, LOCAL_TRANSFORMS.neckPivot));
      addPart(parts.hat, multiply(headFrame, LOCAL_TRANSFORMS.hat));
      BOTH_SIDES.forEach((side, sideIndex) => {
        addPart(
          parts.hatEarBase,
          multiply(headFrame, LOCAL_TRANSFORMS.hatEarBase[sideIndex]),
        );
        addPart(
          parts.hatEarCap,
          multiply(headFrame, LOCAL_TRANSFORMS.hatEarCap[sideIndex]),
        );
      });

      const faceFrame = multiply(headFrame, LOCAL_TRANSFORMS.face);
      addPart(parts.face, faceFrame);
      BOTH_SIDES.forEach((side, sideIndex) => {
        addPart(
          parts.eye,
          multiply(faceFrame, LOCAL_TRANSFORMS.eye[sideIndex]),
        );
      });

      const mouthFrame = Mat4.chain(
        faceFrame,
        LOCAL_TRANSFORMS.mouthPivot,
        scale(1, pose.mouth || 1, 1),
        LOCAL_TRANSFORMS.mouthPivotInverse,
      );
      addPart(parts.mouthOutline, mouthFrame);
      addPart(parts.mouthInner, mouthFrame);

      window.AT.shadow(
        drawList,
        placement[12],
        placement[14],
        0.5 * uniformScale,
        0.38 * uniformScale,
      );
    }
  }

  App.actors.FinnActor = FinnActor;
  window.AT = window.AT || {};
  window.AT.FinnActor = FinnActor;
})();