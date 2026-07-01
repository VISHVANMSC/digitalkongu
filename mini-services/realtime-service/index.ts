import { createServer } from "http";
import { Server, Socket } from "socket.io";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthData {
  token?: string;
  userId?: string;
  userName?: string;
}

interface JoinEventData {
  eventId: string;
  userId: string;
  userName: string;
}

interface LeaveEventData {
  eventId: string;
  userId: string;
}

interface EvaluationSubmittedData {
  eventId: string;
  evaluationId: string;
  evaluatorId: string;
  evaluatorName: string;
  participantId: string;
  participantName: string;
  score: number;
  timestamp: string;
}

interface ScoreUpdateData {
  eventId: string;
  participantId: string;
  participantName: string;
  previousScore: number;
  newScore: number;
  updatedBy: string;
  timestamp: string;
}

interface LeaderboardUpdateData {
  eventId: string;
  triggeredBy: string;
  reason: string;
  timestamp: string;
}

interface RoomState {
  users: Map<string, { userId: string; userName: string; socketId: string }>;
}

// ─── Server Setup ────────────────────────────────────────────────────────────

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = 3003;

// Track room state: eventId -> RoomState
const rooms = new Map<string, RoomState>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreateRoom(eventId: string): RoomState {
  if (!rooms.has(eventId)) {
    rooms.set(eventId, { users: new Map() });
  }
  return rooms.get(eventId)!;
}

function removeUserFromAllRooms(socketId: string, userId: string): string[] {
  const leftEventIds: string[] = [];
  for (const [eventId, room] of rooms.entries()) {
    const existingUser = room.users.get(userId);
    if (existingUser && existingUser.socketId === socketId) {
      room.users.delete(userId);
      leftEventIds.push(eventId);
      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(eventId);
      }
    }
  }
  return leftEventIds;
}

function getRoomUserCount(eventId: string): number {
  return rooms.get(eventId)?.users.size ?? 0;
}

// ─── Authentication Middleware ───────────────────────────────────────────────

io.use((socket, next) => {
  const auth = socket.handshake.auth as AuthData;
  const token = auth.token || socket.handshake.query.token;

  // Allow connections without token for now (token validation can be added later)
  // In production, validate the token against your auth service
  if (!token) {
    // Still allow connection but mark as unauthenticated
    socket.data.authenticated = false;
    socket.data.userId = null;
    socket.data.userName = "Anonymous";
  } else {
    socket.data.authenticated = true;
    socket.data.userId = auth.userId || null;
    socket.data.userName = auth.userName || "Authenticated User";
  }

  console.log(
    `[Auth] Socket ${socket.id} connected — authenticated: ${socket.data.authenticated}, userId: ${socket.data.userId}`
  );
  next();
});

// ─── Connection Handler ─────────────────────────────────────────────────────

