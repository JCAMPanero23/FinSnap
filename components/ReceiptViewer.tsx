import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ReceiptViewerProps {
  src: string;
  onClose: () => void;
}

const ReceiptViewer: React.FC<ReceiptViewerProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white absolute top-0 left-0 right-0 z-10">
         <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md">
            <X size={24} />
         </button>
         <div className="flex gap-4 bg-black/40 backdrop-blur-md rounded-full px-4 py-2">
            <button onClick={() => setRotation(r => r + 90)} className="p-1 hover:text-brand-400 transition-colors"><RotateCw size={20} /></button>
            <div className="w-px bg-white/20"></div>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 hover:text-brand-400 transition-colors"><ZoomOut size={20} /></button>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 hover:text-brand-400 transition-colors"><ZoomIn size={20} /></button>
         </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 pt-24 pb-10 bg-black/90 cursor-grab active:cursor-grabbing">
         <img 
           src={src} 
           alt="Receipt" 
           className="transition-transform duration-200 shadow-2xl origin-top"
           style={{ 
             transform: `scale(${scale}) rotate(${rotation}deg)`, 
             maxWidth: '100%',
             width: 'auto',
             height: 'auto',
             marginTop: rotation % 180 !== 0 ? '100px' : '0' // Simple fix for rotation layout
           }}
         />
      </div>
    </div>
  );
};

export default ReceiptViewer;