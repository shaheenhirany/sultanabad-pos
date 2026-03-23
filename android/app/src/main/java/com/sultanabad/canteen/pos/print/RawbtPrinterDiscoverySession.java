package com.sultanabad.canteen.pos.print;

import android.print.PrinterId;
import android.print.PrinterInfo;
import android.printservice.PrinterDiscoverySession;
import android.printservice.PrintService;

import java.util.ArrayList;
import java.util.List;

public class RawbtPrinterDiscoverySession extends PrinterDiscoverySession {
    private final PrintService service;
    private final PrintPreferences preferences;

    public RawbtPrinterDiscoverySession(PrintService service) {
        this.service = service;
        this.preferences = new PrintPreferences(service);
    }

    @Override
    public void onStartPrinterDiscovery(List<PrinterId> priorityList) {
        List<PrinterInfo> printers = new ArrayList<>();
        String address = preferences.getDeviceAddress();
        if (address != null) {
            String name = preferences.getDeviceName();
            PrinterId id = service.generatePrinterId("rawbt-" + address);
            PrinterInfo info = new PrinterInfo.Builder(id, name, PrinterInfo.STATUS_IDLE).build();
            printers.add(info);
        }
        addPrinters(printers);
    }

    @Override
    public void onStopPrinterDiscovery() {
    }

    @Override
    public void onValidatePrinters(List<PrinterId> printerIds) {
        if (printerIds == null || printerIds.isEmpty()) {
            return;
        }
        List<PrinterInfo> printers = new ArrayList<>();
        String address = preferences.getDeviceAddress();
        if (address == null) {
            return;
        }
        String name = preferences.getDeviceName();
        PrinterId id = service.generatePrinterId("rawbt-" + address);
        PrinterInfo info = new PrinterInfo.Builder(id, name, PrinterInfo.STATUS_IDLE).build();
        printers.add(info);
        addPrinters(printers);
    }

    @Override
    public void onStartPrinterStateTracking(PrinterId printerId) {
    }

    @Override
    public void onStopPrinterStateTracking(PrinterId printerId) {
    }

    @Override
    public void onDestroy() {
    }
}
