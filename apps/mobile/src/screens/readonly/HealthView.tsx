import { useEffect } from 'react';
import { useHealthStore } from '@life-manager/core';
import { DAY_NAMES, formatDate } from '@life-manager/shared';
import { Card, EmptyState } from '@life-manager/ui';
import { HeartPulse } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { MobileScreenId } from '../../navigation';

export function HealthView({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  const { exercises, appointments, foods, metrics, fetchAll, loaded } = useHealthStore();

  useEffect(() => {
    if (!loaded) fetchAll();
  }, [loaded, fetchAll]);

  const todayDayOfWeek = new Date().getDay();
  const todayExercises = exercises.filter((e) => e.daysOfWeek.split(',').map(Number).includes(todayDayOfWeek));
  const upcomingAppointments = appointments
    .filter((a) => new Date(a.appointmentAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.appointmentAt).getTime() - new Date(b.appointmentAt).getTime());
  const latestMetric = [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const empty = exercises.length === 0 && appointments.length === 0 && foods.length === 0 && metrics.length === 0;

  return (
    <div>
      <SectionHeader title="Health" subtitle="View only — manage from desktop" onBack={() => onNavigate('more')} />
      {empty ? (
        <EmptyState icon={<HeartPulse size={24} />} title="No health data yet" />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted">Today's exercises — {DAY_NAMES[todayDayOfWeek]}</h2>
            {todayExercises.length === 0 ? (
              <p className="text-xs text-muted">Nothing scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {todayExercises.map((e) => (
                  <Card key={e.id} className="flex items-center justify-between p-3">
                    <span className="text-sm font-medium">{e.name}</span>
                    <span className="text-xs capitalize text-muted">
                      {e.durationMinutes ? `${e.durationMinutes}m` : e.sets && e.reps ? `${e.sets}×${e.reps}` : e.category}
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted">Upcoming appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-muted">Nothing upcoming.</p>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.slice(0, 5).map((a) => (
                  <Card key={a.id} className="p-3">
                    <p className="text-sm font-medium">{a.doctorName}</p>
                    <p className="text-xs text-muted">
                      {a.specialty && `${a.specialty} · `}
                      {formatDate(a.appointmentAt)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {latestMetric && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Latest weight</h2>
              <Card className="p-3">
                <p className="text-lg font-semibold">
                  {latestMetric.weight} {latestMetric.unit}
                </p>
                <p className="text-xs text-muted">{formatDate(latestMetric.date)}</p>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
