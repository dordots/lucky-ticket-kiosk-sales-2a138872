import React, { useState, useEffect } from "react";
import { AuditLog as AuditLogService } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  History, 
  ShoppingCart,
  Edit,
  Trash2,
  Package,
  Plus,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKiosk } from "@/contexts/KioskContext";

const actionConfig = {
  create_sale: { label: "יצירת עסקה", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  edit_sale: { label: "עריכת עסקה", icon: Edit, color: "bg-blue-100 text-blue-700" },
  delete_sale: { label: "מחיקת עסקה", icon: Trash2, color: "bg-red-100 text-red-700" },
  adjust_inventory: { label: "עדכון מלאי", icon: Package, color: "bg-purple-100 text-purple-700" },
  create_ticket_type: { label: "יצירת סוג כרטיס", icon: Plus, color: "bg-emerald-100 text-emerald-700" },
  edit_ticket_type: { label: "עריכת סוג כרטיס", icon: Edit, color: "bg-amber-100 text-amber-700" },
  delete_ticket_type: { label: "מחיקת סוג כרטיס", icon: Trash2, color: "bg-red-100 text-red-700" },
  open_tickets: { label: "פתיחת כרטיסים", icon: Package, color: "bg-blue-100 text-blue-700" },
  add_inventory: { label: "הוספת מלאי", icon: Plus, color: "bg-green-100 text-green-700" },
  transfer_inventory: { label: "העברת מלאי", icon: Package, color: "bg-indigo-100 text-indigo-700" },
  complete_onboarding: { label: "השלמת און-בורדינג", icon: FileText, color: "bg-emerald-100 text-emerald-700" },
};

// Helper function to format details in Hebrew - professional display
const formatDetails = (details, actionType = null) => {
  if (!details || typeof details !== 'object') return null;

  const fieldLabels = {
    total: 'סה"כ',
    total_amount: 'סה"כ',
    payment_method: 'אמצעי תשלום',
    items: 'פריטים',
    quantity: 'כמות',
    ticket_type_id: 'מזהה כרטיס',
    ticket_name: 'שם כרטיס',
    ticket_id: 'מזהה כרטיס',
    unit_price: 'מחיר יחידה',
    price: 'מחיר',
    name: 'שם',
    email: 'אימייל',
    phone: 'טלפון',
    position: 'תפקיד',
    is_active: 'פעיל',
    min_threshold: 'סף מינימלי',
    old_quantity: 'כמות קודמת',
    new_quantity: 'כמות חדשה',
    old_value: 'ערך קודם',
    new_value: 'ערך חדש',
    code: 'קוד',
    image_url: 'תמונה',
    ticket_category: 'סוג כרטיס',
    nickname: 'כינוי',
    default_quantity_per_package: 'כמות בחבילה',
    color: 'צבע',
    // New fields for specific actions
    quantity_opened: 'כמות שנפתחה',
    from: 'ממקום',
    to: 'למקום',
    destination: 'יעד',
    destination_name: 'שם יעד',
    packages: 'מספר חבילות',
    quantity_per_package: 'כמות בחבילה',
    is_opened: 'נפתחו',
    quantity_before_counter: 'כמות בדלפק לפני',
    quantity_after_counter: 'כמות בדלפק אחרי',
    quantity_before_vault: 'כמות בכספת לפני',
    quantity_after_vault: 'כמות בכספת אחרי',
    user_id: 'מזהה משתמש',
    user_name: 'שם משתמש',
    user_email: 'אימייל משתמש',
    commission_rate: 'עמלה (%)',
    commission_set: 'עמלה הוגדרה',
    tickets_with_inventory: 'מספר כרטיסים עם מלאי',
    onboarding_completed_date: 'תאריך השלמה',
    message: 'הודעה',
  };

  const paymentMethodLabels = {
    cash: 'מזומן',
    card: 'כרטיס אשראי',
  };

  const categoryLabels = {
    pais: 'מפעל הפיס',
    custom: 'מותאם אישית',
  };

  const formatValue = (key, value) => {
    if (key === 'payment_method') {
      return paymentMethodLabels[value] || value;
    }
    if (key === 'ticket_category') {
      return categoryLabels[value] || value;
    }
    if (key === 'is_active' || key === 'is_opened' || key === 'commission_set') {
      return value ? 'כן' : 'לא';
    }
    if (key === 'from') {
      return value === 'vault' ? 'כספת' : value === 'counter' ? 'דלפק' : value;
    }
    if (key === 'to') {
      return value === 'vault' ? 'כספת' : value === 'counter' ? 'דלפק' : value;
    }
    if (key === 'destination') {
      return value === 'vault' ? 'כספת' : value === 'counter' ? 'דלפק' : value;
    }
    if (key === 'image_url' && typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    if (key === 'commission_rate' && typeof value === 'number') {
      return `${value}%`;
    }
    if (Array.isArray(value)) {
      // For items array in sales - show summary
      if (key === 'items' && value.length > 0) {
        const totalItems = value.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalAmount = value.reduce((sum, item) => sum + (item.total || 0), 0);
        return (
          <div className="mr-4 mt-2 space-y-2">
            <div className="p-2 bg-accent rounded border border-border">
              <div className="text-sm font-medium text-primary mb-2">סיכום פריטים:</div>
              <div className="space-y-1">
                {value.map((item, index) => (
                  <div key={index} className="text-sm text-foreground">
                    {item.quantity}x {item.ticket_name || 'כרטיס'} - ₪{item.total?.toFixed(2) || '0.00'}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border text-sm font-medium text-primary">
                סה"כ: {totalItems} כרטיסים, ₪{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        );
      }
      // For other arrays
      return (
        <div className="mr-4 mt-2 space-y-2">
          {value.map((item, index) => (
            <div key={index} className="p-2 bg-accent rounded border border-border">
              {typeof item === 'object' && item !== null ? (
                <div className="space-y-1">
                  {Object.entries(item).slice(0, 5).map(([subKey, subValue]) => (
                    <div key={subKey} className="text-sm">
                      <span className="font-medium text-primary">{fieldLabels[subKey] || subKey}:</span>{' '}
                      <span className="text-foreground">{formatValue(subKey, subValue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-foreground">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    if (typeof value === 'object' && value !== null) {
      // Show only important fields for objects
      const importantFields = ['name', 'quantity', 'price', 'code', 'ticket_name', 'unit_price', 'total'];
      const entries = Object.entries(value).filter(([k]) => importantFields.includes(k) || Object.keys(value).length <= 5);
      
      return (
        <div className="mr-4 mt-1 p-2 bg-accent rounded border border-border space-y-1">
          {entries.map(([subKey, subValue]) => (
            <div key={subKey} className="text-sm">
              <span className="font-medium text-primary">{fieldLabels[subKey] || subKey}:</span>{' '}
              <span className="text-foreground">{formatValue(subKey, subValue)}</span>
            </div>
          ))}
        </div>
      );
    }
    if (typeof value === 'number') {
      if (key === 'total' || key === 'total_amount' || key === 'unit_price' || key === 'price') {
        return `₪${value.toLocaleString('he-IL')}`;
      }
      return value.toLocaleString('he-IL');
    }
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return String(value);
  };

  // Filter out technical/internal fields that aren't important
  // Include message field for all actions
  const importantFields = ['total', 'total_amount', 'payment_method', 'items', 'quantity', 'old_quantity', 'new_quantity', 
    'name', 'ticket_name', 'ticket_id', 'code', 'price', 'unit_price', 'is_active', 'ticket_category', 'nickname',
    'quantity_opened', 'from', 'to', 'destination', 'destination_name', 'packages', 'quantity_per_package', 'is_opened',
    'quantity_before_counter', 'quantity_after_counter', 'quantity_before_vault', 'quantity_after_vault',
    'user_name', 'user_email', 'commission_rate', 'commission_set', 'tickets_with_inventory', 
    'onboarding_completed_date', 'message'];
  
  const filteredEntries = Object.entries(details).filter(([key]) => 
    importantFields.includes(key) || Object.keys(details).length <= 8
  );

  return (
    <div className="space-y-3">
      {filteredEntries.map(([key, value]) => (
        <div key={key} className="border-b border-border pb-2 last:border-0 last:pb-0">
          <div className="font-medium text-primary mb-1 text-sm">
            {fieldLabels[key] || key}:
          </div>
          <div className="text-foreground text-sm">
            {formatValue(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function AuditLog() {
  const [expandedLogs, setExpandedLogs] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [user, setUser] = useState(null);
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { auth } = await import("@/api/entities");
        const userData = await auth.me();
        setUser(userData);
      } catch (e) {
        console.log("User not logged in");
      }
    };
    loadUser();
  }, []);
  const { currentKiosk } = useKiosk();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) {
        return [];
      }
      return AuditLogService.filter({ kiosk_id: currentKiosk.id });
    },
    enabled: !!currentKiosk?.id,
  });

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('audit_log_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לצפות ביומן הפעולות</p>
      </div>
    );
  }

  const toggleExpand = (logId) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const hasDetails = (log) => {
    return log.details && Object.keys(log.details).length > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">יומן פעולות</h1>
        <p className="text-muted-foreground">
          {currentKiosk 
            ? `היסטוריית הפעולות של קיוסק: ${currentKiosk.name}`
            : 'היסטוריית הפעולות במערכת'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            פעולות אחרונות
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => {
                const config = actionConfig[log.action] || { 
                  label: log.action, 
                  icon: History, 
                  color: "bg-accent text-foreground" 
                };
                const ActionIcon = config.icon;

                const isExpanded = expandedLogs[log.id];
                const hasDetailsData = hasDetails(log);

                return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 p-4 bg-accent rounded-lg"
                  >
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>{config.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                        </span>
                        {hasDetailsData && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-3 w-3 ml-1" />
                            פרטים
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-foreground">
                        <strong>{log.actor_name || log.user_name || "משתמש לא ידוע"}</strong>
                        {log.target_type && ` • ${log.target_type}`}
                      </p>
                      {log.reason && (
                        <p className="text-sm text-foreground mt-1 bg-card p-2 rounded border border-border">
                          <strong>סיבה:</strong> {log.reason}
                        </p>
                      )}
                      {(log.notes || hasDetailsData) && (
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary"
                            onClick={() => toggleExpand(log.id)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 ml-1" />
                                הסתר פרטים
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 ml-1" />
                                הצג פרטים
                              </>
                            )}
                          </Button>
                          {isExpanded && (
                            <div className="mt-2 bg-card p-3 rounded border border-border space-y-2">
                              {log.notes && (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <FileText className="h-3 w-3 text-primary" />
                                    <p className="text-xs font-medium text-foreground">הערות:</p>
                                  </div>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{log.notes}</p>
                                </div>
                              )}
                              {hasDetailsData && (
                                <div>
                                  <p className="text-xs font-medium text-foreground mb-2">פרטים נוספים:</p>
                                  <div className="text-sm text-foreground bg-accent p-3 rounded">
                                    {formatDetails(log.details, log.action)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">אין פעולות ביומן</p>
              <p className="text-sm text-muted-foreground mt-1">פעולות יתועדו כאן לאחר מכירות, עריכות ומחיקות</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטים מלאים</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">פעולה</p>
                  <p className="font-medium text-foreground">{actionConfig[selectedLog.action]?.label || selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">תאריך</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(selectedLog.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">משתמש</p>
                  <p className="font-medium text-foreground">{selectedLog.actor_name || selectedLog.user_name || "לא ידוע"}</p>
                </div>
                {selectedLog.target_type && (
                  <div>
                    <p className="text-sm text-muted-foreground">סוג יעד</p>
                    <p className="font-medium text-foreground">{selectedLog.target_type}</p>
                  </div>
                )}
              </div>

              {selectedLog.reason && (
                <div className="bg-amber-900/30 border border-amber-800/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground mb-1">סיבה</p>
                  <p className="text-sm text-foreground">{selectedLog.reason}</p>
                </div>
              )}

              {selectedLog.notes && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">הערות</p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedLog.notes}</p>
                </div>
              )}

              {hasDetails(selectedLog) && (
                <div className="bg-accent border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground mb-3">פרטים נוספים</p>
                  <div className="text-sm text-foreground bg-card p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
                    {formatDetails(selectedLog.details, selectedLog.action)}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}