import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:3001");

function App() {
  const [message, setMessage] = useState<string>("");
  const [chat, setChat] = useState<string[]>([]);

  const localStreamRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    socket.on("receive-message", (data: string) => {
      setChat((prev) => [...prev, `Amigo: ${data}`]);
    });

    socket.on("offer", async (data: RTCSessionDescriptionInit) => {
      await createPeerConnection();
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(data);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (data: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(data);
    });

    socket.on("ice-candidate", (data: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(data);
      }
    });

    return () => {
      socket.off("receive-message");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, []);

  const sendMessage = () => {
    setChat((prev) => [...prev, `Você: ${message}`]);
    socket.emit("send-message", message);
    setMessage("");
  };

  const startCall = async () => {
    await createPeerConnection();
    if (!peerConnectionRef.current) return;

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    socket.emit("offer", offer);
  };

  const createPeerConnection = async () => {
    peerConnectionRef.current = new RTCPeerConnection();

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.srcObject = event.streams[0];
      }
    };

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localStream.getTracks().forEach((track) => {
      peerConnectionRef.current?.addTrack(track, localStream);
    });

    if (localStreamRef.current) {
      localStreamRef.current.srcObject = localStream;
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const senders = peerConnectionRef.current?.getSenders() || [];
      senders.forEach((sender) => {
        if (sender.track?.kind === "video") {
          sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
      });

      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStream;
      }
    } catch (err) {
      console.error("Erro ao compartilhar tela:", err);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Chat + Voz + Compartilhar Tela</h2>

      <div>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem"
        />
        <button onClick={sendMessage}>Enviar</button>
      </div>

      <div style={{ marginTop: "1rem" }}>
        {chat.map((msg, idx) => (
          <div key={idx}>{msg}</div>
        ))}
      </div>

      <hr />

      <button onClick={startCall}>Iniciar chamada de voz/vídeo</button>
      <button onClick={shareScreen}>Compartilhar tela</button>

      <div style={{ display: "flex", marginTop: "1rem", gap: "1rem" }}>
        <div>
          <h4>Você</h4>
          <video
            autoPlay
            muted
            ref={localStreamRef}
            style={{ width: "300px", border: "1px solid black" }}
          />
        </div>

        <div>
          <h4>Amigo</h4>
          <video
            autoPlay
            ref={remoteStreamRef}
            style={{ width: "300px", border: "1px solid black" }}
          />
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <h4>O que você está compartilhando</h4>
        <video
          autoPlay
          muted
          ref={screenShareRef}
          style={{ width: "600px", border: "2px dashed blue" }}
        />
      </div>
    </div>
  );
}

export default App;
