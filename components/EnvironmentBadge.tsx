'use client';

/**
 * Environment Badge Component
 *
 * Displays the current environment (development/staging/production)
 * with appropriate color coding.
 */

import { useEffect, useState } from 'react';
import { Server, AlertCircle } from 'lucide-react';

interface EnvironmentInfo {
  environment: string;
  maintenanceMode: boolean;
}

interface EnvironmentBadgeProps {
  variant?: 'compact' | 'full';
  showIcon?: boolean;
  className?: string;
}

export default function EnvironmentBadge({
  variant = 'compact',
  showIcon = true,
  className = '',
}: EnvironmentBadgeProps) {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo>({
    environment: 'development',
    maintenanceMode: false,
  });

  useEffect(() => {
    const fetchEnvInfo = async () => {
      try {
        const res = await fetch('/api/admin/system');
        const data = await res.json();
        if (data.success && data.data?.config) {
          setEnvInfo({
            environment: data.data.config.environment,
            maintenanceMode: data.data.config.maintenanceMode,
          });
        }
      } catch (error) {
        // Use default values if fetch fails
        console.error('Failed to fetch environment info:', error);
      }
    };

    fetchEnvInfo();
  }, []);

  const getStyles = () => {
    switch (envInfo.environment) {
      case 'production':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          border: 'border-red-300',
          dot: 'bg-red-500',
          label: 'PRODUCTION',
        };
      case 'staging':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-300',
          dot: 'bg-yellow-500',
          label: 'STAGING',
        };
      default:
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          border: 'border-green-300',
          dot: 'bg-green-500',
          label: 'DEVELOPMENT',
        };
    }
  };

  const styles = getStyles();

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${styles.bg} ${styles.text} ${className}`}
      >
        <span className={`w-2 h-2 rounded-full ${styles.dot} ${envInfo.maintenanceMode ? 'animate-pulse' : ''}`} />
        {styles.label.slice(0, 3)}
        {envInfo.maintenanceMode && (
          <AlertCircle className="w-3 h-3 ml-1" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      {showIcon && <Server className="w-4 h-4" />}
      <span className="font-semibold text-sm">{styles.label}</span>
      {envInfo.maintenanceMode && (
        <span className="flex items-center gap-1 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
          <AlertCircle className="w-3 h-3" />
          Maintenance
        </span>
      )}
    </div>
  );
}
