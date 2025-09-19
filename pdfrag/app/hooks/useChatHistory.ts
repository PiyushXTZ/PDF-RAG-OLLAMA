'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Define the structure of messages and chats
export interface Doc {
  pageContent?: string;
  metadata?: { loc?: { pageNumber?: number } };
}

export interface IMessage {
  role: 'assistant' | 'user';
  content: string;
  documents?: Doc[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

// Helper function to safely access localStorage
const getFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key “${key}”:`, error);
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, value: T) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

export const useChatHistory = () => {
  // State to hold all chat sessions and messages
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: IMessage[] }>({});

  // Load initial data from localStorage when the hook is first used
  useEffect(() => {
    setSessions(getFromStorage('chat_sessions', []));
    setMessages(getFromStorage('chat_messages', {}));
  }, []);

  // Function to create a new chat session
  const createNewChat = useCallback((title: string): string => {
    const newId = uuidv4();
    const newSession: ChatSession = { id: newId, title, createdAt: Date.now() };
    
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    saveToStorage('chat_sessions', updatedSessions);

    const updatedMessages = { ...messages, [newId]: [] };
    setMessages(updatedMessages);
    saveToStorage('chat_messages', updatedMessages);
    
    return newId;
  }, [sessions, messages]);

  // Function to add a message to a specific chat
  const addMessage = useCallback((chatId: string, message: IMessage) => {
    if (!messages[chatId]) return;

    const updatedMessagesForChat = [...messages[chatId], message];
    const newMessages = { ...messages, [chatId]: updatedMessagesForChat };
    
    setMessages(newMessages);
    saveToStorage('chat_messages', newMessages);
  }, [messages]);
  
  // Function to get messages for a specific chat ID
  const getMessages = (chatId: string): IMessage[] => {
    return messages[chatId] || [];
  };

  return { sessions, createNewChat, addMessage, getMessages };
};