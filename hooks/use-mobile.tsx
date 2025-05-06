"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Function to check if the device is mobile
    const checkMobile = () => {
      // Check if window is available (client-side)
      if (typeof window === "undefined") return false

      // Check if screen width is less than 768px (typical tablet breakpoint)
      const isSmallScreen = window.innerWidth < 768

      // Check for mobile-specific user agent strings
      const userAgent =
        typeof navigator !== "undefined" ? navigator.userAgent || navigator.vendor || (window as any).opera : ""

      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      const isMobileDevice = mobileRegex.test(userAgent)

      // Check for touch support as an additional indicator
      const hasTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0

      setIsMobile(isSmallScreen || isMobileDevice || hasTouch)
    }

    // Check on mount
    checkMobile()

    // Check on resize
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}
