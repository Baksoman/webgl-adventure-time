(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.actors = App.actors || {};

  const { Mat4, T: translate, S: scale, mul: multiply } = App.math;
  const { MeshCache } = App.gfx;
  const { quadrics } = App.geom;

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
    body: hexToRgb("#45a38a"),
    bezel: hexToRgb("#1f4d45"),
    dark: hexToRgb("#122b29"),
    dpadYellow: hexToRgb("#e0b81f"),
    buttonRed: hexToRgb("#cc244d"),
    buttonCyan: hexToRgb("#1aadc3"),
    buttonGreen: hexToRgb("#1ac224"),
    buttonDarkBlue: hexToRgb("#1a2260"),
    smileLine: hexToRgb("#053728"),
    white: hexToRgb("#ffffff"),
  };

  const SHADE_COLOR = [0.66, 0.54, 0.58];

  const RIGHT = 1;
  const LEFT = -1;
  const BOTH_SIDES = [RIGHT, LEFT];

  // Membuat satu nilai per sisi, urutannya sama dengan BOTH_SIDES
  const forBothSides = (createValue) => BOTH_SIDES.map(createValue);

  // Dimensi dan konstanta anatomi BMO
  const BODY = {
    width: 20,
    height: 30,
    depth: 20,
    cornerRadius: 1.3,
    cornerSegments: 7,
  };

  const FRONT_FACE_Z = 10.35;
  const GROUND_ELEVATION_Y = 9.45;

  const ARM = {
    shoulderX: 10,
    shoulderY: 7,
    upperLength: 5.5,
    forearmLength: 5.7,
  };

  const LEG = {
    hipX: 4.5,
    hipY: 0.4,
    length: 8.8,
    radius: 0.75,
    thighLength: 4.4,
    shinLength: 4.4,
  };

  // Garis senyum BMO: kurva Bezier kubik 3D pada bidang layar (satuan sama dengan layar 15 x 12.5)
  const SMILE = {
    controlPoints: [
      [-2.53, -1.36, 0],
      [-2.0, -3.21, 0],
      [2.0, -3.21, 0],
      [2.53, -1.36, 0],
    ],
    tubeRadius: 0.14,
  };

  const SIDE_SURFACE_X = -BODY.width / 2;

  // Posisi lubang speaker di sisi kanan badan (koordinat Y dan Z), tersusun selang-seling
  const SPEAKER_HOLE_POSITIONS = [
    [27, -1.8],
    [27, 2],
    [24.5, -3.5],
    [24.5, 0.1],
    [24.5, 3.6],
    [22.2, -1.8],
    [22.2, 2],
  ];

  // Skala tangan berartikulasi (jari & jempol) seperti Jake
  const HAND_SCALE = 18;
  const FINGER_OFFSETS_X = [-0.035, 0, 0.035];
  const FINGER_LENGTH_SCALES = [1, 1.1, 1.1];


  // Membuat poligon lingkaran 2D untuk tombol silindris
  function createCirclePolygon(radius, vertexCount) {
    return Array.from({ length: vertexCount }, (_, vertexIndex) => [
      radius * Math.cos((vertexIndex * 2 * Math.PI) / vertexCount),
      radius * Math.sin((vertexIndex * 2 * Math.PI) / vertexCount),
    ]);
  }

  // Membuat mesh bidang datar persegi (quad)
  function createQuadMesh(gl, quadWidth, quadHeight) {
    return App.geom.uploadMesh(
      gl,
      [
        [-quadWidth / 2, -quadHeight / 2, 0],
        [quadWidth / 2, -quadHeight / 2, 0],
        [-quadWidth / 2, quadHeight / 2, 0],
        [quadWidth / 2, quadHeight / 2, 0],
      ],
      [
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
        [0, 0, 1],
      ],
      [0, 1, 2, 1, 3, 2],
    );
  }

  // Transformasi lokal tetap, dihitung sekali saat modul dimuat
  const LOCAL_TRANSFORMS = {
    ground: translate(0, GROUND_ELEVATION_Y, 0),
    body: translate(0, 15, 0),
    bezel: translate(0, 21.25, FRONT_FACE_Z),
    screen: translate(0, 21.25, FRONT_FACE_Z + 0.06),
    screenEyes: [-3.6, 3.6].map((eyeX) =>
      translate(eyeX, 23.0, FRONT_FACE_Z + 0.18),
    ),
    smile: translate(0, 21.25, FRONT_FACE_Z + 0.06),
    cartridgeSlot: translate(-2.2, 12.2, FRONT_FACE_Z + 0.18),
    darkBlueButton: multiply(
      translate(5.4, 12.2, FRONT_FACE_Z + 0.18),
      rotateX(Math.PI / 2),
    ),
    dpadHorizontal: translate(-5.2, 7, FRONT_FACE_Z + 0.18),
    dpadVertical: translate(-5.2, 7, FRONT_FACE_Z + 0.18),
    triangleButton: translate(2.4, 8.2, FRONT_FACE_Z + 0.18),
    redButton: translate(3.5, 4.7, FRONT_FACE_Z + 0.18),
    greenButton: translate(6, 7.5, FRONT_FACE_Z + 0.18),

    lowerPorts: [-6.8, -3.6].map((portX) =>
      multiply(translate(portX, 3, FRONT_FACE_Z + 0.18), rotateZ(Math.PI / 2)),
    ),

    speakerHoles: [SIDE_SURFACE_X, -SIDE_SURFACE_X].flatMap(
      (surfaceX) =>
        SPEAKER_HOLE_POSITIONS.map(([holeY, holeZ]) =>
          translate(surfaceX, holeY, holeZ),
        ),
    ),

    shoulderSocket: forBothSides((side) =>
      translate(side * ARM.shoulderX, ARM.shoulderY, 0),
    ),
    upperArm: translate(0, -ARM.upperLength / 2, 0),
    elbowJoint: translate(0, -ARM.upperLength, 0),
    forearm: translate(0, -ARM.forearmLength / 2, 0),
    // Rotasi Y ±90° agar telapak menghadap ke badan (posisi tetap/diam untuk jalan maupun lari)
    hand: forBothSides((side) => multiply(translate(0, -ARM.forearmLength, 0), rotateY(side * Math.PI / 2))),

    // Tangan berartikulasi seperti Jake (telapak, jari, jempol)
    handScale: scale(HAND_SCALE, HAND_SCALE, HAND_SCALE),
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

    hipSocket: forBothSides((side) =>
      multiply(translate(side * LEG.hipX, LEG.hipY, 0), rotateZ(side * 0.05)),
    ),
    leg: translate(0, -LEG.length / 2, 0),
    thigh: translate(0, -LEG.thighLength / 2, 0),
    kneeJoint: translate(0, -LEG.thighLength, 0),
    shin: translate(0, -LEG.shinLength / 2, 0),
    ankle: translate(0, -LEG.shinLength, 0),
    foot: multiply(translate(0, -LEG.length - 0.3, 1.1), scale(1.2, 0.75, 2)),
  };

  let sharedMeshes = null;

  // Membuat semua mesh sekali saja, lalu dipakai ulang oleh semua instance
  function initMeshes(gl) {
    if (sharedMeshes) return sharedMeshes;
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

    const createPart = (mesh, color, specular = 0.2, outlineWidth = 0.3) => ({
      mesh,
      color,
      spec: specular,
      ow: outlineWidth,
      unlit: false,
      alpha: 1,
      shade: SHADE_COLOR,
    });

    const bodyMesh = MeshCache.get("bmo_body", () =>
      quadrics.roundedBoxMesh(
        gl,
        BODY.width,
        BODY.height,
        BODY.depth,
        BODY.cornerRadius,
        BODY.cornerSegments,
      ),
    );
    const bezelMesh = MeshCache.get("bmo_bezel", () =>
      createQuadMesh(gl, 16.2, 13.6),
    );
    const screenQuadMesh = MeshCache.get("bmo_screen", () =>
      createQuadMesh(gl, 15, 12.5),
    );

    const screenPart = {
      mesh: screenQuadMesh,
      ow: 0,
      alpha: 1,
      unlit: true,
      color: hexToRgb("#b4ffc8"),
      spec: 0,
    };

    const slotMesh = MeshCache.get("bmo_slot", () =>
      quadrics.roundedBoxMesh(gl, 10.5, 1.1, 0.5, 0.2, 3),
    );
    const dpadHorizontalMesh = MeshCache.get("bmo_dpad_h", () =>
      quadrics.roundedBoxMesh(gl, 4.6, 1.5, 0.7, 0.3, 3),
    );
    const dpadVerticalMesh = MeshCache.get("bmo_dpad_v", () =>
      quadrics.roundedBoxMesh(gl, 1.5, 4.6, 0.7, 0.3, 3),
    );

    const triangleButtonMesh = MeshCache.get("bmo_tri_btn", () =>
      quadrics.prismMesh(
        gl,
        [
          [-1, -0.8],
          [1, -0.8],
          [0, 1],
        ],
        0.6,
        false,
      ),
    );
    const redButtonMesh = MeshCache.get("bmo_red_btn", () =>
      quadrics.prismMesh(gl, createCirclePolygon(1.5, 32), 0.6, true),
    );
    const greenButtonMesh = MeshCache.get("bmo_grn_btn", () =>
      quadrics.prismMesh(gl, createCirclePolygon(0.6, 28), 0.6, true),
    );
    const darkBlueButtonMesh = MeshCache.get("bmo_dark_blue_btn", () =>
      quadrics.ellipticParaboloidMesh(gl, 0.8, 0.8, 0.5, 24, 10),
    );
    const lowerPortMesh = MeshCache.get("bmo_lower_port", () =>
      quadrics.hyperboloidMesh(gl, 0.35, 0.2, 1.4, 0.6, 24, 8),
    );
    const smileMesh = MeshCache.get("bmo_smile", () =>
      App.geom.curves.bezierTubeMesh(gl, {
        controlPoints: SMILE.controlPoints,
        radius: SMILE.tubeRadius,
        capLen: SMILE.tubeRadius,
      }),
    );
    sharedMeshes = {
      body: createPart(bodyMesh, COLORS.body, 0.2, 0.55),
      bezel: createPart(bezelMesh, COLORS.bezel, 0.1, 0),
      screen: screenPart,
      screenEye: {
        ...createPart(ellipsoid(0.48, 0.6, 0.12, 24, 16), COLORS.smileLine, 0, 0),
        unlit: true,
      },
      cartridgeSlot: createPart(slotMesh, COLORS.dark, 0, 0.3),
      smile: createPart(smileMesh, COLORS.smileLine, 0, 0),
      darkBlueButton: createPart(
        darkBlueButtonMesh,
        COLORS.buttonDarkBlue,
        0.6,
        0.3,
      ),
      lowerPort: createPart(lowerPortMesh, COLORS.buttonDarkBlue, 0.3, 0.3),
      dpadHorizontal: createPart(
        dpadHorizontalMesh,
        COLORS.dpadYellow,
        0.4,
        0.3,
      ),
      dpadVertical: createPart(dpadVerticalMesh, COLORS.dpadYellow, 0.4, 0.3),
      triangleButton: createPart(
        triangleButtonMesh,
        COLORS.buttonCyan,
        0.5,
        0.3,
      ),
      redButton: createPart(redButtonMesh, COLORS.buttonRed, 0.6, 0.3),
      greenButton: createPart(greenButtonMesh, COLORS.buttonGreen, 0.6, 0.3),
      // Lubang speaker berupa ellipsoid pipih gelap
      speakerHole: createPart(
        ellipsoid(0.15, 0.4, 0.4, 16, 10),
        COLORS.dark,
        0,
        0.2,
      ),

      // Objek lengan dan tangan seperti Jake (superellipsoid + 3 jari + jempol)
      shoulderJoint: createPart(
        ellipsoid(1.0, 1.0, 1.0, 16, 12),
        COLORS.body,
        0.2,
        0.3,
      ),
      upperArm: createPart(
        superellipsoid(0.65, ARM.upperLength / 2, 0.65, 0.2, 1, 16, 8),
        COLORS.body,
        0.2,
        0.3,
      ),
      elbowJoint: createPart(
        ellipsoid(0.66, 0.66, 0.66, 16, 10),
        COLORS.body,
        0.2,
        0.3,
      ),
      forearm: createPart(
        superellipsoid(0.65, ARM.forearmLength / 2, 0.65, 0.2, 1, 16, 8),
        COLORS.body,
        0.2,
        0.3,
      ),
      palm: createPart(
        superellipsoid(0.05, 0.06, 0.03, 0.5, 0.5, 20, 12),
        COLORS.body,
        0.2,
        0.3,
      ),
      finger: createPart(
        superellipsoid(0.01, 0.03, 0.01, 0.5, 1, 10, 6),
        COLORS.body,
        0.2,
        0.3,
      ),
      thumb: createPart(
        superellipsoid(0.01, 0.03, 0.014, 0.5, 1, 10, 6),
        COLORS.body,
        0.2,
        0.3,
      ),

      // Objek kaki dengan sendi lutut — paha, sendi, betis, dan telapak
      leg: createPart(
        superellipsoid(LEG.radius, LEG.length / 2, LEG.radius, 0.2, 1, 16, 8),
        COLORS.body,
        0.2,
        0.3,
      ),
      thigh: createPart(
        superellipsoid(
          LEG.radius,
          LEG.thighLength / 2,
          LEG.radius,
          0.2,
          1,
          16,
          8,
        ),
        COLORS.body,
        0.2,
        0.3,
      ),
      kneeJoint: createPart(
        ellipsoid(LEG.radius, LEG.radius, LEG.radius, 16, 10),
        COLORS.body,
        0.2,
        0.3,
      ),
      shin: createPart(
        superellipsoid(
          LEG.radius,
          LEG.shinLength / 2,
          LEG.radius,
          0.2,
          1,
          16,
          8,
        ),
        COLORS.body,
        0.2,
        0.3,
      ),
      foot: createPart(
        MeshCache.get("sphere_jake", () => quadrics.sphereMesh(gl, 32, 24)),
        COLORS.body,
        0.2,
        0.4,
      ),
    };

    return sharedMeshes;
  }

  class BMOActor {
    constructor() {
      this.state = { elapsedTime: 0 };
    }

    frame(deltaTime, pose, drawList) {
      this.state.elapsedTime += deltaTime;
      const parts = initMeshes(window.JK.gl);
      const addPart = (part, matrix) => drawList.push([part, matrix, 1]);

      const uniformScale = pose.scale || 0.034;
      const poseData = pose.pose || {
        abdL: 0.45,
        abdR: 0.45,
        swL: 0,
        swR: 0,
        elbL: 0.3,
        elbR: 0.3,
        legL: 0,
        legR: 0,
        kneeL: 0.1,
        kneeR: 0.1,
      };

      const placement = multiply(
        pose.placeMat ||
          Mat4.chain(
            translate(pose.x || 0, pose.y || 0, pose.z || 0),
            rotateY(pose.yaw || 0),
            rotateZ(pose.sway || 0),
            scale(uniformScale, uniformScale, uniformScale),
          ),
        LOCAL_TRANSFORMS.ground,
      );

      // Statis badan utama dan tombol depan
      addPart(parts.body, multiply(placement, LOCAL_TRANSFORMS.body));
      addPart(parts.bezel, multiply(placement, LOCAL_TRANSFORMS.bezel));
      addPart(parts.screen, multiply(placement, LOCAL_TRANSFORMS.screen));
      LOCAL_TRANSFORMS.screenEyes.forEach((eyeTransform) => {
        addPart(parts.screenEye, multiply(placement, eyeTransform));
      });
      addPart(parts.smile, multiply(placement, LOCAL_TRANSFORMS.smile));
      addPart(
        parts.cartridgeSlot,
        multiply(placement, LOCAL_TRANSFORMS.cartridgeSlot),
      );
      addPart(
        parts.darkBlueButton,
        multiply(placement, LOCAL_TRANSFORMS.darkBlueButton),
      );
      addPart(
        parts.dpadHorizontal,
        multiply(placement, LOCAL_TRANSFORMS.dpadHorizontal),
      );
      addPart(
        parts.dpadVertical,
        multiply(placement, LOCAL_TRANSFORMS.dpadVertical),
      );
      addPart(
        parts.triangleButton,
        multiply(placement, LOCAL_TRANSFORMS.triangleButton),
      );
      addPart(parts.redButton, multiply(placement, LOCAL_TRANSFORMS.redButton));
      addPart(
        parts.greenButton,
        multiply(placement, LOCAL_TRANSFORMS.greenButton),
      );

      // Dua slot port di bawah D-pad
      LOCAL_TRANSFORMS.lowerPorts.forEach((portTransform) => {
        addPart(parts.lowerPort, multiply(placement, portTransform));
      });

      // Lubang speaker di sisi badan
      LOCAL_TRANSFORMS.speakerHoles.forEach((holeTransform) => {
        addPart(parts.speakerHole, multiply(placement, holeTransform));
      });

      // Lengan dirakit dengan rotasi bahu dan siku, tanpa IK.
      BOTH_SIDES.forEach((side, sideIndex) => {
        const armTarget = pose[side === RIGHT ? "armR" : "armL"] || {};
        const shoulderAngle = armTarget.raise ?? armTarget.swing ?? 0;
        const shoulderFrame = multiply(
          placement,
          multiply(
            LOCAL_TRANSFORMS.shoulderSocket[sideIndex],
            multiply(
              rotateZ(armTarget.outward || 0),
              rotateX(-shoulderAngle),
            ),
          ),
        );
        const forearmFrame = multiply(
          shoulderFrame,
          multiply(
            translate(0, -ARM.upperLength, 0),
            rotateX(armTarget.elbow || 0),
          ),
        );

        addPart(parts.shoulderJoint, shoulderFrame);
        addPart(parts.upperArm, multiply(shoulderFrame, LOCAL_TRANSFORMS.upperArm));
        addPart(parts.elbowJoint, forearmFrame);
        addPart(parts.forearm, multiply(forearmFrame, LOCAL_TRANSFORMS.forearm));
        const handFrame = multiply(forearmFrame, LOCAL_TRANSFORMS.hand[sideIndex]);
        const scaledHandFrame = multiply(handFrame, LOCAL_TRANSFORMS.handScale);
        addPart(parts.palm, scaledHandFrame);
        LOCAL_TRANSFORMS.fingerBase.forEach((fingerBase, fingerIndex) => {
          addPart(
            parts.finger,
            multiply(
              multiply(scaledHandFrame, fingerBase),
              LOCAL_TRANSFORMS.fingerShape[fingerIndex],
            ),
          );
        });
        addPart(parts.thumb, multiply(scaledHandFrame, LOCAL_TRANSFORMS.thumb[sideIndex]));
      });

      // Kaki dirakit dengan rotasi panggul dan lutut, tanpa IK.
      BOTH_SIDES.forEach((side, sideIndex) => {
        const sideKey = side === RIGHT ? "R" : "L";
        const legSwing = pose.lr !== undefined
          ? (side === RIGHT ? pose.lr || 0 : pose.ll || 0)
          : (poseData["leg" + sideKey] || 0);
        const kneeBend = Math.max(
          0,
          pose.kr !== undefined
            ? (side === RIGHT ? pose.kr || 0 : pose.kl || 0)
            : (poseData["knee" + sideKey] || 0),
        );
        const hipFrame = multiply(
          placement,
          multiply(LOCAL_TRANSFORMS.hipSocket[sideIndex], rotateX(-legSwing)),
        );
        const kneeFrame = multiply(
          hipFrame,
          multiply(
            translate(0, -LEG.thighLength, 0),
            rotateX(-kneeBend),
          ),
        );

        addPart(parts.thigh, multiply(hipFrame, LOCAL_TRANSFORMS.thigh));
        addPart(parts.kneeJoint, kneeFrame);
        addPart(parts.shin, multiply(kneeFrame, LOCAL_TRANSFORMS.shin));
        const ankleFrame = multiply(kneeFrame, LOCAL_TRANSFORMS.ankle);
        addPart(
          parts.foot,
          multiply(
            ankleFrame,
            multiply(translate(0, -0.3, 1.1), scale(1.2, 0.75, 2)),
          ),
        );
      });

      // Bayangan kontak tanah
      window.AT.shadow(
        drawList,
        placement[12],
        placement[14],
        0.55 * (uniformScale / 0.034),
        0.42 * (uniformScale / 0.034),
      );
    }
  }

  App.actors.BMOActor = BMOActor;
  window.AT = window.AT || {};
  window.AT.BMOActor = BMOActor;
})();
