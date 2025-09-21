import { createClient } from "@/lib/supabase/server"
import { stripe, getStripeCustomerByEmail, createStripeCustomer } from "@/lib/stripe"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment processing is not available. Please contact support." },
        { status: 503 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { amount, currency = "usd", description, metadata = {} } = body

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Amount must be at least $0.50" }, { status: 400 })
    }

    // Get or create Stripe customer
    let customer = await getStripeCustomerByEmail(user.email!)
    if (!customer) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

      customer = await createStripeCustomer(user.email!, profile?.full_name)
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customer.id,
      description,
      metadata: {
        user_id: user.id,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Store transaction in database
    const { error: dbError } = await supabase.from("payment_transactions").insert({
      user_id: user.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "pending",
      description,
      metadata,
    })

    if (dbError) {
      console.error("Error storing payment transaction:", dbError)
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
}
