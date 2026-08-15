import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiCall } from '../hooks/useApi';

export type PlanTier = 'silver' | 'gold' | 'platinum';
export type PlanDuration = 'hourly' | 'daily' | 'monthly' | 'unlimited';

export interface SubscriptionPlan {
  id: string;
  tier: PlanTier;
  duration: PlanDuration;
  label: string;
  price: number;
  currency: string;
  uploadLimit: number; // -1 = unlimited
  features: string[];
  durationLabel: string;
}

export interface UserSubscription {
  planId: string;
  tier: PlanTier;
  duration: PlanDuration;
  startDate: string;
  endDate: string | null; // null = unlimited
  status: 'active' | 'expired' | 'cancelled';
  uploadsUsed: number;
  uploadLimit: number; // -1 = unlimited
}

export const PLANS: SubscriptionPlan[] = [
  { id: 'single-upload', tier: 'silver', duration: 'unlimited', label: 'Single Upload (One-Time)', price: 9.99, currency: 'USD', uploadLimit: 1, features: ['1 model upload', 'One-time payment'], durationLabel: 'One-time' },
  { id: 'silver-hourly', tier: 'silver', duration: 'hourly', label: 'Silver Hourly', price: 2.99, currency: 'USD', uploadLimit: 3, features: ['3 model uploads', '1 hour access'], durationLabel: '1 hour' },
  { id: 'silver-daily', tier: 'silver', duration: 'daily', label: 'Silver Daily', price: 9.99, currency: 'USD', uploadLimit: 10, features: ['10 model uploads', '24 hours access'], durationLabel: '1 day' },
  { id: 'silver-monthly', tier: 'silver', duration: 'monthly', label: 'Silver Monthly', price: 29.99, currency: 'USD', uploadLimit: 50, features: ['50 model uploads', '30 days access'], durationLabel: '30 days' },
  { id: 'silver-unlimited', tier: 'silver', duration: 'unlimited', label: 'Silver Unlimited', price: 99.99, currency: 'USD', uploadLimit: 200, features: ['200 model uploads', 'Lifetime access'], durationLabel: 'Unlimited' },
  { id: 'gold-hourly', tier: 'gold', duration: 'hourly', label: 'Gold Hourly', price: 4.99, currency: 'USD', uploadLimit: 10, features: ['10 model uploads', 'Priority support'], durationLabel: '1 hour' },
  { id: 'gold-daily', tier: 'gold', duration: 'daily', label: 'Gold Daily', price: 19.99, currency: 'USD', uploadLimit: 50, features: ['50 model uploads', 'Priority support'], durationLabel: '1 day' },
  { id: 'gold-monthly', tier: 'gold', duration: 'monthly', label: 'Gold Monthly', price: 59.99, currency: 'USD', uploadLimit: 200, features: ['200 model uploads', 'Priority support', 'API access'], durationLabel: '30 days' },
  { id: 'gold-unlimited', tier: 'gold', duration: 'unlimited', label: 'Gold Unlimited', price: 199.99, currency: 'USD', uploadLimit: -1, features: ['Unlimited uploads', 'Priority support', 'API access'], durationLabel: 'Unlimited' },
  { id: 'platinum-hourly', tier: 'platinum', duration: 'hourly', label: 'Platinum Hourly', price: 9.99, currency: 'USD', uploadLimit: 25, features: ['25 model uploads', '24/7 support'], durationLabel: '1 hour' },
  { id: 'platinum-daily', tier: 'platinum', duration: 'daily', label: 'Platinum Daily', price: 39.99, currency: 'USD', uploadLimit: 100, features: ['100 model uploads', '24/7 support'], durationLabel: '1 day' },
  { id: 'platinum-monthly', tier: 'platinum', duration: 'monthly', label: 'Platinum Monthly', price: 119.99, currency: 'USD', uploadLimit: 500, features: ['500 model uploads', '24/7 support', 'Dedicated account manager'], durationLabel: '30 days' },
  { id: 'platinum-unlimited', tier: 'platinum', duration: 'unlimited', label: 'Platinum Unlimited', price: 499.99, currency: 'USD', uploadLimit: -1, features: ['Unlimited uploads', '24/7 support', 'Dedicated account manager', 'Custom integrations'], durationLabel: 'Unlimited' },
];

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  canUpload: boolean;
  plans: SubscriptionPlan[];
  selectPlan: (planId: string) => void;
  processPayment: (planId: string) => Promise<boolean>;
  incrementUploadsUsed: () => void;
  refreshSubscription: () => void;
  isPaymentProcessing: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  const refreshSubscription = useCallback(() => {
    const fetchSubscription = async () => {
      if (!user?.id) {
        setSubscription(null);
        return;
      }

      try {
        const response = await apiCall('/billing/subscription');
        const serverSubscription = response?.subscription as UserSubscription | null;
        setSubscription(serverSubscription);
      } catch {
        setSubscription(null);
      }
    };

    fetchSubscription().catch(() => {
      setSubscription(null);
    });
  }, [user?.id]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const canUpload = user?.role === 'admin' || (user?.role === 'client' && subscription?.status === 'active' && (subscription.uploadsUsed < subscription.uploadLimit || subscription.uploadLimit === -1));

  const selectPlan = useCallback((_planId: string) => {
    // Navigate to checkout / payment - handled by UI
  }, []);

  const processPayment = useCallback(async (planId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return false;

    setIsPaymentProcessing(true);
    try {
      const checkoutResponse = await apiCall('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planId,
          tier: plan.tier,
          duration: plan.duration,
          successUrl: `${window.location.origin}/client/upload`,
          cancelUrl: `${window.location.origin}/client/upload`
        })
      });

      const checkoutUrl: string | undefined = checkoutResponse?.checkoutUrl;
      if (!checkoutUrl) {
        return false;
      }

      window.location.assign(checkoutUrl);
      return true;
    } catch {
      return false;
    } finally {
      setIsPaymentProcessing(false);
    }
  }, [user?.id]);

  const value: SubscriptionContextType = {
    subscription,
    canUpload: !!canUpload,
    plans: PLANS,
    selectPlan,
    processPayment,
    incrementUploadsUsed: () => {
      if (!user?.id || !subscription) return;
      apiCall('/billing/usage/increment', { method: 'POST' })
        .then(() => refreshSubscription())
        .catch(() => undefined);
    },
    refreshSubscription,
    isPaymentProcessing,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
