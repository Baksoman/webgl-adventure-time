(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.math = App.math || {};
  const Vector3 =
    App.math.Vector3 ||
    App.math.V3 ||
    (window.JK && (window.JK.Vector3 || window.JK.V3));

  const Matrix4 = {
    // Membuat matriks identitas 4x4 berukuran 16 elemen bertipe Float32Array.
    identity: () =>
      new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),

    // Mentransformasikan koordinat sebuah titik 3D menggunakan matriks 4x4.
    transformPoint: (matrix, point3D) => [
      matrix[0] * point3D[0] + matrix[4] * point3D[1] + matrix[8] * point3D[2] + matrix[12],
      matrix[1] * point3D[0] + matrix[5] * point3D[1] + matrix[9] * point3D[2] + matrix[13],
      matrix[2] * point3D[0] + matrix[6] * point3D[1] + matrix[10] * point3D[2] + matrix[14],
    ],

    // Mengalikan dua buah matriks 4x4 (matrixLeft * matrixRight).
    multiply: (matrixLeft, matrixRight) => {
      const outputMatrix = new Float32Array(16);
      for (let columnIndex = 0; columnIndex < 4; columnIndex++) {
        for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
          outputMatrix[columnIndex * 4 + rowIndex] =
            matrixLeft[rowIndex] * matrixRight[columnIndex * 4] +
            matrixLeft[4 + rowIndex] * matrixRight[columnIndex * 4 + 1] +
            matrixLeft[8 + rowIndex] * matrixRight[columnIndex * 4 + 2] +
            matrixLeft[12 + rowIndex] * matrixRight[columnIndex * 4 + 3];
        }
      }
      return outputMatrix;
    },

    // Mengalikan rangkaian beberapa matriks 4x4 secara berurutan dari kiri ke kanan.
    chain: (...matrices) =>
      matrices.reduce((accumulatedMatrix, currentMatrix) =>
        Matrix4.multiply(accumulatedMatrix, currentMatrix),
      ),

    // Membuat matriks translasi (pergeseran posisi) 4x4 pada sumbu X, Y, dan Z.
    translation: (translationX, translationY, translationZ) =>
      new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translationX, translationY, translationZ, 1,
      ]),

    // Membuat matriks penskalaan ukuran 4x4 pada sumbu X, Y, dan Z.
    scaling: (scaleX, scaleY, scaleZ) =>
      new Float32Array([
        scaleX, 0, 0, 0,
        0, scaleY, 0, 0,
        0, 0, scaleZ, 0,
        0, 0, 0, 1,
      ]),

    // Membuat matriks rotasi 4x4 mengelilingi sumbu X dengan sudut tertentu (radian).
    rotationX: (angleRadians) => {
      const cosine = Math.cos(angleRadians);
      const sine = Math.sin(angleRadians);
      return new Float32Array([
        1, 0, 0, 0,
        0, cosine, sine, 0,
        0, -sine, cosine, 0,
        0, 0, 0, 1,
      ]);
    },

    // Membuat matriks rotasi 4x4 mengelilingi sumbu Y dengan sudut tertentu (radian).
    rotationY: (angleRadians) => {
      const cosine = Math.cos(angleRadians);
      const sine = Math.sin(angleRadians);
      return new Float32Array([
        cosine, 0, -sine, 0,
        0, 1, 0, 0,
        sine, 0, cosine, 0,
        0, 0, 0, 1,
      ]);
    },

    // Membuat matriks rotasi 4x4 mengelilingi sumbu Z dengan sudut tertentu (radian).
    rotationZ: (angleRadians) => {
      const cosine = Math.cos(angleRadians);
      const sine = Math.sin(angleRadians);
      return new Float32Array([
        cosine, sine, 0, 0,
        -sine, cosine, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
    },

    // Membuat matriks rotasi 4x4 mengelilingi sembarang sumbu (arbitrary axis) dengan sudut tertentu (radian).
    rotationAxis: (axisVector, angleRadians) => {
      const axisLength =
        Math.hypot(axisVector[0], axisVector[1], axisVector[2]) || 1;
      const normalizedX = axisVector[0] / axisLength;
      const normalizedY = axisVector[1] / axisLength;
      const normalizedZ = axisVector[2] / axisLength;

      const cosine = Math.cos(angleRadians);
      const sine = Math.sin(angleRadians);
      const oneMinusCosine = 1 - cosine;

      return new Float32Array([
        cosine + normalizedX * normalizedX * oneMinusCosine,
        normalizedY * normalizedX * oneMinusCosine + normalizedZ * sine,
        normalizedZ * normalizedX * oneMinusCosine - normalizedY * sine,
        0,

        normalizedX * normalizedY * oneMinusCosine - normalizedZ * sine,
        cosine + normalizedY * normalizedY * oneMinusCosine,
        normalizedZ * normalizedY * oneMinusCosine + normalizedX * sine,
        0,

        normalizedX * normalizedZ * oneMinusCosine + normalizedY * sine,
        normalizedY * normalizedZ * oneMinusCosine - normalizedX * sine,
        cosine + normalizedZ * normalizedZ * oneMinusCosine,
        0,

        0, 0, 0, 1,
      ]);
    },

    // Membangun matriks 4x4 dari titik pusat asal (origin) dan tiga vektor basis ortogonal.
    fromBasis: (originPosition, axisX, axisY, axisZ) =>
      new Float32Array([
        axisX[0], axisX[1], axisX[2], 0,
        axisY[0], axisY[1], axisY[2], 0,
        axisZ[0], axisZ[1], axisZ[2], 0,
        originPosition[0], originPosition[1], originPosition[2], 1,
      ]),

    // Menghasilkan matriks transformasi silinder dari titik awal ke titik akhir dengan radius tertentu.
    segment: (startPoint, endPoint, radius) => {
      const displacement = Vector3.subtract(endPoint, startPoint);
      const segmentLength = Vector3.length(displacement) || 1e-6;
      const normalizedZAxis = Vector3.multiplyScalar(displacement, 1 / segmentLength);
      const referenceVector =
        Math.abs(normalizedZAxis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
      const normalizedXAxis = Vector3.normalize(
        Vector3.cross(referenceVector, normalizedZAxis),
      );
      const normalizedYAxis = Vector3.cross(normalizedZAxis, normalizedXAxis);
      return Matrix4.fromBasis(
        startPoint,
        Vector3.multiplyScalar(normalizedXAxis, radius),
        Vector3.multiplyScalar(normalizedYAxis, radius),
        Vector3.multiplyScalar(normalizedZAxis, segmentLength),
      );
    },

    // Membuat matriks proyeksi perspektif 4x4 berdasarkan parameter fov, aspek, near, dan far.
    perspective: (fieldOfViewYRadians, aspectRatio, nearPlaneDistance, farPlaneDistance) => {
      const focalLength = 1 / Math.tan(fieldOfViewYRadians / 2);
      const depthRangeInverse = 1 / (nearPlaneDistance - farPlaneDistance);
      const projectionMatrix = new Float32Array(16);
      projectionMatrix[0] = focalLength / aspectRatio;
      projectionMatrix[5] = focalLength;
      projectionMatrix[10] = (farPlaneDistance + nearPlaneDistance) * depthRangeInverse;
      projectionMatrix[11] = -1;
      projectionMatrix[14] = 2 * farPlaneDistance * nearPlaneDistance * depthRangeInverse;
      return projectionMatrix;
    },

    // Membuat matriks view kamera (look-at) menghadap ke target dari posisi mata pengamat.
    lookAt: (eyePosition, targetPosition, upDirectionVector) => {
      const forwardDirection = Vector3.normalize(
        Vector3.subtract(eyePosition, targetPosition),
      );
      const rightDirection = Vector3.normalize(
        Vector3.cross(upDirectionVector, forwardDirection),
      );
      const calculatedUpDirection = Vector3.cross(forwardDirection, rightDirection);

      return new Float32Array([
        rightDirection[0],
        calculatedUpDirection[0],
        forwardDirection[0],
        0,
        rightDirection[1],
        calculatedUpDirection[1],
        forwardDirection[1],
        0,
        rightDirection[2],
        calculatedUpDirection[2],
        forwardDirection[2],
        0,
        -Vector3.dot(rightDirection, eyePosition),
        -Vector3.dot(calculatedUpDirection, eyePosition),
        -Vector3.dot(forwardDirection, eyePosition),
        1,
      ]);
    },

    // Menghitung invers (balikan) dari matriks 4x4 untuk mengubah ruang koordinat.
    invert: (sourceMatrix) => {
      const element00 = sourceMatrix[0], element01 = sourceMatrix[1], element02 = sourceMatrix[2], element03 = sourceMatrix[3];
      const element10 = sourceMatrix[4], element11 = sourceMatrix[5], element12 = sourceMatrix[6], element13 = sourceMatrix[7];
      const element20 = sourceMatrix[8], element21 = sourceMatrix[9], element22 = sourceMatrix[10], element23 = sourceMatrix[11];
      const element30 = sourceMatrix[12], element31 = sourceMatrix[13], element32 = sourceMatrix[14], element33 = sourceMatrix[15];

      const minor00 = element00 * element11 - element01 * element10;
      const minor01 = element00 * element12 - element02 * element10;
      const minor02 = element00 * element13 - element03 * element10;
      const minor03 = element01 * element12 - element02 * element11;
      const minor04 = element01 * element13 - element03 * element11;
      const minor05 = element02 * element13 - element03 * element12;
      const minor06 = element20 * element31 - element21 * element30;
      const minor07 = element20 * element32 - element22 * element30;
      const minor08 = element20 * element33 - element23 * element30;
      const minor09 = element21 * element32 - element22 * element31;
      const minor10 = element21 * element33 - element23 * element31;
      const minor11 = element22 * element33 - element23 * element32;

      let determinant =
        minor00 * minor11 - minor01 * minor10 + minor02 * minor09 +
        minor03 * minor08 - minor04 * minor07 + minor05 * minor06;

      if (!determinant) return Matrix4.identity();
      const inverseDeterminant = 1 / determinant;

      const invertedMatrix = new Float32Array(16);
      invertedMatrix[0] = (element11 * minor11 - element12 * minor10 + element13 * minor09) * inverseDeterminant;
      invertedMatrix[1] = (element02 * minor10 - element01 * minor11 - element03 * minor09) * inverseDeterminant;
      invertedMatrix[2] = (element31 * minor05 - element32 * minor04 + element33 * minor03) * inverseDeterminant;
      invertedMatrix[3] = (element22 * minor04 - element21 * minor05 - element23 * minor03) * inverseDeterminant;
      invertedMatrix[4] = (element12 * minor08 - element10 * minor11 - element13 * minor07) * inverseDeterminant;
      invertedMatrix[5] = (element00 * minor11 - element02 * minor08 + element03 * minor07) * inverseDeterminant;
      invertedMatrix[6] = (element32 * minor02 - element30 * minor05 - element33 * minor01) * inverseDeterminant;
      invertedMatrix[7] = (element20 * minor05 - element22 * minor02 + element23 * minor01) * inverseDeterminant;
      invertedMatrix[8] = (element10 * minor10 - element11 * minor08 + element13 * minor06) * inverseDeterminant;
      invertedMatrix[9] = (element01 * minor08 - element00 * minor10 - element03 * minor06) * inverseDeterminant;
      invertedMatrix[10] = (element30 * minor04 - element31 * minor02 + element33 * minor00) * inverseDeterminant;
      invertedMatrix[11] = (element21 * minor02 - element20 * minor04 - element23 * minor00) * inverseDeterminant;
      invertedMatrix[12] = (element11 * minor07 - element10 * minor09 - element12 * minor06) * inverseDeterminant;
      invertedMatrix[13] = (element00 * minor09 - element01 * minor07 + element02 * minor06) * inverseDeterminant;
      invertedMatrix[14] = (element31 * minor01 - element30 * minor03 - element32 * minor00) * inverseDeterminant;
      invertedMatrix[15] = (element20 * minor03 - element21 * minor01 + element22 * minor00) * inverseDeterminant;

      return invertedMatrix;
    },

    // Menghitung matriks normal 3x3 (invers transpose) dari matriks model 4x4 untuk pencahayaan.
    normalMatrix: (sourceMatrix4x4) => {
      const row0Column0 = sourceMatrix4x4[0], row1Column0 = sourceMatrix4x4[1], row2Column0 = sourceMatrix4x4[2];
      const row0Column1 = sourceMatrix4x4[4], row1Column1 = sourceMatrix4x4[5], row2Column1 = sourceMatrix4x4[6];
      const row0Column2 = sourceMatrix4x4[8], row1Column2 = sourceMatrix4x4[9], row2Column2 = sourceMatrix4x4[10];

      const cofactor00 = row1Column1 * row2Column2 - row1Column2 * row2Column1;
      const cofactor01 = -(row1Column0 * row2Column2 - row1Column2 * row2Column0);
      const cofactor02 = row1Column0 * row2Column1 - row1Column1 * row2Column0;
      const cofactor10 = -(row0Column1 * row2Column2 - row0Column2 * row2Column1);
      const cofactor11 = row0Column0 * row2Column2 - row0Column2 * row2Column0;
      const cofactor12 = -(row0Column0 * row2Column1 - row0Column1 * row2Column0);
      const cofactor20 = row0Column1 * row1Column2 - row0Column2 * row1Column1;
      const cofactor21 = -(row0Column0 * row1Column2 - row0Column2 * row1Column0);
      const cofactor22 = row0Column0 * row1Column1 - row0Column1 * row1Column0;

      const determinant =
        row0Column0 * cofactor00 + row0Column1 * cofactor01 + row0Column2 * cofactor02;
      const inverseDeterminant = Math.abs(determinant) > 1e-12 ? 1 / determinant : 0;

      return new Float32Array([
        cofactor00 * inverseDeterminant,
        cofactor01 * inverseDeterminant,
        cofactor02 * inverseDeterminant,
        cofactor10 * inverseDeterminant,
        cofactor11 * inverseDeterminant,
        cofactor12 * inverseDeterminant,
        cofactor20 * inverseDeterminant,
        cofactor21 * inverseDeterminant,
        cofactor22 * inverseDeterminant,
      ]);
    },
  };

  // Alias kompatibilitas
  Matrix4.point = Matrix4.transformPoint;
  Matrix4.mul = Matrix4.multiply;
  Matrix4.rotateAxis = Matrix4.rotationAxis;

  App.math.Matrix4 = Matrix4;
  App.math.Mat4 = Matrix4;
  App.math.T = Matrix4.translation;
  App.math.S = Matrix4.scaling;
  App.math.mul = Matrix4.multiply;
  App.math.rotationAxis = Matrix4.rotationAxis;

  window.JK = window.JK || {};
  window.JK.Matrix4 = Matrix4;
  window.JK.Mat4 = Matrix4;
  window.JK.T = Matrix4.translation;
  window.JK.S = Matrix4.scaling;
  window.JK.mul = Matrix4.multiply;
  window.JK.rotationAxis = Matrix4.rotationAxis;
})();
