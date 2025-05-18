"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Users } from "lucide-react"
import RegisterForm from "@/components/register-form"
import AttendanceLog from "@/components/attendance-log"
import RegisteredList from "@/components/registered-list"
import StatisticsPage from "@/components/statistics-page"
import MobileDrawer from "@/components/mobile-drawer"
import DesktopMenu from "@/components/desktop-menu"

export default function Home() {
  const [activeTab, setActiveTab] = useState("attendance")

  return (
    <main className="flex min-h-screen flex-col bg-emerald-50">
      <header className="bg-white border-b border-emerald-100 py-3 px-4 sm:py-4 sm:px-6 flex items-center justify-between shadow-sm sticky top-0 z-30 animate-slide-down">
        <div className="flex items-center">
          <MobileDrawer activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center mr-3">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-950">Face Attendance System</h1>
        </div>
        <div className="flex items-center gap-2">
          <DesktopMenu activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </header>

      <div className="flex flex-col flex-1 p-3 sm:p-6 gap-4 sm:gap-6">
        <Card className="w-full border-emerald-100 shadow-md animate-fade-in">
          <CardContent className="p-0">
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="attendance" className="p-4 animate-scale-up tab-content-transition">
                <AttendanceLog />
              </TabsContent>
              <TabsContent value="register" className="p-4 animate-scale-up tab-content-transition">
                <RegisterForm onRegister={() => setActiveTab("attendance")} />
                <Separator className="my-4 bg-emerald-100" />
                <RegisteredList />
              </TabsContent>
              <TabsContent value="statistics" className="p-4 animate-scale-up tab-content-transition">
                <StatisticsPage />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <footer className="bg-white border-t border-emerald-100 py-3 px-4 text-center text-sm text-emerald-700">
        <p>© {new Date().getFullYear()} Face Attendance System. All rights reserved.</p>
        <p>Built by : <br/>
FANIMI SAMUEL<br/>
Eyimegwu Chukwugozilim Allwell<br/>
Ogundare Oluwanimofe Faith



        </p>
      </footer>

    </main>
  )
}
