"use client"

import { useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Camera, CameraOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMobile } from "@/hooks/use-mobile"
import { supabase } from "@/lib/supabase"

interface FaceDetectionProps {
  isAttendanceActive: boolean
  setIsAttendanceActive: (active: boolean) => void
}

export default function FaceDetection({ isAttendanceActive, setIsAttendanceActive }: FaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [isFaceDetected, setIsFaceDetected] = useState(false)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMobile = useMobile()

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true)

        if (typeof window !== "undefined" && "faceapi" in window) {
          const faceapi = (window as any).faceapi

          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          ])

          await loadCameraDevices()
        } else {
          setError("Face API not loaded. Make sure to include the face-api.js script.")
        }
      } catch (err) {
        console.error("Error loading models:", err)
        setError("Failed to load face detection models. Please refresh and try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadModels()

    return () => {
      stopCamera()
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }
    }
  }, [])

  // Load camera devices
  const loadCameraDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")
      setDevices(videoDevices)

      if (videoDevices.length > 0) {
        const defaultDevice = isMobile
          ? videoDevices.find((device) => device.label.toLowerCase().includes("front")) || videoDevices[0]
          : videoDevices[0]
        setSelectedDeviceId(defaultDevice.deviceId)
      }
    } catch (err) {
      console.error("Error loading camera devices:", err)
      setError("Could not access camera devices. Please check permissions.")
    }
  }

  const startCamera = async () => {
    setError(null)

    try {
      setIsLoading(true)
      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "user" },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadeddata = () => resolve()
        })
        setCameraActive(true)
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err)
      setError("Could not access webcam. Please check permissions.")
    } finally {
      setIsLoading(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
    }
  }

  const startFaceDetection = () => {
    if (!videoRef.current || typeof window === "undefined" || !("faceapi" in window)) return

    const faceapi = (window as any).faceapi

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return

      const displaySize = {
        width: videoRef.current.clientWidth,
        height: videoRef.current.clientHeight,
      }

      canvasRef.current.width = displaySize.width
      canvasRef.current.height = displaySize.height

      faceapi.matchDimensions(canvasRef.current, displaySize)

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()

        const ctx = canvasRef.current.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          faceapi.draw.drawDetections(canvasRef.current, detections)

          setIsFaceDetected(detections.length > 0)
        }
      } catch (err) {
        console.error("Error during face detection:", err)
      }
    }, 100)
  }

  useEffect(() => {
    if (cameraActive) {
      startFaceDetection()
    } else if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }
  }, [cameraActive])

  return (
    <div className="relative">
      {isLoading && <div>Loading...</div>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="relative bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />

        {!cameraActive && (
          <Button onClick={startCamera} className="absolute inset-0 flex items-center justify-center">
            <Camera className="h-5 w-5" />
            Activate Camera
          </Button>
        )}
      </div>

      {cameraActive && (
        <div className="flex items-center gap-2">
          <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${devices.indexOf(device) + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={stopCamera}>
            <CameraOff className="h-5 w-5" />
            Turn Off
          </Button>
        </div>
      )}
    </div>
  )
}
