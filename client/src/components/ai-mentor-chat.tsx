import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, X, Send, Bot, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiMentorChatProps {
  projectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
  onAction?: (action: string) => void;
}

import { createPortal } from "react-dom";

export function AiMentorChat({ projectId, isOpen, onOpenChange, initialMessage, onAction }: AiMentorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastInitialMessage = useRef<string | undefined>(undefined);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", `/api/projects/${projectId}/chat`, {
        message,
        history
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      if (data.action && onAction) {
        onAction(data.action);
      }
    },
    onError: (error) => {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    }
  });

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: text }]);
    chatMutation.mutate(text);
  };

  useEffect(() => {
    if (isOpen && initialMessage && initialMessage !== lastInitialMessage.current) {
      lastInitialMessage.current = initialMessage;
      handleSend(initialMessage);
    }
  }, [isOpen, initialMessage]);

  // Reset initialization when chat is closed so new messages can be sent on next open
  useEffect(() => {
    if (!isOpen) {
      lastInitialMessage.current = undefined;
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const content = (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => onOpenChange(true)}
          className="!fixed !bottom-8 !right-8 h-14 rounded-full shadow-lg z-[9999] px-4 flex items-center gap-2 animate-in fade-in zoom-in duration-300"
          size="lg"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="font-semibold">Ask AI Mentor</span>
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="!fixed !bottom-4 !right-8 w-[400px] h-[600px] max-h-[85vh] shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right-10 fade-in border-2 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Mentor</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-sm">
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground mt-10">
                    <div className="bg-primary/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Bot className="h-10 w-10 text-primary" />
                    </div>
                    <p className="font-medium text-lg text-foreground">Hi! I'm your AI Mentor.</p>
                    <p className="text-sm mt-1">Ask me anything about this project!</p>
                    <div className="mt-6 grid grid-cols-1 gap-2 text-xs text-left max-w-[250px] mx-auto">
                      <div className="bg-muted p-2 rounded border cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSend("Run Auto-Fix on my project")}>
                        "Run Auto-Fix on my project"
                      </div>
                      <div className="bg-muted p-2 rounded border cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSend("Explain the project structure")}>
                        "Explain the project structure"
                      </div>
                    </div>
                  </div>
                )}
                
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 max-w-[85%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
                    )}>
                      {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={cn(
                      "p-3 rounded-lg text-sm shadow-sm",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex gap-2 mr-auto max-w-[85%]">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-card border p-3 rounded-lg rounded-tl-none text-sm flex items-center gap-1 shadow-sm">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce delay-100">●</span>
                      <span className="animate-bounce delay-200">●</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t mt-auto bg-muted/30">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                  setInput("");
                }}
                className="flex gap-2"
              >
                <Input 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your project..."
                  disabled={chatMutation.isPending}
                  className="shadow-sm"
                />
                <Button type="submit" size="icon" disabled={chatMutation.isPending || !input.trim()} className="shadow-sm">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  return createPortal(content, document.body);
}
