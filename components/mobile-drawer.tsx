"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Users, UserPlus, BarChart3, Menu } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

interface MobileDrawerProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function MobileDrawer({ activeTab, setActiveTab }: MobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useMobile()

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false)
    }
  }, [isMobile])

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (isOpen && !target.closest(".drawer") && !target.closest(".drawer-toggle")) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setIsOpen(false)
  }

  if (!isMobile) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="drawer-toggle text-emerald-700 hover:bg-emerald-50"
      >
        <Menu className="h-6 w-6" />
      </Button>

      <div className={`drawer-overlay ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(false)}></div>

      <div className={`drawer ${isOpen ? "open" : ""} border-r border-emerald-100`}>
        <div className="p-4 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center mr-3">
              <Users className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-emerald-950">Face Attendance</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-emerald-700">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4">
          <nav className="space-y-2">
            <Button
              variant={activeTab === "attendance" ? "default" : "ghost"}
              className={`w-full justify-start text-left ${
                activeTab === "attendance"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-800 hover:bg-emerald-50"
              }`}
              onClick={() => handleTabChange("attendance")}
            >
              <Users className="mr-2 h-5 w-5" />
              Attendance
            </Button>

            <Button
              variant={activeTab === "register" ? "default" : "ghost"}
              className={`w-full justify-start text-left ${
                activeTab === "register"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-800 hover:bg-emerald-50"
              }`}
              onClick={() => handleTabChange("register")}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Register
            </Button>

            <Button
              variant={activeTab === "statistics" ? "default" : "ghost"}
              className={`w-full justify-start text-left ${
                activeTab === "statistics"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-800 hover:bg-emerald-50"
              }`}
              onClick={() => handleTabChange("statistics")}
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              Statistics
            </Button>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-emerald-100">
          <p className="text-xs text-emerald-600 text-center">© {new Date().getFullYear()} Face Attendance System</p>
        </div>
      </div>
    </>
  )
}
