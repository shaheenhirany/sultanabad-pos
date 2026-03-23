package com.sultanabad.canteen.pos.print;

import android.graphics.Bitmap;
import android.graphics.Color;

public class Dithering {
    public enum Method {
        THRESHOLD,
        FLOYD_STEINBERG;

        public static Method fromPreference(String value) {
            if ("floyd".equalsIgnoreCase(value)) {
                return FLOYD_STEINBERG;
            }
            return THRESHOLD;
        }
    }

    private Dithering() {
    }

    public static byte[] toMonoBytes(Bitmap bitmap, Method method, int density) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int widthBytes = (width + 7) / 8;
        byte[] output = new byte[widthBytes * height];

        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);

        int[] lum = new int[pixels.length];
        for (int i = 0; i < pixels.length; i++) {
            int c = pixels[i];
            int r = Color.red(c);
            int g = Color.green(c);
            int b = Color.blue(c);
            lum[i] = (r * 299 + g * 587 + b * 114) / 1000;
        }

        if (method == Method.FLOYD_STEINBERG) {
            applyFloydSteinberg(lum, width, height);
        }

        int threshold = densityToThreshold(density);
        for (int y = 0; y < height; y++) {
            int rowOffset = y * width;
            int byteOffset = y * widthBytes;
            for (int x = 0; x < width; x++) {
                int v = lum[rowOffset + x];
                boolean black = v < threshold;
                if (black) {
                    int index = byteOffset + (x / 8);
                    output[index] |= (byte) (0x80 >> (x % 8));
                }
            }
        }

        return output;
    }

    private static int densityToThreshold(int density) {
        switch (density) {
            case 0:
                return 150;
            case 2:
                return 105;
            default:
                return 128;
        }
    }

    private static void applyFloydSteinberg(int[] lum, int width, int height) {
        for (int y = 0; y < height; y++) {
            int rowOffset = y * width;
            for (int x = 0; x < width; x++) {
                int index = rowOffset + x;
                int oldValue = lum[index];
                int newValue = oldValue < 128 ? 0 : 255;
                int error = oldValue - newValue;
                lum[index] = newValue;

                if (x + 1 < width) {
                    lum[index + 1] = clamp(lum[index + 1] + (error * 7) / 16);
                }
                if (y + 1 < height) {
                    int below = index + width;
                    lum[below] = clamp(lum[below] + (error * 5) / 16);
                    if (x > 0) {
                        lum[below - 1] = clamp(lum[below - 1] + (error * 3) / 16);
                    }
                    if (x + 1 < width) {
                        lum[below + 1] = clamp(lum[below + 1] + (error * 1) / 16);
                    }
                }
            }
        }
    }

    private static int clamp(int value) {
        if (value < 0) {
            return 0;
        }
        if (value > 255) {
            return 255;
        }
        return value;
    }
}
