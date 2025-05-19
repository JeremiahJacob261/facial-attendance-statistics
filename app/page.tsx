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
          <a
        href="/register"
        className="rounded bg-emerald-500 py-2 px-4 text-white hover:bg-emerald-600 transition-colors duration-200"
          >
        Register
          </a>
        </div>
      </section>

      <footer className="bg-white border-t border-emerald-100 py-3 px-4 text-center text-sm text-emerald-700">
        <p>© {new Date().getFullYear()} Lecturers Portal. All rights reserved.</p>
      </footer>
    </main>
  )
}
