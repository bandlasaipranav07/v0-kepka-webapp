import { createClient } from "@/lib/supabase/server"
import { stripe, getStripeCustomerByEmail, createStripeCustomer, createSubscription } from "@/lib/stripe"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's subscription
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Subscription processing is not available. Please contact support." },
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
    const { price_id } = body

    if (!price_id) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 })
    }

    // Get or create Stripe customer
    let customer = await getStripeCustomerByEmail(user.email!)
    if (!customer) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

      customer = await createStripeCustomer(user.email!, profile?.full_name)
    }

    // Create subscription
    const subscription = await createSubscription(customer.id, price_id, { user_id: user.id })

    // Store subscription in database
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("stripe_price_id", price_id)
      .single()

    await supabase.from("user_subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      plan_id: plan?.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })

    const invoice = subscription.latest_invoice as any
    const paymentIntent = invoice?.payment_intent

    return NextResponse.json({
      subscription_id: subscription.id,
      client_secret: paymentIntent?.client_secret,
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
  }
}
