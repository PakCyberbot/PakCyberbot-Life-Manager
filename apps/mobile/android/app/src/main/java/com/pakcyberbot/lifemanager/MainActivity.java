package com.pakcyberbot.lifemanager;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // registerPlugin() must run before super.onCreate() — that's what actually
  // builds the Bridge (see BridgeActivity.load()), so anything registered
  // after it wouldn't be picked up.
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(LoopbackAuthPlugin.class);
    registerPlugin(LocalFileOpenerPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
