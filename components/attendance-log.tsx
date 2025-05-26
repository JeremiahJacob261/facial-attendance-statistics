"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, Download, Filter, Video, VideoOff, Clock } from "lucide-react"
import { format } from "date-fns"
import { useMobile } from "@/hooks/use-mobile"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import FaceDetection from "@/components/face-detection"
import FaceCompare from "@/components/facecompare"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AttendanceDurationSetter from "@/components/attendance-duration-setter"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Course {
  id: number
  code: string
  name: string
}

interface AttendanceRecord {
  id: number
  student_id: number
  student_name: string
  student_matric: string
  student_photo: string | null
  date: string
  status: string
  created_at: string // Add timestamp field
}

export default function AttendanceLog() {
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useMobile()
  const [isAttendanceActive, setIsAttendanceActive] = useState(false)
  // const { toast } = useToast(); // If you want to add user-facing toast notifications for errors

  useEffect(() => {
    // Fetch courses
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase.from("ox_courses").select("id, code, name").order("id")

        if (error) throw error
        if (data && data.length > 0) {
          setCourses(data)
          setSelectedCourse(data[0].id) // Select first course by default
        }
      } catch (error: any) {
        console.error("Error fetching courses:", error)
      }
    }

    fetchCourses()
  }, [])

  useEffect(() => {
    // Fetch attendance dates when course changes
    if (selectedCourse) {
      fetchAttendanceDates()
    }
  }, [selectedCourse])

  useEffect(() => {
    // Fetch attendance records when date or course changes
    if (selectedDate && selectedCourse) {
      fetchAttendanceRecords()
    }
  }, [selectedDate, selectedCourse])

  // Listen for updates from other components
  useEffect(() => {
    window.addEventListener("attendanceUpdated", handleAttendanceUpdate)
    return () => {
      window.removeEventListener("attendanceUpdated", handleAttendanceUpdate)
    }
  }, [selectedCourse, selectedDate])

  const handleAttendanceUpdate = () => {
    if (selectedCourse && selectedDate) {
      fetchAttendanceRecords()
      fetchAttendanceDates()
    }
  }

  const fetchAttendanceDates = async () => {
    if (!selectedCourse) return

    try {
      const { data, error } = await supabase
        .from("ox_attendance")
        .select("date")
        .eq("course_id", selectedCourse)
        .order("date", { ascending: false })

      if (error) throw error

      // Get unique dates
      const uniqueDates = [...new Set(data.map((item) => item.date))]
      setDates(uniqueDates)

      // If we have dates and the currently selected date isn't in the list,
      // select the most recent date
      if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) {
        setSelectedDate(uniqueDates[0])
      }
    } catch (error: any) {
      console.error("Error fetching attendance dates:", error)
    }
  }

  const fetchAttendanceRecords = async () => {
    if (!selectedCourse || !selectedDate) return

    setLoading(true)
    try {
      // Join attendance with students to get names and matric numbers
      const { data, error } = await supabase
        .from("ox_attendance")
        .select(`
          id,
          student_id,
          date,
          status,
          created_at,
          ox_students (
            name,
            matric_no,
            photo_url
          )
        `)
        .eq("course_id", selectedCourse)
        .eq("date", selectedDate)
        .order("created_at", { ascending: false }) // Order by timestamp, most recent first

      if (error) throw error

      // Transform the data to flatten the structure
      const formattedData = data.map((record) => ({
        id: record.id,
        student_id: record.student_id,
        student_name: record.ox_students.name,
        student_matric: record.ox_students.matric_no,
        student_photo: record.ox_students.photo_url,
        date: record.date,
        status: record.status,
        created_at: record.created_at,
      }))

      setAttendanceLog(formattedData)
    } catch (error: any) {
      console.error("Error fetching attendance records:", error)
      // toast({ title: "Error", description: "Failed to fetch attendance records.", variant: "destructive" });
    } finally {
      setLoading(false)
    }
  }

  const exportAttendance = async () => {
    if (!selectedCourse) {
        console.warn("No course selected to export.");
        return;
    }

    const selectedCourseInfo = courses.find((c) => c.id === selectedCourse)
    const courseCode = selectedCourseInfo ? selectedCourseInfo.code : "Unknown"

    setLoading(true);

    try {
      // Fetch ALL students from ox_students table
      const { data: allStudents, error: studentsError } = await supabase
        .from('ox_students')
        .select('id, name, matric_no')
        .order('name');

      if (studentsError) {
        console.error('Error fetching all students for export:', studentsError);
        setLoading(false);
        return;
      }

      const allStudentsList = allStudents || [];

      // Create a Map of student_ids to their attendance record for the selected date
      const presentStudentMap = new Map(
        attendanceLog.map(record => [record.student_id, record])
      );

      // Generate CSV content rows with all students
      const csvRows = allStudentsList.map(student => {
        const attendanceRecord = presentStudentMap.get(student.id);
        const isPresent = attendanceRecord !== undefined;
        const status = isPresent ? attendanceRecord.status || "Present" : "Absent";
        const timestamp = isPresent 
          ? format(new Date(attendanceRecord.created_at), "dd/MM/yyyy HH:mm:ss")
          : "N/A";
        
        const matricNo = student.matric_no || "N/A";
        const name = student.name || "Unknown Student";
        return `${matricNo},${name},${status},${timestamp}`;
      });

      const csvContent = [
        `Course: ${courseCode} - ${selectedCourseInfo?.name || "Unknown"}`,
        `Date: ${format(new Date(selectedDate), "dd MMM yyyy")}`,
        `Export Date: ${format(new Date(), "dd MMM yyyy HH:mm:ss")}`,
        "",
        "Matric No,Name,Status,Marked At",
        ...csvRows,
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance-${courseCode}-${selectedDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error during export process:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">Take Attendance</TabsTrigger>
          <TabsTrigger value="settings">Duration Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="attendance" className="space-y-4">
          {/* Video Feed Card */}
          <Card className="w-full border-emerald-100 shadow-md animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-100">
              <CardTitle className="text-lg sm:text-xl text-emerald-900">Take Attendance</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pt-4">
              <FaceCompare/>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex items-center gap-1 sm:gap-2">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                <Select
                  value={selectedCourse?.toString() || ""}
                  onValueChange={(value) => setSelectedCourse(Number(value))}
                >
                  <SelectTrigger className="w-[180px] text-xs sm:text-sm h-8 sm:h-10 border-emerald-200 focus:ring-emerald-500">
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

              <div className="flex items-center gap-1 sm:gap-2">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                <Select value={selectedDate} onValueChange={setSelectedDate} disabled={dates.length === 0}>
                  <SelectTrigger className="w-[180px] text-xs sm:text-sm h-8 sm:h-10 border-emerald-200 focus:ring-emerald-500">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {dates.length > 0 ? (
                      dates.map((date) => (
                        <SelectItem key={date} value={date}>
                          {format(new Date(date), "dd MMM yyyy")}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={selectedDate}>{format(new Date(selectedDate), "dd MMM yyyy")}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={exportAttendance}
              disabled={attendanceLog.length === 0}
              className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 btn-hover-effect"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>

          <div className="border rounded-md border-emerald-100 shadow-sm animate-fade-in hover-card">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-2 border-b border-emerald-100">
              <h3 className="font-medium text-sm sm:text-base text-emerald-800">Attendance ({attendanceLog.length})</h3>
            </div>

            {loading ? (
              <div className="p-3 sm:p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="text-sm text-emerald-600 mt-2">Loading attendance records...</p>
              </div>
            ) : attendanceLog.length > 0 ? (
              <ul className="divide-y divide-emerald-100 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                {attendanceLog.map((record, index) => (
                  <li
                    key={record.id}
                    className="p-2 sm:p-3 flex items-center hover:bg-emerald-50 transition-colors duration-200"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {record.student_photo ? (
                      <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full overflow-hidden mr-2 sm:mr-3 border border-emerald-200">
                        <img
                          src={record.student_photo || "/placeholder.svg"}
                          alt={record.student_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-2 sm:mr-3 text-xs sm:text-sm">
                        {record.student_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm sm:text-base text-emerald-900">{record.student_name}</p>
                      <p className="text-xs text-emerald-600">
                        {record.student_matric} • {record.status}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-emerald-500 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(record.created_at), "dd/MM/yyyy HH:mm:ss")}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3 sm:p-4 text-center text-emerald-600 text-sm">No attendance records for this date</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <AttendanceDurationSetter />
        </TabsContent>
      </Tabs>
    </div>
  )
}
