import { Card, CardContent, CardHeader, CardTitle, ThemeToggle } from '@life-manager/ui';
import { Cloud } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import type { MobileScreenId } from '../navigation';

export function MobileSettingsScreen({ onNavigate }: { onNavigate: (s: MobileScreenId) => void }) {
  return (
    <div>
      <SectionHeader title="Settings" onBack={() => onNavigate('more')} />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud size={15} className="text-muted" />
              Google Drive sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Not wired up yet on mobile — this is planned next, using the same Drive backup desktop already writes to.
              For now, this app's data stays local to this device.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
