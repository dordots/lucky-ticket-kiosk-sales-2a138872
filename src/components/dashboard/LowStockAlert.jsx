import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { AlertTriangle, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function LowStockAlert({ tickets }) {
  const lowStockTickets = tickets.filter(t => 
    t.quantity <= t.min_threshold && t.is_active
  );

  if (lowStockTickets.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">מלאי קריטי</h3>
            <p className="text-sm text-slate-500">{lowStockTickets.length} פריטים דורשים תשומת לב</p>
          </div>
        </div>
        <Link to={createPageUrl("Inventory")}>
          <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
            עדכן מלאי
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {lowStockTickets.slice(0, 5).map((ticket) => {
          const percentage = Math.min(100, (ticket.quantity / ticket.min_threshold) * 100);
          
          return (
            <div key={ticket.id} className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-700">{ticket.name}</span>
                </div>
                <span className={`text-sm font-bold ${
                  ticket.quantity === 0 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {ticket.quantity} / {ticket.min_threshold}
                </span>
              </div>
              <Progress 
                value={percentage} 
                className={`h-2 ${ticket.quantity === 0 ? 'bg-red-100' : 'bg-amber-100'}`}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}