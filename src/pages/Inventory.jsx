import React, { useState, useEffect } from "react";
import { auth, TicketType, AuditLog, Notification } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Package, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Check,
  X,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Toast removed

const colorOptions = [
  { value: "blue", label: "כחול", class: "bg-blue-500" },
  { value: "green", label: "ירוק", class: "bg-emerald-500" },
  { value: "purple", label: "סגול", class: "bg-purple-500" },
  { value: "orange", label: "כתום", class: "bg-orange-500" },
  { value: "pink", label: "ורוד", class: "bg-pink-500" },
  { value: "cyan", label: "תכלת", class: "bg-cyan-500" },
  { value: "red", label: "אדום", class: "bg-red-500" },
  { value: "yellow", label: "צהוב", class: "bg-yellow-500" },
];

export default function Inventory() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    code: "",
    quantity: "",
    min_threshold: "10",
    color: "blue",
    image_url: "",
    use_image: false,
    is_active: true,
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

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets-all'],
    queryFn: () => TicketType.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => TicketType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-all'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => TicketType.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-all'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => TicketType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-all'] });
      setDeleteDialogOpen(false);
      setSelectedTicket(null);
      // Toast notification removed
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      code: "",
      quantity: "",
      min_threshold: "10",
      color: "blue",
      image_url: "",
      use_image: false,
      is_active: true,
    });
    setSelectedTicket(null);
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      name: ticket.name,
      price: ticket.price?.toString() || "",
      code: ticket.code || "",
      quantity: ticket.quantity?.toString() || "0",
      min_threshold: ticket.min_threshold?.toString() || "10",
      color: ticket.color || "blue",
      image_url: ticket.image_url || "",
      use_image: !!ticket.image_url,
      is_active: ticket.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleDelete = (ticket) => {
    setSelectedTicket(ticket);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    const data = {
      name: formData.name,
      price: parseFloat(formData.price),
      code: formData.code,
      quantity: parseInt(formData.quantity) || 0,
      min_threshold: parseInt(formData.min_threshold) || 10,
        color: formData.use_image ? null : formData.color,
        image_url: formData.use_image ? formData.image_url : null,
        is_active: formData.is_active,
    };

    if (selectedTicket) {
      const oldQuantity = selectedTicket.quantity;
      const newQuantity = data.quantity;
      
      await updateMutation.mutateAsync({ id: selectedTicket.id, data });
      
      // Handle stock notifications
      try {
        // If stock improved (went above threshold), mark existing notifications as read
        if (oldQuantity <= data.min_threshold && newQuantity > data.min_threshold) {
          const existingNotifs = await Notification.filter({
            ticket_type_id: selectedTicket.id,
            is_read: false,
          });
          
          for (const notif of existingNotifs) {
            if (notif.notification_type === 'low_stock' || notif.notification_type === 'out_of_stock') {
              await Notification.update(notif.id, { is_read: true });
            }
          }
          queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
        }
        
        // Check for out of stock notification (quantity = 0)
        if (newQuantity === 0 && oldQuantity > 0) {
          const existingOutOfStockNotifs = await Notification.filter({
            ticket_type_id: selectedTicket.id,
            is_read: false,
            notification_type: "out_of_stock",
          });
          
          if (existingOutOfStockNotifs.length === 0) {
            await Notification.create({
              ticket_type_id: selectedTicket.id,
              ticket_name: data.name,
              current_quantity: 0,
              threshold: data.min_threshold,
              notification_type: "out_of_stock",
            });
            queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
          }
        }
        // Check for low stock notification (quantity > 0 but <= threshold)
        else if (newQuantity > 0 && newQuantity <= data.min_threshold && (oldQuantity > data.min_threshold || oldQuantity === 0)) {
          const existingLowStockNotifs = await Notification.filter({
            ticket_type_id: selectedTicket.id,
            is_read: false,
            notification_type: "low_stock",
          });
          
          if (existingLowStockNotifs.length === 0) {
            await Notification.create({
              ticket_type_id: selectedTicket.id,
              ticket_name: data.name,
              current_quantity: newQuantity,
              threshold: data.min_threshold,
              notification_type: "low_stock",
            });
            queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
          }
        }
      } catch (notificationError) {
        console.error("Error handling stock notifications:", notificationError);
      }
      
      // Create audit log
      try {
        await AuditLog.create({
          action: "edit_ticket_type",
          actor_id: user?.id,
          actor_name: user?.full_name || user?.email,
          target_id: selectedTicket.id,
          target_type: "TicketType",
          details: { previous: selectedTicket, updated: data },
        });
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
    } else {
      await createMutation.mutateAsync(data);
      
      // Create audit log
      try {
        await AuditLog.create({
          action: "create_ticket_type",
          actor_id: user?.id,
          actor_name: user?.full_name || user?.email,
          target_type: "TicketType",
          details: data,
        });
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedTicket) {
      // Create audit log before delete
      await AuditLog.create({
        action: "delete_ticket_type",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: selectedTicket.id,
        target_type: "TicketType",
        details: selectedTicket,
      });
      
      await deleteMutation.mutateAsync(selectedTicket.id);
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.name?.includes(searchTerm) || t.code?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ניהול מלאי</h1>
          <p className="text-slate-500">ניהול סוגי כרטיסים וכמויות</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className="bg-gradient-to-r from-indigo-500 to-purple-600"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף סוג כרטיס
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          placeholder="חיפוש לפי שם או קוד..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {filteredTickets.map((ticket, index) => {
            const isLowStock = ticket.quantity <= ticket.min_threshold;
            const colorClass = colorOptions.find(c => c.value === ticket.color)?.class || "bg-blue-500";
            
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${!ticket.is_active ? 'opacity-60' : ''}`}>
                  {/* Color Strip or Image */}
                  {ticket.image_url ? (
                    <div className="h-32 w-full overflow-hidden">
                      <img 
                        src={ticket.image_url} 
                        alt={ticket.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div class="h-2 ${colorClass}"></div>`;
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`h-2 ${colorClass}`} />
                  )}
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800">{ticket.name}</h3>
                        <p className="text-sm text-slate-500">{ticket.code}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(ticket)}>
                          <Edit className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(ticket)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-indigo-600">₪{ticket.price}</span>
                      {!ticket.is_active && (
                        <Badge variant="secondary">לא פעיל</Badge>
                      )}
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-lg ${
                      isLowStock ? 'bg-amber-50' : 'bg-slate-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-600">מלאי</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-bold ${
                          ticket.quantity === 0 ? 'text-red-600' : 
                          isLowStock ? 'text-amber-600' : 'text-slate-800'
                        }`}>
                          {ticket.quantity} יחידות
                        </span>
                        <span className="text-xs text-slate-500">
                          מינימום: {ticket.min_threshold}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredTickets.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">לא נמצאו סוגי כרטיסים</p>
          <p className="text-sm text-slate-400 mt-1">לחץ על "הוסף סוג כרטיס" כדי להתחיל</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-2 bg-slate-200" />
              <CardContent className="p-4">
                <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
                <div className="h-6 w-16 bg-slate-200 rounded mb-3" />
                <div className="h-12 bg-slate-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? "עריכת סוג כרטיס" : "הוספת סוג כרטיס"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>שם הכרטיס</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="למשל: כרטיס מזל זהב"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>מחיר (₪)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>קוד</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="A1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>כמות במלאי</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>סף התראה</Label>
                <Input
                  type="number"
                  value={formData.min_threshold}
                  onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>עיצוב הכרטיס</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={!formData.use_image ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, use_image: false, image_url: "" })}
                  >
                    <Palette className="h-4 w-4 ml-2" />
                    צבע
                  </Button>
                  <Button
                    type="button"
                    variant={formData.use_image ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, use_image: true, color: "blue" })}
                  >
                    <Package className="h-4 w-4 ml-2" />
                    תמונה
                  </Button>
                </div>
              </div>
              
              {!formData.use_image ? (
                <div className="space-y-2">
                  <Label>צבע</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(value) => setFormData({ ...formData, color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full ${color.class}`} />
                            <span>{color.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>URL תמונה</Label>
                  <Input
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                  {formData.image_url && (
                    <div className="mt-2">
                      <img 
                        src={formData.image_url} 
                        alt="תצוגה מקדימה" 
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>כרטיס פעיל</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.price}
              className="bg-gradient-to-r from-indigo-500 to-purple-600"
            >
              {selectedTicket ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סוג כרטיס</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את "{selectedTicket?.name}"? 
              פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}