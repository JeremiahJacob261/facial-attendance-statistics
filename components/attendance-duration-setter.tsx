"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Clock, Calendar, Play, Pause, Save } from "lucide-react"
import { format } from "date-fns"

interface Course {
  id: number
  code: string
  name: string
  marking: boolean
  markduration: number | null
  startmark: string | null
}

export default function AttendanceDurationSetter() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [marking, setMarking] = useState(false)
  const [markDuration, setMarkDuration] = useState<number>(15) // Default 15 minutes
  const [startMark, setStartMark] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      loadCourseSettings()
    }
  }, [selectedCourse])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("ox_courses")
        .select("id, code, name, marking, markduration, startmark")
        .order("code")

      if (error) throw error
      setCourses(data || [])
      
      if (data && data.length > 0 && !selectedCourse) {
        setSelectedCourse(data[0].id)
      }
    } catch (error: any) {
      console.error("Error fetching courses:", error)
      toast({
        title: "Error",
        description: "Failed to fetch courses",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCourseSettings = () => {
    const course = courses.find(c => c.id === selectedCourse)
    if (course) {
      setMarking(course.marking || false)
      setMarkDuration(course.markduration || 15)
      
      // Set current datetime if starting new marking session, otherwise use existing startmark
      if (course.startmark) {
        const startDate = new Date(course.startmark)
        setStartMark(format(startDate, "yyyy-MM-dd'T'HH:mm"))
      } else {
        const now = new Date()
        setStartMark(format(now, "yyyy-MM-dd'T'HH:mm"))
      }
    }
  }

  const saveSettings = async () => {
    if (!selectedCourse) return

    try {
      setSaving(true)
      
      const updateData: any = {
        marking,
        markduration: markDuration,
      }

      // Only update startmark if marking is being enabled
      if (marking) {
        updateData.startmark = new Date(startMark).toISOString()
      } else {
        updateData.startmark = null
      }

      const { error } = await supabase
        .from("ox_courses")
        .update(updateData)
        .eq("id", selectedCourse)

      if (error) throw error

      // Update local state
      setCourses(prev => prev.map(course => 
        course.id === selectedCourse 
          ? { ...course, ...updateData }
          : course
      ))

      toast({
        title: "Settings Saved",
        description: `Attendance marking ${marking ? 'enabled' : 'disabled'} for the selected course`,
      })

    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const startMarkingNow = () => {
    const now = new Date()
    setStartMark(format(now, "yyyy-MM-dd'T'HH:mm"))
    setMarking(true)
  }

  const stopMarking = () => {
    setMarking(false)
  }

  const selectedCourseData = courses.find(c => c.id === selectedCourse)
  const isCurrentlyActive = selectedCourseData?.marking && selectedCourseData?.startmark
  const endTime = isCurrentlyActive && selectedCourseData?.startmark && selectedCourseData?.markduration
    ? new Date(new Date(selectedCourseData.startmark).getTime() + (selectedCourseData.markduration * 60000))
    : null

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-sm text-emerald-600 mt-2">Loading courses...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto border-emerald-100 shadow-md">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-100">
          <CardTitle className="flex items-center gap-2 text-emerald-800">
            <Clock className="h-5 w-5" />
            Attendance Duration Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Course Selection */}
          <div className="space-y-2">
            <Label htmlFor="course-select" className="text-sm font-medium text-emerald-700">
              Select Course
            </Label>
            <Select
              value={selectedCourse?.toString() || ""}
              onValueChange={(value) => setSelectedCourse(Number(value))}
            >
              <SelectTrigger className="border-emerald-200 focus:ring-emerald-500">
                <SelectValue placeholder="Choose a course" />
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

          {selectedCourseData && (
            <>
              {/* Current Status */}
              {isCurrentlyActive && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    Currently Active
                  </div>
                  <div className="text-sm text-emerald-600 space-y-1">
                    <p>Started: {format(new Date(selectedCourseData.startmark), "dd MMM yyyy 'at' HH:mm")}</p>
                    {endTime && (
                      <p>Ends: {format(endTime, "dd MMM yyyy 'at' HH:mm")}</p>
                    )}
                    <p>Duration: {selectedCourseData.markduration} minutes</p>
                  </div>
                </div>
              )}

              {/* Enable/Disable Marking */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-emerald-700">
                    Enable Student Marking
                  </Label>
                  <p className="text-xs text-emerald-600">
                    Allow students to mark their own attendance
                  </p>
                </div>
                <Switch
                  checked={marking}
                  onCheckedChange={setMarking}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>

              {/* Duration Setting */}
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium text-emerald-700">
                  Marking Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="180"
                  value={markDuration}
                  onChange={(e) => setMarkDuration(Number(e.target.value))}
                  className="border-emerald-200 focus:ring-emerald-500"
                  placeholder="Enter duration in minutes"
                />
                <p className="text-xs text-emerald-600">
                  Students will have {markDuration} minutes to mark attendance
                </p>
              </div>

              {/* Start Time Setting */}
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-sm font-medium text-emerald-700">
                  Start Time
                </Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startMark}
                  onChange={(e) => setStartMark(e.target.value)}
                  className="border-emerald-200 focus:ring-emerald-500"
                  disabled={!marking}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={startMarkingNow}
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Now
                </Button>
                
                {isCurrentlyActive && (
                  <Button
                    onClick={stopMarking}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Stop Marking
                  </Button>
                )}
              </div>

              {/* Save Button */}
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions Overview */}
      <Card className="w-full max-w-2xl mx-auto border-emerald-100 shadow-md">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-100">
          <CardTitle className="flex items-center gap-2 text-emerald-800">
            <Calendar className="h-5 w-5" />
            Active Marking Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {courses.filter(course => course.marking && course.startmark).length > 0 ? (
            <div className="space-y-3">
              {courses
                .filter(course => course.marking && course.startmark)
                .map(course => {
                  const endTime = new Date(new Date(course.startmark!).getTime() + (course.markduration! * 60000))
                  const isExpired = new Date() > endTime
                  
                  return (
                    <div
                      key={course.id}
                      className={`p-3 rounded-lg border ${
                        isExpired 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-emerald-900">
                            {course.code} - {course.name}
                          </h4>
                          <p className="text-sm text-emerald-600">
                            Started: {format(new Date(course.startmark!), "dd MMM 'at' HH:mm")}
                          </p>
                          <p className="text-sm text-emerald-600">
                            Ends: {format(endTime, "dd MMM 'at' HH:mm")}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          isExpired 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isExpired ? 'Expired' : 'Active'}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="text-emerald-600 text-center py-4">
              No active marking sessions
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}