export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at center,rgba(212,168,67,0.06) 0%,transparent 60%)' }}>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 16px rgba(212,168,67,0.7))' }}>♟</div>
          <h1 className="font-display text-4xl text-primary tracking-wider">CHESSPAY</h1>
          <p className="text-secondary text-sm mt-1 tracking-widest uppercase">Play. Win. Get Paid.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
