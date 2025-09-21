"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const mockData = [
  { date: "2025-01-15", value: 1250 },
  { date: "2025-01-16", value: 1320 },
  { date: "2025-01-17", value: 1180 },
  { date: "2025-01-18", value: 1450 },
  { date: "2025-01-19", value: 1380 },
  { date: "2025-01-20", value: 1520 },
  { date: "2025-01-21", value: 1680 },
]

export function PortfolioChart() {
  const currentValue = mockData[mockData.length - 1].value
  const previousValue = mockData[mockData.length - 2].value
  const change = ((currentValue - previousValue) / previousValue) * 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Portfolio Value</CardTitle>
            <CardDescription>Total value of your token holdings</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <TrendingUp className="h-3 w-3 mr-1" />+{change.toFixed(1)}%
          </Badge>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold">₳{currentValue.toLocaleString()}</span>
          <span className="text-lg text-gray-600 dark:text-gray-400">${(currentValue * 0.85).toLocaleString()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis tickFormatter={(value) => `₳${value}`} className="text-gray-600 dark:text-gray-400" />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [`₳${value.toLocaleString()}`, "Portfolio Value"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#gradient)"
                strokeWidth={3}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
