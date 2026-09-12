// AMD FidelityFX Super Resolution 1.0 (FSR1) - EASU (edge-adaptive spatial upscale) + RCAS
// (robust contrast-adaptive sharpen), ported from AMD's official MIT-licensed reference
// (github.com/GPUOpen-Effects/FidelityFX-FSR, ffx-fsr/ffx_fsr1.h, the NON-PACKED 32-BIT
// path) to GLSL ES 3.00 for WebGL2, for use as Babylon.js PostProcesses.
//
// SCOPE OF THIS PASS (read before enabling): this attaches EASU+RCAS at a 1:1 input:output
// ratio - i.e. it runs at whatever resolution the camera is ALREADY rendering at (still
// controlled by engine.setHardwareScalingLevel exactly as before, completely untouched by
// this file). At 1:1 it behaves as an edge-aware reconstruction/sharpen pass (recovers
// detail SSAO/bloom/TAA blur softens, without the halo a naive unsharp-mask sharpen adds) -
// a real, low-risk, purely-additive quality win. It is NOT yet doing FSR's other, bigger
// job (render at a lower internal resolution than the display and let EASU do the actual
// upscale) - that requires decoupling the scene+DefaultRenderingPipeline's render
// resolution from the canvas' own backing-store resolution (via something like
// camera.outputRenderTarget), which was investigated and deliberately deferred: this app's
// DefaultRenderingPipeline instances are anchored to engine.getRenderWidth()/Height()
// directly (see Babylon's own defaultRenderingPipeline.pure.js), the same value
// engine.setHardwareScalingLevel controls, so forcing that value down while keeping the
// canvas' actual backing store at full native resolution needs restructuring that hasn't
// been live-tested. Safer to ship the verified-safe half now than guess at the riskier half
// blind.
//
// Requires WebGL2 (textureGather has no WebGL1 equivalent) - this app already requires
// WebGL2 for CSM shadows, so that's not a new constraint.
import { Camera, Constants, Effect, PostProcess } from '@babylonjs/core';

let shadersRegistered = false;

function registerFSRShaders(): void {
  if (shadersRegistered) return;
  shadersRegistered = true;

  // `#version 300 es` at the top makes Babylon's shader processor treat this fragment
  // shader as already-converted GLSL ES 300 and skip its usual ES100->ES300 auto-translation
  // (see ProcessShaderConversion in @babylonjs/core's shaderProcessor.js, which strips a
  // literal "#version 300 es" it finds in the source and returns early). The paired vertex
  // shader is Babylon's own built-in postprocess.vertex.fx, written in older
  // attribute/varying syntax - that one DOES still go through Babylon's normal
  // auto-translation to ES300 when the engine is WebGL2, so both stages still end up as
  // matching GLSL ES 300 at link time (WebGL2 requires every stage in a program to agree on
  // GLSL version).
  Effect.ShadersStore['fsrEasuFragmentShader'] = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 glFragColor;
uniform sampler2D textureSampler;
uniform vec4 easuCon0;
uniform vec4 easuCon1;
uniform vec4 easuCon2;
uniform vec4 easuCon3;

vec4 fsrEasuR(vec2 p) { return textureGather(textureSampler, p, 0); }
vec4 fsrEasuG(vec2 p) { return textureGather(textureSampler, p, 1); }
vec4 fsrEasuB(vec2 p) { return textureGather(textureSampler, p, 2); }

void fsrEasuTap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len, float lob, float clp, vec3 c) {
  vec2 v;
  v.x = (off.x * dir.x) + (off.y * dir.y);
  v.y = (off.x * -dir.y) + (off.y * dir.x);
  v *= len;
  float d2 = min(v.x * v.x + v.y * v.y, clp);
  float wB = (2.0 / 5.0) * d2 - 1.0;
  float wA = lob * d2 - 1.0;
  wB *= wB;
  wA *= wA;
  wB = (25.0 / 16.0) * wB - (25.0 / 16.0 - 1.0);
  float w = wB * wA;
  aC += c * w;
  aW += w;
}

