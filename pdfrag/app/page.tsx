import FileUpload from './components/FileUpload';
import Chat from './components/Chat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-900 text-white">
      <div className="w-full max-w-2xl text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Document Q&A Assistant
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Powered by Llama3, Ollama, and Qdrant
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-8">
        <FileUpload />
        <Chat />
      </div>

      <footer className="mt-10 text-slate-500">
        Built for your Express.js Backend
      </footer>
    </main>
  );
}