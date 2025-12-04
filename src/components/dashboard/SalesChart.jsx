import React from "react";
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { he } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SalesChart({ sales, period = "week" }) {
  const today = new Date();
  let data = [];
  let dateFormat = "EEE";
  let fullDateFormat = "dd/MM";

  if (period === "day") {
    // Last 24 hours - by hour
    data = [...Array(24)].map((_, i) => {
      const hour = new Date();
      hour.setHours(today.getHours() - (23 - i), 0, 0, 0);
      const hourStart = new Date(hour);
      const hourEnd = new Date(hour);
      hourEnd.setHours(hourEnd.getHours() + 1);
      
      const hourSales = sales.filter(sale => {
        const saleDate = new Date(sale.created_date);
        return saleDate >= hourStart && saleDate < hourEnd && sale.status === 'completed';
      });

      const total = hourSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const count = hourSales.length;

      return {
        date: format(hour, "HH:00", { locale: he }),
        fullDate: format(hour, "dd/MM HH:00", { locale: he }),
        total,
        count,
      };
    });
    dateFormat = "HH:00";
    fullDateFormat = "dd/MM HH:00";
  } else if (period === "week") {
    // Last 7 days
    data = [...Array(7)].map((_, i) => {
      const date = subDays(today, 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySales = sales.filter(sale => {
        const saleDate = new Date(sale.created_date);
        return saleDate >= dayStart && saleDate <= dayEnd && sale.status === 'completed';
      });

      const total = daySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const count = daySales.length;

      return {
        date: format(date, "EEE", { locale: he }),
        fullDate: format(date, "dd/MM", { locale: he }),
        total,
        count,
      };
    });
    dateFormat = "EEE";
    fullDateFormat = "dd/MM";
  } else if (period === "month") {
    // Last 30 days - by day
    data = [...Array(30)].map((_, i) => {
      const date = subDays(today, 29 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySales = sales.filter(sale => {
        const saleDate = new Date(sale.created_date);
        return saleDate >= dayStart && saleDate <= dayEnd && sale.status === 'completed';
      });

      const total = daySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const count = daySales.length;

      return {
        date: format(date, "dd/MM", { locale: he }),
        fullDate: format(date, "dd/MM/yyyy", { locale: he }),
        total,
        count,
      };
    });
    dateFormat = "dd/MM";
    fullDateFormat = "dd/MM/yyyy";
  } else if (period === "year") {
    // Last 12 months - by month
    data = [...Array(12)].map((_, i) => {
      const date = subMonths(today, 11 - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthSales = sales.filter(sale => {
        const saleDate = new Date(sale.created_date);
        return saleDate >= monthStart && saleDate <= monthEnd && sale.status === 'completed';
      });

      const total = monthSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      const count = monthSales.length;

      return {
        date: format(date, "MMM", { locale: he }),
        fullDate: format(date, "MMMM yyyy", { locale: he }),
        total,
        count,
      };
    });
    dateFormat = "MMM";
    fullDateFormat = "MMMM yyyy";
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card rounded-lg shadow-lg p-3 border border-border">
          <p className="text-sm font-medium text-foreground mb-1">
            {payload[0]?.payload?.fullDate}
          </p>
          <p className="text-sm text-muted-foreground">
            מכירות: {payload[0]?.payload?.count}
          </p>
          <p className="text-sm font-bold text-primary">
            ₪{payload[0]?.value?.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `₪${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#colorTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}