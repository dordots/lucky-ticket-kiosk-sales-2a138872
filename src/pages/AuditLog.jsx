import React from "react";
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
  Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const actionConfig = {
  create_sale: { label: "יצירת עסקה", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  edit_sale: { label: "עריכת עסקה", icon: Edit, color: "bg-blue-100 text-blue-700" },
  delete_sale: { label: "מחיקת עסקה", icon: Trash2, color: "bg-red-100 text-red-700" },
  adjust_inventory: { label: "עדכון מלאי", icon: Package, color: "bg-purple-100 text-purple-700" },
  create_ticket_type: { label: "יצירת סוג כרטיס", icon: Plus, color: "bg-emerald-100 text-emerald-700" },
  edit_ticket_type: { label: "עריכת סוג כרטיס", icon: Edit, color: "bg-amber-100 text-amber-700" },
  delete_ticket_type: { label: "מחיקת סוג כרטיס", icon: Trash2, color: "bg-red-100 text-red-700" },
};

export default function AuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-all'],
    queryFn: () => AuditLogService.list('-created_date', 100),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">יומן פעולות</h1>
        <p className="text-slate-500">היסטוריית כל הפעולות במערכת</p>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => {
                const config = actionConfig[log.action] || { 
                  label: log.action, 
                  icon: History, 
                  color: "bg-slate-100 text-slate-700" 
                };
                const ActionIcon = config.icon;

                return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg"
                  >
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>{config.label}</Badge>
                        <span className="text-xs text-slate-500">
                          {format(new Date(log.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">
                        <strong>{log.actor_name || "משתמש לא ידוע"}</strong>
                        {log.target_type && ` • ${log.target_type}`}
                      </p>
                      {log.reason && (
                        <p className="text-sm text-slate-600 mt-1 bg-white p-2 rounded border">
                          סיבה: {log.reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">אין פעולות ביומן</p>
              <p className="text-sm text-slate-400 mt-1">פעולות יתועדו כאן לאחר מכירות, עריכות ומחיקות</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}