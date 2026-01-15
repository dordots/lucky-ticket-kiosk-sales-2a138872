import React, { useState, useEffect, useMemo } from "react";
import { auth, TicketType, AuditLog } from "@/api/entities";
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
  ArrowLeft,
  Plus,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [updateStockDialogOpen, setUpdateStockDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [updateStockFormData, setUpdateStockFormData] = useState({
    action: "add", // "add" or "transfer"
    units: "",
    packages: "",
  });
  const queryClient = useQueryClient();

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
  // Only franchisee, owner, admin, or assistants with both inventory view permissions
  const canViewInventory = user?.role === 'franchisee' || 
    user?.role === 'owner' ||
    user?.role === 'admin' ||
    (user?.role === 'assistant' && hasPermission('inventory_view_counter') && hasPermission('inventory_view_vault'));

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
                    
                    {(() => {
                      // Check if user has any permission to update stock
                      const canAddStockCounter = user?.role !== 'assistant' || hasPermission('inventory_add_stock_counter');
                      const canTransferVaultToCounter = user?.role !== 'assistant' || hasPermission('inventory_transfer_vault_to_counter');
                      const hasAnyUpdatePermission = canAddStockCounter || (canTransferVaultToCounter && notification.quantity_vault > 0);
                      
                      // Only show button if user has at least one permission
                      if (!hasAnyUpdatePermission) {
                        return null;
                      }
                      
                      return (
                        <div className="mt-4 pt-4 border-t border-border">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const ticket = tickets.find(t => t.id === notification.ticket_id);
                              if (!ticket) return;
                              
                              // Determine available actions based on permissions
                              let defaultAction = "add";
                              if (canTransferVaultToCounter && notification.quantity_vault > 0) {
                                defaultAction = "transfer";
                              } else if (canAddStockCounter) {
                                defaultAction = "add";
                              }
                              
                              setSelectedNotification(notification);
                              setUpdateStockFormData({
                                action: defaultAction,
                                units: "",
                                packages: "",
                              });
                              setUpdateStockDialogOpen(true);
                            }}
                          >
                            עדכן מלאי
                            <ArrowLeft className="h-4 w-4 mr-2" />
                          </Button>
                        </div>
                      );
                    })()}
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

      {/* Update Stock Dialog */}
      <Dialog open={updateStockDialogOpen} onOpenChange={setUpdateStockDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedNotification && (() => {
                const ticket = tickets.find(t => t.id === selectedNotification.ticket_id);
                return `עדכון מלאי - ${selectedNotification.ticket_name}`;
              })()}
            </DialogTitle>
          </DialogHeader>
          
          {selectedNotification && (() => {
            const ticket = tickets.find(t => t.id === selectedNotification.ticket_id);
            if (!ticket) return null;
            
            const defaultQtyPerPackage = ticket.default_quantity_per_package || 1;
            const canAddStockCounter = user?.role !== 'assistant' || hasPermission('inventory_add_stock_counter');
            const canTransferVaultToCounter = user?.role !== 'assistant' || hasPermission('inventory_transfer_vault_to_counter');
            
            // Determine which actions are available
            const availableActions = [];
            if (canAddStockCounter) availableActions.push('add');
            if (canTransferVaultToCounter && selectedNotification.quantity_vault > 0) availableActions.push('transfer');
            
            // Set default action if current action is not available
            if (availableActions.length > 0 && !availableActions.includes(updateStockFormData.action)) {
              setUpdateStockFormData({ ...updateStockFormData, action: availableActions[0], units: "", packages: "" });
            }
            
            // If no actions available, show message
            if (availableActions.length === 0) {
              return (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">אין לך הרשאה לעדכן מלאי</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                <div className="p-3 bg-accent rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">כרטיס נבחר</div>
                  <div className="text-sm font-semibold">{selectedNotification.ticket_name}</div>
                  {defaultQtyPerPackage > 1 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      כמות בכל חבילה: {defaultQtyPerPackage} כרטיסים
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    מלאי בדלפק: {selectedNotification.current_quantity} | מלאי בכספת: {selectedNotification.quantity_vault || 0}
                  </div>
                </div>

                {availableActions.length > 1 ? (
                  <Tabs value={updateStockFormData.action} onValueChange={(value) => setUpdateStockFormData({ ...updateStockFormData, action: value, units: "", packages: "" })}>
                    <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableActions.length}, 1fr)` }}>
                      {canAddStockCounter && (
                        <TabsTrigger value="add">
                          הוסף מלאי
                        </TabsTrigger>
                      )}
                      {canTransferVaultToCounter && selectedNotification.quantity_vault > 0 && (
                        <TabsTrigger value="transfer">
                          העבר מכספת
                        </TabsTrigger>
                      )}
                    </TabsList>
                  
                    {canAddStockCounter && (
                      <TabsContent value="add" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>מספר יחידות</Label>
                      <Input
                        type="number"
                        value={updateStockFormData.units}
                        onChange={(e) => {
                          const val = e.target.value;
                          const numVal = parseInt(val) || 0;
                          setUpdateStockFormData({ 
                            ...updateStockFormData, 
                            units: val,
                            packages: numVal > 0 ? "" : updateStockFormData.packages
                          });
                        }}
                        placeholder="0"
                        min="0"
                        disabled={!!updateStockFormData.packages && parseInt(updateStockFormData.packages) > 0}
                      />
                    </div>
                    
                    {defaultQtyPerPackage > 1 && (
                      <div className="space-y-2">
                        <Label>מספר חבילות</Label>
                        <Input
                          type="number"
                          value={updateStockFormData.packages}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseInt(val) || 0;
                            setUpdateStockFormData({ 
                              ...updateStockFormData, 
                              packages: val,
                              units: numVal > 0 ? "" : updateStockFormData.units
                            });
                          }}
                          placeholder="0"
                          min="0"
                          disabled={!!updateStockFormData.units && parseInt(updateStockFormData.units) > 0}
                        />
                        {updateStockFormData.packages && (
                          <p className="text-sm text-muted-foreground">
                            סה"כ כרטיסים: <strong>{parseInt(updateStockFormData.packages || 0) * defaultQtyPerPackage}</strong>
                          </p>
                        )}
                      </div>
                    )}
                    
                    {updateStockFormData.units || updateStockFormData.packages ? (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                          <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                            שימו לב! יש לפתוח את החבילה החדשה באלטורה
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </TabsContent>
                  )}
                  
                  {canTransferVaultToCounter && selectedNotification.quantity_vault > 0 && (
                    <TabsContent value="transfer" className="space-y-4 mt-4">
                    {selectedNotification.quantity_vault === 0 ? (
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">אין מלאי בכספת להעברה</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm font-medium text-foreground mb-1">
                            זמין בכספת: {selectedNotification.quantity_vault} יחידות
                          </p>
                          <p className="text-xs text-muted-foreground">
                            העברת מלאי מהכספת לדלפק
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>מספר חבילות להעברה</Label>
                          <Input
                            type="number"
                            value={updateStockFormData.packages}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              const maxPackages = Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage);
                              if (val === "" || (numVal >= 0 && numVal <= maxPackages)) {
                                setUpdateStockFormData({ 
                                  ...updateStockFormData, 
                                  packages: val,
                                  units: numVal > 0 ? "" : updateStockFormData.units
                                });
                              }
                            }}
                            placeholder="0"
                            min="0"
                            max={defaultQtyPerPackage > 1 ? Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage) : selectedNotification.quantity_vault}
                            disabled={!!updateStockFormData.units && parseInt(updateStockFormData.units) > 0}
                          />
                          {defaultQtyPerPackage > 1 && (
                            <p className="text-xs text-muted-foreground">
                              מקסימום: {Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage)} חבילות
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>מספר יחידות להעברה</Label>
                          <Input
                            type="number"
                            value={updateStockFormData.units}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              if (val === "" || (numVal >= 0 && numVal <= selectedNotification.quantity_vault)) {
                                setUpdateStockFormData({ 
                                  ...updateStockFormData, 
                                  units: val,
                                  packages: numVal > 0 ? "" : updateStockFormData.packages
                                });
                              }
                            }}
                            placeholder="0"
                            min="0"
                            max={selectedNotification.quantity_vault}
                            disabled={!!updateStockFormData.packages && parseInt(updateStockFormData.packages) > 0}
                          />
                          <p className="text-xs text-muted-foreground">
                            מקסימום: {selectedNotification.quantity_vault} יחידות
                          </p>
                        </div>
                        
                        {updateStockFormData.units || updateStockFormData.packages ? (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                            <div className="flex gap-3 items-start">
                              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                              <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                                שימו לב! יש לפתוח את החבילה החדשה באלטורה
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </TabsContent>
                  )}
                </Tabs>
                ) : (
                  // If only one action is available, show it directly without tabs
                  <div className="space-y-4">
                    {updateStockFormData.action === "add" && canAddStockCounter && (
                      <>
                        <div className="space-y-2">
                          <Label>מספר יחידות</Label>
                          <Input
                            type="number"
                            value={updateStockFormData.units}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              setUpdateStockFormData({ 
                                ...updateStockFormData, 
                                units: val,
                                packages: numVal > 0 ? "" : updateStockFormData.packages
                              });
                            }}
                            placeholder="0"
                            min="0"
                            disabled={!!updateStockFormData.packages && parseInt(updateStockFormData.packages) > 0}
                          />
                        </div>
                        
                        {defaultQtyPerPackage > 1 && (
                          <div className="space-y-2">
                            <Label>מספר חבילות</Label>
                            <Input
                              type="number"
                              value={updateStockFormData.packages}
                              onChange={(e) => {
                                const val = e.target.value;
                                const numVal = parseInt(val) || 0;
                                setUpdateStockFormData({ 
                                  ...updateStockFormData, 
                                  packages: val,
                                  units: numVal > 0 ? "" : updateStockFormData.units
                                });
                              }}
                              placeholder="0"
                              min="0"
                              disabled={!!updateStockFormData.units && parseInt(updateStockFormData.units) > 0}
                            />
                            {updateStockFormData.packages && (
                              <p className="text-sm text-muted-foreground">
                                סה"כ כרטיסים: <strong>{parseInt(updateStockFormData.packages || 0) * defaultQtyPerPackage}</strong>
                              </p>
                            )}
                          </div>
                        )}
                        
                        {updateStockFormData.units || updateStockFormData.packages ? (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                            <div className="flex gap-3 items-start">
                              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                              <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                                שימו לב! יש לפתוח את החבילה החדשה באלטורה
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                    
                    {updateStockFormData.action === "transfer" && canTransferVaultToCounter && selectedNotification.quantity_vault > 0 && (
                      <>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm font-medium text-foreground mb-1">
                            זמין בכספת: {selectedNotification.quantity_vault} יחידות
                          </p>
                          <p className="text-xs text-muted-foreground">
                            העברת מלאי מהכספת לדלפק
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>מספר חבילות להעברה</Label>
                          <Input
                            type="number"
                            value={updateStockFormData.packages}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              const maxPackages = Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage);
                              if (val === "" || (numVal >= 0 && numVal <= maxPackages)) {
                                setUpdateStockFormData({ 
                                  ...updateStockFormData, 
                                  packages: val,
                                  units: numVal > 0 ? "" : updateStockFormData.units
                                });
                              }
                            }}
                            placeholder="0"
                            min="0"
                            max={defaultQtyPerPackage > 1 ? Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage) : selectedNotification.quantity_vault}
                            disabled={!!updateStockFormData.units && parseInt(updateStockFormData.units) > 0}
                          />
                          {defaultQtyPerPackage > 1 && (
                            <p className="text-xs text-muted-foreground">
                              מקסימום: {Math.floor(selectedNotification.quantity_vault / defaultQtyPerPackage)} חבילות
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>מספר יחידות להעברה</Label>
                          <Input
                            type="number"
                            value={updateStockFormData.units}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              if (val === "" || (numVal >= 0 && numVal <= selectedNotification.quantity_vault)) {
                                setUpdateStockFormData({ 
                                  ...updateStockFormData, 
                                  units: val,
                                  packages: numVal > 0 ? "" : updateStockFormData.packages
                                });
                              }
                            }}
                            placeholder="0"
                            min="0"
                            max={selectedNotification.quantity_vault}
                            disabled={!!updateStockFormData.packages && parseInt(updateStockFormData.packages) > 0}
                          />
                          <p className="text-xs text-muted-foreground">
                            מקסימום: {selectedNotification.quantity_vault} יחידות
                          </p>
                        </div>
                        
                        {updateStockFormData.units || updateStockFormData.packages ? (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                            <div className="flex gap-3 items-start">
                              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                              <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                                שימו לב! יש לפתוח את החבילה החדשה באלטורה
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUpdateStockDialogOpen(false);
              setSelectedNotification(null);
              setUpdateStockFormData({ action: "add", units: "", packages: "" });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                if (!selectedNotification || !currentKiosk?.id) return;
                
                const ticket = tickets.find(t => t.id === selectedNotification.ticket_id);
                if (!ticket) {
                  alert('כרטיס לא נמצא');
                  return;
                }
                
                const defaultQtyPerPackage = ticket.default_quantity_per_package || 1;
                const unitsValue = parseInt(updateStockFormData.units) || 0;
                const packagesValue = parseInt(updateStockFormData.packages) || 0;
                
                if (unitsValue === 0 && packagesValue === 0) {
                  alert('אנא הזן מספר יחידות או מספר חבילות');
                  return;
                }
                
                let quantity = 0;
                if (unitsValue > 0) {
                  quantity = unitsValue;
                } else if (packagesValue > 0) {
                  quantity = packagesValue * defaultQtyPerPackage;
                }
                
                try {
                  const currentCounter = selectedNotification.current_quantity || 0;
                  const currentVault = selectedNotification.quantity_vault || 0;
                  
                  if (updateStockFormData.action === "add") {
                    // Add stock to counter
                    if (user?.role === 'assistant' && !hasPermission('inventory_add_stock_counter')) {
                      alert('אין לך הרשאה להוספת מלאי לדלפק');
                      return;
                    }
                    
                    await ticketTypesService.updateTicketType(selectedNotification.ticket_id, {
                      quantity_counter: currentCounter + quantity,
                      quantity_vault: currentVault,
                    }, currentKiosk.id);
                    
                    await AuditLog.create({
                      action: 'add_inventory',
                      entity_type: 'ticketType',
                      entity_id: selectedNotification.ticket_id,
                      entity_name: selectedNotification.ticket_name,
                      details: {
                        ticket_name: selectedNotification.ticket_name,
                        ticket_id: selectedNotification.ticket_id,
                        quantity: quantity,
                        destination: "counter",
                        destination_name: "דלפק",
                        units: unitsValue > 0 ? unitsValue : null,
                        packages: packagesValue > 0 ? packagesValue : null,
                        quantity_per_package: defaultQtyPerPackage > 1 ? defaultQtyPerPackage : null,
                        quantity_before_counter: currentCounter,
                        quantity_after_counter: currentCounter + quantity,
                        quantity_before_vault: currentVault,
                        quantity_after_vault: currentVault,
                        message: `הוספו ${quantity} כרטיסים לדלפק`
                      },
                      user_id: user?.id,
                      user_name: user?.full_name || user?.email,
                    });
                  } else {
                    // Transfer from vault to counter
                    if (user?.role === 'assistant' && !hasPermission('inventory_transfer_vault_to_counter')) {
                      alert('אין לך הרשאה להעברת מלאי מכספת לדלפק');
                      return;
                    }
                    
                    if (quantity > currentVault) {
                      alert(`לא ניתן להעביר ${quantity} כרטיסים. זמין בכספת: ${currentVault}`);
                      return;
                    }
                    
                    await ticketTypesService.updateTicketType(selectedNotification.ticket_id, {
                      quantity_counter: currentCounter + quantity,
                      quantity_vault: currentVault - quantity,
                    }, currentKiosk.id);
                    
                    await AuditLog.create({
                      action: 'transfer_inventory',
                      entity_type: 'ticketType',
                      entity_id: selectedNotification.ticket_id,
                      entity_name: selectedNotification.ticket_name,
                      details: {
                        ticket_name: selectedNotification.ticket_name,
                        ticket_id: selectedNotification.ticket_id,
                        quantity: quantity,
                        from: 'vault',
                        to: 'counter',
                        quantity_before_vault: currentVault,
                        quantity_after_vault: currentVault - quantity,
                        quantity_before_counter: currentCounter,
                        quantity_after_counter: currentCounter + quantity,
                        message: `הועברו ${quantity} כרטיסים מכספת לדלפק`
                      },
                      user_id: user?.id,
                      user_name: user?.full_name || user?.email,
                    });
                  }
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications-layout', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  
                  setUpdateStockDialogOpen(false);
                  setSelectedNotification(null);
                  setUpdateStockFormData({ action: "add", units: "", packages: "" });
                } catch (error) {
                  console.error('Error updating stock:', error);
                  alert('שגיאה בעדכון המלאי: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={
                (!updateStockFormData.units && !updateStockFormData.packages) ||
                (updateStockFormData.units && parseInt(updateStockFormData.units) <= 0) ||
                (updateStockFormData.packages && parseInt(updateStockFormData.packages) <= 0)
              }
              className="bg-theme-gradient"
            >
              {updateStockFormData.action === "add" ? "הוסף מלאי" : "העבר מכספת"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
