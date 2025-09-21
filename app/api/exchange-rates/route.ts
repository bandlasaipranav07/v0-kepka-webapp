import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: rates, error } = await supabase
      .from("exchange_rates")
      .select("*")
      .order("updated_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(rates)
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    return NextResponse.json({ error: "Failed to fetch exchange rates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase.from("exchange_rates").upsert(body, { onConflict: "token_symbol" }).select()

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating exchange rates:", error)
    return NextResponse.json({ error: "Failed to update exchange rates" }, { status: 500 })
  }
}
