(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.geom = App.geom || {};
  App.geom.quadrics = App.geom.quadrics || {};
  const Vector3 =
    App.math.Vector3 ||
    App.math.V3 ||
    (window.JK && (window.JK.Vector3 || window.JK.V3));
  const { gridMesh, uploadMesh } = App.geom;
  const PI = Math.PI;

  // Menghitung fungsi kosinus bertanda pangkat untuk parametrisasi superellipsoid.
  const signedPowerCosine = (angleRadians, powerExponent) => {
    const cosineValue = Math.cos(angleRadians);
    return Math.sign(cosineValue) * Math.pow(Math.abs(cosineValue), powerExponent);
  };

  // Menghitung fungsi sinus bertanda pangkat untuk parametrisasi superellipsoid.
  const signedPowerSine = (angleRadians, powerExponent) => {
    const sineValue = Math.sin(angleRadians);
    return Math.sign(sineValue) * Math.pow(Math.abs(sineValue), powerExponent);
  };

  /* 1. BOLA / ELLIPSOID SATUAN */

  // Menghasilkan koordinat titik 3D permukaan bola satuan pada sudut parametrik (u, v).
  function sphereFunction(coordinateU, coordinateV) {
    const thetaAngle = PI * coordinateV;
    const phiAngle = 2 * PI * coordinateU;
    return [
      Math.sin(thetaAngle) * Math.cos(phiAngle),
      Math.cos(thetaAngle),
      Math.sin(thetaAngle) * Math.sin(phiAngle),
    ];
  }

  // Membuat mesh 3D bola kuadrik satuan di memori GPU WebGL.
  function sphereMesh(glContext, segmentsU = 32, segmentsV = 24) {
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      sphereFunction,
      (u, v, surfacePoint) => surfacePoint,
    );
  }

  /* 2. SILINDER HORIZONTAL SATUAN */

  // Menghasilkan koordinat permukaan silinder sepanjang sumbu Z pada sudut parametrik (u, v).
  function cylinderFunction(coordinateU, coordinateV) {
    const angle = 2 * PI * coordinateU;
    return [Math.cos(angle), Math.sin(angle), coordinateV];
  }

  // Membuat mesh 3D silinder horizontal di memori GPU WebGL.
  function cylinderMesh(glContext, segmentsU = 20) {
    return gridMesh(
      glContext,
      segmentsU,
      2,
      cylinderFunction,
      (u, v, surfacePoint) => [surfacePoint[0], surfacePoint[1], 0],
    );
  }

  /* 2b. SILINDER TEGAK Y (Telinga Finn dsb.) */

  // Menghasilkan fungsi parametrik untuk silinder tegak vertikal sepanjang sumbu Y.
  function cylinderYFunction(cylinderRadius, cylinderHeight) {
    return (coordinateU, coordinateV) => {
      const angle = 2 * PI * coordinateU;
      return [
        cylinderRadius * Math.cos(angle),
        cylinderHeight * coordinateV,
        cylinderRadius * Math.sin(angle),
      ];
    };
  }

  // Membuat mesh 3D silinder tegak vertikal pada sumbu Y di memori GPU WebGL.
  function cylinderYMesh(
    glContext,
    radius = 0.08,
    height = 0.1,
    segmentsU = 24,
    segmentsV = 2,
  ) {
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      cylinderYFunction(radius, height),
      (coordinateU) => {
        const angle = 2 * PI * coordinateU;
        return [Math.cos(angle), 0, Math.sin(angle)];
      },
    );
  }

  /* 3. KERUCUT KUADRIK (CIRCULAR CONE SATUAN) */

  // Menghasilkan koordinat permukaan kerucut lingkaran satuan dari alas z = 0 ke puncak z = 1.
  function coneFunction(coordinateU, coordinateV) {
    const angle = 2 * PI * coordinateU;
    const currentRadius = 1 - coordinateV;
    return [
      currentRadius * Math.cos(angle),
      currentRadius * Math.sin(angle),
      coordinateV,
    ];
  }

  // Menghitung vektor normal analitik pada permukaan kerucut kuadrik lingkaran.
  function coneNormal(coordinateU) {
    const angle = 2 * PI * coordinateU;
    return [
      Math.SQRT1_2 * Math.cos(angle),
      Math.SQRT1_2 * Math.sin(angle),
      Math.SQRT1_2,
    ];
  }

  // Membuat mesh 3D kerucut kuadrik lingkaran di memori GPU WebGL.
  function coneMesh(glContext, segmentsU = 20, segmentsV = 8) {
    return gridMesh(glContext, segmentsU, segmentsV, coneFunction, coneNormal);
  }

  /* 4. ELLIPTIC PARABOLOID DENGAN PERATAAN */

  // Menghasilkan fungsi parametrik kubah paraboloid eliptik dengan batas dasar pipih.
  function paraboloidFunction(
    semiAxisX,
    semiAxisZ,
    height,
    flattenLimit = 0.3,
  ) {
    return (normalizedAngle, normalizedRadius) => {
      const angle = 2 * PI * normalizedAngle;
      const clampedRadius = Math.min(normalizedRadius, 1 - flattenLimit);
      return [
        semiAxisX * clampedRadius * Math.cos(angle),
        height * (1 - Math.pow(normalizedRadius, 3)),
        semiAxisZ * clampedRadius * Math.sin(angle),
      ];
    };
  }

  // Membuat mesh 3D kubah paraboloid eliptik berujung tumpul di memori GPU WebGL.
  function paraboloidMesh(
    glContext,
    semiAxisX = 0.1,
    semiAxisZ = 0.1,
    height = 0.14,
    flattenLimit = 0.3,
    segmentsU = 24,
    segmentsV = 8,
  ) {
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      paraboloidFunction(semiAxisX, semiAxisZ, height, flattenLimit),
    );
  }

  /* 4b. ELLIPTIC PARABOLOID SEJATI (Hidung Jake dsb.) */

  // Menghasilkan fungsi koordinat parametrik elliptic paraboloid sejati: y/h = 1 - x²/a² - z²/c².
  function ellipticParaboloidFunction(semiAxisX, semiAxisZ, height) {
    return (normalizedAngle, normalizedRadius) => {
      const angle = 2 * PI * normalizedAngle;
      return [
        semiAxisX * normalizedRadius * Math.cos(angle),
        height * (1 - normalizedRadius * normalizedRadius),
        semiAxisZ * normalizedRadius * Math.sin(angle),
      ];
    };
  }

  // Membuat mesh 3D elliptic paraboloid kuadrik sejati di memori GPU WebGL.
  function ellipticParaboloidMesh(
    glContext,
    semiAxisX = 0.1,
    semiAxisZ = 0.1,
    height = 0.14,
    segmentsU = 24,
    segmentsV = 10,
  ) {
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      ellipticParaboloidFunction(semiAxisX, semiAxisZ, height),
      (u, v, surfacePoint) =>
        Vector3.normalize([
          (2 * surfacePoint[0]) / (semiAxisX * semiAxisX),
          1 / height,
          (2 * surfacePoint[2]) / (semiAxisZ * semiAxisZ),
        ]),
    );
  }

  /* 5. HYPERBOLOID OF ONE SHEET (Celana Finn) */

  // Menghasilkan fungsi posisi dan normal hiperboloid satu lembar (hyperboloid of one sheet).
  function hyperboloidOneSheetFunction(
    semiAxisA,
    semiAxisC,
    semiAxisB,
    parameterLimitV,
  ) {
    return (normalizedAngle, normalizedHeight) => {
      const angle = 2 * PI * normalizedAngle;
      const parameterV =
        -parameterLimitV + 2 * parameterLimitV * normalizedHeight;
      const positionX = semiAxisA * Math.cosh(parameterV) * Math.cos(angle);
      const positionY = semiAxisB * Math.sinh(parameterV);
      const positionZ = semiAxisC * Math.cosh(parameterV) * Math.sin(angle);
      const normalVector = Vector3.normalize([
        positionX / (semiAxisA * semiAxisA),
        -positionY / (semiAxisB * semiAxisB),
        positionZ / (semiAxisC * semiAxisC),
      ]);
      return { p: [positionX, positionY, positionZ], n: normalVector };
    };
  }

  // Membuat mesh 3D hiperboloid satu lembar kuadrik di memori GPU WebGL.
  function hyperboloidMesh(
    glContext,
    semiAxisA = 0.05,
    semiAxisC = 0.05,
    semiAxisB = 0.2,
    parameterLimitV = 0.4,
    segmentsU = 32,
    segmentsV = 10,
  ) {
    const parametricFunction = hyperboloidOneSheetFunction(
      semiAxisA,
      semiAxisC,
      semiAxisB,
      parameterLimitV,
    );
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      (u, v) => parametricFunction(u, v).p,
      (u, v) => parametricFunction(u, v).n,
    );
  }

  /* 6. SUPERELLIPSOID UMUM (Anatomi Finn, Jake, Box) */

  // Menghasilkan fungsi posisi dan normal untuk superellipsoid umum dengan rentang lintang tertentu.
  function superellipsoidFunction(
    radiusX,
    radiusY,
    radiusZ,
    latitudeExponent,
    longitudeExponent,
    latitudeStart = 0,
    latitudeEnd = 1,
  ) {
    return (normalizedLongitude, normalizedLatitude) => {
      const longitudeAngle = -PI + 2 * PI * normalizedLongitude;
      const latitudeAngle =
        -PI / 2 +
        PI * (latitudeStart + (latitudeEnd - latitudeStart) * normalizedLatitude);

      const positionX =
        radiusX *
        signedPowerCosine(latitudeAngle, latitudeExponent) *
        signedPowerCosine(longitudeAngle, longitudeExponent);
      const positionY =
        radiusY * signedPowerSine(latitudeAngle, latitudeExponent);
      const positionZ =
        radiusZ *
        signedPowerCosine(latitudeAngle, latitudeExponent) *
        signedPowerSine(longitudeAngle, longitudeExponent);

      const normalVector = Vector3.normalize([
        (signedPowerCosine(latitudeAngle, 2 - latitudeExponent) *
          signedPowerCosine(longitudeAngle, 2 - longitudeExponent)) /
          radiusX,
        signedPowerSine(latitudeAngle, 2 - latitudeExponent) / radiusY,
        (signedPowerCosine(latitudeAngle, 2 - latitudeExponent) *
          signedPowerSine(longitudeAngle, 2 - longitudeExponent)) /
          radiusZ,
      ]);

      return { p: [positionX, positionY, positionZ], n: normalVector };
    };
  }

  // Membuat mesh 3D superellipsoid kuadrik di memori GPU WebGL.
  function superellipsoidMesh(
    glContext,
    radiusX,
    radiusY,
    radiusZ,
    latitudeExponent,
    longitudeExponent,
    segmentsU = 32,
    segmentsV = 18,
    latitudeStart = 0,
    latitudeEnd = 1,
  ) {
    const parametricFunction = superellipsoidFunction(
      radiusX,
      radiusY,
      radiusZ,
      latitudeExponent,
      longitudeExponent,
      latitudeStart,
      latitudeEnd,
    );
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      (u, v) => parametricFunction(u, v).p,
      (u, v) => parametricFunction(u, v).n,
    );
  }

  // Membuat mesh 3D ellipsoid kuadrik standar di memori GPU WebGL.
  function ellipsoidMesh(
    glContext,
    radiusX = 1,
    radiusY = 1,
    radiusZ = 1,
    segmentsU = 36,
    segmentsV = 24,
  ) {
    return superellipsoidMesh(
      glContext,
      radiusX,
      radiusY,
      radiusZ,
      1,
      1,
      segmentsU,
      segmentsV,
    );
  }

  /* 7. TOROID ELIPS (Tali Ransel Finn) */

  // Menghasilkan fungsi posisi dan normal untuk torus eliptik.
  function torusFunction(semiMajorRadiusZ, semiMajorRadiusY, tubeRadius) {
    return (normalizedMajorAngle, normalizedMinorAngle) => {
      const majorAngle = 2 * PI * normalizedMajorAngle;
      const minorAngle = 2 * PI * normalizedMinorAngle;
      const ringZ = semiMajorRadiusZ * Math.cos(majorAngle);
      const ringY = semiMajorRadiusY * Math.sin(majorAngle);
      const normalZ = semiMajorRadiusY * Math.cos(majorAngle);
      const normalY = semiMajorRadiusZ * Math.sin(majorAngle);
      const normalLength = Math.hypot(normalZ, normalY) || 1;
      const unitNormalZ = normalZ / normalLength;
      const unitNormalY = normalY / normalLength;
      const cosMinor = Math.cos(minorAngle);
      const sinMinor = Math.sin(minorAngle);

      const surfacePoint = [
        tubeRadius * sinMinor,
        ringY + tubeRadius * cosMinor * unitNormalY,
        ringZ + tubeRadius * cosMinor * unitNormalZ,
      ];
      const normalVector = Vector3.normalize([
        sinMinor,
        cosMinor * unitNormalY,
        cosMinor * unitNormalZ,
      ]);
      return { p: surfacePoint, n: normalVector };
    };
  }

  // Membuat mesh 3D torus eliptik di memori GPU WebGL.
  function torusMesh(
    glContext,
    semiMajorRadiusZ = 0.25,
    semiMajorRadiusY = 0.08,
    tubeRadius = 0.02,
    segmentsU = 40,
    segmentsV = 10,
  ) {
    const parametricFunction = torusFunction(
      semiMajorRadiusZ,
      semiMajorRadiusY,
      tubeRadius,
    );
    return gridMesh(
      glContext,
      segmentsU,
      segmentsV,
      (u, v) => parametricFunction(u, v).p,
      (u, v) => parametricFunction(u, v).n,
    );
  }

  /* 8. ROUNDED BOX (Badan BMO) */

  // Menghasilkan data verteks, normal, dan indeks kotak kubus bersudut membulat.
  function roundedBoxData(
    width,
    height,
    depth,
    cornerRadius,
    cornerSegments,
  ) {
    const halfDimensions = [width / 2, height / 2, depth / 2];
    const positions = [];
    const normals = [];
    const indices = [];

    const generateBevelPoints = (halfDimension) => {
      const leftBevelPoints = [];
      const rightBevelPoints = [];
      for (let stepIndex = cornerSegments; stepIndex >= 0; stepIndex--) {
        leftBevelPoints.push(
          -(halfDimension - cornerRadius) -
            cornerRadius *
              Math.tan(((stepIndex / cornerSegments) * Math.PI) / 4),
        );
      }
      for (let stepIndex = 0; stepIndex <= cornerSegments; stepIndex++) {
        rightBevelPoints.push(
          halfDimension -
            cornerRadius +
            cornerRadius *
              Math.tan(((stepIndex / cornerSegments) * Math.PI) / 4),
        );
      }
      return leftBevelPoints.concat(rightBevelPoints);
    };

    const bevelPointArrays = [
      generateBevelPoints(halfDimensions[0]),
      generateBevelPoints(halfDimensions[1]),
      generateBevelPoints(halfDimensions[2]),
    ];

    [
      [1, 2, 0, 1],
      [1, 2, 0, -1],
      [0, 2, 1, 1],
      [0, 2, 1, -1],
      [0, 1, 2, 1],
      [0, 1, 2, -1],
    ].forEach(([axisA, axisB, axisC, faceSign]) => {
      const countA = bevelPointArrays[axisA].length;
      const countB = bevelPointArrays[axisB].length;
      const baseIndex = positions.length;

      for (let indexA = 0; indexA < countA; indexA++) {
        for (let indexB = 0; indexB < countB; indexB++) {
          const rawPoint = [0, 0, 0];
          rawPoint[axisA] = bevelPointArrays[axisA][indexA];
          rawPoint[axisB] = bevelPointArrays[axisB][indexB];
          rawPoint[axisC] = faceSign * halfDimensions[axisC];

          const innerBoxPoint = [0, 0, 0];
          const offsetDirection = [0, 0, 0];
          for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
            const innerLimit = halfDimensions[axisIndex] - cornerRadius;
            innerBoxPoint[axisIndex] = Math.max(
              -innerLimit,
              Math.min(innerLimit, rawPoint[axisIndex]),
            );
            offsetDirection[axisIndex] =
              rawPoint[axisIndex] - innerBoxPoint[axisIndex];
          }

          const offsetDistance =
            Math.hypot(
              offsetDirection[0],
              offsetDirection[1],
              offsetDirection[2],
            ) || 1;
          const unitNormal = [
            offsetDirection[0] / offsetDistance,
            offsetDirection[1] / offsetDistance,
            offsetDirection[2] / offsetDistance,
          ];

          positions.push([
            innerBoxPoint[0] + unitNormal[0] * cornerRadius,
            innerBoxPoint[1] + unitNormal[1] * cornerRadius,
            innerBoxPoint[2] + unitNormal[2] * cornerRadius,
          ]);
          normals.push(unitNormal);
        }
      }

      // Winding order harus memperhitungkan paritas permutasi (axisA, axisB, axisC).
      const isEvenPerm = (axisA === 0 && axisB === 1) ||
                         (axisA === 1 && axisB === 2) ||
                         (axisA === 2 && axisB === 0);
      const needsFlip = isEvenPerm ? (faceSign > 0) : (faceSign < 0);

      for (let indexA = 0; indexA < countA - 1; indexA++) {
        for (let indexB = 0; indexB < countB - 1; indexB++) {
          const index0 = baseIndex + indexA * countB + indexB;
          const index1 = index0 + 1;
          const index2 = index0 + countB;
          const index3 = index2 + 1;
          if (needsFlip) {
            indices.push(index0, index2, index1, index1, index2, index3);
          } else {
            indices.push(index0, index1, index2, index1, index3, index2);
          }
        }
      }
    });

    return { P: positions, N: normals, I: indices, positions, normals, indices };
  }

  // Membuat mesh 3D kotak balok bersudut membulat di memori GPU WebGL.
  function roundedBoxMesh(
    glContext,
    width,
    height,
    depth,
    cornerRadius,
    cornerSegments,
  ) {
    const boxGeometry = roundedBoxData(
      width,
      height,
      depth,
      cornerRadius,
      cornerSegments,
    );
    return uploadMesh(
      glContext,
      boxGeometry.positions,
      boxGeometry.normals,
      boxGeometry.indices,
    );
  }

  /* 9. PRISMA POLIGON CEMBUNG (Tombol BMO) */

  // Menghasilkan data verteks, normal, dan indeks untuk prisma poligon ekstrusi cembung.
  function prismData(contourPoints, extrusionDepth, useSmoothNormals) {
    const positions = [];
    const normals = [];
    const indices = [];
    const pointCount = contourPoints.length;

    let centerPointX = 0;
    let centerPointY = 0;
    contourPoints.forEach((point) => {
      centerPointX += point[0];
      centerPointY += point[1];
    });
    centerPointX /= pointCount;
    centerPointY /= pointCount;

    [
      [extrusionDepth, 1],
      [0, -1],
    ].forEach(([capZ, normalZ]) => {
      const baseIndex = positions.length;
      positions.push([centerPointX, centerPointY, capZ]);
      normals.push([0, 0, normalZ]);

      contourPoints.forEach((point) => {
        positions.push([point[0], point[1], capZ]);
        normals.push([0, 0, normalZ]);
      });

      for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
        indices.push(
          baseIndex,
          baseIndex + 1 + pointIndex,
          baseIndex + 1 + ((pointIndex + 1) % pointCount),
        );
      }
    });

    for (let edgeIndex = 0; edgeIndex < pointCount; edgeIndex++) {
      const edgeStart = contourPoints[edgeIndex];
      const edgeEnd = contourPoints[(edgeIndex + 1) % pointCount];
      const edgeDeltaX = edgeEnd[0] - edgeStart[0];
      const edgeDeltaY = edgeEnd[1] - edgeStart[1];
      const edgeLength = Math.hypot(edgeDeltaX, edgeDeltaY);

      let sideNormalStart = [edgeDeltaY / edgeLength, -edgeDeltaX / edgeLength, 0];
      let sideNormalEnd = sideNormalStart;

      if (useSmoothNormals) {
        const radiusStart = Math.hypot(
          edgeStart[0] - centerPointX,
          edgeStart[1] - centerPointY,
        );
        const radiusEnd = Math.hypot(
          edgeEnd[0] - centerPointX,
          edgeEnd[1] - centerPointY,
        );
        sideNormalStart = [
          (edgeStart[0] - centerPointX) / radiusStart,
          (edgeStart[1] - centerPointY) / radiusStart,
          0,
        ];
        sideNormalEnd = [
          (edgeEnd[0] - centerPointX) / radiusEnd,
          (edgeEnd[1] - centerPointY) / radiusEnd,
          0,
        ];
      }

      const sideBaseIndex = positions.length;
      positions.push(
        [edgeStart[0], edgeStart[1], 0],
        [edgeEnd[0], edgeEnd[1], 0],
        [edgeStart[0], edgeStart[1], extrusionDepth],
        [edgeEnd[0], edgeEnd[1], extrusionDepth],
      );
      normals.push(
        sideNormalStart,
        sideNormalEnd,
        sideNormalStart,
        sideNormalEnd,
      );
      indices.push(
        sideBaseIndex,
        sideBaseIndex + 2,
        sideBaseIndex + 1,
        sideBaseIndex + 1,
        sideBaseIndex + 2,
        sideBaseIndex + 3,
      );
    }

    return { P: positions, N: normals, I: indices, positions, normals, indices };
  }

  // Membuat mesh 3D prisma poligon ekstrusi cembung di memori GPU WebGL.
  function prismMesh(
    glContext,
    contourPoints,
    extrusionDepth,
    useSmoothNormals,
  ) {
    const prismGeometry = prismData(
      contourPoints,
      extrusionDepth,
      useSmoothNormals,
    );
    return uploadMesh(
      glContext,
      prismGeometry.positions,
      prismGeometry.normals,
      prismGeometry.indices,
    );
  }

  App.geom.quadrics = {
    sphereFn: sphereFunction,
    sphereFunction,
    sphereMesh,
    cylinderFn: cylinderFunction,
    cylinderFunction,
    cylinderMesh,
    cylinderYFn: cylinderYFunction,
    cylinderYFunction,
    cylinderYMesh,
    coneFn: coneFunction,
    coneFunction,
    coneNormal,
    coneMesh,
    paraboloidFn: paraboloidFunction,
    paraboloidFunction,
    paraboloidMesh,
    ellipticParaboloidFn: ellipticParaboloidFunction,
    ellipticParaboloidFunction,
    ellipticParaboloidMesh,
    hyperboloidOneSheetFn: hyperboloidOneSheetFunction,
    hyperboloidOneSheetFunction,
    hyperboloidMesh,
    superellipsoidFn: superellipsoidFunction,
    superellipsoidFunction,
    superellipsoidMesh,
    ellipsoidMesh,
    torusFn: torusFunction,
    torusFunction,
    torusMesh,
    roundedBoxData,
    roundedBoxMesh,
    prismData,
    prismMesh,
  };

  // Ekspor ke namespace lama JK untuk interoperabilitas
  window.JK = window.JK || {};
  window.JK.sphereMesh = (u, v) => sphereMesh(window.JK.gl, u, v);
  window.JK.cylinderMesh = (u) => cylinderMesh(window.JK.gl, u);
  window.JK.coneMesh = (u) => coneMesh(window.JK.gl, u);
})();
