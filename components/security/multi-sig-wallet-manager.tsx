"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Users, Plus, Key, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface MultiSigWallet {
  id: string
  wallet_name: string
  required_signatures: number
  total_signers: number
  wallet_address: string
  script_hash: string
  is_active: boolean
  created_at: string
}

interface WalletSigner {
  id: string
  signer_address: string
  signer_name: string
  public_key: string
  is_verified: boolean
  added_at: string
}

interface MultiSigWalletManagerProps {
  userId: string
}

export function MultiSigWalletManager({ userId }: MultiSigWalletManagerProps) {
  const supabase = createClient()
  const [wallets, setWallets] = useState<MultiSigWallet[]>([])
  const [selectedWallet, setSelectedWallet] = useState<MultiSigWallet | null>(null)
  const [signers, setSigners] = useState<WalletSigner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Create wallet form state
  const [walletName, setWalletName] = useState("")
  const [requiredSignatures, setRequiredSignatures] = useState(2)
  const [totalSigners, setTotalSigners] = useState(3)
  const [signerAddresses, setSignerAddresses] = useState<string[]>(["", "", ""])

  useEffect(() => {
    fetchWallets()
  }, [])

  useEffect(() => {
    if (selectedWallet) {
      fetchSigners(selectedWallet.id)
    }
  }, [selectedWallet])

  const fetchWallets = async () => {
    try {
      const { data, error } = await supabase
        .from("multi_sig_wallets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setWallets(data || [])
      if (data && data.length > 0 && !selectedWallet) {
        setSelectedWallet(data[0])
      }
    } catch (error) {
      console.error("Error fetching wallets:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSigners = async (walletId: string) => {
    try {
      const { data, error } = await supabase
        .from("wallet_signers")
        .select("*")
        .eq("multi_sig_wallet_id", walletId)
        .order("added_at", { ascending: true })

      if (error) throw error
      setSigners(data || [])
    } catch (error) {
      console.error("Error fetching signers:", error)
    }
  }

  const createMultiSigWallet = async () => {
    try {
      // Generate mock wallet address and script hash
      const walletAddress = `addr1_multisig_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
      const scriptHash = `script_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`

      const { data: wallet, error: walletError } = await supabase
        .from("multi_sig_wallets")
        .insert({
          user_id: userId,
          wallet_name: walletName,
          required_signatures: requiredSignatures,
          total_signers: totalSigners,
          wallet_address: walletAddress,
          script_hash: scriptHash,
        })
        .select()
        .single()

      if (walletError) throw walletError

      // Add signers
      const signersData = signerAddresses
        .filter((addr) => addr.trim())
        .map((address, index) => ({
          multi_sig_wallet_id: wallet.id,
          signer_address: address.trim(),
          signer_name: `Signer ${index + 1}`,
          public_key: `pubkey_${Date.now()}_${index}`,
        }))

      if (signersData.length > 0) {
        const { error: signersError } = await supabase.from("wallet_signers").insert(signersData)

        if (signersError) throw signersError
      }

      // Reset form and refresh data
      setWalletName("")
      setRequiredSignatures(2)
      setTotalSigners(3)
      setSignerAddresses(["", "", ""])
      setIsCreateDialogOpen(false)
      fetchWallets()
    } catch (error) {
      console.error("Error creating multi-sig wallet:", error)
    }
  }

  const updateSignerAddresses = (index: number, value: string) => {
    const newAddresses = [...signerAddresses]
    newAddresses[index] = value
    setSignerAddresses(newAddresses)
  }

  const addSignerField = () => {
    setSignerAddresses([...signerAddresses, ""])
    setTotalSigners(totalSigners + 1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Multi-Signature Wallets</h2>
          <p className="text-gray-600 dark:text-gray-400">Enhanced security with multiple signature requirements</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Multi-Sig Wallet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Multi-Signature Wallet</DialogTitle>
              <DialogDescription>Set up a new multi-signature wallet for enhanced security</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletName">Wallet Name</Label>
                <Input
                  id="walletName"
                  placeholder="My Secure Wallet"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requiredSigs">Required Signatures</Label>
                  <Select
                    value={requiredSignatures.toString()}
                    onValueChange={(value) => setRequiredSignatures(Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalSigners">Total Signers</Label>
                  <Select
                    value={totalSigners.toString()}
                    onValueChange={(value) => setTotalSigners(Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Signer Addresses</Label>
                {signerAddresses.map((address, index) => (
                  <Input
                    key={index}
                    placeholder={`addr1... (Signer ${index + 1})`}
                    value={address}
                    onChange={(e) => updateSignerAddresses(index, e.target.value)}
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSignerField}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Signer
                </Button>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  This wallet will require {requiredSignatures} out of {totalSigners} signatures for any transaction.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={createMultiSigWallet}
                  disabled={!walletName || signerAddresses.filter((a) => a.trim()).length < requiredSignatures}
                >
                  Create Wallet
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {wallets.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Multi-Sig Wallets</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Create your first multi-signature wallet for enhanced security
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>Create Multi-Sig Wallet</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet List */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Your Wallets</h3>
            {wallets.map((wallet) => (
              <Card
                key={wallet.id}
                className={`cursor-pointer transition-colors ${
                  selectedWallet?.id === wallet.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => setSelectedWallet(wallet)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{wallet.wallet_name}</CardTitle>
                    {wallet.is_active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {wallet.required_signatures}/{wallet.total_signers} signatures required
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{wallet.wallet_address.slice(0, 20)}...</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Wallet Details */}
          <div className="lg:col-span-2">
            {selectedWallet && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="signers">Signers</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Shield className="h-5 w-5" />
                        <span>{selectedWallet.wallet_name}</span>
                      </CardTitle>
                      <CardDescription>Multi-signature wallet details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Required Signatures</Label>
                          <div className="text-2xl font-bold text-blue-600">{selectedWallet.required_signatures}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Total Signers</Label>
                          <div className="text-2xl font-bold text-indigo-600">{selectedWallet.total_signers}</div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Wallet Address</Label>
                        <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                          {selectedWallet.wallet_address}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Script Hash</Label>
                        <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                          {selectedWallet.script_hash}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Created</Label>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(selectedWallet.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="signers" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>Wallet Signers</span>
                      </CardTitle>
                      <CardDescription>Authorized signers for this wallet</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {signers.map((signer) => (
                          <div key={signer.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                                <Key className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-semibold">{signer.signer_name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {signer.signer_address.slice(0, 20)}...
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {signer.is_verified ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Multi-signature transaction history</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          Multi-signature transactions will appear here
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
