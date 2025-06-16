"use client"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-emerald-50">
      <header className="bg-white border-b border-emerald-100 py-4 px-6 text-center shadow-sm">
        <img src="/logo.png" className="mx-auto w-20" />
        <h1 className="text-2xl font-bold text-emerald-950">Welcome Lecturers</h1>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center p-6 space-y-4">
        <p className="text-xl text-emerald-700 text-center">
          Welcome to the Lecturers Portal. Please sign in to access your dashboard and manage your classes.
        </p>
        <div className="flex space-x-4">
          <a
        href="/login"
        className="rounded bg-emerald-500 py-2 px-4 text-white hover:bg-emerald-600 transition-colors duration-200"
          >
        Login
          </a>
      
        </div>
      </section>

        <div className="bg-white p-6 rounded-lg shadow-md border border-sky-200 flex flex-col items-center space-y-4">
        <h2 className="text-xl font-semibold text-sky-800">I am a Student</h2>
        <p className="text-sm text-sky-600 text-center">
          Access your attendance statistics and related information.
        </p>
        <button
          onClick={() => { window.location.href = "https://facereg-stats.vercel.app"; }}
          className="w-full sm:w-auto rounded bg-sky-500 py-2 px-4 text-white hover:bg-sky-600 transition-colors duration-200"
        >
          Go to Student Stats
        </button>
          </div>

      <footer className="bg-white border-t border-emerald-100 py-3 px-4 text-center text-sm text-emerald-700">
        <p>© {new Date().getFullYear()} Lecturers Portal. All rights reserved.</p>
      </footer>
    </main>
  )
}
