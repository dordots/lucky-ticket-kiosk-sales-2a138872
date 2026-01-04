import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { AlertTriangle, Package, ArrowLeft, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ITEMS_PER_PAGE = 5;

export default function LowStockAlert({ tickets }) {
  const [currentPage, setCurrentPage] = useState(0);
  const lowStockTickets = tickets.filter(t => {
    const quantityCounter = t.quantity_counter ?? 0;
    return quantityCounter <= (t.min_threshold || 10) && t.is_active;
  });

  if (lowStockTickets.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(lowStockTickets.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentTickets = lowStockTickets.slice(startIndex, endIndex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-2xl p-6 border border-amber-800/50"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">מלאי קריטי</h3>
            <p className="text-sm text-muted-foreground">{lowStockTickets.length} פריטים דורשים תשומת לב</p>
          </div>
        </div>
        <Link to={createPageUrl("Inventory")}>
          <Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-600">
            עדכן מלאי
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {currentTickets.map((ticket) => {
          const quantityCounter = ticket.quantity_counter ?? 0;
          const quantityVault = ticket.quantity_vault ?? 0;
          const threshold = ticket.min_threshold || 10;
          const percentage = Math.min(100, (quantityCounter / threshold) * 100);
          
          return (
            <div key={ticket.id} className="bg-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{ticket.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold block ${
                    quantityCounter === 0 ? 'text-red-500' : 'text-amber-500'
                  }`}>
                    דלפק: {quantityCounter}
                  </span>
                  {quantityVault > 0 && (
                    <span className="text-xs text-muted-foreground block">
                      כספת: {quantityVault}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    סף מינימלי: {threshold}
                  </span>
                </div>
              </div>
              <Progress 
                value={percentage} 
                className={`h-2 ${quantityCounter === 0 ? 'bg-red-900/30' : 'bg-amber-900/30'}`}
              />
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-amber-800/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="text-foreground"
          >
            <ChevronRight className="h-4 w-4 ml-1" />
            הקודם
          </Button>
          <span className="text-sm text-muted-foreground">
            עמוד {currentPage + 1} מתוך {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className="text-foreground"
          >
            הבא
            <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}