import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CreateTokenForm } from "@/components/token/create-token-form"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default async function CreateTokenPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={data.user} profile={profile} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Token</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create a new Cardano native token with advanced minting policies
          </p>
        </div>

        <CreateTokenForm userId={data.user.id} />
      </main>
    </div>
  )
}
