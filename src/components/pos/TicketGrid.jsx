import React, { memo } from "react";
import { motion } from "framer-motion";
import { Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const colorMap = {
  blue: "from-blue-400 to-blue-600",
  green: "from-emerald-400 to-emerald-600",
  purple: "from-purple-400 to-purple-600",
  orange: "from-orange-400 to-orange-600",
  pink: "from-pink-400 to-pink-600",
  cyan: "from-cyan-400 to-cyan-600",
  red: "from-red-400 to-red-600",
  yellow: "from-yellow-400 to-yellow-600",
};

function TicketGrid({ tickets, onSelect, selectedItems }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {tickets.map((ticket, index) => {
        const quantityCounter = ticket.quantity_counter ?? 0;
        const isLowStock = quantityCounter <= (ticket.min_threshold || 10);
        const isOutOfStock = quantityCounter <= 0;
        const selectedQty = selectedItems[ticket.id]?.quantity || 0;
        const gradient = colorMap[ticket.color] || colorMap.blue;

        return (
          <motion.button
            key={ticket.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => !isOutOfStock && onSelect(ticket)}
            disabled={isOutOfStock}
            className={`
              relative p-4 rounded-2xl text-right transition-all duration-200
              ${isOutOfStock 
                ? 'bg-accent cursor-not-allowed opacity-60' 
                : 'bg-card shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
              }
              ${selectedQty > 0 ? 'ring-2 ring-primary ring-offset-2' : ''}
            `}
          >
            {/* Ticket Color Header or Image */}
            {ticket.image_url ? (
              <div className="h-32 rounded-xl overflow-hidden mb-3">
                <img 
                  src={ticket.image_url} 
                  alt={ticket.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  width="100%"
                  height="128"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div class="h-20 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3">
                        <span class="text-3xl font-bold text-white/90">${ticket.code || ticket.name.charAt(0)}</span>
                      </div>
                    `;
                  }}
                />
              </div>
            ) : (
              <div className={`
                h-20 rounded-xl bg-gradient-to-br ${gradient}
                flex items-center justify-center mb-3
              `}>
                <span className="text-3xl font-bold text-white/90">
                  {ticket.code || ticket.name.charAt(0)}
                </span>
              </div>
            )}

            {/* Ticket Info */}
            <div className="mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {ticket.name}
              </h3>
              {ticket.nickname && (
                <p className="text-xs text-muted-foreground font-medium truncate">"{ticket.nickname}"</p>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-primary">
                ₪{ticket.price}
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span className="text-sm">{quantityCounter}</span>
              </div>
            </div>

            {/* Quantity Badge */}
            {selectedQty > 0 && (
              <Badge className="absolute -top-2 -left-2 h-7 w-7 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold">
                {selectedQty}
              </Badge>
            )}

            {/* Low Stock Warning */}
            {isLowStock && !isOutOfStock && (
              <div className="absolute top-2 right-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
            )}

            {/* Out of Stock Overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/80 rounded-2xl">
                <span className="text-muted-foreground font-medium">אזל מהמלאי</span>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export default memo(TicketGrid);