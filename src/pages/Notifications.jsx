import React, { useState, useEffect } from "react";
import { Notification, auth } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
// Toast removed

const notificationTypes = {
  low_stock: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "מלאי נמוך",
  },
  out_of_stock: {
    icon: Package,
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "אזל מהמלאי",
  },
  system: {
    icon: Bell,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "מערכת",
  },
};

export default function Notifications() {
  const queryClient = useQueryClient();
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

  // Load tickets to check stock levels - only tickets that exist in this kiosk
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-for-notifications', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) return [];
      try {
        const result = await ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
        
        console.log(`🔍 [Notifications] Checking tickets for kiosk: ${currentKiosk.id}`);
        console.log(`📦 [Notifications] Total tickets from query: ${result.length}`);
        
        // Filter to show only tickets that have inventory for this kiosk (have entry in amount map)
        // IMPORTANT: We must check the amount map BEFORE any backward compatibility migration
        // because normalizeTicketType might create a new amount entry for old kiosk_id
        const ticketsWithInventory = result.filter(ticket => {
          // Get the raw amount map from Firestore (before normalization)
          // We need to check the original amount map, not the normalized one
          // because normalizeTicketType might add entries for backward compatibility
          const amount = ticket.amount || {};
          
          // Log each ticket for debugging
          console.log(`\n🎫 [Notifications] Checking ticket: ${ticket.id} (${ticket.name})`, {
            amount: amount,
            amountKeys: Object.keys(amount),
            hasKioskInAmount: amount.hasOwnProperty(currentKiosk.id),
            quantity_counter: ticket.quantity_counter,
            quantity_vault: ticket.quantity_vault,
            kiosk_id: ticket.kiosk_id,
            currentKioskId: currentKiosk.id
          });
          
          // Check if this kiosk exists in the ORIGINAL amount map
          // This is the key check - if the kiosk ID is not in the amount map,
          // it means the ticket was never added to this kiosk's inventory
          const hasKioskInAmount = amount.hasOwnProperty(currentKiosk.id);
          
          if (!hasKioskInAmount) {
            console.log(`❌ [Notifications] Ticket ${ticket.id} (${ticket.name}) - NO amount entry for kiosk ${currentKiosk.id} - FILTERED OUT`);
            return false;
          }
          
          // Additional check: if ticket has old kiosk_id field, make sure it's not the same as current kiosk
          // because backward compatibility code might create amount entry for old kiosk_id
          if (ticket.kiosk_id && ticket.kiosk_id === currentKiosk.id) {
            // This is an old ticket with kiosk_id field - check if it has actual inventory
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            if (quantityCounter === 0 && quantityVault === 0) {
              console.log(`❌ [Notifications] Ticket ${ticket.id} (${ticket.name}) - Has old kiosk_id but no inventory - FILTERED OUT`);
              return false; // No inventory, skip it
            }
          }
          
          console.log(`✅ [Notifications] Ticket ${ticket.id} (${ticket.name}) - HAS amount entry for kiosk ${currentKiosk.id} - INCLUDED`);
          
          // Only include tickets that have the kiosk in the amount map
          return hasKioskInAmount;
        });
        
        console.log(`\n📊 [Notifications] Summary: ${ticketsWithInventory.length} tickets with inventory for kiosk ${currentKiosk.id} out of ${result.length} total tickets`);
        
        return ticketsWithInventory;
      } catch (error) {
        console.error('Error loading tickets for notifications:', error);
        return [];
      }
    },
    enabled: !!currentKiosk?.id && !!user && user?.role !== 'system_manager',
  });

  // Check and create stock notifications
  useEffect(() => {
    const checkAndCreateStockNotifications = async () => {
      if (!currentKiosk?.id || !user || user?.role === 'system_manager' || tickets.length === 0) {
        return;
      }

      try {
        // Get existing notifications for this kiosk
        const existingNotifications = await Notification.filter({ kiosk_id: currentKiosk.id });
        const existingNotifsByTicket = {};
        existingNotifications.forEach(notif => {
          if (notif.ticket_type_id && !notif.is_read) {
            existingNotifsByTicket[notif.ticket_type_id] = existingNotifsByTicket[notif.ticket_type_id] || [];
            existingNotifsByTicket[notif.ticket_type_id].push(notif);
          }
        });

        // Check each ticket and create notifications if needed
        // Use the same logic as Dashboard LowStockAlert
        // Only check tickets that exist in this kiosk (have entry in amount map)
        const notificationPromises = tickets
          .filter(ticket => {
            // First check: ticket must exist in this kiosk (have entry in amount map)
            // This is the raw amount map from Firestore, not normalized
            const amount = ticket.amount || {};
            const hasKioskInAmount = amount.hasOwnProperty(currentKiosk.id);
            
            if (!hasKioskInAmount) {
              return false; // Ticket doesn't exist in this kiosk - skip it
            }
            
            // Same logic as Dashboard: Only check tickets that:
            // 1. Are active
            // 2. Have been entered into inventory (totalQuantity > 0 means it was entered at some point)
            // 3. Have stock on counter that is low (quantityCounter > 0 && quantityCounter <= threshold)
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            const totalQuantity = quantityCounter + quantityVault;
            const threshold = ticket.min_threshold || 10;
            
            return ticket.is_active && 
                   totalQuantity > 0 && 
                   quantityCounter > 0 && 
                   quantityCounter <= threshold;
          })
          .map(async (ticket) => {
            const quantityCounter = ticket.quantity_counter ?? 0;
            const threshold = ticket.min_threshold || 10;
            const existingNotifs = existingNotifsByTicket[ticket.id] || [];

            // Check for low stock (same logic as Dashboard)
            const hasLowStockNotif = existingNotifs.some(
              n => n.notification_type === 'low_stock'
            );
            
            if (!hasLowStockNotif) {
              try {
                await Notification.create({
                  ticket_type_id: ticket.id,
                  ticket_name: ticket.name,
                  current_quantity: quantityCounter,
                  threshold: threshold,
                  notification_type: 'low_stock',
                  user_id: user.id || user.uid,
                  kiosk_id: currentKiosk.id,
                });
              } catch (error) {
                console.error(`Error creating low_stock notification for ${ticket.name}:`, error);
              }
            }
          });

        // Also check for out_of_stock: tickets that were in inventory but counter is now 0
        // Only check tickets that exist in this kiosk (have entry in amount map)
        const outOfStockPromises = tickets
          .filter(ticket => {
            // First check: ticket must exist in this kiosk (have entry in amount map)
            // This is the raw amount map from Firestore, not normalized
            const amount = ticket.amount || {};
            const hasKioskInAmount = amount.hasOwnProperty(currentKiosk.id);
            
            if (!hasKioskInAmount) {
              return false; // Ticket doesn't exist in this kiosk - skip it
            }
            
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            const totalQuantity = quantityCounter + quantityVault;
            
            // Out of stock: was in inventory (totalQuantity > 0) but counter is now 0
            return ticket.is_active && 
                   totalQuantity > 0 && 
                   quantityCounter === 0;
          })
          .map(async (ticket) => {
            const threshold = ticket.min_threshold || 10;
            const existingNotifs = existingNotifsByTicket[ticket.id] || [];

            const hasOutOfStockNotif = existingNotifs.some(
              n => n.notification_type === 'out_of_stock'
            );
            
            if (!hasOutOfStockNotif) {
              try {
                await Notification.create({
                  ticket_type_id: ticket.id,
                  ticket_name: ticket.name,
                  current_quantity: 0,
                  threshold: threshold,
                  notification_type: 'out_of_stock',
                  user_id: user.id || user.uid,
                  kiosk_id: currentKiosk.id,
                });
              } catch (error) {
                console.error(`Error creating out_of_stock notification for ${ticket.name}:`, error);
              }
            }
          });

        // Delete notifications for tickets that are now above threshold (stock is back to normal)
        // Only check tickets that exist in this kiosk (have entry in amount map)
        const deleteNotificationsPromises = tickets
          .filter(ticket => {
            // First check: ticket must exist in this kiosk (have entry in amount map)
            // This is the raw amount map from Firestore, not normalized
            const amount = ticket.amount || {};
            const hasKioskInAmount = amount.hasOwnProperty(currentKiosk.id);
            
            if (!hasKioskInAmount) {
              return false; // Ticket doesn't exist in this kiosk - skip it
            }
            
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            const totalQuantity = quantityCounter + quantityVault;
            const threshold = ticket.min_threshold || 10;
            
            // Tickets that are active, were in inventory, and now have stock above threshold
            return ticket.is_active && 
                   totalQuantity > 0 && 
                   quantityCounter > threshold;
          })
          .map(async (ticket) => {
            const existingNotifs = existingNotifsByTicket[ticket.id] || [];
            const stockNotifs = existingNotifs.filter(
              n => n.notification_type === 'low_stock' || n.notification_type === 'out_of_stock'
            );
            
            // Delete notifications when stock is back to normal
            for (const notif of stockNotifs) {
              try {
                await Notification.delete(notif.id);
              } catch (error) {
                console.error(`Error deleting notification:`, error);
              }
            }
          });

        await Promise.all([...notificationPromises, ...outOfStockPromises, ...deleteNotificationsPromises]);

        // Refresh notifications after creating new ones
        queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-layout'] });
        // Also invalidate tickets queries to trigger notification recalculation
        queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications-layout'] });
        queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications'] });
      } catch (error) {
        console.error('Error checking and creating stock notifications:', error);
      }
    };

    if (tickets.length > 0 && currentKiosk?.id && user) {
      checkAndCreateStockNotifications();
    }
  }, [tickets, currentKiosk?.id, user, queryClient]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-all', currentKiosk?.id, user?.id, tickets.map(t => t.id).join(',')],
    queryFn: async () => {
      // For system managers, show all notifications
      if (user?.role === 'system_manager') {
        return Notification.list('-created_date', 100);
      }
      
      // For other users, filter by kiosk_id or user_id
      let allNotifications = [];
      if (currentKiosk?.id) {
        try {
          // Try to filter by kiosk_id first
          allNotifications = await Notification.filter({ kiosk_id: currentKiosk.id });
        } catch (error) {
          console.error('Error filtering by kiosk_id, trying user_id:', error);
          // Fallback to user_id if kiosk_id filter fails
          if (user?.id) {
            allNotifications = await Notification.filter({ user_id: user.id });
          }
        }
      } else if (user?.id) {
        // Fallback to user_id if no kiosk
        allNotifications = await Notification.filter({ user_id: user.id });
      }
      
      // Filter notifications to only show those for tickets that exist in this kiosk
      // Only filter if we have tickets loaded
      if (tickets.length > 0 && currentKiosk?.id) {
        // Create a set of ticket IDs that exist in this kiosk (have entry in amount map)
        const ticketIdsInKiosk = new Set(
          tickets
            .filter(ticket => {
              const amount = ticket.amount || {};
              return amount.hasOwnProperty(currentKiosk.id);
            })
            .map(ticket => ticket.id)
        );
        
        // Filter notifications to only include those for tickets that exist in kiosk
        const filteredNotifications = allNotifications.filter(notif => {
          // For stock-related notifications, check if ticket exists in kiosk
          if (notif.ticket_type_id && (notif.notification_type === 'low_stock' || notif.notification_type === 'out_of_stock')) {
            const exists = ticketIdsInKiosk.has(notif.ticket_type_id);
            if (!exists) {
              console.log(`🚫 [Notifications] Filtering out notification for ticket ${notif.ticket_type_id} (${notif.ticket_name}) - ticket not in kiosk ${currentKiosk.id}`);
            }
            return exists;
          }
          // For other notification types, include them (they might not have ticket_type_id)
          return true;
        });
        
        console.log(`🔔 [Notifications] Filtered ${filteredNotifications.length} notifications from ${allNotifications.length} total (tickets in kiosk: ${ticketIdsInKiosk.size})`);
        
        return filteredNotifications;
      }
      
      // If tickets not loaded yet, return all notifications (they will be filtered once tickets load)
      return allNotifications;
    },
    enabled: !!user && (!!currentKiosk?.id || user?.role === 'system_manager'),
    refetchInterval: 5000, // Refetch every 5 seconds to catch inventory changes quickly
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">התראות</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} התראות פעילות` : 'אין התראות פעילות'}
          </p>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        <AnimatePresence>
          {notifications.map((notification, index) => {
            const type = notificationTypes[notification.notification_type] || notificationTypes.system;
            const TypeIcon = type.icon;
            
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${
                  !notification.is_read ? type.bgColor + ' ' + type.borderColor : 'bg-card'
                } ${!notification.is_read ? 'border-r-4' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${type.bgColor}`}>
                        <TypeIcon className={`h-5 w-5 ${type.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={type.bgColor + ' ' + type.color.replace('text-', 'text-')}>
                            {type.label}
                          </Badge>
                          {!notification.is_read && (
                            <Badge className="bg-indigo-500">חדש</Badge>
                          )}
                        </div>
                        
                        <h3 className="font-medium text-foreground mb-1">
                          {notification.ticket_name || 'התראת מערכת'}
                        </h3>
                        
                        {notification.notification_type === 'low_stock' && (
                          <p className="text-sm text-foreground">
                            המלאי ירד ל-{notification.current_quantity} יחידות (סף: {notification.threshold})
                          </p>
                        )}
                        
                        {notification.notification_type === 'out_of_stock' && (
                          <p className="text-sm text-foreground">
                            הכרטיס אזל מהמלאי
                          </p>
                        )}
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(notification.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                        </p>
                      </div>
                      
                    </div>
                    
                    {(notification.notification_type === 'low_stock' || notification.notification_type === 'out_of_stock') && (
                      <div className="mt-4 pt-4 border-t">
                        <Link to={createPageUrl("Inventory")}>
                          <Button variant="outline" size="sm">
                            עדכן מלאי
                            <ArrowLeft className="h-4 w-4 mr-2" />
                          </Button>
                        </Link>
                      </div>
                    )}
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