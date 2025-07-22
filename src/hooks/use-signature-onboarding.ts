import { useAuth } from '@/contexts/AuthContext';

export function useSignatureOnboarding() {
  const { currentUser } = useAuth();

  const needsSignatureOnboarding = () => {
    if (!currentUser) return false;
    // Only judges, conference chairs, and technical chairs need signatures
    const requiresSignature = currentUser.role === 'judge' || currentUser.role === 'conference-chair' || currentUser.role === 'technical-chair';
    if (!requiresSignature) return false;
    const hasCompletedOnboarding = currentUser.signatureOnboardingComplete === true;
    const hasExistingSignature = currentUser.signature?.data;
    return !hasCompletedOnboarding && !hasExistingSignature;
  };

  return {
    needsSignatureOnboarding: needsSignatureOnboarding(),
    isJudgeOrChair: currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair',
    hasSignature: !!currentUser?.signature?.data,
    currentUser
  };
} 