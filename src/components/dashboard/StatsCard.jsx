import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  color = "indigo",
  delay = 0,
  description = null
}) {
  const colorClasses = {
    indigo: {
      bg: "bg-indigo-50",
      icon: "bg-indigo-100 text-indigo-600",
      gradient: "from-indigo-500 to-purple-600",
    },
    green: {
      bg: "bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-600",
      gradient: "from-emerald-500 to-teal-600",
    },
    orange: {
      bg: "bg-orange-50",
      icon: "bg-orange-100 text-orange-600",
      gradient: "from-orange-500 to-red-600",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "bg-blue-100 text-blue-600",
      gradient: "from-blue-500 to-cyan-600",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend === 'up' ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </motion.div>
  );
}