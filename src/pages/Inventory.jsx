import React, { useState, useEffect, useMemo } from "react";
import { auth, TicketType, AuditLog, Notification } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { generateUniqueCode } from "@/firebase/services/ticketTypes";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Minus,
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
  ArrowDown,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  const [addTicketSearch, setAddTicketSearch] = useState("");
  const [addTicketOpen, setAddTicketOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("counter"); // "counter" or "vault"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState(new Set());
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    price: "",
    code: "",
    // Counter fields (mutually exclusive)
    counter_units: "",
    counter_packages: "",
    // Vault fields (mutually exclusive)
    vault_units: "",
    vault_packages: "",
    default_quantity_per_package: "",
    min_threshold: "10",
    color: "blue",
    image_url: "",
    use_image: false,
    is_active: true,
  });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    ticketId: "",
    transfer_units: "",
    transfer_packages: "",
  });
  const [packagesDialogOpen, setPackagesDialogOpen] = useState(false);
  const [packagesFormData, setPackagesFormData] = useState({
    ticketId: "",
    ticketName: "",
    units: "", // For direct unit input
    packages: "", // For package input (mutually exclusive with units)
    destination: "counter", // "counter" or "vault" - set based on activeTab
    defaultQuantityPerPackage: null,
    min_threshold: "10", // Required when adding ticket to inventory
  });
  const [reduceStockDialogOpen, setReduceStockDialogOpen] = useState(false);
  const [reduceStockFormData, setReduceStockFormData] = useState({
    ticketId: "",
    ticketName: "",
    units: "",
    packages: "",
    destination: "counter",
    defaultQuantityPerPackage: null,
    currentQuantity: 0,
  });
  const [lowStockAlert, setLowStockAlert] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  const [sortBy, setSortBy] = useState("name"); // name, price, quantity_counter, quantity_vault, total_quantity, demand
  const [sortOrder, setSortOrder] = useState("asc"); // asc, desc
  const [advancedFilters, setAdvancedFilters] = useState({
    stockStatus: "all", // all, inStock, lowStock, outOfStock
    priceRange: "all", // all, 0-25, 25-50, 50-100, 100+
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
        // Filter to show only tickets that have inventory for this kiosk (have entry in amount map)
        const ticketsWithInventory = result.filter(ticket => {
          const amount = ticket.amount || {};
          // Only show tickets that have an entry in the amount map for this kiosk
          return amount.hasOwnProperty(currentKiosk.id);
        });
        console.log('Inventory: Loaded tickets:', ticketsWithInventory.length, 'with inventory for kiosk:', currentKiosk.id);
        return ticketsWithInventory;
      } catch (error) {
        console.error('Inventory: Error loading tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Load sales to calculate demand (total sales count per ticket)
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales-for-demand-inventory', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) return [];
      try {
        const { getSalesByKiosk } = await import('@/firebase/services/sales');
        return await getSalesByKiosk(currentKiosk.id);
      } catch (error) {
        console.error('Error loading sales for demand calculation:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - sales data doesn't change frequently
  });

  // Calculate sales count per ticket (demand)
  const ticketSalesCount = useMemo(() => {
    const counts = {};
    allSales
      .filter(sale => sale.status === 'completed') // Only count completed sales
      .forEach(sale => {
        sale.items?.forEach(item => {
          const ticketId = item.ticket_type_id;
          if (ticketId) {
            counts[ticketId] = (counts[ticketId] || 0) + (item.quantity || 0);
          }
        });
      });
    return counts;
  }, [allSales]);

  // Load all available tickets (including Pais) for the add ticket search
  const { data: allAvailableTickets = [] } = useQuery({
    queryKey: ['tickets-all-available', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) return [];
      try {
        // Get all ticket types (including those without inventory for this kiosk)
        const result = await ticketTypesService.getAllTicketTypes();
        // Filter only active tickets
        return result.filter(ticket => ticket.is_active === true);
      } catch (error) {
        console.error('Inventory: Error loading all tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-layout'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, kioskId }) => TicketType.removeKioskInventory(id, kioskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      setDeleteDialogOpen(false);
      setSelectedTicket(null);
      // Toast notification removed
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, kioskId }) => {
      // Delete all selected tickets from kiosk inventory in parallel
      await Promise.all(ids.map(id => TicketType.removeKioskInventory(id, kioskId)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      setBulkDeleteDialogOpen(false);
      setSelectedTicketIds(new Set());
    },
  });

  // Check permissions for viewing counter/vault tabs
  const canViewCounter = user?.role !== 'assistant' || hasPermission('inventory_view_counter');
  const canViewVault = user?.role !== 'assistant' || hasPermission('inventory_view_vault');
  
  // Check permissions for actions on counter/vault (edit is location-specific)
  const canEditCounter = user?.role !== 'assistant' || hasPermission('inventory_edit_counter');
  const canEditVault = user?.role !== 'assistant' || hasPermission('inventory_edit_vault');
  
  // Check permissions for adding stock to counter/vault
  const canAddStockCounter = user?.role !== 'assistant' || hasPermission('inventory_add_stock_counter');
  const canAddStockVault = user?.role !== 'assistant' || hasPermission('inventory_add_stock_vault');
  
  // Check permission for transferring from vault to counter
  const canTransferVaultToCounter = user?.role !== 'assistant' || hasPermission('inventory_transfer_vault_to_counter');
  
  // Check permissions for general actions (add/delete are not location-specific)
  const canAdd = user?.role !== 'assistant' || hasPermission('inventory_add');
  const canDelete = user?.role !== 'assistant' || hasPermission('inventory_delete');

  const resetForm = () => {
    setFormData({
      name: "",
      nickname: "",
      price: "",
      code: "", // Will be generated automatically
      counter_units: "",
      counter_packages: "",
      vault_units: "",
      vault_packages: "",
      default_quantity_per_package: "",
      min_threshold: "10",
      color: "blue",
      image_url: "",
      use_image: false,
      is_active: true,
    });
    setSelectedTicket(null);
  };

  const handleEdit = (ticket) => {
    // Check permission based on which tab we're in
    if (user?.role === 'assistant') {
      const canEdit = activeTab === 'counter' ? canEditCounter : canEditVault;
      if (!canEdit) return;
    }
    setSelectedTicket(ticket);
    // Only load the fields needed for editing
    setFormData({
      name: ticket.name,
      nickname: "",
      price: "",
      code: "",
      counter_units: "",
      counter_packages: "",
      vault_units: "",
      vault_packages: "",
      default_quantity_per_package: ticket.default_quantity_per_package?.toString() || "",
      min_threshold: ticket.min_threshold?.toString() || "10",
      color: "blue",
      image_url: "",
      use_image: false,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleDelete = (ticket) => {
    // Delete is not location-specific, check general permission
    if (user?.role === 'assistant' && !canDelete) return;
    setSelectedTicket(ticket);
    setDeleteDialogOpen(true);
  };

  const handleToggleSelect = (ticketId) => {
    const newSelected = new Set(selectedTicketIds);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTicketIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTicketIds.size === tabFilteredTickets.length && tabFilteredTickets.length > 0) {
      // Deselect all
      setSelectedTicketIds(new Set());
    } else {
      // Select all
      setSelectedTicketIds(new Set(tabFilteredTickets.map(t => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTicketIds.size > 0) {
      setBulkDeleteDialogOpen(true);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedTicketIds.size > 0 && currentKiosk?.id) {
      await bulkDeleteMutation.mutateAsync({ 
        ids: Array.from(selectedTicketIds),
        kioskId: currentKiosk.id
      });
    }
  };

  const handleSubmit = async () => {
    // Permission gate: assistants need specific perms
    if (user?.role === 'assistant') {
      if (selectedTicket) {
        // Edit: check permission based on which tab we're in
        const canEdit = activeTab === 'counter' ? canEditCounter : canEditVault;
        if (!canEdit) {
          alert('אין לך הרשאה לפעולה זו');
          return;
        }
      } else {
        // Add: general permission (not location-specific)
        if (!canAdd) {
          alert('אין לך הרשאה לפעולה זו');
          return;
        }
      }
    }

    if (!currentKiosk?.id) {
      alert('לא ניתן ליצור כרטיס ללא קיוסק נבחר');
      return;
    }

    // Check if selectedTicket exists in the inventory list (has inventory for this kiosk)
    const ticketInInventory = tickets.find(t => t.id === selectedTicket?.id);
    
    // If ticket exists in system but not in inventory, just add inventory
    if (selectedTicket && !ticketInInventory) {
      // Adding existing ticket to inventory - validate min_threshold
      const minThresholdValue = parseInt(formData.min_threshold) || 0;
      if (!formData.min_threshold || minThresholdValue <= 0) {
        alert('נא להזין סף התראה תקין (מספר גדול מ-0)');
        return;
      }

      // Adding existing ticket to inventory - only update quantities
      // Calculate quantities from units or packages
      const defaultQtyPerPackage = selectedTicket.default_quantity_per_package || 1;
      
      // Counter: units or packages (mutually exclusive)
      let quantity_counter = 0;
      if (formData.counter_units) {
        quantity_counter = parseInt(formData.counter_units) || 0;
      } else if (formData.counter_packages) {
        quantity_counter = (parseInt(formData.counter_packages) || 0) * defaultQtyPerPackage;
      }
      
      // Vault: units or packages (mutually exclusive)
      let quantity_vault = 0;
      if (formData.vault_units) {
        quantity_vault = parseInt(formData.vault_units) || 0;
      } else if (formData.vault_packages) {
        quantity_vault = (parseInt(formData.vault_packages) || 0) * defaultQtyPerPackage;
      }
      
      if (quantity_counter === 0 && quantity_vault === 0) {
        alert('נא להזין כמות בדלפק או בכספת');
        return;
      }

      // Check permissions for adding stock
      if (user?.role === 'assistant') {
        if (quantity_counter > 0 && !canAddStockCounter) {
          alert('אין לך הרשאה להוספת מלאי לדלפק');
          return;
        }
        if (quantity_vault > 0 && !canAddStockVault) {
          alert('אין לך הרשאה להוספת מלאי לכספת');
          return;
        }
      }

      await TicketType.update(selectedTicket.id, {
        quantity_counter,
        quantity_vault,
        min_threshold: minThresholdValue,
      }, currentKiosk.id);

      // Create audit log
      try {
        await AuditLog.create({
          action: "add_inventory",
          actor_id: user?.id,
          actor_name: user?.full_name || user?.email,
          target_id: selectedTicket.id,
          target_type: "TicketType",
          details: { 
            ticket_name: selectedTicket.name,
            quantity_counter,
            quantity_vault,
          },
          kiosk_id: currentKiosk.id,
        });
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }

      queryClient.invalidateQueries({ queryKey: ['tickets-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-all-available'] });
      setDialogOpen(false);
      resetForm();
      return;
    }

    // Validate min_threshold for new tickets
    if (!selectedTicket) {
      const minThresholdValue = parseInt(formData.min_threshold) || 0;
      if (!formData.min_threshold || minThresholdValue <= 0) {
        alert('נא להזין סף התראה תקין (מספר גדול מ-0)');
        return;
      }
    }

    // Generate code automatically for new tickets
    let code = formData.code;
    if (!selectedTicket) {
      // New ticket - generate unique code
      try {
        code = await generateUniqueCode("custom", currentKiosk?.id);
      } catch (error) {
        console.error("Error generating code:", error);
        alert("שגיאה ביצירת קוד. נסה שוב.");
        return;
      }
    } else {
      // Existing ticket - keep existing code
      code = selectedTicket.code || formData.code;
    }

    // Calculate quantities
    const calculatedQuantityCounter = (() => {
      if (formData.counter_units) return parseInt(formData.counter_units) || 0;
      if (formData.counter_packages) {
        const packages = parseInt(formData.counter_packages) || 0;
        const qtyPerPackage = parseInt(formData.default_quantity_per_package) || 1;
        return packages * qtyPerPackage;
      }
      return 0;
    })();
    const calculatedQuantityVault = (() => {
      if (formData.vault_units) return parseInt(formData.vault_units) || 0;
      if (formData.vault_packages) {
        const packages = parseInt(formData.vault_packages) || 0;
        const qtyPerPackage = parseInt(formData.default_quantity_per_package) || 1;
        return packages * qtyPerPackage;
      }
      return 0;
    })();

    // Check permissions for adding stock (for new tickets or when adding stock to existing)
    if (user?.role === 'assistant') {
      if (calculatedQuantityCounter > 0 && !canAddStockCounter) {
        alert('אין לך הרשאה להוספת מלאי לדלפק');
        return;
      }
      if (calculatedQuantityVault > 0 && !canAddStockVault) {
        alert('אין לך הרשאה להוספת מלאי לכספת');
        return;
      }
    }

    const data = {
      name: formData.name,
      nickname: formData.nickname || null, // Store null if empty
      price: parseFloat(formData.price),
      code: code,
      quantity_counter: calculatedQuantityCounter,
      quantity_vault: calculatedQuantityVault,
      default_quantity_per_package: formData.default_quantity_per_package ? parseInt(formData.default_quantity_per_package) : null,
      min_threshold: parseInt(formData.min_threshold) || 10,
        color: formData.use_image ? null : formData.color,
        image_url: formData.use_image ? formData.image_url : null,
        is_active: formData.is_active,
        ticket_category: "custom", // Always use "custom" as default
      kiosk_id: currentKiosk.id,
    };

    if (selectedTicket) {
      // For editing existing ticket, only update min_threshold
      const updateData = {
        min_threshold: parseInt(formData.min_threshold) || 10,
      };
      
      await updateMutation.mutateAsync({ id: selectedTicket.id, data: updateData });
      
      // Create audit log
      try {
        await AuditLog.create({
          action: "edit_ticket_type",
          actor_id: user?.id,
          actor_name: user?.full_name || user?.email,
          target_id: selectedTicket.id,
          target_type: "TicketType",
          details: {
            ticket_name: selectedTicket.name,
            ticket_id: selectedTicket.id,
            min_threshold: updateData.min_threshold,
            message: `עודכן כרטיס: סף התראה: ${updateData.min_threshold}`
          },
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
    // Delete is not location-specific, check general permission
    if (user?.role === 'assistant' && !canDelete) {
      alert('אין לך הרשאה למחיקה');
      return;
    }
    if (selectedTicket) {
      // Create audit log before delete
      await AuditLog.create({
        action: "remove_kiosk_inventory",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: selectedTicket.id,
        target_type: "TicketType",
        details: {
          ticket_name: selectedTicket.name,
          kiosk_id: currentKiosk?.id,
          kiosk_name: currentKiosk?.name,
        },
        kiosk_id: currentKiosk?.id,
      });
      
      await deleteMutation.mutateAsync({ 
        id: selectedTicket.id, 
        kioskId: currentKiosk.id 
      });
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
    // Search filter - includes name, code, and nickname
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      t.name?.toLowerCase().includes(searchLower) || 
      t.code?.toLowerCase().includes(searchLower) ||
      t.nickname?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    
    // Advanced filters - Stock Status (based on quantity_counter only)
    // Note: Status filter (active/inactive) removed - replaced by tabs
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
    
    // Advanced filters - Has Vault Stock
    // Note: Needs Opening filter removed - is_opened is now internal only
    if (advancedFilters.hasVaultStock !== "all") {
      const quantityVault = t.quantity_vault ?? 0;
      if (advancedFilters.hasVaultStock === "yes" && quantityVault === 0) return false;
      if (advancedFilters.hasVaultStock === "no" && quantityVault > 0) return false;
    }
    
    return true;
    });
  }, [tickets, searchTerm, advancedFilters]);

  // Auto-select available tab if current tab is not accessible
  useEffect(() => {
    if (activeTab === "counter" && !canViewCounter && canViewVault) {
      setActiveTab("vault");
    } else if (activeTab === "vault" && !canViewVault && canViewCounter) {
      setActiveTab("counter");
    } else if (!canViewCounter && !canViewVault) {
      // If user can't view either tab, default to counter (will show empty state)
      setActiveTab("counter");
    }
  }, [activeTab, canViewCounter, canViewVault]);

  // Reset selected tickets when switching tabs
  useEffect(() => {
    setSelectedTicketIds(new Set());
  }, [activeTab]);

  // Filter tickets by active tab (counter or vault)
  const tabFilteredTickets = useMemo(() => {
    return filteredTickets.filter(ticket => {
      if (activeTab === "counter") {
        return (ticket.quantity_counter ?? 0) > 0;
      } else if (activeTab === "vault") {
        return (ticket.quantity_vault ?? 0) > 0;
      }
      return true;
    });
  }, [filteredTickets, activeTab]);

  // Calculate ticket counts for each tab (after filtering)
  const counterTicketsCount = useMemo(() => {
    return filteredTickets.filter(ticket => (ticket.quantity_counter ?? 0) > 0).length;
  }, [filteredTickets]);

  const vaultTicketsCount = useMemo(() => {
    return filteredTickets.filter(ticket => (ticket.quantity_vault ?? 0) > 0).length;
  }, [filteredTickets]);

  // Sort filtered tickets
  const sortedTickets = useMemo(() => {
    return [...tabFilteredTickets].sort((a, b) => {
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
      case "demand":
        aValue = ticketSalesCount[a.id] || 0;
        bValue = ticketSalesCount[b.id] || 0;
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
  }, [tabFilteredTickets, sortBy, sortOrder, ticketSalesCount]);

  const hasActiveFilters = 
                           advancedFilters.stockStatus !== "all" || 
                           advancedFilters.priceRange !== "all" ||
                           advancedFilters.hasVaultStock !== "all";

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      stockStatus: "all",
      priceRange: "all",
      hasVaultStock: "all",
    });
  };

  // Permission guard for assistants - must have permission to view at least one tab
  if (user && user.role === 'assistant' && !canViewCounter && !canViewVault) {
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
        <Popover open={addTicketOpen} onOpenChange={setAddTicketOpen}>
          <PopoverAnchor asChild>
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
              <Input
                placeholder="חפש כרטיס להוספה למלאי..."
                value={addTicketSearch}
                onChange={(e) => {
                  setAddTicketSearch(e.target.value);
                  setAddTicketOpen(true);
                }}
                onFocus={() => setAddTicketOpen(true)}
                className="pr-10"
                disabled={user?.role === 'assistant' && !canAdd}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent className="w-[var(--radix-popover-anchor-width)] p-0" side="bottom" align="start" dir="rtl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command>
              <CommandInput 
                placeholder="חפש כרטיס..." 
                value={addTicketSearch}
                onValueChange={(value) => {
                  setAddTicketSearch(value);
                  setAddTicketOpen(true);
                }}
              />
              <CommandList>
                <CommandEmpty>לא נמצאו כרטיסים</CommandEmpty>
                <CommandGroup>
                  {allAvailableTickets
                    .filter(ticket => {
                      // Don't show tickets that already have inventory
                      const hasInventory = tickets.some(t => t.id === ticket.id);
                      if (hasInventory) return false;
                      
                      if (!addTicketSearch) return true;
                      const search = addTicketSearch.toLowerCase();
                      return ticket.name?.toLowerCase().includes(search) ||
                             ticket.nickname?.toLowerCase().includes(search) ||
                             ticket.code?.toLowerCase().includes(search);
                    })
                    .map((ticket) => {
                      return (
                        <CommandItem
                          key={ticket.id}
                          value={ticket.name}
                          onSelect={() => {
                            // Open dialog to add quantities for this ticket
                            setSelectedTicket(ticket);
                            setFormData({
                              name: ticket.name,
                              nickname: ticket.nickname || "",
                              price: ticket.price?.toString() || "",
                              code: ticket.code || "",
                              counter_units: "",
                              counter_packages: "",
                              vault_units: "",
                              vault_packages: "",
                              default_quantity_per_package: ticket.default_quantity_per_package?.toString() || "",
                              min_threshold: ticket.min_threshold?.toString() || "10",
                              color: ticket.color || "blue",
                              image_url: ticket.image_url || "",
                              use_image: !!ticket.image_url,
                              is_active: ticket.is_active !== false,
                            });
                            setAddTicketOpen(false);
                            setAddTicketSearch("");
                            setDialogOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                            <div className="flex items-center gap-3 w-full">
                            {ticket.image_url && (
                              <img 
                                src={ticket.image_url} 
                                alt={ticket.name}
                                className="w-10 h-10 rounded object-cover"
                                loading="lazy"
                              />
                            )}
                            <div className="flex-1 text-right">
                              <p className="font-medium">{ticket.name}</p>
                              {ticket.nickname && (
                                <p className="text-xs text-muted-foreground">"{ticket.nickname}"</p>
                              )}
                              <p className="text-xs text-muted-foreground">₪{ticket.price}</p>
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
        <div className="flex flex-wrap items-center gap-3 justify-between">
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
                <SelectItem value="demand">ביקוש (מספר מכירות)</SelectItem>
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
          {/* Bulk Delete Button */}
          {selectedTicketIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedTicketIds.size} כרטיסים נבחרו
              </span>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending || (user?.role === 'assistant' && !canDelete)}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                מחק נבחרים
              </Button>
            </div>
          )}
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
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
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

      {/* Tabs for Counter/Vault */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${canViewCounter && canViewVault ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canViewCounter && (
            <TabsTrigger value="counter" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              דלפק ({counterTicketsCount})
            </TabsTrigger>
          )}
          {canViewVault && (
            <TabsTrigger value="vault" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              כספת ({vaultTicketsCount})
            </TabsTrigger>
          )}
        </TabsList>

        {canViewCounter && (
          <TabsContent value="counter" className="mt-4">
            {/* Select All Checkbox */}
            {tabFilteredTickets.length > 0 && (
              <div className="flex items-center gap-2 pb-3 mb-3 border-b">
                <Checkbox
                  checked={selectedTicketIds.size === tabFilteredTickets.length && tabFilteredTickets.length > 0}
                  onCheckedChange={handleSelectAll}
                  id="select-all-counter"
                />
                <Label htmlFor="select-all-counter" className="cursor-pointer">
                  בחר הכל ({tabFilteredTickets.length})
                </Label>
              </div>
            )}
            {/* Counter Tickets Grid */}
          <div className="grid grid-cols-3 gap-1 sm:gap-4">
        <AnimatePresence>
          {sortedTickets.map((ticket, index) => {
            const quantityCounter = ticket.quantity_counter ?? 0;
            const quantityVault = ticket.quantity_vault ?? 0;
            const totalQuantity = quantityCounter + quantityVault;
            const isLowStock = quantityCounter <= (ticket.min_threshold || 10);
            const colorClass = colorOptions.find(c => c.value === ticket.color)?.class || "bg-blue-500";
            
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${!ticket.is_active ? 'opacity-60' : ''} ${selectedTicketIds.has(ticket.id) ? 'ring-2 ring-primary' : ''}`}>
                  {/* Color Strip or Image */}
                  {ticket.image_url ? (
                    <div className="h-20 sm:h-32 w-full overflow-hidden">
                      <img 
                        src={ticket.image_url} 
                        alt={ticket.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width="100%"
                        height="128"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div class="h-2 ${colorClass}"></div>`;
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`h-2 ${colorClass}`} />
                  )}
                  
                  <CardContent className="p-2 sm:p-4">
                    <div className="flex items-start justify-between mb-1 sm:mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-xs sm:text-base truncate">{ticket.name}</h3>
                            {ticket.nickname && (
                              <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate hidden sm:block">"{ticket.nickname}"</p>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{ticket.code}</p>
                      </div>
                      {/* Checkbox and Edit Button in same column */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <Checkbox
                          checked={selectedTicketIds.has(ticket.id)}
                          onCheckedChange={() => handleToggleSelect(ticket.id)}
                          id={`ticket-${ticket.id}`}
                          className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(ticket)}
                          disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canEditCounter : canEditVault)}
                          title="עריכת כרטיס"
                          className="h-6 w-6 sm:h-7 sm:w-7"
                        >
                          <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-lg sm:text-2xl font-bold text-primary">₪{ticket.price}</span>
                      {!ticket.is_active && (
                        <Badge variant="secondary" className="text-xs">לא פעיל</Badge>
                      )}
                    </div>

                    {/* Counter Inventory Display - Only counter quantity */}
                    <div className={`flex items-center justify-between p-1.5 sm:p-3 rounded-lg ${
                      isLowStock ? 'bg-amber-900/30' : 'bg-accent'
                    }`}>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {isLowStock && <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />}
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-foreground hidden sm:inline">מלאי בדלפק</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                        <div className="flex flex-col items-end gap-0 sm:gap-0.5">
                          <span className={`text-xs sm:text-sm font-bold ${
                            quantityCounter === 0 ? 'text-red-600' : 
                            isLowStock ? 'text-amber-500' : 'text-foreground'
                          }`}>
                            {quantityCounter}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          מינימום: {ticket.min_threshold}
                        </span>
                        {ticket.default_quantity_per_package && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium hidden sm:block">
                            {ticket.default_quantity_per_package} כרטיסים בחבילה
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions - Stock Management */}
                    <div className="flex items-center gap-1 mt-2 sm:mt-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setViewTicket(ticket);
                          setViewDialogOpen(true);
                        }}
                        title="צפייה בכרטיס"
                        className="h-7 w-7 sm:h-7 sm:w-7"
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 text-blue-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setPackagesFormData({
                            ticketId: ticket.id,
                            ticketName: ticket.name,
                            units: "",
                            packages: "",
                            destination: activeTab, // Set based on active tab
                            defaultQuantityPerPackage: ticket.default_quantity_per_package || null,
                            min_threshold: ticket.min_threshold?.toString() || "10",
                          });
                          setPackagesDialogOpen(true);
                        }}
                        disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canAddStockCounter : canAddStockVault)}
                        title={ticket.default_quantity_per_package ? "הוסף מלאי לפי חבילות" : "הוסף מלאי"}
                        className={`${ticket.default_quantity_per_package ? "text-green-600" : ""} h-7 w-7 sm:h-7 sm:w-7`}
                      >
                        <Plus className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5" />
                      </Button>
                      {(activeTab === 'counter' ? quantityCounter > 0 : quantityVault > 0) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            const currentQty = activeTab === 'counter' ? quantityCounter : quantityVault;
                            setReduceStockFormData({
                              ticketId: ticket.id,
                              ticketName: ticket.name,
                              units: "",
                              packages: "",
                              destination: activeTab,
                              defaultQuantityPerPackage: ticket.default_quantity_per_package || null,
                              currentQuantity: currentQty,
                            });
                            setReduceStockDialogOpen(true);
                          }}
                          disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canEditCounter : canEditVault)}
                          title="הפחת מלאי"
                          className="h-7 w-7 sm:h-7 sm:w-7 text-orange-600"
                        >
                          <Minus className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      )}
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
              <p className="font-medium">לא נמצאו כרטיסים בדלפק</p>
              <p className="text-sm text-muted-foreground mt-1">אין כרטיסים עם מלאי בדלפק</p>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
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
          </TabsContent>
        )}

        {canViewVault && (
          <TabsContent value="vault" className="mt-4">
            {/* Select All Checkbox */}
            {tabFilteredTickets.length > 0 && (
              <div className="flex items-center gap-2 pb-3 mb-3 border-b">
                <Checkbox
                  checked={selectedTicketIds.size === tabFilteredTickets.length && tabFilteredTickets.length > 0}
                  onCheckedChange={handleSelectAll}
                  id="select-all-vault"
                />
                <Label htmlFor="select-all-vault" className="cursor-pointer">
                  בחר הכל ({tabFilteredTickets.length})
                </Label>
              </div>
            )}
            {/* Vault Tickets Grid */}
          <div className="grid grid-cols-3 gap-1 sm:gap-4">
            <AnimatePresence>
              {sortedTickets.map((ticket, index) => {
                const quantityCounter = ticket.quantity_counter ?? 0;
                const quantityVault = ticket.quantity_vault ?? 0;
                const totalQuantity = quantityCounter + quantityVault;
                const isLowStock = quantityVault <= (ticket.min_threshold || 10);
                const colorClass = colorOptions.find(c => c.value === ticket.color)?.class || "bg-blue-500";
                
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`relative overflow-hidden ${!ticket.is_active ? 'opacity-60' : ''} ${selectedTicketIds.has(ticket.id) ? 'ring-2 ring-primary' : ''}`}>
                      {/* Color Strip or Image */}
                      {ticket.image_url ? (
                        <div className="h-20 sm:h-32 w-full overflow-hidden">
                          <img 
                            src={ticket.image_url} 
                            alt={ticket.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            width="100%"
                            height="128"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = `<div class="h-2 ${colorClass}"></div>`;
                            }}
                          />
                        </div>
                      ) : (
                        <div className={`h-2 ${colorClass}`} />
                      )}
                      
                      <CardContent className="p-2 sm:p-4">
                        <div className="flex items-start justify-between mb-1 sm:mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                              <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-xs sm:text-base truncate">{ticket.name}</h3>
                                {ticket.nickname && (
                                  <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate hidden sm:block">"{ticket.nickname}"</p>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Checkbox and Edit Button in same column */}
                          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                            <Checkbox
                              checked={selectedTicketIds.has(ticket.id)}
                              onCheckedChange={() => handleToggleSelect(ticket.id)}
                              id={`ticket-vault-${ticket.id}`}
                              className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(ticket)}
                              disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canEditCounter : canEditVault)}
                              title="עריכת כרטיס"
                              className="h-6 w-6 sm:h-7 sm:w-7"
                            >
                              <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-1 sm:mb-3">
                          <span className="text-lg sm:text-2xl font-bold text-primary">₪{ticket.price}</span>
                          {!ticket.is_active && (
                            <Badge variant="secondary" className="text-xs">לא פעיל</Badge>
                          )}
                        </div>
                        
                        {/* Vault Inventory Display - Only vault quantity */}
                        <div className={`flex items-center justify-between p-1.5 sm:p-3 rounded-lg ${
                          isLowStock ? 'bg-amber-900/30' : 'bg-accent'
                        }`}>
                          <div className="flex items-center gap-1 sm:gap-2">
                            {isLowStock && <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />}
                            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            <span className="text-xs sm:text-sm text-foreground hidden sm:inline">מלאי בכספת</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                            <div className="flex flex-col items-end gap-0 sm:gap-0.5">
                              <span className={`text-xs sm:text-sm font-bold ${
                                quantityVault === 0 ? 'text-red-600' : 
                                isLowStock ? 'text-amber-500' : 'text-foreground'
                              }`}>
                                {quantityVault}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              מינימום: {ticket.min_threshold}
                            </span>
                            {ticket.default_quantity_per_package && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium hidden sm:block">
                                {ticket.default_quantity_per_package} כרטיסים בחבילה
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions - Stock Management */}
                        <div className="flex items-center gap-1 mt-2 sm:mt-3">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setPackagesFormData({
                                ticketId: ticket.id,
                                ticketName: ticket.name,
                                units: "",
                                packages: "",
                                destination: activeTab, // Set based on active tab
                                defaultQuantityPerPackage: ticket.default_quantity_per_package || null,
                                min_threshold: ticket.min_threshold?.toString() || "10",
                              });
                              setPackagesDialogOpen(true);
                            }}
                            disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canAddStockCounter : canAddStockVault)}
                            title={ticket.default_quantity_per_package ? "הוסף מלאי לפי חבילות" : "הוסף מלאי"}
                            className={`${ticket.default_quantity_per_package ? "text-green-600" : ""} h-7 w-7 sm:h-7 sm:w-7`}
                          >
                            <Plus className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5" />
                          </Button>
                          {quantityVault > 0 && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setReduceStockFormData({
                                    ticketId: ticket.id,
                                    ticketName: ticket.name,
                                    units: "",
                                    packages: "",
                                    destination: activeTab,
                                    defaultQuantityPerPackage: ticket.default_quantity_per_package || null,
                                    currentQuantity: quantityVault,
                                  });
                                  setReduceStockDialogOpen(true);
                                }}
                                disabled={user?.role === 'assistant' && !(activeTab === 'counter' ? canEditCounter : canEditVault)}
                                title="הפחת מלאי"
                                className="h-7 w-7 sm:h-7 sm:w-7 text-orange-600"
                              >
                                <Minus className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setTransferFormData({ ticketId: ticket.id, transfer_units: "", transfer_packages: "" });
                                  setTransferDialogOpen(true);
                                }}
                                disabled={user?.role === 'assistant' && (!canTransferVaultToCounter || !canViewVault)}
                                title="העבר מכספת לדלפק"
                                className="h-7 w-7 sm:h-7 sm:w-7"
                              >
                                <Package className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 text-blue-500" />
                              </Button>
                            </>
                          )}
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
              <p className="font-medium">לא נמצאו כרטיסים בכספת</p>
              <p className="text-sm text-muted-foreground mt-1">אין כרטיסים עם מלאי בכספת</p>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
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
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {(() => {
                if (!selectedTicket) return "הוספת סוג כרטיס";
                const ticketInInventory = tickets.find(t => t.id === selectedTicket.id);
                if (ticketInInventory) return "עריכת סוג כרטיס";
                return `הוספת ${selectedTicket.name} למלאי`;
              })()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {(() => {
              const ticketInInventory = selectedTicket ? tickets.find(t => t.id === selectedTicket.id) : null;
              const isAddingExistingTicket = selectedTicket && !ticketInInventory;
              
              // If adding existing ticket to inventory, show only quantity fields
              if (isAddingExistingTicket) {
                return (
                  <>
                    <div className="p-4 bg-accent rounded-lg space-y-2">
                      <p className="font-medium text-foreground">{selectedTicket.name}</p>
                      {selectedTicket.nickname && (
                        <p className="text-sm text-muted-foreground">"{selectedTicket.nickname}"</p>
                      )}
                      <p className="text-sm text-muted-foreground">מחיר: ₪{selectedTicket.price}</p>
                    </div>
                    
                    {/* Counter Section */}
                    <div className="space-y-3 p-4 border rounded-lg">
                      <Label className="text-base font-semibold">דלפק</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>מספר יחידות</Label>
                          <Input
                            type="number"
                            value={formData.counter_units}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              setFormData({ 
                                ...formData, 
                                counter_units: val,
                                counter_packages: numVal > 0 ? "" : formData.counter_packages // Clear packages only if units > 0
                              });
                            }}
                            placeholder="0"
                            min="0"
                            disabled={
                              (!!formData.counter_packages && parseInt(formData.counter_packages) > 0) ||
                              (user?.role === 'assistant' && !canAddStockCounter)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>מספר חבילות</Label>
                          <Input
                            type="number"
                            value={formData.counter_packages}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              setFormData({ 
                                ...formData, 
                                counter_packages: val,
                                counter_units: numVal > 0 ? "" : formData.counter_units // Clear units only if packages > 0
                              });
                            }}
                            placeholder="0"
                            min="0"
                            disabled={
                              (!!formData.counter_units && parseInt(formData.counter_units) > 0) ||
                              (user?.role === 'assistant' && !canAddStockCounter)
                            }
                          />
                          {selectedTicket.default_quantity_per_package && (
                            <p className="text-xs text-muted-foreground">
                              {formData.counter_packages ? 
                                `סה"כ: ${(parseInt(formData.counter_packages) || 0) * selectedTicket.default_quantity_per_package} יחידות` :
                                `${selectedTicket.default_quantity_per_package} יחידות בחבילה`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vault Section */}
                    <div className="space-y-3 p-4 border rounded-lg">
                      <Label className="text-base font-semibold">כספת</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>מספר יחידות</Label>
                          <Input
                            type="number"
                            value={formData.vault_units}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              setFormData({ 
                                ...formData, 
                                vault_units: val,
                                vault_packages: numVal > 0 ? "" : formData.vault_packages // Clear packages only if units > 0
                              });
                            }}
                            placeholder="0"
                            min="0"
                            disabled={
                              (!!formData.vault_packages && parseInt(formData.vault_packages) > 0) ||
                              (user?.role === 'assistant' && !canAddStockVault)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>מספר חבילות</Label>
                          <Input
                            type="number"
                            value={formData.vault_packages}
                            onChange={(e) => {
                              const val = e.target.value;
                              const numVal = parseInt(val) || 0;
                              setFormData({ 
                                ...formData, 
                                vault_packages: val,
                                vault_units: numVal > 0 ? "" : formData.vault_units // Clear units only if packages > 0
                              });
                            }}
                            placeholder="0"
                            min="0"
                            disabled={
                              (!!formData.vault_units && parseInt(formData.vault_units) > 0) ||
                              (user?.role === 'assistant' && !canAddStockVault)
                            }
                          />
                          {selectedTicket.default_quantity_per_package && (
                            <p className="text-xs text-muted-foreground">
                              {formData.vault_packages ? 
                                `סה"כ: ${(parseInt(formData.vault_packages) || 0) * selectedTicket.default_quantity_per_package} יחידות` :
                                `${selectedTicket.default_quantity_per_package} יחידות בחבילה`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>סף התראה <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={formData.min_threshold}
                        onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                        placeholder="10"
                        min="1"
                        required
                      />
                      <p className="text-xs text-slate-500">חובה להזין סף התראה</p>
                    </div>

                    {/* Alert for opening packages */}
                    {((formData.counter_packages && parseInt(formData.counter_packages) > 0) || 
                      (formData.counter_units && parseInt(formData.counter_units) > 0)) && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                          <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                            שימו לב! יש לפתוח את החבילה החדשה באלטורה
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              }
              
              // Edit form - only for existing tickets in inventory (minimal fields)
              if (selectedTicket) {
                return (
                  <>
                    <div className="space-y-2">
                      <Label>שם הכרטיס</Label>
                      <Input
                        value={selectedTicket.name}
                        readOnly
                        disabled
                        className="bg-accent cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500">שם הכרטיס לא ניתן לשינוי</p>
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
                  </>
                );
              }
              
              // Full form for new ticket (keep existing form)
              return (
                <>
                  <div className="space-y-2">
                    <Label>שם הכרטיס</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="למשל: כרטיס מזל זהב"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>כינוי (לא חובה)</Label>
                    <Input
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      placeholder="למשל: מטוסים (לכרטיס אואזיס)"
                    />
                    <p className="text-xs text-slate-500">כינוי שיופיע ליד השם המקורי</p>
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
                        value={formData.code || ""}
                        readOnly
                        disabled
                        placeholder="ייווצר אוטומטית"
                        className="bg-accent cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500">הקוד ייווצר אוטומטית בעת שמירה</p>
                    </div>
                  </div>

                  {/* Counter Section */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <Label className="text-base font-semibold">דלפק</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>מספר יחידות</Label>
                        <Input
                          type="number"
                          value={formData.counter_units}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseInt(val) || 0;
                            setFormData({ 
                              ...formData, 
                              counter_units: val,
                              counter_packages: numVal > 0 ? "" : formData.counter_packages // Clear packages only if units > 0
                            });
                          }}
                          placeholder="0"
                          min="0"
                          disabled={!!formData.counter_packages && parseInt(formData.counter_packages) > 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>מספר חבילות</Label>
                        <Input
                          type="number"
                          value={formData.counter_packages}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseInt(val) || 0;
                            setFormData({ 
                              ...formData, 
                              counter_packages: val,
                              counter_units: numVal > 0 ? "" : formData.counter_units // Clear units only if packages > 0
                            });
                          }}
                          placeholder="0"
                          min="0"
                          disabled={!!formData.counter_units && parseInt(formData.counter_units) > 0}
                        />
                        {formData.default_quantity_per_package && (
                          <p className="text-xs text-muted-foreground">
                            {formData.counter_packages ? 
                              `סה"כ: ${(parseInt(formData.counter_packages) || 0) * parseInt(formData.default_quantity_per_package)} יחידות` :
                              `${formData.default_quantity_per_package} יחידות בחבילה`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vault Section */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <Label className="text-base font-semibold">כספת</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>מספר יחידות</Label>
                        <Input
                          type="number"
                          value={formData.vault_units}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseInt(val) || 0;
                            setFormData({ 
                              ...formData, 
                              vault_units: val,
                              vault_packages: numVal > 0 ? "" : formData.vault_packages // Clear packages only if units > 0
                            });
                          }}
                          placeholder="0"
                          min="0"
                          disabled={!!formData.vault_packages && parseInt(formData.vault_packages) > 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>מספר חבילות</Label>
                        <Input
                          type="number"
                          value={formData.vault_packages}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseInt(val) || 0;
                            setFormData({ 
                              ...formData, 
                              vault_packages: val,
                              vault_units: numVal > 0 ? "" : formData.vault_units // Clear units only if packages > 0
                            });
                          }}
                          placeholder="0"
                          min="0"
                          disabled={!!formData.vault_units && parseInt(formData.vault_units) > 0}
                        />
                        {formData.default_quantity_per_package && (
                          <p className="text-xs text-muted-foreground">
                            {formData.vault_packages ? 
                              `סה"כ: ${(parseInt(formData.vault_packages) || 0) * parseInt(formData.default_quantity_per_package)} יחידות` :
                              `${formData.default_quantity_per_package} יחידות בחבילה`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>כמות יחידות בחבילה</Label>
                      <Input
                        type="number"
                        value={formData.default_quantity_per_package}
                        onChange={(e) => setFormData({ ...formData, default_quantity_per_package: e.target.value })}
                        placeholder="50"
                      />
                      <p className="text-xs text-slate-500">כמות יחידות בחבילה חדשה (לא חובה)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>סף התראה <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={formData.min_threshold}
                        onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                        placeholder="10"
                        min="1"
                        required
                      />
                      <p className="text-xs text-slate-500">חובה להזין סף התראה</p>
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
                </>
              );
            })()}
          </div>

          <DialogFooter className="gap-3 sm:gap-3 flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={(() => {
                const ticketInInventory = selectedTicket ? tickets.find(t => t.id === selectedTicket.id) : null;
                const isAddingExistingTicket = selectedTicket && !ticketInInventory;
                const isEditingTicket = selectedTicket && ticketInInventory;
                
                if (isEditingTicket) {
                  // For editing existing ticket, only need min_threshold
                  const minThresholdValue = parseInt(formData.min_threshold) || 0;
                  return !formData.min_threshold || minThresholdValue <= 0;
                }
                
                if (isAddingExistingTicket) {
                  // For adding existing ticket, need quantities and min_threshold
                  const minThresholdValue = parseInt(formData.min_threshold) || 0;
                  return !formData.min_threshold || minThresholdValue <= 0;
                }
                
                // For new ticket, need name, price, and min_threshold
                const minThresholdValue = parseInt(formData.min_threshold) || 0;
                return !formData.name || !formData.price || !formData.min_threshold || minThresholdValue <= 0;
              })()}
              className="bg-theme-gradient"
            >
              {(() => {
                if (!selectedTicket) return "הוסף";
                const ticketInInventory = tickets.find(t => t.id === selectedTicket.id);
                if (ticketInInventory) return "עדכן";
                return "הוסף למלאי";
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Inventory Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
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
                      
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">כמות להעברה</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>מספר יחידות</Label>
                            <Input
                              type="number"
                              value={transferFormData.transfer_units}
                              onChange={(e) => {
                                const val = e.target.value;
                                const numVal = parseInt(val) || 0;
                                setTransferFormData({ 
                                  ...transferFormData, 
                                  transfer_units: val,
                                  transfer_packages: numVal > 0 ? "" : transferFormData.transfer_packages // Clear packages only if units > 0
                                });
                              }}
                              placeholder="0"
                              min="0"
                              disabled={!!transferFormData.transfer_packages && parseInt(transferFormData.transfer_packages) > 0}
                            />
                          </div>
                          {selectedTicketForTransfer.default_quantity_per_package && (
                            <div className="space-y-2">
                              <Label>מספר חבילות</Label>
                              <Input
                                type="number"
                                value={transferFormData.transfer_packages}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const numVal = parseInt(val) || 0;
                                  setTransferFormData({ 
                                    ...transferFormData, 
                                    transfer_packages: val,
                                    transfer_units: numVal > 0 ? "" : transferFormData.transfer_units // Clear units only if packages > 0
                                  });
                                }}
                                placeholder="0"
                                min="0"
                                disabled={!!transferFormData.transfer_units && parseInt(transferFormData.transfer_units) > 0}
                              />
                              {selectedTicketForTransfer.default_quantity_per_package && (
                                <p className="text-xs text-muted-foreground">
                                  {transferFormData.transfer_packages ? 
                                    `סה"כ: ${(parseInt(transferFormData.transfer_packages) || 0) * selectedTicketForTransfer.default_quantity_per_package} יחידות` :
                                    `${selectedTicketForTransfer.default_quantity_per_package} יחידות בחבילה`
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          מקסימום: {maxTransfer} יחידות
                        </p>
                      </div>
                      
                      {(transferFormData.transfer_units || transferFormData.transfer_packages) && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                          <div className="flex gap-3 items-start">
                            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                            <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                              שימו לב! יש לפתוח את החבילה החדשה באלטורה
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
              setTransferFormData({ ticketId: "", transfer_units: "", transfer_packages: "" });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                if (!transferFormData.ticketId) {
                  alert('אנא בחר כרטיס');
                  return;
                }
                
                // Calculate quantity from units or packages
                const selectedTicketForTransfer = tickets.find(t => t.id === transferFormData.ticketId);
                if (!selectedTicketForTransfer) {
                  alert('כרטיס לא נמצא');
                  return;
                }
                
                let quantity = 0;
                if (transferFormData.transfer_units) {
                  quantity = parseInt(transferFormData.transfer_units) || 0;
                } else if (transferFormData.transfer_packages && selectedTicketForTransfer.default_quantity_per_package) {
                  quantity = (parseInt(transferFormData.transfer_packages) || 0) * selectedTicketForTransfer.default_quantity_per_package;
                }
                
                if (quantity <= 0) {
                  alert('אנא הזן כמות להעברה (יחידות או חבילות)');
                  return;
                }
                
                // Check permission for transfer
                if (user?.role === 'assistant') {
                  if (!canTransferVaultToCounter || !canViewVault) {
                    alert('אין לך הרשאה להעברת מלאי מכספת לדלפק');
                    return;
                  }
                }
                
                try {
                  if (!currentKiosk?.id) {
                    alert('לא ניתן להעביר מלאי ללא קיוסק נבחר');
                    return;
                  }
                  
                  const currentCounter = selectedTicketForTransfer.quantity_counter ?? 0;
                  const currentVault = selectedTicketForTransfer.quantity_vault ?? 0;
                  
                  if (quantity > currentVault) {
                    alert(`לא ניתן להעביר ${quantity} כרטיסים. זמין בכספת: ${currentVault}`);
                    return;
                  }
                  
                  // Use updateTicketType directly to preserve all values
                  await ticketTypesService.updateTicketType(transferFormData.ticketId, {
                    quantity_counter: currentCounter + quantity,
                    quantity_vault: currentVault - quantity,
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
                      quantity_before_vault: currentVault,
                      quantity_after_vault: currentVault - quantity,
                      quantity_before_counter: currentCounter,
                      quantity_after_counter: currentCounter + quantity,
                      message: `הועברו ${quantity} כרטיסים מכספת לדלפק`
                    },
                    user_id: user?.id,
                    user_name: user?.full_name || user?.email,
                  });
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications-layout'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
                  
                  setTransferDialogOpen(false);
                  setTransferFormData({ ticketId: "", transfer_units: "", transfer_packages: "" });
                } catch (error) {
                  console.error('Error transferring inventory:', error);
                  alert('שגיאה בהעברת המלאי: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={
                !transferFormData.ticketId || 
                (!transferFormData.transfer_units && !transferFormData.transfer_packages) ||
                (transferFormData.transfer_units && parseInt(transferFormData.transfer_units) <= 0) ||
                (transferFormData.transfer_packages && parseInt(transferFormData.transfer_packages) <= 0) ||
                (user?.role === 'assistant' && (!canTransferVaultToCounter || !canViewVault))
              }
              className="bg-theme-gradient"
            >
              העבר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Packages Dialog */}
      <Dialog open={packagesDialogOpen} onOpenChange={setPackagesDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              הוספת מלאי ל{packagesFormData.destination === "counter" ? "דלפק" : "כספת"}
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
                  <Label>מספר יחידות</Label>
                  <Input
                    type="number"
                    value={packagesFormData.units}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = parseInt(val) || 0;
                      if (val === "" || numVal >= 0) {
                        setPackagesFormData({ 
                          ...packagesFormData, 
                          units: val,
                          packages: numVal > 0 ? "" : packagesFormData.packages // Clear packages only if units > 0
                        });
                      }
                    }}
                    placeholder="0"
                    min="0"
                    disabled={!!packagesFormData.packages && parseInt(packagesFormData.packages) > 0}
                  />
                </div>
                
                {packagesFormData.defaultQuantityPerPackage && (
                  <div className="space-y-2">
                    <Label>מספר חבילות</Label>
                    <Input
                      type="number"
                      value={packagesFormData.packages}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = parseInt(val) || 0;
                        if (val === "" || numVal >= 0) {
                          setPackagesFormData({ 
                            ...packagesFormData, 
                            packages: val,
                            units: numVal > 0 ? "" : packagesFormData.units // Clear units only if packages > 0
                          });
                        }
                      }}
                      placeholder="0"
                      min="0"
                      disabled={!!packagesFormData.units && parseInt(packagesFormData.units) > 0}
                    />
                    {packagesFormData.packages && (
                      <p className="text-sm text-muted-foreground">
                        סה"כ כרטיסים: <strong>{parseInt(packagesFormData.packages || 0) * packagesFormData.defaultQuantityPerPackage}</strong>
                      </p>
                    )}
                  </div>
                )}
                
                {packagesFormData.destination === "counter" && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                    <div className="flex gap-3 items-start">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="text-base font-semibold text-orange-800 dark:text-orange-200">
                        שימו לב! יש לפתוח את החבילה החדשה באלטורה
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label>בחר כרטיס</Label>
                <Select
                  value={packagesFormData.ticketId}
                  onValueChange={(value) => {
                    const selectedTicket = allAvailableTickets.find(t => t.id === value);
                    setPackagesFormData({
                      ...packagesFormData,
                      ticketId: value,
                      ticketName: selectedTicket?.name || "",
                      units: "",
                      packages: "",
                      defaultQuantityPerPackage: selectedTicket?.default_quantity_per_package || null,
                      min_threshold: selectedTicket?.min_threshold?.toString() || "10",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר כרטיס" />
                  </SelectTrigger>
                  <SelectContent>
                    {allAvailableTickets.map(ticket => (
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
                units: "",
                packages: "",
                destination: "counter",
                defaultQuantityPerPackage: null,
                min_threshold: "10",
              });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                if (!packagesFormData.ticketId) {
                  alert('אנא בחר כרטיס');
                  return;
                }
                
                // Check if either units or packages is provided (mutually exclusive)
                const unitsValue = parseInt(packagesFormData.units) || 0;
                const packagesValue = parseInt(packagesFormData.packages) || 0;
                
                if (unitsValue === 0 && packagesValue === 0) {
                  alert('אנא הזן מספר יחידות או מספר חבילות');
                  return;
                }
                
                if (unitsValue > 0 && packagesValue > 0) {
                  alert('אפשר להזין רק יחידות או חבילות, לא את שניהם');
                  return;
                }
                
                // Calculate quantity
                let quantity = 0;
                let isPackages = false;
                if (unitsValue > 0) {
                  quantity = unitsValue;
                  isPackages = false;
                } else if (packagesValue > 0) {
                  if (!packagesFormData.defaultQuantityPerPackage) {
                    alert('לכרטיס זה לא מוגדרת כמות בחבילה');
                    return;
                  }
                  quantity = packagesValue * packagesFormData.defaultQuantityPerPackage;
                  isPackages = true;
                }
                
                // Check permission based on destination
                if (user?.role === 'assistant') {
                  const canAddStock = packagesFormData.destination === "counter" ? canAddStockCounter : canAddStockVault;
                  if (!canAddStock) {
                    alert('אין לך הרשאה להוספת מלאי ל' + (packagesFormData.destination === "counter" ? "דלפק" : "כספת"));
                    return;
                  }
                }
                
                try {
                  if (!currentKiosk?.id) {
                    alert('לא ניתן לעדכן מלאי ללא קיוסק נבחר');
                    return;
                  }
                  
                  const selectedTicket = allAvailableTickets.find(t => t.id === packagesFormData.ticketId) || tickets.find(t => t.id === packagesFormData.ticketId);
                  if (!selectedTicket) {
                    alert('כרטיס לא נמצא');
                    return;
                  }
                  
                  // Get current quantities from the ticket in the inventory list (if it exists)
                  // Otherwise, get it directly from the database to ensure we have the latest values
                  let currentCounter = 0;
                  let currentVault = 0;
                  
                  const ticketInInventory = tickets.find(t => t.id === packagesFormData.ticketId);
                  if (ticketInInventory) {
                    // Use values from inventory list (already normalized for this kiosk)
                    currentCounter = ticketInInventory.quantity_counter ?? 0;
                    currentVault = ticketInInventory.quantity_vault ?? 0;
                  } else {
                    // Ticket not in inventory yet, get it from database to check if it has any amounts for this kiosk
                    try {
                      const ticketFromDb = await ticketTypesService.getTicketTypeById(packagesFormData.ticketId, currentKiosk.id);
                      if (ticketFromDb) {
                        currentCounter = ticketFromDb.quantity_counter ?? 0;
                        currentVault = ticketFromDb.quantity_vault ?? 0;
                      }
                    } catch (error) {
                      console.error('Error getting ticket from database:', error);
                      // Default to 0 if error
                    }
                  }
                  
                  const updateData = {};
                  if (packagesFormData.destination === "counter") {
                    updateData.quantity_counter = currentCounter + quantity;
                    // Preserve vault value
                    updateData.quantity_vault = currentVault;
                  } else {
                    // When updating vault, preserve counter value
                    updateData.quantity_counter = currentCounter;
                    updateData.quantity_vault = currentVault + quantity;
                  }
                  
                  // Always update min_threshold when adding inventory
                  updateData.min_threshold = parseInt(packagesFormData.min_threshold) || 10;
                  
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
                      units: isPackages ? null : unitsValue,
                      packages: isPackages ? packagesValue : null,
                      quantity_per_package: packagesFormData.defaultQuantityPerPackage || null,
                      quantity_before_counter: currentCounter,
                      quantity_after_counter: packagesFormData.destination === "counter" ? currentCounter + quantity : currentCounter,
                      quantity_before_vault: currentVault,
                      quantity_after_vault: packagesFormData.destination === "vault" ? currentVault + quantity : currentVault,
                      message: isPackages
                        ? `הוספו ${packagesValue} חבילות (${quantity} כרטיסים) ל${packagesFormData.destination === "counter" ? "דלפק" : "כספת"}`
                        : `הוספו ${quantity} כרטיסים ל${packagesFormData.destination === "counter" ? "דלפק" : "כספת"}`
                    },
                    user_id: user?.id,
                    user_name: user?.full_name || user?.email,
                  });
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications-layout'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
                  
                  setPackagesDialogOpen(false);
                  setPackagesFormData({
                    ticketId: "",
                    ticketName: "",
                    units: "",
                    packages: "",
                    destination: "counter",
                    defaultQuantityPerPackage: null,
                    min_threshold: "10",
                  });
                } catch (error) {
                  console.error('Error adding packages:', error);
                  alert('שגיאה בהוספת החבילות: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={
                !packagesFormData.ticketId || 
                ((!packagesFormData.units || parseInt(packagesFormData.units) <= 0) && 
                 (!packagesFormData.packages || parseInt(packagesFormData.packages) <= 0))
              }
              className="bg-theme-gradient"
            >
              הוסף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reduce Stock Dialog */}
      <Dialog open={reduceStockDialogOpen} onOpenChange={setReduceStockDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              הפחתת מלאי מ{reduceStockFormData.destination === "counter" ? "דלפק" : "כספת"}
            </DialogTitle>
          </DialogHeader>
          
          {reduceStockFormData.ticketId ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-accent rounded-lg">
                <div className="text-sm font-semibold">{reduceStockFormData.ticketName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  מלאי נוכחי: <strong>{reduceStockFormData.currentQuantity}</strong> יחידות
                </div>
                {reduceStockFormData.defaultQuantityPerPackage && (
                  <div className="text-xs text-muted-foreground mt-1">
                    כמות בכל חבילה: {reduceStockFormData.defaultQuantityPerPackage} כרטיסים
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>מספר יחידות להפחתה</Label>
                  <Input
                    type="number"
                    value={reduceStockFormData.units}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = parseInt(val) || 0;
                      setReduceStockFormData({
                        ...reduceStockFormData,
                        units: val,
                        packages: numVal > 0 ? "" : reduceStockFormData.packages // Clear packages only if units > 0
                      });
                    }}
                    placeholder="0"
                    min="0"
                    max={reduceStockFormData.currentQuantity}
                    disabled={!!reduceStockFormData.packages && parseInt(reduceStockFormData.packages) > 0}
                  />
                </div>
                {reduceStockFormData.defaultQuantityPerPackage && (
                  <div className="space-y-2">
                    <Label>מספר חבילות להפחתה</Label>
                    <Input
                      type="number"
                      value={reduceStockFormData.packages}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = parseInt(val) || 0;
                        setReduceStockFormData({
                          ...reduceStockFormData,
                          packages: val,
                          units: numVal > 0 ? "" : reduceStockFormData.units // Clear units only if packages > 0
                        });
                      }}
                      placeholder="0"
                      min="0"
                      max={Math.floor(reduceStockFormData.currentQuantity / reduceStockFormData.defaultQuantityPerPackage)}
                      disabled={!!reduceStockFormData.units && parseInt(reduceStockFormData.units) > 0}
                    />
                    {reduceStockFormData.packages && (
                      <p className="text-xs text-muted-foreground">
                        סה"כ כרטיסים: <strong>{parseInt(reduceStockFormData.packages || 0) * reduceStockFormData.defaultQuantityPerPackage}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setReduceStockDialogOpen(false);
              setReduceStockFormData({
                ticketId: "",
                ticketName: "",
                units: "",
                packages: "",
                destination: "counter",
                defaultQuantityPerPackage: null,
                currentQuantity: 0,
              });
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!reduceStockFormData.ticketId || !currentKiosk?.id) return;

                  const unitsValue = parseInt(reduceStockFormData.units) || 0;
                  const packagesValue = parseInt(reduceStockFormData.packages) || 0;
                  
                  if (unitsValue <= 0 && packagesValue <= 0) {
                    alert('נא להזין כמות להפחתה');
                    return;
                  }

                  let quantity = 0;
                  if (unitsValue > 0) {
                    quantity = unitsValue;
                  } else if (packagesValue > 0) {
                    if (!reduceStockFormData.defaultQuantityPerPackage) {
                      alert('לא ניתן להפחית לפי חבילות - לא הוגדרה כמות בחבילה');
                      return;
                    }
                    quantity = packagesValue * reduceStockFormData.defaultQuantityPerPackage;
                  }

                  if (quantity > reduceStockFormData.currentQuantity) {
                    alert(`לא ניתן להפחית יותר מהמלאי הקיים (${reduceStockFormData.currentQuantity})`);
                    return;
                  }

                  // Check permissions
                  if (user?.role === 'assistant') {
                    const canEdit = reduceStockFormData.destination === "counter" ? canEditCounter : canEditVault;
                    if (!canEdit) {
                      alert('אין לך הרשאה להפחתת מלאי מ' + (reduceStockFormData.destination === "counter" ? "דלפק" : "כספת"));
                      return;
                    }
                  }

                  const ticket = tickets.find(t => t.id === reduceStockFormData.ticketId);
                  if (!ticket) {
                    alert('כרטיס לא נמצא');
                    return;
                  }

                  const currentCounter = ticket.quantity_counter ?? 0;
                  const currentVault = ticket.quantity_vault ?? 0;
                  
                  const updateData = {};
                  let newQuantityCounter = currentCounter;
                  let newQuantityVault = currentVault;
                  
                  if (reduceStockFormData.destination === "counter") {
                    newQuantityCounter = Math.max(0, currentCounter - quantity);
                    updateData.quantity_counter = newQuantityCounter;
                    updateData.quantity_vault = currentVault;
                  } else {
                    newQuantityVault = Math.max(0, currentVault - quantity);
                    updateData.quantity_counter = currentCounter;
                    updateData.quantity_vault = newQuantityVault;
                  }

                  await ticketTypesService.updateTicketType(reduceStockFormData.ticketId, updateData, currentKiosk.id);

                  // Check for low stock or out of stock after reduction
                  const threshold = ticket.min_threshold || 10;
                  const checkQuantity = reduceStockFormData.destination === "counter" ? newQuantityCounter : newQuantityVault;
                  
                  if (checkQuantity === 0 || checkQuantity <= threshold) {
                    setLowStockAlert({
                      name: reduceStockFormData.ticketName,
                      quantity: checkQuantity,
                      threshold: threshold,
                      type: checkQuantity === 0 ? 'out_of_stock' : 'low_stock',
                      location: reduceStockFormData.destination === "counter" ? "דלפק" : "כספת"
                    });
                  }

                  // Create audit log
                  try {
                    await AuditLog.create({
                      action: "reduce_inventory",
                      actor_id: user?.id,
                      actor_name: user?.full_name || user?.email,
                      entity_id: reduceStockFormData.ticketId,
                      entity_type: "TicketType",
                      details: {
                        ticket_id: reduceStockFormData.ticketId,
                        ticket_name: reduceStockFormData.ticketName,
                        destination: reduceStockFormData.destination,
                        destination_name: reduceStockFormData.destination === "counter" ? "דלפק" : "כספת",
                        quantity_reduced: quantity,
                        quantity_per_package: reduceStockFormData.defaultQuantityPerPackage || null,
                        packages_reduced: packagesValue || null,
                        quantity_after_counter: updateData.quantity_counter,
                        quantity_after_vault: updateData.quantity_vault,
                        message: packagesValue > 0
                          ? `הופחתו ${packagesValue} חבילות (${quantity} כרטיסים) מ${reduceStockFormData.destination === "counter" ? "דלפק" : "כספת"}`
                          : `הופחתו ${quantity} כרטיסים מ${reduceStockFormData.destination === "counter" ? "דלפק" : "כספת"}`
                      },
                      kiosk_id: currentKiosk.id,
                    });
                  } catch (auditError) {
                    console.error("Error creating audit log:", auditError);
                  }
                  
                  queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-dashboard', currentKiosk?.id] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications-layout'] });
                  queryClient.invalidateQueries({ queryKey: ['tickets-for-notifications'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
                  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
                  
                  setReduceStockDialogOpen(false);
                  setReduceStockFormData({
                    ticketId: "",
                    ticketName: "",
                    units: "",
                    packages: "",
                    destination: "counter",
                    defaultQuantityPerPackage: null,
                    currentQuantity: 0,
                  });
                } catch (error) {
                  console.error('Error reducing stock:', error);
                  alert('שגיאה בהפחתת המלאי: ' + (error.message || 'שגיאה לא ידועה'));
                }
              }}
              disabled={
                !reduceStockFormData.ticketId || 
                ((!reduceStockFormData.units || parseInt(reduceStockFormData.units) <= 0) && 
                 (!reduceStockFormData.packages || parseInt(reduceStockFormData.packages) <= 0))
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              הפחת
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>צפייה בכרטיס</DialogTitle>
          </DialogHeader>
          
          {viewTicket && (
            <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Ticket Image or Color */}
              {viewTicket.image_url ? (
                <div className="w-full h-48 rounded-lg overflow-hidden">
                  <img 
                    src={viewTicket.image_url} 
                    alt={viewTicket.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className={`w-full h-32 rounded-lg bg-gradient-to-br ${
                  colorOptions.find(c => c.value === viewTicket.color)?.class || "bg-blue-500"
                } flex items-center justify-center`}>
                  <span className="text-4xl font-bold text-white/90">
                    {viewTicket.code || viewTicket.name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">שם הכרטיס</Label>
                  <p className="font-semibold text-foreground">{viewTicket.name}</p>
                </div>
                {viewTicket.nickname && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">כינוי</Label>
                    <p className="text-foreground">"{viewTicket.nickname}"</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">מחיר</Label>
                  <p className="font-semibold text-primary text-xl">₪{viewTicket.price}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">קוד</Label>
                  <p className="text-foreground font-mono">{viewTicket.code}</p>
                </div>
              </div>

              {/* Inventory Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 border rounded-lg">
                  <Label className="text-base font-semibold">דלפק</Label>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">
                      {viewTicket.quantity_counter ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">יחידות</p>
                  </div>
                </div>
                <div className="space-y-3 p-4 border rounded-lg">
                  <Label className="text-base font-semibold">כספת</Label>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">
                      {viewTicket.quantity_vault ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">יחידות</p>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">כמות יחידות בחבילה</Label>
                  <p className="text-foreground">
                    {viewTicket.default_quantity_per_package || "לא מוגדר"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">סף התראה</Label>
                  <p className="text-foreground">{viewTicket.min_threshold || 10}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סוג כרטיס</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את "{selectedTicket?.name}" מהמלאי?
              פעולה זו תמחק את הכרטיס מהמלאי של הקיוסק הנוכחי ולא ניתנת לביטול.
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)]" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת כרטיסים מרובים</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק {selectedTicketIds.size} כרטיסים מהמלאי?
              פעולה זו תמחק את הכרטיסים מהמלאי של הקיוסק הנוכחי ולא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending ? 'מוחק...' : 'מחק נבחרים'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Low Stock Alert Dialog */}
      <AlertDialog open={!!lowStockAlert} onOpenChange={(open) => !open && setLowStockAlert(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              התראת מלאי
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              {lowStockAlert && (
                <div className={`p-3 rounded-lg ${
                  lowStockAlert.type === 'out_of_stock' 
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{lowStockAlert.name}</span>
                    <span className={`text-sm font-bold ${
                      lowStockAlert.type === 'out_of_stock' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {lowStockAlert.type === 'out_of_stock' ? 'אזל מהמלאי!' : 'מלאי נמוך'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">
                    {lowStockAlert.type === 'out_of_stock' 
                      ? `המלאי ב${lowStockAlert.location} אזל לחלוטין` 
                      : `המלאי ב${lowStockAlert.location}: ${lowStockAlert.quantity} יחידות (סף: ${lowStockAlert.threshold})`}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setLowStockAlert(null)}>
              הבנתי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}