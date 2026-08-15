import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Package,
  AlertTriangle,
  Plus,
  Calendar,
  Clock
} from 'lucide-react';
import FoodExpiryTracker from './FoodExpiryTracker';
import { useFoodExpiryTracker } from '../hooks/useFoodExpiryTracker';

interface FoodExpiryTrackerButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

const FoodExpiryTrackerButton: React.FC<FoodExpiryTrackerButtonProps> = ({
  className = '',
  variant = 'outline',
  size = 'default'
}) => {
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const { foodItems, statistics, getExpiringSoon, getExpired } = useFoodExpiryTracker();
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);

  // Update counts when food items change
  React.useEffect(() => {
    const updateCounts = async () => {
      const expiring = await getExpiringSoon(3);
      const expired = await getExpired();
      setExpiringSoonCount(expiring.length);
      setExpiredCount(expired.length);
    };

    updateCounts();
  }, [foodItems, getExpiringSoon, getExpired]);

  const buttonSizeClasses = {
    sm: 'h-8 px-2 text-xs',
    default: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    default: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const hasAlerts = expiringSoonCount > 0 || expiredCount > 0;

  return (
    <>
      <div className="relative">
        <Button
          variant={hasAlerts ? 'destructive' : variant}
          size={size}
          onClick={() => setIsTrackerOpen(true)}
          className={`relative ${className} ${buttonSizeClasses[size]}`}
        >
          <Package className={`${iconSizeClasses[size]} mr-2`} />
          Food Tracker

          {/* Alert badges */}
          {(expiringSoonCount > 0 || expiredCount > 0) && (
            <div className="absolute -top-2 -right-2 flex gap-1">
              {expiringSoonCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full"
                >
                  {expiringSoonCount}
                </Badge>
              )}
              {expiredCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full bg-red-600"
                >
                  {expiredCount}
                </Badge>
              )}
            </div>
          )}
        </Button>

        {/* Tooltip with quick stats */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              <span>Total: {statistics?.total || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-yellow-400" />
              <span>Expiring: {expiringSoonCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>Expired: {expiredCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Food Expiry Tracker Modal */}
      <FoodExpiryTracker
        isActive={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
      />
    </>
  );
};

export default FoodExpiryTrackerButton;
