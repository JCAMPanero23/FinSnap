import React, { useState, useRef, useMemo } from 'react';
import { AppSettings, WarrantyItem } from '../types';
import { ShieldCheck, ShieldAlert, Plus, Calendar, Camera, X, Trash2, Search, AlertTriangle, FileText, ChevronRight, ScanLine, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReceiptViewer from './ReceiptViewer';
import LiveScanner from './LiveScanner';

interface WarrantiesViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const WarrantiesView: React.FC<WarrantiesViewProps> = ({ settings, onUpdateSettings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<WarrantyItem>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Viewer & Scanner States
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---
  const calculateExpiration = (start: string, months: number): Date => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const getDaysRemaining = (expiry: Date): number => {
    const today = new Date();
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);
    const diff = expiry.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatus = (expiry: Date) => {
    const days = getDaysRemaining(expiry);
    if (days < 0) return { label: 'Expired', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: ShieldAlert };
    if (days <= 30) return { label: `Expiring in ${days} days`, color: 'bg-red-50 text-red-600 border-red-100', icon: AlertTriangle };
    if (days <= 90) return { label: `${days} days left`, color: 'bg-amber-50 text-amber-600 border-amber-100', icon: ShieldCheck };
    return { label: 'Active', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: ShieldCheck };
  };

  // --- Handlers ---
  const handleSave = () => {
    if (!editingItem.name || !editingItem.purchaseDate) return;

    const newItem: WarrantyItem = {
      id: editingItem.id || uuidv4(),
      name: editingItem.name,
      merchant: editingItem.merchant,
      purchaseDate: editingItem.purchaseDate,
      warrantyDurationMonths: editingItem.warrantyDurationMonths || 12,
      customExpirationDate: editingItem.customExpirationDate,
      receiptImage: editingItem.receiptImage,
      price: editingItem.price,
      notes: editingItem.notes
    };

    const updatedList = editingItem.id 
      ? settings.warranties.map(w => w.id === newItem.id ? newItem : w)
      : [...(settings.warranties || []), newItem];

    onUpdateSettings({ ...settings, warranties: updatedList });
    setIsEditing(false);
    setEditingItem({});
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this warranty record?")) {
      onUpdateSettings({
        ...settings,
        warranties: settings.warranties.filter(w => w.id !== id)
      });
      setIsEditing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingItem(prev => ({ ...prev, receiptImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
      // Reset value so onChange fires again if same file selected
      e.target.value = '';
    }
  };

  const handleScanCapture = (imageData: string) => {
    setEditingItem(prev => ({ ...prev, receiptImage: imageData }));
    setShowScanner(false);
  };

  // --- Filter & Sort ---
  const sortedWarranties = useMemo(() => {
    return (settings.warranties || [])
      .filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.merchant?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
         const dateA = a.customExpirationDate ? new Date(a.customExpirationDate) : calculateExpiration(a.purchaseDate, a.warrantyDurationMonths);
         const dateB = b.customExpirationDate ? new Date(b.customExpirationDate) : calculateExpiration(b.purchaseDate, b.warrantyDurationMonths);
         // Show expiring soonest first
         return dateA.getTime() - dateB.getTime();
      });
  }, [settings.warranties, searchTerm]);

  // --- Stats ---
  const expiringSoonCount = sortedWarranties.filter(w => {
    const exp = w.customExpirationDate ? new Date(w.customExpirationDate) : calculateExpiration(w.purchaseDate, w.warrantyDurationMonths);
    const days = getDaysRemaining(exp);
    return days >= 0 && days <= 30;
  }).length;

  if (isEditing) {
    return (
      <div className="h-full flex flex-col bg-slate-50 relative z-20">
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0">
          <h2 className="text-xl font-bold text-slate-800">{editingItem.id ? 'Edit Warranty' : 'Add Warranty'}</h2>
          <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
           {/* Image Upload Area */}
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">Receipt / Proof of Purchase</label>
              
              {editingItem.receiptImage ? (
                <div className="relative w-full h-64 bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 group">
                   {/* We use object-top to show the header of long receipts */}
                   <img src={editingItem.receiptImage} alt="Receipt" className="w-full h-full object-cover object-top opacity-90" />
                   
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewingImage(editingItem.receiptImage!)}
                        className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30"
                      >
                         <Maximize2 size={16} /> View Full Receipt
                      </button>
                   </div>

                   <button 
                    onClick={() => setEditingItem(prev => ({ ...prev, receiptImage: undefined }))}
                    className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                   <button 
                     onClick={() => setShowScanner(true)}
                     className="h-32 bg-brand-50 border-2 border-dashed border-brand-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-brand-600 hover:bg-brand-100 hover:border-brand-300 transition-all active:scale-95"
                   >
                     <ScanLine size={28} />
                     <span className="text-sm font-bold text-center px-2">Scan Receipt (Multi-Shot)</span>
                   </button>
                   
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-95"
                   >
                     <ImageIcon size={28} />
                     <span className="text-sm font-bold">Upload File</span>
                   </button>
                </div>
              )}
              
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
           </div>

           <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Item Name</label>
              <input 
                type="text" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. AirPods Pro"
                value={editingItem.name || ''}
                onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Purchase Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  value={editingItem.purchaseDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setEditingItem({ ...editingItem, purchaseDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Duration (Months)</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="12"
                  value={editingItem.warrantyDurationMonths || ''}
                  onChange={e => setEditingItem({ ...editingItem, warrantyDurationMonths: parseInt(e.target.value) })}
                />
              </div>
           </div>

           <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Merchant (Optional)</label>
              <input 
                type="text" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Best Buy"
                value={editingItem.merchant || ''}
                onChange={e => setEditingItem({ ...editingItem, merchant: e.target.value })}
              />
           </div>

           <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Price (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  className="w-full pl-8 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="0.00"
                  value={editingItem.price || ''}
                  onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                />
              </div>
           </div>

           <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Notes / Serial Number</label>
              <textarea 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
                placeholder="Serial: SN123456..."
                value={editingItem.notes || ''}
                onChange={e => setEditingItem({ ...editingItem, notes: e.target.value })}
              />
           </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
          {editingItem.id && (
            <button 
              onClick={() => handleDelete(editingItem.id!)}
              className="p-4 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={!editingItem.name}
            className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 disabled:opacity-50"
          >
            Save Warranty
          </button>
        </div>

        {/* Full Screen Viewer */}
        {viewingImage && <ReceiptViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
        
        {/* Custom Live Scanner */}
        {showScanner && <LiveScanner onCapture={handleScanCapture} onClose={() => setShowScanner(false)} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-24 bg-slate-50">
      <div className="px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-10">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Warranties</h2>
            <button 
              onClick={() => { setEditingItem({ purchaseDate: new Date().toISOString().split('T')[0], warrantyDurationMonths: 12 }); setIsEditing(true); }}
              className="p-2 bg-brand-600 text-white rounded-lg shadow-lg shadow-brand-500/30 hover:bg-brand-700"
            >
               <Plus size={20} />
            </button>
         </div>

         {/* Stats Card */}
         {expiringSoonCount > 0 && (
           <div className="mb-4 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3 text-red-700 animate-pulse">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <div>
                 <div className="font-bold text-sm">Action Needed</div>
                 <div className="text-xs opacity-90">{expiringSoonCount} item(s) expiring within 30 days. Check them now.</div>
              </div>
           </div>
         )}

         {/* Search */}
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
               type="text" 
               placeholder="Search items, receipts..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
         </div>
      </div>

      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
         {sortedWarranties.length === 0 && (
           <div className="text-center py-10 text-slate-400">
              <ShieldCheck className="mx-auto mb-3 opacity-20" size={48} />
              <p>No warranties stored yet.</p>
              <button 
                onClick={() => { setEditingItem({ purchaseDate: new Date().toISOString().split('T')[0], warrantyDurationMonths: 12 }); setIsEditing(true); }}
                className="mt-2 text-brand-600 font-bold text-sm"
              >
                Add your first item
              </button>
           </div>
         )}

         {sortedWarranties.map(item => {
           const expiry = item.customExpirationDate ? new Date(item.customExpirationDate) : calculateExpiration(item.purchaseDate, item.warrantyDurationMonths);
           const status = getStatus(expiry);
           const StatusIcon = status.icon;

           return (
             <div 
               key={item.id} 
               className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
             >
                <div className="flex gap-4 cursor-pointer" onClick={() => { setEditingItem(item); setIsEditing(true); }}>
                   {/* Thumbnail */}
                   <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0 overflow-hidden border border-slate-100 flex items-center justify-center relative">
                      {item.receiptImage ? (
                        <>
                           <img src={item.receiptImage} alt={item.name} className="w-full h-full object-cover object-top" />
                           <div 
                             onClick={(e) => { e.stopPropagation(); setViewingImage(item.receiptImage!); }}
                             className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                           >
                             <Maximize2 size={16} className="text-white drop-shadow-md" />
                           </div>
                        </>
                      ) : (
                        <FileText className="text-slate-300" size={24} />
                      )}
                   </div>

                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                         <h3 className="font-bold text-slate-800 truncate pr-2">{item.name}</h3>
                         <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 whitespace-nowrap ${status.color}`}>
                            <StatusIcon size={10} /> {status.label}
                         </div>
                      </div>
                      
                      <div className="text-xs text-slate-500 mt-1">
                         {item.merchant && <span>{item.merchant} • </span>}
                         Expires: {expiry.toLocaleDateString()}
                      </div>

                      {item.price && (
                        <div className="text-xs font-bold text-slate-400 mt-1">
                          ${item.price.toFixed(2)}
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 pointer-events-none">
                   <ChevronRight size={20} />
                </div>
             </div>
           );
         })}
      </div>

      {viewingImage && <ReceiptViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
      
      {showScanner && <LiveScanner onCapture={handleScanCapture} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default WarrantiesView;