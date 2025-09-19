'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'initial' | 'uploading' | 'success' | 'error'>('initial');
  const [message, setMessage] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setStatus('initial');
      setMessage(e.target.files[0].name);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setStatus('error');
      setMessage('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    setStatus('uploading');
    setMessage('Uploading file...');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('success');
      setMessage(`File queued successfully! Job ID: ${data.jobId}`);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An unknown error occurred.');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="animate-spin h-5 w-5 mr-2" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />;
      default:
        return <UploadCloud className="h-5 w-5 mr-2" />;
    }
  };

  return (
    <div className="w-full max-w-2xl p-6 bg-slate-800 rounded-lg border border-slate-700">
      <h2 className="text-2xl font-bold mb-4 text-white">Upload Document</h2>
      <p className="text-slate-400 mb-4">
        Upload a PDF document to add its contents to the knowledge base.
      </p>
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="pdf-upload"
          className="flex items-center justify-center w-full px-4 py-6 bg-slate-900 border-2 border-dashed border-slate-600 rounded-md cursor-pointer hover:bg-slate-700 hover:border-slate-500 transition-colors"
        >
          {getStatusIcon()}
          <span className="text-slate-300">{message || 'Click to select a PDF file'}</span>
          <input
            id="pdf-upload"
            name="pdf"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <button
          type="submit"
          disabled={!file || status === 'uploading'}
          className="mt-4 w-full flex justify-center items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'uploading' ? 'Uploading...' : 'Start Processing'}
        </button>
      </form>
    </div>
  );
}