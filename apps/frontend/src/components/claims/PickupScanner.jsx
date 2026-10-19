import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, X } from 'lucide-react';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PickupScanner({ open, onClose, onCandidate }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const stopWhenReadyRef = useRef(false);
  const [phase, setPhase] = useState('starting');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let candidateSent = false;
    stopWhenReadyRef.current = false;
    controlsRef.current = null;
    setPhase('starting');
    setError('');

    const stopScanner = () => {
      stopWhenReadyRef.current = true;
      const controls = controlsRef.current;
      controlsRef.current = null;
      if (controls) controls.stop();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopScanner();
        setPhase('stopped');
        setError('Camera paused because this tab is hidden. Reopen the scanner when you are ready.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase('unavailable');
      setError('Camera scanning needs a secure page and browser camera support. You can enter the pickup code below.');
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    const video = videoRef.current;
    if (!video) {
      setPhase('unavailable');
      setError('The camera preview could not be opened. You can enter the pickup code below.');
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled || stopWhenReadyRef.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (!result || candidateSent || cancelled) return;
          const raw = result.getText();
          if (!UUID_PATTERN.test(raw)) {
            setError('That QR code is not a FoodRescue pickup token. Keep scanning or enter the printed pickup code below.');
            return;
          }

          candidateSent = true;
          stopScanner();
          onCandidate(raw);
        });
        if (cancelled || stopWhenReadyRef.current) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setPhase('active');
      } catch {
        if (!cancelled) {
          setPhase('unavailable');
          setError('The camera could not start. Check camera permission and try again, or enter the pickup code below.');
        }
      }
    }
    startScanner();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopScanner();
    };
  }, [open, onCandidate]);

  if (!open) return null;

  return (
    <section className="mt-4 rounded-2xl border border-[#dce4d7] bg-[#f8fbf5] p-3 sm:p-4" aria-label="QR pickup scanner">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#182019]">
          {phase === 'active' ? <Camera size={17} className="text-[#2c8a38]" /> : <CameraOff size={17} className="text-[#687066]" />}
          {phase === 'active' ? 'Point at the claimant’s QR code' : 'Camera scanner'}
        </div>
        <button type="button" onClick={onClose} aria-label="Close camera scanner" className="rounded-lg p-1.5 text-[#536054] hover:bg-[#e8efe2]">
          <X size={17} />
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-[#182019]">
        <video ref={videoRef} muted playsInline className="aspect-video max-h-72 w-full object-cover" />
      </div>
      {phase === 'starting' && <p className="mt-2 text-xs text-[#536054]" role="status">Starting camera…</p>}
      {error && <p className="mt-2 text-xs text-rose-800" role="alert">{error}</p>}
    </section>
  );
}
