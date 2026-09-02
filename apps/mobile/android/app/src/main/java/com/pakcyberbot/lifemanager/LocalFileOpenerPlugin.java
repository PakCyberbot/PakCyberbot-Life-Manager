package com.pakcyberbot.lifemanager;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Opens a file already on this device with whatever app the user picks (a
 * PDF viewer, typically) — the mobile equivalent of desktop's
 * shell.openPath "let the OS decide" behavior (see main.ts's
 * system:openLocalPath). Used for PDFs added via Library's "Add book" flow
 * (MobileLibraryScreen.tsx's NewBookDialog), which writes into app-private
 * storage via @capacitor/filesystem's Directory.DATA — a plain file:// path
 * isn't shareable to another app's Intent on modern Android, so this wraps
 * it in a content:// URI via the FileProvider already declared in
 * AndroidManifest.xml (res/xml/file_paths.xml's <files-path> entry covers
 * Directory.DATA's location, Context.getFilesDir()).
 *
 * Kept app-local per Capacitor's own documented pattern for custom native
 * code scoped to one app, same as LoopbackAuthPlugin.
 */
@CapacitorPlugin(name = "LocalFileOpener")
public class LocalFileOpenerPlugin extends Plugin {

    @PluginMethod
    public void openFile(PluginCall call) {
        String path = call.getString("path");
        String mimeType = call.getString("mimeType", "application/pdf");

        if (path == null || path.isEmpty()) {
            call.reject("No path given.");
            return;
        }

        File file = new File(path);
        if (!file.exists()) {
            call.reject("File does not exist on this device: " + path);
            return;
        }

        try {
            Context context = getContext();
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(uri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(viewIntent, "Open with");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            call.resolve();
        } catch (Exception e) {
            call.reject("No app on this device can open that file type.", e);
        }
    }
}