void fsrEasuSet(inout vec2 dir, inout float len, vec2 pp, bool biS, bool biT, bool biU, bool biV, float lA, float lB, float lC, float lD, float lE) {
  float w = 0.0;
  if (biS) w = (1.0 - pp.x) * (1.0 - pp.y);
  if (biT) w = pp.x * (1.0 - pp.y);
  if (biU) w = (1.0 - pp.x) * pp.y;
  if (biV) w = pp.x * pp.y;
  float dc = lD - lC;
  float cb = lC - lB;
  float lenX = max(abs(dc), abs(cb));
  lenX = 1.0 / max(lenX, 1e-8);
  float dirX = lD - lB;
  dir.x += dirX * w;
  lenX = clamp(abs(dirX) * lenX, 0.0, 1.0);
  lenX *= lenX;
  len += lenX * w;
  float ec = lE - lC;
  float ca = lC - lA;
  float lenY = max(abs(ec), abs(ca));
  lenY = 1.0 / max(lenY, 1e-8);
  float dirY = lE - lA;
  dir.y += dirY * w;
  lenY = clamp(abs(dirY) * lenY, 0.0, 1.0);
  lenY *= lenY;
  len += lenY * w;
}

void main() {
  vec2 ip = floor(gl_FragCoord.xy);
  vec2 pp = ip * easuCon0.xy + easuCon0.zw;
  vec2 fp = floor(pp);
  pp -= fp;

  vec2 p0 = fp * easuCon1.xy + easuCon1.zw;
  vec2 p1 = p0 + easuCon2.xy;
  vec2 p2 = p0 + easuCon2.zw;
  vec2 p3 = p0 + easuCon3.xy;

  vec4 bczzR = fsrEasuR(p0), bczzG = fsrEasuG(p0), bczzB = fsrEasuB(p0);
  vec4 ijfeR = fsrEasuR(p1), ijfeG = fsrEasuG(p1), ijfeB = fsrEasuB(p1);
  vec4 klhgR = fsrEasuR(p2), klhgG = fsrEasuG(p2), klhgB = fsrEasuB(p2);
  vec4 zzonR = fsrEasuR(p3), zzonG = fsrEasuG(p3), zzonB = fsrEasuB(p3);

  vec4 bczzL = bczzB * 0.5 + (bczzR * 0.5 + bczzG);
  vec4 ijfeL = ijfeB * 0.5 + (ijfeR * 0.5 + ijfeG);
  vec4 klhgL = klhgB * 0.5 + (klhgR * 0.5 + klhgG);
  vec4 zzonL = zzonB * 0.5 + (zzonR * 0.5 + zzonG);

  float bL = bczzL.x;
  float cL = bczzL.y;
  float iL = ijfeL.x;
  float jL = ijfeL.y;
  float fL = ijfeL.z;
  float eL = ijfeL.w;
  float kL = klhgL.x;
  float lL = klhgL.y;
  float hL = klhgL.z;
  float gL = klhgL.w;
  float oL = zzonL.z;
  float nL = zzonL.w;

  vec2 dir = vec2(0.0);
  float len = 0.0;
  fsrEasuSet(dir, len, pp, true, false, false, false, bL, eL, fL, gL, jL);
  fsrEasuSet(dir, len, pp, false, true, false, false, cL, fL, gL, hL, kL);
  fsrEasuSet(dir, len, pp, false, false, true, false, fL, iL, jL, kL, nL);
  fsrEasuSet(dir, len, pp, false, false, false, true, gL, jL, kL, lL, oL);

  vec2 dir2 = dir * dir;
  float dirR = dir2.x + dir2.y;
  bool zro = dirR < (1.0 / 32768.0);
  dirR = zro ? 1.0 : inversesqrt(max(dirR, 1e-12));
  dir.x = zro ? 1.0 : dir.x;
  dir *= vec2(dirR);

  len = len * 0.5;
  len *= len;
  float stretch = (dir.x * dir.x + dir.y * dir.y) / max(max(abs(dir.x), abs(dir.y)), 1e-8);
  vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
  float lob = 0.5 + ((1.0 / 4.0 - 0.04) - 0.5) * len;
  float clp = 1.0 / max(lob, 1e-8);

  vec3 min4 = min(min(min(vec3(ijfeR.z, ijfeG.z, ijfeB.z), vec3(klhgR.w, klhgG.w, klhgB.w)), vec3(ijfeR.y, ijfeG.y, ijfeB.y)), vec3(klhgR.x, klhgG.x, klhgB.x));
  vec3 max4 = max(max(max(vec3(ijfeR.z, ijfeG.z, ijfeB.z), vec3(klhgR.w, klhgG.w, klhgB.w)), vec3(ijfeR.y, ijfeG.y, ijfeB.y)), vec3(klhgR.x, klhgG.x, klhgB.x));

  vec3 aC = vec3(0.0);
  float aW = 0.0;
  fsrEasuTap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, vec3(bczzR.x, bczzG.x, bczzB.x));
  fsrEasuTap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, vec3(bczzR.y, bczzG.y, bczzB.y));
  fsrEasuTap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, vec3(ijfeR.x, ijfeG.x, ijfeB.x));
  fsrEasuTap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, vec3(ijfeR.y, ijfeG.y, ijfeB.y));
  fsrEasuTap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, vec3(ijfeR.z, ijfeG.z, ijfeB.z));
  fsrEasuTap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, vec3(ijfeR.w, ijfeG.w, ijfeB.w));
  fsrEasuTap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, vec3(klhgR.x, klhgG.x, klhgB.x));
  fsrEasuTap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, vec3(klhgR.y, klhgG.y, klhgB.y));
  fsrEasuTap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, vec3(klhgR.z, klhgG.z, klhgB.z));
  fsrEasuTap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, vec3(klhgR.w, klhgG.w, klhgB.w));
  fsrEasuTap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, vec3(zzonR.z, zzonG.z, zzonB.z));
  fsrEasuTap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, vec3(zzonR.w, zzonG.w, zzonB.w));

  vec3 pix = min(max4, max(min4, aC / max(aW, 1e-8)));
  glFragColor = vec4(pix, 1.0);
}
`;

  Effect.ShadersStore['fsrRcasFragmentShader'] = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 glFragColor;
uniform sampler2D textureSampler;
uniform float rcasSharpness;

void main() {
  ivec2 sp = ivec2(gl_FragCoord.xy);
  vec3 b = texelFetch(textureSampler, sp + ivec2(0, -1), 0).rgb;
  vec3 d = texelFetch(textureSampler, sp + ivec2(-1, 0), 0).rgb;
  vec3 e = texelFetch(textureSampler, sp, 0).rgb;
  vec3 f = texelFetch(textureSampler, sp + ivec2(1, 0), 0).rgb;
  vec3 h = texelFetch(textureSampler, sp + ivec2(0, 1), 0).rgb;

  vec3 mn4 = min(min(min(b, d), f), h);
  vec3 mx4 = max(max(max(b, d), f), h);

  vec2 peakC = vec2(1.0, -4.0);
  vec3 hitMin = min(mn4, e) / max(4.0 * mx4, 1e-6);
  vec3 hitMax = (peakC.x - max(mx4, e)) / max(4.0 * mn4 + peakC.y, -1e-6 + peakC.y);
  vec3 lobeRGB = max(-hitMin, hitMax);
  float lobe = max(-(0.25 - 1.0 / 16.0), min(max(max(lobeRGB.r, lobeRGB.g), lobeRGB.b), 0.0)) * rcasSharpness;

  float rcpL = 1.0 / (4.0 * lobe + 1.0);
  vec3 pix = (lobe * b + lobe * d + lobe * h + lobe * f + e) * rcpL;
  glFragColor = vec4(pix, 1.0);
}
`;
}

