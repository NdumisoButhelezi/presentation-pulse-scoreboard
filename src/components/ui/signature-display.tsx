import { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { PenTool, User as UserIcon } from 'lucide-react';

interface SignatureDisplayProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function SignatureDisplay({ user, size = 'md', showLabel = true, className = '' }: SignatureDisplayProps) {
  if (!user.signature?.data) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-h-12',
    md: 'max-h-16',
    lg: 'max-h-24'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <PenTool className="h-3 w-3" />
          <span>Signature:</span>
        </div>
      )}
      <div className="flex items-center space-x-2">
        <img
          src={user.signature.data}
          alt={`${user.name}'s signature`}
          className={`border border-gray-200 rounded bg-white ${sizeClasses[size]}`}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
        />
        <Badge variant="outline" className="text-xs">
          Digital
        </Badge>
      </div>
    </div>
  );
} 