import React, { useState, useEffect } from "react";
import { auth, TicketType, AuditLog, Notification } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { generateUniqueCode } from "@/firebase/services/ticketTypes";
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
  Palette,
  Filter,
  XCircle
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
    nickname: "",
    price: "",
    code: "",
    quantity: "",
    default_quantity_per_package: "",
    min_threshold: "10",
    color: "blue",
    image_url: "",
    use_image: false,
    is_active: true,
    ticket_category: "custom",
  });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState({
    status: "all", // all, active, inactive
    stockStatus: "all", // all, inStock, lowStock, outOfStock
    priceRange: "all", // all, 0-25, 25-50, 50-100, 100+
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
      nickname: "",
      price: "",
      code: "", // Will be generated automatically
      quantity: "",
      default_quantity_per_package: "",
      min_threshold: "10",
      color: "blue",
      image_url: "",
      use_image: false,
      is_active: true,
      ticket_category: "custom",
    });
    setSelectedTicket(null);
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      name: ticket.name,
      nickname: ticket.nickname || "",
      price: ticket.price?.toString() || "",
      code: ticket.code || "", // Keep existing code (readonly)
      quantity: ticket.quantity?.toString() || "0",
      default_quantity_per_package: ticket.default_quantity_per_package?.toString() || "",
      min_threshold: ticket.min_threshold?.toString() || "10",
      color: ticket.color || "blue",
      image_url: ticket.image_url || "",
      use_image: !!ticket.image_url,
      is_active: ticket.is_active !== false,
      ticket_category: ticket.ticket_category || "custom",
    });
    setDialogOpen(true);
  };

  const handleDelete = (ticket) => {
    setSelectedTicket(ticket);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Generate code automatically for new tickets
    let code = formData.code;
    if (!selectedTicket) {
      // New ticket - generate unique code
      try {
        code = await generateUniqueCode(formData.ticket_category || "custom");
      } catch (error) {
        console.error("Error generating code:", error);
        alert("שגיאה ביצירת קוד. נסה שוב.");
        return;
      }
    } else {
      // Existing ticket - keep existing code
      code = selectedTicket.code || formData.code;
    }

    const data = {
      name: formData.name,
      nickname: formData.nickname || null, // Store null if empty
      price: parseFloat(formData.price),
      code: code,
      quantity: parseInt(formData.quantity) || 0,
      default_quantity_per_package: formData.default_quantity_per_package ? parseInt(formData.default_quantity_per_package) : null,
      min_threshold: parseInt(formData.min_threshold) || 10,
        color: formData.use_image ? null : formData.color,
        image_url: formData.use_image ? formData.image_url : null,
        is_active: formData.is_active,
        ticket_category: formData.ticket_category || "custom",
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

  // Calculate statistics
  const totalTickets = tickets.length;
  const activeTickets = tickets.filter(t => t.is_active !== false).length;
  const inactiveTickets = tickets.filter(t => t.is_active === false).length;

  const filteredTickets = tickets.filter(t => {
    // Search filter - includes name, code, and nickname
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      t.name?.toLowerCase().includes(searchLower) || 
      t.code?.toLowerCase().includes(searchLower) ||
      t.nickname?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    
    // Category filter
    if (categoryFilter !== "all") {
      const ticketCategory = t.ticket_category || "custom";
      if (categoryFilter !== ticketCategory) return false;
    }
    
    // Advanced filters - Status
    if (advancedFilters.status !== "all") {
      if (advancedFilters.status === "active" && t.is_active === false) return false;
      if (advancedFilters.status === "inactive" && t.is_active !== false) return false;
    }
    
    // Advanced filters - Stock Status
    if (advancedFilters.stockStatus !== "all") {
      const quantity = t.quantity || 0;
      const threshold = t.min_threshold || 10;
      if (advancedFilters.stockStatus === "inStock" && (quantity === 0 || quantity <= threshold)) return false;
      if (advancedFilters.stockStatus === "lowStock" && (quantity === 0 || quantity > threshold)) return false;
      if (advancedFilters.stockStatus === "outOfStock" && quantity > 0) return false;
    }
    
    // Advanced filters - Price Range
    if (advancedFilters.priceRange !== "all") {
      const price = t.price || 0;
      if (advancedFilters.priceRange === "0-25" && (price < 0 || price > 25)) return false;
      if (advancedFilters.priceRange === "25-50" && (price <= 25 || price > 50)) return false;
      if (advancedFilters.priceRange === "50-100" && (price <= 50 || price > 100)) return false;
      if (advancedFilters.priceRange === "100+" && price <= 100) return false;
    }
    
    return true;
  });

  const hasActiveFilters = advancedFilters.status !== "all" || 
                           advancedFilters.stockStatus !== "all" || 
                           advancedFilters.priceRange !== "all";

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      status: "all",
      stockStatus: "all",
      priceRange: "all",
    });
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול מלאי</h1>
          <p className="text-muted-foreground">ניהול סוגי כרטיסים וכמויות</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className="bg-theme-gradient"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף סוג כרטיס
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm mb-1">סה"כ כרטיסים</p>
                <p className="text-3xl font-bold">{totalTickets}</p>
              </div>
              <Package className="h-8 w-8 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm mb-1">כרטיסים פעילים</p>
                <p className="text-3xl font-bold">{activeTickets}</p>
              </div>
              <Check className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-400 to-slate-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm mb-1">לא פעילים</p>
                <p className="text-3xl font-bold">{inactiveTickets}</p>
              </div>
              <X className="h-8 w-8 text-slate-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Basic Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, קוד או כינוי..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="סוג כרטיס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="pais">מפעל הפיס</SelectItem>
            <SelectItem value="custom">מותאם אישית</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showAdvancedFilters ? "default" : "outline"}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="w-full sm:w-auto"
        >
          <Filter className="h-4 w-4 ml-2" />
          פילטרים נוספים
          {hasActiveFilters && (
            <Badge variant="secondary" className="mr-2 bg-indigo-100 text-indigo-700">
              פעיל
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">פילטרים מתקדמים</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAdvancedFilters}
                  className="text-muted-foreground"
                >
                  <XCircle className="h-4 w-4 ml-2" />
                  נקה פילטרים
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select
                  value={advancedFilters.status}
                  onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="כל הסטטוסים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>מצב מלאי</Label>
                <Select
                  value={advancedFilters.stockStatus}
                  onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, stockStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="כל המצבים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המצבים</SelectItem>
                    <SelectItem value="inStock">במלאי (מעל סף)</SelectItem>
                    <SelectItem value="lowStock">מלאי נמוך (בסף)</SelectItem>
                    <SelectItem value="outOfStock">אזל מהמלאי</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>טווח מחיר</Label>
                <Select
                  value={advancedFilters.priceRange}
                  onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, priceRange: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="כל המחירים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המחירים</SelectItem>
                    <SelectItem value="0-25">₪0 - ₪25</SelectItem>
                    <SelectItem value="25-50">₪25 - ₪50</SelectItem>
                    <SelectItem value="50-100">₪50 - ₪100</SelectItem>
                    <SelectItem value="100+">₪100 ומעלה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div>
                            <h3 className="font-bold text-foreground">{ticket.name}</h3>
                            {ticket.nickname && (
                              <p className="text-sm text-muted-foreground font-medium">"{ticket.nickname}"</p>
                            )}
                          </div>
                          {ticket.ticket_category === 'pais' && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              מפעל הפיס
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{ticket.code}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(ticket)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(ticket)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-primary">₪{ticket.price}</span>
                      {!ticket.is_active && (
                        <Badge variant="secondary">לא פעיל</Badge>
                      )}
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-lg ${
                      isLowStock ? 'bg-amber-900/30' : 'bg-accent'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">מלאי</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-bold ${
                          ticket.quantity === 0 ? 'text-red-600' : 
                          isLowStock ? 'text-amber-500' : 'text-foreground'
                        }`}>
                          {ticket.quantity} יחידות
                        </span>
                        <span className="text-xs text-muted-foreground">
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
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">לא נמצאו סוגי כרטיסים</p>
          <p className="text-sm text-muted-foreground mt-1">לחץ על "הוסף סוג כרטיס" כדי להתחיל</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-2 bg-accent" />
              <CardContent className="p-4">
                <div className="h-4 w-24 bg-accent rounded mb-2" />
                <div className="h-6 w-16 bg-accent rounded mb-3" />
                <div className="h-12 bg-accent rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {selectedTicket ? "עריכת סוג כרטיס" : "הוספת סוג כרטיס"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label>שם הכרטיס</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="למשל: כרטיס מזל זהב"
              />
            </div>

            <div className="space-y-2">
              <Label>כינוי (אופציונלי)</Label>
              <Input
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="למשל: מטוסים (לכרטיס אואזיס)"
              />
              <p className="text-xs text-slate-500">כינוי שיופיע ליד השם המקורי</p>
            </div>

            <div className="space-y-2">
              <Label>סוג כרטיס</Label>
              <Select
                value={formData.ticket_category}
                onValueChange={(value) => setFormData({ ...formData, ticket_category: value })}
                disabled={!!selectedTicket && selectedTicket.ticket_category === 'pais'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">מותאם אישית</SelectItem>
                  <SelectItem value="pais">מפעל הפיס</SelectItem>
                </SelectContent>
              </Select>
              {selectedTicket && selectedTicket.ticket_category === 'pais' && (
                <p className="text-xs text-slate-500">לא ניתן לשנות סוג כרטיס של מפעל הפיס</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>מחיר (₪)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="10"
                  readOnly={!!selectedTicket}
                  disabled={!!selectedTicket}
                  className={selectedTicket ? "bg-accent cursor-not-allowed" : ""}
                />
                {selectedTicket && (
                  <p className="text-xs text-slate-500">מחיר לא ניתן לשינוי</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>קוד</Label>
                <Input
                  value={formData.code || (selectedTicket ? selectedTicket.code : "")}
                  readOnly
                  disabled
                  placeholder={selectedTicket ? "קוד קיים" : "ייווצר אוטומטית"}
                  className="bg-accent cursor-not-allowed"
                />
                {!selectedTicket && (
                  <p className="text-xs text-slate-500">הקוד ייווצר אוטומטית בעת שמירה</p>
                )}
                {selectedTicket && (
                  <p className="text-xs text-slate-500">קוד לא ניתן לשינוי</p>
                )}
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
                <Label>כמות יחידות בחבילה</Label>
                <Input
                  type="number"
                  value={formData.default_quantity_per_package}
                  onChange={(e) => setFormData({ ...formData, default_quantity_per_package: e.target.value })}
                  placeholder="50"
                />
                <p className="text-xs text-slate-500">כמות יחידות בחבילה חדשה (אופציונלי)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 font-medium mb-1">⚠️ זכויות יוצרים</p>
                    <p className="text-xs text-amber-700">
                      יש לוודא שיש לך זכויות שימוש בתמונה. שימוש בתמונות ללא רישיון עלול להפר זכויות יוצרים.
                    </p>
                  </div>
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

          <DialogFooter className="gap-3 sm:gap-3 flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.price}
              className="bg-theme-gradient"
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