io.on("connection", (socket: Socket) => {
  console.log(`[Connect] Socket ${socket.id} connected (user: ${socket.data.userName})`);

  // ── Join Event Room ────────────────────────────────────────────────────

  socket.on("join-event", (data: JoinEventData) => {
    const { eventId, userId, userName } = data;

    if (!eventId || !userId) {
      socket.emit("error", { message: "eventId and userId are required" });
      return;
    }

    const room = getOrCreateRoom(eventId);

    // Leave previous socket room for this event if rejoining
    const roomId = `event:${eventId}`;

    // Add user to socket.io room
    socket.join(roomId);

    // Track user in room state
    room.users.set(userId, { userId, userName, socketId: socket.id });

    // Store current event on socket for cleanup
    socket.data.currentEventId = eventId;
    socket.data.currentUserId = userId;

    console.log(
      `[Join] User ${userName} (${userId}) joined event ${eventId} — room size: ${room.users.size}`
    );

    // Notify others in the room
    socket.to(roomId).emit("user-joined", {
      eventId,
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });

    // Send current room info to the joiner
    socket.emit("room-info", {
      eventId,
      userCount: room.users.size,
      users: Array.from(room.users.values()).map((u) => ({
        userId: u.userId,
        userName: u.userName,
      })),
    });
  });

  // ── Leave Event Room ───────────────────────────────────────────────────

  socket.on("leave-event", (data: LeaveEventData) => {
    const { eventId, userId } = data;

    if (!eventId || !userId) {
      socket.emit("error", { message: "eventId and userId are required" });
      return;
    }

    const roomId = `event:${eventId}`;
    socket.leave(roomId);

    const room = rooms.get(eventId);
    if (room) {
      const user = room.users.get(userId);
      room.users.delete(userId);

      if (room.users.size === 0) {
        rooms.delete(eventId);
      }

      console.log(
        `[Leave] User ${user?.userName ?? userId} left event ${eventId} — room size: ${room.users.size}`
      );

      // Notify others
      socket.to(roomId).emit("user-left", {
        eventId,
        userId,
        userName: user?.userName ?? "Unknown",
        timestamp: new Date().toISOString(),
      });
    }

    // Clear socket data
    if (socket.data.currentEventId === eventId) {
      socket.data.currentEventId = null;
      socket.data.currentUserId = null;
    }
  });

  // ── Evaluation Submitted ───────────────────────────────────────────────

  socket.on("evaluation-submitted", (data: EvaluationSubmittedData) => {
    const { eventId, evaluationId, evaluatorId, evaluatorName, participantId, participantName, score, timestamp } = data;

    if (!eventId) {
      socket.emit("error", { message: "eventId is required" });
      return;
    }

    const roomId = `event:${eventId}`;

    console.log(
      `[Eval] Evaluator ${evaluatorName} submitted evaluation for ${participantName} in event ${eventId} — score: ${score}`
    );

    // Broadcast to all users in the event room (including sender for confirmation)
    io.to(roomId).emit("evaluation-submitted", {
      eventId,
      evaluationId,
      evaluatorId,
      evaluatorName,
      participantId,
      participantName,
      score,
      timestamp: timestamp || new Date().toISOString(),
    });
  });

  // ── Score Update ───────────────────────────────────────────────────────

  socket.on("score-update", (data: ScoreUpdateData) => {
    const { eventId, participantId, participantName, previousScore, newScore, updatedBy, timestamp } = data;

    if (!eventId) {
      socket.emit("error", { message: "eventId is required" });
      return;
    }

    const roomId = `event:${eventId}`;

    console.log(
      `[Score] Score update for ${participantName} in event ${eventId}: ${previousScore} → ${newScore} (by ${updatedBy})`
    );

    // Broadcast score update to all users in the event room
    io.to(roomId).emit("score-update", {
      eventId,
      participantId,
      participantName,
      previousScore,
      newScore,
      updatedBy,
      timestamp: timestamp || new Date().toISOString(),
    });
  });

  // ── Leaderboard Update ─────────────────────────────────────────────────

  socket.on("leaderboard-update", (data: LeaderboardUpdateData) => {
    const { eventId, triggeredBy, reason, timestamp } = data;

    if (!eventId) {
      socket.emit("error", { message: "eventId is required" });
      return;
    }

    const roomId = `event:${eventId}`;

    console.log(
      `[Leaderboard] Update triggered for event ${eventId} by ${triggeredBy} — reason: ${reason}`
    );

    // Broadcast leaderboard refresh signal to all users in the event room
    io.to(roomId).emit("leaderboard-update", {
      eventId,
      triggeredBy,
      reason,
      timestamp: timestamp || new Date().toISOString(),
    });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    console.log(`[Disconnect] Socket ${socket.id} disconnected — reason: ${reason}`);

    const userId = socket.data.currentUserId;
    const eventId = socket.data.currentEventId;

    if (userId && eventId) {
      // Clean up user from room
      const leftEventIds = removeUserFromAllRooms(socket.id, userId);

      for (const leftEventId of leftEventIds) {
        const roomId = `event:${leftEventId}`;
        const userCount = getRoomUserCount(leftEventId);

        // Notify others in the room
        socket.to(roomId).emit("user-left", {
          eventId: leftEventId,
          userId,
          userName: socket.data.userName,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `[Cleanup] User ${socket.data.userName} removed from event ${leftEventId} on disconnect — room size: ${userCount}`
        );
      }
    }
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🚀 Realtime service (Socket.io) running on port ${PORT}`);
  console.log(`   CORS enabled for http://localhost:3000`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Shutdown] SIGTERM received, closing server...");
  io.close();
  httpServer.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Shutdown] SIGINT received, closing server...");
  io.close();
  httpServer.close();
  process.exit(0);
});
