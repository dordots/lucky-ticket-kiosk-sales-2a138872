import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function QuantityDialog({ 
  open, 
  onClose, 
  ticket, 
  currentQty,
  existingQtyInCart = 0,
  onConfirm 
}) {
  const [quantity, setQuantity] = useState(currentQty || 1);
  const maxQty = ticket?.quantity_counter ?? 0;

  // Update quantity when currentQty changes (when reopening dialog for same ticket)
  React.useEffect(() => {
    if (open && currentQty) {
      setQuantity(currentQty);
    } else if (open && !currentQty) {
      setQuantity(1);
    }
  }, [open, currentQty]);

  const handleConfirm = () => {
    onConfirm(quantity);
    onClose();
  };

  const adjustQuantity = (delta) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= maxQty) {
      setQuantity(newQty);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-xl">
            {ticket.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Price Info */}
          <div className="text-center">
            <p className="text-muted-foreground mb-1">מחיר ליחידה</p>
            <p className="text-2xl font-bold text-primary">₪{ticket.price}</p>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => adjustQuantity(1)}
              disabled={quantity >= maxQty}
            >
              <Plus className="h-5 w-5" />
            </Button>
            
            <Input
              type="number"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setQuantity(Math.min(Math.max(1, val), maxQty));
              }}
              className="w-20 h-14 text-center text-2xl font-bold"
              min={1}
              max={maxQty}
            />
            
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => adjustQuantity(-1)}
              disabled={quantity <= 1}
            >
              <Minus className="h-5 w-5" />
            </Button>
          </div>

          {/* Quick Select */}
          <div className="flex justify-center gap-2">
            {[1, 5, 10].filter(n => n <= maxQty).map((num) => (
              <Button
                key={num}
                variant={quantity === num ? "default" : "outline"}
                size="sm"
                onClick={() => setQuantity(num)}
                className="w-12"
              >
                {num}
              </Button>
            ))}
          </div>

          {/* Total */}
          <div className="bg-accent rounded-xl p-4 text-center">
            <p className="text-muted-foreground mb-1">סה"כ</p>
            <p className="text-3xl font-bold text-primary">
              ₪{(quantity * ticket.price).toFixed(2)}
            </p>
          </div>

          {/* Stock Info */}
          <div className="space-y-1 text-center text-sm text-muted-foreground">
            <p>במלאי: {ticket.quantity_counter ?? 0} יחידות</p>
            {existingQtyInCart > 0 && (
              <p className="text-primary font-medium">
                כבר בעגלה: {existingQtyInCart} יחידות
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-1 bg-theme-gradient"
          >
            הוסף לעגלה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}