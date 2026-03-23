package com.sultanabad.canteen.pos.print;

import android.graphics.Bitmap;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public class EscPosEncoder {
    private EscPosEncoder() {
    }

    public static byte[] init() {
        return new byte[] { 0x1B, 0x40 };
    }

    public static byte[] feed(int lines) {
        if (lines <= 0) {
            return new byte[0];
        }
        return new byte[] { 0x1B, 0x64, (byte) lines };
    }

    public static byte[] cut() {
        return new byte[] { 0x1D, 0x56, 0x01 };
    }

    public static byte[] text(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }

    public static byte[] rasterize(Bitmap bitmap, Dithering.Method method, int density) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int widthBytes = (width + 7) / 8;
        byte[] mono = Dithering.toMonoBytes(bitmap, method, density);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0x1D);
        out.write(0x76);
        out.write(0x30);
        out.write(0x00);
        out.write(widthBytes & 0xFF);
        out.write((widthBytes >> 8) & 0xFF);
        out.write(height & 0xFF);
        out.write((height >> 8) & 0xFF);
        out.write(mono, 0, mono.length);
        return out.toByteArray();
    }
}
