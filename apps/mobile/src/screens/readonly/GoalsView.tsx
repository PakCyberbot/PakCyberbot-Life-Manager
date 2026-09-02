import { useEffect } from 'react';
import { useGoalsStore } from '@life-manager/core';
import { formatDate } from '@life-manager/shared';
import { Card, CardContent, CardHeader, CardTitle, Badge, ProgressBar, EmptyState } from '@life-manager/ui';
import { Target } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

export function GoalsView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { goals, fetchGoals, loaded } = useGoalsStore();

  useEffect(() => {
    if (!loaded) fetchGoals();
  }, [loaded, fetchGoals]);

  return (
    <div>
      <SectionHeader title="Goals" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={24} />} title="No goals yet" description="Set some up on desktop and sync." />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle>{g.title}</CardTitle>
                <Badge tone={g.status === 'active' ? 'goals' : g.status === 'completed' ? 'success' : 'default'} className="capitalize">
                  {g.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.description && <p className="text-sm text-muted">{g.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="capitalize">{g.type.replace('-', ' ')}</span>
                  {g.targetDate && <span>Due {formatDate(g.targetDate)}</span>}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">Progress</span>
                    <span className="font-medium">{g.progressPct}%</span>
                  </div>
                  <ProgressBar value={g.progressPct} toneClassName="bg-accentGoals" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
