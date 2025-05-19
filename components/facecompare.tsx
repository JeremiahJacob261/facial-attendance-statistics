"use client"

import React, { useState, useEffect, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, SwitchCamera, Upload } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

// Declare faceapi as global to satisfy TS
declare global {
  interface Window {
    faceapi: any
  }
}

export default function FaceCompare() {
  const supabase = createClientComponentClient()

  // Loading & camera states
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [isComparing, setIsComparing] = useState(false)

  // Attendance inputs
  const [matricNo, setMatricNo] = useState("")
  const [studentId, setStudentId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [studentName, setStudentName] = useState("")
  const [courses, setCourses] = useState<{ id: string; code: string; name: string }[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)

  // Face comparison results
  const [similarity, setSimilarity] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [facingMode, setFacingMode] = useState("user")

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshotRef = useRef<HTMLImageElement>(null)
  const compareImageRef = useRef<HTMLImageElement>(null)
  const descriptorRef = useRef<Float32Array | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Threshold for marking attendance
  const MATCH_THRESHOLD = 60 // percent

  // Fetch courses on mount
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ox_courses")
        .select("id, code, name")
      if (error) {
        toast({ title: "Error loading courses", description: error.message, variant: "destructive" })
      } else if (data) {
        setCourses(data)
      }
    })()
  }, [supabase])

  // Lookup student on matric change
  useEffect(() => {
    (async () => {
      if (!matricNo) {
        setStudentId(null)
        setImageUrl("")
        return
      }
      const { data, error } = await supabase
        .from("students")
        .select("id, photo_url,name")
        .eq("matric_no", matricNo)
        .single()
      if (error || !data) {
        setErrorMessage("Student not found")
        setTimeout(() => setErrorMessage(""), 3000)
        setStudentId(null)
        setImageUrl("")
        setStudentName("")
      } else {
        setStudentId(data.id)
        setImageUrl(data.photo_url)
        setStudentName(data.name)
        console.log("Student data:", data)
      }
    })()
  }, [matricNo, supabase])

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          window.faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          window.faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ])
        setIsModelLoading(false)
        startCamera()
      } catch (err) {
        console.error(err)
        setErrorMessage("Failed to load face models")
      }
    }
    if (typeof window !== "undefined" && window.faceapi) {
      loadModels()
    } else {
      const iv = setInterval(() => {
        if (window.faceapi) {
          clearInterval(iv)
          loadModels()
        }
      }, 100)
      return () => clearInterval(iv)
    }
  }, [])

  // Camera start/stop
  const startCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraReady(true)
        setCaptured(false)
        descriptorRef.current = null
        setSimilarity(null)
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Unable to access camera")
    }
  }
  const switchCamera = () => setFacingMode((m) => (m === "user" ? "environment" : "user"))

  // Restart camera on facing change
  useEffect(() => {
    if (!isModelLoading) startCamera()
  }, [facingMode, isModelLoading])

  // Auto-detect & capture
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    let iv: NodeJS.Timeout
    const detect = async () => {
      if (captured) return
      try {
        const detection = await window.faceapi
          .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
        if (detection) {
          const resized = window.faceapi.resizeResults(detection, { width: canvas.width, height: canvas.height })
          window.faceapi.draw.drawDetections(canvas, resized)
          // capture
          const tmp = document.createElement("canvas")
          tmp.width = video.videoWidth
          tmp.height = video.videoHeight
          tmp.getContext("2d")?.drawImage(video, 0, 0)
          if (snapshotRef.current) snapshotRef.current.src = tmp.toDataURL()
          descriptorRef.current = detection.descriptor
          setCaptured(true)
        }
      } catch (err) {
        console.error(err)
      }
    }
    video.addEventListener("play", () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      iv = setInterval(detect, 200)
    })
    return () => clearInterval(iv)
  }, [isCameraReady, captured])

  const captureFace = async () => {
    if (!videoRef.current) return
    try {
      const detection = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!detection) {
        setErrorMessage("No face detected")
        return
      }
      const tmp = document.createElement("canvas")
      tmp.width = videoRef.current.videoWidth
      tmp.height = videoRef.current.videoHeight
      tmp.getContext("2d")?.drawImage(videoRef.current, 0, 0)
      if (snapshotRef.current) snapshotRef.current.src = tmp.toDataURL()
      descriptorRef.current = detection.descriptor
      setCaptured(true)
      setSimilarity(null)
    } catch (err) {
      console.error(err)
      setErrorMessage("Error capturing face")
    }
  }

  const resetCapture = () => {
    setCaptured(false)
    descriptorRef.current = null
    setSimilarity(null)
    if (snapshotRef.current) snapshotRef.current.src = ""
  }

  const loadImageFromUrl = (url: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => res(img)
      img.onerror = rej
      img.src = url
    })

  // Compare and mark
  const compareFaces = async () => {
    if (!descriptorRef.current) {
      setErrorMessage("Capture your face first")
      return
    }
    if (!studentId || !imageUrl) {
      setErrorMessage("Invalid student or photo URL")
      return
    }
    setIsComparing(true)
    setSimilarity(null)
    try {
      const img = await loadImageFromUrl(imageUrl)
      if (compareImageRef.current) compareImageRef.current.src = img.src
      const detection2 = await window.faceapi
        .detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!detection2) {
        setErrorMessage("No face in student photo")
        return
      }
      const dist = window.faceapi.euclideanDistance(descriptorRef.current, detection2.descriptor)
      const score = Math.max(0, (1 - dist) * 100)
      setSimilarity(score)
      if (score >= MATCH_THRESHOLD && selectedCourse) {
        await markAttendance(studentId)
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Comparison failed")
    } finally {
      setIsComparing(false)
      setTimeout(() => setErrorMessage(""), 3000)
    }
  }

  const markAttendance = async (studentId: string) => {
    if (!selectedCourse) return
    const today = new Date().toISOString().split("T")[0]
    const { data: existing } = await supabase
      .from("ox_attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", selectedCourse)
      .eq("date", today)
      .maybeSingle()
    if (!existing) {
      await supabase.from("ox_attendance").insert({
        student_id: studentId,
        course_id: selectedCourse,
        date: today,
        status: "present",
      })
      toast({ title: "Attendance Marked", description: "Student is now present" })
      window.dispatchEvent(new CustomEvent("attendanceUpdated"))
    }
  }

  // Cleanup
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold text-center mb-6">Face Attendance</h1>
      {errorMessage && <div className="text-red-600 mb-4">{errorMessage}</div>}

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Matric No"
          value={matricNo}
          onChange={(e) => setMatricNo(e.target.value)}
        />
        <Select
          value={selectedCourse ?? ""}
          onValueChange={(val) => setSelectedCourse(val)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {`${c.code} - ${c.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Camera Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Camera Feed</CardTitle>
            {isCameraReady && (
              <Button size="icon" variant="outline" onClick={switchCamera}>
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {!captured && isCameraReady && (
              <p className="text-sm text-gray-600 mb-2 text-center">
                Position face for auto-capture
              </p>
            )}
            <div className="relative w-full aspect-video bg-gray-100 rounded-md overflow-hidden">
              {isModelLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Skeleton className="w-full h-full" />
                  <p className="mt-2 text-sm text-gray-500">Loading models...</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </>
              )}
            </div>
            <div className="mt-4 w-full flex">
              {captured ? (
                <Button onClick={resetCapture} className="w-full" variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" /> Reset
                </Button>
              ) : (
                <Button onClick={captureFace} className="w-full">
                  Capture
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Card */}
        <Card>
          <CardHeader>
            <CardTitle>Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="captured">
              <TabsList className="mb-4">
                <TabsTrigger value="compare">Compare</TabsTrigger>
              </TabsList>

              <TabsContent value="captured">
                <div className="bg-gray-100 aspect-video rounded-md flex items-center justify-center overflow-hidden">
                  {snapshotRef.current?.src ? (
                    <img
                      ref={snapshotRef}
                      alt="Captured"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <p className="text-gray-500">No capture yet</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="compare">
                <div className="space-y-4">
                  <div className="flex-col gap-4">
                    <p>{studentName}</p>
                    <p>{(imageUrl?.length < 5) ? "Student Photo Not Loaded" : "Student Image Loaded"}</p>
                    <Button
                      onClick={compareFaces}
                      disabled={!captured || isComparing || !studentId || !selectedCourse}
                    >
                      Authenticate
                    </Button>
                  </div>
                  <div className="bg-gray-100 aspect-video rounded-md flex items-center justify-center overflow-hidden">
                    {(imageUrl?.length > 5) ? (
                        
                      <img src={imageUrl} alt="student photo"/>
                     
                    ) : (
                      <p className="text-gray-500">No student photo</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {similarity !== null && (
              <div className="mt-4 p-4 border rounded-md">
                <h3 className="font-medium mb-2">Similarity: {similarity.toFixed(2)}%</h3>
                <div className="w-full bg-gray-200 h-3 rounded-full">
                  <div
                    className={cn(
                      "h-3 rounded-full",
                      similarity > 80 ? "bg-green-500" : similarity > 60 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${similarity}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
