"use client"

import { Button } from "@/components/ui/button"
import { Users, UserPlus, BarChart3 } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

interface DesktopMenuProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function DesktopMenu({ activeTab, setActiveTab }: DesktopMenuProps) {
  const isMobile = useMobile()

  if (isMobile) return null

  return (
    <nav className="hidden md:flex items-center space-x-1">
      <Button
        variant={activeTab === "attendance" ? "default" : "ghost"}
        className={`flex items-center ${
          activeTab === "attendance"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "text-emerald-800 hover:bg-emerald-50"
        }`}
        onClick={() => setActiveTab("attendance")}
      >
        <Users className="mr-2 h-4 w-4" />
        Attendance
      </Button>

      <Button
        variant={activeTab === "register" ? "default" : "ghost"}
        className={`flex items-center ${
          activeTab === "register"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "text-emerald-800 hover:bg-emerald-50"
        }`}
        onClick={() => setActiveTab("register")}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Register
      </Button>

      <Button
        variant={activeTab === "statistics" ? "default" : "ghost"}
        className={`flex items-center ${
          activeTab === "statistics"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "text-emerald-800 hover:bg-emerald-50"
        }`}
        onClick={() => setActiveTab("statistics")}
      >
        <BarChart3 className="mr-2 h-4 w-4" />
        Statistics
      </Button>
    </nav>
  )
}
