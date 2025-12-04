import React from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  CreditCard, 
  Banknote, 
  Wallet, 
  MoreVertical,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
};

const statusColors = {
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
};

const statusLabels = {
  completed: "הושלם",
  cancelled: "בוטל",
  refunded: "זוכה",
};

export default function RecentSalesTable({ 
  sales, 
  onView, 
  onEdit, 
  onDelete,
  isOwner 
}) {
  if (!sales || sales.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>אין עסקאות להצגה</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-accent">
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">מוכר</TableHead>
            <TableHead className="text-right">פריטים</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            <TableHead className="text-right">תשלום</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale, index) => {
            const PaymentIcon = paymentIcons[sale.payment_method] || Wallet;
            
            return (
              <motion.tr
                key={sale.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-accent transition-colors"
              >
                <TableCell className="font-medium">
                  <div>
                    <p>{format(new Date(sale.created_date), "dd/MM/yyyy", { locale: he })}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(sale.created_date), "HH:mm")}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{sale.seller_name || "—"}</TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    {sale.items?.slice(0, 2).map((item, i) => (
                      <p key={i} className="text-sm truncate">
                        {item.quantity}× {item.ticket_name}
                      </p>
                    ))}
                    {sale.items?.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{sale.items.length - 2} נוספים
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-bold text-primary">
                  ₪{sale.total_amount?.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <PaymentIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {sale.payment_method === 'cash' ? 'מזומן' : 'כרטיס'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[sale.status]}>
                    {statusLabels[sale.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(sale)}>
                        <Eye className="h-4 w-4 ml-2" />
                        צפייה
                      </DropdownMenuItem>
                      {isOwner && sale.status === 'completed' && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(sale)}>
                            <Edit className="h-4 w-4 ml-2" />
                            עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDelete(sale)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 ml-2" />
                            מחיקה
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}