/********************************************************************
  Neural‑Mosaic Pulse Shader  
********************************************************************/

uniform float uSeed;              // randomise pattern externally

// ------------------ utility ---------------------------------------
float hash21(vec2 p)
{
    p = fract(p * vec2(223.34, 456.21) + uSeed);
    p += dot(p, p + 45.32 + uSeed);
    return fract(p.x * p.y);
}

float vnoise(vec2 p)
{
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1., 0.));
    float c = hash21(i + vec2(0., 1.));
    float d = hash21(i + vec2(1., 1.));
    vec2  u = f * f * (3. - 2. * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p)
{
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; ++i) {
        v += a * vnoise(p);
        p *= 2.1;
        a *= 0.55;
    }
    return v;
}

// HSV → RGB
vec3 hsv2rgb(vec3 c)
{
    vec3 p = abs(fract(c.x + vec3(0., 2./3., 1./3.)) * 6. - 4.);
    return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y);
}

// ------------------ main ------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // --- coordinate prep (aspect‑correct, centred) ----------------
    vec2 uv = fragCoord.xy / iResolution.xy - 0.5;
    uv.x *= iResolution.x / iResolution.y;

    // --- pixelation ----------------------------------------------
    const float pixelSize = 1.0;
    vec2 pxy = floor(fragCoord.xy / pixelSize) * pixelSize;
    vec2 puv = pxy / iResolution.xy - 0.5;
    puv.x *= iResolution.x / iResolution.y;

    // --- scalar field & ridges ------------------------------------
    float field     = fbm(puv * 2.0);
    float ridgeMask = smoothstep(0.25, 0.05, abs(fract(field * 100.0) - 0.2));
    float pulse     = 0.5 + 0.5 * sin(field * 50.0 - iTime * 4.0);
    float intensity = mix(0.15, 1.0, ridgeMask * pulse);

    // ----------- colour map ---------------------------------------

    float hue;
    if (field < 0.3)
        hue = mix(0.85, 0.50, field / 0.30);
    else
        hue = mix(0.0, 0.7, (field - 0.30) / 0.30);

    // brightness holds until field≈0.6, then falls to 0 → black
    float value = intensity * (1.0 - smoothstep(0.50, 1.0, field));

    vec3 color = hsv2rgb(vec3(fract(hue), 1.0, value));
    fragColor  = vec4(color, 1.0);
}
