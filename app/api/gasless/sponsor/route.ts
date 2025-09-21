import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { transaction_id, estimated_fee } = body

    // Validate transaction exists and belongs to user
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .eq("user_id", user.id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Check security policies
    const { data: policies } = await supabase
      .from("security_policies")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)

    // Validate against rate limits and amount limits
    for (const policy of policies || []) {
      if (policy.policy_type === "rate_limit") {
        const config = policy.policy_config as any
        const { data: recentTxs } = await supabase
          .from("gasless_transactions")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString())

        if ((recentTxs?.length || 0) >= config.max_transactions) {
          return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        }
      }
    }

    // Generate nonce
    const { data: nonceResult } = await supabase.rpc("generate_transaction_nonce", {
      user_uuid: user.id,
    })

    const nonce = nonceResult || 1

    // Create gasless transaction record
    const { data: gaslessTransaction, error: gaslessError } = await supabase
      .from("gasless_transactions")
      .insert({
        user_id: user.id,
        transaction_id: transaction_id,
        sponsor_address: "addr1_kepka_sponsor_treasury_address",
        gas_fee_ada: estimated_fee,
        status: "sponsored",
        nonce: nonce,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      })
      .select()
      .single()

    if (gaslessError) {
      throw gaslessError
    }

    // In a real implementation, this would interact with Cardano blockchain
    console.log("Transaction sponsored:", {
      transactionId: transaction_id,
      gaslessId: gaslessTransaction.id,
      fee: estimated_fee,
      nonce: nonce,
    })

    return NextResponse.json({
      success: true,
      gasless_transaction_id: gaslessTransaction.id,
      sponsor_address: gaslessTransaction.sponsor_address,
      nonce: nonce,
      expires_at: gaslessTransaction.expires_at,
    })
  } catch (error) {
    console.error("Error sponsoring transaction:", error)
    return NextResponse.json({ error: "Failed to sponsor transaction" }, { status: 500 })
  }
}
