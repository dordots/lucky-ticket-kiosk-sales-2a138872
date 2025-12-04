import React, { useState, useEffect } from "react";
import { Notification } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  AlertTriangle, 
  Package, 
  Check, 
  Trash2,
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

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () => Notification.list('-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Notification.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      // Toast notification removed
    },
  });

  const handleMarkAsRead = async (notification) => {
    await updateMutation.mutateAsync({ 
      id: notification.id, 
      data: { is_read: true } 
    });
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const notification of unread) {
      await updateMutation.mutateAsync({ 
        id: notification.id, 
        data: { is_read: true } 
      });
    }
    // Toast notification removed
  };

  const handleDelete = async (notification) => {
    await deleteMutation.mutateAsync(notification.id);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">התראות</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} התראות שלא נקראו` : 'אין התראות חדשות'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            <Check className="h-4 w-4 ml-2" />
            סמן הכל כנקרא
          </Button>
        )}
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
                      
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleMarkAsRead(notification)}
                          >
                            <Check className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(notification)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
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