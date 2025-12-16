import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Check, RotateCcw, Trash2, ChevronDown, Layers, Loader2 } from 'lucide-react';

interface LiveScannerProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedSegments, setCapturedSegments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 } 
        }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setError("Could not access camera. Please ensure you have granted camera permissions and are using HTTPS.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSnap = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas to video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Use high quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedSegments(prev => [...prev, dataUrl]);
      }
    }
  };

  const handleFinish = async () => {
    if (capturedSegments.length === 0) return;
    
    setIsStitching(true);

    try {
      // If single image, just return it
      if (capturedSegments.length === 1) {
        onCapture(capturedSegments[0]);
        onClose();
        return;
      }

      // Load all images to get dimensions
      const images = await Promise.all(capturedSegments.map(src => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      }));

      // Calculate stitched dimensions
      const maxWidth = Math.max(...images.map(i => i.width));
      const totalHeight = images.reduce((sum, i) => sum + i.height, 0);

      // Create stitching canvas
      const stitchCanvas = document.createElement('canvas');
      stitchCanvas.width = maxWidth;
      stitchCanvas.height = totalHeight;
      const ctx = stitchCanvas.getContext('2d');

      if (!ctx) throw new Error("Could not create canvas context");

      // Draw images vertically
      let yOffset = 0;
      for (const img of images) {
        // Center image horizontally if widths differ
        const xOffset = (maxWidth - img.width) / 2;
        ctx.drawImage(img, xOffset, yOffset);
        yOffset += img.height;
      }

      const finalImage = stitchCanvas.toDataURL('image/jpeg', 0.85);
      onCapture(finalImage);
      onClose();
    } catch (e) {
      console.error("Stitching failed", e);
      setError("Failed to process images. Please try again.");
      setIsStitching(false);
    }
  };

  const handleRetake = () => {
    setCapturedSegments([]);
  };

  const removeLastSegment = () => {
    setCapturedSegments(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="p-2 bg-black/40 text-white rounded-full backdrop-blur-md">
          <X size={24} />
        </button>
        {capturedSegments.length > 0 && (
          <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1 border border-white/10 animate-in fade-in">
             <Layers size={12} /> {capturedSegments.length} Part{capturedSegments.length !== 1 ? 's' : ''} Stitched
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {error ? (
           <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
              <div>
                <div className="bg-red-500/20 p-4 rounded-full inline-block mb-4 text-red-400">
                  <Camera size={48} />
                </div>
                <p className="font-bold mb-2">Camera Error</p>
                <p className="text-sm opacity-70">{error}</p>
                <button onClick={onClose} className="mt-6 px-6 py-2 bg-white text-black rounded-full font-bold text-sm">Close</button>
              </div>
           </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Guides for Receipt */}
        {!error && (
          <div className="absolute inset-0 pointer-events-none opacity-30">
             <div className="absolute top-0 bottom-0 left-[15%] w-px bg-white"></div>
             <div className="absolute top-0 bottom-0 right-[15%] w-px bg-white"></div>
             {capturedSegments.length > 0 && (
               <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-green-500/50 to-transparent flex items-center justify-center text-green-300 font-bold text-sm">
                 Align next part here
               </div>
             )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/90 pb-8 pt-4 px-6">
         {/* Thumbnails */}
         {capturedSegments.length > 0 && (
           <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
              {capturedSegments.map((src, idx) => (
                <div key={idx} className="relative shrink-0 w-12 h-16 rounded border border-white/20 overflow-hidden">
                   <img src={src} className="w-full h-full object-cover opacity-70" />
                   <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs bg-black/20">
                     {idx + 1}
                   </div>
                </div>
              ))}
              <button onClick={removeLastSegment} className="shrink-0 w-12 h-16 rounded border border-white/20 flex items-center justify-center text-red-400 bg-white/5">
                 <Trash2 size={16} />
              </button>
           </div>
         )}

         <div className="flex justify-between items-center">
            {capturedSegments.length > 0 ? (
              <button onClick={handleRetake} className="p-4 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors flex flex-col items-center gap-1">
                 <RotateCcw size={24} />
                 <span className="text-[10px] font-medium">Reset</span>
              </button>
            ) : (
              <div className="w-14"></div> // Spacer
            )}

            {/* Shutter Button */}
            <button 
               onClick={handleSnap}
               disabled={!!error || isStitching}
               className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform relative group"
            >
               <div className="w-16 h-16 bg-white rounded-full group-hover:bg-brand-400 transition-colors"></div>
            </button>

            {/* Done Button */}
            {capturedSegments.length > 0 ? (
              <button 
                onClick={handleFinish} 
                disabled={isStitching}
                className="p-3 bg-brand-600 rounded-full text-white shadow-lg shadow-brand-500/40 hover:bg-brand-500 transition-all flex items-center gap-2 pr-5"
              >
                {isStitching ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} />}
                <span className="font-bold text-sm">{isStitching ? 'Saving...' : 'Done'}</span>
              </button>
            ) : (
               <div className="w-14"></div>
            )}
         </div>
         <p className="text-center text-white/40 text-xs mt-4">
           {capturedSegments.length === 0 ? "Tap to snap. For long receipts, take multiple overlapping photos." : "Scroll down the receipt and snap the next part."}
         </p>
      </div>
    </div>
  );
};

export default LiveScanner;