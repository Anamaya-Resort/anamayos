"use client";

import { useCallback, useEffect } from "react";

export type LightboxImage = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

/**
 * The site's image lightbox, ported from anamaya-website
 * (src/components/Lightbox.tsx) so an enlarged photo looks the same in
 * the admin as it does on anamaya.com: a light frosted backdrop that
 * blurs and brightens the page behind, the photo held in a soft
 * pulsing golden glow, flourish ornaments flanking it, and
 * frosted-glass controls.
 *
 * Kept as a copy rather than shared, because the two apps deploy
 * separately and have no build-time link. If the look changes on the
 * site, change it here too.
 *
 * Differences from the original: the ornament lives at
 * /ornaments/flourish.webp here, the site theme tokens carry literal
 * fallbacks since this app does not define them, and an optional
 * `onContextMenu` lets the caller open its own menu on the photo.
 */
export default function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  onContextMenu,
}: {
  images: LightboxImage[];
  /** Active image index, or null when the lightbox is closed. */
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
  /** Right-click on the enlarged photo, for a caller-supplied menu. */
  onContextMenu?: (e: React.MouseEvent, i: number) => void;
}) {
  const open = index !== null && images.length > 0;
  const multi = images.length > 1;

  const next = useCallback(() => {
    if (index === null) return;
    onIndex((index + 1) % images.length);
  }, [index, images.length, onIndex]);
  const prev = useCallback(() => {
    if (index === null) return;
    onIndex((index - 1 + images.length) % images.length);
  }, [index, images.length, onIndex]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, next, prev]);

  if (!open) return null;
  const img = images[index as number];

  return (
    <div
      className="lb open"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
    >
      <style>{LB_CSS}</style>

      {multi && (
        <span className="lb-count">
          {(index as number) + 1} / {images.length}
        </span>
      )}

      <button
        type="button"
        className="lb-close"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        &times;
      </button>

      {multi && (
        <button
          type="button"
          className="lb-nav lb-prev"
          aria-label="Previous"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
        >
          &#8249;
        </button>
      )}

      <div className="lb-frame" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="orn l" src="/ornaments/flourish.webp" alt="" aria-hidden="true" />
        <div className="lb-imgwrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lb-img"
            src={img.url}
            alt={img.alt ?? ""}
            onContextMenu={
              onContextMenu ? (e) => onContextMenu(e, index as number) : undefined
            }
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="orn r" src="/ornaments/flourish.webp" alt="" aria-hidden="true" />
        {img.caption && <div className="lb-cap">{img.caption}</div>}
      </div>

      {multi && (
        <button
          type="button"
          className="lb-nav lb-next"
          aria-label="Next"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          &#8250;
        </button>
      )}
    </div>
  );
}

// Scoped to `.lb`. Site theme tokens carry literal fallbacks; the golden
// glow values are literals (there is no brand "gold" token).
const LB_CSS = `
.lb{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:5vh 4vw;
  background:rgba(250,249,244,.42);backdrop-filter:blur(18px) brightness(1.12) saturate(1.05);
  -webkit-backdrop-filter:blur(18px) brightness(1.12) saturate(1.05);animation:lbfade .28s ease both;}
@keyframes lbfade{from{opacity:0;}to{opacity:1;}}
.lb-frame{position:relative;max-width:96vw;max-height:92vh;display:flex;align-items:center;justify-content:center;gap:10px;}
.lb .orn{flex:0 0 auto;width:auto;height:14px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(233,201,120,.55));opacity:.9;}
.lb .orn.l{transform:scaleX(-1);}
.lb-imgwrap{position:relative;display:flex;align-items:center;min-width:0;}
.lb-imgwrap::before{content:"";position:absolute;inset:-22px;border-radius:20px;pointer-events:none;z-index:0;
  background:radial-gradient(closest-side,rgba(233,201,120,.6),rgba(233,201,120,0) 76%);
  filter:blur(16px);animation:lbglow 5s ease-in-out infinite;}
.lb-img{position:relative;z-index:1;display:block;max-width:100%;max-height:92vh;width:auto;height:auto;object-fit:contain;border-radius:8px;
  box-shadow:0 0 22px rgba(233,201,120,.55),0 0 54px rgba(233,201,120,.3),0 18px 46px rgba(60,50,20,.22);}
@keyframes lbglow{0%,100%{opacity:.5;transform:scale(1);}50%{opacity:.95;transform:scale(1.04);}}
.lb-close,.lb-nav{position:absolute;background:rgba(58,58,52,.55);border:1px solid rgba(255,255,255,.4);color:#fff;cursor:pointer;
  backdrop-filter:blur(4px);border-radius:999px;display:flex;align-items:center;justify-content:center;line-height:1;}
.lb-close{top:18px;right:18px;width:44px;height:44px;font-size:26px;}
.lb-nav{top:50%;transform:translateY(-50%);width:50px;height:50px;font-size:30px;}
.lb-prev{left:14px;}.lb-next{right:14px;}
.lb-close:hover,.lb-nav:hover{background:#fff;color:var(--color-anamaya-charcoal, #3A3A34);}
.lb-cap{position:absolute;bottom:22px;left:0;right:0;text-align:center;color:var(--color-anamaya-charcoal, #3A3A34);font-weight:500;font-size:14px;padding:0 60px;text-shadow:0 1px 8px rgba(250,249,244,.85);}
.lb-count{position:absolute;top:24px;left:20px;color:var(--color-anamaya-charcoal, #3A3A34);opacity:.72;font-family:var(--font-heading, inherit),sans-serif;font-size:13px;letter-spacing:.14em;text-shadow:0 1px 8px rgba(250,249,244,.85);}
.lb :focus-visible{outline:2px solid var(--color-anamaya-green, #A0BF52);outline-offset:2px;}
@media(max-width:600px){.lb-nav{width:42px;height:42px;font-size:24px;}.lb-cap{padding:0 20px;}}
@media(prefers-reduced-motion:reduce){.lb-imgwrap::before{animation:none;}.lb{animation:none;}}
`;
