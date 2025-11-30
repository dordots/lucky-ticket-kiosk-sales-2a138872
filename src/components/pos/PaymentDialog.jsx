import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Loader2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const paymentMethods = [
  { id: "cash", label: "מזומן", icon: Banknote, color: "from-green-400 to-green-600" },
  { id: "card", label: "כרטיס אשראי", icon: CreditCard, color: "from-blue-400 to-blue-600" },
];

export default function PaymentDialog({ 
  open, 
  onClose, 
  onConfirm, 
  total,
  itemsCount,
  isProcessing 
}) {
  const [selectedMethod, setSelectedMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedTotal, setSavedTotal] = useState(0);

  const handleConfirm = async () => {
    // Save the total before processing the sale
    setSavedTotal(total);
    const success = await onConfirm(selectedMethod, notes);
    if (success) {
      setShowSuccess(true);
      // Don't auto-close - let user close manually
    }
  };

  const handleDialogClose = (isOpen) => {
    // Prevent closing when showing success message
    if (showSuccess && !isOpen) {
      return;
    }
    if (!isOpen) {
      onClose();
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      setNotes("");
      setSelectedMethod("cash");
      setSavedTotal(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center py-12 relative"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 h-8 w-8"
                onClick={() => {
                  setShowSuccess(false);
                  setNotes("");
                  setSelectedMethod("cash");
                  onClose();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </motion.div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">העסקה הושלמה!</h3>
              <p className="text-slate-500 mb-4">סכום: ₪{savedTotal.toFixed(2)}</p>
              <Button
                onClick={() => {
                  setShowSuccess(false);
                  setNotes("");
                  setSelectedMethod("cash");
                  onClose();
                }}
                className="mt-2"
              >
                סגור
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl text-right">
                  אישור מכירה
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Summary */}
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-slate-500 mb-1">{itemsCount} פריטים</p>
                  <p className="text-3xl font-bold text-indigo-600">₪{total.toFixed(2)}</p>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    אמצעי תשלום
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className={`
                          p-4 rounded-xl transition-all duration-200
                          ${selectedMethod === method.id 
                            ? 'ring-2 ring-indigo-500 ring-offset-2' 
                            : 'hover:bg-slate-50'
                          }
                        `}
                      >
                        <div className={`
                          w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${method.color}
                          flex items-center justify-center mb-2
                        `}>
                          <method.icon className="h-6 w-6 text-white" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          {method.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    הערות (אופציונלי)
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="הוסף הערה לעסקה..."
                    className="resize-none text-right"
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    ביטול
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "אשר מכירה"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}