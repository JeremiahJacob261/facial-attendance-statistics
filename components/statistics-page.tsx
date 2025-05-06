"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Filter, Award, Users, BarChart3, Calendar, TrendingUp } from "lucide-react"

interface Course {
  id: number
  code: string
  name: string
}

interface Student {
  id: number
  name: string
  matric_no: string
}

interface AttendanceStats {
  totalStudents: number
  totalAttendanceTaken: number
  studentPercentages: {
    studentId: number
    studentName: string
    matricNo: string
    percentage: number
  }[]
  coursePercentages: {
    courseId: number
    courseName: string
    percentage: number
  }[]
  topStudentPerCourse: {
    courseId: number
    courseName: string
    studentId: number
    studentName: string
    percentage: number
  }[]
  topStudentOverall: {
    studentId: number
    studentName: string
    percentage: number
  } | null
  dateWithHighestAttendance: {
    courseId: number
    courseName: string
    date: string
    count: number
  }[]
  attendanceByDate: {
    date: string
    count: number
  }[]
}

export default function StatisticsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchCourses()
    fetchStudents()
  }, [])

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id)
    }
  }, [courses])

  useEffect(() => {
    if (students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0].id)
    }
  }, [students])

  useEffect(() => {
    if (selectedCourse) {
      fetchStatistics()
    }
  }, [selectedCourse, selectedStudent])

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase.from("ox_courses").select("id, code, name").order("code")

      if (error) throw error
      setCourses(data || [])
    } catch (error: any) {
      console.error("Error fetching courses:", error)
      toast({
        title: "Error fetching courses",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.from("ox_students").select("id, name, matric_no").order("name")

      if (error) throw error
      setStudents(data || [])
    } catch (error: any) {
      console.error("Error fetching students:", error)
      toast({
        title: "Error fetching students",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const fetchStatistics = async () => {
    if (!selectedCourse) return

    setLoading(true)
    try {
      // Get total students in the selected course
      const { data: courseStudents, error: courseStudentsError } = await supabase
        .from("ox_attendance")
        .select("student_id", { count: "exact", head: false })
        .eq("course_id", selectedCourse)

      // Get distinct student IDs
      const distinctStudentIds = courseStudents ? [...new Set(courseStudents.map((record) => record.student_id))] : []

      if (courseStudentsError) throw courseStudentsError

      // Get total attendance records for the selected course
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from("ox_attendance")
        .select("id, student_id, date")
        .eq("course_id", selectedCourse)

      if (attendanceError) throw attendanceError

      // Get all students
      const { data: allStudents, error: studentsError } = await supabase
        .from("ox_students")
        .select("id, name, matric_no")

      if (studentsError) throw studentsError

      // Get all attendance records for calculating overall stats
      const { data: allAttendance, error: allAttendanceError } = await supabase
        .from("ox_attendance")
        .select("id, course_id, student_id, date")

      if (allAttendanceError) throw allAttendanceError

      // Calculate student percentages for the selected course
      const studentAttendanceCounts = new Map<number, number>()
      attendanceRecords.forEach((record) => {
        const count = studentAttendanceCounts.get(record.student_id) || 0
        studentAttendanceCounts.set(record.student_id, count + 1)
      })

      // Get unique dates for the selected course
      const uniqueDates = new Set(attendanceRecords.map((record) => record.date))
      const totalDays = uniqueDates.size

      // Calculate percentage for each student
      const studentPercentages = allStudents
        .map((student) => {
          const attendanceCount = studentAttendanceCounts.get(student.id) || 0
          const percentage = totalDays > 0 ? (attendanceCount / totalDays) * 100 : 0
          return {
            studentId: student.id,
            studentName: student.name,
            matricNo: student.matric_no,
            percentage: Math.round(percentage),
          }
        })
        .sort((a, b) => b.percentage - a.percentage)

      // Calculate course percentages
      const courseAttendanceCounts = new Map<number, { total: number; possible: number }>()
      allAttendance.forEach((record) => {
        const courseData = courseAttendanceCounts.get(record.course_id) || { total: 0, possible: 0 }
        courseData.total += 1
        courseAttendanceCounts.set(record.course_id, courseData)
      })

      // Get all courses
      const { data: allCourses, error: coursesError } = await supabase.from("ox_courses").select("id, name")
      if (coursesError) throw coursesError

      // Calculate unique dates per course for possible attendance
      const courseDates = new Map<number, Set<string>>()
      allAttendance.forEach((record) => {
        const dates = courseDates.get(record.course_id) || new Set()
        dates.add(record.date)
        courseDates.set(record.course_id, dates)
      })

      // Update possible attendance counts
      courseDates.forEach((dates, courseId) => {
        const courseData = courseAttendanceCounts.get(courseId) || { total: 0, possible: 0 }
        courseData.possible = dates.size * allStudents.length
        courseAttendanceCounts.set(courseId, courseData)
      })

      const coursePercentages = allCourses
        .map((course) => {
          const data = courseAttendanceCounts.get(course.id) || { total: 0, possible: 0 }
          const percentage = data.possible > 0 ? (data.total / data.possible) * 100 : 0
          return {
            courseId: course.id,
            courseName: course.name,
            percentage: Math.round(percentage),
          }
        })
        .sort((a, b) => b.percentage - a.percentage)

      // Find top student per course
      const topStudentPerCourse = allCourses.map((course) => {
        // Get attendance for this course
        const courseAttendance = allAttendance.filter((record) => record.course_id === course.id)

        // Count attendance per student
        const studentCounts = new Map<number, number>()
        courseAttendance.forEach((record) => {
          const count = studentCounts.get(record.student_id) || 0
          studentCounts.set(record.student_id, count + 1)
        })

        // Get unique dates for this course
        const courseDatesSet = new Set(courseAttendance.map((record) => record.date))
        const courseDaysCount = courseDatesSet.size

        // Find student with highest attendance
        let topStudentId = -1
        let topAttendanceCount = 0
        let topPercentage = 0

        studentCounts.forEach((count, studentId) => {
          const percentage = courseDaysCount > 0 ? (count / courseDaysCount) * 100 : 0
          if (count > topAttendanceCount) {
            topStudentId = studentId
            topAttendanceCount = count
            topPercentage = percentage
          }
        })

        // Find student name
        const student = allStudents.find((s) => s.id === topStudentId)

        return {
          courseId: course.id,
          courseName: course.name,
          studentId: topStudentId,
          studentName: student ? student.name : "No data",
          percentage: Math.round(topPercentage),
        }
      })

      // Find student with highest attendance overall
      const studentOverallCounts = new Map<number, { total: number; possible: number }>()

      // For each student, calculate their total attendance and possible attendance days
      allStudents.forEach((student) => {
        const studentAttendance = allAttendance.filter((record) => record.student_id === student.id)

        // Count unique course-date combinations this student attended
        const attendedCourseDates = new Set(studentAttendance.map((record) => `${record.course_id}-${record.date}`))

        // Count total possible course-date combinations
        const possibleCourseDates = new Set<string>()
        allAttendance.forEach((record) => {
          possibleCourseDates.add(`${record.course_id}-${record.date}`)
        })

        studentOverallCounts.set(student.id, {
          total: attendedCourseDates.size,
          possible: possibleCourseDates.size,
        })
      })

      let topStudentOverall = null
      let topOverallPercentage = 0

      studentOverallCounts.forEach((counts, studentId) => {
        const percentage = counts.possible > 0 ? (counts.total / counts.possible) * 100 : 0
        if (percentage > topOverallPercentage) {
          const student = allStudents.find((s) => s.id === studentId)
          topStudentOverall = {
            studentId,
            studentName: student ? student.name : "Unknown",
            percentage: Math.round(percentage),
          }
          topOverallPercentage = percentage
        }
      })

      // Find date with highest attendance per course
      const dateWithHighestAttendance = allCourses.map((course) => {
        // Get attendance for this course
        const courseAttendance = allAttendance.filter((record) => record.course_id === course.id)

        // Count attendance per date
        const dateCounts = new Map<string, number>()
        courseAttendance.forEach((record) => {
          const count = dateCounts.get(record.date) || 0
          dateCounts.set(record.date, count + 1)
        })

        // Find date with highest count
        let highestDate = ""
        let highestCount = 0

        dateCounts.forEach((count, date) => {
          if (count > highestCount) {
            highestDate = date
            highestCount = count
          }
        })

        return {
          courseId: course.id,
          courseName: course.name,
          date: highestDate,
          count: highestCount,
        }
      })

      // Calculate attendance by date for chart
      const attendanceByDate = Array.from(uniqueDates)
        .map((date) => {
          const count = attendanceRecords.filter((record) => record.date === date).length
          return {
            date,
            count,
          }
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setStats({
        totalStudents: distinctStudentIds.length,
        totalAttendanceTaken: attendanceRecords.length,
        studentPercentages,
        coursePercentages,
        topStudentPerCourse,
        topStudentOverall,
        dateWithHighestAttendance,
        attendanceByDate,
      })
    } catch (error: any) {
      console.error("Error fetching statistics:", error)
      toast({
        title: "Error fetching statistics",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-emerald-600" />
          <Select value={selectedCourse?.toString() || ""} onValueChange={(value) => setSelectedCourse(Number(value))}>
            <SelectTrigger className="w-[200px] border-emerald-200 focus:ring-emerald-500">
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
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-3 mb-4 bg-emerald-100/50">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="students"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger
            value="courses"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Award className="h-4 w-4" />
            Courses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-100 shadow-sm premium-card">
              <CardHeader className="pb-2 premium-card-header">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-800">
                  <Users className="h-4 w-4 text-emerald-600" />
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-700">{stats?.totalStudents || 0}</div>
                <p className="text-xs text-emerald-600">
                  Students registered in {courses.find((c) => c.id === selectedCourse)?.name}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 shadow-sm premium-card">
              <CardHeader className="pb-2 premium-card-header">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-800">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  Total Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-700">{stats?.totalAttendanceTaken || 0}</div>
                <p className="text-xs text-emerald-600">
                  Attendance records for {courses.find((c) => c.id === selectedCourse)?.name}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 shadow-sm premium-card">
              <CardHeader className="pb-2 premium-card-header">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-800">
                  <Award className="h-4 w-4 text-emerald-600" />
                  Top Student Overall
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-700">
                  {stats?.topStudentOverall?.studentName || "No data"}
                </div>
                <div className="flex items-center mt-2">
                  <div className="flex-1 bg-emerald-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full premium-progress-bg rounded-full"
                      style={{ width: `${stats?.topStudentOverall?.percentage || 0}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-sm text-emerald-700">{stats?.topStudentOverall?.percentage || 0}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="premium-card-header">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Attendance Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                {stats?.attendanceByDate && stats.attendanceByDate.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.attendanceByDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        }}
                        stroke="#059669"
                      />
                      <YAxis stroke="#059669" />
                      <Tooltip
                        labelFormatter={(value) => `Date: ${formatDate(value)}`}
                        formatter={(value) => [`${value} students`, "Attendance"]}
                        contentStyle={{
                          backgroundColor: "#ecfdf5",
                          borderColor: "#a7f3d0",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Students Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-emerald-600">No attendance data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="premium-card-header">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <Users className="h-4 w-4 text-emerald-600" />
                Student Attendance Percentages
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {stats?.studentPercentages && stats.studentPercentages.length > 0 ? (
                  stats.studentPercentages.map((student) => (
                    <div key={student.studentId} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-emerald-800">{student.studentName}</span>
                        <span className="text-sm text-emerald-600">{student.matricNo}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="flex-1 bg-emerald-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full premium-progress-bg rounded-full"
                            style={{ width: `${student.percentage}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-emerald-700">{student.percentage}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-600">No student attendance data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="premium-card-header">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <Award className="h-4 w-4 text-emerald-600" />
                Top Student Per Course
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {stats?.topStudentPerCourse && stats.topStudentPerCourse.length > 0 ? (
                  stats.topStudentPerCourse.map((item) => (
                    <div key={item.courseId} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-emerald-800">{item.courseName}</span>
                        <span className="text-sm text-emerald-600">{item.studentName}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="flex-1 bg-emerald-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full premium-progress-bg rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-emerald-700">{item.percentage}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-600">No top student data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="premium-card-header">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                Course Attendance Percentages
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {stats?.coursePercentages && stats.coursePercentages.length > 0 ? (
                  stats.coursePercentages.map((course) => (
                    <div key={course.courseId} className="space-y-1">
                      <span className="text-sm font-medium text-emerald-800">{course.courseName}</span>
                      <div className="flex items-center">
                        <div className="flex-1 bg-emerald-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full premium-progress-bg rounded-full"
                            style={{ width: `${course.percentage}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-emerald-700">{course.percentage}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-600">No course attendance data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 shadow-md">
            <CardHeader className="premium-card-header">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Date with Highest Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {stats?.dateWithHighestAttendance && stats.dateWithHighestAttendance.length > 0 ? (
                  stats.dateWithHighestAttendance.map((item) => (
                    <div
                      key={item.courseId}
                      className="flex justify-between items-center py-2 border-b border-emerald-100"
                    >
                      <div>
                        <p className="font-medium text-emerald-800">{item.courseName}</p>
                        <p className="text-sm text-emerald-600">{item.date ? formatDate(item.date) : "No data"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-emerald-700">{item.count}</p>
                        <p className="text-sm text-emerald-600">students</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-600">No attendance peak data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
