import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useTheme } from "../context/ThemeContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Calendar } from "lucide-react";
import { apiFetch } from "../utils/api";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLORS = {
  booked: "#22c55e",
  completed: "#3b82f6",
  unbooked: "#f59e0b",
};

export const AnalyticsPanel = ({ isOpen }) => {
  const { currentTheme } = useTheme();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/analytics/overview");
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  const monthlyData = analytics.monthly_income.map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    income: m.income,
    events: m.events,
  }));

  const statusData = Object.entries(analytics.status_breakdown).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value,
    color: STATUS_COLORS[key],
  }));

  const packageData = analytics.package_revenue;

  const chartColors = {
    primary: currentTheme.color,
    grid: currentTheme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    text: currentTheme.isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
  };

  return (
    <div className="space-y-6" data-testid="analytics-panel">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {formatCurrency(analytics.totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Costs</p>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(analytics.totals.costs)}
            </p>
          </CardContent>
        </Card>
        <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Profit Margin</p>
            <p className="text-xl font-bold tabular-nums text-green-500">
              {analytics.totals.profit_margin}%
            </p>
          </CardContent>
        </Card>
        <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Deposits Received</p>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(analytics.totals.deposits_received)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income" className="gap-2 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Monthly</span> Income
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-2 text-xs sm:text-sm">
            <PieChartIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Event</span> Status
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4" />
            Packages
          </TabsTrigger>
        </TabsList>

        {/* Monthly Income Chart */}
        <TabsContent value="income" className="mt-4">
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Monthly Income ({analytics.year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: chartColors.text, fontSize: 12 }}
                      axisLine={{ stroke: chartColors.grid }}
                    />
                    <YAxis 
                      tick={{ fill: chartColors.text, fontSize: 12 }}
                      axisLine={{ stroke: chartColors.grid }}
                      tickFormatter={(value) => `€${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: currentTheme.isDark ? '#1e293b' : '#ffffff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: currentTheme.isDark ? '#fff' : '#000',
                      }}
                      formatter={(value, name) => [
                        name === 'income' ? formatCurrency(value) : value,
                        name === 'income' ? 'Income' : 'Events'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="income" fill={currentTheme.color} radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="events" fill="#64748b" radius={[4, 4, 0, 0]} name="Events" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Breakdown Chart */}
        <TabsContent value="status" className="mt-4">
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Event Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: chartColors.text }}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: currentTheme.isDark ? '#1e293b' : '#ffffff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: currentTheme.isDark ? '#fff' : '#000',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Package Revenue Chart */}
        <TabsContent value="packages" className="mt-4">
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue by Package</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {packageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={packageData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis 
                        type="number"
                        tick={{ fill: chartColors.text, fontSize: 12 }}
                        axisLine={{ stroke: chartColors.grid }}
                        tickFormatter={(value) => `€${value}`}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name"
                        tick={{ fill: chartColors.text, fontSize: 12 }}
                        axisLine={{ stroke: chartColors.grid }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: currentTheme.isDark ? '#1e293b' : '#ffffff',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: currentTheme.isDark ? '#fff' : '#000',
                        }}
                        formatter={(value) => [formatCurrency(value), 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill={currentTheme.color} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No package data yet. Assign packages to events to see revenue breakdown.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPanel;
