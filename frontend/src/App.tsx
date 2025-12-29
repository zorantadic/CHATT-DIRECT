import VoiceChat from "./VoiceChat";

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1>Live voice chat (Azure Speech + Azure OpenAI)</h1>
      <VoiceChat />
    </div>
  );
}



// === DEV TEST: Speech → Agent1 ===
//import SpeechToAgentTest from "./SpeechToAgentTest";

//export default function App() {
  //return (
  //  <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
   //   <h1>Speech → Agent1 (DEV test)</h1>
     // <SpeechToAgentTest />
    //</div>
  //);
//}
