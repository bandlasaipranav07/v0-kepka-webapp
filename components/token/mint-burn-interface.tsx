"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Flame, Coins, AlertTriangle, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Token {
  id: string
  token_name: string
  symbol: string
  total_supply: number
  decimals: number
  policy_id: string
  asset_name: string
}

interface MintBurnInterfaceProps {
  token: Token
  userId: string
}

export function MintBurnInterface({ token, userId }: MintBurnInterfaceProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<"mint" | "burn">("mint")
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [metadata, setMetadata] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const formatSupply = (supply: number) => {
    return (supply / Math.pow(10, token.decimals)).toLocaleString()
  }

  const handleMint = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const mintAmount = Number.parseFloat(amount)
      if (isNaN(mintAmount) || mintAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      if (!recipient) {
        throw new Error("Please enter a recipient address")
      }

      // Validate Cardano address format (basic validation)
      if (!recipient.startsWith("addr1") && !recipient.startsWith("addr_test1")) {
        throw new Error("Please enter a valid Cardano address")
      }

      const amountInLovelace = Math.floor(mintAmount * Math.pow(10, token.decimals))

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          tx_hash: `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          token_id: token.id,
          user_id: userId,
          transaction_type: "mint",
          amount: amountInLovelace,
          status: "pending",
          metadata: {
            recipient,
            user_metadata: metadata || null,
            policy_id: token.policy_id,
            asset_name: token.asset_name,
          },
        })
        .select()
        .single()

      if (txError) throw txError

      // In a real implementation, this would trigger the actual Cardano transaction
      console.log("Mint transaction initiated:", {
        tokenId: token.id,
        amount: amountInLovelace,
        recipient,
        txHash: transaction.tx_hash,
      })

      // Simulate transaction processing
      setTimeout(async () => {
        await supabase.from("transactions").update({ status: "confirmed" }).eq("id", transaction.id)

        // Update token supply
        await supabase
          .from("tokens")
          .update({ total_supply: token.total_supply + amountInLovelace })
          .eq("id", token.id)
      }, 3000)

      setSuccess(`Successfully initiated minting of ${mintAmount} ${token.symbol}`)
      setAmount("")
      setRecipient("")
      setMetadata("")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBurn = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const burnAmount = Number.parseFloat(amount)
      if (isNaN(burnAmount) || burnAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      const amountInLovelace = Math.floor(burnAmount * Math.pow(10, token.decimals))

      if (amountInLovelace > token.total_supply) {
        throw new Error("Cannot burn more tokens than the total supply")
      }

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          tx_hash: `burn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          token_id: token.id,
          user_id: userId,
          transaction_type: "burn",
          amount: amountInLovelace,
          status: "pending",
          metadata: {
            user_metadata: metadata || null,
            policy_id: token.policy_id,
            asset_name: token.asset_name,
          },
        })
        .select()
        .single()

      if (txError) throw txError

      // In a real implementation, this would trigger the actual Cardano transaction
      console.log("Burn transaction initiated:", {
        tokenId: token.id,
        amount: amountInLovelace,
        txHash: transaction.tx_hash,
      })

      // Simulate transaction processing
      setTimeout(async () => {
        await supabase.from("transactions").update({ status: "confirmed" }).eq("id", transaction.id)

        // Update token supply
        await supabase
          .from("tokens")
          .update({ total_supply: token.total_supply - amountInLovelace })
          .eq("id", token.id)
      }, 3000)

      setSuccess(`Successfully initiated burning of ${burnAmount} ${token.symbol}`)
      setAmount("")
      setMetadata("")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Token Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Coins className="h-5 w-5" />
                <span>{token.token_name}</span>
              </CardTitle>
              <CardDescription>Policy ID: {token.policy_id}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {token.symbol}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{formatSupply(token.total_supply)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Supply</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{token.decimals}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Decimals</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">₳0.45</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Current Price</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mint/Burn Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Token Operations</CardTitle>
          <CardDescription>Mint new tokens or burn existing ones</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mint" className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Mint Tokens</span>
              </TabsTrigger>
              <TabsTrigger value="burn" className="flex items-center space-x-2">
                <Flame className="h-4 w-4" />
                <span>Burn Tokens</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mint" className="space-y-4 mt-6">
              <Alert>
                <Plus className="h-4 w-4" />
                <AlertDescription>
                  Minting will create new tokens and send them to the specified address. This operation is irreversible.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mintAmount">Amount to Mint</Label>
                  <Input
                    id="mintAmount"
                    type="number"
                    placeholder="1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="any"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Address</Label>
                  <Input
                    id="recipient"
                    placeholder="addr1..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mintMetadata">Metadata (Optional)</Label>
                <Textarea
                  id="mintMetadata"
                  placeholder="Additional metadata for this mint operation..."
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleMint}
                disabled={isLoading || !amount || !recipient}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isLoading ? "Minting..." : `Mint ${amount || "0"} ${token.symbol}`}
              </Button>
            </TabsContent>

            <TabsContent value="burn" className="space-y-4 mt-6">
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  Burning tokens will permanently destroy them and reduce the total supply. This operation cannot be
                  undone.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="burnAmount">Amount to Burn</Label>
                <Input
                  id="burnAmount"
                  type="number"
                  placeholder="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="any"
                />
                <p className="text-xs text-gray-500">
                  Maximum: {formatSupply(token.total_supply)} {token.symbol}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="burnMetadata">Burn Reason (Optional)</Label>
                <Textarea
                  id="burnMetadata"
                  placeholder="Reason for burning these tokens..."
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleBurn}
                disabled={isLoading || !amount}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              >
                {isLoading ? "Burning..." : `Burn ${amount || "0"} ${token.symbol}`}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert className="mt-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mt-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
