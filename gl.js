export const bind = (canvas) => {
  const gl = canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL is not supported');

  const vertexSource = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
  let program = null, fragmentSource = null;
  const uniforms = new Map();

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

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
  }

  const createProgram = (fragment) => {
    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed:\n\n${log}`);
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  const fragment = (source) => {
    const nextProgram = createProgram(source);
    if (program) gl.deleteProgram(program);
    program = nextProgram;
    fragmentSource = source;
    return api;
  }

  const uniform = (name, value) => {
    uniforms.set(name, value);
    return api;
  }

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
      throw new Error(`Unsupported uniform "${name}" with ${value.length} components`);
    }

    throw new Error(`Unsupported value for uniform "${name}"`);
  }

  const render = () => {
    if (!program) throw new Error('No fragment shader has been provided');

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const [name, value] of uniforms) setUniform(name, value);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const api = { canvas, fragment, uniform, render };
  return api;
}