package com.sultanabad.canteen.pos.print;

import android.content.Context;
import android.content.SharedPreferences;

public class PrintPreferences {
    private static final String PREFS_NAME = "rawbt_prefs";
    private static final String KEY_DEVICE_ADDRESS = "device_address";
    private static final String KEY_DEVICE_NAME = "device_name";
    private static final String KEY_PAPER_WIDTH = "paper_width";
    private static final String KEY_DENSITY = "density";
    private static final String KEY_DITHER = "dither";
    private static final String KEY_TEMPLATE = "template";

    private final SharedPreferences preferences;

    public PrintPreferences(Context context) {
        this.preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public String getDeviceAddress() {
        return preferences.getString(KEY_DEVICE_ADDRESS, null);
    }

    public String getDeviceName() {
        return preferences.getString(KEY_DEVICE_NAME, "Printer");
    }

    public void setDevice(String address, String name) {
        preferences.edit()
                .putString(KEY_DEVICE_ADDRESS, address)
                .putString(KEY_DEVICE_NAME, name)
                .apply();
    }

    public String getPaperWidth() {
        return preferences.getString(KEY_PAPER_WIDTH, "58mm");
    }

    public void setPaperWidth(String width) {
        preferences.edit().putString(KEY_PAPER_WIDTH, width).apply();
    }

    public int getPaperWidthPx() {
        String width = getPaperWidth();
        if ("80mm".equalsIgnoreCase(width)) {
            return 576;
        }
        return 384;
    }

    public int getDensity() {
        return preferences.getInt(KEY_DENSITY, 1);
    }

    public void setDensity(int density) {
        preferences.edit().putInt(KEY_DENSITY, density).apply();
    }

    public String getDither() {
        return preferences.getString(KEY_DITHER, "floyd");
    }

    public void setDither(String dither) {
        preferences.edit().putString(KEY_DITHER, dither).apply();
    }

    public String getTemplate() {
        return preferences.getString(KEY_TEMPLATE, "SULTANABAD CANTEEN\n");
    }

    public void setTemplate(String template) {
        preferences.edit().putString(KEY_TEMPLATE, template).apply();
    }
}


