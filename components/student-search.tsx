"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Search, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface StudentSearchProps {
  onFaceDetected: (imageUrl: string, studentName: string, studentId: number) => void
}

export default function StudentSearch({ onFaceDetected }: StudentSearchProps) {
  const [matricNo, setMatricNo] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<{
    id: number
    name: string
    photo_url: string
  } | null>(null)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!matricNo.trim()) {
      setError("Please enter a matriculation number")
      return
    }

    setError(null)
    setIsSearching(true)
    setSearchResult(null)

    try {
      toast({
        title: "Searching",
        description: `Looking for student with matric number: ${matricNo}`,
      })

      const { data, error } = await supabase
        .from("students")
        .select("id, name, photo_url")
        .eq("matric_no", matricNo)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          setError(`No student found with matric number: ${matricNo}`)
          toast({
            title: "Student not found",
            description: `No student found with matric number: ${matricNo}`,
            variant: "destructive",
          })
        } else {
          throw error
        }
      } else if (!data.photo_url) {
        setError(`Student found, but no photo is available for comparison`)
        toast({
          title: "No photo available",
          description: `Student found, but no photo is available for comparison`,
          variant: "destructive",
        })
      } else {
        setSearchResult(data)
        toast({
          title: "Student found",
          description: `Found ${data.name} with matric number: ${matricNo}`,
        })

        // Pass the photo URL to the parent component for face comparison
        onFaceDetected(data.photo_url, data.name, data.id)
      }
    } catch (error: any) {
      console.error("Error searching for student:", error)
      setError(`Error searching for student: ${error.message}`)
      toast({
        title: "Search error",
        description: `Error searching for student: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter student matric number"
            value={matricNo}
            onChange={(e) => setMatricNo(e.target.value)}
            className="border-emerald-200 focus:ring-emerald-500"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !matricNo.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 btn-hover-effect"
        >
          {isSearching ? (
            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {isSearching ? "Searching..." : "Search Student"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searchResult && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-md animate-scale-up">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-emerald-200">
            <img
              src={searchResult.photo_url || "/placeholder.svg"}
              alt={searchResult.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="font-medium text-emerald-900">{searchResult.name}</p>
            <p className="text-sm text-emerald-600">Matric No: {matricNo}</p>
          </div>
          <div className="ml-auto flex items-center text-emerald-600 text-sm">
            <Camera className="h-4 w-4 mr-1" />
            <span>Ready for face comparison</span>
          </div>
        </div>
      )}
    </div>
  )
}
