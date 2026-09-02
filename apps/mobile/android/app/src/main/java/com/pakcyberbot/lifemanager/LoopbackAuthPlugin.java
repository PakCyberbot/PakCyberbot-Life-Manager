package com.pakcyberbot.lifemanager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * A tiny loopback HTTP listener for Google's installed-app OAuth flow (RFC
 * 8252) — the exact same technique apps/desktop/electron/driveSync.ts uses
 * (a real http.createServer there), just re-implemented natively since a
 * WebView/JS context can't bind a raw listening socket. Kept app-local (not
 * a published plugin package) per Capacitor's own documented pattern for
 * custom native code scoped to one app.
 *
 * Single-shot: accepts exactly one connection (Google's redirect after
 * consent), parses the query string off the raw request line, writes back
 * the same plain HTML response driveSync.ts's server sends, emits the
 * parsed params as a "redirect" event, then shuts itself down.
 */
@CapacitorPlugin(name = "LoopbackAuth")
public class LoopbackAuthPlugin extends Plugin {
    private ServerSocket serverSocket;

    @PluginMethod
    public void start(PluginCall call) {
        stopServer();
        try {
            ServerSocket socket = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
            serverSocket = socket;
            int port = socket.getLocalPort();

            new Thread(() -> runServer(socket)).start();

            JSObject ret = new JSObject();
            ret.put("port", port);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not start loopback server", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopServer();
        call.resolve();
    }

    // Runs on a background thread — accept() blocks until Google's redirect
    // actually arrives (or the socket is closed out from under it by stop(),
    // e.g. on timeout, at which point accept() throws and we just report
    // that rather than treating it as a real error).
    private void runServer(ServerSocket socket) {
        JSObject result = new JSObject();
        try {
            Socket client = socket.accept();
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
            String requestLine = reader.readLine();
            if (requestLine == null) requestLine = "";

            // e.g. "GET /?code=4/0Ax...&scope=... HTTP/1.1"
            String path = "/";
            String[] parts = requestLine.split(" ");
            if (parts.length > 1) path = parts[1];

            Map<String, String> params = new HashMap<>();
            int qIndex = path.indexOf('?');
            if (qIndex >= 0) {
                String query = path.substring(qIndex + 1);
                for (String pair : query.split("&")) {
                    if (pair.isEmpty()) continue;
                    String[] kv = pair.split("=", 2);
                    String key = URLDecoder.decode(kv[0], "UTF-8");
                    String value = kv.length > 1 ? URLDecoder.decode(kv[1], "UTF-8") : "";
                    params.put(key, value);
                }
            }

            boolean hasError = params.containsKey("error");
            String body = hasError
                ? "Sign-in was cancelled. You can close this tab."
                : "Connected — you can close this tab and return to the app.";
            String html = "<html><head><meta charset=\"utf-8\"></head><body>" + body + "</body></html>";
            byte[] htmlBytes = html.getBytes(StandardCharsets.UTF_8);
            String response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: text/html; charset=utf-8\r\n"
                + "Content-Length: " + htmlBytes.length + "\r\n"
                + "Connection: close\r\n\r\n" + html;

            OutputStream out = client.getOutputStream();
            out.write(response.getBytes(StandardCharsets.UTF_8));
            out.flush();
            client.close();

            if (params.containsKey("code")) result.put("code", params.get("code"));
            if (hasError) result.put("error", params.get("error"));
        } catch (Exception e) {
            result.put("error", e.getMessage() != null ? e.getMessage() : "Loopback server error");
        } finally {
            notifyListeners("redirect", result);
            stopServer();
        }
    }

    private void stopServer() {
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (Exception ignored) {
                // already closed
            }
            serverSocket = null;
        }
    }
}
