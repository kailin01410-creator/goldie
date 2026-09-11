import React, { useState } from 'react';
import { 
  Smartphone, 
  X, 
  Usb, 
  QrCode, 
  Download, 
  Check, 
  Copy, 
  ExternalLink, 
  Terminal, 
  ShieldCheck, 
  Layers, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const [activeMethod, setActiveMethod] = useState<'pwa' | 'usb_inspect' | 'apk_adb'>('pwa');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-4oro4xymfxn57rybyse36d-209771456248.asia-east1.run.app';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  // Fast SVG QR code URL using quickchart qr or api
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}&bgcolor=121824&color=F59E0B&margin=1`;

  return (
    <div 
      id="android-install-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-mono select-none overflow-y-auto"
    >
      <div className="bg-[#0D121D] border border-amber-500/40 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl shadow-amber-950/40 relative my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                Android Ready
              </span>
              <span className="text-[10px] text-slate-400">PWA & USB Debugging Guide</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">
              Install On Android Phone
            </h2>
          </div>
        </div>

        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#070A10] rounded-xl border border-[#1E2638] mb-5 text-xs">
          <button
            onClick={() => setActiveMethod('pwa')}
            className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'pwa'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="truncate">1. Instant PWA (Recommended)</span>
          </button>

          <button
            onClick={() => setActiveMethod('usb_inspect')}
            className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'usb_inspect'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            <span className="truncate">2. USB Debugging</span>
          </button>

          <button
            onClick={() => setActiveMethod('apk_adb')}
            className={`py-2 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'apk_adb'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="truncate">3. Native APK / ADB</span>
          </button>
        </div>

        {/* TAB 1: Instant PWA */}
        {activeMethod === 'pwa' && (
          <div className="space-y-4 text-xs">
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
              {/* QR Code */}
              <div className="bg-[#0B0E14] p-2 rounded-lg border border-amber-500/30 shrink-0 text-center">
                <img 
                  src={qrCodeUrl} 
                  alt="Scan QR code with Android phone camera" 
                  className="w-32 h-32 rounded object-contain mx-auto"
                />
                <span className="text-[9px] text-amber-400 mt-1 block">Scan with Phone Camera</span>
              </div>

              {/* URL & Explanation */}
              <div className="flex-1 space-y-2 text-slate-300">
                <p className="font-semibold text-white">
                  No Cables or App Store Required!
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The terminal is pre-configured with a Web App Manifest and offline guards. You can install it straight to your Android home screen as a standalone fullscreen app.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={currentUrl}
                    className="flex-1 bg-[#080B10] border border-[#232D42] rounded px-2.5 py-1.5 text-[11px] text-slate-300 font-mono select-all truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-[#232D42] font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="bg-[#080B10] border border-[#1E2638] rounded-xl p-4 space-y-2.5">
              <div className="text-amber-400 font-bold uppercase text-[11px] flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" /> 3 Steps to Install on Android:
              </div>
              <ol className="space-y-2 text-[11px] text-slate-300 list-decimal list-inside">
                <li className="leading-relaxed">
                  Open <strong className="text-white">Google Chrome</strong> or Samsung Internet on your Android phone.
                </li>
                <li className="leading-relaxed">
                  Navigate to your App URL (or scan the QR code above).
                </li>
                <li className="leading-relaxed">
                  Tap the <strong className="text-amber-300">⋮ (three dots menu)</strong> in the top-right corner of Chrome, and select <strong className="text-emerald-400">"Install app"</strong> (or "Add to Home screen").
                </li>
              </ol>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-[#1E2638]">
                ✓ The terminal will launch as an independent app icon (<strong className="text-amber-300">ScalpEdge</strong>) with no browser address bars and dedicated hardware acceleration.
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USB Debugging */}
        {activeMethod === 'usb_inspect' && (
          <div className="space-y-3 text-xs">
            <div className="bg-[#121824] border border-blue-500/30 rounded-xl p-4 text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Usb className="w-4 h-4" />
                <span>USB Debugging & Chrome Remote Port Forwarding</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If you are running the project locally on your computer via USB or want to inspect and test directly on a connected Android phone using USB Debugging, follow these steps:
              </p>
            </div>

            <div className="bg-[#080B10] border border-[#1E2638] rounded-xl p-4 space-y-3 text-[11px] text-slate-300">
              <div className="space-y-2">
                <strong className="text-amber-300 block">Step 1: Enable USB Debugging on your Android Phone</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                  <li>Go to <span className="text-white">Settings &gt; About Phone</span>.</li>
                  <li>Tap <span className="text-white font-semibold">Build Number</span> 7 times until you see "You are now a developer!".</li>
                  <li>Go to <span className="text-white">Settings &gt; System &gt; Developer Options</span>.</li>
                  <li>Toggle ON <span className="text-emerald-400 font-semibold">USB Debugging</span>.</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1E2638]">
                <strong className="text-amber-300 block">Step 2: Connect Phone to Computer via USB</strong>
                <p className="text-slate-400">
                  Plug in the USB cable. On your phone screen, accept the prompt: <strong className="text-white">"Allow USB debugging from this computer?"</strong> (check "Always allow").
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1E2638]">
                <strong className="text-amber-300 block">Step 3: Chrome DevTools Port Forwarding</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                  <li>On your computer's Google Chrome, open: <code className="text-cyan-300 bg-[#121824] px-1.5 py-0.5 rounded">chrome://inspect/#devices</code></li>
                  <li>Check <strong className="text-white">"Discover USB devices"</strong>. Your phone will appear under Remote Target.</li>
                  <li>Click <strong className="text-white">"Port forwarding..."</strong>:</li>
                  <li className="pl-4">Map port <code className="text-amber-300">3000</code> to <code className="text-amber-300">localhost:3000</code>.</li>
                  <li>On your phone's Chrome browser, open <code className="text-emerald-400">http://localhost:3000</code>.</li>
                  <li>Tap <strong className="text-amber-300">⋮ &gt; Install App</strong> on the phone!</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: APK / ADB Installation */}
        {activeMethod === 'apk_adb' && (
          <div className="space-y-3 text-xs">
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Terminal className="w-4 h-4" />
                <span>Packaging into a Standalone Android APK file</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If you want a traditional compiled <strong className="text-white">.apk</strong> file that you install directly via <code className="text-amber-300">adb install app.apk</code> over USB:
              </p>
            </div>

            <div className="bg-[#080B10] border border-[#1E2638] rounded-xl p-4 space-y-3 text-[11px] text-slate-300">
              <div className="space-y-1.5">
                <strong className="text-amber-300 block">Option A: Bubblewrap CLI (Official Google TWA tool)</strong>
                <p className="text-slate-400">
                  Google's Bubblewrap wraps your Web App Manifest into a signed Android APK in seconds:
                </p>
                <pre className="bg-[#121824] p-2.5 rounded border border-[#1E2638] text-cyan-300 overflow-x-auto text-[10px]">
{`# 1. Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Initialize Android APK from your manifest
bubblewrap init --manifest="${currentUrl}/manifest.json"

# 3. Build the APK
bubblewrap build

# 4. Install onto your phone via USB Debugging
adb install app-release-signed.apk`}
                </pre>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1E2638]">
                <strong className="text-amber-300 block">Option B: Capacitor / Android Studio</strong>
                <p className="text-slate-400">
                  Export project ZIP from AI Studio Settings, then inside the project directory:
                </p>
                <pre className="bg-[#121824] p-2.5 rounded border border-[#1E2638] text-cyan-300 overflow-x-auto text-[10px]">
{`npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "ScalpEdge" "com.scalpedge.terminal"
npm run build
npx cap add android
npx cap run android  # opens Android Studio and installs via USB`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-[#1E2638] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>PWA is the quickest method (30 seconds, 0 setup required).</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
