"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, MoreHorizontal } from "lucide-react"
import Link from "next/link"

interface Token {
  id: string
  token_name: string
  symbol: string
  total_supply: number
  decimals: number
  description: string
  created_at: string
}

interface TokenOverviewProps {
  tokens: Token[]
}

export function TokenOverview({ tokens }: TokenOverviewProps) {
  const formatSupply = (supply: number, decimals: number) => {
    return (supply / Math.pow(10, decimals)).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Tokens</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your Cardano native tokens</p>
        </div>
        <Link href="/dashboard/create-token">
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            Create New Token
          </Button>
        </Link>
      </div>

      {tokens.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Coins className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tokens yet</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Create your first Cardano native token to get started
            </p>
            <Link href="/dashboard/create-token">
              <Button>Create Your First Token</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tokens.map((token) => (
            <Card key={token.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg">{token.token_name}</CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="mt-1">
                      {token.symbol}
                    </Badge>
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Supply</span>
                    <span className="font-semibold">
                      {formatSupply(token.total_supply, token.decimals)} {token.symbol}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Price Change</span>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-green-500 font-semibold">+12.5%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Price</span>
                    <span className="font-semibold">₳0.45</span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {token.description || "No description available"}
                  </p>

                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                      Mint
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                      Burn
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                      Transfer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
