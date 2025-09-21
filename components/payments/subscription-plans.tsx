"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Zap, Building } from "lucide-react"
import { toast } from "sonner"

interface SubscriptionPlan {
  id: string
  stripe_price_id: string
  name: string
  description: string
  price_cents: number
  currency: string
  interval: string
  features: string[]
  is_active: boolean
}

interface UserSubscription {
  id: string
  status: string
  subscription_plans: SubscriptionPlan
}

export function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscriptionsAvailable, setIsSubscriptionsAvailable] = useState(true)

  useEffect(() => {
    fetchPlans()
    fetchCurrentSubscription()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/payments/plans")
      const data = await response.json()

      if (response.status === 503) {
        setIsSubscriptionsAvailable(false)
        return
      }

      setPlans(data.plans || [])
    } catch (error) {
      console.error("Error fetching plans:", error)
      setIsSubscriptionsAvailable(false)
    }
  }

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch("/api/payments/subscriptions")
      const data = await response.json()
      setCurrentSubscription(data.subscription)
    } catch (error) {
      console.error("Error fetching subscription:", error)
    }
  }

  const handleSubscribe = async (priceId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/payments/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ price_id: priceId }),
      })

      const { client_secret, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // In a real implementation, you would redirect to Stripe Checkout
      // or handle the payment confirmation here
      toast.success("Subscription created! Please complete payment.")
    } catch (error) {
      console.error("Subscription error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create subscription")
    } finally {
      setIsLoading(false)
    }
  }

  const getPlanIcon = (planName: string) => {
    if (planName.toLowerCase().includes("basic")) return <Zap className="h-6 w-6" />
    if (planName.toLowerCase().includes("pro")) return <Crown className="h-6 w-6" />
    if (planName.toLowerCase().includes("enterprise")) return <Building className="h-6 w-6" />
    return <Zap className="h-6 w-6" />
  }

  const isCurrentPlan = (priceId: string) => {
    return currentSubscription?.subscription_plans?.stripe_price_id === priceId
  }

  if (!isSubscriptionsAvailable) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Subscription services are currently unavailable. Please contact support.
          </p>
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Payment processing is not configured. Please contact support to set up subscriptions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Choose Your Plan</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Unlock advanced features and scale your token operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.name.toLowerCase().includes("pro")
                ? "border-blue-500 shadow-lg scale-105"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            {plan.name.toLowerCase().includes("pro") && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white">Most Popular</Badge>
              </div>
            )}

            <CardHeader className="text-center">
              <div className="flex justify-center mb-4 text-blue-600">{getPlanIcon(plan.name)}</div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-3xl font-bold">${(plan.price_cents / 100).toFixed(0)}</span>
                <span className="text-gray-600 dark:text-gray-400">/{plan.interval}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={isCurrentPlan(plan.stripe_price_id) ? "secondary" : "default"}
                disabled={isLoading || isCurrentPlan(plan.stripe_price_id)}
                onClick={() => handleSubscribe(plan.stripe_price_id)}
              >
                {isCurrentPlan(plan.stripe_price_id) ? "Current Plan" : `Subscribe to ${plan.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {currentSubscription && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Manage your active subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{currentSubscription.subscription_plans.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status: <Badge variant="secondary">{currentSubscription.status}</Badge>
                </p>
              </div>
              <Button variant="outline">Manage Subscription</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
