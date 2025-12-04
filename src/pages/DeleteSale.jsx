import React, { useState, useEffect } from "react";
import { auth, Sale, TicketType, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  ArrowRight, 
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Toast removed

export default function DeleteSale() {
  const [user, setUser] = useState(null);
  const [reason, setReason] = useState("");
  
  const urlParams = new URLSearchParams(window.location.search);
  const saleId = urlParams.get('id');
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

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale-delete', saleId],
    queryFn: async () => {
      if (!saleId) return null;
      const sales = await Sale.filter({ id: saleId });
      return sales[0] || null;
    },
    enabled: !!saleId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Create audit log before deleting
      await AuditLog.create({
        action: "delete_sale",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: saleId,
        target_type: "Sale",
        details: sale,
        reason: reason,
        kiosk_id: sale?.kiosk_id,
      });

      // Restore inventory
      if (sale?.items) {
        const tickets = await TicketType.list();
        for (const item of sale.items) {
          const ticket = tickets.find(t => t.id === item.ticket_type_id);
          if (ticket) {
            await TicketType.update(ticket.id, {
              quantity: ticket.quantity + item.quantity,
            });
          }
        }
      }

      // Delete the sale
      await Sale.delete(saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      // Toast notification removed
      window.location.href = createPageUrl("SalesHistory");
    },
    onError: () => {
      console.error("Error deleting sale:", error);
    },
  });

  const handleDelete = () => {
    if (!reason.trim()) {
      console.warn("Please enter a reason for deletion");
      return;
    }
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-foreground mb-2">העסקה לא נמצאה</h2>
        <Link to={createPageUrl("SalesHistory")}>
          <Button>חזרה להיסטוריית מכירות</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl(`SaleDetails?id=${saleId}`)}>
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-red-600">מחיקת עסקה</h1>
          <p className="text-muted-foreground">פעולה זו אינה ניתנת לביטול</p>
        </div>
      </div>

      <Card className="border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            אזהרה - מחיקת עסקה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Sale Summary */}
          <div className="p-4 bg-accent rounded-lg space-y-2">
            <p className="text-sm"><strong>תאריך:</strong> {format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: he })}</p>
            <p className="text-sm"><strong>מוכר:</strong> {sale.seller_name}</p>
            <p className="text-sm"><strong>סכום:</strong> ₪{sale.total_amount?.toFixed(2)}</p>
            <p className="text-sm"><strong>פריטים:</strong></p>
            <ul className="text-sm mr-4 list-disc">
              {sale.items?.map((item, i) => (
                <li key={i}>{item.quantity}× {item.ticket_name} (₪{item.total?.toFixed(2)})</li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              <strong>שים לב:</strong> מחיקת העסקה תחזיר את הכרטיסים למלאי ותתעד ב-Audit Log.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-red-600">סיבת המחיקה *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="נא לפרט את סיבת המחיקה..."
              rows={3}
              className="border-red-200 focus:border-red-400"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Link to={createPageUrl(`SaleDetails?id=${saleId}`)} className="flex-1">
              <Button variant="outline" className="w-full">ביטול</Button>
            </Link>
            <Button 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחק עסקה
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}