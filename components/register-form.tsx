"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Camera, Upload, X, RefreshCw } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"

interface RegisterFormProps {
  onRegister?: () => void
}

export default function RegisterForm({ onRegister }: RegisterFormProps) {
  const [name, setName] = useState("")
  const [matricNo, setMatricNo] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null) // Added canvas ref
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const { toast } = useToast()
  const isMobile = useMobile()
  const [courses, setCourses] = useState<{ id: number; code: string; name: string }[]>([])
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null) // Ref to store detection interval

  useEffect(() => {
    // Fetch courses from Supabase
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase.from("courses").select("id, code, name").order("code")
        if (error) throw error
        if (data) setCourses(data)
      } catch (error: any) {
        console.error("Error fetching courses:", error.message)
        toast({
          title: "Error fetching courses",
          description: error.message,
          variant: "destructive",
        })
      }
    }
    fetchCourses()
  }, [toast])

  useEffect(() => {
    // Fetch available camera devices
    const loadCameraDevices = async () => {
      try {
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
    loadCameraDevices()
  }, [isMobile])

  const activateCamera = async () => {
    setError(null)
    try {
      const constraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "user" },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true)
          startFaceDetection() // Start face detection when camera is ready
        }
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err)
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera access in your browser settings.")
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please ensure your device has a working camera.")
      } else {
        setError(`Could not access webcam: ${err.message}. Please check permissions and try again.`)
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
      stopFaceDetection() // Stop face detection
    }
  }

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current || typeof window === "undefined" || !("faceapi" in window)) {
      return
    }

    const faceapi = (window as any).faceapi
    const canvas = canvasRef.current
    const video = videoRef.current

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Start detection loop
    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()

      // Clear canvas
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw bounding boxes
        detections.forEach((detection) => {
          const { box } = detection
          ctx.beginPath()
          ctx.lineWidth = 2
          ctx.strokeStyle = "green"
          ctx.rect(box.x, box.y, box.width, box.height)
          ctx.stroke()
        })
      }
    }

    // Run detection every 100ms
    detectionIntervalRef.current = setInterval(detectFaces, 100)
  }

  const stopFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }

  useEffect(() => {
    // Clean up on component unmount
    return () => {
      stopCamera()
      stopFaceDetection()
    }
  }, [])

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (cameraActive) {
      stopCamera()
      await activateCamera()
    }
  }

  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")
      setDevices(videoDevices)
    } catch (err) {
      console.error("Error refreshing devices:", err)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive",
        })
        return
      }
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      if (cameraActive) {
        stopCamera()
      }
    }
  }

  const clearPhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const toggleCourseSelection = (courseId: number) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    )
  }

  const handleRegister = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name to register",
        variant: "destructive",
      })
      return
    }
    if (!matricNo.trim()) {
      toast({
        title: "Matric Number required",
        description: "Please enter a matriculation number",
        variant: "destructive",
      })
      return
    }
    if (!photoFile && !cameraActive) {
      toast({
        title: "Photo required",
        description: "Please upload a photo or activate the camera",
        variant: "destructive",
      })
      return
    }
    setIsRegistering(true)
    try {
      if (typeof window === "undefined" || !("faceapi" in window)) {
        throw new Error("Face API not loaded")
      }
      const faceapi = (window as any).faceapi
      let faceDescriptor: Float32Array | null = null
      let photoUrl: string | null = null
      if (photoFile) {
        const img = new Image()
        img.src = photoPreview as string
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
        })
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (!detection) {
          throw new Error("No face detected in the uploaded photo. Please upload a clearer photo with a face.")
        }
        faceDescriptor = detection.descriptor
        const fileExt = photoFile.name.split(".").pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `students/${fileName}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(filePath, photoFile)
        if (uploadError) {
          throw new Error(`Error uploading photo: ${uploadError.message}`)
        }
        const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(filePath)
        photoUrl = urlData.publicUrl
      } else if (cameraActive && videoRef.current) {
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve()
          if (videoRef.current.readyState >= 2) {
            resolve()
          } else {
            videoRef.current.onloadeddata = () => resolve()
          }
        })
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (!detection) {
          throw new Error("No face detected. Please position your face clearly in the frame and try again.")
        }
        faceDescriptor = detection.descriptor
        const canvas = document.createElement("canvas")
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob)
                else throw new Error("Failed to capture image")
              },
              "image/jpeg",
              0.95
            )
          })
          const fileName = `${uuidv4()}.jpg`
          const filePath = `students/${fileName}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(filePath, blob)
          if (uploadError) {
            throw new Error(`Error uploading photo: ${uploadError.message}`)
          }
          const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(filePath)
          photoUrl = urlData.publicUrl
        }
      }
      if (!faceDescriptor) {
        throw new Error("Failed to extract face features. Please try again.")
      }
      const { data: existingStudent, error: checkError } = await supabase
        .from("students")
        .select("id")
        .eq("matric_no", matricNo)
        .single()
      if (checkError && checkError.code !== "PGRST116") {
        throw new Error(`Error checking student: ${checkError.message}`)
      }
      if (existingStudent) {
        throw new Error(`A student with matric number ${matricNo} already exists`)
      }
      const { data: student, error: insertError } = await supabase
        .from("students")
        .insert({
          name,
          matric_no: matricNo,
          photo_url: photoUrl,
          face_descriptors: [Array.from(faceDescriptor)],
        })
        .select("id")
        .single()
      if (insertError) {
        throw new Error(`Error registering student: ${insertError.message}`)
      }
      const courseEnrollments = selectedCourses.map((courseId) => ({
        student_id: student.id,
        course_id: courseId,
      }))
      const enrollments = JSON.parse(localStorage.getItem("courseEnrollments") || "{}")
      enrollments[student.id] = selectedCourses
      localStorage.setItem("courseEnrollments", JSON.stringify(enrollments))
      toast({
        title: "Registration successful",
        description: `${name} has been registered successfully`,
      })
      setName("")
      setMatricNo("")
      setSelectedCourses([])
      clearPhoto()
      stopCamera()
      if (onRegister) onRegister()
      window.dispatchEvent(new CustomEvent("registeredListUpdated"))
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="space-y-4 px-3 sm:px-6">
      <div className="space-y-2">
        <Label htmlFor="student-name" className="text-emerald-800">
          Student Name
        </Label>
        <Input
          id="student-name"
          placeholder="Enter full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-emerald-200 focus:ring-emerald-500"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="matric-no" className="text-emerald-800">
          Matriculation Number
        </Label>
        <Input
          id="matric-no"
          placeholder="Enter matric number"
          value={matricNo}
          onChange={(e) => setMatricNo(e.target.value)}
          className="border-emerald-200 focus:ring-emerald-500"
        />
      </div>
      {error && (
        <Alert variant="destructive" className="text-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label className="text-emerald-800">Student Photo</Label>
        <div className="flex flex-col gap-2">
          {photoPreview ? (
            <div className="relative w-full h-48 border rounded-md overflow-hidden border-emerald-200">
              <img
                src={photoPreview || "/placeholder.svg"}
                alt="Student preview"
                className="w-full h-full object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 rounded-full"
                onClick={clearPhoto}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-emerald-200 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto rounded-md"
                style={{
                  display: cameraActive ? "block" : "none",
                  maxHeight: isMobile ? "200px" : "240px",
                }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ display: cameraActive ? "block" : "none" }}
              />
              {!cameraActive && !photoPreview && (
                <div
                  className="flex items-center justify-center bg-emerald-50 rounded-md p-4"
                  style={{ height: isMobile ? "120px" : "160px" }}
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={activateCamera}
                      variant="outline"
                      className="flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Camera className="h-4 w-4" />
                      Use Camera
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Photo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          {cameraActive && (
            <div className="flex items-center gap-2">
              <Select value={selectedDeviceId} onValueChange={handleDeviceChange}>
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
              <Button variant="outline" size="icon" onClick={refreshDevices} className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                Cancel Camera
              </Button>
            </div>
          )}
        </div>
      </div>
      <Button
        onClick={handleRegister}
        disabled={isRegistering || !name.trim() || !matricNo.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {isRegistering ? "Registering..." : "Register Student"}
      </Button>
    </div>
  )
}