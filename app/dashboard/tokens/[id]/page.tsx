import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { MintBurnInterface } from "@/components/token/mint-burn-interface"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TokenPageProps {
  params: Promise<{ id: string }>
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  // Fetch token details
  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .select("*")
    .eq("id", id)
    .eq("creator_id", data.user.id)
    .single()

  if (tokenError || !token) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={data.user} profile={profile} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Token</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Mint new tokens or burn existing ones for {token.token_name}
          </p>
        </div>

        <MintBurnInterface token={token} userId={data.user.id} />
      </main>
    </div>
  )
}
