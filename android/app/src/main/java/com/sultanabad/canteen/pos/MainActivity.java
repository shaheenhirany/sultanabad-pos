package com.sultanabad.canteen.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrinterSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

