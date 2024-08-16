import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY as string, // use your open ai key
});

export const aiMessage = async (msg: string): Promise<string> => {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are a english tutor and your goal it's to help people improve their grammar, listening and speaking skills.",
      },
      {
        role: "user",
        content: msg,
      },
    ],
    model: "gpt-4o",
  });
  return completion.choices[0].message.content as string;
};

export const transcript = async (filePath: string) => {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  });
  return transcription.text;
};

export const aiVoiceMsg = async (msg: string) => {
  const gptMsg = await aiMessage(msg);
  const time = Date.now().toString();
  const fileName = `ai_audio/${time}.mp3` ;
  const audioFile = path.resolve(`./src/public/${fileName}`);
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: gptMsg,
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(audioFile, buffer);
  const transcription = await transcript(audioFile);
  return { fileName, transcription };
};
