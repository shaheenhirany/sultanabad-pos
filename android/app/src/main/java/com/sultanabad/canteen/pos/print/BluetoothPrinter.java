package com.sultanabad.canteen.pos.print;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;

import androidx.core.content.ContextCompat;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

public class BluetoothPrinter implements Closeable {
    public static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final BluetoothSocket socket;
    private final OutputStream outputStream;

    private BluetoothPrinter(BluetoothSocket socket) throws IOException {
        this.socket = socket;
        this.outputStream = socket.getOutputStream();
    }

    public static boolean hasConnectPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        return ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.BLUETOOTH_CONNECT
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    public static BluetoothPrinter connect(Context context, String address) throws IOException {
        if (!hasConnectPermission(context)) {
            throw new IOException("Bluetooth permission not granted");
        }
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new IOException("Bluetooth not supported");
        }
        BluetoothDevice device = adapter.getRemoteDevice(address);
        adapter.cancelDiscovery();
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        socket.connect();
        return new BluetoothPrinter(socket);
    }

    public void write(byte[] data) throws IOException {
        outputStream.write(data);
    }

    public void flush() throws IOException {
        outputStream.flush();
    }

    @Override
    public void close() throws IOException {
        try {
            outputStream.flush();
        } catch (IOException ignored) {
        }
        try {
            socket.close();
        } catch (IOException ignored) {
        }
    }
}
