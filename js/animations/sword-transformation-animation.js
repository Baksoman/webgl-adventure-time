(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const FULL_TURN = Math.PI * 2;

  const CHARACTER_SETTINGS = {
    finn: { startPosition: [-1.6, 0, 0], yaw: 0, scale: 1.0 },
    jake: { startPosition: [1.6, 0, 0], yaw: 0, scale: 0.42 },
  };

  const SWORD_SETTINGS = {
    widthScale: 1,
    depthScale: 0.3,
    heightScale: 0.7,
    hoverHeight: 0.8,
    jumpSpinTurns: 1,
    heldForwardTilt: 0.5,
    heldLeftTilt: 0.35,
    bladeRollAngle: Math.PI / -1.5,
  };

  const SQUASH_SETTINGS = { widthScale: 1.18, heightScale: 0.78 };

  const HELD_SWORD_SETTINGS = {
    feetOffsetFromFinn: [0, 1.05, 0.2],
    rightGripFromFeet: [0.04, 0.3, 0],
    leftGripFromFeet: [-0.04, 0.46, 0],
    impactDipDistance: 0.22,
  };

  const FINN_ARM_SETTINGS = {
    rightRestOffset: [0.45, 0.9, 0.15],
    leftRestOffset: [-0.45, 0.9, 0.15],
    rightElbowDirection: [1, -0.6, -0.3],
    leftElbowDirection: [-1, -0.6, -0.3],
  };

  const FINN_BODY_SETTINGS = {
    shoulderHeight: 2.15,
    shoulderHalfWidth: 0.39,
    minimumFrontDistance: 0.6,
    extraReachDistance: 0.03,
    fullBlendAngle: 0.5,
    correctionIterationCount: 10,
  };

  const SWING_SETTINGS = {
    rotationAxis: [-1, 1, 0.3],
    pivotOffsetFromFinn: [0, 1.25, -0.25],
    windupAngle: 1.0,
    slashEndAngle: -1.3,
    bodyTwistRatio: 0.55,
  };

  // Menginterpolasi nilai dari start ke end secara linear
  function linearInterpolate(start, end, factor) {
    return start + (end - start) * factor;
  }

  // Menginterpolasi posisi 3D dari array start ke array end
  function interpolatePosition(start, end, factor) {
    return [
      linearInterpolate(start[0], end[0], factor),
      linearInterpolate(start[1], end[1], factor),
      linearInterpolate(start[2], end[2], factor),
    ];
  }

  // Menjumlahkan posisi 3D dengan offset 3D
  function addOffset(position, offset) {
    return [
      position[0] + offset[0],
      position[1] + offset[1],
      position[2] + offset[2],
    ];
  }

  // Mengurangkan posisi 3D dengan posisi 3D lain
  function subtractPosition(position, otherPosition) {
    return [
      position[0] - otherPosition[0],
      position[1] - otherPosition[1],
      position[2] - otherPosition[2],
    ];
  }

  // Mengalikan vektor 3D dengan sebuah angka
  function scaleVector(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
  }

  // Menghitung panjang vektor 3D
  function calculateVectorLength(vector) {
    return Math.hypot(vector[0], vector[1], vector[2]);
  }

  // Menghitung hasil kali titik dua vektor 3D
  function calculateDotProduct(firstVector, secondVector) {
    return (
      firstVector[0] * secondVector[0] +
      firstVector[1] * secondVector[1] +
      firstVector[2] * secondVector[2]
    );
  }

  // Memutar vektor 3D mengelilingi sumbu Y dengan arah yang sama seperti Matrix4.rotationY
  function rotateVectorAroundYAxis(vector, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      vector[0] * cosine + vector[2] * sine,
      vector[1],
      -vector[0] * sine + vector[2] * cosine,
    ];
  }

  // Memutar offset 3D mengikuti kemiringan pedang: condong ke kiri (+X) lalu condong ke depan (+Z)
  function rotateOffsetByTilt(offset, forwardTilt, leftTilt) {
    const leftAngle = -leftTilt;
    const leftCosine = Math.cos(leftAngle);
    const leftSine = Math.sin(leftAngle);
    const leanedX = offset[0] * leftCosine - offset[1] * leftSine;
    const leanedY = offset[0] * leftSine + offset[1] * leftCosine;

    const forwardCosine = Math.cos(forwardTilt);
    const forwardSine = Math.sin(forwardTilt);
    return [
      leanedX,
      leanedY * forwardCosine - offset[2] * forwardSine,
      leanedY * forwardSine + offset[2] * forwardCosine,
    ];
  }

  // Membuat matriks rotasi 4x4 (kolom-utama) mengelilingi sumbu sembarang lewat rumus Rodrigues
  function createAxisRotationMatrix(rotationAxis, angle) {
    const axisLength = Math.hypot(
      rotationAxis[0],
      rotationAxis[1],
      rotationAxis[2],
    );
    const axisX = rotationAxis[0] / axisLength;
    const axisY = rotationAxis[1] / axisLength;
    const axisZ = rotationAxis[2] / axisLength;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const oneMinusCosine = 1 - cosine;

    return [
      oneMinusCosine * axisX * axisX + cosine,
      oneMinusCosine * axisX * axisY + sine * axisZ,
      oneMinusCosine * axisX * axisZ - sine * axisY,
      0,
      oneMinusCosine * axisX * axisY - sine * axisZ,
      oneMinusCosine * axisY * axisY + cosine,
      oneMinusCosine * axisY * axisZ + sine * axisX,
      0,
      oneMinusCosine * axisX * axisZ + sine * axisY,
      oneMinusCosine * axisY * axisZ - sine * axisX,
      oneMinusCosine * axisZ * axisZ + cosine,
      0,
      0,
      0,
      0,
      1,
    ];
  }

  // Memutar sebuah titik mengelilingi titik poros memakai matriks rotasi
  function rotatePointAroundPivot(point, pivot, rotationMatrix) {
    const relative = subtractPosition(point, pivot);
    return [
      pivot[0] +
        rotationMatrix[0] * relative[0] +
        rotationMatrix[4] * relative[1] +
        rotationMatrix[8] * relative[2],
      pivot[1] +
        rotationMatrix[1] * relative[0] +
        rotationMatrix[5] * relative[1] +
        rotationMatrix[9] * relative[2],
      pivot[2] +
        rotationMatrix[2] * relative[0] +
        rotationMatrix[6] * relative[1] +
        rotationMatrix[10] * relative[2],
    ];
  }

  // Easing halus di awal dan di akhir (ease-in-out cubic)
  function easingCubicInOut(time) {
    return time < 0.5
      ? 4 * time * time * time
      : 1 - Math.pow(-2 * time + 2, 3) / 2;
  }

  // Easing cepat di awal lalu melambat di akhir (ease-out cubic)
  function easingCubicOut(time) {
    return 1 - Math.pow(1 - time, 3);
  }

  // Membuat matriks Jake: putaran ayunan, putaran sumbu Y, condong depan-kiri, putaran bilah pada sumbu panjangnya, lalu skala tubuh
  function createSwordTransform(
    feetPosition,
    swingRotation,
    spinAngle,
    forwardTilt,
    leftTilt,
    bladeRoll,
    bodyScales,
  ) {
    const jakeScale = CHARACTER_SETTINGS.jake.scale;
    return Matrix4.chain(
      Matrix4.translation(feetPosition[0], feetPosition[1], feetPosition[2]),
      swingRotation,
      Matrix4.rotationY(spinAngle),
      Matrix4.rotationX(forwardTilt),
      Matrix4.rotationZ(-leftTilt),
      Matrix4.rotationY(bladeRoll),
      Matrix4.scaling(
        jakeScale * bodyScales.widthScale,
        jakeScale * bodyScales.heightScale,
        jakeScale * bodyScales.depthScale,
      ),
    );
  }

  // Membuat matriks penempatan Finn dengan badan terpuntir sedikit saat mengayun
  function createFinnPlacement(bodyTwist) {
    const settings = CHARACTER_SETTINGS.finn;
    return Matrix4.chain(
      Matrix4.translation(
        settings.startPosition[0],
        settings.startPosition[1],
        settings.startPosition[2],
      ),
      Matrix4.rotationY(settings.yaw + bodyTwist),
      Matrix4.scaling(settings.scale, settings.scale, settings.scale),
    );
  }

  // Mengambil pose diam bawaan karakter agar semua field bawaan modelnya tetap lengkap
  function createBasePose(characterName) {
    const settings = CHARACTER_SETTINGS[characterName];
    return App.animations.getCharacterLocomotionPose(
      characterName,
      "idle",
      0,
      settings.startPosition,
      settings.yaw,
      settings.scale,
    );
  }

  class SwordTransformationAnimation {
    constructor() {
      this.isAnimating = false;
      this.animationTime = 0;
      this.animationDuration = 3.4;

      this.phases = {
        preparation: { start: 0, end: 0.6 },
        transformation: { start: 0.6, end: 1.4 },
        jump: { start: 1.4, end: 2.6 },
        catch: { start: 2.6, end: 3.4 },
      };

      this.isSwinging = false;
      this.swingTime = 0;
      this.swingDuration = 2.0;

      this.swingSegments = [
        {
          start: 0,
          end: 0.6,
          fromAngle: 0,
          toAngle: SWING_SETTINGS.windupAngle,
        },
        {
          start: 0.6,
          end: 1.1,
          fromAngle: SWING_SETTINGS.windupAngle,
          toAngle: SWING_SETTINGS.slashEndAngle,
        },
        {
          start: 1.1,
          end: 2.0,
          fromAngle: SWING_SETTINGS.slashEndAngle,
          toAngle: 0,
        },
      ];
    }

    // Memberikan posisi awal Finn dan Jake agar scene bisa menempatkan keduanya sebelum animasi mulai
    getStartPositions() {
      return {
        finn: [...CHARACTER_SETTINGS.finn.startPosition],
        jake: [...CHARACTER_SETTINGS.jake.startPosition],
      };
    }

    // Memulai animasi transformasi dari awal
    startAnimation() {
      this.isAnimating = true;
      this.animationTime = 0;
      this.stopSwing();
    }

    // Menghentikan animasi dan mengembalikan ke keadaan awal
    stopAnimation() {
      this.isAnimating = false;
      this.animationTime = 0;
      this.stopSwing();
    }

    // Memulai ayunan diagonal, hanya bisa setelah pedang sudah dipegang Finn
    startSwing() {
      if (!this.isAnimationComplete()) return false;
      this.isSwinging = true;
      this.swingTime = 0;
      return true;
    }

    // Menghentikan ayunan dan mengembalikan pedang ke posisi pegangan
    stopSwing() {
      this.isSwinging = false;
      this.swingTime = 0;
    }

    // Memajukan waktu animasi transformasi dan ayunan, lalu menahan pose akhir saat selesai
    updateAnimationTime(deltaTime) {
      if (!this.isAnimating) return;
      this.animationTime = Math.min(
        this.animationTime + deltaTime,
        this.animationDuration,
      );

      if (this.isSwinging) {
        this.swingTime += deltaTime;
        if (this.swingTime >= this.swingDuration) this.stopSwing();
      }
    }

    // Menentukan apakah animasi sedang tidak aktif sehingga pose normal yang dipakai
    isIdle() {
      return !this.isAnimating && this.animationTime === 0;
    }

    // Mendapatkan nama fase animasi saat ini
    getCurrentPhase() {
      const time = this.animationTime;
      if (time < this.phases.preparation.end) return "preparation";
      if (time < this.phases.transformation.end) return "transformation";
      if (time < this.phases.jump.end) return "jump";
      return "catch";
    }

    // Mendapatkan progress lokal 0 sampai 1 di dalam satu fase
    getPhaseProgress(phaseName) {
      const phase = this.phases[phaseName];
      const time = this.animationTime;
      if (time <= phase.start) return 0;
      if (time >= phase.end) return 1;
      return (time - phase.start) / (phase.end - phase.start);
    }

    // Menghitung sudut ayunan saat ini: angkat ke kiri atas, tebas ke kanan bawah, lalu kembali
    calculateSwingAngle() {
      if (!this.isSwinging) return 0;

      const activeSegment = this.swingSegments.find(
        (segment) => this.swingTime <= segment.end,
      );
      if (!activeSegment) return 0;

      const progress =
        (this.swingTime - activeSegment.start) /
        (activeSegment.end - activeSegment.start);
      return linearInterpolate(
        activeSegment.fromAngle,
        activeSegment.toAngle,
        easingCubicInOut(progress),
      );
    }

    // Menghitung matriks rotasi ayunan mengelilingi sumbu sembarang (arbitrary axis)
    calculateSwingRotation() {
      return createAxisRotationMatrix(
        SWING_SETTINGS.rotationAxis,
        this.calculateSwingAngle(),
      );
    }

    // Menghitung titik poros ayunan di belakang pinggang Finn agar tangan menempuh busur yang lebar
    calculateSwingPivot() {
      return addOffset(
        CHARACTER_SETTINGS.finn.startPosition,
        SWING_SETTINGS.pivotOffsetFromFinn,
      );
    }

    // Menghitung sudut puntiran badan Finn dari sudut ayunan saat ini
    calculateBodyTwist() {
      return this.calculateSwingAngle() * SWING_SETTINGS.bodyTwistRatio;
    }

    // Menghitung seberapa turun pedang dan kedua tangan saat menahan benturan tangkapan
    calculateImpactDip() {
      if (this.getCurrentPhase() !== "catch") return 0;
      const progress = this.getPhaseProgress("catch");
      return (
        HELD_SWORD_SETTINGS.impactDipDistance *
        Math.sin(progress * Math.PI * 3) *
        (1 - progress)
      );
    }

    // Menghitung posisi kaki pedang saat dipegang di depan badan Finn (ikut turun saat benturan)
    calculateHeldSwordFeetPosition() {
      const heldPosition = addOffset(
        CHARACTER_SETTINGS.finn.startPosition,
        HELD_SWORD_SETTINGS.feetOffsetFromFinn,
      );
      heldPosition[1] -= this.calculateImpactDip();
      return heldPosition;
    }

    // Menghitung titik genggaman di pedang yang miring ke depan dan ke kiri
    calculateGripPosition(heldFeetPosition, gripFromFeet) {
      return addOffset(
        heldFeetPosition,
        rotateOffsetByTilt(
          gripFromFeet,
          SWORD_SETTINGS.heldForwardTilt,
          SWORD_SETTINGS.heldLeftTilt,
        ),
      );
    }

    // Menghitung posisi dunia bahu Finn; sideSign 1 untuk sisi +X dan -1 untuk sisi -X
    calculateShoulderPosition(sideSign, bodyTwist) {
      const settings = CHARACTER_SETTINGS.finn;
      const rotatedOffset = rotateVectorAroundYAxis(
        [
          sideSign * FINN_BODY_SETTINGS.shoulderHalfWidth,
          FINN_BODY_SETTINGS.shoulderHeight,
          0,
        ],
        settings.yaw + bodyTwist,
      );
      return addOffset(settings.startPosition, rotatedOffset);
    }

    // Menghitung posisi dunia kedua tangan sebelum koreksi: naik dari sisi badan, menggenggam, lalu ikut berayun
    calculateRawHandPositions() {
      const finnPosition = CHARACTER_SETTINGS.finn.startPosition;
      const heldFeetPosition = this.calculateHeldSwordFeetPosition();

      const raiseDuration = this.phases.jump.start;
      const raiseProgress = easingCubicInOut(
        Math.min(this.animationTime / raiseDuration, 1),
      );

      const rightHand = interpolatePosition(
        addOffset(finnPosition, FINN_ARM_SETTINGS.rightRestOffset),
        this.calculateGripPosition(
          heldFeetPosition,
          HELD_SWORD_SETTINGS.rightGripFromFeet,
        ),
        raiseProgress,
      );
      const leftHand = interpolatePosition(
        addOffset(finnPosition, FINN_ARM_SETTINGS.leftRestOffset),
        this.calculateGripPosition(
          heldFeetPosition,
          HELD_SWORD_SETTINGS.leftGripFromFeet,
        ),
        raiseProgress,
      );

      const swingRotation = this.calculateSwingRotation();
      const swingPivot = this.calculateSwingPivot();
      return {
        rightHand: rotatePointAroundPivot(rightHand, swingPivot, swingRotation),
        leftHand: rotatePointAroundPivot(leftHand, swingPivot, swingRotation),
      };
    }

    // Menghitung batas jangkauan tiap tangan dari bahunya, berdasarkan jarak pose pegangan yang pasti terjangkau lengan
    calculateHandReachLimits() {
      const finnPosition = CHARACTER_SETTINGS.finn.startPosition;
      const heldFeetPosition = addOffset(
        finnPosition,
        HELD_SWORD_SETTINGS.feetOffsetFromFinn,
      );
      const rightShoulder = this.calculateShoulderPosition(1, 0);
      const leftShoulder = this.calculateShoulderPosition(-1, 0);

      const calculateLimit = (gripFromFeet, shoulderPosition) => {
        const heldDistance = calculateVectorLength(
          subtractPosition(
            this.calculateGripPosition(heldFeetPosition, gripFromFeet),
            shoulderPosition,
          ),
        );
        return heldDistance + FINN_BODY_SETTINGS.extraReachDistance;
      };

      return {
        rightLimit: calculateLimit(
          HELD_SWORD_SETTINGS.rightGripFromFeet,
          rightShoulder,
        ),
        leftLimit: calculateLimit(
          HELD_SWORD_SETTINGS.leftGripFromFeet,
          leftShoulder,
        ),
      };
    }

    // Menghitung jarak terdekat tangan pegangan di depan badan saat pose diam (tanpa ayunan)
    calculateRestFrontDistance() {
      const finnPosition = CHARACTER_SETTINGS.finn.startPosition;
      const heldFeetPosition = addOffset(
        finnPosition,
        HELD_SWORD_SETTINGS.feetOffsetFromFinn,
      );
      const rightGrip = this.calculateGripPosition(
        heldFeetPosition,
        HELD_SWORD_SETTINGS.rightGripFromFeet,
      );
      const leftGrip = this.calculateGripPosition(
        heldFeetPosition,
        HELD_SWORD_SETTINGS.leftGripFromFeet,
      );
      return Math.min(rightGrip[2], leftGrip[2]) - finnPosition[2];
    }

    // Menghitung geseran kaku (untuk tangan dan pedang sekaligus) agar tangan tetap di depan badan dan masih terjangkau bahu
    calculateBodyAvoidanceOffset(rawHandPositions, bodyTwist) {
      const swingMagnitude = Math.abs(this.calculateSwingAngle());
      if (swingMagnitude === 0) return [0, 0, 0];

      const settings = CHARACTER_SETTINGS.finn;
      const forwardDirection = rotateVectorAroundYAxis(
        [0, 0, 1],
        settings.yaw + bodyTwist,
      );
      const blend = easingCubicOut(
        Math.min(swingMagnitude / FINN_BODY_SETTINGS.fullBlendAngle, 1),
      );
      const requiredFrontDistance = linearInterpolate(
        this.calculateRestFrontDistance(),
        FINN_BODY_SETTINGS.minimumFrontDistance,
        blend,
      );

      const reachLimits = this.calculateHandReachLimits();
      const handEntries = [
        {
          handPosition: rawHandPositions.rightHand,
          shoulderPosition: this.calculateShoulderPosition(1, bodyTwist),
          reachLimit: reachLimits.rightLimit,
        },
        {
          handPosition: rawHandPositions.leftHand,
          shoulderPosition: this.calculateShoulderPosition(-1, bodyTwist),
          reachLimit: reachLimits.leftLimit,
        },
      ];

      let offset = [0, 0, 0];
      for (
        let iteration = 0;
        iteration < FINN_BODY_SETTINGS.correctionIterationCount;
        iteration++
      ) {
        const smallestFrontDistance = Math.min(
          ...handEntries.map((entry) =>
            calculateDotProduct(
              subtractPosition(
                addOffset(entry.handPosition, offset),
                settings.startPosition,
              ),
              forwardDirection,
            ),
          ),
        );
        if (smallestFrontDistance < requiredFrontDistance) {
          offset = addOffset(
            offset,
            scaleVector(
              forwardDirection,
              requiredFrontDistance - smallestFrontDistance,
            ),
          );
        }

        handEntries.forEach((entry) => {
          const shoulderToHand = subtractPosition(
            addOffset(entry.handPosition, offset),
            entry.shoulderPosition,
          );
          const distance = calculateVectorLength(shoulderToHand);
          if (distance > entry.reachLimit) {
            offset = subtractPosition(
              offset,
              scaleVector(
                shoulderToHand,
                (distance - entry.reachLimit) / distance,
              ),
            );
          }
        });
      }
      return offset;
    }

    // Menghitung geseran penghindaran badan untuk frame saat ini
    calculateCurrentAvoidanceOffset() {
      return this.calculateBodyAvoidanceOffset(
        this.calculateRawHandPositions(),
        this.calculateBodyTwist(),
      );
    }

    // Menghitung posisi dunia kedua tangan Finn setelah dikoreksi agar tidak menembus badan
    calculateFinnHandPositions() {
      const rawHandPositions = this.calculateRawHandPositions();
      const avoidanceOffset = this.calculateBodyAvoidanceOffset(
        rawHandPositions,
        this.calculateBodyTwist(),
      );
      return {
        rightHand: addOffset(rawHandPositions.rightHand, avoidanceOffset),
        leftHand: addOffset(rawHandPositions.leftHand, avoidanceOffset),
      };
    }

    // Menghitung posisi kaki, putaran sumbu Y, kemiringan depan-kiri, putaran bilah, dan skala tubuh Jake untuk fase saat ini
    calculateSwordState() {
      const jakeStart = CHARACTER_SETTINGS.jake.startPosition;
      const phase = this.getCurrentPhase();
      const progress = this.getPhaseProgress(phase);

      const swordScales = {
        widthScale: SWORD_SETTINGS.widthScale,
        heightScale: SWORD_SETTINGS.heightScale,
        depthScale: SWORD_SETTINGS.depthScale,
      };

      if (phase === "preparation") {
        const easedProgress = easingCubicInOut(progress);
        const squashedWidth = linearInterpolate(
          1,
          SQUASH_SETTINGS.widthScale,
          easedProgress,
        );
        return {
          feetPosition: [...jakeStart],
          spinAngle: 0,
          forwardTilt: 0,
          leftTilt: 0,
          bladeRoll: 0,
          bodyScales: {
            widthScale: squashedWidth,
            heightScale: linearInterpolate(
              1,
              SQUASH_SETTINGS.heightScale,
              easedProgress,
            ),
            depthScale: squashedWidth,
          },
        };
      }

      if (phase === "transformation") {
        const easedProgress = easingCubicInOut(progress);
        const hoverHeight =
          SWORD_SETTINGS.hoverHeight * easingCubicOut(progress);
        return {
          feetPosition: [
            jakeStart[0],
            jakeStart[1] + hoverHeight,
            jakeStart[2],
          ],
          spinAngle: easedProgress * FULL_TURN,
          forwardTilt: 0,
          leftTilt: 0,
          bladeRoll: 0,
          bodyScales: {
            widthScale: linearInterpolate(
              SQUASH_SETTINGS.widthScale,
              SWORD_SETTINGS.widthScale,
              easedProgress,
            ),
            heightScale: linearInterpolate(
              SQUASH_SETTINGS.heightScale,
              SWORD_SETTINGS.heightScale,
              easedProgress,
            ),
            depthScale: linearInterpolate(
              SQUASH_SETTINGS.widthScale,
              SWORD_SETTINGS.depthScale,
              easedProgress,
            ),
          },
        };
      }

      if (phase === "jump") {
        const startFeetPosition = [
          jakeStart[0],
          jakeStart[1] + SWORD_SETTINGS.hoverHeight,
          jakeStart[2],
        ];
        const feetPosition = interpolatePosition(
          startFeetPosition,
          this.calculateHeldSwordFeetPosition(),
          easingCubicOut(progress),
        );
        feetPosition[1] += Math.sin(progress * Math.PI) * 1.6;

        const easedProgress = easingCubicInOut(progress);
        return {
          feetPosition,
          spinAngle: easedProgress * SWORD_SETTINGS.jumpSpinTurns * FULL_TURN,
          forwardTilt: easedProgress * SWORD_SETTINGS.heldForwardTilt,
          leftTilt: easedProgress * SWORD_SETTINGS.heldLeftTilt,
          bladeRoll: easedProgress * SWORD_SETTINGS.bladeRollAngle,
          bodyScales: swordScales,
        };
      }

      return {
        feetPosition: this.calculateHeldSwordFeetPosition(),
        spinAngle: 0,
        forwardTilt: SWORD_SETTINGS.heldForwardTilt,
        leftTilt: SWORD_SETTINGS.heldLeftTilt,
        bladeRoll: SWORD_SETTINGS.bladeRollAngle,
        bodyScales: swordScales,
      };
    }

    // Mendapatkan pose Jake: berubah jadi pedang, melompat, dipegang Finn, lalu ikut berayun bersama tangan
    getJakePose() {
      if (this.isIdle()) return null;

      const swordState = this.calculateSwordState();
      const swingRotation = this.calculateSwingRotation();
      const swingPivot = this.calculateSwingPivot();
      const rotatedFeetPosition = rotatePointAroundPivot(
        swordState.feetPosition,
        swingPivot,
        swingRotation,
      );
      const avoidanceOffset = this.calculateCurrentAvoidanceOffset();

      return Object.assign({}, createBasePose("jake"), {
        placeMat: createSwordTransform(
          addOffset(rotatedFeetPosition, avoidanceOffset),
          swingRotation,
          swordState.spinAngle,
          swordState.forwardTilt,
          swordState.leftTilt,
          swordState.bladeRoll,
          swordState.bodyScales,
        ),
        scale: CHARACTER_SETTINGS.jake.scale,
      });
    }

    // Mendapatkan pose Finn: kedua tangan menggenggam pedang, badan terpuntir saat mengayun
    getFinnPose() {
      if (this.isIdle()) return null;

      const handPositions = this.calculateFinnHandPositions();
      const poseChanges = {
        armR: {
          w: handPositions.rightHand,
          pole: [...FINN_ARM_SETTINGS.rightElbowDirection],
        },
        armL: {
          w: handPositions.leftHand,
          pole: [...FINN_ARM_SETTINGS.leftElbowDirection],
        },
      };

      const bodyTwist = this.calculateBodyTwist();
      if (bodyTwist !== 0) {
        poseChanges.placeMat = createFinnPlacement(bodyTwist);
      }

      return Object.assign({}, createBasePose("finn"), poseChanges);
    }

    // Mengecek apakah Jake sudah mulai berubah menjadi pedang
    shouldJakeBeInSwordMode() {
      return (
        !this.isIdle() && this.animationTime >= this.phases.transformation.start
      );
    }

    // Mengecek apakah animasi transformasi sudah selesai
    isAnimationComplete() {
      return this.animationTime >= this.animationDuration;
    }

    // Mengembalikan animasi ke keadaan awal
    reset() {
      this.stopAnimation();
    }
  }

  App.animations.swordTransformation = new SwordTransformationAnimation();
  window.AT = window.AT || {};
  window.AT.SwordTransformationAnimation = SwordTransformationAnimation;
})();
