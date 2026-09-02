import type { ToggleableSectionId } from '@life-manager/shared';

// Mobile's own screen set — deliberately not desktop's ScreenId. No
// 'fileManager' (dropped entirely, no mobile equivalent) and no 'timeTable'
// as a standalone screen (its one thing mobile cares about — today's Clock
// view — lives directly on the Dashboard; see structure.md's Mobile section).
export type ReadOnlySectionId = Exclude<ToggleableSectionId, 'fileManager' | 'timeTable' | 'library'>;
export type MobileScreenId = 'dashboard' | 'library' | 'more' | 'settings' | ReadOnlySectionId;
