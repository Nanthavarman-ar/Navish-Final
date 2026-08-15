import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useSubscription, PLANS, SubscriptionPlan, PlanTier, PlanDuration } from '../contexts/SubscriptionContext';
import { Check, CreditCard, Shield } from 'lucide-react';

const TIER_COLORS: Record<PlanTier, string> = {
  silver: 'border-slate-400 bg-slate-800/50',
  gold: 'border-amber-400 bg-amber-900/20',
  platinum: 'border-cyan-400 bg-cyan-900/20',
};

const TIER_BADGE: Record<PlanTier, string> = {
  silver: 'bg-slate-500',
  gold: 'bg-amber-600',
  platinum: 'bg-cyan-600',
};

export function PlanSelection() {
  const { plans, processPayment, isPaymentProcessing } = useSubscription();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleCheckout = async () => {
    if (!selectedPlanId) return;
    const success = await processPayment(selectedPlanId);
    if (success) setPaymentSuccess(true);
  };

  const byTier = (tier: PlanTier) => plans.filter(p => p.tier === tier);
  const durations: PlanDuration[] = ['hourly', 'daily', 'monthly', 'unlimited'];

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
        <p className="text-gray-400 mt-2">Secure payment · Upload 3D models after purchase</p>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-green-500" /> SSL Secured</span>
          <span className="flex items-center gap-1"><CreditCard className="w-4 h-4" /> Safe Payment</span>
        </div>
      </div>

      {paymentSuccess ? (
        <Card className="bg-green-900/30 border-green-600 max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Payment Complete</h3>
            <p className="text-gray-300">You can now upload 3D models. Go to Upload to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {(['silver', 'gold', 'platinum'] as PlanTier[]).map(tier => (
            <div key={tier}>
              <h3 className="text-lg font-semibold text-white mb-4 capitalize flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${TIER_BADGE[tier]}`} />
                {tier}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {byTier(tier).map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlanId === plan.id}
                    onSelect={() => setSelectedPlanId(plan.id)}
                    tierColor={TIER_COLORS[tier]}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col items-center gap-4 pt-6">
            <Button
              onClick={handleCheckout}
              disabled={!selectedPlanId || isPaymentProcessing}
              className="bg-cyan-600 hover:bg-cyan-700 px-8"
            >
              {isPaymentProcessing ? 'Processing...' : `Pay ${selectedPlanId ? PLANS.find(p => p.id === selectedPlanId)?.price : ''} ${selectedPlanId ? PLANS.find(p => p.id === selectedPlanId)?.currency : ''}`}
            </Button>
            <p className="text-xs text-gray-500">You will be redirected to secure checkout to complete payment.</p>
          </div>
        </>
      )}
    </div>
  );
}

function PlanCard({ plan, isSelected, onSelect, tierColor }: {
  plan: SubscriptionPlan;
  isSelected: boolean;
  onSelect: () => void;
  tierColor: string;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all ${tierColor} ${isSelected ? 'ring-2 ring-cyan-400' : 'hover:border-slate-500'}`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">{plan.label}</CardTitle>
        <CardDescription className="text-gray-400 text-sm">{plan.durationLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-bold text-white">
          ${plan.price} <span className="text-sm font-normal text-gray-400">USD</span>
        </div>
        <ul className="space-y-1 text-sm text-gray-300">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={e => { e.stopPropagation(); onSelect(); }}
        >
          {isSelected ? 'Selected' : 'Select'}
        </Button>
      </CardContent>
    </Card>
  );
}
