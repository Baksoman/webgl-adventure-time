(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.gfx = App.gfx || {};

  const canvasElement = document.getElementById("stage");
  if (!canvasElement) {
    throw new Error("Elemen canvas #stage tidak ditemukan");
  }

  const glContext = canvasElement.getContext("webgl", {
    antialias: true,
    alpha: false,
  });
  if (!glContext) {
    alert("Browser Anda tidak mendukung WebGL");
    throw new Error("WebGL tidak tersedia");
  }

  /* ---------------- SHADER UTAMA (TOON SHADING + INVERTED HULL OUTLINE + RIM LIGHTING) ---------------- */
  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
    uniform float uOutline;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
      // uNormalMatrix = transpose(inverse(mat3(uModelMatrix))) → world-space normal
      vec3 worldNormal = normalize(uNormalMatrix * aNormal);
      vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
      worldPosition.xyz += worldNormal * uOutline;
      vWorldPos = worldPosition.xyz;
      vNormal = worldNormal;
      gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    uniform vec3 uColor;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientSky;
    uniform vec3 uAmbientGround;
    uniform vec3 uRimColor;
    uniform vec3 uEye;
    uniform float uSpec;
    uniform float uUnlit;
    uniform float uAlpha;
    uniform float uToon;
    uniform float uIsOutline;
    uniform float uRim;
    uniform vec3 uShade;
    uniform vec4 uCutA;
    uniform vec4 uCutB;

    void main() {
      if (uIsOutline > 0.5) {
        if (abs(vWorldPos.x - uCutA.x) < uCutA.y && vWorldPos.y > uCutA.z && vWorldPos.y < uCutA.w) discard;
        if (abs(vWorldPos.x - uCutB.x) < uCutB.y && vWorldPos.y > uCutB.z && vWorldPos.y < uCutB.w) discard;
        gl_FragColor = vec4(0.07, 0.05, 0.06, 1.0);
        return;
      }
      if (uUnlit > 0.5) {
        gl_FragColor = vec4(uColor, uAlpha);
        return;
      }

      vec3 normalVector = normalize(vNormal);
      vec3 lightDirection = normalize(uLightDir);
      vec3 viewDirection = normalize(uEye - vWorldPos);
      float normalDotLight = dot(normalVector, lightDirection);

      // Pencahayaan ambient hemisferik (langit dari atas, pantulan tanah dari bawah)
      float hemiMix = normalVector.y * 0.5 + 0.5;
      vec3 ambientLight = mix(uAmbientGround, uAmbientSky, hemiMix);

      vec3 finalColor;
      float specularHighlight = pow(max(dot(normalVector, normalize(lightDirection + viewDirection)), 0.0), 36.0);

      if (uToon > 0.5) {
        // Area bayangan mengambil warna ambient atmosfer lingkungan
        vec3 shadowColor = uColor * uShade * ambientLight * 1.55;
        // Midtone mendapat perpaduan halus ambient dan cahaya matahari/bulan
        vec3 midtoneColor = uColor * mix(ambientLight, uLightColor, 0.48);
        // Area terpapar cahaya langsung mengadopsi warna & intensitas cahaya lingkungan
        vec3 litColor = uColor * uLightColor * 1.12;

        finalColor = mix(shadowColor, midtoneColor, smoothstep(-0.06, 0.08, normalDotLight));
        finalColor = mix(finalColor, litColor, smoothstep(0.42, 0.58, normalDotLight));
        specularHighlight = smoothstep(0.48, 0.56, specularHighlight);
      } else {
        finalColor = uColor * (ambientLight * 0.75 + uLightColor * max(normalDotLight, 0.0));
        specularHighlight = specularHighlight * 0.8;
      }

      // Efek rim/backlight sinematik yang menyatu dengan atmosfer
      float rimFactor = 1.0 - max(dot(normalVector, viewDirection), 0.0);
      float rimBand = smoothstep(0.62, 0.78, rimFactor) * clamp(normalDotLight + 0.5, 0.12, 1.0);
      finalColor += uRimColor * (rimBand * 0.55 * uRim);
      finalColor += uLightColor * (specularHighlight * uSpec * 0.85);

      gl_FragColor = vec4(finalColor, uAlpha);
    }
  `;

  // Mengompilasi kode sumber shader (vertex shader atau fragment shader) WebGL.
  function compileShader(shaderType, sourceCode) {
    const shader = glContext.createShader(shaderType);
    glContext.shaderSource(shader, sourceCode);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
      const errorMessage = glContext.getShaderInfoLog(shader);
      console.error("Kesalahan kompilasi shader:", errorMessage);
      throw new Error("Gagal mengompilasi shader: " + errorMessage);
    }
    return shader;
  }

  // Membuat dan menautkan (link) program shader WebGL dari vertex dan fragment shader.
  function createShaderProgram(vertexSource, fragmentSource, attributeNames) {
    const shaderProgram = glContext.createProgram();
    glContext.attachShader(
      shaderProgram,
      compileShader(glContext.VERTEX_SHADER, vertexSource),
    );
    glContext.attachShader(
      shaderProgram,
      compileShader(glContext.FRAGMENT_SHADER, fragmentSource),
    );
    attributeNames.forEach((attributeName, attributeIndex) =>
      glContext.bindAttribLocation(shaderProgram, attributeIndex, attributeName),
    );
    glContext.linkProgram(shaderProgram);
    if (!glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS)) {
      console.error(
        "Kesalahan penautan program shader:",
        glContext.getProgramInfoLog(shaderProgram),
      );
    }
    return shaderProgram;
  }

  const mainProgram = createShaderProgram(vertexShaderSource, fragmentShaderSource, [
    "aPosition",
    "aNormal",
  ]);
  glContext.useProgram(mainProgram);

  const attributePositionLocation = 0;
  const attributeNormalLocation = 1;
  glContext.enableVertexAttribArray(attributePositionLocation);
  glContext.enableVertexAttribArray(attributeNormalLocation);

  const uniformLocations = {};
  [
    "uModelMatrix",
    "uViewMatrix",
    "uProjectionMatrix",
    "uNormalMatrix",
    "uOutline",
    "uColor",
    "uLightDir",
    "uLightColor",
    "uAmbientSky",
    "uAmbientGround",
    "uRimColor",
    "uEye",
    "uSpec",
    "uUnlit",
    "uAlpha",
    "uToon",
    "uIsOutline",
    "uRim",
    "uShade",
    "uCutA",
    "uCutB",
  ].forEach((uniformName) => {
    uniformLocations[uniformName] = glContext.getUniformLocation(
      mainProgram,
      uniformName,
    );
  });

  App.gfx.canvas = canvasElement;
  App.gfx.gl = glContext;
  App.gfx.program = mainProgram;
  App.gfx.attributePositionLocation = attributePositionLocation;
  App.gfx.attributeNormalLocation = attributeNormalLocation;
  App.gfx.uniformLocations = uniformLocations;

  // Alias kompatibilitas
  App.gfx.aPos = attributePositionLocation;
  App.gfx.aNorm = attributeNormalLocation;
  App.gfx.U = uniformLocations;

  window.JK = window.JK || {};
  window.JK.canvas = canvasElement;
  window.JK.gl = glContext;
  window.JK.program = mainProgram;
  window.JK.aPos = attributePositionLocation;
  window.JK.aNorm = attributeNormalLocation;
  window.JK.U = uniformLocations;
  window.JK.stats = { draws: 0 };
  window.JK.cfg = {
    SHADE_WARM: [0.66, 0.54, 0.58],
  };
})();
