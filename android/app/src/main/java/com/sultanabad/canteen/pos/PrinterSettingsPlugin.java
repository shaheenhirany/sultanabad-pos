package com.sultanabad.canteen.pos;

import android.content.Intent;
import android.widget.Toast;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.sultanabad.canteen.pos.print.BluetoothPrinter;
import com.sultanabad.canteen.pos.print.EscPosEncoder;
import com.sultanabad.canteen.pos.print.PrintPreferences;
import com.sultanabad.canteen.pos.print.PrinterSettingsActivity;

@CapacitorPlugin(name = "PrinterSettings")
public class PrinterSettingsPlugin extends Plugin {
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), PrinterSettingsActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            Toast.makeText(getContext(), "Opening printer settings...", Toast.LENGTH_SHORT).show();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open printer settings", e);
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Missing print text");
            return;
        }

        if (!BluetoothPrinter.hasConnectPermission(getContext())) {
            call.reject("Bluetooth permission not granted");
            return;
        }

        PrintPreferences prefs = new PrintPreferences(getContext());
        String address = prefs.getDeviceAddress();
        if (address == null) {
            call.reject("No printer selected");
            return;
        }

        String payload = text.replace("\r\n", "\n").replace("\r", "\n");
        // Only remove trailing blank lines; preserve leading spacing used for centering.
        payload = payload.replaceAll("\\n+$", "");
        payload = payload + "\n";
        final String payloadFinal = payload;
        // Small feed for short tickets so paper advances; avoid long blank tails.
        final int feedLines = payloadFinal.length() < 600 ? 3 : 0;
        final boolean doCut = false;

        if (getActivity() != null) {
            getActivity().runOnUiThread(() ->
                Toast.makeText(getContext(), "SH-Print sending (" + payloadFinal.length() + " chars)", Toast.LENGTH_SHORT).show()
            );
        }

        new Thread(() -> {
            try (BluetoothPrinter printer = BluetoothPrinter.connect(getContext(), address)) {
                printer.write(EscPosEncoder.init());
                printer.write(EscPosEncoder.text(payloadFinal));
                if (feedLines > 0) {
                    printer.write(EscPosEncoder.feed(feedLines));
                }
                if (doCut) {
                    printer.write(EscPosEncoder.cut());
                }
                printer.flush();
                try {
                    Thread.sleep(200);
                } catch (InterruptedException ignored) {
                }
                if (getActivity() != null) {
                    getActivity().runOnUiThread(() ->
                        Toast.makeText(getContext(), "SH-Print sent", Toast.LENGTH_SHORT).show()
                    );
                }
                call.resolve();
            } catch (Exception e) {
                if (getActivity() != null) {
                    getActivity().runOnUiThread(() ->
                        Toast.makeText(getContext(), "SH-Print failed", Toast.LENGTH_SHORT).show()
                    );
                }
                call.reject("Print failed", e);
            }
        }).start();
    }
}

