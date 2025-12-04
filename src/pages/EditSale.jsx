import React, { useState, useEffect } from "react";
import { auth, Sale, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  ArrowRight, 
  Save,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Toast removed

export default function EditSale() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    payment_method: "cash",
    status: "completed",
    notes: "",
    reason: "",
  });
  
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
    queryKey: ['sale-edit', saleId],
    queryFn: async () => {
      if (!saleId) return null;
      const sales = await Sale.filter({ id: saleId });
      return sales[0] || null;
    },
    enabled: !!saleId,
  });

  useEffect(() => {
    if (sale) {
      setFormData({
        payment_method: sale.payment_method || "cash",
        status: sale.status || "completed",
        notes: sale.notes || "",
        reason: "",
      });
    }
  }, [sale]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      await Sale.update(saleId, {
        payment_method: data.payment_method,
        status: data.status,
        notes: data.notes,
      });

      await AuditLog.create({
        action: "edit_sale",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: saleId,
        target_type: "Sale",
        details: { previous: sale, updated: data },
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      // Toast notification removed
      window.location.href = createPageUrl(`SaleDetails?id=${saleId}`);
    },
    onError: () => {
      console.error("Error updating sale:", error);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.reason.trim()) {
      console.warn("Please enter a reason for change");
      return;
    }
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-slate-800 mb-2">העסקה לא נמצאה</h2>
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
          <h1 className="text-2xl font-bold text-slate-800">עריכת עסקה</h1>
          <p className="text-slate-500">
            {format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי העסקה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Read-only info */}
            <div className="p-4 bg-accent rounded-lg space-y-2">
              <p className="text-sm"><strong>מוכר:</strong> {sale.seller_name}</p>
              <p className="text-sm"><strong>סכום:</strong> ₪{sale.total_amount?.toFixed(2)}</p>
              <p className="text-sm"><strong>פריטים:</strong> {sale.items?.map(i => `${i.quantity}×${i.ticket_name}`).join(", ")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>אמצעי תשלום</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({...formData, payment_method: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">מזומן</SelectItem>
                    <SelectItem value="card">כרטיס אשראי</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">הושלם</SelectItem>
                    <SelectItem value="cancelled">בוטל</SelectItem>
                    <SelectItem value="refunded">זוכה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="הערות לעסקה..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-red-600">סיבת השינוי *</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="נא לפרט את סיבת השינוי..."
                rows={2}
                className="border-red-200 focus:border-red-400"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Link to={createPageUrl(`SaleDetails?id=${saleId}`)} className="flex-1">
                <Button variant="outline" className="w-full">ביטול</Button>
              </Link>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="flex-1 bg-theme-gradient"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 ml-2" />
                    שמור שינויים
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}