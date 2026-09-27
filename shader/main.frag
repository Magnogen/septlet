precision highp float;

#define MAX_NODES 512

uniform float time;
uniform vec2 res;
uniform vec2 pos[MAX_NODES];
uniform float r[MAX_NODES];
uniform int TOTAL_NODES;

float sdCircle(vec2 p, float radius) {
  return length(p) - radius;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;

  float minimum_dist = 100.0;
  for (int i = 0; i < MAX_NODES; i++) {
    if (i >= TOTAL_NODES) continue;
    float dist = sdCircle(uv - pos[i], r[i]);
    minimum_dist = min(dist, minimum_dist);
  }

  if (minimum_dist < 0.0) {
    gl_FragColor = vec4(uv, 0.5, 1.0);
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }


}