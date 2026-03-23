import React, { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import appLogo from "./assets/app-logo.png";

const initialProducts = [
  { id: 1, name: "Butter Chicken", price: 13.84, img: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=70" },
  { id: 2, name: "French Fries", price: 7.5, img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=70" },
  { id: 3, name: "Roast Beef", price: 19.0, img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=70" },
  { id: 4, name: "Sauerkraut", price: 11.5, img: "https://images.unsplash.com/photo-1604909052958-68841e2a5be8?auto=format&fit=crop&w=600&q=70" },
  { id: 5, name: "Beef Kebab", price: 14.95, img: "https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=600&q=70" },
  { id: 6, name: "Fish and Chips", price: 12.8, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=70" },
  { id: 7, name: "Wagyu Steak", price: 31.17, img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&q=70" },
  { id: 8, name: "Chicken Ramen", price: 17.7, img: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=600&q=70" },
  { id: 9, name: "Pasta Bolognese", price: 13.5, img: "https://images.unsplash.com/photo-1622973536968-3ead9e780960?auto=format&fit=crop&w=600&q=70" },
  { id: 10, name: "Vegetable Salad", price: 15.64, img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=70" },
  { id: 11, name: "Grilled Skewers", price: 17.25, img: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=70" },
  { id: 12, name: "Fried Rice", price: 9.8, img: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=70" }
];
const initialStock = Object.fromEntries(initialProducts.map((item) => [item.id, 20]));
const initialMenuSets = ["Beverages", "Dessert", "Appetizer"];
const initialMenuSetItems = Object.fromEntries(
  initialMenuSets.map((setName) => [setName, initialProducts.map((item) => item.id)])
);
const LEGACY_STORAGE_KEY = "sultanabad_pos_state_v1";
const FIRESTORE_COLLECTION = "pos_state";
const FIRESTORE_DOC_ID = "shared";
const MAX_SALES_RECORDS = 1200;
const TRANSACTIONS_PER_PAGE = 25;

const navItems = ["Dashboard", "Manage Items", "Inventory", "Menu Set", "Finance"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PrinterSettings = registerPlugin("PrinterSettings");
const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || "1.0.0").trim();
const UPDATE_DISMISS_KEY = "sultanabad_pos_dismissed_update";
const PRINT_LEFT_MARGIN_SPACES = 1;

// APK download (login page helper)
const APK_DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id=1IypShLk8Dzge6Y47ZEFMqFznuCZsHZ_T";

function isAndroidDevice() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

// Lightweight client-side logging to Firestore for unusual events
const CLIENT_LOGS_COLLECTION = "client_logs";

async function logClientEvent(dbInstance, eventType, data = {}) {
  try {
    if (!dbInstance) return;
    const logsCollectionRef = collection(dbInstance, CLIENT_LOGS_COLLECTION);
    await addDoc(logsCollectionRef, {
      eventType,
      data,
      createdAt: serverTimestamp(),
      appVersion: APP_VERSION
    });
  } catch (err) {
    // Swallow log errors; never break the app because logging failed
    // eslint-disable-next-line no-console
    console.error("Failed to write client log:", err);
  }
}

function isAndroidAppRuntime() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroidUa = /Android/i.test(ua);
  const hasCapacitorGlobal = typeof window !== "undefined" && Boolean(window?.Capacitor);
  const isCapProtocol = typeof window !== "undefined" && window.location?.protocol === "capacitor:";
  const isLocalhostWebView = typeof window !== "undefined" && window.location?.hostname === "localhost";
  const isNativeByCapacitor = Boolean(
    Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === "android"
  );
  return isNativeByCapacitor || (isAndroidUa && (isCapProtocol || (hasCapacitorGlobal && isLocalhostWebView)));
}

function compareSemver(a, b) {
  const left = String(a || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function toTokenDocId(tokenValue) {
  return String(tokenValue || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

const emptyForm = {
  name: "",
  price: "",
  img: ""
};

function formatMoney(value) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `Rs. ${Math.round(safeValue).toLocaleString("en-PK")}`;
}

function formatCompactAmount(value) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.round(safeValue).toLocaleString("en-PK");
}

function applyLeftPrintMargin(text, spaces = PRINT_LEFT_MARGIN_SPACES) {
  const leftPad = " ".repeat(Math.max(0, Number(spaces) || 0));
  return String(text ?? "")
    .split("\n")
    .map((line) => `${leftPad}${line}`)
    .join("\n");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateShort(value) {
  const date = value instanceof Date ? value : new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()] ?? "Jan";
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOrderDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildOrderId(timestamp, existingRecords) {
  const dateKey = formatOrderDateKey(timestamp);
  const sequenceMax = (Array.isArray(existingRecords) ? existingRecords : []).reduce((max, record) => {
    const recordId = typeof record?.id === "string" ? record.id : "";
    const match = recordId.match(/^(\d{8})-(\d{3})$/);
    if (match && match[1] === dateKey) {
      const sequence = Number(match[2]);
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }
    return max;
  }, 0);
  return `${dateKey}-${String(sequenceMax + 1).padStart(3, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReceiptText({ orderId, timestamp, lines, total }) {
  const width = 30;
  const safeLines = Array.isArray(lines) ? lines : [];
  const center = (text, uppercase = false) => {
    const value = uppercase ? String(text).toUpperCase() : String(text);
    const leftPad = Math.max(0, Math.floor((width - value.length) / 2));
    return `${" ".repeat(leftPad)}${value}`;
  };
  const rightAmountLine = (label, amountText) => {
    const base = String(label);
    const spaces = Math.max(1, width - base.length - amountText.length);
    return `${base}${" ".repeat(spaces)}${amountText}`;
  };
  const header = [
    center("SULTANABAD CANTEEN"),
    "------------------------------",
    center(`Order: ${orderId}`),
    center(`Time: ${formatDateTime(timestamp)}`),
    "------------------------------"
  ];

  const body = safeLines.map((line) => {
    const qty = Number(line.qty) || 0;
    const left = `${qty} x ${(line.name ?? "").toString().slice(0, 16)}`;
    const lineTotal = formatMoney(line.lineTotal);
    return rightAmountLine(left, lineTotal);
  });

  const footer = [
    "------------------------------",
    rightAmountLine("Total", formatMoney(total).replace("Rs.", "RS.")),
    "------------------------------",
    center("Thank You")
  ];

  return applyLeftPrintMargin([...header, ...body, ...footer].join("\n"));
}

function printViaBrowserReceiptPopup(receiptText) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) {
    window.print();
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt</title>
        <style>
          body { margin: 0; padding: 16px; font-family: "Courier New", monospace; background: #fff; color: #000; }
          pre { margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.35; }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(receiptText)}</pre>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
  setTimeout(() => popup.close(), 350);
}

function buildPlainTextTable({ title, subtitle, columns, rows, footer }) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeFooter = Array.isArray(footer) ? footer : null;
  const allRows = [safeColumns, ...safeRows, ...(safeFooter ? [safeFooter] : [])];
  const colCount = allRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);

  const widths = Array.from({ length: colCount }, (_, colIndex) =>
    allRows.reduce((max, row) => {
      const cell = Array.isArray(row) ? String(row[colIndex] ?? "") : "";
      return Math.max(max, cell.length);
    }, 0)
  );

  const formatRow = (row) =>
    Array.from({ length: colCount }, (_, colIndex) => {
      const value = String((Array.isArray(row) ? row[colIndex] : "") ?? "");
      return value.padEnd(widths[colIndex], " ");
    }).join(" | ");

  const separator = widths.map((width) => "-".repeat(Math.max(3, width))).join("-+-");
  const totalWidth = Math.max(30, separator.length);
  const center = (text) => {
    const value = String(text ?? "");
    const leftPad = Math.max(0, Math.floor((totalWidth - value.length) / 2));
    return `${" ".repeat(leftPad)}${value}`;
  };
  const lines = [center("SULTANABAD CANTEEN"), center(String(title || "").toUpperCase())];
  if (subtitle) {
    lines.push(center(String(subtitle)));
  }
  if (safeColumns.length > 0) {
    lines.push(separator, formatRow(safeColumns), separator);
  }
  safeRows.forEach((row) => lines.push(formatRow(row)));
  if (safeFooter) {
    lines.push(separator, formatRow(safeFooter));
  }
  return applyLeftPrintMargin(lines.join("\n").trimEnd());
}

function launchRawbtText(text) {
  const rawbtText = String(text ?? "").replaceAll("\n", "\r\n");
  const rawbtUrl = `rawbt:${encodeURIComponent(rawbtText)}`;
  try {
    const anchor = document.createElement("a");
    anchor.href = rawbtUrl;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch {
    window.location.href = rawbtUrl;
  }
}

async function printFinanceTable({ title, subtitle, columns, rows, footer }) {
  const plainText = buildPlainTextTable({ title, subtitle, columns, rows, footer });
  const isNativeAndroid = isAndroidAppRuntime();
  if (isNativeAndroid) {
    try {
      await PrinterSettings.printText({ text: plainText });
      return;
    } catch {
      if (window.confirm("SH-Print is not available. Open Printer Settings now?")) {
        try {
          await PrinterSettings.openSettings();
        } catch {
          alert("Unable to open Printer Settings.");
        }
      }
      return;
    }
  }

  const isAndroidWeb = /Android/i.test(navigator.userAgent);
  if (isAndroidWeb && !isNativeAndroid) {
    launchRawbtText(plainText);
    return;
  }

  const popup = window.open("", "_blank", "width=900,height=720");
  if (!popup) {
    window.print();
    return;
  }

  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeFooter = Array.isArray(footer) ? footer : null;

  const theadHtml = `<tr>${safeColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  const tbodyHtml = safeRows
    .map((row) => `<tr>${(Array.isArray(row) ? row : []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const tfootHtml = safeFooter
    ? `<tfoot><tr>${safeFooter.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></tfoot>`
    : "";

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #111; }
          h1 { margin: 0 0 14px; font-size: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d5dfec; text-align: left; padding: 8px 10px; font-size: 13px; }
          th { background: #f3f7fd; }
          tfoot th { background: #ecf3ff; }
        </style>
      </head>
      <body>
        <h1>SULTANABAD CANTEEN</h1>
        <h2 style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(title)}</h2>
        ${subtitle ? `<p style="margin:0 0 12px;font-size:13px;color:#4d5f77;">${escapeHtml(subtitle)}</p>` : ""}
        <table>
          <thead>${theadHtml}</thead>
          <tbody>${tbodyHtml}</tbody>
          ${tfootHtml}
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
  setTimeout(() => popup.close(), 350);
}

function loadLegacyLocalState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeInventory(items, inventoryState) {
  const next = { ...(inventoryState ?? {}) };
  items.forEach((item) => {
    const current = Number(next[item.id]);
    next[item.id] = Number.isFinite(current) && current >= 0 ? Math.floor(current) : 0;
  });
  return next;
}

function normalizeMenuSetItemsState(setNames, rawState, validItemIds) {
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const normalized = {};
  const allowedIds = Array.isArray(validItemIds)
    ? new Set(validItemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
    : null;

  setNames.forEach((setName) => {
    const rawItems = Array.isArray(source[setName]) ? source[setName] : [];
    const safeItems = [...new Set(
      rawItems
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && (!allowedIds || allowedIds.has(id)))
    )];
    normalized[setName] = safeItems;
  });

  return normalized;
}

function normalizeCartState(rawCart, items) {
  const source = rawCart && typeof rawCart === "object" ? rawCart : {};
  const itemsById = Object.fromEntries((Array.isArray(items) ? items : []).map((item) => [Number(item.id), item]));
  const normalized = {};

  Object.values(source).forEach((entry) => {
    const id = Number(entry?.id);
    const qty = Math.max(0, Math.floor(Number(entry?.qty ?? 0)));
    if (!Number.isFinite(id) || qty <= 0) return;
    const item = itemsById[id];
    const price = item ? Number(item.price) : Number(entry?.price ?? 0);
    if (!Number.isFinite(price)) return;

    normalized[id] = {
      id,
      name: item?.name ?? String(entry?.name ?? ""),
      price,
      qty
    };
  });

  return normalized;
}

export default function App() {
  const localFallbackState = useMemo(() => loadLegacyLocalState(), []);
  // Ignore any legacy menu items/menu sets from localStorage; Firestore is source of truth.
  const initialMenuItemsState = initialProducts;
  const initialMenuSetsState = initialMenuSets;

  const [authSession, setAuthSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [cart, setCart] = useState(() => (localFallbackState?.cart && typeof localFallbackState.cart === "object" ? localFallbackState.cart : {}));
  const [menuItems, setMenuItems] = useState(initialMenuItemsState);
  const [inventory, setInventory] = useState(() => normalizeInventory(initialMenuItemsState, localFallbackState?.inventory ?? initialStock));
  const [formData, setFormData] = useState(emptyForm);
  const [editItemId, setEditItemId] = useState(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [menuSets, setMenuSets] = useState(initialMenuSetsState);
  const initialMenuItemIds = initialMenuItemsState.map((item) => item.id);
  const [menuSetItems, setMenuSetItems] = useState(() =>
    normalizeMenuSetItemsState(
      initialMenuSetsState,
      localFallbackState?.menuSetItems ?? initialMenuSetItems,
      initialMenuItemIds
    )
  );
  const [activeMenuSet, setActiveMenuSet] = useState(
    localFallbackState?.activeMenuSet && typeof localFallbackState.activeMenuSet === "string"
      ? localFallbackState.activeMenuSet
      : "All Menu"
  );
  const [menuSetName, setMenuSetName] = useState("");
  const [editMenuSetIndex, setEditMenuSetIndex] = useState(null);
  const [selectedMenuSetForItems, setSelectedMenuSetForItems] = useState(() => {
    if (localFallbackState?.selectedMenuSetForItems && typeof localFallbackState.selectedMenuSetForItems === "string") {
      return localFallbackState.selectedMenuSetForItems;
    }
    return initialMenuSetsState[0] ?? "";
  });
  const [expandedMenuSet, setExpandedMenuSet] = useState(() => initialMenuSetsState[0] ?? null);
  const [salesRecords, setSalesRecords] = useState([]);
  const [isCloudMenuReady, setIsCloudMenuReady] = useState(false);
  const [financeReportDate, setFinanceReportDate] = useState(() => {
    if (localFallbackState?.financeReportDate && typeof localFallbackState.financeReportDate === "string") {
      return localFallbackState.financeReportDate;
    }
    return toDateInputValue(new Date());
  });
  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(new Date().getMonth());
  const [isMonthBreakupVisible, setIsMonthBreakupVisible] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionDateFrom, setTransactionDateFrom] = useState("");
  const [transactionDateTo, setTransactionDateTo] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);
  const remoteDocRef = useMemo(() => doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID), []);
  const appConfigRef = useMemo(() => doc(db, "app_config", "pos"), []);
  const salesCollectionRef = useMemo(() => collection(db, "sales"), []);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

    const q = query(
      salesCollectionRef,
      where("timestamp", ">=", startOfYear),
      where("timestamp", "<", startOfNextYear),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const rawTs = data.timestamp;
          const timestamp = rawTs && typeof rawTs.toDate === "function"
            ? rawTs.toDate().toISOString()
            : (typeof rawTs === "string" && rawTs
              ? rawTs
              : new Date().toISOString());

          return {
            id: data.id || docSnap.id,
            ...data,
            timestamp
          };
        });
        setSalesRecords(records);
      },
      (err) => {
        console.error("Failed to subscribe to sales history:", err);
        logClientEvent(db, "sales_history_subscribe_failed", { message: String(err?.message || ""), code: err?.code || null });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [salesCollectionRef]);

  const isApplyingRemoteRef = useRef(false);
  const isCloudReadyRef = useRef(false);
  const latestSyncedPayloadRef = useRef("");
  const pendingPayloadRef = useRef("");
  const hasInitializedFinanceDateRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState("Cloud sync: connecting...");
  const [appUpdateNotice, setAppUpdateNotice] = useState(null);

  const buildPersistPayload = () => ({
    cart,
    menuItems,
    inventory,
    menuSets,
    menuSetItems,
    activeMenuSet,
    selectedMenuSetForItems,
    // salesRecords removed from shared POS state; lives in /sales collection
    financeReportDate
  });

  function sanitizeMenuItemsForRemote(items) {
    return (Array.isArray(items) ? items : []).map((item) => {
      const next = { ...item };
      const img = String(next.img || "");
      // Avoid pushing large base64 blobs to Firestore; keep only URLs or empty.
      if (img.startsWith("data:image/")) {
        // Now that images are uploaded to Storage, data URLs should not be saved.
        // Strip data-URL for remote payload to keep the document small and safe.
        next.img = "";
      }
      return next;
    });
  }

  const buildRemotePersistPayload = () => {
    const { cart: _localCartOnly, ...sharedPayload } = buildPersistPayload();
    return {
      ...sharedPayload,
      // Prevent oversized Firestore docs by stripping base64 images from remote state.
      menuItems: sanitizeMenuItemsForRemote(sharedPayload.menuItems)
    };
  };

  function normalizePersistedPayload(rawPayload, options = {}) {
    const { includeCart = true } = options;
    const source = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const hasRemoteMenuItems = Array.isArray(source.menuItems);
    const nextMenuItems = hasRemoteMenuItems ? source.menuItems : initialProducts;
    const nextMenuItemIds = nextMenuItems.map((item) => item.id);
    const hasRemoteMenuSets = Array.isArray(source.menuSets);
    const normalizedMenuSets = hasRemoteMenuSets
      ? source.menuSets.filter((name) => typeof name === "string" && name.trim())
      : initialMenuSets;
    const normalizedActiveMenuSet = typeof source.activeMenuSet === "string" ? source.activeMenuSet : "All Menu";
    const normalizedSelectedSet =
      typeof source.selectedMenuSetForItems === "string"
        ? source.selectedMenuSetForItems
        : (normalizedMenuSets[0] ?? "");

    return {
      ...(includeCart ? { cart: normalizeCartState(source.cart, nextMenuItems) } : {}),
      menuItems: nextMenuItems,
      inventory: normalizeInventory(nextMenuItems, source.inventory ?? initialStock),
      menuSets: normalizedMenuSets,
      menuSetItems: normalizeMenuSetItemsState(
        normalizedMenuSets,
        source.menuSetItems ?? (hasRemoteMenuSets ? {} : initialMenuSetItems),
        nextMenuItemIds
      ),
      activeMenuSet:
        normalizedActiveMenuSet === "All Menu" || normalizedMenuSets.includes(normalizedActiveMenuSet)
          ? normalizedActiveMenuSet
          : "All Menu",
      selectedMenuSetForItems: normalizedMenuSets.includes(normalizedSelectedSet)
        ? normalizedSelectedSet
        : (normalizedMenuSets[0] ?? ""),
      financeReportDate:
        typeof source.financeReportDate === "string" ? source.financeReportDate : toDateInputValue(new Date())
    };
  }

  function applyPersistedPayload(rawPayload, options = {}) {
    const { includeCart = true } = options;
    const normalized = normalizePersistedPayload(rawPayload, { includeCart });
    if (includeCart) {
      setCart(normalized.cart);
    }
    setMenuItems(normalized.menuItems);
    setInventory(normalized.inventory);
    setMenuSets(normalized.menuSets);
    setMenuSetItems(normalized.menuSetItems);
    setActiveMenuSet(normalized.activeMenuSet);
    setSelectedMenuSetForItems(normalized.selectedMenuSetForItems);
    setExpandedMenuSet(normalized.menuSets[0] ?? null);
    setFinanceReportDate(normalized.financeReportDate);
    return normalized;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthSession(user ?? null);
      setIsAuthReady(true);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    let unsub = () => {};

    async function initCloudSync() {
      // Wait for auth state; require a signed-in user for cloud sync
      if (!isAuthReady) return;
      if (!authSession) {
        setSyncStatus("Cloud sync: sign in to enable");
        setIsCloudMenuReady(true);
        return;
      }

      try {
        const snapshot = await getDoc(remoteDocRef);
        if (!snapshot.exists()) {
          if (import.meta.env.DEV) {
            // Dev only: seed from local/default state
            const seedPayload = normalizePersistedPayload(
              localFallbackState ?? buildPersistPayload(),
              { includeCart: false }
            );
            await setDoc(remoteDocRef, { ...seedPayload, updatedAt: serverTimestamp() });
            await logClientEvent(db, "dev_seed_shared_doc", { path: `${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID}` });
          } else {
            // Production: do not auto-seed demo data; require manual setup
            console.warn("pos_state/shared is missing; not auto-seeding in production.");
            setSyncStatus("Cloud sync: missing shared menu");
            setIsCloudMenuReady(true);
            isCloudReadyRef.current = true;
            logClientEvent(db, "missing_shared_doc_in_prod", { path: `${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID}` });
          }
          return;
        }

        unsub = onSnapshot(
          remoteDocRef,
          (remoteSnapshot) => {
            if (!remoteSnapshot.exists()) return;
            const data = remoteSnapshot.data();
            const normalizedPayload = normalizePersistedPayload(data, { includeCart: false });
            const payloadSignature = JSON.stringify(normalizedPayload);
            latestSyncedPayloadRef.current = payloadSignature;
            isApplyingRemoteRef.current = true;
            applyPersistedPayload(normalizedPayload, { includeCart: false });
            isCloudReadyRef.current = true;
            setIsCloudMenuReady(true);
            setSyncStatus("Cloud sync: up to date");
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 0);
          },
          () => {
            setSyncStatus("Cloud sync: failed");
          }
        );
      } catch (err) {
        console.error("Cloud sync failed:", err);
        logClientEvent(db, "cloud_sync_failed", { message: String(err?.message || ""), code: err?.code || null });
        setSyncStatus("Cloud sync: failed");
        isCloudReadyRef.current = true;
        setIsCloudMenuReady(true);
      }
    }

    initCloudSync();

    return () => {
      unsub();
    };
  }, [remoteDocRef, isAuthReady, authSession, localFallbackState]);

  useEffect(() => {
    setMenuSetItems((prev) => normalizeMenuSetItemsState(menuSets, prev, menuItems.map((item) => item.id)));

    if (activeMenuSet !== "All Menu" && !menuSets.includes(activeMenuSet)) {
      setActiveMenuSet("All Menu");
    }

    if (menuSets.length === 0) {
      if (selectedMenuSetForItems !== "") setSelectedMenuSetForItems("");
      return;
    }

    if (!menuSets.includes(selectedMenuSetForItems)) {
      setSelectedMenuSetForItems(menuSets[0]);
    }
  }, [menuSets, activeMenuSet, selectedMenuSetForItems, menuItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload = buildPersistPayload();
    const remotePayload = buildRemotePersistPayload();
    const payloadSignature = JSON.stringify(remotePayload);

    try {
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore local cache errors; cloud sync is the source of truth.
    }

    if (!isCloudReadyRef.current || isApplyingRemoteRef.current) return;
    if (payloadSignature === latestSyncedPayloadRef.current) return;
    if (payloadSignature === pendingPayloadRef.current) return;

    pendingPayloadRef.current = payloadSignature;
    setSyncStatus("Cloud sync: saving...");

    (async () => {
      try {
        await setDoc(remoteDocRef, { ...remotePayload, updatedAt: serverTimestamp() });
        latestSyncedPayloadRef.current = payloadSignature;
        pendingPayloadRef.current = "";
        setSyncStatus("Cloud sync: up to date");
      } catch {
        pendingPayloadRef.current = "";
        setSyncStatus("Cloud sync: failed");
      }
    })();
  }, [cart, menuItems, inventory, menuSets, menuSetItems, activeMenuSet, selectedMenuSetForItems, salesRecords, financeReportDate, remoteDocRef]);

  useEffect(() => {
    if (salesRecords.length > MAX_SALES_RECORDS) {
      setSalesRecords((prev) => prev.slice(0, MAX_SALES_RECORDS));
    }
  }, [salesRecords]);

  useEffect(() => {
    if (hasInitializedFinanceDateRef.current) return;
    if (!isCloudReadyRef.current) return;
    hasInitializedFinanceDateRef.current = true;
    const today = toDateInputValue(new Date());
    if (financeReportDate !== today) {
      setFinanceReportDate(today);
    }
  }, [syncStatus, financeReportDate]);

  useEffect(() => {
    const unsub = onSnapshot(
      appConfigRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAppUpdateNotice(null);
          return;
        }

        const data = snapshot.data() ?? {};
        const latestVersion = String(data.latestVersion || "").trim();
        const minSupportedVersion = String(data.minSupportedVersion || "").trim();
        const updateUrl = String(data.updateUrl || "").trim();
        const updateMessage = String(data.updateMessage || "").trim();
        const dismissedVersion = typeof window !== "undefined"
          ? String(window.localStorage.getItem(UPDATE_DISMISS_KEY) || "").trim()
          : "";

        if (minSupportedVersion && compareSemver(APP_VERSION, minSupportedVersion) < 0) {
          setAppUpdateNotice({
            type: "force",
            targetVersion: minSupportedVersion,
            message: updateMessage || `Update to version ${minSupportedVersion} is required.`,
            url: updateUrl
          });
          return;
        }

        if (latestVersion && compareSemver(APP_VERSION, latestVersion) < 0 && dismissedVersion !== latestVersion) {
          setAppUpdateNotice({
            type: "soft",
            targetVersion: latestVersion,
            message: updateMessage || `Version ${latestVersion} is available.`,
            url: updateUrl
          });
          return;
        }

        setAppUpdateNotice(null);
      },
      () => {
        setAppUpdateNotice(null);
      }
    );

    return () => {
      unsub();
    };
  }, [appConfigRef]);

  useEffect(() => {
    if (!isAndroidAppRuntime()) return;

    (async () => {
      try {
        const currentPermissions = await PushNotifications.checkPermissions();
        let receivePermission = currentPermissions.receive;
        if (receivePermission !== "granted") {
          const requested = await PushNotifications.requestPermissions();
          receivePermission = requested.receive;
        }
        if (receivePermission !== "granted") return;

        await PushNotifications.register();

        await PushNotifications.addListener("registration", async (token) => {
          const value = String(token?.value || "").trim();
          if (!value) return;
          const tokenDocRef = doc(db, "device_tokens", toTokenDocId(value));
          await setDoc(tokenDocRef, {
            token: value,
            platform: "android",
            appVersion: APP_VERSION,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });

        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          const title = String(notification?.title || "Notification");
          const body = String(notification?.body || "");
          alert(body ? `${title}\n${body}` : title);
        });

        await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          const targetUrl = String(event?.notification?.data?.url || "").trim();
          if (targetUrl) {
            window.open(targetUrl, "_blank");
          }
        });
      } catch {
        // Ignore push setup failures.
      }
    })();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const assignedIds = menuSetItems[activeMenuSet] ?? [];
    return activeMenuSet === "All Menu"
      ? menuItems
      : menuItems.filter((product) => assignedIds.includes(product.id));
  }, [menuItems, activeMenuSet, menuSetItems]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const menuItemsById = useMemo(
    () => Object.fromEntries(menuItems.map((item) => [item.id, item])),
    [menuItems]
  );
  const soldItemIds = useMemo(() => {
    const ids = new Set();
    salesRecords.forEach((record) => {
      (record.lines ?? []).forEach((line) => {
        const itemId = Number(line.id);
        if (Number.isFinite(itemId)) ids.add(itemId);
      });
    });
    return ids;
  }, [salesRecords]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);
    const total = subtotal;
    return { subtotal, totalItems, total };
  }, [cartItems]);

  const inventorySummary = useMemo(() => {
    const totalStock = menuItems.reduce((sum, item) => sum + (inventory[item.id] ?? 0), 0);
    const lowStock = menuItems.filter((item) => (inventory[item.id] ?? 0) <= 5).length;
    return { totalStock, lowStock };
  }, [inventory, menuItems]);

  const financeSummary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let dailySale = 0;
    let weeklySale = 0;
    let monthlySale = 0;

    salesRecords.forEach((record) => {
      const recordTime = new Date(record.timestamp);
      const recordMs = recordTime.getTime();
      totalRevenue += record.total;
      totalItemsSold += record.itemsCount;

      if (recordMs >= startOfToday) dailySale += record.total;
      if (recordMs >= sevenDaysAgo) weeklySale += record.total;
      if (recordTime.getMonth() === currentMonth && recordTime.getFullYear() === currentYear) {
        monthlySale += record.total;
      }
    });

    return {
      totalRevenue,
      totalItemsSold,
      dailySale,
      weeklySale,
      monthlySale
    };
  }, [salesRecords]);

  const monthWiseSales = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const totals = Array(12).fill(0);

    salesRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      if (recordDate.getFullYear() !== currentYear) return;
      totals[recordDate.getMonth()] += Number(record.total) || 0;
    });

    return totals.map((total, index) => ({
      month: MONTH_NAMES[index],
      total
    }));
  }, [salesRecords]);

  const selectedMonthItemWiseReport = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const byItem = {};

    salesRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      if (recordDate.getFullYear() !== currentYear) return;
      if (recordDate.getMonth() !== selectedFinanceMonth) return;

      record.lines.forEach((line) => {
        const qty = Number(line.qty);
        const price = Number(line.price);
        const safeQty = Number.isFinite(qty) ? qty : 0;
        const safePrice = Number.isFinite(price) ? price : 0;
        const lineTotalRaw = Number(line.lineTotal);
        const safeLineTotal = Number.isFinite(lineTotalRaw) ? lineTotalRaw : safeQty * safePrice;

        if (!byItem[line.id]) {
          byItem[line.id] = {
            id: line.id,
            name: line.name,
            qtySold: 0,
            revenue: 0
          };
        }

        byItem[line.id].qtySold += safeQty;
        byItem[line.id].revenue += safeLineTotal;
      });
    });

    return Object.values(byItem).sort((a, b) => b.revenue - a.revenue);
  }, [salesRecords, selectedFinanceMonth]);

  const selectedMonthItemWiseTotals = useMemo(() => {
    return selectedMonthItemWiseReport.reduce(
      (acc, item) => {
        acc.qtySold += item.qtySold;
        acc.revenue += item.revenue;
        return acc;
      },
      { qtySold: 0, revenue: 0 }
    );
  }, [selectedMonthItemWiseReport]);

  const menuWiseReport = useMemo(() => {
    const byItem = {};

    salesRecords.forEach((record) => {
      record.lines.forEach((line) => {
        const qty = Number(line.qty);
        const price = Number(line.price);
        const safeQty = Number.isFinite(qty) ? qty : 0;
        const safePrice = Number.isFinite(price) ? price : 0;
        const lineTotalRaw = Number(line.lineTotal);
        const safeLineTotal = Number.isFinite(lineTotalRaw) ? lineTotalRaw : safeQty * safePrice;

        if (!byItem[line.id]) {
          byItem[line.id] = {
            id: line.id,
            name: line.name,
            qtySold: 0,
            revenue: 0
          };
        }

        byItem[line.id].qtySold += safeQty;
        byItem[line.id].revenue += safeLineTotal;
      });
    });

    return Object.values(byItem)
      .map((item) => ({
        ...item,
        avgUnitPrice: item.qtySold === 0 ? 0 : item.revenue / item.qtySold
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [salesRecords]);

  const menuWiseTotals = useMemo(() => {
    return menuWiseReport.reduce(
      (acc, item) => {
        acc.qtySold += item.qtySold;
        acc.revenue += item.revenue;
        return acc;
      },
      { qtySold: 0, revenue: 0 }
    );
  }, [menuWiseReport]);

  const menuWiseChartData = useMemo(() => {
    const topItems = menuWiseReport.slice(0, 8);
    const maxRevenue = topItems.reduce((max, item) => Math.max(max, item.revenue), 0);
    return { topItems, maxRevenue };
  }, [menuWiseReport]);

  const filteredTransactions = useMemo(() => {
    const search = transactionSearch.trim().toLowerCase();
    const fromTs = transactionDateFrom ? new Date(`${transactionDateFrom}T00:00:00`).getTime() : null;
    const toTs = transactionDateTo ? new Date(`${transactionDateTo}T23:59:59`).getTime() : null;

    return salesRecords.filter((record) => {
      const recordTs = new Date(record.timestamp).getTime();
      if (fromTs !== null && recordTs < fromTs) return false;
      if (toTs !== null && recordTs > toTs) return false;

      if (!search) return true;
      const haystack = `${record.id} ${record.lines?.map((line) => line.name).join(" ")}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [salesRecords, transactionSearch, transactionDateFrom, transactionDateTo]);

  const totalTransactionPages = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE));

  const paginatedTransactions = useMemo(() => {
    const start = (transactionPage - 1) * TRANSACTIONS_PER_PAGE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [filteredTransactions, transactionPage]);

  const transactionPageNumbers = useMemo(() => {
    if (totalTransactionPages <= 1) return [1];

    const pages = new Set([1, totalTransactionPages, transactionPage - 1, transactionPage, transactionPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= totalTransactionPages)
      .sort((a, b) => a - b);
  }, [totalTransactionPages, transactionPage]);

  useEffect(() => {
    setTransactionPage(1);
  }, [transactionSearch, transactionDateFrom, transactionDateTo]);

  useEffect(() => {
    if (transactionPage > totalTransactionPages) {
      setTransactionPage(totalTransactionPages);
    }
  }, [transactionPage, totalTransactionPages]);

  const selectedDateItemWiseReport = useMemo(() => {
    const selectedDate = new Date(`${financeReportDate}T00:00:00`);
    const startOfSelectedDay = selectedDate.getTime();
    const endOfSelectedDay = startOfSelectedDay + 24 * 60 * 60 * 1000;
    const byItem = {};

    salesRecords.forEach((record) => {
      const recordMs = new Date(record.timestamp).getTime();
      if (recordMs < startOfSelectedDay || recordMs >= endOfSelectedDay) return;

      record.lines.forEach((line) => {
        const qty = Number(line.qty);
        const price = Number(line.price);
        const safeQty = Number.isFinite(qty) ? qty : 0;
        const safePrice = Number.isFinite(price) ? price : 0;
        const lineTotalRaw = Number(line.lineTotal);
        const safeLineTotal = Number.isFinite(lineTotalRaw) ? lineTotalRaw : safeQty * safePrice;

        if (!byItem[line.id]) {
          byItem[line.id] = {
            id: line.id,
            name: line.name,
            qtySold: 0,
            revenue: 0
          };
        }
        byItem[line.id].qtySold += safeQty;
        byItem[line.id].revenue += safeLineTotal;
      });
    });

    return Object.values(byItem)
      .map((item) => ({
        ...item,
        avgUnitPrice: item.qtySold === 0 ? 0 : item.revenue / item.qtySold
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [salesRecords, financeReportDate]);

  const selectedDateItemWiseTotals = useMemo(() => {
    return selectedDateItemWiseReport.reduce(
      (acc, item) => {
        acc.qtySold += item.qtySold;
        acc.revenue += item.revenue;
        return acc;
      },
      { qtySold: 0, revenue: 0 }
    );
  }, [selectedDateItemWiseReport]);

  function moveFinanceReportDate(days) {
    const current = new Date(`${financeReportDate}T00:00:00`);
    current.setDate(current.getDate() + days);
    setFinanceReportDate(toDateInputValue(current));
  }

  async function deleteTransaction(orderId) {
    if (!window.confirm("Are you sure to Delete?")) return;

    try {
      // Remove matching sales documents from Firestore
      const q = query(salesCollectionRef, where("id", "==", orderId));
      const snapshot = await getDocs(q);
      const batchDeletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(batchDeletes);
    } catch (err) {
      console.error("Failed to delete transaction from Firestore:", err);
      logClientEvent(db, "delete_transaction_failed", { message: String(err?.message || ""), code: err?.code || null, orderId });
      alert("Unable to delete transaction from cloud. Please try again.");
      return;
    }

    // Update local state so UI reflects the deletion immediately
    setSalesRecords((prev) => prev.filter((record) => record.id !== orderId));
  }

  function getStockCount(productId) {
    return Math.max(0, Number(inventory[productId] ?? 0));
  }

  function getCartQty(productId) {
    return Number(cart[productId]?.qty ?? 0);
  }

  function getAvailableCount(productId) {
    return Math.max(0, getStockCount(productId) - getCartQty(productId));
  }

  function addToCart(product) {
    setCart((prev) => {
      const stockCount = Number(inventory[product.id] ?? 0);
      if (stockCount <= 0) return prev;
      const current = prev[product.id];
      const currentQty = Number(current?.qty ?? 0);
      if (currentQty >= stockCount) return prev;
      const nextQty = current ? current.qty + 1 : 1;
      return {
        ...prev,
        [product.id]: {
          id: product.id,
          name: product.name,
          price: product.price,
          qty: nextQty
        }
      };
    });
  }

  function updateQty(productId, action) {
    setCart((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      if (action === "remove") {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      if (action === "inc") {
        const stockCount = Number(inventory[productId] ?? 0);
        if (item.qty >= stockCount) return prev;
      }

      const delta = action === "inc" ? 1 : -1;
      const nextQty = item.qty + delta;
      if (nextQty <= 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: { ...item, qty: nextQty }
      };
    });
  }

  async function confirmPayment() {
    if (cartItems.length === 0) return;

    const timestamp = new Date().toISOString();
    const orderId = buildOrderId(timestamp, salesRecords);
    const soldLines = cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      lineTotal: item.qty * item.price
    }));

    const receiptPayload = {
      orderId,
      timestamp,
      lines: soldLines,
      subtotal: totals.subtotal,
      total: totals.total
    };
    const isNativeAndroid = isAndroidAppRuntime();
    if (isNativeAndroid) {
      const printed = await triggerInstantPrint(receiptPayload);
      if (!printed) {
        alert("Order not created. Printer is not ready.");
        return;
      }
    }

    // 1) Persist full sale in Firestore /sales collection (unlimited history)
    try {
      await addDoc(salesCollectionRef, {
        id: orderId,
        orderId,
        timestamp: serverTimestamp(),
        itemsCount: totals.totalItems,
        subtotal: totals.subtotal,
        total: totals.total,
        lines: soldLines
      });
    } catch (err) {
      console.error("Failed to save sale to Firestore:", err);
      logClientEvent(db, "sale_persist_failed", { message: String(err?.message || ""), code: err?.code || null, orderId });
      alert("Order could not be saved. Please check your internet connection.");
      return;
    }

    // 2) Update local state so the UI reflects the new sale immediately
    setSalesRecords((prev) => [
      {
        id: orderId,
        orderId,
        timestamp: new Date().toISOString(),
        itemsCount: totals.totalItems,
        subtotal: totals.subtotal,
        total: totals.total,
        lines: soldLines
      },
      ...prev
    ]);

    setInventory((prev) => {
      const next = { ...prev };
      soldLines.forEach((line) => {
        const current = Number(next[line.id] ?? 0);
        next[line.id] = Math.max(0, current - line.qty);
      });
      return next;
    });

    setCart({});

    if (!isNativeAndroid) {
      await triggerInstantPrint(receiptPayload);
    }
  }

  async function triggerInstantPrint(receiptPayload) {
    const receiptText = buildReceiptText(receiptPayload);
    const isNativeAndroid = isAndroidAppRuntime();
    const isAndroidWeb = /Android/i.test(navigator.userAgent);

    if (isNativeAndroid) {
      try {
        await PrinterSettings.printText({ text: receiptText });
        return true;
      } catch {
        if (window.confirm("SH-Print is not available. Open Printer Settings now?")) {
          try {
            await PrinterSettings.openSettings();
          } catch {
            alert("Unable to open Printer Settings.");
          }
        }
        return false;
      }
    }

    if (isAndroidWeb) {
      try {
        launchRawbtText(receiptText);
        return true;
      } catch {
        // Fall back to browser popup.
      }
    }

    printViaBrowserReceiptPopup(receiptText);
    return true;
  }

  async function reprintTransaction(record) {
    if (!record) return;
    const payload = {
      orderId: record.id,
      timestamp: record.timestamp,
      lines: Array.isArray(record.lines) ? record.lines : [],
      subtotal: Number(record.subtotal ?? record.total ?? 0),
      total: Number(record.total ?? 0)
    };

    const printed = await triggerInstantPrint(payload);
    if (!printed && isAndroidAppRuntime()) {
      alert("Reprint failed. Order was not sent to printer.");
    }
  }

  async function openNativePrinterSettings() {
    const isNativeAndroid = isAndroidAppRuntime();
    if (!isNativeAndroid) {
      alert("Printer settings are available in the Android app.");
      return;
    }

    try {
      await PrinterSettings.openSettings();
    } catch {
      alert("Unable to open printer settings.");
    }
  }

  function openUpdateLink() {
    const updateUrl = String(appUpdateNotice?.url || "").trim();
    if (updateUrl) {
      window.open(updateUrl, "_blank");
      return;
    }
    alert("Update URL is not configured yet.");
  }

  function dismissUpdateNotice() {
    if (!appUpdateNotice || appUpdateNotice.type !== "soft") return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UPDATE_DISMISS_KEY, appUpdateNotice.targetVersion || "");
    }
    setAppUpdateNotice(null);
  }

  function onFormChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  }

  function onEditItem(item) {
    setIsAddItemOpen(false);
    setEditItemId(item.id);
    setFormData({
      name: item.name,
      price: String(item.price),
      img: item.img
    });
  }

  function onDeleteMenuItem(itemId) {
    if (soldItemIds.has(itemId)) {
      alert("This item cannot be deleted because it has sales/financial history.");
      return;
    }
    if (!window.confirm("Are you sure to Delete?")) return;

    setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
    setInventory((prev) => {
      const { [itemId]: _deleted, ...rest } = prev;
      return rest;
    });
    setCart((prev) => {
      const { [itemId]: _deleted, ...rest } = prev;
      return rest;
    });
    setMenuSetItems((prev) => {
      const next = {};
      Object.keys(prev).forEach((setName) => {
        next[setName] = (prev[setName] ?? []).filter((id) => id !== itemId);
      });
      return next;
    });

    if (editItemId === itemId) {
      resetForm();
    }
  }

  // Image is now URL-based only; user pastes a full image URL into the form.
  function onImageUrlChange(event) {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      img: value
    }));
  }

  function resetForm() {
    setEditItemId(null);
    setIsAddItemOpen(false);
    setFormData(emptyForm);
  }

  function onSaveMenuItem(event) {
    event.preventDefault();

    const name = formData.name.trim();
    const price = Number(formData.price);
    const img = formData.img.trim() || "https://images.unsplash.com/photo-1545324053-41b04f1a8e8a?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

    if (!name || Number.isNaN(price) || price < 0) {
      return;
    }

    if (editItemId) {
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === editItemId ? { ...item, name, price, img } : item
        )
      );

      setCart((prev) => {
        const current = prev[editItemId];
        if (!current) return prev;
        return {
          ...prev,
          [editItemId]: { ...current, name, price, img }
        };
      });
    } else {
      const nextId = menuItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      setMenuItems((prev) => [...prev, { id: nextId, name, price, img }]);
      setInventory((prev) => ({ ...prev, [nextId]: 0 }));
    }

    resetForm();
  }

  function setStockForItem(itemId, value) {
    const parsed = Number(value);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, Math.floor(parsed));
    setInventory((prev) => ({
      ...prev,
      [itemId]: safeValue
    }));
  }

  function adjustStock(itemId, delta) {
    setInventory((prev) => {
      const current = Number(prev[itemId] ?? 0);
      return {
        ...prev,
        [itemId]: Math.max(0, current + delta)
      };
    });
  }

  function onSaveMenuSet(event) {
    event.preventDefault();
    const normalizedName = menuSetName.trim();
    if (!normalizedName) return;

    if (editMenuSetIndex === null) {
      if (menuSets.some((item) => item.toLowerCase() === normalizedName.toLowerCase())) {
        return;
      }
      setMenuSets((prev) => [...prev, normalizedName]);
      setMenuSetItems((prev) => ({ ...prev, [normalizedName]: [] }));
      if (!selectedMenuSetForItems) setSelectedMenuSetForItems(normalizedName);
    } else {
      const currentName = menuSets[editMenuSetIndex];
      if (
        menuSets.some(
          (item, index) => index !== editMenuSetIndex && item.toLowerCase() === normalizedName.toLowerCase()
        )
      ) {
        return;
      }
      setMenuSets((prev) =>
        prev.map((item, index) => (index === editMenuSetIndex ? normalizedName : item))
      );
      setMenuSetItems((prev) => {
        const { [currentName]: currentSetItems = [], ...rest } = prev;
        return { ...rest, [normalizedName]: currentSetItems };
      });
      if (activeMenuSet === currentName) {
        setActiveMenuSet(normalizedName);
      }
      if (selectedMenuSetForItems === currentName) {
        setSelectedMenuSetForItems(normalizedName);
      }
    }

    setMenuSetName("");
    setEditMenuSetIndex(null);
  }

  function onEditMenuSet(index) {
    setEditMenuSetIndex(index);
    setMenuSetName(menuSets[index]);
    setActiveTab("Menu Set");
  }

  function onDeleteMenuSet(index) {
    if (!window.confirm("Are you sure to Delete?")) return;
    const deletingName = menuSets[index];
    setMenuSets((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setMenuSetItems((prev) => {
      const { [deletingName]: _deleted, ...rest } = prev;
      return rest;
    });
    if (activeMenuSet === deletingName) {
      setActiveMenuSet("All Menu");
    }
    if (selectedMenuSetForItems === deletingName) {
      const fallback = menuSets.find((_, i) => i !== index) ?? "";
      setSelectedMenuSetForItems(fallback);
    }
    if (expandedMenuSet === deletingName) {
      const fallback = menuSets.find((_, i) => i !== index) ?? null;
      setExpandedMenuSet(fallback);
    }
    if (editMenuSetIndex === index) {
      setEditMenuSetIndex(null);
      setMenuSetName("");
    }
  }

  function resetMenuSetForm() {
    setEditMenuSetIndex(null);
    setMenuSetName("");
  }

  function toggleItemInMenuSet(setName, itemId) {
    if (!setName) return;
    setExpandedMenuSet(setName);
    setMenuSetItems((prev) => {
      const current = prev[setName] ?? [];
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      return {
        ...prev,
        [setName]: next
      };
    });
  }

  function isItemInMenuSet(setName, itemId) {
    return (menuSetItems[setName] ?? []).includes(itemId);
  }

  function onClickMenuSetCard(setName) {
    setSelectedMenuSetForItems(setName);
    setExpandedMenuSet((prev) => (prev === setName ? null : setName));
  }

  function renderDashboard() {
    return (
      <div className="content-grid">
          <section className="menu-area">
            {!isCloudMenuReady ? (
              <p className="empty">Loading menu from cloud...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="empty">No items found for this selection.</p>
            ) : (
              <div className="menu-grid">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="menu-card">
                    <img src={product.img} alt={product.name} loading="lazy" />
                    <div className="card-meta">
                      <h3 className="card-name">{product.name}</h3>
                      <span className="price">{formatMoney(product.price)}</span>
                    </div>
                    <p className="stock-text">Available: {getAvailableCount(product.id)}</p>
                    <div className="card-qty-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => updateQty(product.id, "dec")}
                        disabled={getCartQty(product.id) <= 0}
                        aria-label={`Decrease ${product.name}`}
                      >
                        -
                      </button>
                      <span className="qty-value">{getCartQty(product.id)}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => addToCart(product)}
                        disabled={getAvailableCount(product.id) <= 0}
                        aria-label={`Increase ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="order-panel">
            <div className="order-head">
              <h2>Order Summary</h2>
              <span>{totals.totalItems} {totals.totalItems === 1 ? "item" : "items"}</span>
            </div>

            <ul className="cart-list">
              {cartItems.length === 0 ? (
                <li className="empty">No items yet. Add menu items to start an order.</li>
              ) : (
                cartItems.map((item) => (
                  <li key={item.id} className="cart-item">
                    <img
                      className="cart-item-image"
                      src={menuItemsById[item.id]?.img ?? item.img}
                      alt={item.name}
                      loading="lazy"
                    />
                    <div className="cart-item-details">
                      <div className="cart-row">
                        <div>
                          <span className="cart-name">{item.name}</span>
                          <p className="cart-unit-price">{formatMoney(item.price)}</p>
                        </div>
                        <button
                          className="remove icon-remove"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => {
                            if (!window.confirm("Are you sure to Delete?")) return;
                            updateQty(item.id, "remove");
                          }}
                        >
                          Del
                        </button>
                      </div>
                      <div className="qty-controls">
                        <button className="qty-btn" onClick={() => updateQty(item.id, "dec")}>-</button>
                        <span className="qty-value">{item.qty}</span>
                        <button
                          className="qty-btn"
                          onClick={() => updateQty(item.id, "inc")}
                          disabled={item.qty >= getStockCount(item.id)}
                        >
                          +
                        </button>
                      </div>
                      <strong className="cart-line-total">{formatMoney(item.price * item.qty)}</strong>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="totals">
              <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
              <div className="grand"><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
            </div>

            <div className="checkout-bar">
              <div className="checkout-count" aria-label={`Cart items ${totals.totalItems}`}>
                {totals.totalItems}
              </div>
              <button className="confirm" disabled={totals.totalItems === 0} onClick={confirmPayment}>
                Create Order
              </button>
            </div>
          </aside>
      </div>
    );
  }

  function renderNewOrder() {
    return (
      <div className="manager-shell manage-items-shell">
        <section className="manager-panel">
          <div className="manager-header">
            <h2>All Menu Items</h2>
            <span>{menuItems.length} total items</span>
          </div>

          <div className="manager-actions">
            <button
              className="confirm"
              type="button"
              onClick={() => {
                setEditItemId(null);
                setFormData(emptyForm);
                setIsAddItemOpen(true);
              }}
            >
              Add Menu Item
            </button>
            {isAddItemOpen ? (
              <button className="muted-btn" type="button" onClick={resetForm}>Cancel</button>
            ) : (
              <span />
            )}
          </div>

          {isAddItemOpen ? (
            <form className="inline-edit-card" onSubmit={onSaveMenuItem}>
              <div className="manager-header">
                <h2>Add New Menu Item</h2>
                <span>Create</span>
              </div>
              <label htmlFor="addName">Menu Name</label>
              <input
                id="addName"
                name="name"
                value={formData.name}
                onChange={onFormChange}
                placeholder="e.g. Chicken Biryani"
                required
              />
              <label htmlFor="addPrice">Price (Rs.)</label>
              <input
                id="addPrice"
                name="price"
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={onFormChange}
                placeholder="e.g. 350"
                required
              />
              <label htmlFor="addImageUrl">Image URL (optional)</label>
              <input
                id="addImageUrl"
                name="imgUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.img}
                onChange={onImageUrlChange}
              />
              {formData.img ? (
                <div className="image-preview">
                  <img src={formData.img} alt="New menu item" />
                </div>
              ) : null}
              <div className="manager-actions">
                <button className="confirm" type="submit">Add Menu</button>
                <button className="muted-btn" type="button" onClick={resetForm}>Clear</button>
              </div>
            </form>
          ) : null}

          <div className="manager-list all-menu-card-list">
            {menuItems.map((item) => (
              <React.Fragment key={item.id}>
                <article className="manager-item">
                  <img src={item.img} alt={item.name} loading="lazy" />
                  <div className="manager-item-meta">
                    <h3>{item.name}</h3>
                    <p>{formatMoney(item.price)} | Stock: {getStockCount(item.id)}</p>
                  </div>
                  <div className="item-actions">
                    <button className="edit-btn" onClick={() => onEditItem(item)}>Edit Menu</button>
                    {soldItemIds.has(item.id) ? (
                      <button className="delete-btn" type="button" disabled title="Has financial history">
                        Locked (Sold)
                      </button>
                    ) : (
                      <button className="delete-btn" type="button" onClick={() => onDeleteMenuItem(item.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </article>

                {editItemId === item.id ? (
                  <form className="inline-edit-card" onSubmit={onSaveMenuItem}>
                    <div className="manager-header">
                      <h2>Edit Menu Item</h2>
                      <span>ID #{item.id}</span>
                    </div>
                    <label htmlFor={`inlineName-${item.id}`}>Menu Name</label>
                    <input
                      id={`inlineName-${item.id}`}
                      name="name"
                      value={formData.name}
                      onChange={onFormChange}
                      required
                    />

                    <label htmlFor={`inlinePrice-${item.id}`}>Price (Rs.)</label>
                    <input
                      id={`inlinePrice-${item.id}`}
                      name="price"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.price}
                      onChange={onFormChange}
                      required
                    />

                    <label htmlFor={`inlineImageUrl-${item.id}`}>Image URL (optional)</label>
                    <input
                      id={`inlineImageUrl-${item.id}`}
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={formData.img}
                      onChange={onImageUrlChange}
                    />

                    {formData.img ? (
                      <div className="image-preview">
                        <img src={formData.img} alt="Edited menu item" />
                      </div>
                    ) : null}

                    <div className="manager-actions">
                      <button className="confirm" type="submit">Update Menu</button>
                      <button className="muted-btn" type="button" onClick={resetForm}>Cancel</button>
                    </div>
                  </form>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderInventory() {
    return (
      <div className="inventory-shell">
        <section className="manager-panel">
          <div className="manager-header">
            <h2>Inventory</h2>
            <span>{inventorySummary.totalStock} items in stock</span>
          </div>
          <div className="inventory-meta">
            <span className="stock-pill">Low stock items: {inventorySummary.lowStock}</span>
            <span className="stock-pill">Realtime available updates active</span>
          </div>
          <div className="manager-list inventory-card-list">
            {menuItems.map((item) => (
              <article
                key={item.id}
                className={"inventory-item" + (getStockCount(item.id) <= 5 ? " low-stock" : "")}
              >
                <img src={item.img} alt={item.name} loading="lazy" />
                <div className="inventory-item-meta">
                  <h3>{item.name}</h3>
                  <p>{formatMoney(item.price)}</p>
                  <div className="inventory-counts">
                    <span>On Hand: {getStockCount(item.id)}</span>
                    <span>In Cart: {getCartQty(item.id)}</span>
                    <span className="ok-count">Available: {getAvailableCount(item.id)}</span>
                  </div>
                </div>
                <div className="stock-controls">
                  <button className="qty-btn" onClick={() => adjustStock(item.id, -1)}>-</button>
                  <input
                    type="number"
                    min="0"
                    value={getStockCount(item.id)}
                    onChange={(event) => setStockForItem(item.id, event.target.value)}
                  />
                  <button className="qty-btn" onClick={() => adjustStock(item.id, 1)}>+</button>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    );
  }

  function renderMenuSet() {
    return (
      <div className="manager-shell menu-set-shell">
        <section className="manager-panel">
          <div className="manager-header">
            <h2>Menu Set Options</h2>
            <span>{menuSets.length} custom sets</span>
          </div>
          <div className="manager-list">
            {menuSets.map((setName, index) => (
              <article key={`${setName}-${index}`} className="manager-item set-item">
                <button type="button" className="set-item-main" onClick={() => onClickMenuSetCard(setName)}>
                  <div className="manager-item-meta">
                    <h3>{setName}</h3>
                    <p>
                      {(menuSetItems[setName] ?? []).length === 0
                        ? "No items assigned"
                        : (menuSetItems[setName] ?? [])
                          .map((itemId) => menuItemsById[itemId]?.name)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ")}
                    </p>
                  </div>
                  <span className="set-count">{(menuSetItems[setName] ?? []).length} items</span>
                </button>
                <div className="set-actions">
                  <button className="edit-btn" onClick={() => onEditMenuSet(index)}>Edit</button>
                  <button className="remove" onClick={() => onDeleteMenuSet(index)}>Delete</button>
                </div>
                {expandedMenuSet === setName ? (
                  <div className="set-preview">
                    {(menuSetItems[setName] ?? []).length === 0 ? (
                      <p className="empty">No items added yet.</p>
                    ) : (
                      (menuSetItems[setName] ?? []).map((itemId) => {
                        const item = menuItemsById[itemId];
                        if (!item) return null;
                        return (
                          <span key={`${setName}-${itemId}`} className="set-preview-item">
                            {item.name}
                          </span>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="manager-panel">
          <div className="manager-header">
            <h2>{editMenuSetIndex === null ? "Add Menu Set" : "Edit Menu Set"}</h2>
            <span>{editMenuSetIndex === null ? "Create" : "Update"}</span>
          </div>
          <form className="manager-form" onSubmit={onSaveMenuSet}>
            <label htmlFor="menuSetName">Menu Set Name</label>
            <input
              id="menuSetName"
              value={menuSetName}
              onChange={(event) => setMenuSetName(event.target.value)}
              placeholder="e.g. Drinks"
              required
            />
            <div className="manager-actions">
              <button className="confirm" type="submit">{editMenuSetIndex === null ? "Add Set" : "Update Set"}</button>
              <button className="muted-btn" type="button" onClick={resetMenuSetForm}>Clear</button>
            </div>
          </form>

          <div className="set-assign">
            <div className="manager-header">
              <h2>Add Items From Inventory</h2>
              <span>{selectedMenuSetForItems || "No set selected"}</span>
            </div>
            <label htmlFor="setPicker">Select Menu Set</label>
            <select
              id="setPicker"
              value={selectedMenuSetForItems}
              onChange={(event) => setSelectedMenuSetForItems(event.target.value)}
              disabled={menuSets.length === 0}
            >
              {menuSets.length === 0 ? (
                <option value="">No menu sets yet</option>
              ) : (
                menuSets.map((setName) => (
                  <option key={setName} value={setName}>{setName}</option>
                ))
              )}
            </select>

            <div className="assign-list">
              {menuItems.map((item) => (
                <label key={item.id} className="assign-item">
                  <input
                    type="checkbox"
                    checked={isItemInMenuSet(selectedMenuSetForItems, item.id)}
                    onChange={() => toggleItemInMenuSet(selectedMenuSetForItems, item.id)}
                    disabled={!selectedMenuSetForItems}
                  />
                  <span>{item.name}</span>
                  <small>Stock: {getStockCount(item.id)}</small>
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderFinance() {
    const currentYear = new Date().getFullYear();

    function onPrintTodayItemBreakup() {
      printFinanceTable({
        title: "Today Item Wise Breakup",
        subtitle: formatDateShort(new Date(`${financeReportDate}T00:00:00`)),
        columns: ["Item", "QxR", "Rev"],
        rows: selectedDateItemWiseReport.map((item) => [
          String(item.name ?? "").slice(0, 14),
          `${item.qtySold.toLocaleString("en-PK")}x${formatCompactAmount(item.avgUnitPrice)}`,
          formatCompactAmount(item.revenue)
        ]),
        footer: [
          "Total",
          selectedDateItemWiseTotals.qtySold.toLocaleString("en-PK"),
          formatCompactAmount(selectedDateItemWiseTotals.revenue)
        ]
      });
    }

    function onPrintMonthItemBreakup() {
      printFinanceTable({
        title: `${MONTH_NAMES[selectedFinanceMonth]} Item Wise Breakup`,
        columns: ["Menu Item", "Qty Sold", "Revenue"],
        rows: selectedMonthItemWiseReport.map((item) => [
          item.name,
          item.qtySold.toLocaleString("en-PK"),
          formatMoney(item.revenue)
        ]),
        footer: [
          "Total",
          `Total Qty: ${selectedMonthItemWiseTotals.qtySold.toLocaleString("en-PK")}`,
          formatMoney(selectedMonthItemWiseTotals.revenue)
        ]
      });
    }

    function onPrintMenuWiseTable() {
      printFinanceTable({
        title: `Menu Wise Sales Report (${currentYear})`,
        columns: ["Item", "Qty x Rate", "Rev"],
        rows: menuWiseReport.map((item) => [
          String(item.name ?? "").slice(0, 14),
          `${item.qtySold.toLocaleString("en-PK")} x ${formatMoney(item.avgUnitPrice)}`,
          formatCompactAmount(item.revenue)
        ]),
        footer: [
          "Total",
          menuWiseTotals.qtySold.toLocaleString("en-PK"),
          formatCompactAmount(menuWiseTotals.revenue)
        ]
      });
    }

    return (
      <div className="finance-shell">
        <header className="topbar">
          <div className="filters">
            <button
              type="button"
              className={`chip ${activeMenuSet === "All Menu" ? "active" : ""}`}
              onClick={() => setActiveMenuSet("All Menu")}
            >
              All Menu
            </button>
            {menuSets.map((setName) => (
              <button
                key={setName}
                type="button"
                className={`chip ${activeMenuSet === setName ? "active" : ""}`}
                onClick={() => setActiveMenuSet(setName)}
              >
                {setName}
              </button>
            ))}
          </div>
        </header>
        <section className="finance-kpis">
          <article className="finance-card">
            <p>Total Sales (Rs.)</p>
            <h3>{formatMoney(financeSummary.totalRevenue)}</h3>
          </article>
          <article className="finance-card">
            <p>Items Sold</p>
            <h3>{financeSummary.totalItemsSold.toLocaleString("en-PK")}</h3>
          </article>
        </section>

        <section className="manager-panel">
          <div className="manager-header">
            <h2>Sales Window</h2>
            <span>Realtime financial analytics</span>
          </div>
          <div className="finance-window">
            <article className="finance-window-card finance-window-button active">
              <span>Daily Sale</span>
              <strong>{formatMoney(financeSummary.dailySale)}</strong>
            </article>
            <article className="finance-window-card">
              <span>Weekly Sale</span>
              <strong>{formatMoney(financeSummary.weeklySale)}</strong>
            </article>
            <article className="finance-window-card">
              <span>This Month Sale</span>
              <strong>{formatMoney(financeSummary.monthlySale)}</strong>
            </article>
          </div>
          <div className="finance-detail-card">
            <div className="manager-header">
              <h2>Today Item Wise Breakup</h2>
              <div className="finance-header-actions">
                <span>{selectedDateItemWiseReport.length} items sold</span>
                <button
                  type="button"
                  className="muted-btn"
                  onClick={onPrintTodayItemBreakup}
                  disabled={selectedDateItemWiseReport.length === 0}
                >
                  Print
                </button>
              </div>
            </div>
            <div className="finance-date-controls">
              <button type="button" className="muted-btn" onClick={() => moveFinanceReportDate(-1)}>Previous Day</button>
              <input
                type="date"
                value={financeReportDate}
                max={toDateInputValue(new Date())}
                onChange={(event) => setFinanceReportDate(event.target.value)}
              />
              <button type="button" className="muted-btn" onClick={() => setFinanceReportDate(toDateInputValue(new Date()))}>Today</button>
            </div>
            {selectedDateItemWiseReport.length === 0 ? (
              <p className="empty">No item sales recorded for this date.</p>
            ) : (
              <div className="finance-table-wrap">
                <table className="finance-table finance-mobile-stack">
                  <thead>
                    <tr>
                      <th>Menu Item</th>
                      <th>Quantity</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateItemWiseReport.map((item) => (
                      <tr key={`date-${financeReportDate}-${item.id}`}>
                        <td data-label="Menu Item">{item.name} <small className="scope-tag today">Today</small></td>
                        <td data-label="Qty x Rate">{item.qtySold.toLocaleString("en-PK")} x {formatMoney(item.avgUnitPrice)}</td>
                        <td data-label="Revenue">{formatMoney(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th>{selectedDateItemWiseTotals.qtySold.toLocaleString("en-PK")}</th>
                      <th>{formatMoney(selectedDateItemWiseTotals.revenue)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <div className="finance-month-grid">
            {monthWiseSales.map((item, index) => (
              <button
                key={item.month}
                type="button"
                className={`finance-month-card ${isMonthBreakupVisible && selectedFinanceMonth === index ? "active" : ""}`}
                onClick={() => {
                  setSelectedFinanceMonth(index);
                  setIsMonthBreakupVisible(true);
                }}
              >
                <span>{item.month}</span>
                <strong>{formatMoney(item.total)}</strong>
              </button>
            ))}
          </div>
          {isMonthBreakupVisible ? (
            <div className="finance-detail-card">
              <div className="manager-header">
                <h2>{MONTH_NAMES[selectedFinanceMonth]} Item Wise Breakup</h2>
                <div className="finance-header-actions">
                  <span>{selectedMonthItemWiseReport.length} items sold in {MONTH_NAMES[selectedFinanceMonth]}</span>
                  <button
                    type="button"
                    className="muted-btn"
                    onClick={onPrintMonthItemBreakup}
                    disabled={selectedMonthItemWiseReport.length === 0}
                  >
                    Print
                  </button>
                </div>
              </div>
              {selectedMonthItemWiseReport.length === 0 ? (
                <p className="empty">No item sales recorded for {MONTH_NAMES[selectedFinanceMonth]}.</p>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table finance-mobile-stack">
                    <thead>
                      <tr>
                        <th>Menu Item</th>
                        <th>Qty Sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMonthItemWiseReport.map((item) => (
                        <tr key={`month-${selectedFinanceMonth}-${item.id}`}>
                          <td data-label="Menu Item">{item.name} <small className="scope-tag">Month</small></td>
                          <td data-label="Qty Sold">{item.qtySold.toLocaleString("en-PK")}</td>
                          <td data-label="Revenue">{formatMoney(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <th>Total Qty: {selectedMonthItemWiseTotals.qtySold.toLocaleString("en-PK")}</th>
                        <th>{formatMoney(selectedMonthItemWiseTotals.revenue)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="manager-panel">
          <div className="manager-header">
            <h2>Menu Wise Sales Report</h2>
            <div className="finance-header-actions">
              <span>{menuWiseReport.length} menu items sold</span>
              <button
                type="button"
                className="muted-btn"
                onClick={onPrintMenuWiseTable}
                disabled={menuWiseReport.length === 0}
              >
                Print
              </button>
            </div>
          </div>
          {menuWiseChartData.topItems.length > 0 ? (
            <div className="finance-chart">
              <h3>Menu Wise Sale Chart (Yearly Analytic : {currentYear})</h3>
              <div className="finance-chart-list">
                {menuWiseChartData.topItems.map((item) => {
                  const widthPct = menuWiseChartData.maxRevenue > 0
                    ? (item.revenue / menuWiseChartData.maxRevenue) * 100
                    : 0;
                  return (
                    <div key={`chart-${item.id}`} className="finance-chart-row">
                      <div className="finance-chart-labels">
                        <span>
                          {item.name} <small className="scope-tag">Whole</small>
                          <small className="scope-tag">Qty: {item.qtySold.toLocaleString("en-PK")}</small>
                        </span>
                        <strong>{formatMoney(item.revenue)}</strong>
                      </div>
                      <div className="finance-chart-track">
                        <div className="finance-chart-fill" style={{ width: `${Math.max(5, widthPct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {menuWiseReport.length === 0 ? (
            <p className="empty">No menu-wise data yet. Confirm orders to generate this report.</p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table finance-mobile-stack">
                <thead>
                  <tr>
                    <th>Menu Item</th>
                    <th>Qty x Rate</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {menuWiseReport.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Menu Item">{item.name} <small className="scope-tag">Whole</small></td>
                      <td data-label="Quantity">{item.qtySold.toLocaleString("en-PK")}</td>
                      <td data-label="Revenue">{formatMoney(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>Total Qty: {menuWiseTotals.qtySold.toLocaleString("en-PK")}</th>
                    <th>{formatMoney(menuWiseTotals.revenue)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="manager-panel">
          <div className="manager-header">
            <h2>Recent Transactions</h2>
            <span>{filteredTransactions.length} filtered / {salesRecords.length} total</span>
          </div>
          <div className="tx-controls">
            <input
              type="search"
              placeholder="Search order id or item..."
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
            />
            <input
              type="date"
              value={transactionDateFrom}
              max={toDateInputValue(new Date())}
              onChange={(event) => setTransactionDateFrom(event.target.value)}
            />
            <input
              type="date"
              value={transactionDateTo}
              max={toDateInputValue(new Date())}
              onChange={(event) => setTransactionDateTo(event.target.value)}
            />
            <button type="button" className="muted-btn" onClick={() => {
              setTransactionSearch("");
              setTransactionDateFrom("");
              setTransactionDateTo("");
            }}>
              Clear
            </button>
          </div>
          {filteredTransactions.length === 0 ? (
            <p className="empty">No transactions match current filters.</p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((record) => (
                    <tr key={record.id}>
                      <td data-label="Order ID">
                        <button
                          type="button"
                          className="tx-id-btn"
                          onClick={() => reprintTransaction(record)}
                          title="Reprint this receipt"
                        >
                          {record.id}
                        </button>
                      </td>
                      <td data-label="Date">{formatDateShort(record.timestamp)}</td>
                      <td data-label="Items">{record.itemsCount}</td>
                      <td data-label="Amount">{formatMoney(record.total)}</td>
                      <td data-label="Action">
                        <button type="button" className="muted-btn" onClick={() => reprintTransaction(record)}>
                          Reprint
                        </button>
                        <button type="button" className="remove" onClick={() => deleteTransaction(record.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredTransactions.length > 0 ? (
            <div className="tx-pagination">
              <button
                type="button"
                className="muted-btn"
                disabled={transactionPage <= 1}
                onClick={() => setTransactionPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <div className="tx-page-numbers">
                {transactionPageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`tx-page-btn ${transactionPage === page ? "active" : ""}`}
                    onClick={() => setTransactionPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <span>Page {transactionPage} of {totalTransactionPages}</span>
              <button
                type="button"
                className="muted-btn"
                disabled={transactionPage >= totalTransactionPages}
                onClick={() => setTransactionPage((prev) => Math.min(totalTransactionPages, prev + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderPlaceholder() {
    return (
      <section className="placeholder-panel">
        <h2>{activeTab}</h2>
        <p>This section is ready for the next module.</p>
      </section>
    );
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    const email = loginEmail.trim();
    const password = loginPassword.trim();

    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        setLoginEmail("");
        setLoginPassword("");
        setLoginError("");
      })
      .catch((error) => {
        const code = String(error?.code || "");
        if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
          setLoginError("Invalid email or password.");
          return;
        }
        if (code === "auth/invalid-email") {
          setLoginError("Please enter a valid email address.");
          return;
        }
        setLoginError("Login failed. Please try again.");
      });
  }

  function handleLogout() {
    signOut(auth)
      .then(() => {
        setLoginPassword("");
        setLoginError("");
      })
      .catch(() => {
        setLoginError("Logout failed. Please try again.");
      });
  }

  if (!isAuthReady) {
    return (
      <>
        <div className="bg-orb bg-orb-a" />
        <div className="bg-orb bg-orb-b" />
        <main className="login-shell">
          <section className="login-card login-card--loading">
            <div className="login-brand">
              <img className="brand-logo login-logo" src={appLogo} alt="Sultanabad Canteen logo" />
              <div>
                <h1>Sultanabad Canteen</h1>
                <p>Checking session...</p>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!authSession) {
    return (
      <>
        <div className="bg-orb bg-orb-a" />
        <div className="bg-orb bg-orb-b" />
        <main className="login-shell">
          <section className="login-card">
            <div className="login-hero">
              <div className="login-brand">
                <img className="brand-logo login-logo" src={appLogo} alt="Sultanabad Canteen logo" />
                <div>
                  <h1>Sultanabad Canteen</h1>
                  <p>Smart POS Dashboard</p>
                </div>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in with email to continue Inventory and finance reports.</p>
            </div>
            <form className="login-form" onSubmit={handleLoginSubmit}>
              <h3>Login</h3>
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="email"
                required
              />
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              {loginError ? <p className="login-error">{loginError}</p> : null}
              <button type="submit" className="confirm">Login</button>
              <p className="login-help">Use your provided credentials.</p>
              <p className="login-credit">@ Designed by Shaheen Hirani</p>
            </form>

            {isAndroidDevice() && (
              <section className="apk-download-card">
                <h3>Install Android App</h3>
                <p>For faster access, install the Sultanabad Canteen POS app on this Android device.</p>
                <a href={APK_DOWNLOAD_URL} className="apk-download-button">
                  Download Android APK
                </a>
                <p className="apk-download-note">
                  After download, open the file and allow installation from this source.
                </p>
              </section>
            )}
          </section>
        </main>
      </>
    );
  }

  const authEmail = String(authSession?.email || "").trim();
  const userLabel = authEmail ? authEmail.replace(/@gmail\.com$/i, "").replace(/@.*/, "") : "";

  return (
    <>
      {appUpdateNotice?.type === "force" ? (
        <div className="update-overlay">
          <div className="update-card">
            <h2>Update Required</h2>
            <p>{appUpdateNotice.message}</p>
            <p className="update-version">Current: {APP_VERSION} | Required: {appUpdateNotice.targetVersion}</p>
            <button type="button" className="confirm" onClick={openUpdateLink}>Update App</button>
          </div>
        </div>
      ) : null}
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />

      <main className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <img className="brand-logo" src={appLogo} alt="Sultanabad Canteen logo" />
            <div className="brand-main">
              <h1>SultanabaD Canteen</h1>
              <p>Retail Console</p>
              <p className="sync-status brand-sync-status">{syncStatus}</p>
              {activeTab === "Finance" ? (
                <button type="button" className="muted brand-printer-btn" onClick={openNativePrinterSettings}>
                  Printer Settings
                </button>
              ) : null}
            </div>
            <div className="brand-session">
              <span className="panel-user">{userLabel ? `User: ${userLabel}` : ""}</span>
              <button type="button" className="muted logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          <nav className="nav">
            {navItems.map((item) => (
              <button
                key={item}
                className={`nav-item ${activeTab === item ? "active" : ""}`}
                onClick={() => setActiveTab(item)}
              >
                {item}
              </button>
            ))}
          </nav>

        </aside>

        <section className="panel">
          <div className="panel-header">
            <span className="panel-user">{userLabel ? `User: ${userLabel}` : ""}</span>
            <button type="button" className="muted logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
          {appUpdateNotice?.type === "soft" ? (
            <div className="update-banner">
              <span>{appUpdateNotice.message}</span>
              <div className="update-actions">
                <button type="button" className="muted-btn" onClick={openUpdateLink}>Update</button>
                <button type="button" className="remove" onClick={dismissUpdateNotice}>Later</button>
              </div>
            </div>
          ) : null}
          {activeTab === "Dashboard" && renderDashboard()}
          {activeTab === "Manage Items" && renderNewOrder()}
          {activeTab === "Inventory" && renderInventory()}
          {activeTab === "Menu Set" && renderMenuSet()}
          {activeTab === "Finance" && renderFinance()}
          {activeTab !== "Dashboard" && activeTab !== "Manage Items" && activeTab !== "Inventory" && activeTab !== "Menu Set" && activeTab !== "Finance" && renderPlaceholder()}
        </section>
      </main>
    </>
  );
}

