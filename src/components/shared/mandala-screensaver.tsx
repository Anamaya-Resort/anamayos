'use client';

import { useEffect, useRef } from 'react';

/**
 * SVG Mandala Screensaver — procedurally generated rotating mandala.
 * Adapted from CodePen, uses brand colors.
 */

const FILL = 'transparent';
const BASE_ANGULAR_VELOCITY = 15;

interface MandalaProps {
  strokeColor: string;
  accentColor: string;
  strokeWidth: number;
  size: number;
}

// --- SVG element helpers ---

function el(type: string, attrs: Record<string, string> = {}, children: SVGElement[] = []): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', type);
  for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(null, k, v);
  for (const c of children) e.appendChild(c);
  return e;
}

function circle(r: number, stroke: string, sw: number): SVGElement {
  return el('circle', { r: String(r), stroke, fill: FILL, 'stroke-width': String(sw) });
}

function path(d: string, stroke: string, sw: number): SVGElement {
  return el('path', { d, stroke, fill: FILL, 'stroke-width': String(sw) });
}

function group(transform: string, children: SVGElement[]): SVGElement {
  return el('g', { transform }, children);
}

function rotVec(x: number, y: number, deg: number): [number, number] {
  const r = deg * Math.PI / 180;
  return [Math.cos(r) * x - Math.sin(r) * y, Math.sin(r) * x + Math.cos(r) * y];
}

function tf(x: number, y: number, phi = 0): string {
  let s = '';
  if (phi) s += `rotate(${phi},${x},${y}) `;
  s += `translate(${x},${y})`;
  return s;
}

// --- Component types ---

interface Comp {
  el: SVGElement;
  pos: [number, number];
  phi: number;
  av: number; // angular velocity
  children: Comp[];
  radius?: number;
  dRadius?: number;
  phase?: number;
  transform: (t: number) => void;
}

function makeComp(config: {
  el: SVGElement;
  pos?: [number, number];
  phi?: number;
  av?: number;
  children?: Comp[];
  radius?: number;
  dRadius?: number;
  phase?: number;
}): Comp {
  const pos = config.pos ?? [0, 0];
  const phi = config.phi ?? 0;
  const av = config.av ?? 0;
  const children = config.children ?? [];
  const comp: Comp = {
    el: config.el,
    pos,
    phi,
    av,
    children,
    radius: config.radius,
    dRadius: config.dRadius,
    phase: config.phase,
    transform(t: number) {
      if (this.av) {
        this.el.setAttributeNS(null, 'transform', tf(this.pos[0], this.pos[1], this.phi + t * this.av));
      }
      if (this.radius !== undefined && this.dRadius) {
        const theta = t * (this.av || BASE_ANGULAR_VELOCITY) * Math.PI / 180 + (this.phase ?? 0) * Math.PI / 180;
        this.el.setAttributeNS(null, 'r', String(this.radius + this.dRadius * Math.sin(theta)));
      }
    },
  };
  return comp;
}

function transformAll(t: number, c: Comp) {
  c.transform(t);
  for (const ch of c.children) transformAll(t, ch);
}

// --- Mandala builder ---

