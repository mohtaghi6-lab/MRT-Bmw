import React, { useState } from "react";
import { Download, Smartphone, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { carAudio } from "../utils/carSpeech";

export const PWAInstallButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const isRunningInApk =
    typeof window !== "undefined" &&
    (window.location.hostname === "bmw728li.local" ||
      (window.navigator.userAgent || "").includes("wv"));

  if (isRunningInApk) {
    return null;
  }

  const handleDownloadAndroidKotlin = () => {
    carAudio.playButtonTap();
    const kotlinCode = `package com.bmw728li.idrive

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    companion object {
        private const val LOCAL_APP_URL = "https://bmw728li.local/index.html"
        private const val REQ_PERMISSIONS = 101
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val neededPermissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ).filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (neededPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, neededPermissions.toTypedArray(), REQ_PERMISSIONS)
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("bmw728li.local")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                callback.invoke(origin, true, false)
            }
        }

        // اجرای کاملاً آفلاین بدون نیاز به لینک اینترنتی فیلترشده
        webView.loadUrl(LOCAL_APP_URL)
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
      <button
        id="android-apk-download-btn"
        type="button"
        onClick={() => {
          carAudio.playButtonTap();
          setShowModal(true);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0"
        title="دانلود مستقیم اپلیکیشن اندروید آفلاین برای مانیتور خودرو (بدون نیاز به مرورگر یا لینک فیلترشده)"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>اپ اندروید (APK)</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          dir="rtl"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#071214] border border-teal-300/25 p-5 shadow-2xl flex flex-col gap-3.5 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">اپلیکیشن مستقل اندروید مانیتور خودرو</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-3">
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/35 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>اجرای ۱۰۰٪ آفلاین روی مانیتور بدون فیلترشکن</span>
                </div>
                <p className="text-[11px] text-emerald-100/85">
                  فایل نصبی اندروید تمام کدهای برنامه را داخل خود اپلیکیشن نگه می‌دارد و به لینک‌های مسدودشده اینترنتی وابسته نیست.
                </p>
              </div>

              <a
                href={`${import.meta.env.BASE_URL}bmw728li-idrive.apk`}
                download="bmw728li-idrive.apk"
                onClick={() => carAudio.playLockBeep(true)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Download className="w-4 h-4" />
                <span>دانلود فایل نصب اندروید (bmw728li-idrive.apk)</span>
              </a>

              <div className="rounded-xl bg-black/45 border border-white/10 p-3 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>راهنمای نصب روی مانیتور خودرو:</span>
                </div>
                <p>
                  فایل <strong>bmw728li-idrive.apk</strong> را با فلش به مانیتور اندروید خودرو منتقل کرده و مستقیماً نصب کنید (نیازی به باز کردن لینک یا مرورگر در خودرو نیست).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleDownloadAndroidKotlin}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>سورس Android (MainActivity.kt آفلاین)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition"
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
