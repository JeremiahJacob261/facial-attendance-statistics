"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Camera, CameraOff, Upload, FileVideo, Filter, SwitchCamera, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import StudentSearch from "./student-search"
import { Card, CardContent } from "@/components/ui/card"

interface Course {
  id: number
  code: string
  name: string
}

interface FaceDetectionProps {
  isAttendanceActive: boolean
  setIsAttendanceActive: (active: boolean) => void
}

export default function FaceDetection({ isAttendanceActive, setIsAttendanceActive }: FaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()
  const isMobile = useMobile()

  // Add new state for video processing
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [recognizedFaces, setRecognizedFaces] = useState<string[]>([])

  // Course selection
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)

  // Camera direction state
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")

  // Face comparison state
  const [compareImageUrl, setCompareImageUrl] = useState<string | null>(null)
  const [compareStudentName, setCompareStudentName] = useState<string | null>(null)
  const [compareStudentId, setCompareStudentId] = useState<number | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<{
    isMatch: boolean
    similarity: number
  } | null>(null)

  // Auto capture state
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null)
  const [isCaptureMode, setIsCaptureMode] = useState(false)
  const [captureAttempted, setCaptureAttempted] = useState(false)
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load face-api models and fetch courses
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true)

        // Fetch courses
        const { data: coursesData, error: coursesError } = await supabase
          .from("ox_courses")
          .select("id, code, name")
          .order("code")

        if (coursesError) throw coursesError
        setCourses(coursesData || [])
        if (coursesData && coursesData.length > 0) {
          setSelectedCourse(coursesData[0].id)
        }

        // Check if faceapi is available
        if (typeof window !== "undefined" && "faceapi" in window) {
          const faceapi = (window as any).faceapi

          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          ])

          // Don't automatically start video on mobile
          if (!isMobile) {
            await startVideo()
          } else {
            setIsLoading(false)
          }
        } else {
          setError("Face API not loaded. Make sure to include the face-api.js script.")
          setIsLoading(false)
        }
      } catch (err) {
        console.error("Error during initialization:", err)
        setError("Failed to initialize. Please refresh and try again.")
        setIsLoading(false)
      }
    }

    initialize()

    return () => {
      stopCamera()

      if (attendanceIntervalRef.current) {
        clearInterval(attendanceIntervalRef.current)
      }

      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
      }
    }
  }, [isMobile])

  // Handle attendance taking
  useEffect(() => {
    if (isAttendanceActive) {
      if (!selectedCourse) {
        toast({
          title: "Course selection required",
          description: "Please select a course before taking attendance",
          variant: "destructive",
        })
        setIsAttendanceActive(false)
        return
      }

      if (videoFile) {
        processVideoForAttendance()
      } else {
        if (!cameraActive && isMobile) {
          // If camera isn't active on mobile, try to start it first
          startVideo()
            .then(() => {
              startAttendanceTracking()
            })
            .catch((err) => {
              setIsAttendanceActive(false)
              console.error("Failed to start camera for attendance:", err)
            })
        } else {
          startAttendanceTracking()
        }
      }
    } else if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current)
      attendanceIntervalRef.current = null
    }

    return () => {
      if (attendanceIntervalRef.current) {
        clearInterval(attendanceIntervalRef.current)
      }
    }
  }, [isAttendanceActive, cameraActive, isMobile, videoFile, selectedCourse])

  // Handle canvas resize when video dimensions change
  useEffect(() => {
    if (!videoRef.current) return

    const handleResize = () => {
      if (videoRef.current && canvasRef.current) {
        const videoWidth = videoRef.current.clientWidth
        const videoHeight = videoRef.current.clientHeight

        canvasRef.current.width = videoWidth
        canvasRef.current.height = videoHeight
      }
    }

    // Set initial dimensions when video metadata is loaded
    videoRef.current.addEventListener("loadedmetadata", handleResize)

    // Add resize listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => {
      videoRef.current?.removeEventListener("loadedmetadata", handleResize)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Auto capture face when in capture mode
  useEffect(() => {
    if (cameraActive && isCaptureMode && !capturedImage && !capturedDescriptor && compareImageUrl) {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
      }

      captureIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return

        try {
          const faceapi = (window as any).faceapi
          const options = new faceapi.TinyFaceDetectorOptions()
          const result = await faceapi
            .detectSingleFace(videoRef.current, options)
            .withFaceLandmarks()
            .withFaceDescriptor()

          if (result) {
            // Clear previous capture attempts
            setCaptureAttempted(true)

            // Draw face detection on canvas
            const displaySize = {
              width: videoRef.current.clientWidth,
              height: videoRef.current.clientHeight,
            }
            faceapi.matchDimensions(canvasRef.current, displaySize)
            const resizedDetection = faceapi.resizeResults(result, displaySize)
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
              faceapi.draw.drawDetections(canvasRef.current, [resizedDetection])
            }

            // Capture the image and descriptor
            const canvas = document.createElement("canvas")
            canvas.width = videoRef.current.videoWidth
            canvas.height = videoRef.current.videoHeight
            const context = canvas.getContext("2d")
            if (context) {
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
              const dataUrl = canvas.toDataURL("image/png")
              setCapturedImage(dataUrl)
              setCapturedDescriptor(result.descriptor)

              toast({
                title: "Face captured",
                description: "Face detected and captured for comparison",
              })

              // Stop the interval after successful capture
              if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current)
                captureIntervalRef.current = null
              }

              // Start comparison
              setTimeout(() => {
                compareCapturedWithReference()
              }, 500)
            }
          }
        } catch (err) {
          console.error("Error during face capture:", err)
        }
      }, 200)

      return () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current)
          captureIntervalRef.current = null
        }
      }
    }
  }, [cameraActive, isCaptureMode, capturedImage, capturedDescriptor, compareImageUrl])

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
    }
  }

  const switchCamera = async () => {
    // Stop the current camera
    stopCamera()

    // Toggle the facing mode
    const newFacingMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newFacingMode)

    toast({
      title: "Switching camera",
      description: `Switching to ${newFacingMode === "user" ? "front" : "back"} camera`,
    })

    // Start the camera with the new facing mode
    await startVideo(newFacingMode)
  }

  const startVideo = async (mode: "user" | "environment" = facingMode) => {
    // Clear previous errors
    setError(null)

    // Check for basic getUserMedia support
    if (
      !navigator.mediaDevices &&
      !navigator.getUserMedia &&
      !navigator.webkitGetUserMedia &&
      !navigator.mozGetUserMedia
    ) {
      setError("Your browser doesn't support camera access. Please try a different browser.")
      setIsLoading(false)
      return Promise.reject(new Error("Media devices not supported"))
    }

    // Ensure we have the mediaDevices API (with polyfill for older browsers)
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {} as any
    }

    // Polyfill getUserMedia for older browsers
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = (constraints) => {
        const getUserMedia =
          navigator.getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia

        if (!getUserMedia) {
          return Promise.reject(new Error("getUserMedia is not implemented in this browser"))
        }

        return new Promise((resolve, reject) => {
          getUserMedia.call(navigator, constraints, resolve, reject)
        })
      }
    }

    try {
      setIsLoading(true)

      // Different constraints for mobile vs desktop
      const constraints = {
        video: isMobile
          ? {
              facingMode: mode, // Use specified camera
              width: { ideal: 640 }, // Lower resolution for mobile
              height: { ideal: 480 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve()

          if (videoRef.current.readyState >= 2) {
            resolve()
          } else {
            videoRef.current.onloadeddata = () => resolve()
          }
        })

        setCameraActive(true)
      }

      setIsLoading(false)
      return Promise.resolve()
    } catch (err: any) {
      console.error("Error accessing webcam:", err)
      setIsLoading(false)

      // More specific error messages
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera access in your browser settings and refresh the page.")
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please ensure your device has a working camera.")
      } else if (err.name === "NotReadableError" || err.name === "AbortError") {
        setError("Could not access your camera. It may be in use by another application.")
      } else if (err.name === "SecurityError") {
        setError("Camera access blocked due to security restrictions. Please ensure you're using HTTPS.")
      } else {
        setError(`Could not access webcam: ${err.message}. Please check permissions and try again.`)
      }

      return Promise.reject(err)
    }
  }

  const loadStoredDescriptors = async () => {
    try {
      if (typeof window !== "undefined" && "faceapi" in window) {
        const faceapi = (window as any).faceapi

        // Fetch face descriptors from Supabase
        const { data, error } = await supabase.from("ox_students").select("id, name, face_descriptors")

        if (error) throw error

        if (!data || data.length === 0) {
          return []
        }

        // Convert the stored descriptors to LabeledFaceDescriptors
        return data
          .map((student) => {
            if (!student.face_descriptors || student.face_descriptors.length === 0) {
              return null
            }

            return new faceapi.LabeledFaceDescriptors(
              student.id.toString(), // Use ID as label for matching
              student.face_descriptors.map((d: number[]) => new Float32Array(d)),
            )
          })
          .filter(Boolean) // Remove null entries
      }
      return []
    } catch (err) {
      console.error("Error loading stored descriptors:", err)
      return []
    }
  }

  const markAttendance = async (studentId: string) => {
    if (!selectedCourse) return

    try {
      const today = new Date().toISOString().split("T")[0]

      // Check if attendance already marked
      const { data: existingRecord, error: checkError } = await supabase
        .from("ox_attendance")
        .select("id")
        .eq("student_id", studentId)
        .eq("course_id", selectedCourse)
        .eq("date", today)
        .maybeSingle()

      if (checkError) throw checkError

      // If attendance not already marked, insert new record
      if (!existingRecord) {
        const { error: insertError } = await supabase.from("ox_attendance").insert({
          student_id: studentId,
          course_id: selectedCourse,
          date: today,
          status: "present",
        })

        if (insertError) throw insertError

        // Get student name for toast
        const { data: student, error: studentError } = await supabase
          .from("ox_students")
          .select("name")
          .eq("id", studentId)
          .single()

        if (studentError) throw studentError

        toast({
          title: "Attendance Marked",
          description: `${student.name} is now present`,
        })

        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent("attendanceUpdated"))
      }
    } catch (error: any) {
      console.error("Error marking attendance:", error)
      toast({
        title: "Error marking attendance",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const startAttendanceTracking = async () => {
    if (typeof window === "undefined" || !("faceapi" in window)) return

    const faceapi = (window as any).faceapi
    const labeledFaceDescriptors = await loadStoredDescriptors()

    if (labeledFaceDescriptors.length === 0) {
      toast({
        title: "No registered faces",
        description: "Please register at least one face before taking attendance",
        variant: "destructive",
      })
      setIsAttendanceActive(false)
      return
    }

    attendanceIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) return

      // Get the current dimensions of the video element
      const displaySize = {
        width: videoRef.current.clientWidth,
        height: videoRef.current.clientHeight,
      }

      // Ensure canvas matches video dimensions
      canvasRef.current.width = displaySize.width
      canvasRef.current.height = displaySize.height

      faceapi.matchDimensions(canvasRef.current, displaySize)

      try {
        const options = new faceapi.TinyFaceDetectorOptions()
        const detections = await faceapi
          .detectAllFaces(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptors()

        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        const ctx = canvasRef.current.getContext("2d")

        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          if (labeledFaceDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)

            resizedDetections.forEach((detection) => {
              const { x, y, width, height } = detection.detection.box
              const bestMatch = faceMatcher.findBestMatch(detection.descriptor)
              const label = bestMatch.label

              // Draw bounding box
              ctx.strokeStyle = bestMatch.distance < 0.6 ? "green" : "red"
              ctx.lineWidth = 2
              ctx.strokeRect(x, y, width, height)

              // Draw label background
              ctx.fillStyle = bestMatch.distance < 0.6 ? "rgba(0, 128, 0, 0.7)" : "rgba(255, 0, 0, 0.7)"
              const textWidth = ctx.measureText(label).width
              ctx.fillRect(x, y - 25, textWidth + 10, 25)

              // Draw label text
              ctx.font = "16px Arial"
              ctx.fillStyle = "white"
              ctx.fillText(label, x + 5, y - 8)

              if (bestMatch.distance < 0.6 && label !== "unknown") {
                markAttendance(label)
              }
            })
          } else {
            // Just draw detection boxes if no descriptors
            faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
          }
        }
      } catch (err) {
        console.error("Error during face detection:", err)
      }
    }, 100) // Update more frequently for smoother tracking
  }

  // Add new functions for video file handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check if it's a video file
      if (!file.type.startsWith("video/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload a video file",
          variant: "destructive",
        })
        return
      }

      setVideoFile(file)

      // Load the video for preview
      if (videoRef.current) {
        const url = URL.createObjectURL(file)
        videoRef.current.src = url
        videoRef.current.srcObject = null // Clear any camera stream
        setCameraActive(false)
      }

      toast({
        title: "Video uploaded",
        description: "Click 'Process Attendance' to process the video",
      })
    }
  }

  const processVideoForAttendance = async () => {
    if (!videoFile || !videoRef.current || !canvasRef.current || !selectedCourse) return

    const faceapi = (window as any).faceapi
    const labeledFaceDescriptors = await loadStoredDescriptors()

    if (labeledFaceDescriptors.length === 0) {
      toast({
        title: "No registered faces",
        description: "Please register at least one face before taking attendance",
        variant: "destructive",
      })
      setIsAttendanceActive(false)
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)
    setRecognizedFaces([])

    try {
      // Make sure video is ready
      if (videoRef.current.readyState < 2) {
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadeddata = () => resolve()
        })
      }

      // Set up canvas
      const displaySize = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      }

      canvasRef.current.width = displaySize.width
      canvasRef.current.height = displaySize.height

      faceapi.matchDimensions(canvasRef.current, displaySize)

      // Create face matcher
      const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)

      // Calculate total frames to process (1 frame per second)
      const duration = videoRef.current.duration
      const totalFrames = Math.floor(duration)
      let processedFrames = 0

      // Get student names for recognized IDs
      const studentMap = new Map<string, string>()

      // Process frames at 1-second intervals
      for (let time = 0; time < duration; time += 1) {
        // Set video to specific time
        videoRef.current.currentTime = time

        // Wait for the video to update to the new time
        await new Promise<void>((resolve) => {
          const timeUpdateHandler = () => {
            videoRef.current!.removeEventListener("timeupdate", timeUpdateHandler)
            resolve()
          }
          videoRef.current!.addEventListener("timeupdate", timeUpdateHandler)
        })

        // Detect faces in the current frame
        const options = new faceapi.TinyFaceDetectorOptions()
        const detections = await faceapi
          .detectAllFaces(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptors()

        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        const ctx = canvasRef.current.getContext("2d")

        if (ctx) {
          // Draw the current frame
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          ctx.drawImage(videoRef.current, 0, 0, displaySize.width, displaySize.height)

          // Process each detected face
          for (const detection of resizedDetections) {
            const { x, y, width, height } = detection.detection.box
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor)
            const label = bestMatch.label

            // Draw bounding box
            ctx.strokeStyle = bestMatch.distance < 0.6 ? "green" : "red"
            ctx.lineWidth = 2
            ctx.strokeRect(x, y, width, height)

            // Draw label background
            ctx.fillStyle = bestMatch.distance < 0.6 ? "rgba(0, 128, 0, 0.7)" : "rgba(255, 0, 0, 0.7)"
            const textWidth = ctx.measureText(label).width
            ctx.fillRect(x, y - 25, textWidth + 10, 25)

            // Draw label text
            ctx.font = "16px Arial"
            ctx.fillStyle = "white"
            ctx.fillText(label, x + 5, y - 8)

            // Mark attendance if face is recognized
            if (bestMatch.distance < 0.6 && label !== "unknown") {
              await markAttendance(label)

              // If we haven't seen this student before, get their name
              if (!studentMap.has(label)) {
                try {
                  const { data: student, error } = await supabase
                    .from("ox_students")
                    .select("name")
                    .eq("id", label)
                    .single()

                  if (!error && student) {
                    studentMap.set(label, student.name)
                    setRecognizedFaces((prev) => [...prev, student.name])
                  }
                } catch (err) {
                  console.error("Error fetching student name:", err)
                }
              }
            }
          }
        }

        // Update progress
        processedFrames++
        setProcessingProgress(Math.floor((processedFrames / totalFrames) * 100))
      }

      toast({
        title: "Video processing complete",
        description: `Processed ${totalFrames} frames and marked attendance for ${studentMap.size} students`,
      })
    } catch (err) {
      console.error("Error processing video:", err)
      toast({
        title: "Processing error",
        description: "An error occurred while processing the video",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setIsAttendanceActive(false)
    }
  }

  const clearVideo = () => {
    if (videoRef.current) {
      videoRef.current.src = ""
      URL.revokeObjectURL(videoRef.current.src)
    }
    setVideoFile(null)
    setRecognizedFaces([])
  }

  const handleStudentSearch = (imageUrl: string, studentName: string, studentId: number) => {
    setCompareImageUrl(imageUrl)
    setCompareStudentName(studentName)
    setCompareStudentId(studentId)
    setCapturedImage(null)
    setCapturedDescriptor(null)
    setComparisonResult(null)
    setCaptureAttempted(false)

    toast({
      title: "Ready for face comparison",
      description: `Please ensure your face is visible in the camera for comparison with ${studentName}`,
    })

    // If camera is not active, start it
    if (!cameraActive) {
      startVideo().then(() => {
        toast({
          title: "Camera activated",
          description: "Camera started for face comparison",
        })
        // Start capture mode
        setIsCaptureMode(true)
      })
    } else {
      // If camera is already active, start capture mode
      setIsCaptureMode(true)
    }
  }

  const compareCapturedWithReference = async () => {
    if (!compareImageUrl || !capturedDescriptor) {
      toast({
        title: "Missing data for comparison",
        description: "Both reference image and captured face descriptor are required for comparison",
        variant: "destructive",
      })
      return
    }

    setIsComparing(true)
    setComparisonResult(null)

    try {
      toast({
        title: "Starting face comparison",
        description: "Comparing captured face with the reference image...",
      })

      const faceapi = (window as any).faceapi

      // Load the reference image
      const img = new Image()
      img.crossOrigin = "anonymous" // Important to avoid CORS issues
      img.src = compareImageUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load reference image"))
      })

      // Detect face in the reference image
      const options = new faceapi.TinyFaceDetectorOptions()
      const referenceDetection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor()

      if (!referenceDetection) {
        throw new Error("No face detected in the reference image")
      }

      // Calculate similarity using euclidean distance
      const distance = faceapi.euclideanDistance(capturedDescriptor, referenceDetection.descriptor)
      const similarity = (1 - distance) * 100
      const isMatch = similarity >= 50 // Threshold for match is 50%

      setComparisonResult({
        isMatch,
        similarity: Math.round(similarity),
      })

      // Show toast with result
      if (isMatch) {
        toast({
          title: "Face Match Confirmed!",
          description: `Match confirmed with ${compareStudentName} (${Math.round(similarity)}% similarity)`,
        })

        // Mark attendance if it's a match
        if (compareStudentId && selectedCourse) {
          await markAttendance(compareStudentId.toString())
        }
      } else {
        toast({
          title: "No Face Match",
          description: `The face does not match with ${compareStudentName} (${Math.round(similarity)}% similarity)`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error during face comparison:", error)
      toast({
        title: "Comparison error",
        description: error.message || "An error occurred during face comparison",
        variant: "destructive",
      })
    } finally {
      setIsComparing(false)
      setIsCaptureMode(false)
    }
  }

  const retryCapture = () => {
    setCapturedImage(null)
    setCapturedDescriptor(null)
    setCaptureAttempted(false)
    setComparisonResult(null)
    setIsCaptureMode(true)

    toast({
      title: "Retrying capture",
      description: "Please position your face clearly in the camera",
    })
  }

  return (
    <div className="space-y-4">
      {/* Student search form */}
      <StudentSearch onFaceDetected={handleStudentSearch} />

      {/* Face comparison result */}
      {comparisonResult && (
        <Alert variant={comparisonResult.isMatch ? "default" : "destructive"} className="animate-fade-in">
          <div className="flex items-center">
            <div className={`mr-2 p-1 rounded-full ${comparisonResult.isMatch ? "bg-emerald-100" : "bg-red-100"}`}>
              {comparisonResult.isMatch ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div>
              <p className="font-medium">{comparisonResult.isMatch ? "Face Match Confirmed" : "No Face Match"}</p>
              <p className="text-sm">
                {comparisonResult.isMatch
                  ? `Match confirmed with ${compareStudentName} (${comparisonResult.similarity}% similarity)`
                  : `The face does not match with ${compareStudentName} (${comparisonResult.similarity}% similarity)`}
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Captured image and reference image comparison */}
      {capturedImage && compareImageUrl && (
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          <Card className="overflow-hidden">
            <CardContent className="p-2">
              <h3 className="text-sm font-medium mb-2 text-center">Captured Image</h3>
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-md">
                <img
                  src={capturedImage || "/placeholder.svg"}
                  alt="Captured face"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-2">
              <h3 className="text-sm font-medium mb-2 text-center">Reference Image</h3>
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-md">
                <img
                  src={compareImageUrl || "/placeholder.svg"}
                  alt="Reference face"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Retry capture button */}
      {capturedImage && !isComparing && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={retryCapture}
            className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 btn-hover-effect"
          >
            <Camera className="h-3 w-3 mr-1" />
            Retry Capture
          </Button>
        </div>
      )}

      <div className="relative animate-fade-in">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4 text-sm animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-3 flex items-center gap-2 animate-fade-in">
          <Filter className="h-4 w-4 text-emerald-600" />
          <Select value={selectedCourse?.toString() || ""} onValueChange={(value) => setSelectedCourse(Number(value))}>
            <SelectTrigger className="w-[200px] text-xs sm:text-sm h-8 sm:h-10 border-emerald-200 focus:ring-emerald-500">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.code} - {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative rounded-lg overflow-hidden border border-emerald-200 bg-black animate-scale-up">
          <video
            ref={videoRef}
            autoPlay={cameraActive}
            playsInline
            muted
            controls={!!videoFile}
            className="w-full h-auto object-cover"
            style={{ maxHeight: isMobile ? "300px" : "480px" }}
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
          <canvas ref={captureCanvasRef} className="hidden" />

          {/* Camera activation button for mobile */}
          {isMobile && !cameraActive && !isLoading && !videoFile && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 animate-fade-in">
              <Button
                onClick={startVideo}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 btn-hover-effect"
                size="lg"
              >
                <Camera className="h-5 w-5" />
                Activate Camera
              </Button>
            </div>
          )}

          {/* Video upload overlay when no video or camera */}
          {!cameraActive && !videoFile && !isLoading && !isMobile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 animate-fade-in">
              <FileVideo className="h-12 w-12 mb-4 text-white/70" />
              <p className="text-white mb-4 text-center">Upload a video file to take attendance</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 btn-hover-effect"
                variant="outline"
              >
                <Upload className="h-4 w-4" />
                Upload Video
              </Button>
            </div>
          )}

          {/* Capture mode overlay */}
          {cameraActive && isCaptureMode && !capturedImage && (
            <div className="absolute inset-0 border-4 border-emerald-500 rounded-lg animate-pulse-custom">
              <div className="absolute top-0 left-0 right-0 bg-emerald-500/80 text-white text-center py-1 text-sm">
                Position your face in the frame for auto-capture
              </div>
            </div>
          )}

          {/* Capture attempted but failed */}
          {captureAttempted && !capturedImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="bg-white p-4 rounded-lg text-center max-w-xs">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Face detection failed</p>
                <p className="text-xs text-gray-500 mb-3">Please ensure your face is clearly visible</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setCaptureAttempted(false)
                    setIsCaptureMode(true)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Processing progress bar */}
        {isProcessing && (
          <div className="mt-2 animate-fade-in">
            <Progress value={processingProgress} className="h-2" />
            <p className="text-xs text-center mt-1 text-emerald-700">Processing video: {processingProgress}%</p>
          </div>
        )}

        {/* Recognized faces during processing */}
        {recognizedFaces.length > 0 && (
          <div className="mt-2 p-2 bg-emerald-50 rounded border border-emerald-100 text-sm animate-fade-in">
            <p className="font-medium text-emerald-800">Recognized students: {recognizedFaces.length}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {recognizedFaces.map((name, index) => (
                <span
                  key={index}
                  className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs animate-scale-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Video controls */}
        <div className="mt-2 flex flex-wrap gap-2 animate-fade-in">
          {/* Hidden file input */}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />

          {/* Video upload button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 btn-hover-effect"
            disabled={isProcessing || isCaptureMode}
          >
            <Upload className="h-3 w-3" />
            Upload Video
          </Button>

          {/* Clear video button */}
          {videoFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearVideo}
              className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 btn-hover-effect"
              disabled={isProcessing}
            >
              <Trash2 className="h-3 w-3" />
              Clear Video
            </Button>
          )}

          {/* Switch camera button */}
          {cameraActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={switchCamera}
              className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 btn-hover-effect"
              disabled={isProcessing || isComparing || isCaptureMode}
            >
              <SwitchCamera className="h-3 w-3 mr-1" />
              Switch Camera
            </Button>
          )}

          {/* Camera controls for mobile */}
          {isMobile && cameraActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 btn-hover-effect"
              disabled={isCaptureMode}
            >
              <CameraOff className="h-3 w-3" />
              Turn Off Camera
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
