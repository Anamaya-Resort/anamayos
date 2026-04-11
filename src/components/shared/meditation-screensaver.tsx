'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MandalaScreensaverSVG } from './mandala-screensaver';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const GROW_MS = 3000;
const SHRINK_MS = 3000;
const ACTIVATION_GRACE_MS = 500;
const CORNER_PX = 30;

function isBottomLeftCorner(e: MouseEvent): boolean {
  return e.clientX <= CORNER_PX && e.clientY >= window.innerHeight - CORNER_PX;
}

export function MeditationScreensaver() {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<'idle' | 'growing' | 'active' | 'shrinking'>('idle');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activatedAt = useRef(0);
  const [variant, setVariant] = useState<1 | 2>(1);

  const show = useCallback(() => {
    const overlay = overlayRef.current;
    const content = contentRef.current;
    const backdrop = backdropRef.current;
    if (!overlay || !content || !backdrop || stateRef.current !== 'idle') return;

    stateRef.current = 'growing';
    activatedAt.current = Date.now();
    overlay.style.display = 'flex';
    // Force reflow on content so browser registers scale(0) before we transition to scale(1)
    void content.offsetHeight;

    backdrop.style.background = 'rgb(255 255 255 / 0.85)';
    content.style.transform = 'scale(1)';
    content.style.opacity = '1';

    setTimeout(() => {
      if (stateRef.current === 'growing') stateRef.current = 'active';
    }, GROW_MS);
  }, []);

  const hide = useCallback(() => {
    const content = contentRef.current;
    const backdrop = backdropRef.current;
    const overlay = overlayRef.current;
    if (!content || !backdrop || !overlay) return;
    if (stateRef.current !== 'growing' && stateRef.current !== 'active') return;

    stateRef.current = 'shrinking';
    backdrop.style.background = 'rgb(255 255 255 / 0)';
    content.style.transform = 'scale(0)';
    content.style.opacity = '0';

    setTimeout(() => {
      overlay.style.display = 'none';
      stateRef.current = 'idle';
    }, SHRINK_MS);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(show, IDLE_TIMEOUT_MS);
  }, [show]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const s = stateRef.current;
      if (s === 'idle' && isBottomLeftCorner(e)) {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        show();
        return;
      }
      if ((s === 'growing' || s === 'active') && Date.now() - activatedAt.current > ACTIVATION_GRACE_MS) {
        hide();
        resetIdleTimer();
        return;
      }
      if (s === 'idle') resetIdleTimer();
    }

    function onKeyDown(e: KeyboardEvent) {
      // Switch variants with 1 and 2 keys (only when active)
      if (stateRef.current === 'active' || stateRef.current === 'growing') {
        if (e.key === '1') { setVariant(1); return; }
        if (e.key === '2') { setVariant(2); return; }
      }
      // Any other key dismisses
      const s = stateRef.current;
      if ((s === 'growing' || s === 'active') && Date.now() - activatedAt.current > ACTIVATION_GRACE_MS) {
        hide();
        resetIdleTimer();
        return;
      }
      if (s === 'idle') resetIdleTimer();
    }

    function onActivity() {
      const s = stateRef.current;
      if ((s === 'growing' || s === 'active') && Date.now() - activatedAt.current > ACTIVATION_GRACE_MS) {
        hide();
        resetIdleTimer();
        return;
      }
      if (s === 'idle') resetIdleTimer();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('scroll', onActivity);
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [show, hide, resetIdleTimer]);

  return (
    <div
      ref={overlayRef}
      className="screensaver-overlay"
      style={{ display: 'none' }}
    >
      <div
        ref={backdropRef}
        className="screensaver-backdrop"
        style={{
          background: 'rgb(255 255 255 / 0)',
          transition: `background ${GROW_MS}ms ease`,
        }}
      />
      <div
        ref={contentRef}
        className="screensaver-mandala-container"
        style={{
          transform: 'scale(0)',
          opacity: 0,
          transition: `transform ${GROW_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${GROW_MS}ms ease`,
        }}
      >
        {/* Variant 1: SVG Mandala with breathing */}
        {variant === 1 && (
          <div className="screensaver-v1">
            <div className="screensaver-v1-mandala">
              <MandalaScreensaverSVG />
            </div>
            <div className="screensaver-v1-text">
              <div className="screensaver-text-track">
                <p>Breathe in</p>
                <p>Exhale</p>
              </div>
            </div>
          </div>
        )}

        {/* Variant 2: CSS Circle Breathing */}
        {variant === 2 && (
          <>
            <div className="mandala-wrapper">
              {[0, 45, 180, 225].map((deg) => (
                <div
                  key={deg}
                  className="mandala-group"
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  <div className="mandala-circle mandala-circle-x" />
                  <div className="mandala-circle mandala-circle-y" />
                </div>
              ))}
            </div>
            <div className="screensaver-text">
              <div className="screensaver-text-track">
                <p>Breathe in</p>
                <p>Exhale</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
