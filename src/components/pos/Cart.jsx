import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Cart({ 
  items, 
  tickets,
  onUpdateQuantity, 
  onRemove, 
  onClear,
  total 
}) {
  const cartItems = Object.entries(items).filter(([_, item]) => item.quantity > 0);

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
        <ShoppingCart className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">העגלה ריקה</p>
        <p className="text-sm">בחר כרטיסים להוספה</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-1">
          <AnimatePresence>
            {cartItems.map(([ticketId, item]) => {
              const ticket = tickets.find(t => t.id === ticketId);
              if (!ticket) return null;

              return (
                <motion.div
                  key={ticketId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-slate-50 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <button
                      onClick={() => onRemove(ticketId)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="text-right flex-1 mr-2">
                      <h4 className="font-medium text-slate-800">{ticket.name}</h4>
                      <p className="text-sm text-slate-500">₪{item.unitPrice} ליחידה</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-600">
                      ₪{(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(ticketId, item.quantity + 1)}
                        disabled={item.quantity >= ticket.quantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(ticketId, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Total & Actions */}
      <div className="border-t border-slate-200 pt-4 mt-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-2xl font-bold text-indigo-600">₪{total.toFixed(2)}</span>
          <span className="text-slate-600 font-medium">סה"כ לתשלום</span>
        </div>
        
        <Button
          variant="outline"
          onClick={onClear}
          className="w-full text-slate-600"
        >
          <Trash2 className="h-4 w-4 ml-2" />
          נקה עגלה
        </Button>
      </div>
    </div>
  );
}