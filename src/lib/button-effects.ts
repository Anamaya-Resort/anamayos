/**
 * AO Button Effects — global click handler for SVG burst + sound.
 * Call initButtonEffects() once in the root layout.
 * Buttons with data-no-fx attribute are excluded.
 */

let initialized = false;

/** Preloaded sound pool — keyed by URL */
const soundPool: Record<string, HTMLAudioElement> = {};

/** Available click sounds. Use data-btn-sound="key" to select per button. */
const SOUND_MAP: Record<string, string> = {
  tone1: '/sounds/button_tone_1-1.mp3',
};

/** Default sound key */
const DEFAULT_SOUND = 'tone1';

/** Number of particles in the burst */
const PARTICLE_COUNT = 8;
/** Radius of the burst spread */
const BURST_RADIUS = 24;

function getSound(key: string): HTMLAudioElement | null {
  const url = SOUND_MAP[key];
  if (!url) return null;
  if (!soundPool[key]) {
    try {
      soundPool[key] = new Audio(url);
      soundPool[key].volume = 0.15;
    } catch {
      return null;
    }
  }
  return soundPool[key];
}

/**
 * Initialize global button effects.
 * Attaches a single click listener to document.
 */
export function initButtonEffects() {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  // Preload default sound
  getSound(DEFAULT_SOUND);

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button, [role="button"], .ao-btn');
    if (!button) return;
    if (button.hasAttribute('data-no-fx')) return;
    if ((button as HTMLButtonElement).disabled) return;

    // Play sound — per-button override via data-btn-sound, or default
    const soundKey = button.getAttribute('data-btn-sound') || DEFAULT_SOUND;
    if (soundKey !== 'none') {
      const sound = getSound(soundKey);
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      }
    }

    // Create SVG burst at click position
    createBurst(e.clientX, e.clientY, button);
  });
}

/**
 * Create an SVG particle burst at the given screen coordinates.
 */
function createBurst(x: number, y: number, button: Element) {
  const style = getComputedStyle(button);
  const color1 = style.getPropertyValue('--btn-fx-color-1').trim() || '#A35B4E';
  const color2 = style.getPropertyValue('--btn-fx-color-2').trim() || '#A0BF52';
  const color3 = style.getPropertyValue('--btn-fx-color-3').trim() || '#9CB5B1';
  const speed = parseFloat(style.getPropertyValue('--btn-fx-speed').trim()) || 1;
  const colors = [color1, color2, color3];

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ao-btn-burst');
  svg.setAttribute('width', String(BURST_RADIUS * 3));
  svg.setAttribute('height', String(BURST_RADIUS * 3));
  svg.style.left = `${x - BURST_RADIUS * 1.5}px`;
  svg.style.top = `${y - BURST_RADIUS * 1.5}px`;
  svg.style.setProperty('--btn-fx-speed', String(speed));

  const cx = BURST_RADIUS * 1.5;
  const cy = BURST_RADIUS * 1.5;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() * 0.4 - 0.2);
    const dist = BURST_RADIUS * (0.6 + Math.random() * 0.4);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const color = colors[i % colors.length];

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(px));
    circle.setAttribute('cy', String(py));
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', color);
    circle.style.animationDelay = `${i * 0.03}s`;
    svg.appendChild(circle);
  }

  document.body.appendChild(svg);

  // Remove after animation completes
  setTimeout(() => {
    svg.remove();
  }, 800 / speed);
}
