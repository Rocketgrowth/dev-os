import Link from 'next/link'
import { FileText, Target, MessageSquare, MapPin, Edit, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold">
              Contract<span className="text-primary">IQ</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-muted/50 to-background">
        <div className="container flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium mb-6">
            <span className="text-primary">AI-Powered</span>
            <span className="mx-2 text-muted-foreground">Contract Review</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mb-6">
            Review contracts in minutes,{' '}
            <span className="text-primary">not hours</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mb-10">
            Upload your NDA or MSA and get AI-extracted key terms with confidence
            scores, page references, and the ability to chat with your contract.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">See How It Works</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 p-8 bg-card rounded-xl border shadow-sm">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">15 min</div>
              <div className="text-sm text-muted-foreground">
                Average review time
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">88%+</div>
              <div className="text-sm text-muted-foreground">
                Extraction accuracy
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">$0.25</div>
              <div className="text-sm text-muted-foreground">Per contract</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">
            Everything you need to review contracts confidently
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            ContractIQ extracts the terms that matter, shows you exactly where
            they are, and lets you ask questions in plain English.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Key Term Extraction</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically extract critical terms like governing law, liability
                  caps, termination clauses, and more from NDAs and MSAs.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Confidence Scoring</h3>
                <p className="text-sm text-muted-foreground">
                  Every extracted term shows a confidence score so you know exactly
                  which clauses need manual verification.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Chat with Your Contract</h3>
                <p className="text-sm text-muted-foreground">
                  Ask questions in plain English and get answers grounded in your
                  document text with page citations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Page-Level Attribution</h3>
                <p className="text-sm text-muted-foreground">
                  Every extracted term includes the exact page number and source
                  sentence for easy verification.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Edit className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Custom Terms</h3>
                <p className="text-sm text-muted-foreground">
                  Add up to 5 custom terms specific to your business needs and have
                  the AI extract those too.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">
                  Your contracts are encrypted at rest and in transit. We never use
                  your data to train AI models.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/50">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to review contracts faster?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Start your free trial today. No credit card required.
          </p>
          <Button size="lg" asChild>
            <Link href="/signup">Get Started Free</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
