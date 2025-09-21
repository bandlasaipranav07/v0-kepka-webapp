"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface ExchangeRate {
  token_symbol: string
  price_usd: number
  price_ada: number
  change_24h: number
  volume_24h: number
  market_cap: number
}

export function ExchangeRatesWidget() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Mock data for demonstration
  const mockRates: ExchangeRate[] = [
    {
      token_symbol: "ADA",
      price_usd: 0.85,
      price_ada: 1.0,
      change_24h: 2.5,
      volume_24h: 1250000,
      market_cap: 35000000000,
    },
    {
      token_symbol: "KEPKA",
      price_usd: 0.42,
      price_ada: 0.49,
      change_24h: 15.2,
      volume_24h: 85000,
      market_cap: 2100000,
    },
    {
      token_symbol: "SUNDAE",
      price_usd: 0.018,
      price_ada: 0.021,
      change_24h: -3.8,
      volume_24h: 125000,
      market_cap: 18500000,
    },
    {
      token_symbol: "MIN",
      price_usd: 0.0045,
      price_ada: 0.0053,
      change_24h: 8.7,
      volume_24h: 95000,
      market_cap: 4500000,
    },
  ]

  useEffect(() => {
    // Simulate API call
    const fetchRates = async () => {
      setIsLoading(true)
      // In a real app, this would be an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setRates(mockRates)
      setLastUpdated(new Date())
      setIsLoading(false)
    }

    fetchRates()

    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchRates, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return `$${price.toFixed(2)}`
    }
    return `$${price.toFixed(4)}`
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(0)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  const refreshRates = () => {
    setIsLoading(true)
    setTimeout(() => {
      setRates([...mockRates])
      setLastUpdated(new Date())
      setIsLoading(false)
    }, 1000)
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Live Exchange Rates</CardTitle>
          <CardDescription>Real-time Cardano token prices</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshRates} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rates.map((rate) => (
            <div
              key={rate.token_symbol}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{rate.token_symbol.slice(0, 2)}</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">{rate.token_symbol}</div>
                  <div className="text-xs text-gray-500">Vol: {formatVolume(rate.volume_24h)}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold text-sm">{formatPrice(rate.price_usd)}</div>
                <div className="text-xs text-gray-500">₳{rate.price_ada.toFixed(4)}</div>
              </div>

              <div className="flex items-center space-x-1">
                {rate.change_24h >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-semibold ${rate.change_24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {rate.change_24h >= 0 ? "+" : ""}
                  {rate.change_24h.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      </CardContent>
    </Card>
  )
}
