'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { SendHorizonal, Bot, User, Loader2 } from 'lucide-react';

// Define the structure of a chat message
interface Message {
  sender: 'user' | 'bot';
  content: string; // User's query
  answer?: {      // Bot's structured answer
    headings?: string[];
    summary?: string;
    keywords?: string[];
    error?: string;
  };
  context?: any[]; // For displaying source context
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { sender: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/chat?message=${encodeURIComponent(input)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get a response.');
      }

      const botMessage: Message = { 
        sender: 'bot', 
        content: '', // Bot doesn't have simple content
        answer: data.answer,
        context: data.context
      };
      setMessages((prev) => [...prev, botMessage]);

    } catch (err: any) {
      const errorMessage: Message = {
        sender: 'bot',
        content: '',
        answer: { error: `An error occurred: ${err.message}` }
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBotMessage = (msg: Message) => {
    if (msg.answer?.error) {
      return <p className="text-red-400">{msg.answer.error}</p>;
    }
    return (
      <div className="space-y-3">
        {msg.answer?.summary && <p>{msg.answer.summary}</p>}
        {msg.answer?.headings && msg.answer.headings.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-300">Key Headings:</h4>
            <ul className="list-disc list-inside text-slate-400">
              {msg.answer.headings.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
        {msg.answer?.keywords && msg.answer.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.answer.keywords.map((kw, i) => (
              <span key={i} className="px-2 py-1 bg-slate-700 text-sm rounded-full">{kw}</span>
            ))}
          </div>
        )}
        {msg.context && (
            <details className="text-xs pt-2">
                <summary className="cursor-pointer text-slate-500">Show Context</summary>
                <pre className="mt-2 p-2 bg-slate-900 rounded-md overflow-x-auto text-slate-400">
                    {JSON.stringify(msg.context, null, 2)}
                </pre>
            </details>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl flex flex-col h-[70vh] bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'bot' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center"><Bot className="h-5 w-5 text-white" /></div>}
            <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
              {msg.sender === 'user' ? msg.content : renderBotMessage(msg)}
            </div>
            {msg.sender === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center"><User className="h-5 w-5 text-white" /></div>}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center"><Bot className="h-5 w-5 text-white" /></div>
             <div className="max-w-md p-3 rounded-lg bg-slate-700 text-slate-200">
                <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
        <div className="flex items-center bg-slate-900 rounded-lg">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the document..."
            className="w-full bg-transparent p-3 text-slate-200 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 text-white bg-indigo-600 rounded-r-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            <SendHorizonal className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}