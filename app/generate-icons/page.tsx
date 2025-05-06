"use client"

import IconGenerator from "../icons/icon-generator"
import SplashGenerator from "../icons/splash-generator"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function GenerateIconsPage() {
  const [generateIcons, setGenerateIcons] = useState(false)
  const [generateSplash, setGenerateSplash] = useState(false)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">PWA Asset Generator</h1>
      <p className="mb-4">This page helps generate placeholder icons and splash screens for the PWA.</p>

      <div className="space-y-4">
        <div>
          <Button onClick={() => setGenerateIcons(true)} disabled={generateIcons}>
            Generate Icons
          </Button>
          {generateIcons && <IconGenerator />}
          {generateIcons && (
            <p className="mt-2 text-green-600">Icons are being generated. Check your downloads folder.</p>
          )}
        </div>

        <div>
          <Button onClick={() => setGenerateSplash(true)} disabled={generateSplash}>
            Generate Splash Screens
          </Button>
          {generateSplash && <SplashGenerator />}
          {generateSplash && (
            <p className="mt-2 text-green-600">Splash screens are being generated. Check your downloads folder.</p>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <h2 className="font-semibold text-yellow-800">Important Note</h2>
        <p className="text-yellow-700">
          These are placeholder assets for development. For production, you should use professionally designed icons and
          splash screens. After generating, place the files in the public/icons directory.
        </p>
      </div>
    </div>
  )
}
