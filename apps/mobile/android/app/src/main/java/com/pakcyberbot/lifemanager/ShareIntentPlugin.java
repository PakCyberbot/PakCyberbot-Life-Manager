package com.pakcyberbot.lifemanager;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Captures Android's own Share sheet (e.g. Chrome/YouTube's "Share" ->
 * plain text/URL) so this app shows up as a share target — see
 * AndroidManifest.xml's second <intent-filter> on MainActivity
 * (android.intent.action.SEND, text/plain). Two paths, since a share can
 * either cold-start the app or arrive while it's already running:
 *
 * - Cold start: getInitialSharedText() reads whatever Intent MainActivity
 *   was actually launched with.
 * - Already running: MainActivity has launchMode="singleTask", so a second
 *   share arrives via Activity#onNewIntent rather than a new instance.
 *   Capacitor's own BridgeActivity#onNewIntent already calls
 *   Bridge#onNewIntent, which calls every registered plugin's
 *   handleOnNewIntent(Intent) automatically — confirmed by reading
 *   BridgeActivity.java/Bridge.java source directly rather than assuming,
 *   same discipline as this project's other "verify against real installed
 *   code" checks — so no manual onNewIntent override is needed in
 *   MainActivity itself, just this override here.
 *
 * Kept app-local per Capacitor's own documented pattern for custom native
 * code scoped to one app, same as LoopbackAuthPlugin/LocalFileOpenerPlugin.
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    @PluginMethod
    public void getInitialSharedText(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", extractSharedText(getActivity().getIntent()));
        call.resolve(ret);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        // Android does not update Activity#getIntent() on its own after onNewIntent — set it
        // explicitly so any later getInitialSharedText() call (or another plugin) sees the latest one.
        getActivity().setIntent(intent);

        String text = extractSharedText(intent);
        if (text != null) {
            JSObject result = new JSObject();
            result.put("text", text);
            notifyListeners("shared", result);
        }
    }

    private String extractSharedText(Intent intent) {
        if (intent == null) return null;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return null;
        if (!"text/plain".equals(intent.getType())) return null;
        return intent.getStringExtra(Intent.EXTRA_TEXT);
    }
}
