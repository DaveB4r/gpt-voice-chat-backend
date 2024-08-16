import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import { getUsers, userJoin, userLeave } from "./utils/user";
import { aiMessage, aiVoiceMsg, transcript } from "./utils/ai_assistant";
import dotenv from "dotenv";

dotenv.config();

interface MessageInterface {
  sendMessage: string;
  username: string;
  time: string;
  voice_message: boolean;
  file?: string | null;
  src?: string | undefined;
}

const app = express();

app.use('/assets', express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [ // add your uri
      process.env.EXPO_HOST as string,
      process.env.REACT_HOST as string,
    ],
  },
});

io.on("connection", (socket) => {
  socket.join("myChat");

  socket.on("handle-connection", (username: string) => {
    if (!userJoin(socket.id, username)) {
      socket.emit("username-taken");
    } else {
      socket.emit("username-submitted-successfully");
      io.to("myChat").emit("get-connected-users", getUsers());
    }
  });

  socket.on("message", async (message: MessageInterface) => {
    if (message.voice_message) {
      const file = message.file as string;
      const time = Date.now().toString();
      const fileName = `./src/assets/user_audio/${time}.mp3`;
      fs.writeFileSync(fileName, file);
      const msgTranscripted = await transcript(fileName);
      const aiMsg: MessageInterface = {
        sendMessage: msgTranscripted,
        username: message.username,
        time: message.time,
        voice_message: message.voice_message,
        file: message.file,
        src: message.src,
      };
      io.to("myChat").emit("receive-message", aiMsg);
      const gptVoiceMsg = await aiVoiceMsg(msgTranscripted);
      const voiceMessage: MessageInterface = {
        sendMessage: gptVoiceMsg.transcription,
        username: "ai_user",
        time: message.time,
        voice_message: message.voice_message,
        file: message.file,
        src: `http://localhost:3000/assets/${gptVoiceMsg.fileName}`,
      };
      io.to("myChat").emit("receive-message", voiceMessage);
    } else {
      socket.broadcast.to("myChat").emit("receive-message", message);
      const gptMsg = await aiMessage(message.sendMessage);
      const aiMsg: MessageInterface = {
        sendMessage: gptMsg,
        username: "ai_user",
        time: message.time,
        voice_message: false,
      };
      io.to("myChat").emit("receive-message", aiMsg);
    }
  });

  socket.on("disconnect", () => {
    userLeave(socket.id);
  });
});

server.listen(3000, () => console.log("Server on http://localhost:" + 3000));
