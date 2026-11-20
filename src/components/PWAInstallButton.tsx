import React, { useState } from "react";
import { Download, Smartphone, Copy, Check, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isRunningInApk =
    typeof window !== "undefined" && window.location.hostname === "bmw728li.local";

  if (isInstalled || isRunningInApk) {
    return null;
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCopyUrl = () => {
    if (!appUrl) return;
    navigator.clipboard?.writeText(appUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadAndroidKotlin = () => {
    const kotlinCode = `package com.bmw728li.idrive

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    companion object {
        const val APP_URL = "${appUrl}/?car_install=1"
        const val ANDROID_API_KEY = "bmw728li-android-9f4c2a8e1d7b"
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = if (isNetworkAvailable()) {
                WebSettings.LOAD_DEFAULT
            } else {
                WebSettings.LOAD_CACHE_ELSE_NETWORK
            }
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.loadUrl(APP_URL)
    }
}
`;
    const blob = new Blob([kotlinCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MainActivity.kt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {isInstallable && (
          <button
            id="pwa-native-install-btn"
            type="button"
            onClick={() => {
              void install();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bmw-accent-btn text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0"
            title="نصب مستقیم روی مانیتور خودرو (پشتیبانی کامل آفلاین و مچ خودکار)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">نصب روی مانیتور</span>
          </button>
        )}

        <button
          id="pwa-install-btn"
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0"
          title="نصب برنامه آفلاین / دانلود فایل APK برای اندروید و مانیتور ماشین"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isInstallable ? "APK" : "نصب روی ماشین"}</span>
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          dir="rtl"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl flex flex-col gap-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">نصب روی مانیتور ماشین و اجرای آفلاین</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white p-1"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-neutral-300 leading-relaxed space-y-3">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const installed = await install();
                    if (installed) setShowModal(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl bmw-accent-btn text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>نصب سریع PWA روی مانیتور (آفلاین + مچ خودکار)</span>
                </button>
              )}

              {isIOS && (
                <div className="rounded-xl bg-sky-950/50 border border-sky-500/30 p-2.5 text-[11px] text-sky-200">
                  در آیفون/آیپد: دکمه <strong>Share</strong> را بزنید و گزینه{" "}
                  <strong>Add to Home Screen</strong> را انتخاب کنید.
                </div>
              )}

              <a
                href="/bmw728li-idrive.apk"
                download="bmw728li-idrive.apk"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Download className="w-4 h-4" />
                <span>دانلود مستقیم bmw728li-idrive.apk</span>
              </a>

              <p>
                <strong>اجرای ۱۰۰٪ آفلاین و کالیبراسیون خودکار:</strong>
                <br />
                پس از نصب روی مانیتور اندرویدی خودرو یا شبیه‌ساز{" "}
                <strong>Nox</strong>، برنامه به‌صورت خودکار رزولوشن مانیتور را تشخیص داده، کش‌های قدیمی را ریست کرده و پروتکل‌های BMW 728Li را با مانیتور خودرو مچ می‌کند و بدون نیاز به اینترنت اجرا می‌شود.
              </p>

              <div className="flex items-center justify-between gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-2.5">
                <span className="text-[11px] font-mono text-sky-300 truncate" dir="ltr">
                  {appUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-white flex items-center gap-1 shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? "کپی شد" : "کپی آدرس"}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={handleDownloadAndroidKotlin}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>سورس Kotlin (آفلاین WebView)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
