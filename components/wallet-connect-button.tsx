"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"
import { Wallet, ExternalLink } from "lucide-react"

interface WalletOption {
  name: string
  icon: string
  description: string
  downloadUrl: string
}

const walletOptions: WalletOption[] = [
  {
    name: "Nami",
    icon: "🦎",
    description: "Popular and user-friendly Cardano wallet",
    downloadUrl: "https://namiwallet.io/",
  },
  {
    name: "Eternl",
    icon: "♾️",
    description: "Feature-rich wallet with advanced capabilities",
    downloadUrl: "https://eternl.io/",
  },
  {
    name: "Flint",
    icon: "🔥",
    description: "Lightweight and fast Cardano wallet",
    downloadUrl: "https://flint-wallet.com/",
  },
  {
    name: "Lace",
    icon: "🎭",
    description: "IOG's official light wallet platform",
    downloadUrl: "https://www.lace.io/",
  },
]

export function WalletConnectButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState<string | null>(null)

  const connectWallet = async (walletName: string) => {
    setIsConnecting(walletName)

    try {
      // Check if wallet is available
      const walletKey = walletName.toLowerCase()
      if (typeof window !== "undefined" && (window as any).cardano?.[walletKey]) {
        const wallet = (window as any).cardano[walletKey]
        const api = await wallet.enable()

        // Get wallet address
        const addresses = await api.getUsedAddresses()
        if (addresses.length > 0) {
          // Here you would typically save the wallet connection to your database
          console.log(`Connected to ${walletName}:`, addresses[0])
          setIsOpen(false)
          // Redirect to dashboard or update UI state
        }
      } else {
        // Wallet not installed, redirect to download
        window.open(walletOptions.find((w) => w.name === walletName)?.downloadUrl, "_blank")
      }
    } catch (error) {
      console.error(`Failed to connect to ${walletName}:`, error)
    } finally {
      setIsConnecting(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Cardano Wallet</DialogTitle>
          <DialogDescription>Choose your preferred Cardano wallet to get started with Kepka</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {walletOptions.map((wallet) => (
            <Card
              key={wallet.name}
              className="cursor-pointer hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700"
              onClick={() => connectWallet(wallet.name)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{wallet.icon}</span>
                    <div>
                      <CardTitle className="text-base">{wallet.name}</CardTitle>
                      <CardDescription className="text-sm">{wallet.description}</CardDescription>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  className="w-full bg-transparent"
                  variant="outline"
                  disabled={isConnecting === wallet.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    connectWallet(wallet.name)
                  }}
                >
                  {isConnecting === wallet.name ? "Connecting..." : "Connect"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-xs text-gray-500 text-center mt-4">
          Don't have a wallet? Click on any option above to download and install.
        </div>
      </DialogContent>
    </Dialog>
  )
}
