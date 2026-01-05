import React, { useState, useEffect } from "react";
import { auth, TicketType, AuditLog, Notification } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { generateUniqueCode } from "@/firebase/services/ticketTypes";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
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
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    price: "",
    code: "",
    quantity_counter: "",
    quantity_vault: "",
    is_opened: false,
    default_quantity_per_package: "",
    min_threshold: "10",
    color: "blue",
    image_url: "",
    use_image: false,
    is_active: true,
    ticket_category: "custom",
  });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    ticketId: "",
    quantity: "",
    is_opened: false,
  });
  const [packagesDialogOpen, setPackagesDialogOpen] = useState(false);
  const [packagesFormData, setPackagesFormData] = useState({
    ticketId: "",
    ticketName: "",
    packages: "",
    destination: "counter", // "counter" or "vault"
    defaultQuantityPerPackage: null,
    is_opened: false, // Whether the tickets are opened (only for counter)
  });
  const [sortBy, setSortBy] = useState("name"); // name, price, quantity_counter, quantity_vault, total_quantity
  const [sortOrder, setSortOrder] = useState("asc"); // asc, desc
  const [advancedFilters, setAdvancedFilters] = useState({
    status: "all", // all, active, inactive
    stockStatus: "all", // all, inStock, lowStock, outOfStock
    priceRange: "all", // all, 0-25, 25-50, 50-100, 100+
    needsOpening: "all", // all, yes, no
    hasVaultStock: "all", // all, yes, no
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
    queryKey: ['tickets-inventory', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) {
        console.warn('Inventory: No currentKiosk available');
        return [];
      }
      try {
        const result = await ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
        console.log('Inventory: Loaded tickets:', result.length, 'for kiosk:', currentKiosk.id);
        return result;
      } catch (error) {
        console.error('Inventory: Error loading tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Add kiosk_id to data for initial amount
      return TicketType.create({
        ...data,
        kiosk_id: currentKiosk?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      // Use ticketTypesService directly to pass kioskId
      return ticketTypesService.updateTicketType(id, data, currentKiosk?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => TicketType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
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
      quantity_counter: "",
      quantity_vault: "",
      is_opened: false,
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
    if (user?.role === 'assistant' && !hasPermission('inventory_edit')) return;
    setSelectedTicket(ticket);
    setFormData({
      name: ticket.name,
      nickname: ticket.nickname || "",
      price: ticket.price?.toString() || "",
      code: ticket.code || "", // Keep existing code (readonly)
      quantity_counter: ticket.quantity_counter?.toString() || "0",
      quantity_vault: ticket.quantity_vault?.toString() || "0",
      is_opened: ticket.is_opened ?? false,
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
    if (user?.role === 'assistant' && !hasPermission('inventory_delete')) return;
    setSelectedTicket(ticket);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Permission gate: assistants need specific perms for add/edit
    if (user?.role === 'assistant') {
      const needed = selectedTicket ? 'inventory_edit' : 'inventory_add';
      if (!hasPermission(needed)) {
        alert('אין לך הרשאה לפעולה זו');
        return;
      }
    }
    // Generate code automatically for new tickets
    let code = formData.code;
    if (!selectedTicket) {
      // New ticket - generate unique code
      try {
        code = await generateUniqueCode(formData.ticket_category || "custom", currentKiosk?.id);
      } catch (error) {
        console.error("Error generating code:", error);
        alert("שגיאה ביצירת קוד. נסה שוב.");
        return;
      }
    } else {
      // Existing ticket - keep existing code
      code = selectedTicket.code || formData.code;
    }

    if (!currentKiosk?.id) {
      alert('לא ניתן ליצור כרטיס ללא קיוסק נבחר');
      return;
    }

    const data = {
      name: formData.name,
      nickname: formData.nickname || null, // Store null if empty
      price: parseFloat(formData.price),
      code: code,
      quantity_counter: parseInt(formData.quantity_counter) || 0,
      quantity_vault: parseInt(formData.quantity_vault) || 0,
      is_opened: formData.is_opened,
      default_quantity_per_package: formData.default_quantity_per_package ? parseInt(formData.default_quantity_per_package) : null,
      min_threshold: parseInt(formData.min_threshold) || 10,
        color: formData.use_image ? null : formData.color,
        image_url: formData.use_image ? formData.image_url : null,
        is_active: formData.is_active,
        ticket_category: formData.ticket_category || "custom",
      kiosk_id: currentKiosk.id,
    };

    if (selectedTicket) {
      const oldQuantityCounter = selectedTicket.quantity_counter ?? 0;
      const newQuantityCounter = data.quantity_counter;
      
      await updateMutation.mutateAsync({ id: selectedTicket.id, data });
      
      // Handle stock notifications (based on quantity_counter only)
      try {
        // If stock improved (went above threshold), mark existing notifications as read
        if (oldQuantityCounter <= data.min_threshold && newQuantityCounter > data.min_threshold) {
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
        
        // Check for out of stock notification (quantity_counter = 0)
        if (newQuantityCounter === 0 && oldQuantityCounter > 0) {
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
        // Check for low stock notification (quantity_counter > 0 but <= threshold)
        else if (newQuantityCounter > 0 && newQuantityCounter <= data.min_threshold && (oldQuantityCounter > data.min_threshold || oldQuantityCounter === 0)) {
          const existingLowStockNotifs = await Notification.filter({
            ticket_type_id: selectedTicket.id,
            is_read: false,
            notification_type: "low_stock",
          });
          
          if (existingLowStockNotifs.length === 0) {
            await Notification.create({
              ticket_type_id: selectedTicket.id,
              ticket_name: data.name,
              current_quantity: newQuantityCounter,
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
          kiosk_id: currentKiosk?.id,
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
          kiosk_id: currentKiosk?.id,
        });
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (user?.role === 'assistant' && !hasPermission('inventory_delete')) {
      alert('אין לך הרשאה למחיקה');
      return;
    }
    if (selectedTicket) {
      // Create audit log before delete
      await AuditLog.create({
        action: "delete_ticket_type",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: selectedTicket.id,
        target_type: "TicketType",
        details: selectedTicket,
        kiosk_id: currentKiosk?.id,
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
    
    // Advanced filters - Status
    if (advancedFilters.status !== "all") {
      if (advancedFilters.status === "active" && t.is_active === false) return false;
      if (advancedFilters.status === "inactive" && t.is_active !== false) return false;
    }
    
    // Advanced filters - Stock Status (based on quantity_counter only)
    if (advancedFilters.stockStatus !== "all") {
      const quantityCounter = t.quantity_counter ?? 0;
      const threshold = t.min_threshold || 10;
      if (advancedFilters.stockStatus === "inStock" && (quantityCounter === 0 || quantityCounter <= threshold)) return false;
      if (advancedFilters.stockStatus === "lowStock" && (quantityCounter === 0 || quantityCounter > threshold)) return false;
      if (advancedFilters.stockStatus === "outOfStock" && quantityCounter > 0) return false;
    }
    
    // Advanced filters - Price Range
    if (advancedFilters.priceRange !== "all") {
      const price = t.price || 0;
      if (advancedFilters.priceRange === "0-25" && (price < 0 || price > 25)) return false;
      if (advancedFilters.priceRange === "25-50" && (price <= 25 || price > 50)) return false;
      if (advancedFilters.priceRange === "50-100" && (price <= 50 || price > 100)) return false;
      if (advancedFilters.priceRange === "100+" && price <= 100) return false;
    }
    
    // Advanced filters - Needs Opening
    if (advancedFilters.needsOpening !== "all") {
      const quantityCounter = t.quantity_counter ?? 0;
      const needsOpening = quantityCounter > 0 && !t.is_opened;
      if (advancedFilters.needsOpening === "yes" && !needsOpening) return false;
      if (advancedFilters.needsOpening === "no" && needsOpening) return false;
    }
    
    // Advanced filters - Has Vault Stock
    if (advancedFilters.hasVaultStock !== "all") {
      const quantityVault = t.quantity_vault ?? 0;
      if (advancedFilters.hasVaultStock === "yes" && quantityVault === 0) return false;
      if (advancedFilters.hasVaultStock === "no" && quantityVault > 0) return false;
    }
    
    return true;
  });

  // Sort filtered tickets
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "name":
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
        break;
      case "price":
        aValue = a.price || 0;
        bValue = b.price || 0;
        break;
      case "quantity_counter":
        aValue = a.quantity_counter ?? 0;
        bValue = b.quantity_counter ?? 0;
        break;
      case "quantity_vault":
        aValue = a.quantity_vault ?? 0;
        bValue = b.quantity_vault ?? 0;
        break;
      case "total_quantity":
        aValue = (a.quantity_counter ?? 0) + (a.quantity_vault ?? 0);
        bValue = (b.quantity_counter ?? 0) + (b.quantity_vault ?? 0);
        break;
      default:
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
    }
    
    if (typeof aValue === "string") {
      return sortOrder === "asc" 
        ? aValue.localeCompare(bValue, 'he')
        : bValue.localeCompare(aValue, 'he');
    } else {
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    }
  });

  const hasActiveFilters = advancedFilters.status !== "all" || 
                           advancedFilters.stockStatus !== "all" || 
                           advancedFilters.priceRange !== "all" ||
                           advancedFilters.needsOpening !== "all" ||
                           advancedFilters.hasVaultStock !== "all";

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      status: "all",
      stockStatus: "all",
      priceRange: "all",
      needsOpening: "all",
      hasVaultStock: "all",
    });
  };

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('inventory_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לעמוד זה</p>
      </div>
    );
  }

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
          disabled={user?.role === 'assistant' && !hasPermission('inventory_add')}
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

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, קוד או כינוי..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Sort and Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Controls */}
          <div className="flex items-center gap-2 bg-accent p-2 rounded-lg border border-border">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] h-8 text-sm border-0 bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">שם</SelectItem>
                <SelectItem value="price">מחיר</SelectItem>
                <SelectItem value="quantity_counter">מלאי בדלפק</SelectItem>
                <SelectItem value="quantity_vault">מלאי בכספת</SelectItem>
                <SelectItem value="total_quantity">סה&quot;כ מלאי</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "מיון עולה" : "מיון יורד"}
            >
              {sortOrder === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Advanced Filters Button */}
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="h-8"
          >
            <Filter className="h-4 w-4 ml-2" />
            פילטרים
            {hasActiveFilters && (
              <Badge variant="secondary" className="mr-2 bg-indigo-100 text-indigo-700 text-xs">
                פעיל
              </Badge>
            )}
          </Button>
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  צריך לפתוח
                </Label>
                <Select
                  value={advancedFilters.needsOpening}
                  onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, needsOpening: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="הכל" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="yes">צריך לפתוח</SelectItem>
                    <SelectItem value="no">לא צריך לפתוח</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-500" />
                  מלאי בכספת
                </Label>
                <Select
                  value={advancedFilters.hasVaultStock}
                  onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, hasVaultStock: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="הכל" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="yes">יש מלאי</SelectItem>
                    <SelectItem value="no">אין מלאי</SelectItem>
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
          {sortedTickets.map((ticket, index) => {
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            const totalQuantity = quantityCounter + quantityVault;
            const isLowStock = quantityCounter <= (ticket.min_threshold || 10);
            const needsOpening = quantityCounter > 0 && !ticket.is_opened;
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
                        </div>
                        <p className="text-sm text-muted-foreground">{ticket.code}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setPackagesFormData({
                                ticketId: ticket.id,
                                ticketName: ticket.name,
                                packages: "",
                                destination: "counter",
                                defaultQuantityPerPackage: ticket.default_quantity_per_package || null,
                                is_opened: false,
                              });
                              setPackagesDialogOpen(true);
                            }}
                            disabled={user?.role === 'assistant' && !hasPermission('inventory_edit')}
                            title={ticket.default_quantity_per_package ? "עדכן מלאי לפי חבילות" : "עדכן מלאי"}
                            className={ticket.default_quantity_per_package ? "text-green-600" : ""}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {quantityVault > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setTransferFormData({ ticketId: ticket.id, quantity: "", is_opened: false });
                                setTransferDialogOpen(true);
                              }}
                              disabled={user?.role === 'assistant' && !hasPermission('inventory_edit')}
                              title="העבר מכספת לדלפק"
                            >
                              <Package className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {quantityVault === 0 && (
                            <div className="w-10 h-10"></div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(ticket)}
                            disabled={user?.role === 'assistant' && !hasPermission('inventory_edit')}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(ticket)}
                            disabled={user?.role === 'assistant' && !hasPermission('inventory_delete')}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-primary">₪{ticket.price}</span>
                      {!ticket.is_active && (
                        <Badge variant="secondary">לא פעיל</Badge>
                      )}
                    </div>

                    {/* Needs Opening Indicator */}
                    {needsOpening && (
                      <div className="mb-2 p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded border border-orange-300 dark:border-orange-700">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="text-xs">צריך לפתוח</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs bg-white dark:bg-gray-800 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                            onClick={async () => {
                              if (!currentKiosk?.id) {
                                alert('לא ניתן לפתוח כרטיסים ללא קיוסק נבחר');
                                return;
                              }
                              
                              if (user?.role === 'assistant' && !hasPermission('inventory_edit')) {
                                alert('אין לך הרשאה לערוך מלאי');
                                return;
                              }
                              
                              try {
                                await ticketTypesService.updateTicketType(ticket.id, {
                                  quantity_counter: ticket.quantity_counter,
                                  quantity_vault: ticket.quantity_vault,
                                  is_opened: true,
                                }, currentKiosk.id);
                                
                                // Log to audit
                                await AuditLog.create({
                                  action: 'open_tickets',
                                  entity_type: 'ticketType',
                                  entity_id: ticket.id,
                                  entity_name: ticket.name,
                                  details: {
                                    ticket_name: ticket.name,
                                    ticket_id: ticket.id,
                                    quantity_opened: ticket.quantity_counter,
                                    message: `נפתחו ${ticket.quantity_counter} כרטיסים מסוג ${ticket.name}`
                                  },
                                  user_id: user?.id,
                                  user_name: user?.full_name || user?.email,
                                });
                                
                                queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                                queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                                queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                              } catch (error) {
                                console.error('Error opening tickets:', error);
                                alert('שגיאה בפתיחת הכרטיסים: ' + (error.message || 'שגיאה לא ידועה'));
                              }
                            }}
                            disabled={user?.role === 'assistant' && !hasPermission('inventory_edit')}
                          >
                            <Check className="h-3 w-3" />
                            <span className="mr-1">פתח</span>
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Inventory Display */}
                    <div className={`flex items-center justify-between p-3 rounded-lg ${
                      isLowStock ? 'bg-amber-900/30' : 'bg-accent'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">מלאי</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-xs font-medium ${
                            quantityCounter === 0 ? 'text-red-600' : 
                            isLowStock ? 'text-amber-500' : 'text-foreground'
                          }`}>
                            דלפק: {quantityCounter}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            כספת: {quantityVault}
                          </span>
                          <span className={`text-sm font-bold ${
                            totalQuantity === 0 ? 'text-red-600' : 'text-foreground'
                          }`}>
                            סה"כ: {totalQuantity}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          מינימום: {ticket.min_threshold}
                        </span>
                        {ticket.default_quantity_per_package && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {ticket.default_quantity_per_package} כרטיסים בחבילה
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {sortedTickets.length === 0 && !isLoading && (
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
                <Label>כמות בדלפק</Label>
                <Input
                  type="number"
                  value={formData.quantity_counter}
                  onChange={(e) => setFormData({ ...formData, quantity_counter: e.target.value })}
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-slate-500">כרטיסים זמינים למכירה</p>
              </div>
              <div className="space-y-2">
                <Label>כמות בכספת</Label>
                <Input
                  type="number"
                  value={formData.quantity_vault}
                  onChange={(e) => setFormData({ ...formData, quantity_vault: e.target.value })}
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-slate-500">כרטיסים לא זמינים למכירה</p>
              </div>
            </div>

            {parseInt(formData.quantity_counter) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_opened"
                    checked={formData.is_opened}
                    onChange={(e) => setFormData({ ...formData, is_opened: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_opened" className="cursor-pointer">
                    הכרטיסים בדלפק פתוחים (זמינים למכירה)
                  </Label>
                </div>
                <p className="text-xs text-slate-500">אם לא מסומן, הכרטיסים לא יוצגו במערכת המכירה</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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

      {/* Transfer Inventory Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>העברת מלאי מכספת לדלפק</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              const selectedTicketForTransfer = tickets.find(t => t.id === transferFormData.ticketId);
              const maxTransfer = selectedTicketForTransfer?.quantity_vault ?? 0;
              
              return (
                <>
                  {selectedTicketForTransfer && (
                    <div className="space-y-2">
                      <Label>כרטיס</Label>
                      <div className="p-3 bg-accent rounded-lg border border-border">
                        <div className="font-medium text-foreground">{selectedTicketForTransfer.name}</div>
                        {selectedTicketForTransfer.nickname && (
                          <div className="text-sm text-muted-foreground">"{selectedTicketForTransfer.nickname}"</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedTicketForTransfer && (
                    <>
                      <div className="p-3 bg-accent rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">מידע על הכרטיס</div>
                        <div className="text-sm">
                          <div>כמות בכספת: <strong>{selectedTicketForTransfer.quantity_vault ?? 0}</strong></div>
                          <div>כמות בדלפק: <strong>{selectedTicketForTransfer.quantity_counter ?? 0}</strong></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>כמות להעברה</Label>
                        <Input
                          type="number"
                          value={transferFormData.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const max = maxTransfer;
                            setTransferFormData({ ...transferFormData, quantity: val > max ? max.toString() : e.target.value });
                          }}
                          placeholder="0"
                          min="1"
                          max={maxTransfer}
                        />
                        <p className="text-xs text-slate-500">
                          מקסימום: {maxTransfer} כרטיסים
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="transfer-opened"
                            checked={transferFormData.is_opened}
                            onChange={(e) => setTransferFormData({ ...transferFormData, is_opened: e.target.checked })}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="transfer-opened" className="cursor-pointer">
                            הכרטיסים פתוחים (זמינים למכירה)
                          </Label>
                        </div>
                      </div>
                      
                      {!transferFormData.is_opened && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-orange-800 dark:text-orange-300">
                              <strong>חשוב:</strong> לאחר ההעברה, לא לשכוח לפתוח את הכרטיסים כדי שיהיו זמינים למכירה.
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTransferDialogOpen(false);
              setTransferFormData({ ticketId: "", quantity: "", is_opened: false });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                if (!transferFormData.ticketId || !transferFormData.quantity) {
                  alert('אנא בחר כרטיס והזן כמות');
                  return;
                }
                
                const quantity = parseInt(transferFormData.quantity);
                if (quantity <= 0) {
                  alert('הכמות חייבת להיות גדולה מ-0');
                  return;
                }
                
                try {
                  if (!currentKiosk?.id) {
                    alert('לא ניתן להעביר מלאי ללא קיוסק נבחר');
                    return;
                  }
                  
                  const selectedTicketForTransfer = tickets.find(t => t.id === transferFormData.ticketId);
                  if (!selectedTicketForTransfer) {
                    alert('כרטיס לא נמצא');
                    return;
                  }
                  
                  const currentCounter = selectedTicketForTransfer.quantity_counter ?? 0;
                  const currentVault = selectedTicketForTransfer.quantity_vault ?? 0;
                  
                  if (quantity > currentVault) {
                    alert(`לא ניתן להעביר ${quantity} כרטיסים. זמין בכספת: ${currentVault}`);
                    return;
                  }
                  
                  // Use updateTicketType directly to preserve all values and set is_opened
                  await ticketTypesService.updateTicketType(transferFormData.ticketId, {
                    quantity_counter: currentCounter + quantity,
                    quantity_vault: currentVault - quantity,
                    is_opened: transferFormData.is_opened,
                  }, currentKiosk.id);
                  
                  // Log to audit
                  await AuditLog.create({
                    action: 'transfer_inventory',
                    entity_type: 'ticketType',
                    entity_id: transferFormData.ticketId,
                    entity_name: selectedTicketForTransfer.name,
                    details: {
                      ticket_name: selectedTicketForTransfer.name,
                      ticket_id: transferFormData.ticketId,
                      quantity: quantity,
                      from: 'vault',
                      to: 'counter',
                      is_opened: transferFormData.is_opened,
                      quantity_before_vault: currentVault,
                      quantity_after_vault: currentVault - quantity,
                      quantity_before_counter: currentCounter,
                      quantity_after_counter: currentCounter + quantity,
                      message: `הועברו ${quantity} כרטיסים מכספת לדלפק${transferFormData.is_opened ? ' ונפתחו' : ''}`
                    },
                    user_id: user?.id,
                    user_name: user?.full_name || user?.email,
                  });
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  
                  setTransferDialogOpen(false);
                  setTransferFormData({ ticketId: "", quantity: "", is_opened: false });
                } catch (error) {
                  console.error('Error transferring inventory:', error);
                  alert('שגיאה בהעברת המלאי: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={!transferFormData.ticketId || !transferFormData.quantity || parseInt(transferFormData.quantity) <= 0}
              className="bg-theme-gradient"
            >
              העבר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Packages Dialog */}
      <Dialog open={packagesDialogOpen} onOpenChange={setPackagesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {packagesFormData.defaultQuantityPerPackage ? "עדכן מלאי לפי חבילות" : "עדכן מלאי"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {packagesFormData.ticketId ? (
              <>
                <div className="p-3 bg-accent rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">כרטיס נבחר</div>
                  <div className="text-sm font-semibold">{packagesFormData.ticketName}</div>
                  {packagesFormData.defaultQuantityPerPackage && (
                    <div className="text-xs text-muted-foreground mt-1">
                      כמות בכל חבילה: {packagesFormData.defaultQuantityPerPackage} כרטיסים
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>
                    {packagesFormData.defaultQuantityPerPackage ? "מספר חבילות" : "מספר יחידות"}
                  </Label>
                  <Input
                    type="number"
                    value={packagesFormData.packages}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || (parseInt(val) > 0)) {
                        setPackagesFormData({ ...packagesFormData, packages: val });
                      }
                    }}
                    placeholder="0"
                    min="1"
                  />
                  {packagesFormData.packages && packagesFormData.defaultQuantityPerPackage && (
                    <p className="text-sm text-muted-foreground">
                      סה"כ כרטיסים: <strong>{parseInt(packagesFormData.packages || 0) * packagesFormData.defaultQuantityPerPackage}</strong>
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>יעד</Label>
                  <Select
                    value={packagesFormData.destination}
                    onValueChange={(value) => setPackagesFormData({ ...packagesFormData, destination: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="counter">דלפק</SelectItem>
                      <SelectItem value="vault">כספת</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {packagesFormData.destination === "counter" && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="packages-opened"
                          checked={packagesFormData.is_opened}
                          onChange={(e) => setPackagesFormData({ ...packagesFormData, is_opened: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="packages-opened" className="cursor-pointer">
                          הכרטיסים פתוחים (זמינים למכירה)
                        </Label>
                      </div>
                    </div>
                    {!packagesFormData.is_opened && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-orange-800 dark:text-orange-300">
                            <strong>חשוב:</strong> לאחר ההוספה, לא לשכוח לפתוח את הכרטיסים כדי שיהיו זמינים למכירה.
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label>בחר כרטיס</Label>
                <Select
                  value={packagesFormData.ticketId}
                  onValueChange={(value) => {
                    const selectedTicket = tickets.find(t => t.id === value);
                    setPackagesFormData({
                      ...packagesFormData,
                      ticketId: value,
                      ticketName: selectedTicket?.name || "",
                      defaultQuantityPerPackage: selectedTicket?.default_quantity_per_package || null,
                      is_opened: false,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר כרטיס" />
                  </SelectTrigger>
                  <SelectContent>
                    {tickets.map(ticket => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.name}
                        {ticket.default_quantity_per_package && ` (${ticket.default_quantity_per_package} כרטיסים בחבילה)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPackagesDialogOpen(false);
              setPackagesFormData({
                ticketId: "",
                ticketName: "",
                packages: "",
                destination: "counter",
                defaultQuantityPerPackage: null,
              });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                if (!packagesFormData.ticketId || !packagesFormData.packages) {
                  alert('אנא בחר כרטיס והזן מספר חבילות');
                  return;
                }
                
                const inputValue = parseInt(packagesFormData.packages);
                if (inputValue <= 0) {
                  alert('הערך חייב להיות גדול מ-0');
                  return;
                }
                
                // Calculate quantity: if defaultQuantityPerPackage exists, multiply by it, otherwise use input directly
                const quantity = packagesFormData.defaultQuantityPerPackage 
                  ? inputValue * packagesFormData.defaultQuantityPerPackage 
                  : inputValue;
                
                try {
                  if (!currentKiosk?.id) {
                    alert('לא ניתן לעדכן מלאי ללא קיוסק נבחר');
                    return;
                  }
                  
                  const selectedTicket = tickets.find(t => t.id === packagesFormData.ticketId);
                  if (!selectedTicket) {
                    alert('כרטיס לא נמצא');
                    return;
                  }
                  
                  const currentCounter = selectedTicket.quantity_counter ?? 0;
                  const currentVault = selectedTicket.quantity_vault ?? 0;
                  const currentIsOpened = selectedTicket.is_opened ?? false;
                  
                  const updateData = {};
                  if (packagesFormData.destination === "counter") {
                    updateData.quantity_counter = currentCounter + quantity;
                    // Use the checkbox value to determine if tickets are opened
                    updateData.is_opened = packagesFormData.is_opened;
                    // Preserve vault value
                    updateData.quantity_vault = currentVault;
                  } else {
                    // When updating vault, preserve counter and is_opened values
                    updateData.quantity_counter = currentCounter;
                    updateData.quantity_vault = currentVault + quantity;
                    updateData.is_opened = currentIsOpened;
                  }
                  
                  await ticketTypesService.updateTicketType(packagesFormData.ticketId, updateData, currentKiosk.id);
                  
                  // Log to audit
                  await AuditLog.create({
                    action: 'add_inventory',
                    entity_type: 'ticketType',
                    entity_id: packagesFormData.ticketId,
                    entity_name: selectedTicket.name,
                    details: {
                      ticket_name: selectedTicket.name,
                      ticket_id: packagesFormData.ticketId,
                      quantity: quantity,
                      destination: packagesFormData.destination,
                      destination_name: packagesFormData.destination === "counter" ? "דלפק" : "כספת",
                      packages: packagesFormData.defaultQuantityPerPackage ? inputValue : null,
                      quantity_per_package: packagesFormData.defaultQuantityPerPackage || null,
                      is_opened: packagesFormData.destination === "counter" ? packagesFormData.is_opened : null,
                      quantity_before_counter: currentCounter,
                      quantity_after_counter: packagesFormData.destination === "counter" ? currentCounter + quantity : currentCounter,
                      quantity_before_vault: currentVault,
                      quantity_after_vault: packagesFormData.destination === "vault" ? currentVault + quantity : currentVault,
                      message: packagesFormData.defaultQuantityPerPackage
                        ? `הוספו ${inputValue} חבילות (${quantity} כרטיסים) ל${packagesFormData.destination === "counter" ? "דלפק" : "כספת"}`
                        : `הוספו ${quantity} כרטיסים ל${packagesFormData.destination === "counter" ? "דלפק" : "כספת"}`
                    },
                    user_id: user?.id,
                    user_name: user?.full_name || user?.email,
                  });
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  
                  setPackagesDialogOpen(false);
                  setPackagesFormData({
                    ticketId: "",
                    ticketName: "",
                    packages: "",
                    destination: "counter",
                    defaultQuantityPerPackage: null,
                    is_opened: false,
                  });
                } catch (error) {
                  console.error('Error adding packages:', error);
                  alert('שגיאה בהוספת החבילות: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={!packagesFormData.ticketId || !packagesFormData.packages || parseInt(packagesFormData.packages) <= 0}
              className="bg-theme-gradient"
            >
              הוסף
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