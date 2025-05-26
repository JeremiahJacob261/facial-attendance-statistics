import { supabase } from "@/lib/supabase"

export interface CourseMarkingStatus {
  isActive: boolean
  timeRemaining: number // in minutes
  startTime: Date | null
  endTime: Date | null
}

export async function checkCourseMarkingStatus(courseId: number): Promise<CourseMarkingStatus> {
  try {
    const { data: course, error } = await supabase
      .from("ox_courses")
      .select("marking, markduration, startmark")
      .eq("id", courseId)
      .single()

    if (error) throw error

    if (!course?.marking || !course?.startmark || !course?.markduration) {
      return {
        isActive: false,
        timeRemaining: 0,
        startTime: null,
        endTime: null,
      }
    }

    const startTime = new Date(course.startmark)
    const endTime = new Date(startTime.getTime() + (course.markduration * 60000))
    const now = new Date()

    const isActive = now >= startTime && now <= endTime
    const timeRemaining = isActive ? Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000)) : 0

    return {
      isActive,
      timeRemaining,
      startTime,
      endTime,
    }
  } catch (error) {
    console.error("Error checking course marking status:", error)
    return {
      isActive: false,
      timeRemaining: 0,
      startTime: null,
      endTime: null,
    }
  }
}

export async function getActiveMarkingCourses() {
  try {
    const { data: courses, error } = await supabase
      .from("ox_courses")
      .select("id, code, name, marking, markduration, startmark")
      .eq("marking", true)
      .not("startmark", "is", null)

    if (error) throw error

    const now = new Date()
    const activeCourses = courses?.filter(course => {
      if (!course.startmark || !course.markduration) return false
      
      const startTime = new Date(course.startmark)
      const endTime = new Date(startTime.getTime() + (course.markduration * 60000))
      
      return now >= startTime && now <= endTime
    }) || []

    return activeCourses
  } catch (error) {
    console.error("Error fetching active marking courses:", error)
    return []
  }
}