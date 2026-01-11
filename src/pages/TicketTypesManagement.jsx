import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { auth } from "@/api/entities";
import { 
  Search, 
  Package,
  Edit, 
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function TicketTypesManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    default_quantity_per_package: "",
    image_url: "",
    name: "",
    pais_card_id: "",
    price: "",
  });
  const [currentUser, setCurrentUser] = useState(null);

  const queryClient = useQueryClient();

  // Get current user to check permissions
  React.useEffect(() => {
    auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['ticket-types-all'],
    queryFn: () => ticketTypesService.getAllTicketTypes(),
    enabled: currentUser?.role === 'system_manager',
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, kioskId }) => ticketTypesService.updateTicketType(id, data, kioskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-types-all'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      default_quantity_per_package: "",
      image_url: "",
      name: "",
      pais_card_id: "",
      price: "",
    });
    setSelectedTicket(null);
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      code: ticket.code || "",
      default_quantity_per_package: ticket.default_quantity_per_package?.toString() || "",
      image_url: ticket.image_url || "",
      name: ticket.name || "",
      pais_card_id: ticket.pais_card_id || "",
      price: ticket.price?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('נא למלא את שם הכרטיס');
      return;
    }

    if (!formData.code) {
      alert('נא למלא את קוד הכרטיס');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert('נא למלא מחיר תקין');
      return;
    }

    const payload = {
      name: formData.name,
      code: formData.code,
      price: parseFloat(formData.price),
      default_quantity_per_package: formData.default_quantity_per_package 
        ? parseInt(formData.default_quantity_per_package) 
        : null,
      image_url: formData.image_url || null,
      pais_card_id: formData.pais_card_id || null,
    };

    if (selectedTicket) {
      await updateMutation.mutateAsync({ 
        id: selectedTicket.id, 
        data: payload,
        kioskId: null // No kioskId for global updates
      });
    }
  };

  const filteredTickets = tickets.filter(ticket => 
    ticket.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.pais_card_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Only system managers can access
  if (currentUser && currentUser.role !== 'system_manager') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לדף זה</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול כרטיסים</h1>
          <p className="text-muted-foreground">ניהול כל הכרטיסים של מפעל הפיס</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם, קוד או מזהה מפעל הפיס..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">טוען כרטיסים...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            לא נמצאו כרטיסים
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Image */}
                  <div className="flex-shrink-0">
                    {ticket.image_url ? (
                      <img 
                        src={ticket.image_url} 
                        alt={ticket.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-accent rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Ticket Info */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">שם</p>
                      <p className="font-medium">{ticket.name || 'ללא שם'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">קוד</p>
                      <Badge variant="outline">{ticket.code || 'ללא קוד'}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">מזהה מפעל הפיס</p>
                      <p>{ticket.pais_card_id || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">מחיר</p>
                      <p className="font-semibold">₪{ticket.price || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">יחידות בחבילה</p>
                      <p>
                        {ticket.default_quantity_per_package 
                          ? `${ticket.default_quantity_per_package} יחידות` 
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(ticket)}
                      title="עריכת כרטיס"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת כרטיס</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>שם הכרטיס <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="שם הכרטיס"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>קוד <span className="text-red-500">*</span></Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="קוד הכרטיס"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>מזהה מפעל הפיס</Label>
              <Input
                value={formData.pais_card_id}
                onChange={(e) => setFormData({ ...formData, pais_card_id: e.target.value })}
                placeholder="מזהה מפעל הפיס"
              />
            </div>

            <div className="space-y-2">
              <Label>מחיר (₪) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>כמות יחידות בחבילה</Label>
              <Input
                type="number"
                value={formData.default_quantity_per_package}
                onChange={(e) => setFormData({ ...formData, default_quantity_per_package: e.target.value })}
                placeholder="לדוגמה: 20"
                min="1"
              />
              <p className="text-xs text-muted-foreground">השאר ריק אם לא רלוונטי</p>
            </div>

            <div className="space-y-2">
              <Label>קישור לתמונה</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                type="url"
              />
              {formData.image_url && (
                <div className="mt-2">
                  <img 
                    src={formData.image_url} 
                    alt="תצוגה מקדימה"
                    className="w-32 h-32 object-cover rounded-lg border"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              resetForm();
            }}>
              ביטול
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="bg-theme-gradient"
            >
              {updateMutation.isPending ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
