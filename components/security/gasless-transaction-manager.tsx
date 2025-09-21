"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Zap, Clock, CheckCircle, AlertTriangle, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface GaslessTransaction {
  id: string
  transaction_id: string
  sponsor_address: string
  gas_fee_ada: number
  status: string
  nonce: number
  expires_at: string
  created_at: string
  transactions?: {
    transaction_type: string
    amount: number
    tokens?: {
      symbol: string
    }
  }
}

interface GaslessTransactionManagerProps {
  userId: string
}

export function GaslessTransactionManager({ userId }: GaslessTransactionManagerProps) {
  const supabase = createClient()
  const [gaslessTransactions, setGaslessTransactions] = useState<GaslessTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sponsorBalance, setSponsorBalance] = useState(1250.75) // Mock sponsor balance
  const [dailyLimit, setDailyLimit] = useState({ used: 3, total: 10 })

  useEffect(() => {
    fetchGaslessTransactions()
  }, [])

  const fetchGaslessTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("gasless_transactions")
        .select(`
          *,
          transactions (
            transaction_type,
            amount,
            tokens (symbol)
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error
      setGaslessTransactions(data || [])
    } catch (error) {
      console.error("Error fetching gasless transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sponsored":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Sponsored</Badge>
      case "executed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Executed</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const formatAmount = (amount: number) => {
    return (amount / 1000000).toLocaleString()
  }

  const formatAda = (lovelace: number) => {
    return (lovelace / 1000000).toFixed(6)
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sponsor Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₳{sponsorBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Available for gas fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Limit</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dailyLimit.used}/{dailyLimit.total}
            </div>
            <Progress value={(dailyLimit.used / dailyLimit.total) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Gasless transactions today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">High</div>
            <p className="text-xs text-muted-foreground">Multi-sig enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Gasless Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Gasless Transactions</span>
          </CardTitle>
          <CardDescription>Your sponsored transactions with zero gas fees</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {gaslessTransactions
                .filter((tx) => tx.status === "pending" || tx.status === "sponsored")
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold capitalize">
                          {tx.transactions?.transaction_type} {tx.transactions?.tokens?.symbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Amount: {formatAmount(tx.transactions?.amount || 0)} tokens
                        </div>
                        <div className="text-xs text-gray-500">Gas Fee: ₳{formatAda(tx.gas_fee_ada)} (Sponsored)</div>
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      {getStatusBadge(tx.status)}
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>{getTimeRemaining(tx.expires_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}

              {gaslessTransactions.filter((tx) => tx.status === "pending" || tx.status === "sponsored").length ===
                0 && (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No active gasless transactions</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {gaslessTransactions
                .filter((tx) => tx.status === "executed")
                .map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold capitalize">
                          {tx.transactions?.transaction_type} {tx.transactions?.tokens?.symbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Amount: {formatAmount(tx.transactions?.amount || 0)} tokens
                        </div>
                        <div className="text-xs text-gray-500">
                          Completed: {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {getStatusBadge(tx.status)}
                      <div className="text-sm text-green-600 mt-1">Saved: ₳{formatAda(tx.gas_fee_ada)}</div>
                    </div>
                  </div>
                ))}

              {gaslessTransactions.filter((tx) => tx.status === "executed").length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No completed gasless transactions</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="failed" className="space-y-4">
              {gaslessTransactions
                .filter((tx) => tx.status === "failed")
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-red-50 dark:bg-red-900/20"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-semibold capitalize">
                          {tx.transactions?.transaction_type} {tx.transactions?.tokens?.symbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Amount: {formatAmount(tx.transactions?.amount || 0)} tokens
                        </div>
                        <div className="text-xs text-red-600">
                          Failed: Transaction expired or insufficient sponsor balance
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {getStatusBadge(tx.status)}
                      <Button size="sm" variant="outline" className="mt-2 bg-transparent">
                        Retry
                      </Button>
                    </div>
                  </div>
                ))}

              {gaslessTransactions.filter((tx) => tx.status === "failed").length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No failed gasless transactions</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Security Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Gasless transactions are sponsored by Kepka's treasury. Daily limits apply to prevent abuse. All transactions
          are secured with multi-signature validation and rate limiting.
        </AlertDescription>
      </Alert>
    </div>
  )
}
