import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TokenOverview } from "@/components/dashboard/token-overview"
import { ExchangeRatesWidget } from "@/components/dashboard/exchange-rates-widget"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { PortfolioChart } from "@/components/dashboard/portfolio-chart"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  // Fetch user's tokens
  const { data: tokens } = await supabase
    .from("tokens")
    .select("*")
    .eq("creator_id", data.user.id)
    .order("created_at", { ascending: false })

  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      *,
      tokens (token_name, symbol)
    `)
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={data.user} profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <TokenOverview tokens={tokens || []} />
            <PortfolioChart />
            <RecentTransactions transactions={transactions || []} />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <ExchangeRatesWidget />
          </div>
        </div>
      </main>
    </div>
  )
}
