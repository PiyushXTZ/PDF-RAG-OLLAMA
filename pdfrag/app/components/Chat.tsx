'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { SendHorizonal, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  sender: 'user' | 'bot';
  content: string;
  answer?: Record<string, any>;
  context?: any[];
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const url = `http://localhost:8000/chat?message=${encodeURIComponent(input)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get a response.');
      }

      // Client-side fallback: if server returned raw unparsed JSON, parse it here
      let answer = data.answer;
      if (answer?.error && answer?.raw) {
        try {
          const parsed = JSON.parse(answer.raw);
          answer = parsed;
        } catch {
          // keep the error answer as-is
        }
      }

      const botMessage: Message = {
        sender: 'bot',
        content: '',
        answer,
        context: data.context,
      };
      setMessages((prev) => [...prev, botMessage]);

    } catch (err: any) {
      const errorMessage: Message = {
        sender: 'bot',
        content: '',
        answer: { error: `An error occurred: ${err.message}` },
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBotMessage = (msg: Message) => {
    const a = msg.answer as any;

    if (a?.error && !a?.raw) {
      return <p className="text-red-400">{a.error}</p>;
    }

    return (
      <div className="space-y-4">

        {/* Overview */}
        {a?.overview && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-1 text-sm uppercase tracking-wide">
              Overview
            </h4>
            <p className="text-slate-200 leading-relaxed">{a.overview}</p>
          </div>
        )}

        {/* Detailed Explanation */}
        {a?.explanation && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-1 text-sm uppercase tracking-wide">
              Explanation
            </h4>
            <div className="space-y-2">
              {a.explanation.split('\n\n').map((para: string, i: number) => (
                <p key={i} className="text-slate-300 leading-relaxed">{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Characteristics */}
        {a?.characteristics?.length > 0 && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-2 text-sm uppercase tracking-wide">
              Characteristics
            </h4>
            <div className="space-y-2">
              {a.characteristics.map((c: any, i: number) => (
                <div key={i} className="bg-slate-900 rounded-md p-3 border border-slate-700">
                  <p className="font-semibold text-slate-100 text-sm">{c.title}</p>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How It Works */}
        {a?.howItWorks && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-1 text-sm uppercase tracking-wide">
              How It Works
            </h4>
            <div className="space-y-2">
              {a.howItWorks.split('\n\n').map((para: string, i: number) => (
                <p key={i} className="text-slate-300 leading-relaxed">{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Examples */}
        {a?.examples?.length > 0 && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-2 text-sm uppercase tracking-wide">
              Examples
            </h4>
            <div className="space-y-2">
              {a.examples.map((ex: any, i: number) => (
                <div key={i} className="bg-slate-900 rounded-md p-3 border border-slate-700">
                  <p className="font-semibold text-indigo-300 text-sm">{ex.name}</p>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">{ex.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Terms */}
        {a?.keyTerms?.length > 0 && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-2 text-sm uppercase tracking-wide">
              Key Terms
            </h4>
            <div className="flex flex-wrap gap-2">
              {a.keyTerms.map((kt: any, i: number) => (
                <details
                  key={i}
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                >
                  <summary className="text-indigo-300 font-medium list-none flex items-center gap-1">
                    <span className="text-slate-500 text-xs">▶</span> {kt.term}
                  </summary>
                  <p className="text-slate-400 mt-2 leading-relaxed">{kt.definition}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Limitations */}
        {a?.limitations && (
          <div>
            <h4 className="font-semibold text-indigo-400 mb-1 text-sm uppercase tracking-wide">
              Limitations & Trade-offs
            </h4>
            <p className="text-slate-300 leading-relaxed">{a.limitations}</p>
          </div>
        )}

        {/* Summary */}
        {a?.summary && (
          <div className="border-t border-slate-600 pt-3">
            <h4 className="font-semibold text-slate-400 mb-1 text-sm uppercase tracking-wide">
              Summary
            </h4>
            <p className="text-slate-400 italic leading-relaxed">{a.summary}</p>
          </div>
        )}

        {/* Source Passages */}
        {msg.context && msg.context.length > 0 && (
          <div className="border-t border-slate-700 pt-3 space-y-2">
            <h4 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
              Source Passages ({msg.context.length})
            </h4>
            {msg.context.map((doc: any, i: number) => (
              <details key={i} className="bg-slate-900 rounded-md p-3 text-xs border border-slate-800">
                <summary className="cursor-pointer text-slate-500 font-medium list-none flex items-center gap-2">
                  <span>📄</span>
                  <span>
                    Page {doc.metadata?.loc?.pageNumber ?? '?'}
                    {doc.metadata?.source
                      ? ` — ${doc.metadata.source.split(/[\\/]/).pop()}`
                      : ''}
                  </span>
                </summary>
                <p className="mt-2 text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {doc.pageContent}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl flex flex-col h-[70vh] bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Ask a question about the uploaded document
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}
          >
            {msg.sender === 'bot' && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-xl p-3 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              {msg.sender === 'user' ? msg.content : renderBotMessage(msg)}
            </div>
            {msg.sender === 'user' && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="max-w-xl p-3 rounded-lg bg-slate-700 text-slate-200 flex items-center gap-2">
              <Loader2 className="animate-spin h-4 w-4 text-slate-400" />
              <span className="text-slate-400 text-sm">Thinking...</span>
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
            className="w-full bg-transparent p-3 text-slate-200 focus:outline-none placeholder:text-slate-600"
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
