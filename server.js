require("dotenv").config(); // .env 파일의 내용을 불러오는 코드 (맨 위에 추가)
// 1. 필요한 부품(라이브러리)을 가져옵니다.
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose"); // Mongoose 부품 가져오기
const cors = require("cors"); // CORS 부품 가져오기

// 2. 기본 앱과 서버를 만듭니다.
const app = express(); // Express 앱 생성 (가스레인지 본체)
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello, this is the chat server!");
});
const server = http.createServer(app); // Express 앱으로 HTTP 서버 생성 (가스레인지 점화 장치)
const io = new Server(server, {
  // 이 부분을 수정
  cors: {
    origin: "*", // 모든 곳에서의 통신을 허용 (개발 중에는 편리)
    methods: ["GET", "POST"],
  },
});

// --- 데이터베이스 연결 ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB에 성공적으로 연결되었습니다."))
  .catch((err) => console.error("❌ MongoDB 연결 실패:", err));

const messageSchema = new mongoose.Schema({
  roomKey: String,
  sender: { id: String, nickname: String },
  text: String,
  timestamp: { type: Date, default: Date.now },
  nextNodeKey: { type: String, default: null }, // 다음 노드 키를 저장할 필드 추가
});
const Message = mongoose.model("Message", messageSchema);

// --- Socket.IO 실시간 통신 로직 ---
// 'connection'은 손님이 가게에 전화를 걸면 자동으로 발생하는 이벤트입니다.
io.on("connection", (socket) => {
  console.log(`[연결] 새로운 손님 전화 연결: ${socket.id}`);

  // 손님이 'joinRoom'(방에 들어갈게요) 이라고 말하면 실행될 로직
  socket.on("joinRoom", async ({ roomKey }) => {
    socket.join(roomKey); // 손님을 해당 방 번호(roomKey)와 연결
    console.log(`[입장] 손님 ${socket.id} 가 ${roomKey} 방에 입장.`);

    // 이 방의 이전 주문 내역(채팅 기록)을 찾아서
    const history = await Message.find({ roomKey: roomKey })
      .sort({ timestamp: 1 })
      .limit(50);
    // 방금 전화한 손님에게만 'history'라는 이름으로 이전 주문 내역을 보내줌
    socket.emit("history", history);
  });

  // 손님이 'sendMessage'(주문할게요) 이라고 말하면 실행될 로직
  socket.on("sendMessage", async ({ roomKey, sender, text, nextNodeKey }) => {
    // nextNodeKey 추가
    const newMessage = new Message({ roomKey, sender, text, nextNodeKey }); // nextNodeKey 추가
    const savedMessage = await newMessage.save();

    io.to(roomKey).emit("receiveMessage", savedMessage);
  });

  // 손님이 전화를 끊으면 ('disconnect') 자동으로 실행될 로직
  socket.on("disconnect", () => {
    console.log(`[연결 종료] 손님 전화 끊김: ${socket.id}`);
  });
});

// 서버가 요청을 기다리도록(listen) 설정합니다.
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
