import { Header } from '@/components/layout/header'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-6">{children}</main>
      </div>
    </TooltipProvider>
  )
}
