import React, { useState, useEffect, useMemo } from "react";
import { auth } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  Bell, 
  AlertTriangle, 
  Package, 
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const notificationTypes = {
  out_of_stock: {
    icon: Package,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
    label: "מלאי אזל",
  },
  critical_stock: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    label: "מלאי קריטי",
  },
};

export default function Notifications() {
  const { currentKiosk } = useKiosk();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await auth.me();
        setUser(userData);
      } catch (e) {
        console.log("User not logged in");
      }
    };
    loadUser();
  }, []);

  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };

  // Check if user has permission to view inventory (needed for notifications)
  const canViewInventory = user?.role !== 'assistant' || 
    hasPermission('inventory_view_counter') || 
    hasPermission('inventory_view_vault');

  // Permission guard - only users with inventory view permission can see notifications
  if (user && !canViewInventory) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בהתראות</p>
      </div>
    );
  }

  // Load tickets to check stock levels
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets-for-notifications', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id || user?.role === 'system_manager') return [];
      try {
        const result = await ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
        return result;
      } catch (error) {
        console.error('Error loading tickets for notifications:', error);
        return [];
      }
    },
    enabled: !!currentKiosk?.id && !!user && user?.role !== 'system_manager',
    refetchInterval: 5000, // Refetch every 5 seconds to catch inventory changes quickly
  });

  // Calculate notifications directly from tickets
  const notifications = useMemo(() => {
    if (!tickets.length || !currentKiosk) return [];

    const notifs = [];
    
    tickets.forEach(ticket => {
      const quantityCounter = ticket.quantity_counter ?? 0;
      const quantityVault = ticket.quantity_vault ?? 0;
      const totalQuantity = quantityCounter + quantityVault;
      const threshold = ticket.min_threshold || 10;
      
      // Only check active tickets that were entered into inventory
      if (!ticket.is_active || totalQuantity === 0) return;
      
      // Out of stock: was in inventory but counter is now 0
      if (quantityCounter === 0) {
        notifs.push({
          id: `out_of_stock_${ticket.id}`,
          ticket_id: ticket.id,
          ticket_name: ticket.name,
          notification_type: 'out_of_stock',
          current_quantity: 0,
          threshold: threshold,
          quantity_vault: quantityVault,
          created_date: new Date().toISOString(), // Use current time for sorting
        });
      }
      // Critical stock: counter > 0 but <= threshold
      else if (quantityCounter > 0 && quantityCounter <= threshold) {
        notifs.push({
          id: `critical_stock_${ticket.id}`,
          ticket_id: ticket.id,
          ticket_name: ticket.name,
          notification_type: 'critical_stock',
          current_quantity: quantityCounter,
          threshold: threshold,
          quantity_vault: quantityVault,
          created_date: new Date().toISOString(), // Use current time for sorting
        });
      }
    });
    
    // Sort by type (out_of_stock first) then by quantity
    return notifs.sort((a, b) => {
      if (a.notification_type !== b.notification_type) {
        return a.notification_type === 'out_of_stock' ? -1 : 1;
      }
      return a.current_quantity - b.current_quantity;
    });
  }, [tickets, currentKiosk]);

  const activeCount = notifications.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">התראות</h1>
          <p className="text-muted-foreground">
            {activeCount > 0 ? `${activeCount} התראות פעילות` : 'אין התראות פעילות'}
          </p>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        <AnimatePresence>
          {notifications.map((notification, index) => {
            const type = notificationTypes[notification.notification_type];
            const TypeIcon = type.icon;
            
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${type.bgColor} ${type.borderColor} border-r-4`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${type.bgColor}`}>
                        <TypeIcon className={`h-5 w-5 ${type.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={`${type.bgColor} ${type.color}`}>
                            {type.label}
                          </Badge>
                        </div>
                        
                        <h3 className="font-medium text-foreground mb-1">
                          {notification.ticket_name}
                        </h3>
                        
                        {notification.notification_type === 'out_of_stock' && (
                          <p className="text-sm text-foreground">
                            המלאי בדלפק אזל לחלוטין
                            {notification.quantity_vault > 0 && (
                              <span className="text-muted-foreground mr-2">
                                {' '}(זמין בכספת: {notification.quantity_vault} יחידות)
                              </span>
                            )}
                          </p>
                        )}
                        
                        {notification.notification_type === 'critical_stock' && (
                          <p className="text-sm text-foreground">
                            המלאי בדלפק: {notification.current_quantity} יחידות (סף מינימלי: {notification.threshold})
                            {notification.quantity_vault > 0 && (
                              <span className="text-muted-foreground mr-2">
                                {' '}(זמין בכספת: {notification.quantity_vault} יחידות)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <Link to={createPageUrl("Inventory")}>
                        <Button variant="outline" size="sm">
                          עדכן מלאי
                          <ArrowLeft className="h-4 w-4 mr-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notifications.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <Bell className="h-16 w-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-lg font-medium text-foreground mb-2">אין התראות</h3>
            <p className="text-muted-foreground">כל הפריטים במלאי תקין</p>
          </div>
        )}
      </div>
    </div>
  );
}
