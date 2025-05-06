"use client"

import { useEffect, useRef } from "react"

// This component is just to generate placeholder splash screens for iOS
// In a production app, you would use actual designed splash screens
export default function SplashGenerator() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    const sizes = [
      { width: 640, height: 1136, name: "splash-640x1136" },
      { width: 750, height: 1334, name: "splash-750x1334" },
      { width: 1242, height: 2208, name: "splash-1242x2208" },
      { width: 1125, height: 2436, name: "splash-1125x2436" },
      { width: 1536, height: 2048, name: "splash-1536x2048" },
      { width: 1668, height: 2224, name: "splash-1668x2224" },
      { width: 2048, height: 2732, name: "splash-2048x2732" },
    ]

    sizes.forEach((size) => {
      const canvas = canvasRefs.current.get(size.name)
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          // Set canvas dimensions
          canvas.width = size.width
          canvas.height = size.height

          // Draw background
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, size.width, size.height)

          // Draw app icon in center
          const iconSize = Math.min(size.width, size.height) * 0.3
          const x = (size.width - iconSize) / 2
          const y = (size.height - iconSize) / 2

          // Draw icon background
          ctx.fillStyle = "#0f172a"
          ctx.beginPath()
          ctx.arc(size.width / 2, size.height / 2, iconSize / 2, 0, Math.PI * 2)
          ctx.fill()

          // Draw circle
          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(size.width / 2, size.height / 2, iconSize / 2 - iconSize / 10, 0, Math.PI * 2)
          ctx.fill()

          // Draw face outline
          ctx.fillStyle = "#0f172a"
          ctx.beginPath()
          ctx.arc(size.width / 2, size.height / 2, iconSize / 3, 0, Math.PI * 2)
          ctx.fill()

          // Draw eyes
          const eyeSize = iconSize / 10
          const eyeY = size.height / 2 - eyeSize / 2
          const leftEyeX = size.width / 2 - iconSize / 6
          const rightEyeX = size.width / 2 + iconSize / 6

          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(leftEyeX, eyeY, eyeSize / 2, 0, Math.PI * 2)
          ctx.fill()

          ctx.beginPath()
          ctx.arc(rightEyeX, eyeY, eyeSize / 2, 0, Math.PI * 2)
          ctx.fill()

          // Draw smile
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = iconSize / 30
          ctx.beginPath()
          ctx.arc(size.width / 2, size.height / 2 + iconSize / 10, iconSize / 6, 0, Math.PI)
          ctx.stroke()

          // Draw app name
          ctx.fillStyle = "#0f172a"
          ctx.font = `bold ${iconSize / 5}px Arial`
          ctx.textAlign = "center"
          ctx.fillText("Face Attendance", size.width / 2, size.height / 2 + iconSize)

          // Save as PNG
          const link = document.createElement("a")
          link.download = `${size.name}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        }
      }
    })
  }, [])

  return (
    <div className="hidden">
      {[
        { width: 640, height: 1136, name: "splash-640x1136" },
        { width: 750, height: 1334, name: "splash-750x1334" },
        { width: 1242, height: 2208, name: "splash-1242x2208" },
        { width: 1125, height: 2436, name: "splash-1125x2436" },
        { width: 1536, height: 2048, name: "splash-1536x2048" },
        { width: 1668, height: 2224, name: "splash-1668x2224" },
        { width: 2048, height: 2732, name: "splash-2048x2732" },
      ].map((size) => (
        <canvas
          key={size.name}
          ref={(el) => el && canvasRefs.current.set(size.name, el)}
          width={size.width}
          height={size.height}
        />
      ))}
    </div>
  )
}
