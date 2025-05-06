"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Camera, Upload, X } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const { toast } = useToast()
  const isMobile = useMobile()
  const [courses, setCourses] = useState<{ id: number; code: string; name: string }[]>([])
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])

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

  const activateCamera = async () => {
    setError(null)

    // Check for basic getUserMedia support
    if (
      !navigator.mediaDevices &&
      !navigator.getUserMedia &&
      !navigator.webkitGetUserMedia &&
      !navigator.mozGetUserMedia
    ) {
      setError("Your browser doesn't support camera access. Please try a different browser.")
      return
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
      const constraints = {
        video: isMobile
          ? {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err)

      // More specific error messages
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera access in your browser settings.")
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please ensure your device has a working camera.")
      } else if (err.name === "NotReadableError" || err.name === "AbortError") {
        setError("Could not access your camera. It may be in use by another application.")
      } else if (err.name === "SecurityError") {
        setError("Camera access blocked due to security restrictions. Please ensure you're using HTTPS.")
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
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check if it's an image file
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

      // Stop camera if it's active
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
    setSelectedCourses((prev) => (prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]))
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

    if (selectedCourses.length === 0) {
      toast({
        title: "Course selection required",
        description: "Please select at least one course",
        variant: "destructive",
      })
      return
    }

    // Check if we have either a photo or camera active
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

      // Process photo from file or camera
      if (photoFile) {
        // Create an image element from the file
        const img = new Image()
        img.src = photoPreview as string
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
        })

        // Detect face in the uploaded image
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detection) {
          throw new Error("No face detected in the uploaded photo. Please upload a clearer photo with a face.")
        }

        faceDescriptor = detection.descriptor

        // Upload photo to Supabase Storage
        const fileExt = photoFile.name.split(".").pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `students/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(filePath, photoFile)

        if (uploadError) {
          throw new Error(`Error uploading photo: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(filePath)

        photoUrl = urlData.publicUrl
      } else if (cameraActive && videoRef.current) {
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve()

          if (videoRef.current.readyState >= 2) {
            resolve()
          } else {
            videoRef.current.onloadeddata = () => resolve()
          }
        })

        // Detect face
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detection) {
          throw new Error("No face detected. Please position your face clearly in the frame and try again.")
        }

        faceDescriptor = detection.descriptor

        // Capture current frame as image
        const canvas = document.createElement("canvas")
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob)
                else throw new Error("Failed to capture image")
              },
              "image/jpeg",
              0.95,
            )
          })

          // Upload to Supabase Storage
          const fileName = `${uuidv4()}.jpg`
          const filePath = `students/${fileName}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(filePath, blob)

          if (uploadError) {
            throw new Error(`Error uploading photo: ${uploadError.message}`)
          }

          // Get public URL
          const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(filePath)

          photoUrl = urlData.publicUrl
        }
      }

      if (!faceDescriptor) {
        throw new Error("Failed to extract face features. Please try again.")
      }

      // Check if matric number already exists
      const { data: existingStudent, error: checkError } = await supabase
        .from("students")
        .select("id")
        .eq("matric_no", matricNo)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 is "not found" which is what we want
        throw new Error(`Error checking student: ${checkError.message}`)
      }

      if (existingStudent) {
        throw new Error(`A student with matric number ${matricNo} already exists`)
      }

      // Insert student into Supabase
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

      // Add student to selected courses
      const courseEnrollments = selectedCourses.map((courseId) => ({
        student_id: student.id,
        course_id: courseId,
      }))

      // Create a custom table for course enrollments if needed
      // For now, we'll just store this in localStorage
      const enrollments = JSON.parse(localStorage.getItem("courseEnrollments") || "{}")
      enrollments[student.id] = selectedCourses
      localStorage.setItem("courseEnrollments", JSON.stringify(enrollments))

      toast({
        title: "Registration successful",
        description: `${name} has been registered successfully`,
      })

      // Reset form
      setName("")
      setMatricNo("")
      setSelectedCourses([])
      clearPhoto()

      // Stop video stream
      stopCamera()

      // Notify parent component
      if (onRegister) onRegister()

      // Dispatch event to update registered list
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

      <div className="space-y-2">
        <Label className="text-emerald-800">Courses</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2 border-emerald-200">
          {courses.length > 0 ? (
            courses.map((course) => (
              <div key={course.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`course-${course.id}`}
                  checked={selectedCourses.includes(course.id)}
                  onChange={() => toggleCourseSelection(course.id)}
                  className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor={`course-${course.id}`} className="text-sm text-emerald-800">
                  {course.code} - {course.name}
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-emerald-500">No courses available</p>
          )}
        </div>
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
          {/* Photo preview */}
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

              {/* Camera activation button */}
              {!cameraActive && !isRegistering && !photoPreview && (
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

          {/* Hidden file input */}
          <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />

          {/* Photo upload button */}
          {!photoPreview && !cameraActive && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Upload className="h-3 w-3" />
              Upload Photo
            </Button>
          )}

          {cameraActive && !isRegistering && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="w-full text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              Cancel Camera
            </Button>
          )}
        </div>
      </div>

      <Button
        onClick={handleRegister}
        disabled={isRegistering || !name.trim() || !matricNo.trim() || selectedCourses.length === 0}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {isRegistering ? "Registering..." : "Register Student"}
      </Button>
    </div>
  )
}
