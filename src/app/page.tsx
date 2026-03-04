import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Friday
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
            Doc Assistant
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Ask anything about the documentation.
          </p>
        </header>
        <ChatInterface />
      </div>
    </main>
  );
}
