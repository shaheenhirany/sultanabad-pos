package com.sultanabad.canteen.pos.print;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

import com.sultanabad.canteen.pos.R;

public class PrinterSettingsActivity extends Activity {
    private static final int REQUEST_BT_CONNECT = 1201;
    private static final int REQUEST_BT_SCAN = 1202;

    private Spinner printerSpinner;
    private Spinner paperWidthSpinner;
    private Spinner densitySpinner;
    private Spinner ditherSpinner;
    private ListView availableList;
    private TextView defaultPrinterText;
    private TextView statusText;
    private EditText templateInput;
    private List<BluetoothDevice> bondedDevices = new ArrayList<>();
    private final List<BluetoothDevice> discoveredDevices = new ArrayList<>();
    private ArrayAdapter<String> discoveredAdapter;
    private BluetoothAdapter bluetoothAdapter;
    private boolean receiverRegistered = false;

    private final BroadcastReceiver discoveryReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device != null && !containsDevice(discoveredDevices, device)) {
                    discoveredDevices.add(device);
                    discoveredAdapter.add(device.getName() + " (" + device.getAddress() + ")");
                }
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                statusText.setText("");
            } else if (BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device != null && device.getBondState() == BluetoothDevice.BOND_BONDED) {
                    PrintPreferences prefs = new PrintPreferences(context);
                    prefs.setDevice(device.getAddress(), device.getName());
                    statusText.setText(getString(R.string.paired_success, device.getName()));
                    loadBondedDevices();
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_printer_settings);

        printerSpinner = findViewById(R.id.printer_spinner);
        paperWidthSpinner = findViewById(R.id.paper_width_spinner);
        densitySpinner = findViewById(R.id.density_spinner);
        ditherSpinner = findViewById(R.id.dither_spinner);
        availableList = findViewById(R.id.available_list);
        defaultPrinterText = findViewById(R.id.default_printer_text);
        statusText = findViewById(R.id.status_text);
        templateInput = findViewById(R.id.template_input);

        Button saveButton = findViewById(R.id.save_button);
        Button testButton = findViewById(R.id.test_button);
        Button scanButton = findViewById(R.id.scan_button);
        Button printTemplateButton = findViewById(R.id.print_template_button);

        ArrayAdapter<CharSequence> widthAdapter = ArrayAdapter.createFromResource(
                this,
                R.array.paper_width_options,
                android.R.layout.simple_spinner_item
        );
        widthAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        paperWidthSpinner.setAdapter(widthAdapter);

        ArrayAdapter<CharSequence> densityAdapter = ArrayAdapter.createFromResource(
                this,
                R.array.density_options,
                android.R.layout.simple_spinner_item
        );
        densityAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        densitySpinner.setAdapter(densityAdapter);

        ArrayAdapter<CharSequence> ditherAdapter = ArrayAdapter.createFromResource(
                this,
                R.array.dither_options,
                android.R.layout.simple_spinner_item
        );
        ditherAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        ditherSpinner.setAdapter(ditherAdapter);

        saveButton.setOnClickListener(v -> saveSelection());
        testButton.setOnClickListener(v -> sendTestPrint());
        scanButton.setOnClickListener(v -> startScan());
        printTemplateButton.setOnClickListener(v -> printTemplate());

        discoveredAdapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_list_item_1,
                new ArrayList<>()
        );
        availableList.setAdapter(discoveredAdapter);
        availableList.setOnItemClickListener((parent, view, position, id) -> pairDevice(position));

        ensureBluetoothPermission();
    }

    private void ensureBluetoothPermission() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            statusText.setText(R.string.bluetooth_not_supported);
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            loadBondedDevices();
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED) {
            loadBondedDevices();
        } else {
            ActivityCompat.requestPermissions(this,
                    new String[] { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN },
                    REQUEST_BT_CONNECT
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_BT_CONNECT) {
            boolean granted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    granted = false;
                    break;
                }
            }
            if (granted) {
                loadBondedDevices();
            } else {
                statusText.setText(R.string.permission_required);
            }
        } else if (requestCode == REQUEST_BT_SCAN) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startScan();
            } else {
                statusText.setText(R.string.scan_permission_required);
            }
        }
    }

    private void loadBondedDevices() {
        bondedDevices = new ArrayList<>(bluetoothAdapter.getBondedDevices());
        List<String> labels = new ArrayList<>();
        for (BluetoothDevice device : bondedDevices) {
            labels.add(device.getName() + " (" + device.getAddress() + ")");
        }

        ArrayAdapter<String> adapterSpinner = new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_item,
                labels
        );
        adapterSpinner.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        printerSpinner.setAdapter(adapterSpinner);

        PrintPreferences prefs = new PrintPreferences(this);
        String savedAddress = prefs.getDeviceAddress();
        if (savedAddress != null) {
            for (int i = 0; i < bondedDevices.size(); i++) {
                if (savedAddress.equals(bondedDevices.get(i).getAddress())) {
                    printerSpinner.setSelection(i);
                    break;
                }
            }
            defaultPrinterText.setText(getString(R.string.default_printer_format, prefs.getDeviceName()));
        } else {
            defaultPrinterText.setText(R.string.default_printer_placeholder);
        }

        String paperWidth = prefs.getPaperWidth();
        if ("80mm".equalsIgnoreCase(paperWidth)) {
            paperWidthSpinner.setSelection(1);
        } else {
            paperWidthSpinner.setSelection(0);
        }

        int density = prefs.getDensity();
        densitySpinner.setSelection(Math.max(0, Math.min(2, density)));

        String dither = prefs.getDither();
        if ("threshold".equalsIgnoreCase(dither)) {
            ditherSpinner.setSelection(1);
        } else {
            ditherSpinner.setSelection(0);
        }

        templateInput.setText(prefs.getTemplate());
    }

    private void saveSelection() {
        if (bondedDevices.isEmpty()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }

        int printerIndex = printerSpinner.getSelectedItemPosition();
        if (printerIndex < 0 || printerIndex >= bondedDevices.size()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }

        BluetoothDevice device = bondedDevices.get(printerIndex);
        String paperWidth = paperWidthSpinner.getSelectedItemPosition() == 1 ? "80mm" : "58mm";
        int density = densitySpinner.getSelectedItemPosition();
        String dither = ditherSpinner.getSelectedItemPosition() == 1 ? "threshold" : "floyd";

        PrintPreferences prefs = new PrintPreferences(this);
        prefs.setDevice(device.getAddress(), device.getName());
        prefs.setPaperWidth(paperWidth);
        prefs.setDensity(density);
        prefs.setDither(dither);
        prefs.setTemplate(templateInput.getText().toString());

        statusText.setText(R.string.settings_saved);
        defaultPrinterText.setText(getString(R.string.default_printer_format, device.getName()));
    }

    private void sendTestPrint() {
        if (bondedDevices.isEmpty()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }
        int printerIndex = printerSpinner.getSelectedItemPosition();
        if (printerIndex < 0 || printerIndex >= bondedDevices.size()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }
        BluetoothDevice device = bondedDevices.get(printerIndex);

        statusText.setText(R.string.test_print_sending);
        new Thread(() -> {
            try (BluetoothPrinter printer = BluetoothPrinter.connect(this, device.getAddress())) {
                printer.write(EscPosEncoder.init());
                printer.write(EscPosEncoder.text("SULTANABAD CANTEEN\n"));
                printer.write(EscPosEncoder.feed(4));
                printer.write(EscPosEncoder.cut());
                printer.flush();
                runOnUiThread(() -> statusText.setText(R.string.test_print_sent));
            } catch (Exception e) {
                runOnUiThread(() -> statusText.setText(getString(R.string.test_print_failed, e.getMessage())));
            }
        }).start();
    }

    private void startScan() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[] { Manifest.permission.BLUETOOTH_SCAN },
                        REQUEST_BT_SCAN
                );
                return;
            }
        }

        if (bluetoothAdapter.isDiscovering()) {
            bluetoothAdapter.cancelDiscovery();
        }

        discoveredDevices.clear();
        discoveredAdapter.clear();
        statusText.setText(R.string.scanning);

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        filter.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
        if (!receiverRegistered) {
            registerReceiver(discoveryReceiver, filter);
            receiverRegistered = true;
        }
        bluetoothAdapter.startDiscovery();
    }

    private void pairDevice(int position) {
        if (position < 0 || position >= discoveredDevices.size()) {
            return;
        }
        BluetoothDevice device = discoveredDevices.get(position);
        statusText.setText(R.string.pairing);
        device.createBond();
    }

    private void printTemplate() {
        if (bondedDevices.isEmpty()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }
        int printerIndex = printerSpinner.getSelectedItemPosition();
        if (printerIndex < 0 || printerIndex >= bondedDevices.size()) {
            statusText.setText(R.string.no_printers_found);
            return;
        }
        BluetoothDevice device = bondedDevices.get(printerIndex);
        String template = templateInput.getText().toString();
        if (template.trim().isEmpty()) {
            template = "SULTANABAD CANTEEN\n";
        }

        String finalTemplate = template;
        new Thread(() -> {
            try (BluetoothPrinter printer = BluetoothPrinter.connect(this, device.getAddress())) {
                printer.write(EscPosEncoder.init());
                printer.write(EscPosEncoder.text(finalTemplate + "\n"));
                printer.write(EscPosEncoder.feed(4));
                printer.write(EscPosEncoder.cut());
                printer.flush();
                runOnUiThread(() -> statusText.setText(R.string.template_print_sent));
            } catch (Exception e) {
                runOnUiThread(() -> statusText.setText(getString(R.string.template_print_failed, e.getMessage())));
            }
        }).start();
    }

    private boolean containsDevice(List<BluetoothDevice> list, BluetoothDevice device) {
        for (BluetoothDevice existing : list) {
            if (existing.getAddress().equals(device.getAddress())) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (receiverRegistered) {
            try {
                unregisterReceiver(discoveryReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            receiverRegistered = false;
        }
    }
}


