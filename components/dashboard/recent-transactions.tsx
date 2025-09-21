"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownRight, ArrowRightLeft, ExternalLink } from "lucide-react"

interface Transaction {
  id: string
  tx_hash: string
  transaction_type: "mint" | "burn" | "transfer"
  amount: number
  status: "pending" | "confirmed" | "failed"
  created_at: string
  tokens?: {
    token_name: string
    symbol: string
  }
}

interface RecentTransactionsProps {
  transactions: Transaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "mint":
        return <ArrowUpRight className="h-4 w-4 text-green-500" />
      case "burn":
        return <ArrowDownRight className="h-4 w-4 text-red-500" />
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
      default:
        return <ArrowRightLeft className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Confirmed</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const formatAmount = (amount: number) => {
    return (amount / 1000000).toLocaleString() // Assuming 6 decimals
  }

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <CardDescription>Your latest token operations</CardDescription>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <ArrowRightLeft className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Your token operations will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  {getTransactionIcon(tx.transaction_type)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm capitalize">{tx.transaction_type}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{tx.tokens?.symbol || "TOKEN"}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{truncateHash(tx.tx_hash)}</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-sm">
                    {formatAmount(tx.amount)} {tx.tokens?.symbol || "TOKEN"}
                  </div>
                  <div className="flex items-center justify-end space-x-2">{getStatusBadge(tx.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
