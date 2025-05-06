"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Handle beforeinstallprompt event for non-iOS devices
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      // Show the prompt after a delay
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Show iOS prompt after a delay
    if (isIOSDevice && !localStorage.getItem("pwaPromptDismissed")) {
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    // Clean up
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to the install prompt: ${outcome}`)

    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const dismissPrompt = () => {
    setShowPrompt(false)
    if (isIOS) {
      localStorage.setItem("pwaPromptDismissed", "true")
    }
  }

  if (!showPrompt || isInstalled || !isMobile) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50 animate-slide-up">
      <button onClick={dismissPrompt} className="absolute top-2 right-2 text-gray-500" aria-label="Close">
        <X size={20} />
      </button>

      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Download className="h-6 w-6 text-white" />
        </div>

        <div className="flex-1">
          <h3 className="font-medium text-sm">Install Face Attendance App</h3>

          {isIOS ? (
            <>
              <p className="text-xs text-gray-500 mt-1 mb-2">
                Tap{" "}
                <span className="inline-flex items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 4V20M20 12L4 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                then "Add to Home Screen" to install
              </p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={dismissPrompt}>
                  Got it
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mt-1 mb-2">
                Install this app on your device for quick and easy access
              </p>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleInstallClick} className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Install
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
