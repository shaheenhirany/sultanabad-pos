package com.sultanabad.canteen.pos.print;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.printservice.PrintJob;
import android.printservice.PrintService;
import android.printservice.PrinterDiscoverySession;

import java.io.IOException;

public class RawbtPrintService extends PrintService {

    @Override
    protected PrinterDiscoverySession onCreatePrinterDiscoverySession() {
        return new RawbtPrinterDiscoverySession(this);
    }

    @Override
    protected void onPrintJobQueued(PrintJob printJob) {
        new Thread(() -> handlePrintJob(printJob)).start();
    }

    @Override
    protected void onRequestCancelPrintJob(PrintJob printJob) {
        printJob.cancel();
    }

    private void handlePrintJob(PrintJob printJob) {
        if (printJob.isCancelled()) {
            return;
        }

        PrintPreferences preferences = new PrintPreferences(this);
        String address = preferences.getDeviceAddress();
        if (address == null) {
            printJob.fail("No printer selected");
            return;
        }
        if (!BluetoothPrinter.hasConnectPermission(this)) {
            printJob.fail("Bluetooth permission not granted");
            return;
        }

        ParcelFileDescriptor pfd = null;
        PdfRenderer renderer = null;
        try (BluetoothPrinter printer = BluetoothPrinter.connect(this, address)) {
            printer.write(EscPosEncoder.init());

            pfd = printJob.getDocument().getData();
            renderer = new PdfRenderer(pfd);

            int targetWidth = preferences.getPaperWidthPx();
            Dithering.Method dither = Dithering.Method.fromPreference(preferences.getDither());
            int density = preferences.getDensity();

            for (int i = 0; i < renderer.getPageCount(); i++) {
                if (printJob.isCancelled()) {
                    printJob.cancel();
                    return;
                }
                PdfRenderer.Page page = renderer.openPage(i);
                Bitmap bitmap = renderPage(page, targetWidth);
                page.close();

                byte[] raster = EscPosEncoder.rasterize(bitmap, dither, density);
                printer.write(raster);
                printer.write(EscPosEncoder.feed(4));
            }

            printer.write(EscPosEncoder.cut());
            printer.flush();
            printJob.complete();
        } catch (Exception e) {
            printJob.fail("Print failed: " + e.getMessage());
        } finally {
            if (renderer != null) {
                renderer.close();
            }
            try {
                if (pfd != null) {
                    pfd.close();
                }
            } catch (IOException ignored) {
            }
        }
    }

    private Bitmap renderPage(PdfRenderer.Page page, int targetWidth) {
        float scale = (float) targetWidth / (float) page.getWidth();
        int targetHeight = Math.round(page.getHeight() * scale);
        Bitmap bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);
        Matrix matrix = new Matrix();
        matrix.postScale(scale, scale);
        page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
        return bitmap;
    }
}
