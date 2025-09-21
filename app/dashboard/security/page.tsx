import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { GaslessTransactionManager } from "@/components/security/gasless-transaction-manager"
import { MultiSigWalletManager } from "@/components/security/multi-sig-wallet-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Zap } from "lucide-react"

export default async function SecurityPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={data.user} profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security Center</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage gasless transactions and multi-signature wallets
          </p>
        </div>

        <Tabs defaultValue="gasless" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gasless" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Gasless Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="multisig" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Multi-Signature Wallets</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gasless" className="mt-6">
            <GaslessTransactionManager userId={data.user.id} />
          </TabsContent>

          <TabsContent value="multisig" className="mt-6">
            <MultiSigWalletManager userId={data.user.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
