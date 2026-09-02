// TS wrapper for the app-local native plugin at
// android/app/src/main/java/com/pakcyberbot/lifemanager/LocalFileOpenerPlugin.java
// — see that file for the full rationale (opens a file already on this
// device — a PDF added via Library — with whatever app the user picks, via
// Android's FileProvider + ACTION_VIEW, since a plain file:// path isn't
// shareable to another app's Intent on modern Android).

import { registerPlugin, type Plugin } from '@capacitor/core';

export interface LocalFileOpenerPlugin extends Plugin {
  openFile(options: { path: string; mimeType?: string }): Promise<void>;
}

export const LocalFileOpener = registerPlugin<LocalFileOpenerPlugin>('LocalFileOpener');
