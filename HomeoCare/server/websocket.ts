
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { Server } from 'http';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'remedy' | 'system';
  remedyName?: string;
}

interface ConnectedUser {
  ws: WebSocket;
  username: string;
  id: string;
}

class ChatServer {
  private wss: WebSocketServer;
  private users: Map<string, ConnectedUser> = new Map();
  private messageHistory: ChatMessage[] = [];
  private readonly MAX_HISTORY = 100;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat',
      perMessageDeflate: false
    });
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      const userId = randomUUID();
      
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, userId, message);
        } catch (error) {
          console.error('Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(userId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(userId);
      });
    });
  }

  private handleMessage(ws: WebSocket, userId: string, message: any) {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, userId, message.username);
        break;
      case 'message':
        this.handleChatMessage(userId, message);
        break;
    }
  }

  private handleJoin(ws: WebSocket, userId: string, username: string) {
    // Clean username
    const cleanUsername = username.trim().substring(0, 20);
    if (!cleanUsername) return;

    // Store user
    this.users.set(userId, {
      ws,
      username: cleanUsername,
      id: userId
    });

    // Send message history
    ws.send(JSON.stringify({
      type: 'history',
      messages: this.messageHistory.slice(-50) // Send last 50 messages
    }));

    // Send user count to all users
    this.broadcastUserCount();

    // Send welcome message
    const welcomeMessage: ChatMessage = {
      id: randomUUID(),
      username: 'System',
      message: `${cleanUsername} joined the chat`,
      timestamp: new Date(),
      type: 'system'
    };

    this.addToHistory(welcomeMessage);
    this.broadcastMessage(welcomeMessage);
  }

  private handleChatMessage(userId: string, messageData: any) {
    const user = this.users.get(userId);
    if (!user) return;

    const message: ChatMessage = {
      id: randomUUID(),
      username: user.username,
      message: messageData.message.trim().substring(0, 500), // Limit message length
      timestamp: new Date(),
      type: messageData.messageType || 'message',
      remedyName: messageData.remedyName
    };

    this.addToHistory(message);
    this.broadcastMessage(message);
  }

  private handleDisconnect(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      
      const leaveMessage: ChatMessage = {
        id: randomUUID(),
        username: 'System',
        message: `${user.username} left the chat`,
        timestamp: new Date(),
        type: 'system'
      };

      this.addToHistory(leaveMessage);
      this.broadcastMessage(leaveMessage);
      this.broadcastUserCount();
    }
  }

  private addToHistory(message: ChatMessage) {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY) {
      this.messageHistory = this.messageHistory.slice(-this.MAX_HISTORY);
    }
  }

  private broadcastMessage(message: ChatMessage) {
    const messageStr = JSON.stringify({
      ...message,
      type: 'message'
    });

    this.users.forEach(user => {
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(messageStr);
      }
    });
  }

  private broadcastUserCount() {
    const count = this.users.size;
    const countMessage = JSON.stringify({
      type: 'userCount',
      count
    });

    this.users.forEach(user => {
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(countMessage);
      }
    });
  }
}

export function initializeWebSocket(server: Server) {
  return new ChatServer(server);
}
