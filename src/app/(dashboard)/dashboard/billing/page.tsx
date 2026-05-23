import type { Metadata } from 'next';
import { CreditCard } from 'lucide-react';
import { EmptyState } from '@/components/states/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Plan, usage and invoices. You're on the free plan during the beta."
      />
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          icon={<CreditCard className="h-8 w-8" aria-hidden />}
          title="Free plan — upgrade in Phase 11"
          description="Stripe metered billing wires up in Phase 11. For now everything is on the house."
        />
      </div>
    </>
  );
}
