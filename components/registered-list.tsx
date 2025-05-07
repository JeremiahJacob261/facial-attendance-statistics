"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface Student {
  id: number
  name: string
  matric_no: string
  photo_url: string | null
}

export default function RegisteredList() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadStudents()

    // Listen for updates from other components
    window.addEventListener("registeredListUpdated", loadStudents)
    return () => {
      window.removeEventListener("registeredListUpdated", loadStudents)
    }
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("ox_students").select("id, name, matric_no, photo_url").order("name")

      if (error) throw error
      setStudents(data || [])
    } catch (error: any) {
      console.error("Error loading students:", error)
      toast({
        title: "Error loading students",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    try {
      // Delete student from Supabase
      const { error } = await supabase.from("ox_students").delete().eq("id", id)

      if (error) throw error

      // Update local state
      setStudents(students.filter((student) => student.id !== id))

      toast({
        title: "Student removed",
        description: `${name} has been removed from the system`,
      })
    } catch (error: any) {
      console.error("Error deleting student:", error)
      toast({
        title: "Error removing student",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <p className="text-slate-500 text-center py-4 text-sm">Loading students...</p>
  }

  if (students.length === 0) {
    return <p className="text-slate-500 text-center py-4 text-sm">No students registered yet</p>
  }

  return (
    <div className="px-3 sm:px-6">
      <h3 className="font-medium mb-2 text-sm sm:text-base">Registered Students ({students.length})</h3>
      <ul className="space-y-1 sm:space-y-2 max-h-[200px] sm:max-h-[300px] overflow-y-auto pr-1 sm:pr-2">
        {students.map((student) => (
          <li
            key={student.id}
            className="flex items-center justify-between p-1.5 sm:p-2 bg-slate-50 rounded-md text-sm"
          >
            <div className="flex items-center gap-2">
              {student.photo_url ? (
                <div className="h-8 w-8 rounded-full overflow-hidden">
                  <img
                    src={student.photo_url || "/placeholder.svg"}
                    alt={student.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <span className="font-medium">{student.name}</span>
                <p className="text-xs text-slate-500">{student.matric_no}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {student.photo_url && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-8 sm:w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {student.name} - {student.matric_no}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-2">
                      <img
                        src={student.photo_url || "/placeholder.svg"}
                        alt={student.name}
                        className="w-full h-auto max-h-[400px] object-contain rounded-md"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(student.id, student.name)}
                className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
