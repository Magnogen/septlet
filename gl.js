export const bindPipeline = (canvas, options = {}) => {
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? true,
  });
  if (!gl) throw new Error('WebGL is not supported');

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  let program = null;
  let fragmentSource = null;
  const uniforms = new Map();

  // Full-screen quad
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  // Lazy-initialized Framebuffer Objects
  let ping = null;
  let pong = null;

  const createFBO = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0
    );

    return { fbo, texture };
  };

  const ensureFBOs = () => {
    if (!ping) ping = createFBO();
    if (!pong) pong = createFBO();
  };

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed:\n\n${log}`);
    }
    return shader;
  };

  const createProgram = (fragment) => {
    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
    const prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program linking failed:\n\n${log}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return prog;
  };

  const fragment = (source) => {
    const nextProgram = createProgram(source);
    if (program) gl.deleteProgram(program);
    program = nextProgram;
    fragmentSource = source;
    return api;
  };

  const uniform = (name, value) => {
    uniforms.set(name, value);
    return api;
  };

  const setUniform = (name, value) => {
    const location = gl.getUniformLocation(program, name);
    if (location === null) return;

    if (typeof value === 'number') {
      gl.uniform1f(location, value);
      return;
    }

    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      if (value.length >= 2 && value.length <= 4) {
        gl[`uniform${value.length}fv`](location, value);
        return;
      }
      throw new Error(`Unsupported uniform "${name}" with length ${value.length}`);
    }

    throw new Error(`Unsupported value for uniform "${name}"`);
  };

  const bindAttributesAndUniforms = () => {
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const [name, value] of uniforms) setUniform(name, value);
  };

  const render = (renderOpts = {}) => {
    if (!program) throw new Error('No fragment shader provided');

    const isFeedback = renderOpts.feedback;
    const samplerName = renderOpts.sampler ?? 'u_prevFrame';

    if (!isFeedback) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      bindAttributesAndUniforms();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return api;
    }

    ensureFBOs();

    gl.bindFramebuffer(gl.FRAMEBUFFER, pong.fbo);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bindAttributesAndUniforms();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping.texture);

    const samplerLoc = gl.getUniformLocation(program, samplerName);
    if (samplerLoc !== null) {
      gl.uniform1i(samplerLoc, 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [ping, pong] = [pong, ping];

    return api;
  };

  const seedBuffer = (imageData) => {
    ensureFBOs();
    gl.bindTexture(gl.TEXTURE_2D, ping.texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      imageData instanceof ImageData ? imageData.data : imageData
    );
    return api;
  };

  return {
    canvas,
    gl,
    fragment,
    uniform,
    render,
    seedBuffer,
  };
};
