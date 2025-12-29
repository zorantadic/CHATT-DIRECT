import ManualVoiceChat from "./ManualVoiceChat";

export default function App() {
  return (
    <ManualVoiceChat
      onBack={() => {
        window.location.href = "http://localhost:5173";
      }}
    />
  );
}
