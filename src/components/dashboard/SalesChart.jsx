import React from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
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

export default function SalesChart({ sales }) {
  // Generate last 7 days data
  const last7Days = [...Array(7)].map((_, i) => {
    const date = subDays(new Date(), 6 - i);
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-3 border border-slate-200">
          <p className="text-sm font-medium text-slate-800 mb-1">
            {payload[0]?.payload?.fullDate}
          </p>
          <p className="text-sm text-slate-600">
            מכירות: {payload[0]?.payload?.count}
          </p>
          <p className="text-sm font-bold text-indigo-600">
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
        <AreaChart data={last7Days}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#94a3b8"
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