export interface FSRHandle {
  readonly easu: PostProcess;
  readonly rcas: PostProcess;
  setSharpness: (stops: number) => void;
  dispose: () => void;
}

/**
 * Attaches FSR1 EASU+RCAS to the end of `camera`'s post-process chain, at the camera's
 * current render resolution (see the file header for what this does and doesn't do yet).
 * Works for any Camera, including a WebXRCamera - Babylon's Camera.attachPostProcess cascades
 * whatever is attached on a rig-parent camera down to its per-eye rig cameras automatically
 * (see Camera._cascadePostProcessesToRigCams in @babylonjs/core), so calling this once on
 * scene.activeCamera when it becomes the XR camera is enough to cover VR/AR too - no
 * separate per-eye wiring needed.
 *
 * `sharpnessStops` follows FSR's own convention: 0.0 = maximum sharpness, each +1.0 halves
 * the effect.
 */
export function attachFSR(camera: Camera, sharpnessStops = 0.2): FSRHandle {
  registerFSRShaders();
  const engine = camera.getEngine();

  const con0 = [1, 1, -0.5, -0.5];
  const con1 = [0, 0, 0, 0];
  const con2 = [0, 0, 0, 0];
  const con3 = [0, 0, 0, 0];

  const updateEasuConstants = () => {
    const w = Math.max(1, engine.getRenderWidth());
    const h = Math.max(1, engine.getRenderHeight());
    // FsrEasuCon (ffx_fsr1.h) with inputViewport == inputSize == outputSize (1:1 - see file
    // header for why this pass doesn't yet do a real resolution change).
    con0[0] = 1;
    con0[1] = 1;
    con0[2] = -0.5;
    con0[3] = -0.5;
    con1[0] = 1 / w;
    con1[1] = 1 / h;
    con1[2] = 1 / w;
    con1[3] = -1 / h;
    con2[0] = -1 / w;
    con2[1] = 2 / h;
    con2[2] = 1 / w;
    con2[3] = 2 / h;
    con3[0] = 0;
    con3[1] = 4 / h;
    con3[2] = 0;
    con3[3] = 0;
  };
  updateEasuConstants();

  const easu = new PostProcess(
    'fsrEasu',
    'fsrEasu',
    ['easuCon0', 'easuCon1', 'easuCon2', 'easuCon3'],
    null,
    1.0,
    camera,
    Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
    engine
  );
  easu.onSizeChangedObservable.add(updateEasuConstants);
  easu.onApply = (effect) => {
    effect.setFloat4('easuCon0', con0[0], con0[1], con0[2], con0[3]);
    effect.setFloat4('easuCon1', con1[0], con1[1], con1[2], con1[3]);
    effect.setFloat4('easuCon2', con2[0], con2[1], con2[2], con2[3]);
    effect.setFloat4('easuCon3', con3[0], con3[1], con3[2], con3[3]);
  };

  let sharpnessLinear = Math.pow(2, -sharpnessStops);
  const rcas = new PostProcess(
    'fsrRcas',
    'fsrRcas',
    ['rcasSharpness'],
    null,
    1.0,
    camera,
    Constants.TEXTURE_NEAREST_SAMPLINGMODE,
    engine
  );
  rcas.onApply = (effect) => {
    effect.setFloat('rcasSharpness', sharpnessLinear);
  };

  return {
    easu,
    rcas,
    setSharpness: (stops: number) => {
      sharpnessLinear = Math.pow(2, -stops);
    },
    dispose: () => {
      camera.detachPostProcess(easu);
      camera.detachPostProcess(rcas);
      easu.dispose(camera);
      rcas.dispose(camera);
    },
  };
}
