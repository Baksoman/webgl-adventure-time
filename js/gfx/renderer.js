(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.gfx = App.gfx || {};
  const globalJK = window.JK;
  const glContext = globalJK.gl;
  const uniformLocations = globalJK.U;
  const attributePositionLocation = globalJK.aPos;
  const attributeNormalLocation = globalJK.aNorm;
  const Matrix4 = globalJK.Matrix4 || globalJK.Mat4;
  const Vector3 = globalJK.Vector3 || globalJK.V3;
  const globalAT = (window.AT = window.AT || {});

  const DEFAULT_SHADE_COLOR = (globalJK.cfg && globalJK.cfg.SHADE_WARM) || [
    0.66, 0.54, 0.58,
  ];

  // Membuat objek deskriptor bagian/part model untuk dimasukkan ke antrean render.
  function createRenderItem(
    mesh,
    color,
    specular = 0.1,
    outlineWidth = 0.5,
    extraProperties,
  ) {
    return Object.assign(
      {
        mesh,
        color,
        spec: specular,
        ow: outlineWidth,
        unlit: false,
        alpha: 1,
        shade: DEFAULT_SHADE_COLOR,
      },
      extraProperties,
    );
  }
  globalAT.mk = createRenderItem;

  // Mengambil atau membuat mesh bola kuadrik satuan untuk bayangan kontak tanah.
  let shadowMeshInstance = null;
  function getShadowMesh() {
    if (!shadowMeshInstance) {
      shadowMeshInstance = App.geom.quadrics.sphereMesh(glContext, 14, 8);
    }
    return shadowMeshInstance;
  }

  // Membuat item render bayangan lantai dasar dengan warna gelap transparan.
  function createBaseShadowItem() {
    return {
      mesh: getShadowMesh(),
      color: [0.03, 0.02, 0.05],
      spec: 0,
      ow: 0,
      unlit: true,
      alpha: 0.28,
      shade: DEFAULT_SHADE_COLOR,
    };
  }

  // Menambahkan bayangan kontak elips ke antrean render pada posisi lantai tertentu.
  function addContactShadow(
    drawList,
    positionX,
    positionZ,
    radiusX,
    radiusZ,
    customAlpha,
    positionY = 0,
  ) {
    const baseShadowItem = createBaseShadowItem();
    const shadowItem =
      customAlpha === undefined
        ? baseShadowItem
        : Object.assign({}, baseShadowItem, { alpha: customAlpha });

    drawList.push([
      shadowItem,
      Matrix4.chain(
        Matrix4.translation(positionX, positionY, positionZ),
        Matrix4.scaling(radiusX, 0.02, radiusZ),
      ),
    ]);
  }
  globalAT.shadow = addContactShadow;

  /* ---------------- PROGRAM SHADER LAYAR BMO (TEKSTUR 2D + SCANLINE CRT) ---------------- */

  // Mengompilasi shader khusus layar CRT karakter BMO.
  function compileScreenShader(shaderType, shaderSourceCode) {
    const shader = glContext.createShader(shaderType);
    glContext.shaderSource(shader, shaderSourceCode);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
      console.error(glContext.getShaderInfoLog(shader));
    }
    return shader;
  }

  const screenProgram = glContext.createProgram();
  glContext.attachShader(
    screenProgram,
    compileScreenShader(
      glContext.VERTEX_SHADER,
      `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform mat4 uModelMatrix, uViewMatrix, uProjectionMatrix;
      uniform vec2 uSize;
      varying vec2 vUV;
      void main() {
        vUV = aPosition.xy / uSize + 0.5;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
      `,
    ),
  );
  glContext.attachShader(
    screenProgram,
    compileScreenShader(
      glContext.FRAGMENT_SHADER,
      `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uGlow;
      void main() {
        vec3 color = texture2D(uTex, vUV).rgb;
        color *= 0.93 + 0.07 * sin(vUV.y * 300.0);
        color *= 1.0 - 0.32 * pow(length(vUV - 0.5) * 1.3, 2.0);
        gl_FragColor = vec4(color * uGlow, 1.0);
      }
      `,
    ),
  );
  glContext.bindAttribLocation(screenProgram, 0, "aPosition");
  glContext.bindAttribLocation(screenProgram, 1, "aNormal");
  glContext.linkProgram(screenProgram);

  const screenUniformLocations = {};
  [
    "uModelMatrix",
    "uViewMatrix",
    "uProjectionMatrix",
    "uSize",
    "uTex",
    "uGlow",
  ].forEach((uniformName) => {
    screenUniformLocations[uniformName] = glContext.getUniformLocation(
      screenProgram,
      uniformName,
    );
  });

  /* ---------------- PROGRAM SHADER DEKAL TEKS (TEKSTUR 2D BER-ALPHA TANPA EFEK CRT) ---------------- */

  const decalProgram = glContext.createProgram();
  glContext.attachShader(
    decalProgram,
    compileScreenShader(
      glContext.VERTEX_SHADER,
      `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform mat4 uModelMatrix, uViewMatrix, uProjectionMatrix;
      uniform vec2 uSize;
      varying vec2 vUV;
      void main() {
        vUV = aPosition.xy / uSize + 0.5;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
      `,
    ),
  );
  glContext.attachShader(
    decalProgram,
    compileScreenShader(
      glContext.FRAGMENT_SHADER,
      `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      void main() {
        gl_FragColor = texture2D(uTex, vUV);
      }
      `,
    ),
  );
  glContext.bindAttribLocation(decalProgram, 0, "aPosition");
  glContext.bindAttribLocation(decalProgram, 1, "aNormal");
  glContext.linkProgram(decalProgram);

  const decalUniformLocations = {};
  ["uModelMatrix", "uViewMatrix", "uProjectionMatrix", "uSize", "uTex"].forEach(
    (uniformName) => {
      decalUniformLocations[uniformName] = glContext.getUniformLocation(
        decalProgram,
        uniformName,
      );
    },
  );

  const mainShaderProgram = glContext.getParameter(glContext.CURRENT_PROGRAM);

  let currentViewMatrix = null;
  let currentProjectionMatrix = null;
  let currentOutlineWidth = 0.022;

  // Merender layar CRT dinamis BMO menggunakan framebuffer tekstur 2D.
  function drawScreen(renderItem, modelMatrix) {
    glContext.useProgram(screenProgram);
    glContext.uniformMatrix4fv(
      screenUniformLocations.uModelMatrix,
      false,
      modelMatrix,
    );
    glContext.uniformMatrix4fv(
      screenUniformLocations.uViewMatrix,
      false,
      currentViewMatrix,
    );
    glContext.uniformMatrix4fv(
      screenUniformLocations.uProjectionMatrix,
      false,
      currentProjectionMatrix,
    );
    glContext.uniform2fv(screenUniformLocations.uSize, renderItem.size);
    glContext.uniform1f(
      screenUniformLocations.uGlow,
      renderItem.glow === undefined ? 1.15 : renderItem.glow,
    );
    glContext.activeTexture(glContext.TEXTURE0);
    glContext.bindTexture(glContext.TEXTURE_2D, renderItem.tex());
    glContext.uniform1i(screenUniformLocations.uTex, 0);
    glContext.disable(glContext.BLEND);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, renderItem.mesh.pBuf);
    glContext.vertexAttribPointer(0, 3, glContext.FLOAT, false, 0, 0);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, renderItem.mesh.nBuf);
    glContext.vertexAttribPointer(1, 3, glContext.FLOAT, false, 0, 0);
    glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, renderItem.mesh.iBuf);
    glContext.drawElements(
      glContext.TRIANGLES,
      renderItem.mesh.count,
      glContext.UNSIGNED_SHORT,
      0,
    );
    glContext.useProgram(mainShaderProgram);
  }

  // Merender dekal teks 2D (tekstur ber-alpha) di permukaan model tanpa pencahayaan dan efek CRT.
  function drawDecal(renderItem, modelMatrix) {
    glContext.useProgram(decalProgram);
    glContext.uniformMatrix4fv(
      decalUniformLocations.uModelMatrix,
      false,
      modelMatrix,
    );
    glContext.uniformMatrix4fv(
      decalUniformLocations.uViewMatrix,
      false,
      currentViewMatrix,
    );
    glContext.uniformMatrix4fv(
      decalUniformLocations.uProjectionMatrix,
      false,
      currentProjectionMatrix,
    );
    glContext.uniform2fv(decalUniformLocations.uSize, renderItem.size);
    glContext.activeTexture(glContext.TEXTURE0);
    glContext.bindTexture(glContext.TEXTURE_2D, renderItem.tex());
    glContext.uniform1i(decalUniformLocations.uTex, 0);
    glContext.enable(glContext.BLEND);
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
    glContext.depthMask(false);
    glContext.disable(glContext.CULL_FACE);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, renderItem.mesh.pBuf);
    glContext.vertexAttribPointer(0, 3, glContext.FLOAT, false, 0, 0);
    glContext.bindBuffer(glContext.ARRAY_BUFFER, renderItem.mesh.nBuf);
    glContext.vertexAttribPointer(1, 3, glContext.FLOAT, false, 0, 0);
    glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, renderItem.mesh.iBuf);
    glContext.drawElements(
      glContext.TRIANGLES,
      renderItem.mesh.count,
      glContext.UNSIGNED_SHORT,
      0,
    );
    glContext.depthMask(true);
    glContext.disable(glContext.BLEND);
    glContext.enable(glContext.CULL_FACE);
    glContext.useProgram(mainShaderProgram);
  }

  // Merender satu item mesh dengan material toon, rim lighting, atau garis luar (outline).
  function drawRenderItem(
    renderItem,
    modelMatrix,
    isOutlinePass,
    outlineScale,
    renderContext,
  ) {
    if (renderItem.screen) {
      if (!isOutlinePass) {
        drawScreen(renderItem, modelMatrix);
      }
      return;
    }

    if (renderItem.decal) {
      if (!isOutlinePass) {
        drawDecal(renderItem, modelMatrix);
      }
      return;
    }

    glContext.uniformMatrix4fv(
      uniformLocations.uModelMatrix,
      false,
      modelMatrix,
    );
    glContext.uniformMatrix3fv(
      uniformLocations.uNormalMatrix,
      false,
      Matrix4.normalMatrix(modelMatrix),
    );
    glContext.uniform1f(
      uniformLocations.uOutline,
      isOutlinePass
        ? renderItem.ow * currentOutlineWidth * (outlineScale || 1)
        : 0.0,
    );
    glContext.uniform1f(uniformLocations.uIsOutline, isOutlinePass ? 1.0 : 0.0);
    glContext.uniform3fv(uniformLocations.uColor, renderItem.color);
    glContext.uniform1f(uniformLocations.uSpec, renderItem.spec);
    glContext.uniform1f(uniformLocations.uUnlit, renderItem.unlit ? 1.0 : 0.0);
    glContext.uniform1f(uniformLocations.uAlpha, renderItem.alpha);
    glContext.uniform3fv(
      uniformLocations.uShade,
      renderItem.shade || DEFAULT_SHADE_COLOR,
    );

    const cutPlanes =
      isOutlinePass && renderItem.cuts && renderContext
        ? typeof renderItem.cuts === "function"
          ? renderItem.cuts(renderContext)
          : renderItem.cuts
        : [];
    glContext.uniform4fv(uniformLocations.uCutA, cutPlanes[0] || [0, 0, 0, 0]);
    glContext.uniform4fv(uniformLocations.uCutB, cutPlanes[1] || [0, 0, 0, 0]);

    const mesh = renderItem.mesh;
    glContext.bindBuffer(glContext.ARRAY_BUFFER, mesh.pBuf);
    glContext.vertexAttribPointer(
      attributePositionLocation,
      3,
      glContext.FLOAT,
      false,
      0,
      0,
    );
    glContext.bindBuffer(glContext.ARRAY_BUFFER, mesh.nBuf);
    glContext.vertexAttribPointer(
      attributeNormalLocation,
      3,
      glContext.FLOAT,
      false,
      0,
      0,
    );
    glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, mesh.iBuf);
    glContext.drawElements(
      glContext.TRIANGLES,
      mesh.count,
      glContext.UNSIGNED_SHORT,
      0,
    );

    if (globalJK.stats) {
      globalJK.stats.draws++;
    }
  }

  // Menyesuaikan ukuran render canvas terhadap pixel density layar secara responsif.
  function resizeCanvas() {
    const canvas = globalJK.canvas;
    const devicePixelRatio =
      Math.min(window.devicePixelRatio || 1, 2) * (globalAT.quality || 1);
    const targetWidth = Math.max(
      1,
      Math.round(canvas.clientWidth * devicePixelRatio),
    );
    const targetHeight = Math.max(
      1,
      Math.round(canvas.clientHeight * devicePixelRatio),
    );
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }

  glContext.enable(glContext.DEPTH_TEST);
  glContext.enable(glContext.CULL_FACE);

  // Mengeksekusi multi-pass rendering (pass 1: inverted-hull outline, pass 2: toon fill) untuk satu frame.
  function render(drawList, camera, renderOptions) {
    resizeCanvas();
    const canvas = globalJK.canvas;
    const aspectRatio = canvas.width / canvas.height;
    glContext.viewport(0, 0, canvas.width, canvas.height);

    const backgroundColor = (renderOptions && renderOptions.bg) || [
      0.08, 0.09, 0.13,
    ];
    glContext.clearColor(
      backgroundColor[0],
      backgroundColor[1],
      backgroundColor[2],
      1,
    );
    glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);

    const viewMatrix = Matrix4.lookAt(camera.eye, camera.target, [0, 1, 0]);
    const fieldOfView =
      camera.fov * (aspectRatio < 1.2 ? Math.min(1.7, 1.2 / aspectRatio) : 1);
    const projectionMatrix = Matrix4.perspective(
      (fieldOfView * Math.PI) / 180,
      aspectRatio,
      0.3,
      140,
    );
    currentViewMatrix = viewMatrix;
    currentProjectionMatrix = projectionMatrix;

    const cameraDistance = Vector3.length(
      Vector3.subtract(camera.eye, camera.target),
    );
    currentOutlineWidth = 0.022 * (cameraDistance / 12);

    glContext.useProgram(mainShaderProgram);
    // uLightDir dikirim dalam world space agar konsisten dengan vNormal (world-space)
    // dan vWorldPos / uEye yang juga dalam world space.
    const worldLightDirection =
      renderOptions && renderOptions.lightDir
        ? Vector3.normalize(renderOptions.lightDir)
        : renderOptions && renderOptions.lightDirView
          ? // lightDirView: konversi dari view space ke world space menggunakan inverse view (= transpose view)
            (() => {
              const v = Vector3.normalize(renderOptions.lightDirView);
              return [0, 1, 2].map(
                (i) =>
                  viewMatrix[i] * v[0] +
                  viewMatrix[4 + i] * v[1] +
                  viewMatrix[8 + i] * v[2],
              );
            })()
          : Vector3.normalize([0.45, 0.9, 0.85]);

    glContext.uniformMatrix4fv(uniformLocations.uViewMatrix, false, viewMatrix);
    glContext.uniformMatrix4fv(
      uniformLocations.uProjectionMatrix,
      false,
      projectionMatrix,
    );
    glContext.uniform3fv(uniformLocations.uLightDir, worldLightDirection);
    glContext.uniform3fv(uniformLocations.uEye, camera.eye);
    glContext.uniform1f(
      uniformLocations.uToon,
      renderOptions && renderOptions.toon ? 1.0 : 0.0,
    );
    glContext.uniform1f(uniformLocations.uRim, 0.8);

    // Pass 1: Outline (Inverted Hull)
    if (renderOptions && renderOptions.outline) {
      glContext.disable(glContext.BLEND);
      glContext.cullFace(glContext.FRONT);
      glContext.depthFunc(glContext.LESS);
      for (let itemIndex = 0; itemIndex < drawList.length; itemIndex++) {
        const entry = drawList[itemIndex];
        const item = entry[0];
        if (item.ow > 0 && !item.unlit && !item.screen) {
          drawRenderItem(item, entry[1], true, entry[2], entry[3]);
        }
      }
    }

    // Pass 2: Color Fill (Toon Shading)
    glContext.cullFace(glContext.BACK);
    glContext.depthFunc(glContext.LEQUAL);
    for (let itemIndex = 0; itemIndex < drawList.length; itemIndex++) {
      const entry = drawList[itemIndex];
      const item = entry[0];
      if (item.alpha < 1) {
        glContext.enable(glContext.BLEND);
        glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
        glContext.depthMask(false);
      } else {
        glContext.disable(glContext.BLEND);
        glContext.depthMask(true);
      }
      drawRenderItem(item, entry[1], false, entry[2], entry[3]);
    }
    glContext.depthMask(true);
    globalAT.lastVP = Matrix4.multiply(projectionMatrix, viewMatrix);
  }

  globalAT.render = render;
  App.gfx.renderer = {
    render,
    drawItem: drawRenderItem,
    shadow: addContactShadow,
  };
})();