function buildMandala(stroke: string, accent: string, sw: number): Comp {
  function c(r: number) { return circle(r, stroke, sw); }
  function cA(r: number) { return circle(r, accent, sw); }
  function p(d: string) { return path(d, stroke, sw); }
  function pA(d: string) { return path(d, accent, sw); }

  function tearDrop(a: number, b: number, m: number, color = stroke): SVGElement {
    let d = '';
    for (let i = 0; i < 360; i++) {
      const rad = i * Math.PI / 180;
      const x = a * Math.cos(rad);
      const y = b * Math.sin(rad) * Math.pow(Math.sin(rad / 2), m);
      d += `${i ? 'L' : 'M'}${x},${y} `;
    }
    return path(d + 'Z', color, sw);
  }

  function ring(steps: number, dist: number, component: () => SVGElement, av = 0, init = 0): Comp {
    const kids: Comp[] = [];
    const dTheta = 360 / steps;
    for (let i = 0; i < steps; i++) {
      const angle = init + dTheta * i;
      const [x, y] = rotVec(dist, 0, angle);
      const child = makeComp({
        el: group(tf(x, y, angle), [component()]),
        pos: [x, y],
        phi: angle,
      });
      kids.push(child);
    }
    const g = group('', kids.map(k => k.el));
    return makeComp({ el: g, av, children: kids });
  }

  function circleRing(steps: number, dist: number, r: number, av = 0, init = 0) {
    return ring(steps, dist, () => c(r), av, init);
  }

  function lineRing(steps: number, len: number, av = 0) {
    return ring(steps, 0, () => p(`M0,0 L${len},0`), av);
  }

  function tearRing(steps: number, dist: number, a: number, b: number, m: number, av = 0, init = 0, color = stroke) {
    return ring(steps, dist, () => tearDrop(a, b, m, color), av, init);
  }

  // Build the three rings
  const outer: SVGElement[] = [];
  const outerComps: Comp[] = [];

  // Outer circles
  outer.push(c(500), c(490), c(475));
  const cr1 = circleRing(48, 450, 10);
  outer.push(cr1.el);
  outerComps.push(cr1);
  outer.push(c(430), c(420));

  // Spoke lines
  const spokes1 = lineRing(48, 420, -0.5 * BASE_ANGULAR_VELOCITY);
  outer.push(spokes1.el);
  outerComps.push(spokes1);
  const spokes2 = lineRing(48, 420);
  outer.push(spokes2.el);
  outerComps.push(spokes2);

  // Petals
  const petals1 = tearRing(6, 350, 100, 150, 1.5, -0.5 * BASE_ANGULAR_VELOCITY, 30, accent);
  outer.push(petals1.el);
  outerComps.push(petals1);

  const petals2 = tearRing(6, 350, 120, 150, 1.25, -0.5 * BASE_ANGULAR_VELOCITY, 0, stroke);
  outer.push(petals2.el);
  outerComps.push(petals2);

  // Foreground petals
  const petals3 = tearRing(6, 350, 140, 220, 1.75, BASE_ANGULAR_VELOCITY, 0, accent);
  outer.push(petals3.el);
  outerComps.push(petals3);
  const petals4 = tearRing(6, 350, 110, 160, 1.5, BASE_ANGULAR_VELOCITY, 0, stroke);
  outer.push(petals4.el);
  outerComps.push(petals4);

  // Inner rings
  outer.push(c(300));
  const cr2 = circleRing(48, 330, 7);
  outer.push(cr2.el);
  outerComps.push(cr2);

  // Middle ring
  const middle: SVGElement[] = [];
  const middleComps: Comp[] = [];
  middle.push(c(300), c(290));
  const cr3 = circleRing(24, 258, 30);
  middle.push(cr3.el);
  middleComps.push(cr3);
  middle.push(c(260), c(250));
  const spokes3 = lineRing(24, 250, -BASE_ANGULAR_VELOCITY);
  middle.push(spokes3.el);
  middleComps.push(spokes3);
  middle.push(c(233));

  const midPetals1 = tearRing(6, 160, 50, 130, 2.5, BASE_ANGULAR_VELOCITY, 0, accent);
  middle.push(midPetals1.el);
  middleComps.push(midPetals1);
  const midPetals2 = tearRing(6, 110, 100, 155, 2, BASE_ANGULAR_VELOCITY, 30, stroke);
  middle.push(midPetals2.el);
  middleComps.push(midPetals2);
  const midPetals3 = tearRing(6, 110, 80, 120, 2.3, BASE_ANGULAR_VELOCITY, 30, accent);
  middle.push(midPetals3.el);
  middleComps.push(midPetals3);

  const cr4 = circleRing(12, 150, 10);
  middle.push(cr4.el);
  middleComps.push(cr4);

  // Inner ring
  const inner: SVGElement[] = [];
  const innerComps: Comp[] = [];
  inner.push(c(105), cA(95));
  const innerPetals1 = tearRing(6, 60, 40, 40, 2, 0, 30, accent);
  inner.push(innerPetals1.el);
  innerComps.push(innerPetals1);
  const innerPetals2 = tearRing(6, 60, 40, 60, 1.5, BASE_ANGULAR_VELOCITY, 0, stroke);
  inner.push(innerPetals2.el);
  innerComps.push(innerPetals2);
  const innerPetals3 = tearRing(6, 63, 27, 41, 1.5, BASE_ANGULAR_VELOCITY, 0, accent);
  inner.push(innerPetals3.el);
  innerComps.push(innerPetals3);

  inner.push(c(55), c(45));
  const innerSpokes = lineRing(12, 45, BASE_ANGULAR_VELOCITY);
  inner.push(innerSpokes.el);
  innerComps.push(innerSpokes);
  inner.push(cA(30), c(20));

  // Assemble
  const outerG = group(tf(500, 500), outer);
  const middleG = group(tf(500, 500), middle);
  const innerG = group(tf(500, 500), inner);

  const root = group('', [outerG, middleG, innerG]);
  return makeComp({
    el: root,
    children: [...outerComps, ...middleComps, ...innerComps],
  });
}

// --- React component ---

export function MandalaScreensaverSVG({ onReady }: { onReady?: (svg: SVGSVGElement) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mandalaRef = useRef<Comp | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Read brand colors from CSS
    const style = getComputedStyle(document.documentElement);
    const strokeColor = style.getPropertyValue('--brand-btn').trim() || '#A35B4E';
    const accentColor = style.getPropertyValue('--brand-highlight').trim() || '#A0BF52';

    const mandala = buildMandala(strokeColor, accentColor, 1.5);
    svg.appendChild(mandala.el);
    mandalaRef.current = mandala;

    const start = Date.now();
    function render() {
      const t = (Date.now() - start) / 1000;
      if (mandalaRef.current) transformAll(t, mandalaRef.current);
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);

    if (onReady) onReady(svg);

    return () => {
      cancelAnimationFrame(rafRef.current);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, [onReady]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
