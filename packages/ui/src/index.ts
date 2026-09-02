export { App } from './App';

// Reusable pieces with zero platform coupling — pulled in directly by
// apps/mobile (which builds its own screens rather than reusing desktop's,
// but shares these building blocks). See structure.md's Mobile section.
export { ThemeProvider } from './theme/ThemeProvider';
export { ThemeToggle } from './theme/ThemeToggle';
export { TimeTableClock } from './components/timetable/ClockView';
export { LiveRotatingClock } from './components/timetable/LiveRotatingClock';
export { renderPdfCoverFromBase64 } from './lib/pdfCover';
export { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
export { Badge } from './components/ui/Badge';
export { Button } from './components/ui/Button';
export { EmptyState } from './components/ui/EmptyState';
export { ProgressBar } from './components/ui/ProgressBar';
export { Dialog } from './components/ui/Dialog';
export { Label, Input, Textarea, Select, Field } from './components/ui/FormControls';
export { Switch } from './components/ui/Switch';
