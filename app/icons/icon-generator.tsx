"use client"

import { useEffect, useRef } from "react"

// This component is just to generate placeholder icons for the PWA
// In a production app, you would use actual designed icons
export default function IconGenerator() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

    sizes.forEach((size) => {
      const canvas = canvasRefs.current.get(size.toString())
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          // Set canvas dimensions
          canvas.width = size
          canvas.height = size

          // Draw background
          ctx.fillStyle = "#0f172a"
          ctx.fillRect(0, 0, size, size)

          // Draw circle
          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2 - size / 10, 0, Math.PI * 2)
          ctx.fill()

          // Draw face outline
          ctx.fillStyle = "#0f172a"
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2)
          ctx.fill()

          // Draw eyes
          const eyeSize = size / 10
          const eyeY = size / 2 - eyeSize / 2
          const leftEyeX = size / 2 - size / 6
          const rightEyeX = size / 2 + size / 6

          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(leftEyeX, eyeY, eyeSize / 2, 0, Math.PI * 2)
          ctx.fill()

          ctx.beginPath()
          ctx.arc(rightEyeX, eyeY, eyeSize / 2, 0, Math.PI * 2)
          ctx.fill()

          // Draw smile
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = size / 30
          ctx.beginPath()
          ctx.arc(size / 2, size / 2 + size / 10, size / 6, 0, Math.PI)
          ctx.stroke()

          // Save as PNG
          const link = document.createElement("a")
          link.download = `icon-${size}x${size}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        }
      }
    })
  }, [])

  return (
    <div className="hidden">
      {[72, 96, 128, 144, 152, 192, 384, 512].map((size) => (
        <canvas key={size} ref={(el) => el && canvasRefs.current.set(size.toString(), el)} width={size} height={size} />
      ))}
    </div>
  )
}
